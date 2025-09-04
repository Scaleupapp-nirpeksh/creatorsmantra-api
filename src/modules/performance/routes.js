/**
 * CreatorsMantra Backend - Performance Module Routes
 * Complete routing for performance tracking, AI analysis, and client reporting
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Express routes for performance management functionality
 */

const express = require('express');
const performanceController = require('./controller');
const { 
  authenticateUser, 
  authorizeSubscription,
  validateRequest,
  parseMultipartJson
} = require('../../shared/middleware');
const { logInfo, logError } = require('../../shared/utils');

const router = express.Router();

// ============================================
// MIDDLEWARE SETUP
// ============================================

// All performance routes require authentication
router.use(authenticateUser);

// Log all performance API calls
router.use((req, res, next) => {
  logInfo('Performance API call', {
    method: req.method,
    path: req.path,
    userId: req.user?.userId,
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
const WHITE_LABEL_TIERS = ['agency_starter', 'agency_pro'];

// ============================================
// PERFORMANCE CASE ROUTES
// ============================================

/**
 * Create new performance case
 * POST /api/v1/performance/cases
 * 
 * Access: All subscription tiers
 * Description: Create performance case from completed deal
 * 
 * Body:
 * - dealId (required): MongoDB ObjectId of completed deal
 * - priority (optional): low|medium|high|urgent
 * - notes (optional): Object with creatorNotes, managerNotes, internalNotes
 * - tags (optional): Array of strings (max 10)
 * 
 * Response: Created performance case with initial status and evidence checklist
 */
router.post('/cases',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  performanceController.createPerformanceCase
);

/**
 * Get all performance cases for user
 * GET /api/v1/performance/cases
 * 
 * Access: All subscription tiers
 * Description: List performance cases with filtering, pagination, and sorting
 * 
 * Query Parameters:
 * - status (optional): Filter by case status
 * - priority (optional): Filter by priority level
 * - page (optional): Page number (default: 1)
 * - limit (optional): Cases per page (default: 20, max: 100)
 * - sortBy (optional): Sort field (default: createdAt)
 * - sortOrder (optional): asc|desc (default: desc)
 * 
 * Response: Paginated list of performance cases with summary data
 */
router.get('/cases',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  performanceController.getPerformanceCases
);

/**
 * Get single performance case with all related data
 * GET /api/v1/performance/cases/:id
 * 
 * Access: All subscription tiers (creator or assigned manager)
 * Description: Get complete performance case data including evidence, analysis, and reports
 * 
 * Path Parameters:
 * - id: Performance case MongoDB ObjectId
 * 
 * Response: Complete performance case with evidence files, AI analysis, and generated reports
 */
router.get('/cases/:id',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: {
      id: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    }
  }),
  performanceController.getPerformanceCase
);

/**
 * Update performance case
 * PUT /api/v1/performance/cases/:id
 * 
 * Access: Creator or manager with edit permissions
 * Description: Update case status, notes, business intelligence data
 * 
 * Path Parameters:
 * - id: Performance case MongoDB ObjectId
 * 
 * Body:
 * - status (optional): Update case status
 * - priority (optional): Update priority level
 * - notes (optional): Update notes sections
 * - businessIntelligence (optional): Update BI data
 * 
 * Response: Updated performance case
 */
router.put('/cases/:id',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: {
      id: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    }
  }),
  performanceController.updatePerformanceCase
);

/**
 * Archive (soft delete) performance case
 * DELETE /api/v1/performance/cases/:id
 * 
 * Access: Creator or manager with edit permissions
 * Description: Archive performance case (moves to archived status)
 * 
 * Path Parameters:
 * - id: Performance case MongoDB ObjectId
 * 
 * Response: Success confirmation
 */
router.delete('/cases/:id',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: {
      id: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    }
  }),
  performanceController.archivePerformanceCase
);

// ============================================
// EVIDENCE UPLOAD ROUTES
// ============================================

/**
 * Upload evidence files for performance case
 * POST /api/v1/performance/cases/:id/evidence
 * 
 * Access: Creator or manager with edit permissions
 * Description: Upload performance evidence (screenshots, feedback, deliverables)
 * 
 * Path Parameters:
 * - id: Performance case MongoDB ObjectId
 * 
 * Body (multipart/form-data):
 * - files: Array of files (max 5 files, 10MB each)
 * - evidenceType: content_screenshot|analytics_screenshot|brand_feedback|testimonial|additional_deliverable|custom
 * - relatedDeliverableId (optional): Link to specific deliverable
 * - platform (optional): Platform where content was posted
 * - description (optional): Evidence description
 * - contentUrl (optional): URL to published content
 * - extractedMetrics (optional): Manual metric entry
 * - tags (optional): Evidence tags
 * 
 * File Types: JPG, PNG, WEBP, PDF, TXT, DOC, DOCX
 * File Size: Max 10MB per file
 * 
 * Response: Created evidence records and updated performance case status
 */
router.post('/cases/:id/evidence',
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: {
      id: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    }
  }),
  parseMultipartJson, // Parse JSON fields in multipart request
  ...performanceController.uploadEvidence // Array of middleware including upload handling
);

/**
 * Get evidence files for performance case
 * GET /api/v1/performance/cases/:id/evidence
 * 
 * Access: Creator or manager with view permissions
 * Description: List all evidence files for a performance case
 * 
 * Path Parameters:
 * - id: Performance case MongoDB ObjectId
 * 
 * Query Parameters:
 * - evidenceType (optional): Filter by evidence type
 * - platform (optional): Filter by platform
 * 
 * Response: List of evidence files with metadata and extraction status
 */
router.get('/cases/:id/evidence',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: {
      id: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    }
  }),
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const { evidenceType, platform } = req.query;

    try {
      const { PerformanceCase, PerformanceEvidence } = require('./model');
      
      // Check access to performance case
      const performanceCase = await PerformanceCase.findById(id);
      if (!performanceCase) {
        return res.status(404).json({ success: false, message: 'Performance case not found' });
      }

      const hasAccess = await performanceCase.hasUserAccess(userId, 'view');
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Build query
      const query = { performanceCaseId: id };
      if (evidenceType) query.evidenceType = evidenceType;
      if (platform) query.platform = platform;

      const evidence = await PerformanceEvidence.find(query)
        .populate('uploadedBy', 'fullName email')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        message: 'Evidence retrieved successfully',
        data: { evidence }
      });

    } catch (error) {
      logError('Get evidence failed', { error: error.message, performanceCaseId: id });
      res.status(500).json({ success: false, message: 'Failed to retrieve evidence' });
    }
  }
);

/**
 * Delete evidence file
 * DELETE /api/v1/performance/evidence/:evidenceId
 * 
 * Access: Creator or uploader of the evidence
 * Description: Delete evidence file and update case checklist
 * 
 * Path Parameters:
 * - evidenceId: Evidence MongoDB ObjectId
 * 
 * Response: Success confirmation
 */
router.delete('/evidence/:evidenceId',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: {
      evidenceId: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    }
  }),
  async (req, res) => {
    const { evidenceId } = req.params;
    const userId = req.user.userId;

    try {
      const { PerformanceCase, PerformanceEvidence } = require('./model');
      const fs = require('fs');

      const evidence = await PerformanceEvidence.findById(evidenceId);
      if (!evidence) {
        return res.status(404).json({ success: false, message: 'Evidence not found' });
      }

      // Check access
      const performanceCase = await PerformanceCase.findById(evidence.performanceCaseId);
      const hasAccess = await performanceCase.hasUserAccess(userId, 'edit') || 
                        evidence.uploadedBy.toString() === userId.toString();
      
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Delete physical file
      if (fs.existsSync(evidence.fileInfo.filePath)) {
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

      res.json({ success: true, message: 'Evidence deleted successfully' });

    } catch (error) {
      logError('Delete evidence failed', { error: error.message, evidenceId });
      res.status(500).json({ success: false, message: 'Failed to delete evidence' });
    }
  }
);

// ============================================
// AI ANALYSIS ROUTES
// ============================================

/**
 * Trigger AI analysis for performance case
 * POST /api/v1/performance/cases/:id/analyze
 * 
 * Access: Pro, Elite, Agency tiers only
 * Rate Limit: 10 requests per hour
 * Description: Start AI-powered performance analysis using uploaded evidence
 * 
 * Path Parameters:
 * - id: Performance case MongoDB ObjectId
 * 
 * Prerequisites:
 * - At least 50% evidence collection completion
 * - Analytics screenshots uploaded
 * 
 * Response: Analysis started confirmation (async processing)
 */
router.post('/cases/:id/analyze',
  authorizeSubscription(AI_ANALYSIS_TIERS),
  validateRequest({
    params: {
      id: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    }
  }),
  performanceController.triggerAIAnalysis
);

/**
 * Get AI analysis results
 * GET /api/v1/performance/cases/:id/analysis
 * 
 * Access: Pro, Elite, Agency tiers only
 * Description: Get complete AI analysis results and insights
 * 
 * Path Parameters:
 * - id: Performance case MongoDB ObjectId
 * 
 * Response: Complete AI analysis with performance comparison, insights, and predictions
 */
router.get('/cases/:id/analysis',
  performanceController.rateLimiters.standard,
  authorizeSubscription(AI_ANALYSIS_TIERS),
  validateRequest({
    params: {
      id: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    }
  }),
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
      const { PerformanceCase, PerformanceAnalysis } = require('./model');
      
      const performanceCase = await PerformanceCase.findById(id);
      if (!performanceCase) {
        return res.status(404).json({ success: false, message: 'Performance case not found' });
      }

      const hasAccess = await performanceCase.hasUserAccess(userId, 'view');
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const analysis = await PerformanceAnalysis.findOne({ performanceCaseId: id });
      if (!analysis) {
        return res.status(404).json({ success: false, message: 'Analysis not found. Please run analysis first.' });
      }

      res.json({
        success: true,
        message: 'Analysis retrieved successfully',
        data: { analysis }
      });

    } catch (error) {
      logError('Get analysis failed', { error: error.message, performanceCaseId: id });
      res.status(500).json({ success: false, message: 'Failed to retrieve analysis' });
    }
  }
);

/**
 * Regenerate AI analysis
 * PUT /api/v1/performance/cases/:id/analyze
 * 
 * Access: Pro, Elite, Agency tiers only
 * Rate Limit: 10 requests per hour
 * Description: Regenerate AI analysis with updated evidence
 * 
 * Path Parameters:
 * - id: Performance case MongoDB ObjectId
 * 
 * Response: Analysis regeneration started confirmation
 */
router.put('/cases/:id/analyze',
  authorizeSubscription(AI_ANALYSIS_TIERS),
  validateRequest({
    params: {
      id: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    }
  }),
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
      const { PerformanceCase, PerformanceAnalysis } = require('./model');
      
      const performanceCase = await PerformanceCase.findById(id);
      if (!performanceCase) {
        return res.status(404).json({ success: false, message: 'Performance case not found' });
      }

      const hasAccess = await performanceCase.hasUserAccess(userId, 'view');
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Update regeneration count
      let analysis = await PerformanceAnalysis.findOne({ performanceCaseId: id });
      if (analysis) {
        analysis.regenerationCount += 1;
        analysis.lastRegeneratedAt = new Date();
        await analysis.save();
      }

      // Start regeneration (async)
      performanceController.PerformanceService.performAIAnalysis(id).catch(error => {
        logError('AI analysis regeneration failed', { error: error.message, performanceCaseId: id });
      });

      performanceCase.status = 'ai_processing';
      await performanceCase.save();

      res.json({
        success: true,
        message: 'Analysis regeneration started successfully',
        data: {
          performanceCase: {
            id: performanceCase._id,
            status: performanceCase.status
          }
        }
      });

    } catch (error) {
      logError('Regenerate analysis failed', { error: error.message, performanceCaseId: id });
      res.status(500).json({ success: false, message: 'Failed to regenerate analysis' });
    }
  }
);

// ============================================
// REPORT GENERATION ROUTES
// ============================================

/**
 * Generate performance report
 * POST /api/v1/performance/cases/:id/reports
 * 
 * Access: All tiers (template restrictions apply)
 * Description: Generate PDF performance report for client delivery
 * 
 * Path Parameters:
 * - id: Performance case MongoDB ObjectId
 * 
 * Body:
 * - template (required): basic|professional|detailed|branded|white_label
 * - branding (optional): Custom branding options
 * - includeMetrics (optional): Array of metrics to include
 * - customSections (optional): Additional report sections
 * 
 * Template Access:
 * - basic, professional: All tiers
 * - detailed: Pro+ tiers
 * - branded: Elite+ tiers
 * - white_label: Agency tiers only
 * 
 * Response: Generated report with download URL
 */
router.post('/cases/:id/reports',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: {
      id: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    }
  }),
  performanceController.generateReport
);

/**
 * Get all reports for performance case
 * GET /api/v1/performance/cases/:id/reports
 * 
 * Access: Creator or manager with view permissions
 * Description: List all generated reports for a performance case
 * 
 * Path Parameters:
 * - id: Performance case MongoDB ObjectId
 * 
 * Response: List of reports with metadata and download URLs
 */
router.get('/cases/:id/reports',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: {
      id: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    }
  }),
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
      const { PerformanceCase, PerformanceReport } = require('./model');
      
      const performanceCase = await PerformanceCase.findById(id);
      if (!performanceCase) {
        return res.status(404).json({ success: false, message: 'Performance case not found' });
      }

      const hasAccess = await performanceCase.hasUserAccess(userId, 'view');
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const reports = await PerformanceReport.find({ performanceCaseId: id })
        .populate('generatedBy', 'fullName email')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        message: 'Reports retrieved successfully',
        data: { reports }
      });

    } catch (error) {
      logError('Get reports failed', { error: error.message, performanceCaseId: id });
      res.status(500).json({ success: false, message: 'Failed to retrieve reports' });
    }
  }
);

/**
 * Download performance report
 * GET /api/v1/performance/reports/:reportId/download
 * 
 * Access: Creator, manager, or public (if shared)
 * Description: Download PDF report file
 * 
 * Path Parameters:
 * - reportId: Report MongoDB ObjectId
 * 
 * Response: PDF file download
 */
router.get('/reports/:reportId/download',
  // Note: No rate limit for downloads to allow smooth user experience
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: {
      reportId: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    }
  }),
  performanceController.downloadReport
);

/**
 * Send report to client via email
 * POST /api/v1/performance/reports/:reportId/send
 * 
 * Access: Creator or manager with communication permissions
 * Description: Email performance report to client
 * 
 * Path Parameters:
 * - reportId: Report MongoDB ObjectId
 * 
 * Body:
 * - clientEmail (required): Client email address
 * - subject (optional): Email subject line
 * - message (optional): Additional message to client
 * 
 * Response: Email sent confirmation
 */
router.post('/reports/:reportId/send',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: {
      reportId: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    },
    body: {
      clientEmail: require('joi').string().email().required(),
      subject: require('joi').string().max(200).optional(),
      message: require('joi').string().max(1000).optional()
    }
  }),
  performanceController.sendReportToClient
);

/**
 * Share report publicly
 * POST /api/v1/performance/reports/:reportId/share
 * 
 * Access: Creator or manager
 * Description: Generate public sharing link for report
 * 
 * Path Parameters:
 * - reportId: Report MongoDB ObjectId
 * 
 * Body:
 * - isPublic (required): Enable/disable public sharing
 * - password (optional): Password protect the shared link
 * - expiresAt (optional): Link expiration date
 * 
 * Response: Public sharing URL and settings
 */
router.post('/reports/:reportId/share',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    params: {
      reportId: require('joi').string().regex(/^[0-9a-fA-F]{24}$/).required()
    },
    body: {
      isPublic: require('joi').boolean().required(),
      password: require('joi').string().min(6).optional(),
      expiresAt: require('joi').date().optional()
    }
  }),
  async (req, res) => {
    const { reportId } = req.params;
    const userId = req.user.userId;
    const { isPublic, password, expiresAt } = req.body;

    try {
      const { PerformanceReport } = require('./model');
      const crypto = require('crypto');
      
      const report = await PerformanceReport.findById(reportId)
        .populate({
          path: 'performanceCaseId',
          select: 'creatorId managerId'
        });

      if (!report) {
        return res.status(404).json({ success: false, message: 'Report not found' });
      }

      // Check access
      const performanceCase = report.performanceCaseId;
      const hasAccess = await performanceCase.hasUserAccess(userId, 'generate_report');
      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Update sharing settings
      report.sharing.isPublic = isPublic;
      
      if (isPublic) {
        if (!report.sharing.publicUrl) {
          report.sharing.publicUrl = crypto.randomBytes(32).toString('hex');
        }
        if (password) {
          report.sharing.password = password; // In production, hash this
        }
        if (expiresAt) {
          report.sharing.expiresAt = new Date(expiresAt);
        }
      } else {
        report.sharing.publicUrl = null;
        report.sharing.password = null;
        report.sharing.expiresAt = null;
      }

      await report.save();

      const publicUrl = isPublic ? 
        `${req.protocol}://${req.get('host')}/public/reports/${report.sharing.publicUrl}` : null;

      res.json({
        success: true,
        message: 'Report sharing updated successfully',
        data: {
          sharing: {
            isPublic,
            publicUrl,
            hasPassword: !!password,
            expiresAt: report.sharing.expiresAt
          }
        }
      });

    } catch (error) {
      logError('Report sharing failed', { error: error.message, reportId });
      res.status(500).json({ success: false, message: 'Failed to update sharing settings' });
    }
  }
);

// ============================================
// SETTINGS ROUTES
// ============================================

/**
 * Get user performance settings
 * GET /api/v1/performance/settings
 * 
 * Access: All subscription tiers
 * Description: Get user's performance module preferences and settings
 * 
 * Response: Complete settings configuration
 */
router.get('/settings',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  performanceController.getSettings
);

/**
 * Update user performance settings
 * PUT /api/v1/performance/settings
 * 
 * Access: All subscription tiers
 * Description: Update performance module preferences and settings
 * 
 * Body:
 * - defaultReportSettings (optional): Default report generation preferences
 * - brandingSettings (optional): Custom branding options
 * - notifications (optional): Notification preferences
 * - integrations (optional): Integration settings
 * 
 * Response: Updated settings
 */
router.put('/settings',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  performanceController.updateSettings
);

/**
 * Upload brand logo for reports
 * POST /api/v1/performance/settings/logo
 * 
 * Access: Elite+ tiers (for branded reports)
 * Description: Upload custom logo for branded performance reports
 * 
 * Body (multipart/form-data):
 * - logo: Image file (JPG, PNG, SVG)
 * 
 * File Size: Max 2MB
 * Dimensions: Recommended 300x100px
 * 
 * Response: Updated logo URL
 */
router.post('/settings/logo',
  performanceController.rateLimiters.upload,
  authorizeSubscription(ADVANCED_REPORTS_TIERS),
  require('multer')({
    storage: require('multer').memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
      if (['image/jpeg', 'image/png', 'image/svg+xml'].includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPG, PNG, SVG allowed.'), false);
      }
    }
  }).single('logo'),
  async (req, res) => {
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No logo file uploaded' });
    }

    try {
      const { PerformanceSettings } = require('./model');
      const path = require('path');
      const fs = require('fs');

      // Save file
      const fileName = `logo_${userId}_${Date.now()}${path.extname(req.file.originalname)}`;
      const filePath = path.join(__dirname, '../../../uploads/performance/logos', fileName);
      
      // Ensure directory exists
      const logoDir = path.dirname(filePath);
      if (!fs.existsSync(logoDir)) {
        fs.mkdirSync(logoDir, { recursive: true });
      }

      fs.writeFileSync(filePath, req.file.buffer);

      // Update settings
      let settings = await PerformanceSettings.findOne({ userId });
      if (!settings) {
        settings = await PerformanceSettings.create({ userId });
      }

      settings.brandingSettings.logo = {
        url: `/api/v1/performance/logos/${fileName}`,
        fileName,
        uploadedAt: new Date()
      };

      await settings.save();

      logInfo('Brand logo uploaded', { userId, fileName });

      res.json({
        success: true,
        message: 'Logo uploaded successfully',
        data: {
          logo: settings.brandingSettings.logo
        }
      });

    } catch (error) {
      logError('Logo upload failed', { error: error.message, userId });
      res.status(500).json({ success: false, message: 'Failed to upload logo' });
    }
  }
);

/**
 * Serve brand logo files
 * GET /api/v1/performance/logos/:fileName
 */
router.get('/logos/:fileName',
  (req, res) => {
    const { fileName } = req.params;
    const filePath = path.join(__dirname, '../../../uploads/performance/logos', fileName);
    
    if (fs.existsSync(filePath)) {
      res.sendFile(path.resolve(filePath));
    } else {
      res.status(404).json({ success: false, message: 'Logo not found' });
    }
  }
);

// ============================================
// ANALYTICS & DASHBOARD ROUTES
// ============================================

/**
 * Get performance analytics dashboard
 * GET /api/v1/performance/analytics
 * 
 * Access: All subscription tiers
 * Description: Get performance analytics and dashboard data
 * 
 * Query Parameters:
 * - period (optional): 7d|30d|90d (default: 30d)
 * - platform (optional): Filter by platform
 * 
 * Response: Analytics data with overview stats, trends, and insights
 */
router.get('/analytics',
  performanceController.rateLimiters.standard,
  authorizeSubscription(BASIC_PERFORMANCE_TIERS),
  validateRequest({
    query: {
      period: require('joi').string().valid('7d', '30d', '90d').optional(),
      platform: require('joi').string().valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'snapchat').optional()
    }
  }),
  performanceController.getAnalytics
);

/**
 * Get performance insights (Elite+ feature)
 * GET /api/v1/performance/insights
 * 
 * Access: Elite, Agency tiers only
 * Description: Get AI-powered performance insights and recommendations
 * 
 * Query Parameters:
 * - period (optional): Analysis period
 * - compareWith (optional): Previous period comparison
 * 
 * Response: Advanced insights, trend analysis, and optimization recommendations
 */
router.get('/insights',
  performanceController.rateLimiters.standard,
  authorizeSubscription(ADVANCED_REPORTS_TIERS),
  async (req, res) => {
    const userId = req.user.userId;
    const { period = '30d', compareWith = 'previous' } = req.query;

    try {
      const { PerformanceCase, PerformanceAnalysis } = require('./model');
      
      // Calculate date ranges
      const now = new Date();
      const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
      
      let compareStartDate, compareEndDate;
      if (compareWith === 'previous') {
        compareStartDate = new Date(startDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
        compareEndDate = startDate;
      }

      // Get current period insights
      const currentInsights = await PerformanceAnalysis.aggregate([
        {
          $lookup: {
            from: 'performancecases',
            localField: 'performanceCaseId',
            foreignField: '_id',
            as: 'performanceCase'
          }
        },
        {
          $match: {
            'performanceCase.creatorId': new (require('mongoose')).Types.ObjectId(userId),
            'performanceCase.createdAt': { $gte: startDate, $lt: now }
          }
        },
        {
          $group: {
            _id: null,
            avgPerformanceScore: { $avg: '$performanceComparison.overallScore' },
            avgConfidence: { $avg: '$aiAnalysis.confidence' },
            totalCases: { $sum: 1 },
            topSuccessFactors: { $push: '$insights.keySuccessFactors' },
            commonImprovements: { $push: '$insights.improvementAreas' },
            avgBusinessMetrics: {
              $avg: '$businessMetrics.repeatCollaborationScore'
            }
          }
        }
      ]);

      // Get comparison data if requested
      let comparisonInsights = null;
      if (compareWith === 'previous' && compareStartDate) {
        comparisonInsights = await PerformanceAnalysis.aggregate([
          {
            $lookup: {
              from: 'performancecases',
              localField: 'performanceCaseId',
              foreignField: '_id',
              as: 'performanceCase'
            }
          },
          {
            $match: {
              'performanceCase.creatorId': new (require('mongoose')).Types.ObjectId(userId),
              'performanceCase.createdAt': { $gte: compareStartDate, $lt: compareEndDate }
            }
          },
          {
            $group: {
              _id: null,
              avgPerformanceScore: { $avg: '$performanceComparison.overallScore' },
              avgConfidence: { $avg: '$aiAnalysis.confidence' },
              totalCases: { $sum: 1 }
            }
          }
        ]);
      }

      const insights = {
        currentPeriod: {
          period,
          startDate,
          endDate: now,
          data: currentInsights[0] || {}
        },
        comparison: comparisonInsights ? {
          period: `Previous ${period}`,
          data: comparisonInsights[0] || {}
        } : null,
        trends: {
          performanceImprovement: comparisonInsights && currentInsights[0] && comparisonInsights[0] ? 
            currentInsights[0].avgPerformanceScore - comparisonInsights[0].avgPerformanceScore : null,
          caseVolumeChange: comparisonInsights && currentInsights[0] && comparisonInsights[0] ? 
            currentInsights[0].totalCases - comparisonInsights[0].totalCases : null
        },
        recommendations: [
          'Focus on content types that consistently exceed performance targets',
          'Optimize posting times based on historical engagement data',
          'Leverage successful collaboration patterns for future deals',
          'Address common improvement areas identified across campaigns'
        ]
      };

      res.json({
        success: true,
        message: 'Performance insights retrieved successfully',
        data: { insights }
      });

    } catch (error) {
      logError('Get insights failed', { error: error.message, userId });
      res.status(500).json({ success: false, message: 'Failed to retrieve insights' });
    }
  }
);

// ============================================
// UTILITY ROUTES
// ============================================

/**
 * Get performance module health check
 * GET /api/v1/performance/health
 * 
 * Access: Public
 * Description: Module health status and feature availability
 */
router.get('/health',
  (req, res) => {
    res.json({
      success: true,
      message: 'Performance module is healthy',
      data: {
        module: 'performance',
        version: '1.0.0',
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
    });
  }
);

/**
 * Get module documentation
 * GET /api/v1/performance/docs
 * 
 * Access: Public
 * Description: API documentation for performance module
 */
router.get('/docs',
  (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}/api/v1/performance`;
    
    res.json({
      success: true,
      message: 'Performance module documentation',
      data: {
        module: 'performance',
        description: 'Client deliverable and business performance tracking system',
        version: '1.0.0',
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
    });
  }
);

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Handle 404 for undefined performance routes
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Performance endpoint not found',
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
  });
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
    userId: req.user?.userId
  });

  // Handle multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 10MB per file.',
      code: 'FILE_TOO_LARGE'
    });
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      message: 'Too many files. Maximum 5 files per upload.',
      code: 'TOO_MANY_FILES'
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(error.errors).map(e => e.message)
    });
  }

  // Handle AI service errors
  if (error.message.includes('OpenAI') || error.message.includes('AI analysis')) {
    return res.status(503).json({
      success: false,
      message: 'AI analysis service temporarily unavailable',
      code: 'AI_SERVICE_ERROR'
    });
  }

  // Default error response
  res.status(error.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'An error occurred processing your request'
      : error.message,
    code: error.code || 'INTERNAL_ERROR'
  });
});

module.exports = router;