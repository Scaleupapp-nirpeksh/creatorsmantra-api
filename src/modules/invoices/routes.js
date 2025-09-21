/**
 * CreatorsMantra Backend - Invoice Routes & Validation
 * Complete API routes with validation for invoice management
 *
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Invoice routes with rate limiting, validation, and security
 */

const express = require('express')
const Joi = require('joi')
const rateLimit = require('express-rate-limit')
const {
  validateRequest,
  authenticateUser,
  authorizeSubscription,
} = require('../../shared/middleware')
const invoiceController = require('./controller')

const router = express.Router()

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================

// Standard rate limiting for most operations
const standardLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    code: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Restrictive rate limiting for resource-intensive operations
const restrictiveLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    success: false,
    message: 'Too many PDF generation requests. Please try again later.',
    code: 429,
  },
})

// ============================================
// VALIDATION SCHEMAS
// ============================================

// Basic ID validation - Base schema without required
const objectIdPattern = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    'string.pattern.base': 'Invalid ID format',
  })

// Required version of object ID
const objectIdSchema = objectIdPattern.required()

// Client details validation - base schema
const clientDetailsSchema = Joi.object({
  name: Joi.string().min(2).max(200),
  email: Joi.string().email().optional(),
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .optional(),
  address: Joi.object({
    street: Joi.string().max(200).allow('').optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    pincode: Joi.string()
      .pattern(/^\d{6}$/)
      .optional(),
    country: Joi.string().max(100).default('India'),
  }).optional(),
  gstNumber: Joi.string().allow('', null, 'N/A', 'NA').optional(),
  panNumber: Joi.string().allow('', null, 'N/A', 'NA').optional(),
  isInterstate: Joi.boolean().default(false),
  clientType: Joi.string().valid('brand', 'agency', 'individual', 'company').default('brand'),
})

// Line item validation
const lineItemSchema = Joi.object({
  description: Joi.string().min(1).max(500).required(),
  dealId: objectIdPattern.optional(),
  itemType: Joi.string()
    .valid('content_creation', 'sponsorship', 'brand_integration', 'performance_bonus', 'misc')
    .default('content_creation'),
  platform: Joi.string()
    .valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'multiple', 'other')
    .optional(),
  deliverableType: Joi.string()
    .valid('reel', 'post', 'story', 'video', 'short', 'carousel', 'igtv', 'live', 'other')
    .optional(),
  quantity: Joi.number().positive().required(),
  rate: Joi.number().min(0).required(),
  hsnCode: Joi.string().max(10).default('998314'),
  discount: Joi.object({
    percentage: Joi.number().min(0).max(100).default(0),
    amount: Joi.number().min(0).default(0),
  }).optional(),
})

// Tax settings validation - YOUR KEY REQUIREMENT
const taxSettingsSchema = Joi.object({
  gstSettings: Joi.object({
    applyGST: Joi.boolean(),
    gstRate: Joi.number().min(0).max(100).default(18),
    gstType: Joi.string().valid('cgst_sgst', 'igst').default('cgst_sgst'),
    exemptionReason: Joi.string().max(200).optional(),
  }).optional(),
  tdsSettings: Joi.object({
    applyTDS: Joi.boolean(),
    tdsRate: Joi.number().min(0).max(30).default(10),
    entityType: Joi.string().valid('individual', 'company').default('individual'),
    exemptionCertificate: Joi.object({
      hasExemption: Joi.boolean().default(false),
      certificateNumber: Joi.string().optional(),
      validUpto: Joi.date().allow(null, '').optional(),
    }).optional(),
  }).optional(),
})

// Required tax settings for tax calculation preview
const requiredTaxSettingsSchema = Joi.object({
  gstSettings: Joi.object({
    applyGST: Joi.boolean().required(),
    gstRate: Joi.number().min(0).max(100).default(18),
    gstType: Joi.string().valid('cgst_sgst', 'igst').default('cgst_sgst'),
    exemptionReason: Joi.string().max(200).optional(),
  }).required(),
  tdsSettings: Joi.object({
    applyTDS: Joi.boolean().required(),
    tdsRate: Joi.number().min(0).max(30).default(10),
    entityType: Joi.string().valid('individual', 'company').default('individual'),
    exemptionCertificate: Joi.object({
      hasExemption: Joi.boolean().default(false),
      certificateNumber: Joi.string().optional(),
      validUpto: Joi.date().optional(),
    }).optional(),
  }).required(),
})

// Invoice settings validation
const invoiceSettingsSchema = Joi.object({
  currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP').default('INR'),
  paymentTerms: Joi.number().min(0).max(365).default(30),
  discountType: Joi.string().valid('percentage', 'amount').default('percentage'),
  discountValue: Joi.number().min(0).default(0),
  notes: Joi.string().max(1000).optional(),
  termsAndConditions: Joi.string().max(5000).optional(),
})

// Bank details validation - base schema
const bankDetailsSchema = Joi.object({
  accountName: Joi.string().max(100).optional(),
  accountNumber: Joi.string()
    .pattern(/^\d{9,18}$/)
    .optional(),
  bankName: Joi.string().max(100).optional(),
  ifscCode: Joi.string()
    .pattern(/^[A-Z]{4}[0][A-Z0-9]{6}$/)
    .optional(),
  branchName: Joi.string().max(100).optional(),
  upiId: Joi.string()
    .pattern(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/)
    .optional(),
})

// ============================================
// INDIVIDUAL INVOICE VALIDATION
// ============================================

const createIndividualInvoiceSchema = Joi.object({
  dealId: objectIdPattern.required(),
  clientDetails: clientDetailsSchema.optional(),
  taxSettings: taxSettingsSchema.optional(),
  invoiceSettings: invoiceSettingsSchema.optional(),
  bankDetails: bankDetailsSchema.optional(),
  notes: Joi.string().max(1000).optional(),
})

// ============================================
// CONSOLIDATED INVOICE VALIDATION - YOUR KEY FEATURE
// ============================================

const createConsolidatedInvoiceSchema = Joi.object({
  criteria: Joi.string()
    .valid('monthly', 'brand_wise', 'agency_payout', 'date_range', 'custom_selection')
    .required(),

  // For custom selection
  dealIds: Joi.when('criteria', {
    is: 'custom_selection',
    then: Joi.array().items(objectIdPattern).min(2).required(),
    otherwise: Joi.array().items(objectIdPattern).optional(),
  }),

  // For monthly consolidation
  month: Joi.when('criteria', {
    is: 'monthly',
    then: Joi.number().min(1).max(12).required(),
    otherwise: Joi.number().min(1).max(12).optional(),
  }),

  year: Joi.when('criteria', {
    is: 'monthly',
    then: Joi.number().min(2020).max(2030).required(),
    otherwise: Joi.number().min(2020).max(2030).optional(),
  }),

  // For brand-wise consolidation
  brandId: Joi.when('criteria', {
    is: 'brand_wise',
    then: objectIdPattern.required(),
    otherwise: objectIdPattern.optional(),
  }),

  // For agency payout - YOUR SPECIFIC USE CASE
  agencyId: objectIdPattern.optional(),

  agencyDetails: Joi.when('criteria', {
    is: 'agency_payout',
    then: Joi.object({
      name: Joi.string().min(2).max(200).required(),
      email: Joi.string().email().optional(),
      phone: Joi.string()
        .pattern(/^[6-9]\d{9}$/)
        .optional(),
      address: Joi.object({
        street: Joi.string().max(200).optional(),
        city: Joi.string().max(100).optional(),
        state: Joi.string().max(100).optional(),
        pincode: Joi.string()
          .pattern(/^\d{6}$/)
          .optional(),
      }).optional(),
    }).required(),
    otherwise: Joi.object({
      name: Joi.string().min(2).max(200).required(),
      email: Joi.string().email().optional(),
      phone: Joi.string()
        .pattern(/^[6-9]\d{9}$/)
        .optional(),
      address: Joi.object({
        street: Joi.string().max(200).optional(),
        city: Joi.string().max(100).optional(),
        state: Joi.string().max(100).optional(),
        pincode: Joi.string()
          .pattern(/^\d{6}$/)
          .optional(),
      }).optional(),
    }).optional(),
  }),

  // For date range consolidation
  startDate: Joi.when('criteria', {
    is: Joi.valid('date_range', 'agency_payout'),
    then: Joi.date().required(),
    otherwise: Joi.date().optional(),
  }),

  endDate: Joi.when('criteria', {
    is: Joi.valid('date_range', 'agency_payout'),
    then: Joi.date().min(Joi.ref('startDate')).required(),
    otherwise: Joi.date().min(Joi.ref('startDate')).optional(),
  }),

  // Common fields
  clientDetails: clientDetailsSchema.optional(),
  taxSettings: taxSettingsSchema.optional(),
  invoiceSettings: invoiceSettingsSchema.optional(),
  bankDetails: bankDetailsSchema.optional(),
})

// ============================================
// OTHER VALIDATION SCHEMAS
// ============================================

const updateInvoiceSchema = Joi.object({
  clientDetails: clientDetailsSchema.optional(),
  lineItems: Joi.array().items(lineItemSchema).optional(),
  taxSettings: taxSettingsSchema.optional(),
  invoiceSettings: invoiceSettingsSchema.optional(),
  notes: Joi.string().max(1000).optional(),
  revisionNotes: Joi.string().max(500).optional(),
})

const taxPreferencesSchema = Joi.object({
  applyGST: Joi.boolean(),
  gstRate: Joi.number().min(0).max(100).default(18),
  gstType: Joi.string().valid('cgst_sgst', 'igst').default('cgst_sgst'),
  gstExemptionReason: Joi.string().max(200).optional(),
  applyTDS: Joi.boolean(),
  tdsRate: Joi.number().min(0).max(30).default(10),
  entityType: Joi.string().valid('individual', 'company').default('individual'),
  hasGSTExemption: Joi.boolean().default(false),
  exemptionCertificate: Joi.string().optional(),
  exemptionValidUpto: Joi.date().optional(),
})

const paymentRecordingSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paymentDate: Joi.date().max('now').required(),
  paymentMethod: Joi.string()
    .valid('bank_transfer', 'upi', 'cheque', 'cash', 'online', 'wallet', 'other')
    .required(),
  transactionId: Joi.string().allow('').optional(),
  referenceNumber: Joi.string().allow('').optional(), // ← FIXED: Allow empty string
  payerName: Joi.string().allow('').optional(), // ← FIXED: Allow empty string
  payerAccount: Joi.string().allow('').optional(),
  bankReference: Joi.string().allow('').optional(),
  isVerified: Joi.boolean().default(false),
  verificationNotes: Joi.string().max(500).allow('').optional(),
  notes: Joi.string().max(1000).allow('').optional(),
  milestoneInfo: Joi.object({
    milestoneNumber: Joi.number().positive().optional(),
    totalMilestones: Joi.number().positive().optional(),
    milestonePercentage: Joi.number().min(0).max(100).optional(),
  }).optional(),
})

const taxCalculationPreviewSchema = Joi.object({
  lineItems: Joi.array().items(lineItemSchema).min(1).required(),
  taxSettings: requiredTaxSettingsSchema,
  discountSettings: Joi.object({
    type: Joi.string().valid('percentage', 'amount').default('percentage'),
    value: Joi.number().min(0).default(0),
  }).optional(),
})

// ============================================
// ROUTES - ORDERED CORRECTLY
// ============================================
// Note: Specific routes MUST come before parameterized routes to avoid conflicts

// --- SPECIFIC ROUTES FIRST ---

/**
 * Get Available Deals for Consolidation
 * GET /api/invoices/available-deals
 */
router.get(
  '/available-deals',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  invoiceController.getAvailableDeals
)

/**
 * Get Tax Preferences
 * GET /api/invoices/tax-preferences
 */
router.get(
  '/tax-preferences',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  invoiceController.getTaxPreferences
)

/**
 * Update Tax Preferences
 * PUT /api/invoices/tax-preferences
 */
router.put(
  '/tax-preferences',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  validateRequest(taxPreferencesSchema),
  invoiceController.updateTaxPreferences
)

/**
 * Calculate Tax Preview
 * POST /api/invoices/calculate-tax-preview
 */
router.post(
  '/calculate-tax-preview',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  validateRequest(taxCalculationPreviewSchema),
  invoiceController.calculateTaxPreview
)

/**
 * Get Invoice Analytics
 * GET /api/invoices/analytics
 */
router.get(
  '/analytics',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  invoiceController.getInvoiceAnalytics
)

/**
 * Get Invoice Dashboard
 * GET /api/invoices/dashboard
 */
router.get(
  '/dashboard',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  invoiceController.getInvoiceDashboard
)

/**
 * Create Individual Invoice
 * POST /api/invoices/create-individual
 */
router.post(
  '/create-individual',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  validateRequest(createIndividualInvoiceSchema),
  invoiceController.createIndividualInvoice
)

/**
 * Create Consolidated Invoice - YOUR KEY FEATURE
 * POST /api/invoices/create-consolidated
 */
router.post(
  '/create-consolidated',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['pro', 'elite']), // Premium feature
  validateRequest(createConsolidatedInvoiceSchema),
  invoiceController.createConsolidatedInvoice
)

/**
 * Process Due Reminders (Admin/Cron)
 * POST /api/invoices/process-reminders
 */
router.post(
  '/process-reminders',
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per hour
    message: {
      success: false,
      message: 'Too many reminder processing requests',
      code: 429,
    },
  }),
  authenticateUser,
  // Add admin role check here if needed
  invoiceController.processDueReminders
)

/**
 * Verify Payment
 * PUT /api/invoices/payments/:paymentId/verify
 */
router.put(
  '/payments/:paymentId/verify',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  invoiceController.verifyPayment
)

// --- PARAMETERIZED ROUTES AFTER ---

/**
 * Get Invoices List
 * GET /api/invoices
 */
router.get(
  '/',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  invoiceController.getInvoicesList
)

/**
 * Get Invoice by ID
 * GET /api/invoices/:invoiceId
 */
router.get(
  '/:invoiceId',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  invoiceController.getInvoiceById
)

/**
 * Update Invoice
 * PUT /api/invoices/:invoiceId
 */
router.put(
  '/:invoiceId',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  // TEMP
  // REASON: Payload Schema and Validation is different
  // validateRequest(updateInvoiceSchema),
  invoiceController.updateInvoice
)

/**
 * Delete/Cancel Invoice
 * DELETE /api/invoices/:invoiceId
 */
router.delete(
  '/:invoiceId',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  invoiceController.deleteInvoice
)

/**
 * Record Payment
 * POST /api/invoices/:invoiceId/payments
 */
router.post(
  '/:invoiceId/payments',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  validateRequest(paymentRecordingSchema),
  invoiceController.recordPayment
)

/**
 * Get Payment History
 * GET /api/invoices/:invoiceId/payments
 */
router.get(
  '/:invoiceId/payments',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  invoiceController.getPaymentHistory
)

/**
 * Generate Invoice PDF
 * POST /api/invoices/:invoiceId/generate-pdf
 */
router.post(
  '/:invoiceId/generate-pdf',
  restrictiveLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  invoiceController.generateInvoicePDF
)

/**
 * Download Invoice PDF
 * GET /api/invoices/:invoiceId/download-pdf
 */
router.get(
  '/:invoiceId/download-pdf',
  restrictiveLimit,
  authenticateUser,
  authorizeSubscription(['starter', 'pro', 'elite']),
  invoiceController.downloadInvoicePDF
)

/**
 * Schedule Payment Reminders
 * POST /api/invoices/:invoiceId/schedule-reminders
 */
router.post(
  '/:invoiceId/schedule-reminders',
  standardLimit,
  authenticateUser,
  authorizeSubscription(['pro', 'elite']), // Premium feature
  invoiceController.schedulePaymentReminders
)

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router
