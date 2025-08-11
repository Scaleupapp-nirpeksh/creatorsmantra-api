/**
 * CreatorsMantra Backend - Contract Upload & AI Review Module
 * HTTP request/response handlers for contract management and AI analysis
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * 
 * File Path: src/modules/contracts/controller.js
 */

const contractService = require('./service');
const { Contract, ContractAnalysis, NegotiationHistory, ContractTemplate } = require('./model');
const { User } = require('../auth/model');
const { asyncHandler } = require('../../shared/utils');
const { successResponse, errorResponse } = require('../../shared/responses');
const { logInfo, logError, logWarn } = require('../../shared/utils');
const multer = require('multer');
const path = require('path');

// ================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ================================

// Memory storage for file uploads (files will be uploaded to S3)
const storage = multer.memoryStorage();

// File filter for contract uploads
const contractFileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Please upload PDF, DOC, DOCX, JPG, or PNG files only.'), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 26214400 // 25MB limit
  },
  fileFilter: contractFileFilter
});

// ================================
// CONTRACT UPLOAD & CREATION
// ================================

/**
 * Upload and create new contract
 * POST /api/contracts/upload
 * Subscription: All tiers
 */
const uploadContract = asyncHandler(async (req, res) => {
  try {
    const { userId: creatorId } = req.user;
    const { brandName, brandEmail, contractValue, notes, tags, platforms } = req.body;

    logInfo('Contract upload initiated', { 
      creatorId, 
      brandName,
      hasFile: !!req.file 
    });

    // Validate required fields
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Contract file is required',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }

    if (!brandName) {
      return res.status(400).json({
        success: false,
        message: 'Brand name is required',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }

    // Check subscription limits
    const creator = await User.findById(creatorId);
    if (!creator) {
      return res.status(404).json({
        success: false,
        message: 'Creator not found',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    // Count existing contracts for subscription limit check
    const existingContracts = await Contract.countDocuments({ 
      creatorId, 
      isActive: true 
    });

    const subscriptionLimits = {
      starter: 5,
      pro: 25,
      elite: 50,
      agency_starter: -1, // Unlimited
      agency_pro: -1
    };

    const userLimit = subscriptionLimits[creator.subscription?.tier] || 5;
    if (userLimit !== -1 && existingContracts >= userLimit) {
      return res.status(403).json({
        success: false,
        message: `Contract limit reached for ${creator.subscription?.tier} plan. Upgrade to upload more contracts.`,
        code: 403,
        timestamp: new Date().toISOString()
      });
    }

    // Upload file to S3
    const fileDetails = await contractService.uploadContractFile(req.file, creatorId);

    // Parse additional data
    const parsedPlatforms = platforms ? 
      (Array.isArray(platforms) ? platforms : platforms.split(',').map(p => p.trim())) : [];
    
    const parsedTags = tags ? 
      (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [];

    // Create contract record
    const contractData = {
      brandName: brandName.trim(),
      brandEmail: brandEmail?.trim(),
      contractFile: fileDetails,
      contractValue: contractValue ? {
        amount: parseFloat(contractValue),
        currency: 'INR'
      } : undefined,
      platforms: parsedPlatforms,
      tags: parsedTags,
      notes: notes?.trim()
    };

    const contract = await contractService.createContract(contractData, creatorId);

    // Start background analysis for Pro+ users
    if (['pro', 'elite', 'agency_starter', 'agency_pro'].includes(creator.subscription?.tier)) {
      // Trigger analysis asynchronously
      setImmediate(async () => {
        try {
          await contractService.processContractAnalysis(contract._id);
          logInfo('Background contract analysis completed', { 
            contractId: contract._id 
          });
        } catch (error) {
          logError('Background contract analysis failed', { 
            contractId: contract._id,
            error: error.message 
          });
        }
      });
    }

    res.json(successResponse(
      'Contract uploaded successfully. Analysis will be available shortly for Pro+ users.',
      {
        contract: {
          id: contract._id,
          title: contract.title,
          brandName: contract.brandName,
          status: contract.status,
          platforms: contract.platforms,
          contractValue: contract.contractValue,
          createdAt: contract.createdAt,
          hasAIAnalysis: ['pro', 'elite', 'agency_starter', 'agency_pro'].includes(creator.subscription?.tier)
        }
      }
    ));

  } catch (error) {
    logError('Contract upload failed', { 
      error: error.message,
      creatorId: req.user?.userId 
    });
    throw error;
  }
});

/**
 * Trigger manual contract analysis
 * POST /api/contracts/:contractId/analyze
 * Subscription: Pro+ only
 */
const analyzeContract = asyncHandler(async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId: creatorId } = req.user;

    logInfo('Manual contract analysis triggered', { contractId, creatorId });

    // Check subscription tier for AI features
    const creator = await User.findById(creatorId);
    if (!['pro', 'elite', 'agency_starter', 'agency_pro'].includes(creator.subscription?.tier)) {
      return res.status(403).json({
        success: false,
        message: 'AI contract analysis requires Pro subscription or higher',
        code: 403,
        timestamp: new Date().toISOString()
      });
    }

    // Verify contract ownership
    const contract = await Contract.findOne({ 
      _id: contractId, 
      creatorId,
      isActive: true 
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found or access denied',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    // Check if already analyzed
    if (contract.status === 'analyzed' && contract.analysisId) {
      const analysis = await ContractAnalysis.findById(contract.analysisId);
      return res.json(successResponse(
        'Contract already analyzed',
        {
          contract: {
            id: contract._id,
            status: contract.status,
            analysis: {
              riskScore: analysis.riskScore,
              riskLevel: analysis.riskLevel,
              summary: analysis.summary,
              analyzedAt: analysis.analyzedAt
            }
          }
        }
      ));
    }

    // Perform analysis
    const result = await contractService.processContractAnalysis(contractId);

    res.json(successResponse(
      'Contract analysis completed successfully',
      {
        contract: {
          id: result.contract._id,
          status: result.contract.status,
          analysis: {
            riskScore: result.analysis.riskScore,
            riskLevel: result.analysis.riskLevel,
            summary: result.analysis.summary,
            redFlagCount: result.analysis.redFlags?.length || 0,
            analyzedAt: result.analysis.analyzedAt
          }
        }
      }
    ));

  } catch (error) {
    logError('Contract analysis failed', { 
      error: error.message,
      contractId: req.params.contractId 
    });
    throw error;
  }
});

// ================================
// CONTRACT RETRIEVAL
// ================================

/**
 * Get single contract with analysis
 * GET /api/contracts/:contractId
 * Subscription: All tiers
 */
const getContract = asyncHandler(async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId: creatorId } = req.user;

    logInfo('Contract retrieval requested', { contractId, creatorId });

    const contract = await contractService.getContractWithAnalysis(contractId, creatorId);
    
    // Format response data
    const responseData = {
      id: contract._id,
      title: contract.title,
      brandName: contract.brandName,
      brandEmail: contract.brandEmail,
      status: contract.status,
      platforms: contract.platforms,
      contractValue: contract.contractValue,
      tags: contract.tags,
      notes: contract.notes,
      contractFile: {
        originalName: contract.contractFile.originalName,
        fileSize: contract.contractFile.fileSize,
        uploadedAt: contract.contractFile.uploadedAt
      },
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt
    };

    // Add analysis data if available
    if (contract.analysisId) {
      const analysis = contract.analysisId;
      responseData.analysis = {
        riskScore: analysis.riskScore,
        riskLevel: analysis.riskLevel,
        summary: analysis.summary,
        clauseAnalysis: analysis.clauseAnalysis,
        redFlags: analysis.redFlags,
        missingClauses: analysis.missingClauses,
        overallRecommendation: analysis.overallRecommendation,
        marketComparison: analysis.marketComparison,
        analyzedAt: analysis.analyzedAt,
        confidence: analysis.confidence
      };
    }

    res.json(successResponse(
      'Contract retrieved successfully',
      { contract: responseData }
    ));

  } catch (error) {
    logError('Contract retrieval failed', { 
      error: error.message,
      contractId: req.params.contractId 
    });
    throw error;
  }
});

/**
 * List creator contracts with filters
 * GET /api/contracts
 * Subscription: All tiers
 */
const listContracts = asyncHandler(async (req, res) => {
  try {
    const { userId: creatorId } = req.user;
    const { 
      status, 
      brandName, 
      riskLevel, 
      limit = 50, 
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    logInfo('Contract list requested', { 
      creatorId, 
      filters: { status, brandName, riskLevel, limit, page } 
    });

    const filters = {
      limit: Math.min(parseInt(limit), 100), // Max 100 per page
      offset: (parseInt(page) - 1) * Math.min(parseInt(limit), 100)
    };

    if (status) filters.status = status;
    if (brandName) filters.brandName = brandName;
    if (riskLevel) filters.riskLevel = riskLevel;

    const contracts = await contractService.listCreatorContracts(creatorId, filters);

    // Get total count for pagination
    const totalContracts = await Contract.countDocuments({ 
      creatorId, 
      isActive: true 
    });

    const formattedContracts = contracts.map(contract => ({
      id: contract._id,
      title: contract.title,
      brandName: contract.brandName,
      status: contract.status,
      platforms: contract.platforms,
      contractValue: contract.contractValue,
      tags: contract.tags,
      createdAt: contract.createdAt,
      hasAnalysis: !!contract.analysisId,
      analysis: contract.analysisId ? {
        riskScore: contract.analysisId.riskScore,
        riskLevel: contract.analysisId.riskLevel,
        redFlagCount: contract.analysisId.redFlags?.length || 0
      } : null
    }));

    res.json(successResponse(
      'Contracts retrieved successfully',
      {
        contracts: formattedContracts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalContracts / parseInt(limit)),
          totalContracts,
          hasNext: parseInt(page) * parseInt(limit) < totalContracts,
          hasPrev: parseInt(page) > 1
        }
      }
    ));

  } catch (error) {
    logError('Contract list failed', { 
      error: error.message,
      creatorId: req.user?.userId 
    });
    throw error;
  }
});

// ================================
// NEGOTIATION FEATURES
// ================================

/**
 * Generate negotiation points for contract
 * GET /api/contracts/:contractId/negotiation-points
 * Subscription: Pro+ only
 */
const getNegotiationPoints = asyncHandler(async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId: creatorId } = req.user;

    logInfo('Negotiation points requested', { contractId, creatorId });

    // Check subscription tier
    const creator = await User.findById(creatorId);
    if (!['pro', 'elite', 'agency_starter', 'agency_pro'].includes(creator.subscription?.tier)) {
      return res.status(403).json({
        success: false,
        message: 'Negotiation assistance requires Pro subscription or higher',
        code: 403,
        timestamp: new Date().toISOString()
      });
    }

    // Get contract with analysis
    const contract = await contractService.getContractWithAnalysis(contractId, creatorId);
    
    if (!contract.analysisId) {
      return res.status(400).json({
        success: false,
        message: 'Contract must be analyzed before generating negotiation points',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }

    const negotiationPoints = await contractService.generateNegotiationPoints(contract.analysisId._id);

    res.json(successResponse(
      'Negotiation points generated successfully',
      {
        contractId: contract._id,
        brandName: contract.brandName,
        negotiationPoints,
        totalPoints: negotiationPoints.length,
        priorities: {
          mustHave: negotiationPoints.filter(p => p.priority === 'must_have').length,
          important: negotiationPoints.filter(p => p.priority === 'important').length,
          niceToHave: negotiationPoints.filter(p => p.priority === 'nice_to_have').length
        }
      }
    ));

  } catch (error) {
    logError('Negotiation points generation failed', { 
      error: error.message,
      contractId: req.params.contractId 
    });
    throw error;
  }
});

/**
 * Generate negotiation email template
 * POST /api/contracts/:contractId/negotiation-email
 * Subscription: Pro+ only
 */
const generateNegotiationEmail = asyncHandler(async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId: creatorId } = req.user;
    const { negotiationPoints, tone = 'professional' } = req.body;

    logInfo('Negotiation email generation requested', { 
      contractId, 
      creatorId, 
      tone,
      pointCount: negotiationPoints?.length 
    });

    // Check subscription tier
    const creator = await User.findById(creatorId);
    if (!['pro', 'elite', 'agency_starter', 'agency_pro'].includes(creator.subscription?.tier)) {
      return res.status(403).json({
        success: false,
        message: 'Email generation requires Pro subscription or higher',
        code: 403,
        timestamp: new Date().toISOString()
      });
    }

    // Validate input
    if (!negotiationPoints || !Array.isArray(negotiationPoints) || negotiationPoints.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Negotiation points are required',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }

    if (!['professional', 'friendly', 'assertive'].includes(tone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tone. Must be professional, friendly, or assertive',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }

    const emailTemplate = await contractService.generateNegotiationEmail(
      contractId,
      negotiationPoints,
      tone
    );

    res.json(successResponse(
      'Negotiation email generated successfully',
      {
        emailTemplate,
        metadata: {
          contractId,
          tone,
          pointCount: negotiationPoints.length,
          generatedAt: new Date().toISOString()
        }
      }
    ));

  } catch (error) {
    logError('Negotiation email generation failed', { 
      error: error.message,
      contractId: req.params.contractId 
    });
    throw error;
  }
});

/**
 * Save negotiation history
 * POST /api/contracts/:contractId/negotiations
 * Subscription: All tiers
 */
const saveNegotiation = asyncHandler(async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId: creatorId } = req.user;
    const { negotiationPoints, emailTemplate, emailSent = false } = req.body;

    logInfo('Saving negotiation history', { 
      contractId, 
      creatorId,
      emailSent 
    });

    // Validate contract ownership
    const contract = await Contract.findOne({ 
      _id: contractId, 
      creatorId,
      isActive: true 
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found or access denied',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    const negotiationData = {
      negotiationPoints,
      emailTemplate,
      emailSent,
      sentAt: emailSent ? new Date() : undefined
    };

    const savedNegotiation = await contractService.saveNegotiationHistory(
      contractId,
      creatorId,
      negotiationData
    );

    res.json(successResponse(
      'Negotiation history saved successfully',
      {
        negotiation: {
          id: savedNegotiation._id,
          contractId: savedNegotiation.contractId,
          negotiationRound: savedNegotiation.negotiationRound,
          pointCount: savedNegotiation.negotiationPoints.length,
          emailSent: savedNegotiation.emailSent,
          createdAt: savedNegotiation.createdAt
        }
      }
    ));

  } catch (error) {
    logError('Save negotiation failed', { 
      error: error.message,
      contractId: req.params.contractId 
    });
    throw error;
  }
});

/**
 * Get negotiation history for contract
 * GET /api/contracts/:contractId/negotiations
 * Subscription: All tiers
 */
const getNegotiationHistory = asyncHandler(async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId: creatorId } = req.user;

    logInfo('Negotiation history requested', { contractId, creatorId });

    // Validate contract ownership
    const contract = await Contract.findOne({ 
      _id: contractId, 
      creatorId,
      isActive: true 
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found or access denied',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    const negotiations = await NegotiationHistory.find({ 
      contractId,
      isActive: true 
    }).sort({ negotiationRound: 1 });

    const formattedNegotiations = negotiations.map(neg => ({
      id: neg._id,
      negotiationRound: neg.negotiationRound,
      pointCount: neg.negotiationPoints.length,
      emailTemplate: neg.emailTemplate,
      emailSent: neg.emailSent,
      sentAt: neg.sentAt,
      brandResponse: neg.brandResponse,
      outcome: neg.outcome,
      createdAt: neg.createdAt
    }));

    res.json(successResponse(
      'Negotiation history retrieved successfully',
      {
        contractId,
        negotiations: formattedNegotiations,
        totalRounds: negotiations.length,
        latestRound: negotiations.length > 0 ? negotiations[negotiations.length - 1].negotiationRound : 0
      }
    ));

  } catch (error) {
    logError('Get negotiation history failed', { 
      error: error.message,
      contractId: req.params.contractId 
    });
    throw error;
  }
});

// ================================
// TEMPLATE & ALTERNATIVE SERVICES
// ================================

/**
 * Get contract templates by category
 * GET /api/contracts/templates
 * Subscription: All tiers
 */
const getTemplates = asyncHandler(async (req, res) => {
  try {
    const { category, platforms } = req.query;
    const { userId: creatorId } = req.user;

    logInfo('Contract templates requested', { 
      creatorId, 
      category, 
      platforms 
    });

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category parameter is required',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }

    const targetPlatforms = platforms ? platforms.split(',').map(p => p.trim()) : [];
    const templates = await contractService.getContractTemplates(category, targetPlatforms);

    const formattedTemplates = templates.map(template => ({
      id: template._id,
      name: template.name,
      description: template.description,
      category: template.category,
      clauseCount: template.clauses.length,
      usageCount: template.usageCount,
      successRate: template.successRate,
      targetIndustries: template.targetIndustries,
      targetPlatforms: template.targetPlatforms,
      creatorSizeRange: template.creatorSizeRange
    }));

    res.json(successResponse(
      'Contract templates retrieved successfully',
      {
        category,
        templates: formattedTemplates,
        totalTemplates: templates.length
      }
    ));

  } catch (error) {
    logError('Get contract templates failed', { 
      error: error.message,
      creatorId: req.user?.userId 
    });
    throw error;
  }
});

/**
 * Get clause alternatives for specific clause type
 * GET /api/contracts/clause-alternatives/:clauseType
 * Subscription: Pro+ only
 */
const getClauseAlternatives = asyncHandler(async (req, res) => {
  try {
    const { clauseType } = req.params;
    const { userId: creatorId } = req.user;
    const { context } = req.query;

    logInfo('Clause alternatives requested', { 
      creatorId, 
      clauseType,
      context 
    });

    // Check subscription tier
    const creator = await User.findById(creatorId);
    if (!['pro', 'elite', 'agency_starter', 'agency_pro'].includes(creator.subscription?.tier)) {
      return res.status(403).json({
        success: false,
        message: 'Clause alternatives require Pro subscription or higher',
        code: 403,
        timestamp: new Date().toISOString()
      });
    }

    const validClauseTypes = [
      'payment_terms', 'usage_rights', 'deliverables', 
      'exclusivity', 'termination', 'liability', 'other'
    ];

    if (!validClauseTypes.includes(clauseType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid clause type',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }

    const contextData = context ? JSON.parse(context) : {};
    const alternatives = await contractService.getClauseAlternatives(clauseType, contextData);

    res.json(successResponse(
      'Clause alternatives retrieved successfully',
      {
        clauseType,
        alternatives,
        totalAlternatives: alternatives.length
      }
    ));

  } catch (error) {
    logError('Get clause alternatives failed', { 
      error: error.message,
      clauseType: req.params.clauseType 
    });
    throw error;
  }
});

// ================================
// ANALYTICS & REPORTING
// ================================

/**
 * Get contract analytics for creator
 * GET /api/contracts/analytics
 * Subscription: All tiers
 */
const getAnalytics = asyncHandler(async (req, res) => {
  try {
    const { userId: creatorId } = req.user;

    logInfo('Contract analytics requested', { creatorId });

    const analytics = await contractService.getContractAnalytics(creatorId);

    res.json(successResponse(
      'Contract analytics retrieved successfully',
      { analytics }
    ));

  } catch (error) {
    logError('Get contract analytics failed', { 
      error: error.message,
      creatorId: req.user?.userId 
    });
    throw error;
  }
});

// ================================
// INTEGRATION FEATURES
// ================================

/**
 * Convert contract to deal
 * POST /api/contracts/:contractId/convert-to-deal
 * Subscription: All tiers
 */
const convertToDeal = asyncHandler(async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId: creatorId } = req.user;
    const dealData = req.body;

    logInfo('Contract to deal conversion requested', { 
      contractId, 
      creatorId 
    });

    // Validate contract ownership
    const contract = await Contract.findOne({ 
      _id: contractId, 
      creatorId,
      isActive: true 
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found or access denied',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    // Check if already converted
    if (contract.dealId) {
      return res.status(400).json({
        success: false,
        message: 'Contract already converted to deal',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }

    const deal = await contractService.convertContractToDeal(contractId, dealData);

    res.json(successResponse(
      'Contract converted to deal successfully',
      {
        contract: {
          id: contract._id,
          dealId: deal._id
        },
        deal: {
          id: deal._id,
          brandName: deal.brandName,
          dealValue: deal.dealValue,
          status: deal.status,
          createdAt: deal.createdAt
        }
      }
    ));

  } catch (error) {
    logError('Contract to deal conversion failed', { 
      error: error.message,
      contractId: req.params.contractId 
    });
    throw error;
  }
});

// ================================
// CONTRACT MANAGEMENT
// ================================

/**
 * Update contract status
 * PATCH /api/contracts/:contractId/status
 * Subscription: All tiers
 */
const updateContractStatus = asyncHandler(async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId: creatorId } = req.user;
    const { status, notes } = req.body;

    logInfo('Contract status update requested', { 
      contractId, 
      creatorId, 
      newStatus: status 
    });

    // Validate status
    const validStatuses = [
      'uploaded', 'analyzing', 'analyzed', 'under_negotiation', 
      'finalized', 'signed', 'rejected'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }

    const contract = await Contract.findOne({ 
      _id: contractId, 
      creatorId,
      isActive: true 
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found or access denied',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    const oldStatus = contract.status;
    contract.status = status;
    if (notes) contract.notes = notes;
    contract.updatedAt = new Date();

    await contract.save();

    res.json(successResponse(
      'Contract status updated successfully',
      {
        contract: {
          id: contract._id,
          oldStatus,
          newStatus: status,
          updatedAt: contract.updatedAt
        }
      }
    ));

  } catch (error) {
    logError('Contract status update failed', { 
      error: error.message,
      contractId: req.params.contractId 
    });
    throw error;
  }
});

/**
 * Delete contract (soft delete)
 * DELETE /api/contracts/:contractId
 * Subscription: All tiers
 */
const deleteContract = asyncHandler(async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId: creatorId } = req.user;

    logInfo('Contract deletion requested', { contractId, creatorId });

    const contract = await Contract.findOne({ 
      _id: contractId, 
      creatorId,
      isActive: true 
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found or access denied',
        code: 404,
        timestamp: new Date().toISOString()
      });
    }

    // Soft delete
    contract.isActive = false;
    contract.updatedAt = new Date();
    await contract.save();

    // Also soft delete related analysis and negotiations
    await ContractAnalysis.updateMany(
      { contractId },
      { isActive: false }
    );

    await NegotiationHistory.updateMany(
      { contractId },
      { isActive: false }
    );

    res.json(successResponse(
      'Contract deleted successfully',
      {
        contractId: contract._id,
        deletedAt: contract.updatedAt
      }
    ));

  } catch (error) {
    logError('Contract deletion failed', { 
      error: error.message,
      contractId: req.params.contractId 
    });
    throw error;
  }
});

// ================================
// CONTROLLER EXPORTS
// ================================
module.exports = {
  // File upload middleware
  upload: upload.single('contractFile'),
  
  // Contract Upload & Creation
  uploadContract,
  analyzeContract,
  
  // Contract Retrieval
  getContract,
  listContracts,
  
  // Negotiation Features
  getNegotiationPoints,
  generateNegotiationEmail,
  saveNegotiation,
  getNegotiationHistory,
  
  // Templates & Alternatives
  getTemplates,
  getClauseAlternatives,
  
  // Analytics & Reporting
  getAnalytics,
  
  // Integration Features
  convertToDeal,
  
  // Contract Management
  updateContractStatus,
  deleteContract
};

// ================================
// INITIALIZATION LOG
// ================================
logInfo('Contract controller initialized', { 
  endpoints: [
    'POST /upload', 'POST /:id/analyze', 'GET /:id', 'GET /',
    'GET /:id/negotiation-points', 'POST /:id/negotiation-email',
    'POST /:id/negotiations', 'GET /:id/negotiations',
    'GET /templates', 'GET /clause-alternatives/:type',
    'GET /analytics', 'POST /:id/convert-to-deal',
    'PATCH /:id/status', 'DELETE /:id'
  ],
  totalEndpoints: 14,
  timestamp: new Date().toISOString()
});