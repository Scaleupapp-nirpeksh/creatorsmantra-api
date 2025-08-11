//src/modules/briefs/routes.js

/**
 * CreatorsMantra Backend - Brief Analyzer Routes
 * Express routing for brief management, AI extraction, and deal conversion
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Brief API endpoints with authentication, validation, and file upload
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const briefController = require('./controller');
const briefValidation = require('./validation');
const { 
  authenticateUser, 
  authorizeSubscription,
  validateRequest
} = require('../../shared/middleware');
const { logInfo, logError } = require('../../shared/utils');
const { rateLimitByTier } = require('../../shared/rateLimiter');

const router = express.Router();

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../../uploads/briefs');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: creatorId_timestamp_originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const creatorId = req.user?.userId || 'unknown';
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    
    cb(null, `${creatorId}_${uniqueSuffix}_${baseName}${fileExtension}`);
  }
});

// File filter for allowed file types
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'), false);
  }
};

// Create multer instance with size limits by subscription tier
const createUploadMiddleware = (req, res, next) => {
  // Get user's subscription tier for file size limit
  const subscriptionTier = req.user?.subscriptionTier || 'starter';
  
  const sizeLimits = {
    starter: 5 * 1024 * 1024,      // 5MB
    pro: 10 * 1024 * 1024,         // 10MB
    elite: 25 * 1024 * 1024,       // 25MB
    agency_starter: 25 * 1024 * 1024, // 25MB
    agency_pro: 50 * 1024 * 1024   // 50MB
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: sizeLimits[subscriptionTier] || sizeLimits.starter,
      files: 1 // Only one file per upload
    }
  }).single('briefFile'); // Field name for file upload

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxSizeMB = Math.round(sizeLimits[subscriptionTier] / (1024 * 1024));
        return res.status(400).json({
          success: false,
          message: `File size exceeds limit of ${maxSizeMB}MB for ${subscriptionTier} plan`,
          code: 400,
          timestamp: new Date().toISOString()
        });
      }
      
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Only one file can be uploaded at a time',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'File upload error: ' + err.message,
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  });
};

// ============================================
// BRIEF CREATION ROUTES
// ============================================

/**
 * Create Brief from Text Input
 * POST /api/briefs/create-text
 */
router.post('/create-text',
  authenticateUser,
  rateLimitByTier('brief_creation'), // Rate limit based on subscription
  validateRequest(briefValidation.createTextBriefSchema),
  briefController.createTextBrief
);

/**
 * Create Brief from File Upload
 * POST /api/briefs/create-file
 */
router.post('/create-file',
  authenticateUser,
  rateLimitByTier('brief_creation'),
  createUploadMiddleware, // File upload handling
  briefController.createFileBrief
);

// ============================================
// BRIEF RETRIEVAL ROUTES
// ============================================

/**
 * Get Dashboard Statistics
 * GET /api/briefs/dashboard/stats
 */
router.get('/dashboard/stats',
  authenticateUser,
  briefController.getDashboardStats
);

/**
 * Get Brief Metadata/Options
 * GET /api/briefs/metadata
 */
router.get('/metadata',
  authenticateUser,
  briefController.getBriefMetadata
);

/**
 * Get Creator's Briefs with Filtering
 * GET /api/briefs
 */
router.get('/',
  authenticateUser,
  validateRequest(briefValidation.getBriefsQuerySchema, 'query'),
  briefController.getCreatorBriefs
);

/**
 * Get Briefs by Status
 * GET /api/briefs/status/:status
 */
router.get('/status/:status',
  authenticateUser,
  validateRequest(briefValidation.statusParamSchema, 'params'),
  briefController.getBriefsByStatus
);

/**
 * Get Brief by ID
 * GET /api/briefs/:briefId
 */
router.get('/:briefId',
  authenticateUser,
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  briefController.getBriefById
);

/**
 * Get Brief Analysis Summary
 * GET /api/briefs/:briefId/summary
 */
router.get('/:briefId/summary',
  authenticateUser,
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  briefController.getBriefSummary
);

// ============================================
// BRIEF UPDATE ROUTES
// ============================================

/**
 * Update Brief
 * PATCH /api/briefs/:briefId
 */
router.patch('/:briefId',
  authenticateUser,
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  validateRequest(briefValidation.updateBriefSchema),
  briefController.updateBrief
);

/**
 * Update Brief Status
 * PATCH /api/briefs/:briefId/status
 */
router.patch('/:briefId/status',
  authenticateUser,
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  validateRequest(briefValidation.updateStatusSchema),
  briefController.updateBriefStatus
);

/**
 * Update Creator Notes
 * PATCH /api/briefs/:briefId/notes
 */
router.patch('/:briefId/notes',
  authenticateUser,
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  validateRequest(briefValidation.updateNotesSchema),
  briefController.updateCreatorNotes
);

/**
 * Update Brief Tags
 * PATCH /api/briefs/:briefId/tags
 */
router.patch('/:briefId/tags',
  authenticateUser,
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  validateRequest(briefValidation.updateTagsSchema),
  briefController.updateBriefTags
);

/**
 * Bulk Update Briefs
 * PATCH /api/briefs/bulk-update
 */
router.patch('/bulk-update',
  authenticateUser,
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']), // Bulk operations for premium tiers
  validateRequest(briefValidation.bulkUpdateSchema),
  briefController.bulkUpdateBriefs
);

// ============================================
// AI PROCESSING ROUTES
// ============================================

/**
 * Trigger AI Extraction Manually
 * POST /api/briefs/:briefId/extract
 */
router.post('/:briefId/extract',
  authenticateUser,
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']), // AI features for premium tiers
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  rateLimitByTier('ai_processing'), // Limit AI calls
  briefController.triggerAIExtraction
);

/**
 * Get AI Extraction Status
 * GET /api/briefs/:briefId/extraction-status
 */
router.get('/:briefId/extraction-status',
  authenticateUser,
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  briefController.getExtractionStatus
);

// ============================================
// CLARIFICATION ROUTES
// ============================================

/**
 * Generate Clarification Email
 * POST /api/briefs/:briefId/clarification-email
 */
router.post('/:briefId/clarification-email',
  authenticateUser,
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']), // AI email generation for premium
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  briefController.generateClarificationEmail
);

/**
 * Add Custom Clarification Question
 * POST /api/briefs/:briefId/clarifications
 */
router.post('/:briefId/clarifications',
  authenticateUser,
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  validateRequest(briefValidation.addQuestionSchema),
  briefController.addClarificationQuestion
);

/**
 * Answer Clarification Question
 * PATCH /api/briefs/:briefId/clarifications/:questionId
 */
router.patch('/:briefId/clarifications/:questionId',
  authenticateUser,
  validateRequest(briefValidation.clarificationParamSchema, 'params'),
  validateRequest(briefValidation.answerQuestionSchema),
  briefController.answerClarificationQuestion
);

// ============================================
// DEAL CONVERSION ROUTES
// ============================================

/**
 * Get Deal Preview from Brief
 * GET /api/briefs/:briefId/deal-preview
 */
router.get('/:briefId/deal-preview',
  authenticateUser,
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  briefController.getDealPreview
);

/**
 * Convert Brief to Deal
 * POST /api/briefs/:briefId/convert-to-deal
 */
router.post('/:briefId/convert-to-deal',
  authenticateUser,
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  validateRequest(briefValidation.convertToDealSchema),
  briefController.convertToDeal
);

// ============================================
// SEARCH AND UTILITY ROUTES
// ============================================

/**
 * Advanced Brief Search
 * POST /api/briefs/search
 */
router.post('/search',
  authenticateUser,
  validateRequest(briefValidation.searchBriefsSchema),
  briefController.searchBriefs
);

/**
 * Delete Brief
 * DELETE /api/briefs/:briefId
 */
router.delete('/:briefId',
  authenticateUser,
  validateRequest(briefValidation.briefIdParamSchema, 'params'),
  briefController.deleteBrief
);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// Brief-specific error handler
router.use((error, req, res, next) => {
  // Handle multer errors
  if (error instanceof multer.MulterError) {
    logError('File upload error', { 
      error: error.message, 
      code: error.code,
      userId: req.user?.userId 
    });
    
    return res.status(400).json({
      success: false,
      message: 'File upload failed: ' + error.message,
      code: 400,
      timestamp: new Date().toISOString()
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    logError('Brief validation error', { 
      error: error.message,
      userId: req.user?.userId 
    });
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed: ' + error.message,
      code: 400,
      timestamp: new Date().toISOString()
    });
  }

  // Handle AI processing errors
  if (error.message.includes('AI extraction failed')) {
    logError('AI processing error', { 
      error: error.message,
      userId: req.user?.userId 
    });
    
    return res.status(503).json({
      success: false,
      message: 'AI processing temporarily unavailable. Please try again later.',
      code: 503,
      timestamp: new Date().toISOString()
    });
  }

  // Handle subscription limit errors
  if (error.message.includes('limit exceeded') || error.message.includes('not available in your subscription')) {
    logError('Subscription limit error', { 
      error: error.message,
      userId: req.user?.userId,
      subscriptionTier: req.user?.subscriptionTier 
    });
    
    return res.status(403).json({
      success: false,
      message: error.message,
      code: 403,
      timestamp: new Date().toISOString()
    });
  }

  // Pass other errors to global handler
  next(error);
});

// ============================================
// ROUTE LOGGING MIDDLEWARE
// ============================================

// Log all brief-related requests
router.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    logInfo('Brief API request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userId: req.user?.userId,
      subscriptionTier: req.user?.subscriptionTier,
      processingTime: Date.now() - req.startTime
    });
    
    originalSend.call(this, data);
  };
  
  req.startTime = Date.now();
  next();
});

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;