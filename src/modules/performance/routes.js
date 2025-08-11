/**
 * CreatorsMantra Backend - Performance Vault Routes
 * Express routing with middleware, validation, and file upload handling
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Performance tracking routes with authentication, rate limiting, and file processing
 * 
 * File Path: src/modules/performance/routes.js
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const performanceController = require('./controller');
const performanceValidation = require('./validation');
const { 
  authenticateUser, 
  authorizeSubscription,
  validateRequest
} = require('../../shared/middleware');
const { logInfo, logError } = require('../../shared/utils');

const router = express.Router();

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================

// Standard rate limiting for most operations
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    code: 429
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Restrictive rate limiting for resource-intensive operations
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per window
  message: {
    success: false,
    message: 'Too many file uploads. Please try again later.',
    code: 429
  },
  standardHeaders: true,
  legacyHeaders: false
});

// AI processing rate limiting
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 AI requests per window
  message: {
    success: false,
    message: 'Too many AI processing requests. Please try again later.',
    code: 429
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Report generation rate limiting
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 report generations per window
  message: {
    success: false,
    message: 'Too many report generation requests. Please try again later.',
    code: 429
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Bulk operations rate limiting
const bulkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 bulk operations per window
  message: {
    success: false,
    message: 'Too many bulk operations. Please try again later.',
    code: 429
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../../uploads/performance');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logInfo('Created performance uploads directory', { path: uploadsDir });
}

// Screenshot upload configuration
const screenshotStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadsDir, 'screenshots', req.user.userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const campaignId = req.params.campaignId || 'unknown';
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    
    cb(null, `${campaignId}_${uniqueSuffix}_${baseName}${fileExtension}`);
  }
});

// Logo upload configuration
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadsDir, 'logos', req.user.userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    
    cb(null, `logo_${uniqueSuffix}${fileExtension}`);
  }
});

// File filter for screenshots
const screenshotFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// File filter for logos
const logoFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid logo file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// Multer instances
const screenshotUpload = multer({
  storage: screenshotStorage,
  fileFilter: screenshotFilter,
  limits: {
    fileSize: 10485760, // 10MB limit
    files: 1
  }
});

const logoUpload = multer({
  storage: logoStorage,
  fileFilter: logoFilter,
  limits: {
    fileSize: 2097152, // 2MB limit for logos
    files: 1
  }
});

// ============================================
// SUBSCRIPTION TIERS CONSTANT
// ============================================

const PERFORMANCE_ALLOWED_TIERS = ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro'];
const AI_REQUIRED_TIERS = ['pro', 'elite', 'agency_starter', 'agency_pro'];
const ADVANCED_ANALYTICS_TIERS = ['elite', 'agency_starter', 'agency_pro'];

// ============================================
// HEALTH CHECK ROUTE (No authentication)
// ============================================

router.get('/health', performanceController.getHealthCheck);

// ============================================
// METADATA ROUTES (No authentication required)
// ============================================

router.get('/metadata', performanceController.getPerformanceMetadata);

// ============================================
// AUTHENTICATION MIDDLEWARE FOR ALL ROUTES BELOW
// ============================================

router.use(authenticateUser);

// ============================================
// CAMPAIGN MANAGEMENT ROUTES
// ============================================

/**
 * Create a new campaign
 * POST /api/v1/performance/campaigns
 */
router.post('/campaigns',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.createCampaignSchema),
  performanceController.createCampaign
);

/**
 * Get campaigns with filters and pagination
 * GET /api/v1/performance/campaigns
 */
router.get('/campaigns',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.getCampaignsQuerySchema, 'query'),
  performanceController.getCampaigns
);

/**
 * Get single campaign details
 * GET /api/v1/performance/campaigns/:campaignId
 */
router.get('/campaigns/:campaignId',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.campaignIdParamSchema, 'params'),
  performanceController.getCampaignById
);

/**
 * Update campaign details
 * PUT /api/v1/performance/campaigns/:campaignId
 */
router.put('/campaigns/:campaignId',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.campaignIdParamSchema, 'params'),
  validateRequest(performanceValidation.updateCampaignSchema),
  performanceController.updateCampaign
);

/**
 * Archive campaign (soft delete)
 * DELETE /api/v1/performance/campaigns/:campaignId
 */
router.delete('/campaigns/:campaignId',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.campaignIdParamSchema, 'params'),
  performanceController.deleteCampaign
);

/**
 * Bulk update campaigns
 * PUT /api/v1/performance/campaigns/bulk
 */
router.put('/campaigns/bulk',
  bulkLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.bulkUpdateCampaignsSchema),
  performanceController.bulkUpdateCampaigns
);

// ============================================
// SCREENSHOT UPLOAD & PROCESSING ROUTES
// ============================================

/**
 * Upload campaign screenshot
 * POST /api/v1/performance/campaigns/:campaignId/screenshots
 */
router.post('/campaigns/:campaignId/screenshots',
  uploadLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.campaignIdParamSchema, 'params'),
  screenshotUpload.single('screenshot'),
  performanceController.uploadScreenshot
);

/**
 * Get screenshots for a campaign
 * GET /api/v1/performance/campaigns/:campaignId/screenshots
 */
router.get('/campaigns/:campaignId/screenshots',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.campaignIdParamSchema, 'params'),
  performanceController.getCampaignScreenshots
);

/**
 * Delete screenshot
 * DELETE /api/v1/performance/screenshots/:screenshotId
 */
router.delete('/screenshots/:screenshotId',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.screenshotIdParamSchema, 'params'),
  performanceController.deleteScreenshot
);

/**
 * Trigger manual AI processing for screenshot
 * POST /api/v1/performance/screenshots/:screenshotId/analyze
 */
router.post('/screenshots/:screenshotId/analyze',
  aiLimiter,
  authorizeSubscription(AI_REQUIRED_TIERS),
  validateRequest(performanceValidation.screenshotIdParamSchema, 'params'),
  performanceController.analyzeScreenshot
);

// ============================================
// AI ANALYSIS ROUTES
// ============================================

/**
 * Generate AI analysis for campaign
 * POST /api/v1/performance/campaigns/:campaignId/analyze
 */
router.post('/campaigns/:campaignId/analyze',
  aiLimiter,
  authorizeSubscription(AI_REQUIRED_TIERS),
  validateRequest(performanceValidation.campaignIdParamSchema, 'params'),
  performanceController.generateCampaignAnalysis
);

/**
 * Get campaign analysis results
 * GET /api/v1/performance/campaigns/:campaignId/analysis
 */
router.get('/campaigns/:campaignId/analysis',
  standardLimiter,
  authorizeSubscription(AI_REQUIRED_TIERS),
  validateRequest(performanceValidation.campaignIdParamSchema, 'params'),
  performanceController.getCampaignAnalysis
);

/**
 * Regenerate AI analysis for campaign
 * PUT /api/v1/performance/campaigns/:campaignId/analysis
 */
router.put('/campaigns/:campaignId/analysis',
  aiLimiter,
  authorizeSubscription(AI_REQUIRED_TIERS),
  validateRequest(performanceValidation.campaignIdParamSchema, 'params'),
  performanceController.regenerateCampaignAnalysis
);

// ============================================
// REPORT GENERATION ROUTES
// ============================================

/**
 * Generate campaign report
 * POST /api/v1/performance/campaigns/:campaignId/reports
 */
router.post('/campaigns/:campaignId/reports',
  reportLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.campaignIdParamSchema, 'params'),
  validateRequest(performanceValidation.generateReportSchema),
  performanceController.generateCampaignReport
);

/**
 * Get reports for a campaign
 * GET /api/v1/performance/campaigns/:campaignId/reports
 */
router.get('/campaigns/:campaignId/reports',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.campaignIdParamSchema, 'params'),
  performanceController.getCampaignReports
);

/**
 * Get all reports for user
 * GET /api/v1/performance/reports
 */
router.get('/reports',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.getReportsQuerySchema, 'query'),
  performanceController.getAllReports
);

/**
 * Download report
 * GET /api/v1/performance/reports/:reportId/download
 */
router.get('/reports/:reportId/download',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.reportIdParamSchema, 'params'),
  performanceController.downloadReport
);

/**
 * Share report (generate public link)
 * POST /api/v1/performance/reports/:reportId/share
 */
router.post('/reports/:reportId/share',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.reportIdParamSchema, 'params'),
  performanceController.shareReport
);

/**
 * Bulk generate reports
 * POST /api/v1/performance/reports/bulk
 */
router.post('/reports/bulk',
  bulkLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.bulkGenerateReportsSchema),
  performanceController.bulkGenerateReports
);

// ============================================
// ANALYTICS & DASHBOARD ROUTES
// ============================================

/**
 * Get performance overview/dashboard
 * GET /api/v1/performance/overview
 */
router.get('/overview',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.analyticsQuerySchema, 'query'),
  performanceController.getPerformanceOverview
);

/**
 * Get campaign analytics
 * GET /api/v1/performance/analytics
 */
router.get('/analytics',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.analyticsQuerySchema, 'query'),
  performanceController.getCampaignAnalytics
);

/**
 * Get top performing campaigns
 * GET /api/v1/performance/top-campaigns
 */
router.get('/top-campaigns',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.topCampaignsQuerySchema, 'query'),
  performanceController.getTopCampaigns
);

/**
 * Get performance insights (Elite+ tier)
 * GET /api/v1/performance/insights
 */
router.get('/insights',
  standardLimiter,
  authorizeSubscription(ADVANCED_ANALYTICS_TIERS),
  validateRequest(performanceValidation.analyticsQuerySchema, 'query'),
  performanceController.getPerformanceInsights
);

// ============================================
// SETTINGS & CONFIGURATION ROUTES
// ============================================

/**
 * Get user performance settings
 * GET /api/v1/performance/settings
 */
router.get('/settings',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  performanceController.getUserSettings
);

/**
 * Update user performance settings
 * PUT /api/v1/performance/settings
 */
router.put('/settings',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.updateSettingsSchema),
  performanceController.updateUserSettings
);

/**
 * Update branding settings
 * PUT /api/v1/performance/settings/branding
 */
router.put('/settings/branding',
  standardLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  validateRequest(performanceValidation.updateBrandingSchema),
  performanceController.updateBrandingSettings
);

/**
 * Upload brand logo
 * POST /api/v1/performance/settings/logo
 */
router.post('/settings/logo',
  uploadLimiter,
  authorizeSubscription(PERFORMANCE_ALLOWED_TIERS),
  logoUpload.single('logo'),
  performanceController.uploadBrandLogo
);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

/**
 * Multer error handling middleware
 */
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    logError('File upload error', { 
      error: error.message, 
      code: error.code,
      userId: req.user?.userId 
    });

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 10MB for screenshots and 2MB for logos.',
          code: 400
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files. Only one file allowed per upload.',
          code: 400
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field. Use "screenshot" for screenshots and "logo" for logos.',
          code: 400
        });
      default:
        return res.status(400).json({
          success: false,
          message: 'File upload error occurred.',
          code: 400
        });
    }
  }

  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message,
      code: 400
    });
  }

  next(error);
});

// ============================================
// ROUTE VALIDATION MIDDLEWARE
// ============================================

/**
 * Validate campaign ownership middleware
 */
const validateCampaignOwnership = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user.userId;

    // This validation is handled in the service layer
    // Just pass through for now
    next();
  } catch (error) {
    logError('Campaign ownership validation failed', { 
      error: error.message,
      userId: req.user?.userId,
      campaignId: req.params?.campaignId
    });
    
    res.status(500).json({
      success: false,
      message: 'Validation error occurred',
      code: 500
    });
  }
};

/**
 * Validate screenshot ownership middleware
 */
const validateScreenshotOwnership = async (req, res, next) => {
  try {
    const { screenshotId } = req.params;
    const userId = req.user.userId;

    // This validation is handled in the service layer
    // Just pass through for now
    next();
  } catch (error) {
    logError('Screenshot ownership validation failed', { 
      error: error.message,
      userId: req.user?.userId,
      screenshotId: req.params?.screenshotId
    });
    
    res.status(500).json({
      success: false,
      message: 'Validation error occurred',
      code: 500
    });
  }
};

// ============================================
// ROUTE DOCUMENTATION & METADATA
// ============================================

/**
 * Get available routes for this module
 * GET /api/v1/performance/routes
 */
router.get('/routes', (req, res) => {
  const routes = [
    // Campaign Management
    { method: 'POST', path: '/campaigns', description: 'Create new campaign' },
    { method: 'GET', path: '/campaigns', description: 'Get campaigns with filters' },
    { method: 'GET', path: '/campaigns/:id', description: 'Get campaign details' },
    { method: 'PUT', path: '/campaigns/:id', description: 'Update campaign' },
    { method: 'DELETE', path: '/campaigns/:id', description: 'Archive campaign' },
    { method: 'PUT', path: '/campaigns/bulk', description: 'Bulk update campaigns' },
    
    // Screenshot Processing
    { method: 'POST', path: '/campaigns/:id/screenshots', description: 'Upload screenshot' },
    { method: 'GET', path: '/campaigns/:id/screenshots', description: 'Get campaign screenshots' },
    { method: 'DELETE', path: '/screenshots/:id', description: 'Delete screenshot' },
    { method: 'POST', path: '/screenshots/:id/analyze', description: 'Analyze screenshot with AI' },
    
    // AI Analysis
    { method: 'POST', path: '/campaigns/:id/analyze', description: 'Generate AI analysis' },
    { method: 'GET', path: '/campaigns/:id/analysis', description: 'Get analysis results' },
    { method: 'PUT', path: '/campaigns/:id/analysis', description: 'Regenerate analysis' },
    
    // Report Generation
    { method: 'POST', path: '/campaigns/:id/reports', description: 'Generate campaign report' },
    { method: 'GET', path: '/campaigns/:id/reports', description: 'Get campaign reports' },
    { method: 'GET', path: '/reports', description: 'Get all user reports' },
    { method: 'GET', path: '/reports/:id/download', description: 'Download report' },
    { method: 'POST', path: '/reports/:id/share', description: 'Share report' },
    { method: 'POST', path: '/reports/bulk', description: 'Bulk generate reports' },
    
    // Analytics & Dashboard
    { method: 'GET', path: '/overview', description: 'Performance dashboard' },
    { method: 'GET', path: '/analytics', description: 'Campaign analytics' },
    { method: 'GET', path: '/top-campaigns', description: 'Top performing campaigns' },
    { method: 'GET', path: '/insights', description: 'Performance insights (Elite+)' },
    
    // Settings & Configuration
    { method: 'GET', path: '/settings', description: 'Get user settings' },
    { method: 'PUT', path: '/settings', description: 'Update settings' },
    { method: 'PUT', path: '/settings/branding', description: 'Update branding' },
    { method: 'POST', path: '/settings/logo', description: 'Upload brand logo' },
    
    // Utility
    { method: 'GET', path: '/health', description: 'Health check' },
    { method: 'GET', path: '/metadata', description: 'Module metadata' },
    { method: 'GET', path: '/routes', description: 'Available routes' }
  ];

  res.status(200).json({
    success: true,
    message: 'Performance module routes',
    data: {
      module: 'performance',
      totalRoutes: routes.length,
      routes,
      version: '1.0.0'
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;