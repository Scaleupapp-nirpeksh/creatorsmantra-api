/**
 * CreatorsMantra Backend - Contract Upload & AI Review Module
 * Business logic for contract processing, AI analysis, and negotiation support
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * 
 * File Path: src/modules/contracts/service.js
 */

const { Contract, ContractAnalysis, NegotiationHistory, ContractTemplate } = require('./model');
const { User } = require('../auth/model');
const { Deal } = require('../deals/model');
const { logInfo, logError, logWarn, asyncHandler } = require('../../shared/utils'); // FIXED: Added logWarn
const AWS = require('aws-sdk');
const OpenAI = require('openai');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

// ================================
// ENVIRONMENT VARIABLES & CONFIG
// ================================
const requiredEnvVars = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY
};

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  logError('Missing required environment variables', { missingVars });
}

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1'
});

// OpenAI Configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ================================
// FILE UPLOAD SERVICE
// ================================

/**
 * Upload contract file to AWS S3
 * @param {Object} file - Uploaded file object
 * @param {String} creatorId - Creator ID for file organization
 * @returns {Object} File upload details
 */
const uploadContractFile = async (file, creatorId) => {
  try {
    logInfo('Starting contract file upload', { 
      originalName: file.originalname, 
      size: file.size,
      creatorId 
    });

    // Validate file size (25MB limit)
    if (file.size > 26214400) {
      throw new Error('File size exceeds 25MB limit');
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Unsupported file type. Please upload PDF, DOC, DOCX, or image files only.');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);
    const fileName = `contracts/${creatorId}/${timestamp}_${Math.random().toString(36).substring(7)}${fileExtension}`;

    // Upload to S3
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'private', // Contracts are private by default
      Metadata: {
        'creator-id': creatorId,
        'original-name': file.originalname,
        'upload-timestamp': timestamp.toString()
      }
    };

    const uploadResult = await s3.upload(uploadParams).promise();

    const fileDetails = {
      originalName: file.originalname,
      fileName: fileName,
      fileUrl: uploadResult.Location,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date()
    };

    logInfo('Contract file uploaded successfully', { 
      fileName, 
      fileUrl: uploadResult.Location,
      creatorId 
    });

    return fileDetails;
  } catch (error) {
    logError('Contract file upload failed', { 
      error: error.message, 
      creatorId,
      fileName: file.originalname 
    });
    throw error;
  }
};

/**
 * Extract text from uploaded contract file
 * @param {String} fileUrl - S3 file URL
 * @param {String} mimeType - File MIME type
 * @returns {String} Extracted text content
 */
const extractTextFromFile = async (fileUrl, mimeType) => {
  try {
    logInfo('Starting text extraction', { fileUrl, mimeType });

    // Download file from S3
    const fileKey = fileUrl.split('/').slice(-3).join('/'); // Extract key from URL
    const downloadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileKey
    };

    const fileData = await s3.getObject(downloadParams).promise();
    let extractedText = '';

    switch (mimeType) {
      case 'application/pdf':
        const pdfData = await pdf(fileData.Body);
        extractedText = pdfData.text;
        break;

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const docxResult = await mammoth.extractRawText({ buffer: fileData.Body });
        extractedText = docxResult.value;
        break;

      case 'application/msword':
        // For older .doc files, attempt basic text extraction
        extractedText = fileData.Body.toString('utf8').replace(/[^\x20-\x7E]/g, ' ');
        break;

      case 'image/jpeg':
      case 'image/png':
        // For images, we'll need OCR - for now, return placeholder
        extractedText = '[Image file - OCR text extraction will be implemented]';
        break;

      default:
        throw new Error('Unsupported file type for text extraction');
    }

    // Clean and normalize extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    logInfo('Text extraction completed', { 
      fileUrl, 
      textLength: extractedText.length 
    });

    return extractedText;
  } catch (error) {
    logError('Text extraction failed', { 
      error: error.message, 
      fileUrl, 
      mimeType 
    });
    throw error;
  }
};

// ================================
// AI ANALYSIS SERVICE
// ================================

/**
 * Analyze contract using OpenAI
 * @param {String} contractText - Extracted contract text
 * @param {Object} contractMetadata - Basic contract info
 * @returns {Object} AI analysis results
 */
const analyzeContractWithAI = async (contractText, contractMetadata = {}) => {
  try {
    logInfo('Starting AI contract analysis', { 
      textLength: contractText.length,
      brandName: contractMetadata.brandName 
    });

    const analysisPrompt = `
You are a legal expert specializing in creator-brand collaboration contracts. Analyze the following contract and provide a comprehensive assessment focused on protecting the creator's interests.

CONTRACT TEXT:
${contractText}

Please analyze this contract and respond with a JSON object containing the following structure:

{
  "summary": "Brief 2-3 sentence summary of the contract",
  "riskScore": 0-100,
  "riskLevel": "low|medium|high|critical",
  "clauseAnalysis": {
    "paymentTerms": {
      "detected": true/false,
      "content": "extracted payment clause text",
      "riskLevel": "safe|caution|risky",
      "recommendation": "specific recommendation",
      "paymentDays": number_of_days,
      "paymentMethod": "method"
    },
    "usageRights": {
      "detected": true/false,
      "content": "extracted usage rights text",
      "riskLevel": "safe|caution|risky", 
      "recommendation": "specific recommendation",
      "duration": "time period",
      "scope": ["platforms", "media types"],
      "exclusivity": true/false
    },
    "deliverables": {
      "detected": true/false,
      "content": "extracted deliverables text",
      "riskLevel": "safe|caution|risky",
      "recommendation": "specific recommendation",
      "items": [{"type": "post/reel/story", "quantity": number, "deadline": "date"}]
    },
    "exclusivityClause": {
      "detected": true/false,
      "content": "extracted exclusivity text",
      "riskLevel": "safe|caution|risky",
      "recommendation": "specific recommendation", 
      "duration": "time period",
      "scope": ["competitor categories"],
      "competitors": ["specific brands if mentioned"]
    },
    "penaltyClauses": {
      "detected": true/false,
      "content": "extracted penalty text",
      "riskLevel": "safe|caution|risky",
      "recommendation": "specific recommendation",
      "penalties": [{"condition": "breach type", "penalty": "description", "amount": number}]
    },
    "terminationClause": {
      "detected": true/false,
      "content": "extracted termination text", 
      "riskLevel": "safe|caution|risky",
      "recommendation": "specific recommendation",
      "noticePeriod": "time period",
      "conditions": ["termination conditions"]
    },
    "intellectualProperty": {
      "detected": true/false,
      "content": "extracted IP text",
      "riskLevel": "safe|caution|risky",
      "recommendation": "specific recommendation",
      "ownership": "creator|brand|shared",
      "licenseType": "exclusive|non-exclusive|limited"
    }
  },
  "redFlags": [
    {
      "type": "unlimited_usage|long_exclusivity|harsh_penalties|vague_deliverables|late_payment|unfair_termination",
      "severity": "low|medium|high|critical",
      "description": "specific issue description",
      "recommendation": "how to address this",
      "location": "where in contract this appears"
    }
  ],
  "missingClauses": [
    {
      "clauseType": "payment_terms|usage_rights|deliverables|termination|liability|force_majeure",
      "importance": "critical|important|recommended",
      "suggestion": "what should be added"
    }
  ],
  "overallRecommendation": {
    "action": "sign_as_is|negotiate_minor|negotiate_major|reject",
    "reasoning": "detailed explanation",
    "priority": "low|medium|high"
  },
  "marketComparison": {
    "paymentTermsRank": "above_average|average|below_average",
    "usageRightsRank": "creator_friendly|standard|brand_heavy", 
    "exclusivityRank": "reasonable|standard|excessive",
    "overallRank": "excellent|good|fair|poor"
  }
}

Important guidelines:
- Be creator-focused in your analysis
- Flag anything that seems unfair to creators
- Consider Indian market standards (30-day payment terms are standard)
- Be specific in recommendations
- Assign higher risk scores to creator-unfriendly terms
- Focus on practical, actionable advice

Respond ONLY with valid JSON. Do not include any text outside the JSON structure.
`;

    const startTime = Date.now();
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a legal expert specializing in creator economy contracts. Always respond with valid JSON only."
        },
        {
          role: "user", 
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    const processingTime = Date.now() - startTime;
    
    let analysisResult;
    try {
      analysisResult = JSON.parse(completion.choices[0].message.content);
    } catch (parseError) {
      logError('Failed to parse AI analysis response', { 
        parseError: parseError.message,
        response: completion.choices[0].message.content 
      });
      throw new Error('Invalid AI analysis response format');
    }

    // Add metadata
    analysisResult.aiModel = 'gpt-4';
    analysisResult.processingTime = processingTime;
    analysisResult.confidence = 85; // Default confidence
    analysisResult.analyzedAt = new Date();

    logInfo('AI contract analysis completed', { 
      processingTime,
      riskScore: analysisResult.riskScore,
      riskLevel: analysisResult.riskLevel 
    });

    return analysisResult;
  } catch (error) {
    logError('AI contract analysis failed', { 
      error: error.message,
      textLength: contractText.length 
    });
    throw error;
  }
};

/**
 * Calculate detailed risk score based on analysis
 * @param {Object} analysisData - AI analysis results
 * @returns {Number} Calculated risk score
 */
const calculateDetailedRiskScore = (analysisData) => {
  let riskScore = 0;
  let clauseCount = 0;

  // Risk scoring weights
  const clauseWeights = {
    paymentTerms: 25,
    usageRights: 30,
    exclusivityClause: 20,
    penaltyClauses: 15,
    terminationClause: 10,
    deliverables: 10,
    intellectualProperty: 15
  };

  // Calculate clause-based risk
  Object.entries(analysisData.clauseAnalysis || {}).forEach(([clauseType, clause]) => {
    if (clause.detected) {
      clauseCount++;
      const weight = clauseWeights[clauseType] || 10;
      
      switch (clause.riskLevel) {
        case 'risky':
          riskScore += weight * 0.8;
          break;
        case 'caution':
          riskScore += weight * 0.4;
          break;
        case 'safe':
          riskScore += weight * 0.1;
          break;
      }
    }
  });

  // Add red flag penalties
  (analysisData.redFlags || []).forEach(flag => {
    switch (flag.severity) {
      case 'critical':
        riskScore += 25;
        break;
      case 'high':
        riskScore += 15;
        break;
      case 'medium':
        riskScore += 10;
        break;
      case 'low':
        riskScore += 5;
        break;
    }
  });

  // Add missing clause penalties
  (analysisData.missingClauses || []).forEach(missing => {
    switch (missing.importance) {
      case 'critical':
        riskScore += 20;
        break;
      case 'important':
        riskScore += 10;
        break;
      case 'recommended':
        riskScore += 5;
        break;
    }
  });

  // Normalize score (0-100)
  riskScore = Math.min(100, Math.max(0, riskScore));

  logInfo('Risk score calculated', { 
    riskScore, 
    clauseCount,
    redFlagCount: (analysisData.redFlags || []).length 
  });

  return Math.round(riskScore);
};

// ================================
// CONTRACT MANAGEMENT SERVICE
// ================================

/**
 * Create new contract record
 * @param {Object} contractData - Contract creation data
 * @param {String} creatorId - Creator ID
 * @returns {Object} Created contract
 */
const createContract = async (contractData, creatorId) => {
  try {
    logInfo('Creating new contract', { creatorId, brandName: contractData.brandName });

    // Validate creator exists
    const creator = await User.findById(creatorId);
    if (!creator) {
      throw new Error('Creator not found');
    }

    // Create contract record
    const contract = new Contract({
      ...contractData,
      creatorId,
      status: 'uploaded'
    });

    const savedContract = await contract.save();

    logInfo('Contract created successfully', { 
      contractId: savedContract._id,
      creatorId,
      brandName: savedContract.brandName 
    });

    return savedContract;
  } catch (error) {
    logError('Contract creation failed', { 
      error: error.message, 
      creatorId,
      brandName: contractData.brandName 
    });
    throw error;
  }
};

/**
 * Process uploaded contract with AI analysis
 * @param {String} contractId - Contract ID
 * @returns {Object} Analysis results
 */
const processContractAnalysis = async (contractId) => {
  try {
    logInfo('Starting contract processing', { contractId });

    // Get contract
    const contract = await Contract.findById(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    // Update status to analyzing
    contract.status = 'analyzing';
    await contract.save();

    // Extract text if not already done
    let extractedText = contract.extractedText;
    if (!extractedText) {
      extractedText = await extractTextFromFile(
        contract.contractFile.fileUrl,
        contract.contractFile.mimeType
      );
      
      contract.extractedText = extractedText;
      await contract.save();
    }

    // Perform AI analysis
    const aiAnalysis = await analyzeContractWithAI(extractedText, {
      brandName: contract.brandName,
      contractValue: contract.contractValue
    });

    // Calculate detailed risk score
    const finalRiskScore = calculateDetailedRiskScore(aiAnalysis);
    aiAnalysis.riskScore = finalRiskScore;

    // Determine risk level from final score
    if (finalRiskScore <= 30) aiAnalysis.riskLevel = 'low';
    else if (finalRiskScore <= 60) aiAnalysis.riskLevel = 'medium';
    else if (finalRiskScore <= 80) aiAnalysis.riskLevel = 'high';
    else aiAnalysis.riskLevel = 'critical';

    // Save analysis
    const analysis = new ContractAnalysis({
      contractId: contract._id,
      ...aiAnalysis
    });

    const savedAnalysis = await analysis.save();

    // Update contract with analysis reference
    contract.analysisId = savedAnalysis._id;
    contract.status = 'analyzed';
    await contract.save();

    logInfo('Contract analysis completed', { 
      contractId,
      riskScore: finalRiskScore,
      riskLevel: aiAnalysis.riskLevel 
    });

    return {
      contract,
      analysis: savedAnalysis
    };
  } catch (error) {
    logError('Contract processing failed', { 
      error: error.message, 
      contractId 
    });

    // Update contract status to failed
    await Contract.findByIdAndUpdate(contractId, { 
      status: 'upload_failed' 
    });

    throw error;
  }
};

/**
 * Get contract with analysis
 * @param {String} contractId - Contract ID
 * @param {String} creatorId - Creator ID for authorization
 * @returns {Object} Contract with analysis
 */
const getContractWithAnalysis = async (contractId, creatorId) => {
  try {
    const contract = await Contract.findOne({ 
      _id: contractId, 
      creatorId,
      isActive: true 
    }).populate('analysisId');

    if (!contract) {
      throw new Error('Contract not found or access denied');
    }

    logInfo('Contract retrieved with analysis', { 
      contractId, 
      creatorId,
      hasAnalysis: !!contract.analysisId 
    });

    return contract;
  } catch (error) {
    logError('Failed to get contract with analysis', { 
      error: error.message, 
      contractId, 
      creatorId 
    });
    throw error;
  }
};

/**
 * IMMEDIATE FIX: Risk level filtering with automatic collection detection
 * Replace your entire listCreatorContracts function with this
 */
const listCreatorContracts = async (creatorId, filters = {}) => {
  try {
    logInfo('Listing contracts with filters', { creatorId, filters });
    
    // Start with base query for creator's contracts
    let baseQuery = { 
      creatorId, 
      isActive: true 
    };
    
    // Apply direct contract filters
    if (filters.status) {
      baseQuery.status = filters.status;
    }
    
    if (filters.brandName) {
      baseQuery.brandName = new RegExp(filters.brandName, 'i');
    }
    
    // Handle riskLevel filter - FIXED VERSION
    if (filters.riskLevel) {
      logInfo('Applying risk level filter', { riskLevel: filters.riskLevel });
      
      // Method 1: Try to detect the correct collection name
      const possibleCollectionNames = [
        'contractanalyses',      // Most likely
        'contract_analyses',     // With underscore
        'contractAnalyses',      // CamelCase
        'contract-analyses',     // With dash
        'ContractAnalyses'       // PascalCase
      ];
      
      let workingCollectionName = null;
      
      // Test each collection name
      for (const collectionName of possibleCollectionNames) {
        try {
          const testResult = await Contract.aggregate([
            { $match: baseQuery },
            { $limit: 1 },
            {
              $lookup: {
                from: collectionName,
                localField: 'analysisId',
                foreignField: '_id',
                as: 'analysis'
              }
            }
          ]);
          
          if (testResult.length > 0 && testResult[0].analysis.length > 0) {
            workingCollectionName = collectionName;
            logInfo(`✅ Found working collection name: ${collectionName}`);
            break;
          }
        } catch (error) {
          // Continue to next collection name
          continue;
        }
      }
      
      if (workingCollectionName) {
        // Use aggregation with correct collection name
        const pipeline = [
          { $match: baseQuery },
          {
            $lookup: {
              from: workingCollectionName,
              localField: 'analysisId',
              foreignField: '_id',
              as: 'analysis'
            }
          },
          {
            $match: {
              'analysis.riskLevel': filters.riskLevel,
              'analysis.isActive': true
            }
          },
          {
            $sort: { 
              [filters.sortBy || 'createdAt']: filters.sortOrder === 'asc' ? 1 : -1 
            }
          }
        ];
        
        if (filters.offset) pipeline.push({ $skip: filters.offset });
        if (filters.limit) pipeline.push({ $limit: filters.limit });
        
        const contracts = await Contract.aggregate(pipeline);
        
        logInfo('Contracts found with aggregation', { 
          count: contracts.length,
          riskLevel: filters.riskLevel,
          collectionName: workingCollectionName
        });
        
        return contracts;
      } else {
        // Fallback method: Use populate instead of aggregation
        logWarn('⚠️ Aggregation failed, using fallback method');
        
        const contracts = await Contract.find(baseQuery)
          .populate({
            path: 'analysisId',
            match: { 
              riskLevel: filters.riskLevel, 
              isActive: true 
            }
          })
          .sort({ [filters.sortBy || 'createdAt']: filters.sortOrder === 'asc' ? 1 : -1 })
          .skip(filters.offset || 0)
          .limit(filters.limit || 50);
        
        // Filter out contracts where populate didn't match
        const filteredContracts = contracts.filter(contract => contract.analysisId);
        
        logInfo('Contracts found with fallback method', { 
          count: filteredContracts.length,
          riskLevel: filters.riskLevel
        });
        
        return filteredContracts;
      }
    }
    
    // For queries without riskLevel, use regular find with populate
    const query = Contract.find(baseQuery)
      .populate('analysisId')
      .sort({ [filters.sortBy || 'createdAt']: filters.sortOrder === 'asc' ? 1 : -1 });
    
    if (filters.offset) query.skip(filters.offset);
    if (filters.limit) query.limit(filters.limit);
    
    const contracts = await query.exec();
    
    logInfo('Contracts found without risk level filter', { 
      count: contracts.length 
    });
    
    return contracts;
    
  } catch (error) {
    logError('Failed to list creator contracts', { 
      error: error.message, 
      stack: error.stack,
      creatorId,
      filters 
    });
    throw error;
  }
};

// ================================
// NEGOTIATION SERVICE
// ================================

/**
 * Generate negotiation points based on analysis
 * @param {String} analysisId - Analysis ID
 * @returns {Object} Negotiation suggestions
 */
const generateNegotiationPoints = async (analysisId) => {
  try {
    logInfo('Generating negotiation points', { analysisId });

    const analysis = await ContractAnalysis.findById(analysisId);
    if (!analysis) {
      throw new Error('Analysis not found');
    }

    const negotiationPoints = [];
    
    // Generate points based on risky clauses
    Object.entries(analysis.clauseAnalysis).forEach(([clauseType, clause]) => {
      if (clause.detected && clause.riskLevel === 'risky') {
        negotiationPoints.push({
          clauseType,
          originalClause: clause.content,
          proposedChange: clause.recommendation,
          reasoning: `Current terms are unfavorable to creator. ${clause.recommendation}`,
          priority: 'must_have',
          status: 'pending'
        });
      } else if (clause.detected && clause.riskLevel === 'caution') {
        negotiationPoints.push({
          clauseType,
          originalClause: clause.content,
          proposedChange: clause.recommendation,
          reasoning: `Terms could be improved. ${clause.recommendation}`,
          priority: 'important',
          status: 'pending'
        });
      }
    });

    // Add points for red flags
    analysis.redFlags.forEach(flag => {
      if (flag.severity === 'high' || flag.severity === 'critical') {
        negotiationPoints.push({
          clauseType: 'other',
          originalClause: flag.description,
          proposedChange: flag.recommendation,
          reasoning: `Critical issue identified: ${flag.description}`,
          priority: 'must_have',
          status: 'pending'
        });
      }
    });

    logInfo('Negotiation points generated', { 
      analysisId, 
      pointCount: negotiationPoints.length 
    });

    return negotiationPoints;
  } catch (error) {
    logError('Failed to generate negotiation points', { 
      error: error.message, 
      analysisId 
    });
    throw error;
  }
};

/**
 * Generate negotiation email template
 * @param {String} contractId - Contract ID
 * @param {Array} negotiationPoints - Points to negotiate
 * @param {String} tone - Email tone
 * @returns {Object} Email template
 */
const generateNegotiationEmail = async (contractId, negotiationPoints, tone = 'professional') => {
  try {
    logInfo('Generating negotiation email', { 
      contractId, 
      pointCount: negotiationPoints.length, 
      tone 
    });

    const contract = await Contract.findById(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    const creator = await User.findById(contract.creatorId);
    
    // Group points by priority
    const mustHave = negotiationPoints.filter(p => p.priority === 'must_have');
    const important = negotiationPoints.filter(p => p.priority === 'important');
    const niceToHave = negotiationPoints.filter(p => p.priority === 'nice_to_have');

    let subject, greeting, body, closing;

    switch (tone) {
      case 'friendly':
        subject = `Quick questions about our collaboration agreement - ${creator.name}`;
        greeting = `Hi there!`;
        body = `I'm really excited about our upcoming collaboration! I've reviewed the contract and just have a few suggestions to make sure everything works smoothly for both of us.`;
        closing = `Thanks for understanding, and I'm looking forward to creating amazing content together!`;
        break;

      case 'assertive':
        subject = `Contract Review & Required Modifications - ${creator.name}`;
        greeting = `Hello,`;
        body = `I've completed my review of the collaboration agreement and identified several points that need to be addressed before I can proceed.`;
        closing = `These modifications are necessary for me to move forward. I'm confident we can reach an agreement that works for both parties.`;
        break;

      default: // professional
        subject = `Contract Review & Suggested Modifications - ${creator.name}`;
        greeting = `Dear ${contract.brandName} team,`;
        body = `Thank you for the collaboration opportunity. I've reviewed the agreement and would like to discuss some modifications to ensure a successful partnership.`;
        closing = `I appreciate your consideration of these points and look forward to your response.`;
    }

    // Build email content
    let emailBody = `${greeting}\n\n${body}\n\n`;

    if (mustHave.length > 0) {
      emailBody += `**Critical Requirements:**\n`;
      mustHave.forEach((point, index) => {
        emailBody += `${index + 1}. **${point.clauseType.replace('_', ' ').toUpperCase()}**: ${point.reasoning}\n`;
        emailBody += `   Proposed change: ${point.proposedChange}\n\n`;
      });
    }

    if (important.length > 0) {
      emailBody += `**Important Suggestions:**\n`;
      important.forEach((point, index) => {
        emailBody += `${index + 1}. **${point.clauseType.replace('_', ' ').toUpperCase()}**: ${point.reasoning}\n`;
        emailBody += `   Proposed change: ${point.proposedChange}\n\n`;
      });
    }

    if (niceToHave.length > 0) {
      emailBody += `**Additional Considerations:**\n`;
      niceToHave.forEach((point, index) => {
        emailBody += `${index + 1}. **${point.clauseType.replace('_', ' ').toUpperCase()}**: ${point.reasoning}\n`;
        emailBody += `   Proposed change: ${point.proposedChange}\n\n`;
      });
    }

    emailBody += `${closing}\n\nBest regards,\n${creator.name}`;

    const emailTemplate = {
      subject,
      body: emailBody,
      tone
    };

    logInfo('Negotiation email generated', { 
      contractId, 
      subjectLength: subject.length,
      bodyLength: emailBody.length 
    });

    return emailTemplate;
  } catch (error) {
    logError('Failed to generate negotiation email', { 
      error: error.message, 
      contractId 
    });
    throw error;
  }
};

/**
 * Save negotiation history
 * @param {String} contractId - Contract ID
 * @param {String} creatorId - Creator ID
 * @param {Object} negotiationData - Negotiation details
 * @returns {Object} Saved negotiation history
 */
const saveNegotiationHistory = async (contractId, creatorId, negotiationData) => {
  try {
    logInfo('Saving negotiation history', { contractId, creatorId });

    // Find existing negotiation rounds for this contract
    const existingNegotiations = await NegotiationHistory.find({ 
      contractId 
    }).sort({ negotiationRound: -1 });

    const nextRound = existingNegotiations.length > 0 ? 
      existingNegotiations[0].negotiationRound + 1 : 1;

    const negotiation = new NegotiationHistory({
      contractId,
      creatorId,
      negotiationRound: nextRound,
      ...negotiationData
    });

    const savedNegotiation = await negotiation.save();

    logInfo('Negotiation history saved', { 
      contractId, 
      negotiationId: savedNegotiation._id,
      round: nextRound 
    });

    return savedNegotiation;
  } catch (error) {
    logError('Failed to save negotiation history', { 
      error: error.message, 
      contractId, 
      creatorId 
    });
    throw error;
  }
};

// ================================
// TEMPLATE SERVICE
// ================================

/**
 * Get contract templates by category
 * @param {String} category - Template category
 * @param {Array} targetPlatforms - Target platforms
 * @returns {Array} Contract templates
 */
const getContractTemplates = async (category, targetPlatforms = []) => {
  try {
    const query = { 
      category, 
      isActive: true,
      isPublic: true 
    };

    if (targetPlatforms.length > 0) {
      query.targetPlatforms = { $in: targetPlatforms };
    }

    const templates = await ContractTemplate.find(query)
      .sort({ successRate: -1, usageCount: -1 });

    logInfo('Contract templates retrieved', { 
      category, 
      count: templates.length 
    });

    return templates;
  } catch (error) {
    logError('Failed to get contract templates', { 
      error: error.message, 
      category 
    });
    throw error;
  }
};

/**
 * Get creator-friendly clause alternatives
 * @param {String} clauseType - Type of clause
 * @param {Object} context - Contract context
 * @returns {Array} Alternative clauses
 */
const getClauseAlternatives = async (clauseType, context = {}) => {
  try {
    logInfo('Getting clause alternatives', { clauseType, context });

    const templates = await ContractTemplate.find({
      'clauses.clauseType': clauseType,
      'clauses.isCreatorFriendly': true,
      isActive: true
    });

    const alternatives = [];
    
    templates.forEach(template => {
      const relevantClauses = template.clauses.filter(clause => 
        clause.clauseType === clauseType && clause.isCreatorFriendly
      );
      alternatives.push(...relevantClauses);
    });

    // Sort by risk level (lowest first)
    alternatives.sort((a, b) => {
      const riskOrder = { 'low': 1, 'medium': 2, 'high': 3 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });

    logInfo('Clause alternatives retrieved', { 
      clauseType, 
      count: alternatives.length 
    });

    return alternatives.slice(0, 5); // Return top 5 alternatives
  } catch (error) {
    logError('Failed to get clause alternatives', { 
      error: error.message, 
      clauseType 
    });
    throw error;
  }
};

// ================================
// ANALYTICS SERVICE
// ================================

/**
 * Get contract analytics for creator
 * @param {String} creatorId - Creator ID
 * @returns {Object} Analytics data
 */
const getContractAnalytics = async (creatorId) => {
  try {
    logInfo('Getting contract analytics', { creatorId });

    // Get all contracts for creator
    const contracts = await Contract.find({ 
      creatorId, 
      isActive: true 
    }).populate('analysisId');

    // Get negotiation history
    const negotiations = await NegotiationHistory.find({ 
      creatorId,
      isActive: true 
    });

    // Calculate analytics
    const analytics = {
      totalContracts: contracts.length,
      contractsByStatus: {},
      riskLevelDistribution: {},
      averageRiskScore: 0,
      totalNegotiations: negotiations.length,
      successfulNegotiations: negotiations.filter(n => n.outcome.status === 'successful').length,
      averageNegotiationRounds: 0,
      topRedFlags: {},
      contractTrends: {
        last30Days: 0,
        last90Days: 0
      }
    };

    // Status distribution
    contracts.forEach(contract => {
      analytics.contractsByStatus[contract.status] = 
        (analytics.contractsByStatus[contract.status] || 0) + 1;
    });

    // Risk analysis
    const analyzedContracts = contracts.filter(c => c.analysisId);
    if (analyzedContracts.length > 0) {
      let totalRiskScore = 0;
      analyzedContracts.forEach(contract => {
        const analysis = contract.analysisId;
        analytics.riskLevelDistribution[analysis.riskLevel] = 
          (analytics.riskLevelDistribution[analysis.riskLevel] || 0) + 1;
        totalRiskScore += analysis.riskScore;

        // Count red flags
        if (analysis.redFlags) {
          analysis.redFlags.forEach(flag => {
            analytics.topRedFlags[flag.type] = 
              (analytics.topRedFlags[flag.type] || 0) + 1;
          });
        }
      });
      analytics.averageRiskScore = Math.round(totalRiskScore / analyzedContracts.length);
    }

    // Negotiation analytics
    if (negotiations.length > 0) {
      const totalRounds = negotiations.reduce((sum, neg) => sum + neg.negotiationRound, 0);
      analytics.averageNegotiationRounds = Math.round(totalRounds / negotiations.length * 10) / 10;
    }

    // Time-based trends
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    analytics.contractTrends.last30Days = contracts.filter(c => 
      c.createdAt >= thirtyDaysAgo
    ).length;

    analytics.contractTrends.last90Days = contracts.filter(c => 
      c.createdAt >= ninetyDaysAgo
    ).length;

    logInfo('Contract analytics calculated', { 
      creatorId, 
      totalContracts: analytics.totalContracts,
      averageRiskScore: analytics.averageRiskScore 
    });

    return analytics;
  } catch (error) {
    logError('Failed to get contract analytics', { 
      error: error.message, 
      creatorId 
    });
    throw error;
  }
};

// ================================
// INTEGRATION SERVICES
// ================================

/**
 * CORRECTED: Convert analyzed contract to deal
 * Fixed based on actual Deal model validation errors
 */
const convertContractToDeal = async (contractId, dealData = {}) => {
  try {
    logInfo('Converting contract to deal', { contractId });

    const contract = await Contract.findById(contractId).populate('analysisId');
    if (!contract) {
      throw new Error('Contract not found');
    }

    const analysis = contract.analysisId;
    if (!analysis) {
      logWarn('Contract analysis not found, proceeding with basic conversion', { contractId });
    }

    // Get creator details for deal title
    const creator = await User.findById(contract.creatorId);
    if (!creator) {
      throw new Error('Creator not found');
    }

    // Map deliverable types to correct enum values (based on validation errors)
    const mapDeliverableType = (analysisType) => {
      const typeMapping = {
        'YouTube video': 'youtube_video',
        'Instagram post': 'instagram_post', 
        'Instagram story': 'instagram_story',
        'Instagram reel': 'instagram_reel',
        'TikTok video': 'tiktok_video',
        'Facebook post': 'facebook_post',
        'LinkedIn post': 'linkedin_post',
        'Twitter post': 'twitter_post',
        'Snapchat story': 'snapchat_story',
        'blog post': 'blog_post',
        'article': 'article',
        'live stream': 'live_stream',
        'podcast': 'podcast',
        'webinar': 'webinar',
        'video': 'youtube_video',
        'post': 'instagram_post',
        'story': 'instagram_story',
        'reel': 'instagram_reel'
      };
      
      return typeMapping[analysisType] || 'instagram_post'; // Default to instagram_post
    };

    // Map status to correct enum values (based on validation errors)
    const mapStatus = (inputStatus) => {
      const statusMapping = {
        'inquiry': 'potential',
        'pitched': 'pitched', 
        'negotiating': 'negotiating',
        'approved': 'confirmed',
        'in_progress': 'in_progress',
        'delivered': 'delivered',
        'completed': 'completed',
        'cancelled': 'cancelled'
      };
      
      return statusMapping[inputStatus] || 'potential'; // Default to 'potential'
    };

    // Build the deal object with corrected field mapping
    const dealInfo = {
      // Required fields for Deal model
      userId: contract.creatorId,
      title: dealData.title || `${contract.brandName} - ${creator.fullName || creator.name} Collaboration`,
      
      // Brand information (nested object with correct structure)
      brand: {
        name: contract.brandName,
        email: contract.brandEmail || dealData.brandEmail || '',
        // contactPerson expects an object structure based on error
        contactPerson: dealData.brandContactPerson ? {
          name: dealData.brandContactPerson,
          role: dealData.brandContactRole || 'Marketing Manager',
          email: dealData.brandContactEmail || contract.brandEmail || ''
        } : undefined,
        website: dealData.brandWebsite || '',
        companySize: dealData.brandCompanySize || 'medium'
      },
      
      // Deal value (ensure amount is set)
      dealValue: {
        amount: Number(dealData.dealValue || contract.contractValue?.amount || 0),
        currency: dealData.currency || contract.contractValue?.currency || 'INR'
      },
      
      // Platform (singular - use primary platform)
      platform: dealData.platform || contract.platforms?.[0] || 'instagram',
      
      // Additional platforms 
      platforms: contract.platforms || [dealData.platform || 'instagram'],
      
      // Status (use mapped status)
      status: mapStatus(dealData.status || 'potential'),
      
      // Deal type
      dealType: dealData.dealType || 'collaboration',
      
      // Timeline
      timeline: dealData.timeline || {
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      },
      
      // Communication and notes
      notes: dealData.notes || `Deal created from contract analysis. Original contract: ${contract.title}`,
      
      // Link back to contract
      contractId: contract._id,
      
      // Additional metadata
      createdFrom: 'contract_conversion',
      
      // Priority and stage
      priority: dealData.priority || 'medium',
      stage: dealData.stage || 'negotiation'
    };

    // Extract and map deliverables from analysis or dealData
    if (analysis?.clauseAnalysis?.deliverables?.detected && 
        analysis.clauseAnalysis.deliverables.items) {
      dealInfo.deliverables = analysis.clauseAnalysis.deliverables.items.map(item => ({
        type: mapDeliverableType(item.type),
        quantity: Number(item.quantity) || 1,
        description: item.description || `${item.type} content for ${contract.brandName}`,
        status: 'pending',
        platform: contract.platforms?.[0] || 'instagram',
        deadline: item.deadline ? new Date(item.deadline) : undefined
      }));
    } else if (dealData.deliverables && Array.isArray(dealData.deliverables)) {
      // Use deliverables from dealData if provided
      dealInfo.deliverables = dealData.deliverables.map(item => ({
        type: mapDeliverableType(item.type),
        quantity: Number(item.quantity) || 1,
        description: item.description || `${item.type} content for ${contract.brandName}`,
        status: item.status || 'pending',
        platform: item.platform || contract.platforms?.[0] || 'instagram',
        deadline: item.deadline ? new Date(item.deadline) : undefined
      }));
    } else {
      // Default deliverables based on contract platforms
      dealInfo.deliverables = [{
        type: 'instagram_post',
        quantity: 1,
        description: `Content for ${contract.brandName}`,
        status: 'pending',
        platform: contract.platforms?.[0] || 'instagram'
      }];
    }

    // Extract payment terms from analysis
    if (analysis?.clauseAnalysis?.paymentTerms?.detected) {
      dealInfo.paymentTerms = {
        method: analysis.clauseAnalysis.paymentTerms.paymentMethod || 'bank_transfer',
        schedule: 'milestone', // Default
        daysToPayment: Number(analysis.clauseAnalysis.paymentTerms.paymentDays) || 30,
        currency: dealInfo.dealValue.currency
      };
    }

    // Additional deal data (only add if not already set)
    Object.keys(dealData).forEach(key => {
      if (!dealInfo.hasOwnProperty(key) && dealData[key] !== undefined) {
        dealInfo[key] = dealData[key];
      }
    });

    // Clean up undefined values
    Object.keys(dealInfo).forEach(key => {
      if (dealInfo[key] === undefined) {
        delete dealInfo[key];
      }
    });

    // Ensure required nested objects have required fields
    if (!dealInfo.dealValue.amount) {
      dealInfo.dealValue.amount = 0; // Set to 0 if not provided
    }

    // Remove contactPerson if it's empty to avoid validation issues
    if (dealInfo.brand.contactPerson && !dealInfo.brand.contactPerson.name) {
      delete dealInfo.brand.contactPerson;
    }

    logInfo('Deal info prepared for creation', { 
      contractId, 
      dealInfo: {
        title: dealInfo.title,
        brand: dealInfo.brand.name,
        dealValue: dealInfo.dealValue,
        platform: dealInfo.platform,
        status: dealInfo.status,
        deliverables: dealInfo.deliverables?.length || 0
      }
    });

    // Use Deal service to create deal
    const Deal = require('../deals/model').Deal;
    const deal = new Deal(dealInfo);
    
    // Validate before saving
    const validationError = deal.validateSync();
    if (validationError) {
      logError('Deal validation failed before save', { 
        validationError: validationError.message,
        dealInfo: JSON.stringify(dealInfo, null, 2)
      });
      throw new Error(`Deal validation failed: ${validationError.message}`);
    }
    
    const savedDeal = await deal.save();

    // Update contract with deal reference
    contract.dealId = savedDeal._id;
    contract.status = 'finalized'; // Update contract status
    await contract.save();

    logInfo('Contract converted to deal successfully', { 
      contractId, 
      dealId: savedDeal._id,
      dealTitle: savedDeal.title
    });

    return savedDeal;
  } catch (error) {
    logError('Failed to convert contract to deal', { 
      error: error.message, 
      contractId,
      stack: error.stack
    });
    throw error;
  }
};

// ================================
// SERVICE EXPORTS
// ================================
module.exports = {
  // File Management
  uploadContractFile,
  extractTextFromFile,
  
  // AI Analysis
  analyzeContractWithAI,
  calculateDetailedRiskScore,
  
  // Contract Management
  createContract,
  processContractAnalysis,
  getContractWithAnalysis,
  listCreatorContracts,
  
  // Negotiation
  generateNegotiationPoints,
  generateNegotiationEmail,
  saveNegotiationHistory,
  
  // Templates
  getContractTemplates,
  getClauseAlternatives,
  
  // Analytics
  getContractAnalytics,
  
  // Integration
  convertContractToDeal
};

// ================================
// INITIALIZATION LOG
// ================================
logInfo('Contract service initialized', { 
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
  s3Configured: !!process.env.AWS_S3_BUCKET,
  openaiConfigured: !!process.env.OPENAI_API_KEY
});