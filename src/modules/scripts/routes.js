//src/modules/scripts/routes.js

/**
 * CreatorsMantra Backend - Content Script Generator Routes
 * Express routing for script management, AI generation, and video transcription
 * 
 * @author CreatorsMantra Team
 * @version 2.0.0
 * @description Script API endpoints with authentication, validation, and file upload
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const scriptController = require('./controller');
const scriptValidation = require('./validation');
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
const uploadsDir = path.join(__dirname, '../../../uploads/scripts');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for document uploads
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: userId_timestamp_type_originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const userId = req.user?.userId || 'unknown';
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    
    cb(null, `${userId}_${uniqueSuffix}_doc_${baseName}${fileExtension}`);
  }
});

// Multer configuration for video uploads
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: userId_timestamp_video_originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const userId = req.user?.userId || 'unknown';
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    
    cb(null, `${userId}_${uniqueSuffix}_video_${baseName}${fileExtension}`);
  }
});

// File filter for documents
const documentFileFilter = (req, file, cb) => {
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

// File filter for videos
const videoFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'video/mp4',
    'video/mov',
    'video/avi',
    'video/quicktime',
    'video/x-msvideo'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid video type. Only MP4, MOV, and AVI files are allowed.'), false);
  }
};

// Create document upload middleware
const createDocumentUploadMiddleware = (req, res, next) => {
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
    storage: documentStorage,
    fileFilter: documentFileFilter,
    limits: {
      fileSize: sizeLimits[subscriptionTier] || sizeLimits.starter,
      files: 1 // Only one file per upload
    }
  }).single('scriptFile'); // Field name for file upload

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

// Create video upload middleware
const createVideoUploadMiddleware = (req, res, next) => {
  // Get user's subscription tier for file size limit
  const subscriptionTier = req.user?.subscriptionTier || 'starter';
  
  const sizeLimits = {
    starter: 5 * 1024 * 1024,      // 5MB (no video support)
    pro: 25 * 1024 * 1024,         // 25MB
    elite: 100 * 1024 * 1024,      // 100MB
    agency_starter: 100 * 1024 * 1024, // 100MB
    agency_pro: 200 * 1024 * 1024  // 200MB
  };

  // Check if video transcription is available for tier
  const videoEnabled = ['pro', 'elite', 'agency_starter', 'agency_pro'].includes(subscriptionTier);
  
  if (!videoEnabled) {
    return res.status(403).json({
      success: false,
      message: 'Video transcription not available in your subscription tier',
      code: 403,
      timestamp: new Date().toISOString()
    });
  }

  const upload = multer({
    storage: videoStorage,
    fileFilter: videoFileFilter,
    limits: {
      fileSize: sizeLimits[subscriptionTier] || sizeLimits.starter,
      files: 1
    }
  }).single('videoFile'); // Field name for video upload

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxSizeMB = Math.round(sizeLimits[subscriptionTier] / (1024 * 1024));
        return res.status(400).json({
          success: false,
          message: `Video size exceeds limit of ${maxSizeMB}MB for ${subscriptionTier} plan`,
          code: 400,
          timestamp: new Date().toISOString()
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'Video upload error: ' + err.message,
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
// SCRIPT CREATION ROUTES
// ============================================

/**
 * Create Script from Text Input
 * POST /api/scripts/create-text
 */
router.post('/create-text',
  authenticateUser,
  rateLimitByTier('script_creation'), // Rate limit based on subscription
  validateRequest(scriptValidation.createTextScriptSchema),
  scriptController.createTextScript
);

/**
 * Create Script from File Upload
 * POST /api/scripts/create-file
 */
router.post('/create-file',
  authenticateUser,
  rateLimitByTier('script_creation'),
  createDocumentUploadMiddleware, // Document upload handling
  validateRequest(scriptValidation.createFileScriptSchema),
  scriptController.createFileScript
);

/**
 * Create Script from Video Transcription
 * POST /api/scripts/create-video
 */
router.post('/create-video',
  authenticateUser,
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']), // Video transcription for premium tiers
  rateLimitByTier('script_creation'),
  createVideoUploadMiddleware, // Video upload handling
  validateRequest(scriptValidation.createVideoScriptSchema),
  scriptController.createVideoScript
);

// ============================================
// SCRIPT RETRIEVAL ROUTES
// ============================================

/**
 * Get Dashboard Statistics
 * GET /api/scripts/dashboard/stats
 */
router.get('/dashboard/stats',
  authenticateUser,
  scriptController.getDashboardStats
);

/**
 * Get Script Metadata/Options
 * GET /api/scripts/metadata
 */
router.get('/metadata',
  authenticateUser,
  scriptController.getScriptMetadata
);

/**
 * Get Scripts Needing Attention
 * GET /api/scripts/attention-required
 */
router.get('/attention-required',
  authenticateUser,
  scriptController.getScriptsNeedingAttention
);

/**
 * Get Available Deals for Linking
 * GET /api/scripts/available-deals
 */
router.get('/available-deals',
  authenticateUser,
  scriptController.getAvailableDeals
);

/**
 * Get User's Scripts with Filtering
 * GET /api/scripts
 */
router.get('/',
  authenticateUser,
  validateRequest(scriptValidation.getScriptsQuerySchema, 'query'),
  scriptController.getUserScripts
);

/**
 * Get Scripts by Status
 * GET /api/scripts/status/:status
 */
router.get('/status/:status',
  authenticateUser,
  validateRequest(scriptValidation.statusParamSchema, 'params'),
  scriptController.getScriptsByStatus
);

/**
 * Get Script by ID
 * GET /api/scripts/:scriptId
 */
router.get('/:scriptId',
  authenticateUser,
  validateRequest(scriptValidation.scriptIdParamSchema, 'params'),
  scriptController.getScriptById
);

/**
 * Get Script Analysis Summary
 * GET /api/scripts/:scriptId/analysis
 */
router.get('/:scriptId/analysis',
  authenticateUser,
  validateRequest(scriptValidation.scriptIdParamSchema, 'params'),
  scriptController.getScriptAnalysis
);

/**
 * Export Script Content
 * GET /api/scripts/:scriptId/export
 */
router.get('/:scriptId/export',
  authenticateUser,
  validateRequest(scriptValidation.exportScriptSchema, 'params'),
  scriptController.exportScriptContent
);

// ============================================
// SCRIPT UPDATE ROUTES
// ============================================

/**
 * Update Script
 * PATCH /api/scripts/:scriptId
 */
router.patch('/:scriptId',
  authenticateUser,
  validateRequest(scriptValidation.scriptIdParamSchema, 'params'),
  validateRequest(scriptValidation.updateScriptSchema),
  scriptController.updateScript
);

/**
 * Update Script Status
 * PATCH /api/scripts/:scriptId/status
 */
router.patch('/:scriptId/status',
  authenticateUser,
  validateRequest(scriptValidation.scriptIdParamSchema, 'params'),
  validateRequest(scriptValidation.updateStatusSchema),
  scriptController.updateScriptStatus
);

/**
 * Update Creator Notes
 * PATCH /api/scripts/:scriptId/notes
 */
router.patch('/:scriptId/notes',
  authenticateUser,
  validateRequest(scriptValidation.scriptIdParamSchema, 'params'),
  validateRequest(scriptValidation.updateNotesSchema),
  scriptController.updateCreatorNotes
);

/**
 * Update Script Tags
 * PATCH /api/scripts/:scriptId/tags
 */
router.patch('/:scriptId/tags',
  authenticateUser,
  validateRequest(scriptValidation.scriptIdParamSchema, 'params'),
  validateRequest(scriptValidation.updateTagsSchema),
  scriptController.updateScriptTags
);

/**
 * Bulk Update Scripts
 * PATCH /api/scripts/bulk-update
 */
router.patch('/bulk-update',
  authenticateUser,
  authorizeSubscription(['elite', 'agency_starter', 'agency_pro']), // Bulk operations for premium tiers
  validateRequest(scriptValidation.bulkUpdateSchema),
  scriptController.bulkUpdateScripts
);

// ============================================
// AI PROCESSING ROUTES
// ============================================

/**
 * Regenerate Script Content
 * POST /api/scripts/:scriptId/regenerate
 */
router.post('/:scriptId/regenerate',
  authenticateUser,
  validateRequest(scriptValidation.scriptIdParamSchema, 'params'),
  rateLimitByTier('ai_processing'), // Limit AI calls
  scriptController.regenerateScript
);

/**
 * Get AI Generation Status
 * GET /api/scripts/:scriptId/generation-status
 */
router.get('/:scriptId/generation-status',
  authenticateUser,
  validateRequest(scriptValidation.scriptIdParamSchema, 'params'),
  scriptController.getGenerationStatus
);

/**
 * Create Script Variation (A/B Testing)
 * POST /api/scripts/:scriptId/variations
 */
router.post('/:scriptId/variations',
  authenticateUser,
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']), // A/B testing for premium tiers
  validateRequest(scriptValidation.scriptIdParamSchema, 'params'),
  validateRequest(scriptValidation.createVariationSchema),
  rateLimitByTier('ai_processing'),
  scriptController.createScriptVariation
);

/**
 * Get Script Variations
 * GET /api/scripts/:scriptId/variations
 */
router.get('/:scriptId/variations',
  authenticateUser,
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']),
  validateRequest(scriptValidation.scriptIdParamSchema, 'params'),
  scriptController.getScriptVariations
);

// ============================================
// DEAL CONNECTION ROUTES
// ============================================

/**
 * Link Script to Deal
 * POST /api/scripts/:scriptId/link-deal/:dealId
 */
router.post('/:scriptId/link-deal/:dealId',
  authenticateUser,
  validateRequest(scriptValidation.linkDealParamSchema, 'params'),
  scriptController.linkScriptToDeal
);

/**
 * Unlink Script from Deal
 * DELETE /api/scripts/:scriptId/unlink-deal
 */
router.delete('/:scriptId/unlink-deal',
  authenticateUser,
  validateRequest(scriptValidation.scriptIdParamSchema, 'params'),
  scriptController.unlinkScriptFromDeal
);

// ============================================
// SEARCH AND UTILITY ROUTES
// ============================================

/**
 * Advanced Script Search
 * POST /api/scripts/search
 */
router.post('/search',
  authenticateUser,
  validateRequest(scriptValidation.searchScriptsSchema),
  scriptController.searchScripts
);

/**
 * Delete Script
 * DELETE /api/scripts/:scriptId
 */
router.delete('/:scriptId',
  authenticateUser,
  validateRequest(scriptValidation.scriptIdParamSchema, 'params'),
  scriptController.deleteScript
);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// Script-specific error handler
router.use((error, req, res, next) => {
  // Handle multer errors
  if (error instanceof multer.MulterError) {
    logError('File upload error', { 
      error: error.message, 
      code: error.code,
      userId: req.user?.userId 
    });
    
    let message = 'File upload failed: ' + error.message;
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds the allowed limit for your subscription tier';
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      message = 'Only one file can be uploaded at a time';
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field. Please use the correct field name';
    }
    
    return res.status(400).json({
      success: false,
      message,
      code: 400,
      timestamp: new Date().toISOString()
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    logError('Script validation error', { 
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
  if (error.message.includes('AI generation failed') || 
      error.message.includes('Video transcription failed')) {
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
  if (error.message.includes('limit exceeded') || 
      error.message.includes('not available in your subscription')) {
    logError('Subscription limit error', { 
      error: error.message,
      userId: req.user?.userId,
      subscriptionTier: req.user?.subscriptionTier 
    });
    
    return res.status(403).json({
      success: false,
      message: error.message,
      code: 403,
      upgrade: true, // Flag for frontend to show upgrade option
      timestamp: new Date().toISOString()
    });
  }

  // Handle video transcription specific errors
  if (error.message.includes('transcription')) {
    logError('Video transcription error', { 
      error: error.message,
      userId: req.user?.userId 
    });
    
    return res.status(422).json({
      success: false,
      message: 'Video processing failed. Please ensure the video is clear and contains speech.',
      code: 422,
      timestamp: new Date().toISOString()
    });
  }

  // Handle deal connection errors
  if (error.message.includes('Deal not found') || 
      error.message.includes('Script not found')) {
    logError('Resource not found error', { 
      error: error.message,
      userId: req.user?.userId 
    });
    
    return res.status(404).json({
      success: false,
      message: error.message,
      code: 404,
      timestamp: new Date().toISOString()
    });
  }

  // Handle rate limiting errors
  if (error.message.includes('rate limit') || 
      error.message.includes('Too many requests')) {
    logError('Rate limit error', { 
      error: error.message,
      userId: req.user?.userId,
      subscriptionTier: req.user?.subscriptionTier 
    });
    
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Please wait before making more requests.',
      code: 429,
      retryAfter: 3600, // 1 hour
      timestamp: new Date().toISOString()
    });
  }

  // Handle disk space or storage errors
  if (error.code === 'ENOSPC' || error.message.includes('storage')) {
    logError('Storage error', { 
      error: error.message,
      userId: req.user?.userId 
    });
    
    return res.status(507).json({
      success: false,
      message: 'Storage temporarily unavailable. Please try again later.',
      code: 507,
      timestamp: new Date().toISOString()
    });
  }

  // Pass other errors to global handler
  next(error);
});

// ============================================
// ROUTE LOGGING MIDDLEWARE
// ============================================

// Log all script-related requests
router.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    logInfo('Script API request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userId: req.user?.userId,
      subscriptionTier: req.user?.subscriptionTier,
      processingTime: Date.now() - req.startTime,
      fileUploaded: !!req.file,
      fileSize: req.file?.size
    });
    
    originalSend.call(this, data);
  };
  
  req.startTime = Date.now();
  next();
});

// ============================================
// HEALTH CHECK AND DEBUG ROUTES
// ============================================

/**
 * Health check for script module
 * GET /api/scripts/health
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Script module is healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      textScripts: true,
      fileUpload: true,
      videoTranscription: true,
      aiGeneration: true,
      abTesting: true,
      trendIntegration: true,
      dealConnection: true
    }
  });
});

/**
 * Get upload limits for current user (debug endpoint)
 * GET /api/scripts/debug/limits
 */
router.get('/debug/limits',
  authenticateUser,
  (req, res) => {
    const subscriptionTier = req.user.subscriptionTier || 'starter';
    
    const limits = {
      starter: {
        maxScriptsPerMonth: 10,
        maxFileSize: '5MB',
        maxVideoSize: 'N/A',
        videoTranscription: false,
        abTesting: false,
        trendIntegration: false
      },
      pro: {
        maxScriptsPerMonth: 25,
        maxFileSize: '10MB',
        maxVideoSize: '25MB',
        maxVideosPerMonth: 10,
        videoTranscription: true,
        abTesting: true,
        trendIntegration: true
      },
      elite: {
        maxScriptsPerMonth: 'Unlimited',
        maxFileSize: '25MB',
        maxVideoSize: '100MB',
        maxVideosPerMonth: 'Unlimited',
        videoTranscription: true,
        abTesting: true,
        trendIntegration: true,
        advancedFeatures: true
      },
      agency_starter: {
        maxScriptsPerMonth: 'Unlimited',
        maxFileSize: '25MB',
        maxVideoSize: '100MB',
        maxVideosPerMonth: 'Unlimited',
        videoTranscription: true,
        abTesting: true,
        trendIntegration: true,
        advancedFeatures: true
      },
      agency_pro: {
        maxScriptsPerMonth: 'Unlimited',
        maxFileSize: '50MB',
        maxVideoSize: '200MB',
        maxVideosPerMonth: 'Unlimited',
        videoTranscription: true,
        abTesting: true,
        trendIntegration: true,
        advancedFeatures: true,
        bulkOperations: true
      }
    };

    res.status(200).json({
      success: true,
      currentTier: subscriptionTier,
      limits: limits[subscriptionTier] || limits.starter,
      userId: req.user.id,
      timestamp: new Date().toISOString()
    });
  }
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;