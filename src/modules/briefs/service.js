//src/modules/briefs/service.js
/**
 * CreatorsMantra Backend - Brief Analyzer Service
 * Core business logic for brief processing, AI extraction, and deal conversion
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Brief CRUD operations, AI integration, file processing
 */

const { Brief } = require('./model');
const { Deal } = require('../deals/model');
const { User } = require('../auth/model');
const { 
  successResponse, 
  errorResponse,
  logInfo,
  logError,
  logWarn
} = require('../../shared/utils');
const config = require('../../shared/config');
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const PDFParse = require('pdf-parse');
const mammoth = require('mammoth'); // For .docx files

// ============================================
// OPENAI CONFIGURATION
// ============================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class BriefAnalyzerService {

  // ============================================
  // CORE CRUD OPERATIONS
  // ============================================

  /**
   * Create Brief from Text Input
   * @param {Object} briefData - Brief creation data
   * @param {String} creatorId - Creator ID
   * @returns {Object} Created brief
   */
  async createTextBrief(briefData, creatorId) {
    try {
      logInfo('Creating text brief', { creatorId, textLength: briefData.rawText?.length });

      // Check subscription limits
      await this.checkSubscriptionLimits(creatorId, 'create_brief');

      const brief = new Brief({
        creatorId,
        inputType: 'text_paste',
        originalContent: {
          rawText: briefData.rawText
        },
        subscriptionTier: briefData.subscriptionTier || 'starter',
        status: 'draft',
        creatorNotes: briefData.notes || '',
        tags: briefData.tags || []
      });

      await brief.save();

      logInfo('Text brief created successfully', { 
        briefId: brief.briefId,
        creatorId 
      });

      // Trigger AI processing if user has access
      if (await this.hasAIAccess(creatorId)) {
        this.processAIExtraction(brief._id).catch(error => {
          logError('AI processing failed for brief', { 
            briefId: brief._id, 
            error: error.message 
          });
        });
      }

      return brief;

    } catch (error) {
      logError('Error creating text brief', { creatorId, error: error.message });
      throw error;
    }
  }

  /**
   * Create Brief from File Upload
   * @param {Object} fileData - Uploaded file data
   * @param {String} creatorId - Creator ID
   * @returns {Object} Created brief
   */
  async createFileBrief(fileData, creatorId) {
    try {
      logInfo('Creating file brief', { 
        creatorId, 
        filename: fileData.filename,
        fileSize: fileData.size 
      });

      // Check subscription limits
      await this.checkSubscriptionLimits(creatorId, 'create_brief');
      await this.checkFileLimits(creatorId, fileData.size);

      // Extract text from file
      const extractedText = await this.extractTextFromFile(fileData);

      const brief = new Brief({
        creatorId,
        inputType: 'file_upload',
        originalContent: {
          rawText: extractedText,
          uploadedFile: {
            filename: fileData.filename,
            originalName: fileData.originalname,
            fileSize: fileData.size,
            mimeType: fileData.mimetype,
            uploadPath: fileData.path,
            uploadedAt: new Date()
          }
        },
        subscriptionTier: fileData.subscriptionTier || 'starter',
        status: 'draft'
      });

      await brief.save();

      logInfo('File brief created successfully', { 
        briefId: brief.briefId,
        extractedTextLength: extractedText.length 
      });

      // Trigger AI processing if user has access
      if (await this.hasAIAccess(creatorId)) {
        this.processAIExtraction(brief._id).catch(error => {
          logError('AI processing failed for file brief', { 
            briefId: brief._id, 
            error: error.message 
          });
        });
      }

      return brief;

    } catch (error) {
      logError('Error creating file brief', { creatorId, error: error.message });
      throw error;
    }
  }

  /**
   * Get Brief by ID
   * @param {String} briefId - Brief ID
   * @param {String} creatorId - Creator ID
   * @returns {Object} Brief data
   */
  async getBriefById(briefId, creatorId) {
    try {
      const brief = await Brief.findOne({
        _id: briefId,
        creatorId,
        isDeleted: false
      });

      if (!brief) {
        throw new Error('Brief not found');
      }

      // Increment view count
      brief.viewCount += 1;
      await brief.save();

      logInfo('Brief retrieved successfully', { briefId, creatorId });

      return brief;

    } catch (error) {
      logError('Error retrieving brief', { briefId, creatorId, error: error.message });
      throw error;
    }
  }

  /**
   * Get Creator's Briefs with Filtering
   * @param {String} creatorId - Creator ID
   * @param {Object} filters - Filter options
   * @returns {Object} Paginated briefs
   */
  async getCreatorBriefs(creatorId, filters = {}) {
    try {
      const {
        status,
        inputType,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search
      } = filters;

      // Build query
      const query = {
        creatorId,
        isDeleted: false
      };

      if (status) query.status = status;
      if (inputType) query.inputType = inputType;

      // Add search functionality
      if (search) {
        query.$or = [
          { 'aiExtraction.brandInfo.name': { $regex: search, $options: 'i' } },
          { 'aiExtraction.campaignInfo.name': { $regex: search, $options: 'i' } },
          { 'originalContent.rawText': { $regex: search, $options: 'i' } },
          { creatorNotes: { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
      const skip = (page - 1) * limit;

      const [briefs, total] = await Promise.all([
        Brief.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Brief.countDocuments(query)
      ]);

      // Add computed fields
      const enrichedBriefs = briefs.map(brief => ({
        ...brief,
        completionPercentage: this.calculateCompletionPercentage(brief),
        estimatedValue: this.calculateEstimatedValue(brief),
        daysOld: Math.floor((Date.now() - new Date(brief.createdAt).getTime()) / (24 * 60 * 60 * 1000))
      }));

      logInfo('Creator briefs retrieved', { 
        creatorId, 
        count: briefs.length,
        total,
        filters 
      });

      return {
        briefs: enrichedBriefs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      };

    } catch (error) {
      logError('Error retrieving creator briefs', { creatorId, error: error.message });
      throw error;
    }
  }

  /**
   * Update Brief
   * @param {String} briefId - Brief ID
   * @param {Object} updateData - Update data
   * @param {String} creatorId - Creator ID
   * @returns {Object} Updated brief
   */
  async updateBrief(briefId, updateData, creatorId) {
    try {
      const brief = await Brief.findOne({
        _id: briefId,
        creatorId,
        isDeleted: false
      });

      if (!brief) {
        throw new Error('Brief not found');
      }

      // Update allowed fields
      const allowedUpdates = [
        'creatorNotes',
        'tags',
        'status',
        'clarifications.customQuestions'
      ];

      Object.keys(updateData).forEach(key => {
        if (allowedUpdates.includes(key)) {
          if (key.includes('.')) {
            // Handle nested updates
            const [parent, child] = key.split('.');
            if (!brief[parent]) brief[parent] = {};
            brief[parent][child] = updateData[key];
          } else {
            brief[key] = updateData[key];
          }
        }
      });

      await brief.save();

      logInfo('Brief updated successfully', { briefId, creatorId, updates: Object.keys(updateData) });

      return brief;

    } catch (error) {
      logError('Error updating brief', { briefId, creatorId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete Brief (Soft Delete)
   * @param {String} briefId - Brief ID
   * @param {String} creatorId - Creator ID
   * @returns {Boolean} Success status
   */
  async deleteBrief(briefId, creatorId) {
    try {
      const brief = await Brief.findOne({
        _id: briefId,
        creatorId,
        isDeleted: false
      });

      if (!brief) {
        throw new Error('Brief not found');
      }

      // Check if brief is converted to deal
      if (brief.dealConversion.isConverted) {
        throw new Error('Cannot delete brief that has been converted to a deal');
      }

      brief.isDeleted = true;
      brief.deletedAt = new Date();
      await brief.save();

      logInfo('Brief deleted successfully', { briefId, creatorId });

      return true;

    } catch (error) {
      logError('Error deleting brief', { briefId, creatorId, error: error.message });
      throw error;
    }
  }

  // ============================================
  // AI EXTRACTION LOGIC
  // ============================================

  /**
   * Process AI Extraction for Brief
   * @param {String} briefId - Brief ID
   * @returns {Object} AI extraction results
   */
  async processAIExtraction(briefId) {
    try {
      const brief = await Brief.findById(briefId);
      if (!brief) {
        throw new Error('Brief not found');
      }

      logInfo('Starting AI extraction', { briefId });

      // Update status to processing
      brief.aiExtraction.status = 'processing';
      await brief.save();

      const startTime = Date.now();

      // Perform AI extraction
      const extractionResults = await this.performAIExtraction(brief.originalContent.rawText);

      // Calculate processing metrics
      const processingTime = Date.now() - startTime;

      // Update brief with AI results
      brief.aiExtraction = {
        ...brief.aiExtraction,
        ...extractionResults,
        status: 'completed',
        processingMetadata: {
          modelUsed: 'gpt-3.5-turbo',
          tokensUsed: extractionResults.tokensUsed || 0,
          processingTime,
          confidenceScore: extractionResults.confidenceScore || 85,
          extractionVersion: '1.0'
        }
      };

      // Update overall status based on extraction results
      if (extractionResults.missingInfo.filter(info => info.importance === 'critical').length === 0) {
        brief.status = 'ready_for_deal';
      } else {
        brief.status = 'needs_clarification';
      }

      // Generate clarification questions
      const clarificationQuestions = await this.generateClarificationQuestions(extractionResults.missingInfo);
      brief.clarifications.suggestedQuestions = clarificationQuestions;

      await brief.save();

      logInfo('AI extraction completed successfully', { 
        briefId, 
        processingTime,
        deliverables: extractionResults.deliverables.length 
      });

      return brief.aiExtraction;

    } catch (error) {
      logError('AI extraction failed', { briefId, error: error.message });
      
      // Update brief status to failed
      await Brief.findByIdAndUpdate(briefId, {
        'aiExtraction.status': 'failed'
      });
      
      throw error;
    }
  }

  /**
   * Core AI Extraction Logic
   * @param {String} briefText - Raw brief text
   * @returns {Object} Extracted data
   */
  async performAIExtraction(briefText) {
    try {
      const prompt = this.buildExtractionPrompt(briefText);

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing brand collaboration briefs for Indian content creators. Extract information accurately and flag missing critical details.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Low temperature for consistency
        max_tokens: 2000
      });

      const extractedData = JSON.parse(response.choices[0].message.content);

      // Post-process and validate extracted data
      const processedData = this.postProcessExtractionResults(extractedData);

      logInfo('AI extraction successful', { 
        deliverables: processedData.deliverables.length,
        missingInfo: processedData.missingInfo.length 
      });

      return processedData;

    } catch (error) {
      logError('AI extraction API call failed', { error: error.message });
      throw new Error('AI extraction failed: ' + error.message);
    }
  }

  /**
   * Build AI Extraction Prompt
   * @param {String} briefText - Raw brief text
   * @returns {String} Formatted prompt
   */
  buildExtractionPrompt(briefText) {
    return `
Analyze this brand collaboration brief and extract the following information. Return ONLY valid JSON.

BRIEF TEXT:
"""
${briefText}
"""

Extract and return this exact JSON structure:

{
  "brandInfo": {
    "name": "Brand name if mentioned",
    "contactPerson": "Contact person name if mentioned",
    "email": "Email if mentioned",
    "company": "Company name if different from brand"
  },
  "campaignInfo": {
    "name": "Campaign/project name if mentioned",
    "type": "Campaign type (product launch, awareness, etc.)",
    "description": "Brief campaign description"
  },
  "deliverables": [
    {
      "type": "instagram_post|instagram_reel|instagram_story|youtube_video|youtube_shorts|linkedin_post|twitter_post|blog_post|other",
      "quantity": number,
      "description": "Detailed description",
      "duration": "Duration for video content",
      "requirements": ["List of specific requirements"],
      "platform": "Platform name",
      "estimatedValue": number_in_rupees
    }
  ],
  "timeline": {
    "briefDate": "YYYY-MM-DD if mentioned",
    "contentDeadline": "YYYY-MM-DD if mentioned",
    "postingStartDate": "YYYY-MM-DD if mentioned", 
    "postingEndDate": "YYYY-MM-DD if mentioned",
    "isUrgent": boolean
  },
  "budget": {
    "mentioned": boolean,
    "amount": number_in_rupees,
    "isRange": boolean,
    "minAmount": number_if_range,
    "maxAmount": number_if_range,
    "paymentTerms": "Payment terms if mentioned"
  },
  "brandGuidelines": {
    "hashtags": ["List of hashtags mentioned"],
    "mentions": ["List of mentions required"],
    "brandColors": ["List of brand colors if mentioned"],
    "keyMessages": ["Key messages to include"],
    "restrictions": ["Things to avoid or restrictions"]
  },
  "usageRights": {
    "duration": "Usage duration if mentioned",
    "scope": ["organic", "paid", "cross-platform"],
    "isPerpetual": boolean,
    "exclusivity": {
      "required": boolean,
      "duration": "Exclusivity duration",
      "scope": "Exclusivity scope"
    }
  },
  "missingInfo": [
    {
      "category": "budget|timeline|usage_rights|exclusivity|payment_terms|content_specs|brand_guidelines|contact_info|deliverables|approval_process",
      "description": "What specific information is missing",
      "importance": "critical|important|nice_to_have"
    }
  ],
  "riskAssessment": {
    "overallRisk": "low|medium|high",
    "riskFactors": [
      {
        "type": "Risk type",
        "description": "Risk description",
        "severity": "low|medium|high"
      }
    ]
  },
  "confidenceScore": number_between_0_and_100
}

IMPORTANT RULES:
1. Be conservative with estimated values - use market rates for Indian creators
2. Flag missing critical information like budget, timeline, usage rights
3. Identify any risky clauses like perpetual usage or long exclusivity
4. For deliverable values, use these rough guidelines:
   - Instagram Post: ₹5,000-50,000 (based on follower count context)
   - Instagram Reel: ₹10,000-100,000
   - Instagram Story: ₹2,000-20,000
   - YouTube Video: ₹25,000-500,000
   - YouTube Shorts: ₹5,000-50,000
5. Mark timeline as urgent if phrases like "ASAP", "urgent", "next week" appear
6. Always return valid JSON only, no additional text
`;
  }

  /**
   * Post-process AI Extraction Results
   * @param {Object} rawData - Raw AI extraction data
   * @returns {Object} Processed data
   */
  postProcessExtractionResults(rawData) {
    try {
      // Validate and sanitize deliverables
      const deliverables = rawData.deliverables.map(deliverable => ({
        ...deliverable,
        quantity: Math.max(1, deliverable.quantity || 1),
        estimatedValue: Math.max(0, deliverable.estimatedValue || 0),
        requirements: Array.isArray(deliverable.requirements) ? deliverable.requirements : []
      }));

      // Ensure missing info has proper structure
      const missingInfo = (rawData.missingInfo || []).map(info => ({
        category: info.category,
        description: info.description,
        importance: ['critical', 'important', 'nice_to_have'].includes(info.importance) 
          ? info.importance 
          : 'important'
      }));

      // Calculate overall risk
      const riskFactors = rawData.riskAssessment?.riskFactors || [];
      const highRiskCount = riskFactors.filter(factor => factor.severity === 'high').length;
      const overallRisk = highRiskCount > 0 ? 'high' 
        : riskFactors.length > 2 ? 'medium' 
        : 'low';

      return {
        ...rawData,
        deliverables,
        missingInfo,
        riskAssessment: {
          ...rawData.riskAssessment,
          overallRisk
        }
      };

    } catch (error) {
      logError('Error post-processing AI results', { error: error.message });
      throw error;
    }
  }

  // ============================================
  // CLARIFICATION MANAGEMENT
  // ============================================

  /**
   * Generate Clarification Questions
   * @param {Array} missingInfo - Missing information array
   * @returns {Array} Clarification questions
   */
  async generateClarificationQuestions(missingInfo) {
    try {
      const questions = [];

      // Generate questions based on missing info
      missingInfo.forEach(info => {
        const question = this.getQuestionTemplate(info.category, info.description);
        if (question) {
          questions.push({
            question,
            category: info.category,
            priority: info.importance === 'critical' ? 'high' : 'medium',
            isAnswered: false
          });
        }
      });

      // Add standard clarification questions
      const standardQuestions = [
        {
          question: "What is the expected number of revision rounds included?",
          category: "approval_process",
          priority: "medium",
          isAnswered: false
        },
        {
          question: "Are there any competitor exclusivity requirements?",
          category: "exclusivity",
          priority: "high",
          isAnswered: false
        }
      ];

      return [...questions, ...standardQuestions];

    } catch (error) {
      logError('Error generating clarification questions', { error: error.message });
      return [];
    }
  }

  /**
   * Get Question Template by Category
   * @param {String} category - Missing info category
   * @param {String} description - Specific description
   * @returns {String} Question text
   */
  getQuestionTemplate(category, description) {
    const templates = {
      budget: "Could you please share the budget allocated for this collaboration?",
      timeline: "What are the specific deadlines for content creation and posting?",
      usage_rights: "What is the duration and scope of usage rights for the created content?",
      exclusivity: "Are there any exclusivity requirements or restrictions?",
      payment_terms: "What are the payment terms (advance percentage, payment timeline)?",
      content_specs: "Could you provide specific content requirements (resolution, format, duration)?",
      brand_guidelines: "Are there specific brand guidelines or style requirements to follow?",
      contact_info: "Could you provide the primary point of contact for this campaign?",
      deliverables: "Could you clarify the exact deliverables and quantities required?",
      approval_process: "What is the content approval process and expected turnaround time?"
    };

    return templates[category] || `Could you provide more details about: ${description}`;
  }

  /**
   * Generate Clarification Email Template
   * @param {String} briefId - Brief ID
   * @returns {Object} Email template
   */
  async generateClarificationEmail(briefId) {
    try {
      const brief = await Brief.findById(briefId);
      if (!brief) {
        throw new Error('Brief not found');
      }

      const unansweredQuestions = brief.clarifications.suggestedQuestions.filter(
        q => !q.isAnswered
      );

      if (unansweredQuestions.length === 0) {
        return null;
      }

      const brandName = brief.aiExtraction.brandInfo.name || 'Brand';
      const creatorUser = await User.findById(brief.creatorId);
      const creatorName = creatorUser?.fullName || 'Creator';

      const subject = `Collaboration Clarifications - ${brandName}`;
      
      const body = `Hi Team,

Thank you for considering me for this collaboration opportunity! I'm excited about working with ${brandName}.

To ensure I deliver exactly what you're looking for, I have a few clarifications:

${unansweredQuestions.map((q, index) => `${index + 1}. ${q.question}`).join('\n')}

These details will help me provide you with an accurate timeline and create content that perfectly aligns with your campaign objectives.

Looking forward to your response!

Best regards,
${creatorName}`;

      const emailTemplate = {
        subject,
        body,
        generated: true
      };

      // Update brief with email template
      brief.clarifications.clarificationEmail = emailTemplate;
      await brief.save();

      logInfo('Clarification email generated', { briefId, questionsCount: unansweredQuestions.length });

      return emailTemplate;

    } catch (error) {
      logError('Error generating clarification email', { briefId, error: error.message });
      throw error;
    }
  }

  // ============================================
  // DEAL CONVERSION
  // ============================================

  /**
   * Convert Brief to Deal
   * @param {String} briefId - Brief ID
   * @param {String} creatorId - Creator ID
   * @param {Object} dealOverrides - Deal override data
   * @returns {Object} Created deal
   */
  async convertToDeal(briefId, creatorId, dealOverrides = {}) {
    try {
      const brief = await Brief.findOne({
        _id: briefId,
        creatorId,
        isDeleted: false
      });

      if (!brief) {
        throw new Error('Brief not found');
      }

      if (brief.dealConversion.isConverted) {
        throw new Error('Brief has already been converted to a deal');
      }

      if (!brief.isReadyForDeal()) {
        throw new Error('Brief has critical missing information. Please complete clarifications first.');
      }

      // Build deal data from brief
      const dealData = this.buildDealFromBrief(brief, dealOverrides);

      // Create deal using Deal service
      const Deal = require('../deals/model').Deal;
      const deal = new Deal(dealData);
      await deal.save();

      // Update brief conversion status
      brief.dealConversion = {
        isConverted: true,
        dealId: deal._id,
        convertedAt: new Date(),
        conversionMethod: Object.keys(dealOverrides).length > 0 ? 'manual_edit' : 'one_click'
      };
      brief.status = 'converted';
      await brief.save();

      logInfo('Brief converted to deal successfully', { 
        briefId, 
        dealId: deal._id,
        estimatedValue: brief.getEstimatedValue() 
      });

      return deal;

    } catch (error) {
      logError('Error converting brief to deal', { briefId, creatorId, error: error.message });
      throw error;
    }
  }

  /**
   * Build Deal Data from Brief
   * @param {Object} brief - Brief object
   * @param {Object} overrides - Override data
   * @returns {Object} Deal data
   */
  buildDealFromBrief(brief, overrides = {}) {
    const ai = brief.aiExtraction;
    
    return {
      creatorId: brief.creatorId,
      brandProfile: {
        name: overrides.brandName || ai.brandInfo.name || 'Brand Name Required',
        contactPerson: ai.brandInfo.contactPerson || '',
        email: ai.brandInfo.email || '',
        phone: ai.brandInfo.phone || ''
      },
      campaignName: overrides.campaignName || ai.campaignInfo.name || 'Campaign from Brief',
      platform: overrides.platform || this.getPrimaryPlatform(ai.deliverables),
      dealValue: {
        amount: overrides.amount || brief.getEstimatedValue(),
        currency: 'INR',
        gstApplicable: overrides.gstApplicable !== undefined ? overrides.gstApplicable : true,
        tdsApplicable: overrides.tdsApplicable !== undefined ? overrides.tdsApplicable : false
      },
      deliverables: ai.deliverables.map(d => ({
        type: d.type,
        description: d.description,
        quantity: d.quantity,
        platform: d.platform,
        status: 'pending',
        requirements: d.requirements || []
      })),
      timeline: {
        pitchedDate: new Date(),
        responseDeadline: overrides.responseDeadline || this.calculateResponseDeadline(),
        contentDeadline: ai.timeline.contentDeadline ? new Date(ai.timeline.contentDeadline) : null,
        liveDate: ai.timeline.postingStartDate ? new Date(ai.timeline.postingStartDate) : null
      },
      stage: 'pitched',
      priority: ai.timeline.isUrgent ? 'high' : 'medium',
      briefReference: {
        briefId: brief._id,
        extractionDate: brief.lastProcessedAt
      },
      subscriptionTier: brief.subscriptionTier
    };
  }

  /**
   * Get Primary Platform from Deliverables
   * @param {Array} deliverables - Deliverables array
   * @returns {String} Primary platform
   */
  getPrimaryPlatform(deliverables) {
    if (!deliverables || deliverables.length === 0) return 'instagram';
    
    const platforms = deliverables.map(d => {
      if (d.type.includes('instagram')) return 'instagram';
      if (d.type.includes('youtube')) return 'youtube';
      if (d.type.includes('linkedin')) return 'linkedin';
      if (d.type.includes('twitter')) return 'twitter';
      return 'instagram';
    });

    // Return most common platform
    const platformCount = platforms.reduce((acc, platform) => {
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});

    return Object.keys(platformCount).reduce((a, b) => 
      platformCount[a] > platformCount[b] ? a : b
    );
  }

  /**
   * Calculate Response Deadline
   * @returns {Date} Response deadline (7 days from now)
   */
  calculateResponseDeadline() {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    return deadline;
  }

  // ============================================
  // FILE PROCESSING
  // ============================================

  /**
   * Extract Text from Uploaded File
   * @param {Object} fileData - File data
   * @returns {String} Extracted text
   */
  async extractTextFromFile(fileData) {
    try {
      const filePath = fileData.path;
      const mimeType = fileData.mimetype;

      let extractedText = '';

      if (mimeType === 'application/pdf') {
        // Extract from PDF
        const fileBuffer = await fs.readFile(filePath);
        const pdfData = await PDFParse(fileBuffer);
        extractedText = pdfData.text;
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Extract from DOCX
        const result = await mammoth.extractRawText({ path: filePath });
        extractedText = result.value;
      } else if (mimeType === 'text/plain') {
        // Extract from TXT
        extractedText = await fs.readFile(filePath, 'utf8');
      } else {
        throw new Error('Unsupported file type');
      }

      // Clean and validate extracted text
      extractedText = extractedText.trim();
      if (extractedText.length === 0) {
        throw new Error('No text content found in file');
      }

      logInfo('Text extracted from file successfully', { 
        filename: fileData.filename,
        textLength: extractedText.length 
      });

      return extractedText;

    } catch (error) {
      logError('Error extracting text from file', { 
        filename: fileData.filename,
        error: error.message 
      });
      throw new Error('Failed to extract text from file: ' + error.message);
    }
  }

  // ============================================
  // SUBSCRIPTION & LIMITS
  // ============================================

  /**
   * Check if Creator has AI Access
   * @param {String} creatorId - Creator ID
   * @returns {Boolean} Has AI access
   */
  async hasAIAccess(creatorId) {
    try {
      const user = await User.findById(creatorId);
      if (!user) return false;

      const aiEnabledTiers = ['pro', 'elite', 'agency_starter', 'agency_pro'];
      return aiEnabledTiers.includes(user.subscriptionTier);

    } catch (error) {
      logError('Error checking AI access', { creatorId, error: error.message });
      return false;
    }
  }

  /**
   * Check Subscription Limits for Brief Creation
   * @param {String} creatorId - Creator ID
   * @param {String} action - Action type
   * @returns {Boolean} Within limits
   */
  async checkSubscriptionLimits(creatorId, action) {
    try {
      const user = await User.findById(creatorId);
      if (!user) {
        throw new Error('User not found');
      }

      const limits = Brief.getSubscriptionLimits(user.subscriptionTier);
      
      if (action === 'create_brief' && limits.maxBriefsPerMonth !== -1) {
        // Check monthly brief limit
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const briefsThisMonth = await Brief.countDocuments({
          creatorId,
          createdAt: { $gte: startOfMonth },
          isDeleted: false
        });

        if (briefsThisMonth >= limits.maxBriefsPerMonth) {
          throw new Error(`Monthly brief limit exceeded. Upgrade to create more briefs.`);
        }
      }

      return true;

    } catch (error) {
      logError('Subscription limit check failed', { creatorId, action, error: error.message });
      throw error;
    }
  }

  /**
   * Check File Upload Limits
   * @param {String} creatorId - Creator ID
   * @param {Number} fileSize - File size in bytes
   * @returns {Boolean} Within limits
   */
  async checkFileLimits(creatorId, fileSize) {
    try {
      const user = await User.findById(creatorId);
      if (!user) {
        throw new Error('User not found');
      }

      const limits = Brief.getSubscriptionLimits(user.subscriptionTier);
      
      if (fileSize > limits.maxFileSize) {
        const maxSizeMB = Math.round(limits.maxFileSize / (1024 * 1024));
        throw new Error(`File size exceeds limit of ${maxSizeMB}MB for ${user.subscriptionTier} plan`);
      }

      return true;

    } catch (error) {
      logError('File limit check failed', { creatorId, fileSize, error: error.message });
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Calculate Completion Percentage
   * @param {Object} brief - Brief object
   * @returns {Number} Completion percentage
   */
  calculateCompletionPercentage(brief) {
    let completed = 0;
    let total = 10;

    if (brief.aiExtraction.status === 'completed') completed++;
    if (brief.aiExtraction.brandInfo.name) completed++;
    if (brief.aiExtraction.deliverables.length > 0) completed++;
    if (brief.aiExtraction.timeline.contentDeadline) completed++;
    if (brief.aiExtraction.budget.mentioned) completed++;
    if (brief.aiExtraction.brandGuidelines.hashtags.length > 0) completed++;
    if (brief.aiExtraction.usageRights.duration) completed++;
    
    const criticalMissing = brief.aiExtraction.missingInfo.filter(
      info => info.importance === 'critical'
    );
    if (criticalMissing.length === 0) completed++;
    
    if (brief.aiExtraction.riskAssessment.overallRisk) completed++;
    if (brief.creatorNotes) completed++;

    return Math.round((completed / total) * 100);
  }

  /**
   * Calculate Estimated Value
   * @param {Object} brief - Brief object
   * @returns {Number} Estimated value
   */
  calculateEstimatedValue(brief) {
    if (!brief.aiExtraction.deliverables) return 0;
    
    return brief.aiExtraction.deliverables.reduce((total, deliverable) => {
      return total + (deliverable.estimatedValue || 0);
    }, 0);
  }

  /**
   * Get Dashboard Statistics
   * @param {String} creatorId - Creator ID
   * @returns {Object} Dashboard stats
   */
  async getDashboardStats(creatorId) {
    try {
      const [
        totalBriefs,
        analyzedBriefs,
        readyForDeal,
        convertedBriefs,
        thisMonthBriefs,
        totalEstimatedValue
      ] = await Promise.all([
        Brief.countDocuments({ creatorId, isDeleted: false }),
        Brief.countDocuments({ creatorId, 'aiExtraction.status': 'completed', isDeleted: false }),
        Brief.countDocuments({ creatorId, status: 'ready_for_deal', isDeleted: false }),
        Brief.countDocuments({ creatorId, 'dealConversion.isConverted': true, isDeleted: false }),
        Brief.countDocuments({
          creatorId,
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          },
          isDeleted: false
        }),
        this.getTotalEstimatedValue(creatorId)
      ]);

      return {
        totalBriefs,
        analyzedBriefs,
        readyForDeal,
        convertedBriefs,
        thisMonthBriefs,
        totalEstimatedValue,
        analysisRate: totalBriefs > 0 ? Math.round((analyzedBriefs / totalBriefs) * 100) : 0,
        conversionRate: analyzedBriefs > 0 ? Math.round((convertedBriefs / analyzedBriefs) * 100) : 0
      };

    } catch (error) {
      logError('Error getting dashboard stats', { creatorId, error: error.message });
      throw error;
    }
  }

  /**
   * Get Total Estimated Value
   * @param {String} creatorId - Creator ID
   * @returns {Number} Total estimated value
   */
  async getTotalEstimatedValue(creatorId) {
    try {
      const briefs = await Brief.find({
        creatorId,
        'aiExtraction.status': 'completed',
        isDeleted: false
      }).lean();

      return briefs.reduce((total, brief) => {
        return total + this.calculateEstimatedValue(brief);
      }, 0);

    } catch (error) {
      logError('Error calculating total estimated value', { creatorId, error: error.message });
      return 0;
    }
  }
}

module.exports = new BriefAnalyzerService();