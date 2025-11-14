/**
 * CreatorsMantra Backend - Rate Card Routes (v2.0)
 * Complete API endpoints for redesigned rate card management
 *
 * @author CreatorsMantra Team
 * @version 2.0.0
 */

const express = require('express')
const router = express.Router()
const RateCardController = require('./controller')
const {
  authenticateUser: authenticateToken,
  authorizeSubscription,
} = require('../../shared/middleware')

// ============================================
// PUBLIC ROUTES (No Auth Required)
// ============================================

/**
 * Get public rate card by public ID
 * GET /api/ratecards/public/:publicId
 * Headers: x-rate-card-password (optional)
 */
router.get(
  '/public/:publicId',
  RateCardController.rateLimiters.publicAccess,
  RateCardController.getPublicRateCard
)

// ============================================
// AUTHENTICATED ROUTES - BASIC OPERATIONS
// ============================================

/**
 * Create new rate card with AI suggestions
 * POST /api/ratecards
 * Body: { title, description, metrics: { platforms, niche, location, languages, experience } }
 */
router.post(
  '/',
  authenticateToken,
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']),
  RateCardController.rateLimiters.general,
  RateCardController.createRateCard
)

/**
 * Get all rate cards for creator
 * GET /api/ratecards
 * Query: ?status=all|draft|active|archived&page=1&limit=10
 */
router.get(
  '/',
  authenticateToken,
  RateCardController.rateLimiters.general,
  RateCardController.getRateCards
)

/**
 * Get single rate card
 * GET /api/ratecards/:id
 */
router.get(
  '/:id',
  authenticateToken,
  RateCardController.rateLimiters.general,
  RateCardController.getRateCard
)

/**
 * Delete rate card (soft delete)
 * DELETE /api/ratecards/:id
 */
router.delete(
  '/:id',
  authenticateToken,
  RateCardController.rateLimiters.general,
  RateCardController.deleteRateCard
)

// ============================================
// RATE CARD UPDATES
// ============================================

/**
 * Update metrics and regenerate AI pricing
 * PUT /api/ratecards/:id/metrics
 * Body: { platforms: [{ name, metrics: { followers, engagementRate, avgViews, avgLikes } }] }
 */
router.put(
  '/:id/metrics',
  authenticateToken,
  RateCardController.rateLimiters.aiSuggestions,
  RateCardController.updateMetrics
)

/**
 * Update pricing (deliverables)
 * PUT /api/ratecards/:id/pricing
 * Body: { deliverables: [{ platform, rates: [{ type, pricing: { userRate }, turnaroundTime, revisionsIncluded }] }] }
 */
router.put(
  '/:id/pricing',
  authenticateToken,
  RateCardController.rateLimiters.general,
  RateCardController.updatePricing
)

/**
 * Update professional details (terms & conditions)
 * PUT /api/ratecards/:id/professional-details
 * Body: { paymentTerms, usageRights, revisionPolicy, cancellationTerms, additionalNotes }
 */
router.put(
  '/:id/professional-details',
  authenticateToken,
  RateCardController.rateLimiters.general,
  RateCardController.updateProfessionalDetails
)

// ============================================
// PACKAGE MANAGEMENT
// ============================================

/**
 * Create package deal
 * POST /api/ratecards/:id/packages
 * Body: { name, description, items: [{ platform, deliverableType, quantity }], packagePrice, validity }
 */
router.post(
  '/:id/packages',
  authenticateToken,
  RateCardController.rateLimiters.general,
  RateCardController.createPackage
)

/**
 * Update package
 * PUT /api/ratecards/:id/packages/:packageId
 * Body: { name, description, packagePrice, validity, isPopular }
 */
router.put(
  '/:id/packages/:packageId',
  authenticateToken,
  RateCardController.rateLimiters.general,
  RateCardController.updatePackage
)

/**
 * Delete package
 * DELETE /api/ratecards/:id/packages/:packageId
 */
router.delete(
  '/:id/packages/:packageId',
  authenticateToken,
  RateCardController.rateLimiters.general,
  RateCardController.deletePackage
)

// ============================================
// PUBLISHING & SHARING
// ============================================

/**
 * Publish rate card (make it public)
 * POST /api/ratecards/:id/publish
 * Returns: { publicUrl, publicId, qrCode }
 */
router.post(
  '/:id/publish',
  authenticateToken,
  RateCardController.rateLimiters.general,
  RateCardController.publishRateCard
)

/**
 * Update share settings
 * PUT /api/ratecards/:id/share-settings
 * Body: { allowDownload, showContactForm, requirePassword, password, expiryDays }
 */
router.put(
  '/:id/share-settings',
  authenticateToken,
  RateCardController.rateLimiters.general,
  RateCardController.updateShareSettings
)

// ============================================
// EXPORT & DOCUMENTATION
// ============================================

/**
 * Generate PDF
 * GET /api/ratecards/:id/pdf
 * Returns: PDF file stream
 */
router.get(
  '/:id/pdf',
  authenticateToken,
  RateCardController.rateLimiters.pdfGeneration,
  RateCardController.generatePDF
)

// ============================================
// VERSION HISTORY
// ============================================

/**
 * Get rate card history
 * GET /api/ratecards/:id/history
 * Query: ?page=1&limit=20
 */
router.get(
  '/:id/history',
  authenticateToken,
  RateCardController.rateLimiters.general,
  RateCardController.getRateCardHistory
)

/**
 * Restore from history
 * POST /api/ratecards/:id/restore/:historyId
 */
router.post(
  '/:id/restore/:historyId',
  authenticateToken,
  RateCardController.rateLimiters.general,
  RateCardController.restoreFromHistory
)

// ============================================
// ANALYTICS (Elite/Agency Plans Only)
// ============================================

/**
 * Get rate card analytics
 * GET /api/ratecards/:id/analytics
 * Returns: { views, engagement, performance, aiInsights }
 */
router.get(
  '/:id/analytics',
  authenticateToken,
  authorizeSubscription(['elite', 'agency_starter', 'agency_pro']),
  RateCardController.rateLimiters.general,
  RateCardController.getAnalytics
)

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

/**
 * 404 handler for undefined routes
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rate card endpoint not found',
    code: 'RC4404',
    path: req.originalUrl,
  })
})

/**
 * Error handler for rate card routes
 */
router.use((error, req, res, next) => {
  // Log error
  console.error('Rate Card Route Error:', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack,
  })

  // Check if it's our custom AppError
  if (error.code && error.code.startsWith('RC')) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      code: error.code,
      data: error.data || null,
    })
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'RC4000',
      errors: Object.values(error.errors).map((e) => ({
        field: e.path,
        message: e.message,
      })),
    })
  }

  // Handle MongoDB errors
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate entry found',
        code: 'RC4409',
      })
    }
  }

  // Handle rate limit errors
  if (error.message && error.message.includes('Too many requests')) {
    return res.status(429).json({
      success: false,
      message: error.message,
      code: 'RC4429',
    })
  }

  // Default error response
  res.status(error.statusCode || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'An error occurred processing your request'
        : error.message,
    code: 'RC5000',
  })
})

// ============================================
// EXPORTS
// ============================================

module.exports = router

/**
 * Route Documentation Summary
 *
 * PUBLIC ENDPOINTS:
 * - GET /public/:publicId - View public rate card
 *
 * BASIC OPERATIONS (Pro/Elite):
 * - POST / - Create rate card with AI suggestions
 * - GET / - List all rate cards
 * - GET /:id - Get specific rate card
 * - DELETE /:id - Soft delete rate card
 *
 * UPDATES:
 * - PUT /:id/metrics - Update metrics & regenerate AI pricing
 * - PUT /:id/pricing - Update deliverable pricing
 * - PUT /:id/professional-details - Update terms & conditions
 *
 * PACKAGES:
 * - POST /:id/packages - Create package deal
 * - PUT /:id/packages/:packageId - Update package
 * - DELETE /:id/packages/:packageId - Delete package
 *
 * PUBLISHING:
 * - POST /:id/publish - Make rate card public
 * - PUT /:id/share-settings - Configure sharing options
 *
 * EXPORT:
 * - GET /:id/pdf - Generate PDF
 *
 * HISTORY:
 * - GET /:id/history - View version history
 * - POST /:id/restore/:historyId - Restore from history
 *
 * ANALYTICS (Elite only):
 * - GET /:id/analytics - View analytics
 *
 * RATE LIMITS:
 * - General: 100 requests per 15 minutes
 * - AI Suggestions: 10 requests per hour
 * - PDF Generation: 5 requests per 15 minutes
 * - Public Access: 30 requests per minute
 *
 * ERROR CODES:
 * - RC4xxx: Client errors (validation, not found, unauthorized)
 * - RC5xxx: Server errors (database, external services)
 */
