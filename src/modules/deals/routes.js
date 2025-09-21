//src/modules/deals/routes.js
/**
 * CreatorsMantra Backend - Deal CRM Routes
 * API endpoints for deal pipeline management
 *
 * IMPORTANT: Route order matters! Specific routes must come before parameterized routes
 *
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const express = require('express')
const rateLimit = require('express-rate-limit')

const dealController = require('./controller')
const {
  authenticateUser,
  authorizeRoles,
  validateRequest,
  authorizeSubscription,
} = require('../../shared/middleware')

const {
  createDealSchema,
  updateDealSchema,
  updateDealStageSchema,
  addCommunicationSchema,
  updateCommunicationSchema,
  updateDeliverableSchema,
  addDeliverableSchema,
  updateBrandProfileSchema,
  createDealTemplateSchema,
  updateDealTemplateSchema,
  getDealsQuerySchema,
  getBrandProfilesQuerySchema,
  getDealTemplatesQuerySchema,
  getPipelineOverviewQuerySchema,
  getRevenueAnalyticsQuerySchema,
  bulkUpdateDealsSchema,
  quickActionSchema,
  dealIdParamSchema,
  brandIdParamSchema,
  templateIdParamSchema,
  deliverableIdParamSchema,
  communicationIdParamSchema,
  stageParamSchema,
  actionParamSchema,
  dealAndDeliverableParamSchema,
} = require('./validation')

const router = express.Router()

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================

const dealLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 150,
  message: {
    success: false,
    message: 'Too many deal requests. Please try again later.',
    code: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
})

const dealCreationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 150,
  message: {
    success: false,
    message: 'Too many deal creation attempts. Please try again later.',
    code: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
})

const analyticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 150,
  message: {
    success: false,
    message: 'Too many analytics requests. Please try again later.',
    code: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ============================================
// SUBSCRIPTION TIERS CONSTANT
// ============================================

const DEAL_ALLOWED_TIERS = ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro']

// ============================================
// HEALTH CHECK ROUTE (No params)
// ============================================

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Deal CRM module is healthy',
    data: {
      module: 'deals',
      status: 'active',
      features: [
        'deal_creation',
        'pipeline_management',
        'brand_profiles',
        'deal_templates',
        'communication_tracking',
        'deliverable_management',
        'analytics_reporting',
      ],
      version: '1.0.0',
    },
    timestamp: new Date().toISOString(),
  })
})

// ============================================
// ROUTES WITHOUT PARAMETERS (MUST COME FIRST!)
// ============================================

// Metadata endpoint
router.get(
  '/metadata',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  dealController.getDealMetadata
)

// Pipeline routes (without params)
router.get(
  '/pipeline/overview',
  analyticsLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(getPipelineOverviewQuerySchema, 'query'),
  dealController.getPipelineOverview
)

// Attention route
router.get(
  '/attention',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  dealController.getDealsNeedingAttention
)

// Update this route
router.put(
  '/:dealId/deliverables/:deliverableId',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(dealAndDeliverableParamSchema, 'params'), // Use combined schema
  validateRequest(updateDeliverableSchema), // This validates the body
  dealController.updateDeliverable
)

// Brand profiles routes (without params)
router.get(
  '/brands',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(getBrandProfilesQuerySchema, 'query'),
  dealController.getBrandProfiles
)

// Templates routes (without params)
router.post(
  '/templates',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(createDealTemplateSchema),
  dealController.createDealTemplate
)

router.get(
  '/templates',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(getDealTemplatesQuerySchema, 'query'),
  dealController.getDealTemplates
)

// Analytics routes (without params)
router.get(
  '/analytics/revenue',
  analyticsLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(getRevenueAnalyticsQuerySchema, 'query'),
  dealController.getRevenueAnalytics
)

router.get(
  '/analytics/insights',
  analyticsLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  dealController.getDealInsights
)

router.get(
  '/analytics/summary',
  analyticsLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(getRevenueAnalyticsQuerySchema, 'query'),
  dealController.getDealSummary
)

// Bulk operations
router.put(
  '/bulk',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(bulkUpdateDealsSchema),
  dealController.bulkUpdateDeals
)

// ============================================
// BASIC CRUD ROUTES (with root path)
// ============================================

router.post(
  '/',
  dealCreationLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(createDealSchema),
  dealController.createDeal
)

router.get(
  '/',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(getDealsQuerySchema, 'query'),
  dealController.getDeals
)

// ============================================
// ROUTES WITH ONE PARAMETER
// ============================================

// Pipeline routes with stage parameter
router.get(
  '/pipeline/:stage',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(stageParamSchema, 'params'),
  dealController.getDealsByStage
)

// Brand profile routes with brandId
router.get(
  '/brands/:brandId',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(brandIdParamSchema, 'params'),
  dealController.getBrandProfile
)

router.put(
  '/brands/:brandId',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(brandIdParamSchema, 'params'),
  validateRequest(updateBrandProfileSchema),
  dealController.updateBrandProfile
)

// Template routes with templateId
router.put(
  '/templates/:templateId',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(templateIdParamSchema, 'params'),
  validateRequest(updateDealTemplateSchema),
  dealController.updateDealTemplate
)

router.delete(
  '/templates/:templateId',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(templateIdParamSchema, 'params'),
  dealController.deleteDealTemplate
)

// Deal-specific routes with dealId
router.get(
  '/:dealId',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(dealIdParamSchema, 'params'),
  dealController.getDeal
)

router.put(
  '/:dealId',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(dealIdParamSchema, 'params'),
  validateRequest(updateDealSchema),
  dealController.updateDeal
)

// --------------- NEW UPDATED ROUTES ---------------

/*
  TODO:
  1. Implement Request Payload Validation in router.patch
*/
router.patch(
  '/:dealId',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  dealController.patchDealById
)
// --------------- NEW UPDATED ROUTES ---------------

router.delete(
  '/:dealId',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(dealIdParamSchema, 'params'),
  dealController.deleteDeal
)

// Deal sub-routes
router.put(
  '/:dealId/archive',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(dealIdParamSchema, 'params'),
  dealController.archiveDeal
)

router.put(
  '/:dealId/stage',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(dealIdParamSchema, 'params'),
  validateRequest(updateDealStageSchema),
  dealController.updateDealStage
)

// Communication routes
router.post(
  '/:dealId/communications',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(dealIdParamSchema, 'params'),
  validateRequest(addCommunicationSchema),
  dealController.addCommunication
)

router.get(
  '/:dealId/communications',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(dealIdParamSchema, 'params'),
  dealController.getDealCommunications
)

// Deliverables routes
router.post(
  '/:dealId/deliverables',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(dealIdParamSchema, 'params'),
  validateRequest(addDeliverableSchema),
  dealController.addDeliverable
)

// ============================================
// ROUTES WITH TWO PARAMETERS
// ============================================

// Communication update route
router.put(
  '/:dealId/communications/:commId',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(dealIdParamSchema, 'params'),
  validateRequest(communicationIdParamSchema, 'params'),
  validateRequest(updateCommunicationSchema),
  dealController.updateCommunication
)

// Deliverable update route
router.put(
  '/:dealId/deliverables/:deliverableId',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(dealIdParamSchema, 'params'),
  validateRequest(deliverableIdParamSchema, 'params'),
  validateRequest(updateDeliverableSchema),
  dealController.updateDeliverable
)

// Quick actions route
router.post(
  '/:dealId/actions/:action',
  dealLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  validateRequest(dealIdParamSchema, 'params'),
  validateRequest(actionParamSchema, 'params'),
  validateRequest(quickActionSchema),
  dealController.performQuickAction
)

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router
