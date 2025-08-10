/**
 * CreatorsMantra Backend - Rate Card Routes
 * API endpoints for rate card management
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const RateCardController = require('./controller');
const { 
    authenticateUser: authenticateToken,
    authorizeSubscription 
  } = require('../../shared/middleware');
const { validateRequest } = require('../../shared/middleware');
const { 
  createRateCardSchema,
  updateRateCardSchema,
  createPackageSchema,
  updatePackageSchema,
  aiSuggestionsSchema,
  shareOptionsSchema,
  bulkUpdateSchema
} = require('./validation');
const { rateLimit } = require('../../shared/rateLimiter');

// Rate limiting configurations
const standardLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const pdfLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const aiLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });

// ============= PUBLIC ROUTES (No Auth Required) =============

// Get public rate card by short code
router.get('/public/:shortCode',
  standardLimit,
  RateCardController.getPublicRateCard
);

// ============= AUTHENTICATED ROUTES =============

// Create new rate card
router.post('/',
  authenticateToken,
  standardLimit,
  validateRequest(createRateCardSchema),
  RateCardController.createRateCard
);

// Get all rate cards for creator
router.get('/',
  authenticateToken,
  standardLimit,
  RateCardController.getRateCards
);

// Get rate card templates
router.get('/templates',
  authenticateToken,
  standardLimit,
  RateCardController.getTemplates
);

// Generate AI pricing suggestions (Pro/Elite only)
router.post('/ai-suggestions',
  authenticateToken,
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']),
  aiLimit,
  validateRequest(aiSuggestionsSchema),
  RateCardController.generateAISuggestions
);

// Bulk update rates (Pro/Elite only)
router.post('/bulk-update',
  authenticateToken,
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']),
  standardLimit,
  validateRequest(bulkUpdateSchema),
  RateCardController.bulkUpdateRates
);

// Get single rate card
router.get('/:id',
  authenticateToken,
  standardLimit,
  RateCardController.getRateCard
);

// Update rate card
router.put('/:id',
  authenticateToken,
  standardLimit,
  validateRequest(updateRateCardSchema),
  RateCardController.updateRateCard
);

// Delete rate card
router.delete('/:id',
  authenticateToken,
  standardLimit,
  RateCardController.deleteRateCard
);

// Clone rate card
router.post('/:id/clone',
  authenticateToken,
  standardLimit,
  RateCardController.cloneRateCard
);

// Save as template
router.post('/:id/save-as-template',
  authenticateToken,
  standardLimit,
  RateCardController.saveAsTemplate
);

// ============= PACKAGE MANAGEMENT =============

// Create package
router.post('/:id/packages',
  authenticateToken,
  standardLimit,
  validateRequest(createPackageSchema),
  RateCardController.createPackage
);

// Update package
router.put('/:id/packages/:packageId',
  authenticateToken,
  standardLimit,
  validateRequest(updatePackageSchema),
  RateCardController.updatePackage
);

// Delete package
router.delete('/:id/packages/:packageId',
  authenticateToken,
  standardLimit,
  RateCardController.deletePackage
);

// ============= PDF GENERATION =============

// Generate PDF
router.get('/:id/pdf',
  authenticateToken,
  pdfLimit,
  RateCardController.generatePDF
);

// ============= SHARING =============

// Share rate card
router.post('/:id/share',
  authenticateToken,
  standardLimit,
  validateRequest(shareOptionsSchema),
  RateCardController.shareRateCard
);

// ============= ANALYTICS (Elite only) =============

// Get analytics
router.get('/:id/analytics',
  authenticateToken,
  authorizeSubscription(['elite', 'agency_starter', 'agency_pro']),
  standardLimit,
  RateCardController.getAnalytics
);

// ============= VERSION CONTROL =============

// Get version history
router.get('/:id/versions',
  authenticateToken,
  standardLimit,
  RateCardController.getVersionHistory
);

// Restore version
router.post('/:id/restore-version',
  authenticateToken,
  standardLimit,
  RateCardController.restoreVersion
);

module.exports = router;