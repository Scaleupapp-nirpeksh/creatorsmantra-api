/**
 * CreatorsMantra Backend - Performance Module Routes (Complete & Fixed)
 * Fixed user ID consistency issues
 * src/modules/performance/routes.js
 * @author CreatorsMantra Team
 * @version 1.0.1
 * @description Express routes for performance management functionality
 */

const express = require('express');
const Joi = require('joi');

// Safe middleware import with fallback
let authenticateUser;
try {
  const middleware = require('../../shared/middleware');
  authenticateUser = middleware.authenticateUser;
  console.log('✅ Performance routes: Middleware imported successfully');
} catch (error) {
  console.error('⚠ Performance routes: Failed to import middleware:', error.message);
  // Fallback authentication middleware
  authenticateUser = (req, res, next) => {
    console.warn('⚠️ Using fallback authentication middleware');
    // Mock user for development - REMOVE IN PRODUCTION
    req.user = {
      id: 'dev-user',              // FIXED: Changed from userId to id
      email: 'dev@example.com',
      subscriptionTier: 'pro',
      role: 'user'
    };
    next();
  };
}

// Import the controller - using try-catch for safer imports
let performanceController;
try {
  performanceController = require('./controller');
  console.log('✅ Performance routes: Controller imported successfully');
} catch (error) {
  console.error('⚠ Performance routes: Failed to import performance controller:', error.message);
  // Create stub functions to prevent route registration from failing
  performanceController = {
    createPerformanceCase: (req, res) => res.status(503).json({ error: 'Performance module not available' }),
    getPerformanceCases: (req, res) => res.status(503).json({ error: 'Performance module not available' }),
    getPerformanceCase: (req, res) => res.status(503).json({ error: 'Performance module not available' }),
    updatePerformanceCase: (req, res) => res.status(503).json({ error: 'Performance module not available' }),
    uploadEvidence: [(req, res) => res.status(503).json({ error: 'Performance module not available' })],
    triggerAIAnalysis: [(req, res) => res.status(503).json({ error: 'Performance module not available' })],
    generateReport: (req, res) => res.status(503).json({ error: 'Performance module not available' }),
    downloadReport: (req, res) => res.status(503).json({ error: 'Performance module not available' }),
    sendReportToClient: (req, res) => res.status(503).json({ error: 'Performance module not available' }),
    getSettings: (req, res) => res.status(503).json({ error: 'Performance module not available' }),
    updateSettings: (req, res) => res.status(503).json({ error: 'Performance module not available' }),
    getAnalytics: (req, res) => res.status(503).json({ error: 'Performance module not available' }),
    archivePerformanceCase: (req, res) => res.status(503).json({ error: 'Performance module not available' }),
    rateLimiters: {
      standard: (req, res, next) => next(),
      upload: (req, res, next) => next(),
      aiAnalysis: (req, res, next) => next()
    }
  };
}

const router = express.Router();

// ============================================
// UTILITY FUNCTIONS
// ============================================

const logInfo = (message, meta = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toLocaleString('en-IN'),
    level: 'INFO',
    message,
    meta
  }));
};

const logError = (message, meta = {}) => {
  console.error(JSON.stringify({
    timestamp: new Date().toLocaleString('en-IN'),
    level: 'ERROR',
    message,
    meta
  }));
};

// Response helpers
const successResponse = (message, data = null, statusCode = 200) => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString()
});

const errorResponse = (message, data = null, statusCode = 500) => ({
  success: false,
  message,
  data,
  timestamp: new Date().toISOString(),
  code: statusCode
});

// ============================================
// MIDDLEWARE SETUP
// ============================================

// Subscription authorization middleware
const authorizeSubscription = (allowedTiers) => {
  return (req, res, next) => {
    const userTier = req.user?.subscriptionTier;
    
    if (!allowedTiers.includes(userTier)) {
      return res.status(403).json(errorResponse(
        'Subscription upgrade required',
        { 
          currentTier: userTier,
          requiredTiers: allowedTiers 
        },
        403
      ));
    }
    
    next();
  };
};

// Request validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    // Validate params
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(...error.details.map(d => `Param ${d.message}`));
      }
    }
    
    // Validate query
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(...error.details.map(d => `Query ${d.message}`));
      }
    }
    
    // Validate body
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(...error.details.map(d => `Body ${d.message}`));
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json(errorResponse(
        'Validation failed',
        { errors },
        400
      ));
    }
    
    next();
  };
};

// Log all performance API calls
router.use((req, res, next) => {
  logInfo('Performance API call', {
    method: req.method,
    path: req.path,
    userId: req.user?.id,                // FIXED: Changed from userId to id
    subscriptionTier: req.user?.subscriptionTier,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Subscription tiers for different features
const BASIC_PERFORMANCE_TIERS = ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro'];
const AI_ANALYSIS_TIERS = ['pro', 'elite', 'agency_starter', 'agency_pro'];
const ADVANCED_REPORTS_TIERS = ['elite', 'agency_starter', 'agency_pro'];

// ============================================
// PERFORMANCE CASE ROUTES
// ============================================

/**
 * Create new performance case
 * POST /api/v1/performance/cases
 */
router.post('/cases',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  performanceController.createPerformanceCase
);

/**
 * Get all performance cases for user
 * GET /api/v1/performance/cases
 */
router.get('/cases',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  performanceController.getPerformanceCases
);

/**
 * Get single performance case with all related data
 * GET /api/v1/performance/cases/:id
 */
router.get('/cases/:id',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: Joi.object({
      id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    })
  }),
  performanceController.getPerformanceCase
);

/**
 * Update performance case
 * PUT /api/v1/performance/cases/:id
 */
router.put('/cases/:id',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: Joi.object({
      id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    })
  }),
  performanceController.updatePerformanceCase
);

/**
 * Upload evidence files for performance case
 * POST /api/v1/performance/cases/:id/evidence
 */
router.post('/cases/:id/evidence',
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: Joi.object({
      id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    })
  }),
  ...performanceController.uploadEvidence // Spread array of middleware
);

/**
 * Get evidence files for performance case
 * GET /api/v1/performance/cases/:id/evidence
 */
router.get('/cases/:id/evidence',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: Joi.object({
      id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    })
  }),
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;          // FIXED: Changed from userId to id
    const { evidenceType, platform } = req.query;

    try {
      // Try to get models dynamically
      const getModels = () => {
        try {
          return require('./model');
        } catch (error) {
          return {};
        }
      };

      const { PerformanceCase, PerformanceEvidence } = getModels();
      
      if (!PerformanceCase || !PerformanceEvidence) {
        return res.status(503).json(errorResponse('Performance models not available', null, 503));
      }

      // Check access to performance case
      const performanceCase = await PerformanceCase.findById(id);
      if (!performanceCase) {
        return res.status(404).json(errorResponse('Performance case not found', null, 404));
      }

      const hasAccess = await performanceCase.hasUserAccess(userId, 'view');
      if (!hasAccess) {
        return res.status(403).json(errorResponse('Access denied', null, 403));
      }

      // Build query
      const query = { performanceCaseId: id };
      if (evidenceType) query.evidenceType = evidenceType;
      if (platform) query.platform = platform;

      const evidence = await PerformanceEvidence.find(query)
        .populate('uploadedBy', 'fullName email')
        .sort({ createdAt: -1 });

      res.json(successResponse(
        'Evidence retrieved successfully',
        { evidence }
      ));

    } catch (error) {
      logError('Get evidence failed', { error: error.message, performanceCaseId: id });
      res.status(500).json(errorResponse('Failed to retrieve evidence', null, 500));
    }
  }
);

/**
 * Delete evidence file
 * DELETE /api/v1/performance/evidence/:evidenceId
 */
router.delete('/evidence/:evidenceId',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: Joi.object({
      evidenceId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    })
  }),
  async (req, res) => {
    const { evidenceId } = req.params;
    const userId = req.user.id;          // FIXED: Changed from userId to id

    try {
      const getModels = () => {
        try {
          return require('./model');
        } catch (error) {
          return {};
        }
      };

      const { PerformanceCase, PerformanceEvidence } = getModels();
      const fs = require('fs');

      if (!PerformanceCase || !PerformanceEvidence) {
        return res.status(503).json(errorResponse('Performance models not available', null, 503));
      }

      const evidence = await PerformanceEvidence.findById(evidenceId);
      if (!evidence) {
        return res.status(404).json(errorResponse('Evidence not found', null, 404));
      }

      // Check access
      const performanceCase = await PerformanceCase.findById(evidence.performanceCaseId);
      const hasAccess = await performanceCase.hasUserAccess(userId, 'edit') || 
                        evidence.uploadedBy.toString() === userId.toString();
      
      if (!hasAccess) {
        return res.status(403).json(errorResponse('Access denied', null, 403));
      }

      // Delete physical file
      if (evidence.fileInfo.filePath && fs.existsSync(evidence.fileInfo.filePath)) {
        fs.unlinkSync(evidence.fileInfo.filePath);
      }

      // Update performance case checklist
      const evidenceType = evidence.evidenceType;
      if (performanceCase.evidenceCollection.checklist[evidenceType]) {
        performanceCase.evidenceCollection.checklist[evidenceType].fileCount -= 1;
        if (performanceCase.evidenceCollection.checklist[evidenceType].fileCount <= 0) {
          performanceCase.evidenceCollection.checklist[evidenceType].collected = false;
          performanceCase.evidenceCollection.checklist[evidenceType].fileCount = 0;
        }
      }

      performanceCase.evidenceCollection.totalFilesUploaded -= 1;
      performanceCase.evidenceCollection.lastUpdated = new Date();
      await performanceCase.save();

      // Delete evidence record
      await PerformanceEvidence.findByIdAndDelete(evidenceId);

      logInfo('Evidence deleted', { evidenceId, performanceCaseId: performanceCase._id, userId });

      res.json(successResponse('Evidence deleted successfully'));

    } catch (error) {
      logError('Delete evidence failed', { error: error.message, evidenceId });
      res.status(500).json(errorResponse('Failed to delete evidence', null, 500));
    }
  }
);

/**
 * Archive (soft delete) performance case
 * DELETE /api/v1/performance/cases/:id
 */
router.delete('/cases/:id',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: Joi.object({
      id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    })
  }),
  performanceController.archivePerformanceCase
);

// ============================================
// AI ANALYSIS ROUTES
// ============================================

/**
 * Trigger AI analysis for performance case
 * POST /api/v1/performance/cases/:id/analyze
 */
router.post('/cases/:id/analyze',
  authenticateUser,
  authorizeSubscription(AI_ANALYSIS_TIERS),
  validateRequest({
    params: Joi.object({
      id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    })
  }),
  ...performanceController.triggerAIAnalysis // Spread array of middleware
);

/**
 * Get AI analysis results
 * GET /api/v1/performance/cases/:id/analysis
 */
router.get('/cases/:id/analysis',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(AI_ANALYSIS_TIERS),
  validateRequest({
    params: Joi.object({
      id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    })
  }),
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;          // FIXED: Changed from userId to id

    try {
      const getModels = () => {
        try {
          return require('./model');
        } catch (error) {
          return {};
        }
      };

      const { PerformanceCase, PerformanceAnalysis } = getModels();
      
      if (!PerformanceCase || !PerformanceAnalysis) {
        return res.status(503).json(errorResponse('Performance models not available', null, 503));
      }

      const performanceCase = await PerformanceCase.findById(id);
      if (!performanceCase) {
        return res.status(404).json(errorResponse('Performance case not found', null, 404));
      }

      const hasAccess = await performanceCase.hasUserAccess(userId, 'view');
      if (!hasAccess) {
        return res.status(403).json(errorResponse('Access denied', null, 403));
      }

      const analysis = await PerformanceAnalysis.findOne({ performanceCaseId: id });
      if (!analysis) {
        return res.status(404).json(errorResponse('Analysis not found. Please run analysis first.', null, 404));
      }

      res.json(successResponse(
        'Analysis retrieved successfully',
        { analysis }
      ));

    } catch (error) {
      logError('Get analysis failed', { error: error.message, performanceCaseId: id });
      res.status(500).json(errorResponse('Failed to retrieve analysis', null, 500));
    }
  }
);

// ============================================
// REPORT GENERATION ROUTES
// ============================================

/**
 * Generate performance report
 * POST /api/v1/performance/cases/:id/reports
 */
router.post('/cases/:id/reports',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: Joi.object({
      id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    })
  }),
  performanceController.generateReport
);

/**
 * Get all reports for performance case
 * GET /api/v1/performance/cases/:id/reports
 */
router.get('/cases/:id/reports',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: Joi.object({
      id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    })
  }),
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;          // FIXED: Changed from userId to id

    try {
      const getModels = () => {
        try {
          return require('./model');
        } catch (error) {
          return {};
        }
      };

      const { PerformanceCase, PerformanceReport } = getModels();
      
      if (!PerformanceCase || !PerformanceReport) {
        return res.status(503).json(errorResponse('Performance models not available', null, 503));
      }

      const performanceCase = await PerformanceCase.findById(id);
      if (!performanceCase) {
        return res.status(404).json(errorResponse('Performance case not found', null, 404));
      }

      const hasAccess = await performanceCase.hasUserAccess(userId, 'view');
      if (!hasAccess) {
        return res.status(403).json(errorResponse('Access denied', null, 403));
      }

      const reports = await PerformanceReport.find({ performanceCaseId: id })
        .populate('generatedBy', 'fullName email')
        .sort({ createdAt: -1 });

      res.json(successResponse(
        'Reports retrieved successfully',
        { reports }
      ));

    } catch (error) {
      logError('Get reports failed', { error: error.message, performanceCaseId: id });
      res.status(500).json(errorResponse('Failed to retrieve reports', null, 500));
    }
  }
);

/**
 * Download performance report
 * GET /api/v1/performance/reports/:reportId/download
 */
router.get('/reports/:reportId/download',
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: Joi.object({
      reportId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    })
  }),
  performanceController.downloadReport
);

/**
 * Send report to client via email
 * POST /api/v1/performance/reports/:reportId/send
 */
router.post('/reports/:reportId/send',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: Joi.object({
      reportId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    }),
    body: Joi.object({
      clientEmail: Joi.string().email().required(),
      subject: Joi.string().max(200).optional(),
      message: Joi.string().max(1000).optional()
    })
  }),
  performanceController.sendReportToClient
);

// ============================================
// SETTINGS ROUTES
// ============================================

/**
 * Get user performance settings
 * GET /api/v1/performance/settings
 */
router.get('/settings',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  performanceController.getSettings
);

/**
 * Update user performance settings
 * PUT /api/v1/performance/settings
 */
router.put('/settings',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  performanceController.updateSettings
);

// ============================================
// ANALYTICS & DASHBOARD ROUTES
// ============================================

/**
 * Get performance analytics dashboard
 * GET /api/v1/performance/analytics
 */
router.get('/analytics',
  performanceController.rateLimiters.standard,
  authenticateUser,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    query: Joi.object({
      period: Joi.string().valid('7d', '30d', '90d').optional(),
      platform: Joi.string().valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'snapchat').optional()
    })
  }),
  performanceController.getAnalytics
);

// ============================================
// UTILITY ROUTES
// ============================================

/**
 * Get performance module health check
 * GET /api/v1/performance/health
 */
router.get('/health', (req, res) => {
  res.json(successResponse(
    'Performance module is healthy',
    {
      module: 'performance',
      version: '1.0.1',
      status: 'active',
      features: {
        performanceTracking: true,
        aiAnalysis: !!process.env.OPENAI_API_KEY,
        reportGeneration: true,
        clientCommunication: true,
        analytics: true
      },
      supportedFileTypes: ['JPG', 'PNG', 'WEBP', 'PDF', 'TXT', 'DOC', 'DOCX'],
      maxFileSize: '10MB',
      maxFilesPerUpload: 5,
      timestamp: new Date()
    }
  ));
});

/**
 * Get module documentation
 * GET /api/v1/performance/docs
 */
router.get('/docs', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}/api/v1/performance`;
  
  res.json(successResponse(
    'Performance module documentation',
    {
      module: 'performance',
      description: 'Client deliverable and business performance tracking system',
      version: '1.0.1',
      baseUrl,
      
      authentication: {
        type: 'Bearer Token (JWT)',
        header: 'Authorization: Bearer <token>',
        required: true
      },
      
      subscriptionTiers: {
        starter: ['Basic performance tracking', 'Evidence collection'],
        pro: ['AI analysis', 'Professional reports', 'Advanced metrics'],
        elite: ['Branded reports', 'Advanced analytics', 'Performance insights'],
        agency: ['White-label reports', 'Multi-creator dashboard', 'Consolidated analytics']
      },
      
      endpoints: {
        cases: `${baseUrl}/cases`,
        evidence: `${baseUrl}/cases/:id/evidence`,
        analysis: `${baseUrl}/cases/:id/analyze`,
        reports: `${baseUrl}/cases/:id/reports`,
        settings: `${baseUrl}/settings`,
        analytics: `${baseUrl}/analytics`
      },
      
      fileUpload: {
        supportedTypes: ['JPG', 'PNG', 'WEBP', 'PDF', 'TXT', 'DOC', 'DOCX'],
        maxSize: '10MB per file',
        maxFiles: '5 files per upload',
        endpoint: `${baseUrl}/cases/:id/evidence`
      },
      
      rateLimits: {
        standard: '100 requests per 15 minutes',
        upload: '20 uploads per 15 minutes',
        aiAnalysis: '10 requests per hour'
      }
    }
  ));
});

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Handle 404 for undefined performance routes
 */
router.use('*', (req, res) => {
  res.status(404).json(errorResponse(
    'Performance endpoint not found',
    {
      availableEndpoints: [
        'GET /cases - List performance cases',
        'POST /cases - Create performance case', 
        'GET /cases/:id - Get performance case',
        'PUT /cases/:id - Update performance case',
        'POST /cases/:id/evidence - Upload evidence',
        'POST /cases/:id/analyze - Trigger AI analysis',
        'POST /cases/:id/reports - Generate report',
        'GET /analytics - Get analytics',
        'GET /settings - Get settings',
        'GET /health - Health check'
      ]
    },
    404
  ));
});

/**
 * Performance module error handler
 */
router.use((error, req, res, next) => {
  logError('Performance module error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id                 // FIXED: Changed from userId to id
  });

  // Handle multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(errorResponse(
      'File too large. Maximum size is 10MB per file.',
      { code: 'FILE_TOO_LARGE' },
      400
    ));
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json(errorResponse(
      'Too many files. Maximum 5 files per upload.',
      { code: 'TOO_MANY_FILES' },
      400
    ));
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json(errorResponse(
      'Validation failed',
      { errors: Object.values(error.errors).map(e => e.message) },
      400
    ));
  }

  // Handle AI service errors
  if (error.message.includes('OpenAI') || error.message.includes('AI analysis')) {
    return res.status(503).json(errorResponse(
      'AI analysis service temporarily unavailable',
      { code: 'AI_SERVICE_ERROR' },
      503
    ));
  }

  // Default error response
  res.status(error.statusCode || 500).json(errorResponse(
    process.env.NODE_ENV === 'production' 
      ? 'An error occurred processing your request'
      : error.message,
    { code: error.code || 'INTERNAL_ERROR' },
    error.statusCode || 500
  ));
});

module.exports = router;