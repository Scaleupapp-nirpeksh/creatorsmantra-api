//src/modules/briefs/controller.js
/**
 * CreatorsMantra Backend - Brief Analyzer Controller
 * API endpoints for brief management, AI extraction, and deal conversion
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Brief CRUD operations, AI processing, clarification management
 */

const BriefAnalyzerService = require('./service');
const { Brief } = require('./model');
const { 
  successResponse, 
  errorResponse, 
  asyncHandler,
  logInfo,
  logError
} = require('../../shared/utils');

// ============================================
// BRIEF CREATION CONTROLLERS
// ============================================

/**
 * Create Brief from Text Input
 * POST /api/briefs/create-text
 */
const createTextBrief = asyncHandler(async (req, res) => {
  const { rawText, notes, tags } = req.body;
  const creatorId = req.user.userId;

  logInfo('Creating text brief', { creatorId, textLength: rawText?.length });

  const briefData = {
    rawText: rawText.trim(),
    notes: notes || '',
    tags: tags || [],
    subscriptionTier: req.user.subscriptionTier
  };

  const brief = await BriefAnalyzerService.createTextBrief(briefData, creatorId);

  res.status(201).json(
    successResponse('Text brief created successfully', {
      brief: {
        id: brief._id,
        briefId: brief.briefId,
        status: brief.status,
        inputType: brief.inputType,
        extractionStatus: brief.aiExtraction.status,
        createdAt: brief.createdAt
      }
    })
  );
});

/**
 * Create Brief from File Upload
 * POST /api/briefs/create-file
 */
const createFileBrief = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json(
      errorResponse('No file uploaded', null, 400)
    );
  }

  const creatorId = req.user.userId;
  const fileData = {
    ...req.file,
    subscriptionTier: req.user.subscriptionTier
  };

  logInfo('Creating file brief', { 
    creatorId, 
    filename: req.file.filename,
    fileSize: req.file.size 
  });

  const brief = await BriefAnalyzerService.createFileBrief(fileData, creatorId);

  res.status(201).json(
    successResponse('File brief created successfully', {
      brief: {
        id: brief._id,
        briefId: brief.briefId,
        status: brief.status,
        inputType: brief.inputType,
        extractionStatus: brief.aiExtraction.status,
        fileName: brief.originalContent.uploadedFile.originalName,
        fileSize: brief.originalContent.uploadedFile.fileSize,
        createdAt: brief.createdAt
      }
    })
  );
});

// ============================================
// BRIEF RETRIEVAL CONTROLLERS
// ============================================

/**
 * Get Brief by ID
 * GET /api/briefs/:briefId
 */
const getBriefById = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const creatorId = req.user.userId;

  const brief = await BriefAnalyzerService.getBriefById(briefId, creatorId);

  // Add computed fields for frontend
  const briefData = {
    ...brief.toObject(),
    completionPercentage: brief.getCompletionPercentage(),
    estimatedValue: brief.getEstimatedValue(),
    isReadyForDeal: brief.isReadyForDeal(),
    daysOld: brief.getDaysOld(),
    briefAge: brief.briefAge
  };

  res.status(200).json(
    successResponse('Brief retrieved successfully', {
      brief: briefData
    })
  );
});

/**
 * Get Creator's Briefs with Filtering
 * GET /api/briefs
 */
const getCreatorBriefs = asyncHandler(async (req, res) => {
  const creatorId = req.user.userId;
  const filters = {
    status: req.query.status,
    inputType: req.query.inputType,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    sortBy: req.query.sortBy || 'createdAt',
    sortOrder: req.query.sortOrder || 'desc',
    search: req.query.search
  };

  logInfo('Retrieving creator briefs', { creatorId, filters });

  const result = await BriefAnalyzerService.getCreatorBriefs(creatorId, filters);

  res.status(200).json(
    successResponse('Briefs retrieved successfully', result)
  );
});

/**
 * Get Briefs by Status
 * GET /api/briefs/status/:status
 */
const getBriefsByStatus = asyncHandler(async (req, res) => {
  const { status } = req.params;
  const creatorId = req.user.userId;

  const briefs = await Brief.getByStatus(creatorId, status);

  // Add computed fields
  const enrichedBriefs = briefs.map(brief => ({
    ...brief.toObject(),
    completionPercentage: brief.getCompletionPercentage(),
    estimatedValue: brief.getEstimatedValue(),
    isReadyForDeal: brief.isReadyForDeal()
  }));

  res.status(200).json(
    successResponse(`Briefs with status '${status}' retrieved`, {
      briefs: enrichedBriefs,
      count: enrichedBriefs.length
    })
  );
});

/**
 * Get Dashboard Statistics
 * GET /api/briefs/dashboard/stats
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const creatorId = req.user.userId;

  const stats = await BriefAnalyzerService.getDashboardStats(creatorId);

  res.status(200).json(
    successResponse('Dashboard statistics retrieved', {
      stats
    })
  );
});

// ============================================
// BRIEF UPDATE CONTROLLERS
// ============================================

/**
 * Update Brief
 * PATCH /api/briefs/:briefId
 */
const updateBrief = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const creatorId = req.user.userId;
  const updateData = req.body;

  logInfo('Updating brief', { briefId, creatorId, updates: Object.keys(updateData) });

  const updatedBrief = await BriefAnalyzerService.updateBrief(briefId, updateData, creatorId);

  res.status(200).json(
    successResponse('Brief updated successfully', {
      brief: {
        id: updatedBrief._id,
        briefId: updatedBrief.briefId,
        status: updatedBrief.status,
        updatedAt: updatedBrief.updatedAt
      }
    })
  );
});

/**
 * Update Brief Status
 * PATCH /api/briefs/:briefId/status
 */
const updateBriefStatus = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const { status } = req.body;
  const creatorId = req.user.userId;

  logInfo('Updating brief status', { briefId, newStatus: status });

  const updatedBrief = await BriefAnalyzerService.updateBrief(briefId, { status }, creatorId);

  res.status(200).json(
    successResponse('Brief status updated successfully', {
      briefId: updatedBrief.briefId,
      oldStatus: req.body.oldStatus,
      newStatus: status,
      updatedAt: updatedBrief.updatedAt
    })
  );
});

/**
 * Add Creator Notes
 * PATCH /api/briefs/:briefId/notes
 */
const updateCreatorNotes = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const { notes } = req.body;
  const creatorId = req.user.userId;

  const updatedBrief = await BriefAnalyzerService.updateBrief(briefId, { creatorNotes: notes }, creatorId);

  res.status(200).json(
    successResponse('Creator notes updated successfully', {
      briefId: updatedBrief.briefId,
      notes: updatedBrief.creatorNotes
    })
  );
});

/**
 * Update Brief Tags
 * PATCH /api/briefs/:briefId/tags
 */
const updateBriefTags = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const { tags } = req.body;
  const creatorId = req.user.userId;

  const updatedBrief = await BriefAnalyzerService.updateBrief(briefId, { tags }, creatorId);

  res.status(200).json(
    successResponse('Brief tags updated successfully', {
      briefId: updatedBrief.briefId,
      tags: updatedBrief.tags
    })
  );
});

// ============================================
// AI PROCESSING CONTROLLERS
// ============================================

/**
 * Trigger AI Extraction Manually
 * POST /api/briefs/:briefId/extract
 */
const triggerAIExtraction = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const creatorId = req.user.userId;

  logInfo('Manually triggering AI extraction', { briefId, creatorId });

  // Check if user has AI access
  const hasAccess = await BriefAnalyzerService.hasAIAccess(creatorId);
  if (!hasAccess) {
    return res.status(403).json(
      errorResponse('AI features not available in your subscription tier', null, 403)
    );
  }

  const extractionResult = await BriefAnalyzerService.processAIExtraction(briefId);

  res.status(200).json(
    successResponse('AI extraction completed successfully', {
      briefId,
      extractionStatus: extractionResult.status,
      deliverables: extractionResult.deliverables.length,
      missingInfo: extractionResult.missingInfo.length,
      confidenceScore: extractionResult.processingMetadata.confidenceScore,
      processingTime: extractionResult.processingMetadata.processingTime
    })
  );
});

/**
 * Get AI Extraction Status
 * GET /api/briefs/:briefId/extraction-status
 */
const getExtractionStatus = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const creatorId = req.user.userId;

  const brief = await Brief.findOne({
    _id: briefId,
    creatorId,
    isDeleted: false
  });

  if (!brief) {
    return res.status(404).json(
      errorResponse('Brief not found', null, 404)
    );
  }

  res.status(200).json(
    successResponse('Extraction status retrieved', {
      briefId: brief.briefId,
      status: brief.aiExtraction.status,
      completionPercentage: brief.getCompletionPercentage(),
      lastProcessedAt: brief.lastProcessedAt,
      processingMetadata: brief.aiExtraction.processingMetadata
    })
  );
});

// ============================================
// CLARIFICATION CONTROLLERS
// ============================================

/**
 * Generate Clarification Email
 * POST /api/briefs/:briefId/clarification-email
 */
const generateClarificationEmail = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const creatorId = req.user.userId;

  logInfo('Generating clarification email', { briefId });

  const emailTemplate = await BriefAnalyzerService.generateClarificationEmail(briefId);

  if (!emailTemplate) {
    return res.status(400).json(
      errorResponse('No unanswered clarifications found', null, 400)
    );
  }

  res.status(200).json(
    successResponse('Clarification email generated successfully', {
      briefId,
      emailTemplate
    })
  );
});

/**
 * Add Custom Clarification Question
 * POST /api/briefs/:briefId/clarifications
 */
const addClarificationQuestion = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const { question } = req.body;
  const creatorId = req.user.userId;

  const brief = await Brief.findOne({
    _id: briefId,
    creatorId,
    isDeleted: false
  });

  if (!brief) {
    return res.status(404).json(
      errorResponse('Brief not found', null, 404)
    );
  }

  // Add custom question
  brief.clarifications.customQuestions.push({
    question,
    addedAt: new Date(),
    isAnswered: false
  });

  await brief.save();

  res.status(201).json(
    successResponse('Clarification question added successfully', {
      briefId: brief.briefId,
      question,
      totalQuestions: brief.clarifications.customQuestions.length
    })
  );
});

/**
 * Answer Clarification Question
 * PATCH /api/briefs/:briefId/clarifications/:questionId
 */
const answerClarificationQuestion = asyncHandler(async (req, res) => {
  const { briefId, questionId } = req.params;
  const { answer } = req.body;
  const creatorId = req.user.userId;

  const brief = await Brief.findOne({
    _id: briefId,
    creatorId,
    isDeleted: false
  });

  if (!brief) {
    return res.status(404).json(
      errorResponse('Brief not found', null, 404)
    );
  }

  // Find and update question in suggested questions
  let questionFound = false;
  brief.clarifications.suggestedQuestions.forEach(q => {
    if (q._id.toString() === questionId) {
      q.answer = answer;
      q.isAnswered = true;
      q.answeredAt = new Date();
      questionFound = true;
    }
  });

  // If not found in suggested, check custom questions
  if (!questionFound) {
    brief.clarifications.customQuestions.forEach(q => {
      if (q._id.toString() === questionId) {
        q.answer = answer;
        q.isAnswered = true;
        q.answeredAt = new Date();
        questionFound = true;
      }
    });
  }

  if (!questionFound) {
    return res.status(404).json(
      errorResponse('Question not found', null, 404)
    );
  }

  await brief.save();

  res.status(200).json(
    successResponse('Clarification answered successfully', {
      briefId: brief.briefId,
      questionId,
      answer
    })
  );
});

// ============================================
// DEAL CONVERSION CONTROLLERS
// ============================================

/**
 * Convert Brief to Deal
 * POST /api/briefs/:briefId/convert-to-deal
 */
const convertToDeal = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const creatorId = req.user.userId;
  const dealOverrides = req.body || {};

  logInfo('Converting brief to deal', { briefId, creatorId, hasOverrides: Object.keys(dealOverrides).length > 0 });

  const deal = await BriefAnalyzerService.convertToDeal(briefId, creatorId, dealOverrides);

  res.status(201).json(
    successResponse('Brief converted to deal successfully', {
      briefId,
      deal: {
        id: deal._id,
        dealId: deal.dealId || 'Generated on save',
        brandName: deal.brandProfile.name,
        campaignName: deal.campaignName,
        platform: deal.platform,
        amount: deal.dealValue.amount,
        stage: deal.stage,
        deliverables: deal.deliverables.length,
        createdAt: deal.createdAt
      }
    })
  );
});

/**
 * Get Deal Preview from Brief
 * GET /api/briefs/:briefId/deal-preview
 */
const getDealPreview = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const creatorId = req.user.userId;

  const brief = await Brief.findOne({
    _id: briefId,
    creatorId,
    isDeleted: false
  });

  if (!brief) {
    return res.status(404).json(
      errorResponse('Brief not found', null, 404)
    );
  }

  if (!brief.isReadyForDeal()) {
    return res.status(400).json(
      errorResponse('Brief has critical missing information', {
        missingInfo: brief.aiExtraction.missingInfo.filter(info => info.importance === 'critical')
      }, 400)
    );
  }

  // Generate deal preview data
  const dealPreview = BriefAnalyzerService.buildDealFromBrief(brief, {});

  res.status(200).json(
    successResponse('Deal preview generated', {
      briefId: brief.briefId,
      dealPreview: {
        brandName: dealPreview.brandProfile.name,
        campaignName: dealPreview.campaignName,
        platform: dealPreview.platform,
        estimatedValue: dealPreview.dealValue.amount,
        deliverables: dealPreview.deliverables,
        timeline: dealPreview.timeline,
        stage: dealPreview.stage
      }
    })
  );
});

// ============================================
// UTILITY CONTROLLERS
// ============================================

/**
 * Delete Brief
 * DELETE /api/briefs/:briefId
 */
const deleteBrief = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const creatorId = req.user.userId;

  logInfo('Deleting brief', { briefId, creatorId });

  await BriefAnalyzerService.deleteBrief(briefId, creatorId);

  res.status(200).json(
    successResponse('Brief deleted successfully', {
      briefId,
      deletedAt: new Date()
    })
  );
});

/**
 * Get Brief Metadata/Options
 * GET /api/briefs/metadata
 */
const getBriefMetadata = asyncHandler(async (req, res) => {
  const metadata = {
    statuses: [
      { value: 'draft', label: 'Draft', description: 'Recently created, being processed' },
      { value: 'analyzed', label: 'Analyzed', description: 'AI analysis completed' },
      { value: 'needs_clarification', label: 'Needs Clarification', description: 'Missing critical information' },
      { value: 'ready_for_deal', label: 'Ready for Deal', description: 'All info available, ready to convert' },
      { value: 'converted', label: 'Converted', description: 'Converted to deal' },
      { value: 'archived', label: 'Archived', description: 'No longer active' }
    ],
    inputTypes: [
      { value: 'text_paste', label: 'Text Paste', description: 'Copy-pasted text content' },
      { value: 'file_upload', label: 'File Upload', description: 'Uploaded PDF/DOC file' }
    ],
    deliverableTypes: [
      { value: 'instagram_post', label: 'Instagram Post', platform: 'Instagram' },
      { value: 'instagram_reel', label: 'Instagram Reel', platform: 'Instagram' },
      { value: 'instagram_story', label: 'Instagram Story', platform: 'Instagram' },
      { value: 'youtube_video', label: 'YouTube Video', platform: 'YouTube' },
      { value: 'youtube_shorts', label: 'YouTube Shorts', platform: 'YouTube' },
      { value: 'linkedin_post', label: 'LinkedIn Post', platform: 'LinkedIn' },
      { value: 'twitter_post', label: 'Twitter Post', platform: 'Twitter' },
      { value: 'blog_post', label: 'Blog Post', platform: 'Website' }
    ],
    riskLevels: [
      { value: 'low', label: 'Low Risk', color: 'green' },
      { value: 'medium', label: 'Medium Risk', color: 'yellow' },
      { value: 'high', label: 'High Risk', color: 'red' }
    ],
    subscriptionLimits: {
      starter: { maxBriefsPerMonth: 10, maxFileSize: '5MB', aiFeatures: false },
      pro: { maxBriefsPerMonth: 25, maxFileSize: '10MB', aiFeatures: true },
      elite: { maxBriefsPerMonth: 'Unlimited', maxFileSize: '25MB', aiFeatures: true },
      agency_starter: { maxBriefsPerMonth: 'Unlimited', maxFileSize: '25MB', aiFeatures: true },
      agency_pro: { maxBriefsPerMonth: 'Unlimited', maxFileSize: '50MB', aiFeatures: true }
    }
  };

  res.status(200).json(
    successResponse('Brief metadata retrieved', {
      metadata
    })
  );
});

/**
 * Search Briefs (Advanced)
 * POST /api/briefs/search
 */
const searchBriefs = asyncHandler(async (req, res) => {
  const creatorId = req.user.userId;
  const {
    query,
    filters = {},
    page = 1,
    limit = 20
  } = req.body;

  logInfo('Advanced brief search', { creatorId, query, filters });

  // Build search criteria
  const searchFilters = {
    ...filters,
    search: query,
    page,
    limit
  };

  const result = await BriefAnalyzerService.getCreatorBriefs(creatorId, searchFilters);

  res.status(200).json(
    successResponse('Brief search completed', {
      query,
      ...result
    })
  );
});

/**
 * Bulk Update Briefs
 * PATCH /api/briefs/bulk-update
 */
const bulkUpdateBriefs = asyncHandler(async (req, res) => {
  const creatorId = req.user.userId;
  const { briefIds, updateData } = req.body;

  logInfo('Bulk updating briefs', { creatorId, briefCount: briefIds.length });

  const updatePromises = briefIds.map(briefId => 
    BriefAnalyzerService.updateBrief(briefId, updateData, creatorId)
  );

  const results = await Promise.allSettled(updatePromises);
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  res.status(200).json(
    successResponse('Bulk update completed', {
      total: briefIds.length,
      successful,
      failed,
      results: results.map((result, index) => ({
        briefId: briefIds[index],
        status: result.status,
        error: result.status === 'rejected' ? result.reason.message : null
      }))
    })
  );
});

/**
 * Get Brief Analysis Summary
 * GET /api/briefs/:briefId/summary
 */
const getBriefSummary = asyncHandler(async (req, res) => {
  const { briefId } = req.params;
  const creatorId = req.user.userId;

  const brief = await Brief.findOne({
    _id: briefId,
    creatorId,
    isDeleted: false
  });

  if (!brief) {
    return res.status(404).json(
      errorResponse('Brief not found', null, 404)
    );
  }

  const summary = {
    basicInfo: {
      briefId: brief.briefId,
      status: brief.status,
      inputType: brief.inputType,
      createdAt: brief.createdAt,
      daysOld: brief.getDaysOld()
    },
    extraction: {
      status: brief.aiExtraction.status,
      brandName: brief.aiExtraction.brandInfo.name,
      campaignName: brief.aiExtraction.campaignInfo.name,
      deliverables: brief.aiExtraction.deliverables.length,
      estimatedValue: brief.getEstimatedValue()
    },
    completion: {
      percentage: brief.getCompletionPercentage(),
      isReadyForDeal: brief.isReadyForDeal(),
      criticalMissing: brief.aiExtraction.missingInfo.filter(info => info.importance === 'critical').length
    },
    risk: {
      level: brief.aiExtraction.riskAssessment.overallRisk,
      factors: brief.aiExtraction.riskAssessment.riskFactors.length
    },
    conversion: {
      isConverted: brief.dealConversion.isConverted,
      dealId: brief.dealConversion.dealId,
      convertedAt: brief.dealConversion.convertedAt
    }
  };

  res.status(200).json(
    successResponse('Brief summary retrieved', {
      summary
    })
  );
});

// ============================================
// EXPORT CONTROLLERS
// ============================================

module.exports = {
  // Brief creation
  createTextBrief,
  createFileBrief,

  // Brief retrieval
  getBriefById,
  getCreatorBriefs,
  getBriefsByStatus,
  getDashboardStats,

  // Brief updates
  updateBrief,
  updateBriefStatus,
  updateCreatorNotes,
  updateBriefTags,

  // AI processing
  triggerAIExtraction,
  getExtractionStatus,

  // Clarification management
  generateClarificationEmail,
  addClarificationQuestion,
  answerClarificationQuestion,

  // Deal conversion
  convertToDeal,
  getDealPreview,

  // Utility endpoints
  deleteBrief,
  getBriefMetadata,
  searchBriefs,
  bulkUpdateBriefs,
  getBriefSummary
};