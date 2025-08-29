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
   * Process AI Extraction for Brief with Retry Logic
   * @param {String} briefId - Brief ID
   * @returns {Object} AI extraction results
   */
  async processAIExtraction(briefId) {
    const MAX_RETRIES = 2;
    let retryCount = 0;
    
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
      let extractionResults;

      // Retry logic for AI extraction
      while (retryCount <= MAX_RETRIES) {
        try {
          extractionResults = await this.performAIExtraction(brief.originalContent.rawText);
          break; // Success, exit retry loop
        } catch (aiError) {
          retryCount++;
          logWarn(`AI extraction attempt ${retryCount} failed`, { 
            briefId, 
            error: aiError.message,
            retryCount,
            maxRetries: MAX_RETRIES
          });
          
          if (retryCount > MAX_RETRIES) {
            throw aiError; // Final attempt failed, throw error
          }
          
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s...
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

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
          extractionVersion: '1.0',
          retryCount
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
        deliverables: extractionResults.deliverables.length,
        retryCount
      });

      return brief.aiExtraction;

    } catch (error) {
      logError('AI extraction failed after all retries', { 
        briefId, 
        error: error.message,
        retryCount 
      });
      
      // Update brief status to failed
      await Brief.findByIdAndUpdate(briefId, {
        'aiExtraction.status': 'failed',
        'aiExtraction.processingMetadata.retryCount': retryCount,
        'aiExtraction.processingMetadata.lastError': error.message
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
Analyze this brand collaboration brief and extract information.

CRITICAL INSTRUCTIONS:
- Return ONLY valid JSON with no markdown formatting
- Do NOT wrap JSON in code blocks or backticks
- Do NOT include explanatory text before or after JSON
- Your entire response must be parseable as JSON

BRIEF TEXT:
"""
${briefText}
"""

Return this EXACT JSON structure with actual values:

{
"brandInfo": {
  "name": "Extract brand name or empty string",
  "contactPerson": "Extract contact person or empty string", 
  "email": "Extract email or empty string",
  "company": "Extract company name or empty string"
},
"campaignInfo": {
  "name": "Extract campaign name or empty string",
  "type": "Extract campaign type or empty string", 
  "description": "Extract campaign description or empty string"
},
"deliverables": [
  {
    "type": "instagram_post",
    "quantity": 1,
    "description": "Description of deliverable",
    "duration": "For video content only",
    "requirements": ["List specific requirements"],
    "platform": "Platform name",
    "estimatedValue": 10000
  }
],
"timeline": {
  "briefDate": "2024-12-01",
  "contentDeadline": "2024-12-15",
  "postingStartDate": "2024-12-20",
  "postingEndDate": "2024-12-25",
  "campaignDuration": "5 days",
  "isUrgent": false
},
"budget": {
  "mentioned": true,
  "amount": 50000,
  "currency": "INR",
  "isRange": false,
  "minAmount": 0,
  "maxAmount": 0,
  "paymentTerms": "Payment terms if mentioned",
  "advancePercentage": 50
},
"brandGuidelines": {
  "hashtags": ["#hashtag1", "#hashtag2"],
  "mentions": ["@brand", "@mention"],
  "brandColors": ["#FF0000", "#00FF00"],
  "brandTone": "Professional/Casual/Fun etc",
  "keyMessages": ["Key message 1", "Key message 2"],
  "restrictions": ["Don't wear red", "Avoid competitor mentions"],
  "styling": "Visual style requirements"
},
"usageRights": {
  "duration": "6 months",
  "scope": ["organic", "paid"],
  "territory": "India",
  "isPerpetual": false,
  "exclusivity": {
    "required": true,
    "duration": "3 months", 
    "scope": "Category exclusivity"
  }
},
"contentRequirements": {
  "revisionRounds": 2,
  "approvalProcess": "Brand approval required",
  "contentFormat": ["MP4", "JPG"],
  "qualityGuidelines": ["4K resolution", "Professional lighting"],
  "technicalSpecs": {
    "resolution": "1080p",
    "aspectRatio": "16:9",
    "fileFormat": ["MP4", "MOV"]
  }
},
"missingInfo": [
  {
    "category": "budget",
    "description": "Budget amount not specified",
    "importance": "critical"
  }
],
"riskAssessment": {
  "overallRisk": "medium",
  "riskFactors": [
    {
      "type": "Timeline Risk",
      "description": "Tight deadline",
      "severity": "medium"
    }
  ]
},
"confidenceScore": 85
}

IMPORTANT RULES:

1. For "category" in missingInfo, use ONLY ONE of these values:
 - "budget"
 - "timeline" 
 - "usage_rights"
 - "exclusivity"
 - "payment_terms"
 - "content_specs"
 - "brand_guidelines"
 - "contact_info"
 - "deliverables"
 - "approval_process"

2. For deliverable "type", use ONLY ONE of these values:
 - "instagram_post"
 - "instagram_reel"
 - "instagram_story"
 - "youtube_video"
 - "youtube_shorts"
 - "linkedin_post"
 - "twitter_post"
 - "blog_post"
 - "other"

3. For "importance", use ONLY ONE of these values:
 - "critical"
 - "important" 
 - "nice_to_have"

4. For "overallRisk" and "severity", use ONLY:
 - "low"
 - "medium"
 - "high"

5. Use null for missing dates, empty strings for missing text, empty arrays for missing lists, 0 for missing numbers

6. Estimate values conservatively for Indian market:
 - Instagram Post: ₹5,000-50,000
 - Instagram Reel: ₹10,000-100,000  
 - Instagram Story: ₹2,000-20,000
 - YouTube Video: ₹25,000-500,000
 - YouTube Shorts: ₹5,000-50,000

7. Return ONLY the JSON object - no additional text
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
    const deliverables = (rawData.deliverables || []).map(deliverable => ({
      type: deliverable.type || 'other',
      quantity: Math.max(1, deliverable.quantity || 1),
      description: deliverable.description || '',
      duration: deliverable.duration || '',
      requirements: Array.isArray(deliverable.requirements) ? deliverable.requirements : [],
      platform: deliverable.platform || '',
      estimatedValue: Math.max(0, deliverable.estimatedValue || 0)
    }));

    // Ensure brand info has proper structure
    const brandInfo = {
      name: rawData.brandInfo?.name || '',
      contactPerson: rawData.brandInfo?.contactPerson || '',
      email: rawData.brandInfo?.email || '',
      phone: rawData.brandInfo?.phone || '',
      company: rawData.brandInfo?.company || ''
    };

    // Ensure campaign info has proper structure
    const campaignInfo = {
      name: rawData.campaignInfo?.name || '',
      type: rawData.campaignInfo?.type || '',
      description: rawData.campaignInfo?.description || ''
    };

    // Ensure timeline has proper structure
    const timeline = {
      briefDate: rawData.timeline?.briefDate ? new Date(rawData.timeline.briefDate) : null,
      contentDeadline: rawData.timeline?.contentDeadline ? new Date(rawData.timeline.contentDeadline) : null,
      postingStartDate: rawData.timeline?.postingStartDate ? new Date(rawData.timeline.postingStartDate) : null,
      postingEndDate: rawData.timeline?.postingEndDate ? new Date(rawData.timeline.postingEndDate) : null,
      campaignDuration: rawData.timeline?.campaignDuration || '',
      isUrgent: rawData.timeline?.isUrgent || false
    };

    // Ensure budget has proper structure
    const budget = {
      mentioned: rawData.budget?.mentioned || false,
      amount: rawData.budget?.amount || 0,
      currency: rawData.budget?.currency || 'INR',
      isRange: rawData.budget?.isRange || false,
      minAmount: rawData.budget?.minAmount || 0,
      maxAmount: rawData.budget?.maxAmount || 0,
      paymentTerms: rawData.budget?.paymentTerms || '',
      advancePercentage: rawData.budget?.advancePercentage || 0
    };

    // Ensure brand guidelines has proper structure
    const brandGuidelines = {
      hashtags: Array.isArray(rawData.brandGuidelines?.hashtags) ? rawData.brandGuidelines.hashtags : [],
      mentions: Array.isArray(rawData.brandGuidelines?.mentions) ? rawData.brandGuidelines.mentions : [],
      brandColors: Array.isArray(rawData.brandGuidelines?.brandColors) ? rawData.brandGuidelines.brandColors : [],
      brandTone: rawData.brandGuidelines?.brandTone || '',
      keyMessages: Array.isArray(rawData.brandGuidelines?.keyMessages) ? rawData.brandGuidelines.keyMessages : [],
      restrictions: Array.isArray(rawData.brandGuidelines?.restrictions) ? rawData.brandGuidelines.restrictions : [],
      styling: rawData.brandGuidelines?.styling || ''
    };

    // Ensure usage rights has proper structure
    const usageRights = {
      duration: rawData.usageRights?.duration || '',
      scope: Array.isArray(rawData.usageRights?.scope) ? rawData.usageRights.scope : [],
      territory: rawData.usageRights?.territory || '',
      isPerpetual: rawData.usageRights?.isPerpetual || false,
      exclusivity: {
        required: rawData.usageRights?.exclusivity?.required || false,
        duration: rawData.usageRights?.exclusivity?.duration || '',
        scope: rawData.usageRights?.exclusivity?.scope || ''
      }
    };

    // Ensure content requirements has proper structure
    const contentRequirements = {
      revisionRounds: rawData.contentRequirements?.revisionRounds || 0,
      approvalProcess: rawData.contentRequirements?.approvalProcess || '',
      contentFormat: Array.isArray(rawData.contentRequirements?.contentFormat) 
        ? rawData.contentRequirements.contentFormat 
        : [],
      qualityGuidelines: Array.isArray(rawData.contentRequirements?.qualityGuidelines) 
        ? rawData.contentRequirements.qualityGuidelines 
        : [],
      technicalSpecs: {
        resolution: rawData.contentRequirements?.technicalSpecs?.resolution || '',
        aspectRatio: rawData.contentRequirements?.technicalSpecs?.aspectRatio || '',
        fileFormat: Array.isArray(rawData.contentRequirements?.technicalSpecs?.fileFormat) 
          ? rawData.contentRequirements.technicalSpecs.fileFormat 
          : []
      }
    };

    // Valid categories for missing info
    const validCategories = [
      'budget', 'timeline', 'usage_rights', 'exclusivity', 
      'payment_terms', 'content_specs', 'brand_guidelines', 
      'contact_info', 'deliverables', 'approval_process'
    ];

    // Process missing info with proper category validation
    const missingInfo = (rawData.missingInfo || []).map(info => {
      let category = 'other'; // Default fallback
      
      // Extract valid category from the response
      if (typeof info.category === 'string') {
        const lowerCategory = info.category.toLowerCase();
        
        // Check if it matches any valid category
        const matchedCategory = validCategories.find(validCat => 
          lowerCategory.includes(validCat.replace('_', ' ')) || 
          lowerCategory.includes(validCat)
        );
        
        if (matchedCategory) {
          category = matchedCategory;
        } else if (validCategories.includes(lowerCategory)) {
          category = lowerCategory;
        }
      }

      return {
        category,
        description: info.description || 'Missing information',
        importance: ['critical', 'important', 'nice_to_have'].includes(info.importance) 
          ? info.importance 
          : 'important'
      };
    }).filter(info => info.category !== 'other'); // Remove invalid categories

    // Process risk factors
    const riskFactors = (rawData.riskAssessment?.riskFactors || []).map(factor => ({
      type: factor.type || 'Unknown',
      description: factor.description || '',
      severity: ['low', 'medium', 'high'].includes(factor.severity) ? factor.severity : 'low'
    }));

    // Calculate overall risk
    const highRiskCount = riskFactors.filter(factor => factor.severity === 'high').length;
    const mediumRiskCount = riskFactors.filter(factor => factor.severity === 'medium').length;
    
    let overallRisk = 'low';
    if (highRiskCount > 0) {
      overallRisk = 'high';
    } else if (mediumRiskCount > 1 || riskFactors.length > 3) {
      overallRisk = 'medium';
    }

    // Ensure risk assessment has proper structure
    const riskAssessment = {
      overallRisk,
      riskFactors
    };

    // Return processed data with all required fields
    return {
      brandInfo,
      campaignInfo,
      deliverables,
      timeline,
      budget,
      brandGuidelines,
      usageRights,
      contentRequirements,
      missingInfo,
      riskAssessment,
      confidenceScore: Math.min(100, Math.max(0, rawData.confidenceScore || 85))
    };

  } catch (error) {
    logError('Error post-processing AI results', { error: error.message });
    
    // Return minimal valid structure if processing fails
    return {
      brandInfo: { name: '', contactPerson: '', email: '', phone: '', company: '' },
      campaignInfo: { name: '', type: '', description: '' },
      deliverables: [],
      timeline: { briefDate: null, contentDeadline: null, postingStartDate: null, postingEndDate: null, campaignDuration: '', isUrgent: false },
      budget: { mentioned: false, amount: 0, currency: 'INR', isRange: false, minAmount: 0, maxAmount: 0, paymentTerms: '', advancePercentage: 0 },
      brandGuidelines: { hashtags: [], mentions: [], brandColors: [], brandTone: '', keyMessages: [], restrictions: [], styling: '' },
      usageRights: { duration: '', scope: [], territory: '', isPerpetual: false, exclusivity: { required: false, duration: '', scope: '' } },
      contentRequirements: { revisionRounds: 0, approvalProcess: '', contentFormat: [], qualityGuidelines: [], technicalSpecs: { resolution: '', aspectRatio: '', fileFormat: [] } },
      missingInfo: [{ category: 'deliverables', description: 'AI processing failed - manual review required', importance: 'critical' }],
      riskAssessment: { overallRisk: 'high', riskFactors: [{ type: 'Processing Error', description: 'AI extraction failed', severity: 'high' }] },
      confidenceScore: 0
    };
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

      console.log('Debug - User model:', !!User, typeof User);
      console.log('Debug - creatorId:', creatorId, typeof creatorId);
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