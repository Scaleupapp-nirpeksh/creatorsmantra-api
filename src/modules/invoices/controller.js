/**
 * CreatorsMantra Backend - Invoice Controller
 * Complete API endpoints for invoice management with consolidated billing
 *
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Invoice CRUD operations, payment tracking, PDF generation
 */

const InvoiceService = require('./service')
const {
  PaymentTrackingService,
  PaymentReminderService,
  PDFGenerationService,
} = require('./payment-pdf-service')
const { Invoice, PaymentTracking, InvoiceTemplate } = require('./model')
const { Deal } = require('../deals/model')
const { User, CreatorProfile } = require('../auth/model')
const {
  successResponse,
  errorResponse,
  asyncHandler,
  logInfo,
  logError,
} = require('../../shared/utils')

// ============================================
// INVOICE CREATION CONTROLLERS
// ============================================

/**
 * Create Individual Invoice from Single Deal
 * POST /api/invoices/create-individual
 */
const createIndividualInvoice = asyncHandler(async (req, res) => {
  const { dealId, clientDetails, taxSettings, invoiceSettings, bankDetails, notes } = req.body
  const creatorId = req.user.id

  logInfo('Creating individual invoice', { creatorId, dealId })

  const invoiceData = {
    dealId,
    clientDetails,
    taxSettings,
    invoiceSettings,
    bankDetails,
    notes,
  }

  const invoice = await InvoiceService.createIndividualInvoice(invoiceData, creatorId)

  res.status(201).json(
    successResponse('Individual invoice created successfully', {
      invoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        clientName: invoice.clientDetails.name,
        amount: invoice.taxSettings.taxCalculation.finalAmount,
        dueDate: invoice.invoiceSettings.dueDate,
        status: invoice.status,
      },
    })
  )
})

/**
 * Create Consolidated Invoice from Multiple Deals - YOUR KEY FEATURE
 * POST /api/invoices/create-consolidated
 */
const createConsolidatedInvoice = asyncHandler(async (req, res) => {
  const {
    criteria,
    dealIds,
    month,
    year,
    brandId,
    agencyId,
    agencyDetails,
    startDate,
    endDate,
    clientDetails,
    taxSettings,
    invoiceSettings,
    bankDetails,
  } = req.body
  const creatorId = req.user.id

  logInfo('Creating consolidated invoice', {
    creatorId,
    criteria,
    dealCount: dealIds?.length,
  })

  const consolidationData = {
    criteria,
    dealIds,
    month,
    year,
    brandId,
    agencyId,
    agencyDetails, // For agency payout invoices
    startDate,
    endDate,
    clientDetails,
    taxSettings,
    invoiceSettings,
    bankDetails,
  }

  const invoice = await InvoiceService.createConsolidatedInvoice(consolidationData, creatorId)

  res.status(201).json(
    successResponse('Consolidated invoice created successfully', {
      invoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        clientName: invoice.clientDetails.name,
        dealCount: invoice.dealReferences.dealsSummary.totalDeals,
        totalAmount: invoice.taxSettings.taxCalculation.finalAmount,
        dueDate: invoice.invoiceSettings.dueDate,
        status: invoice.status,
        consolidationCriteria: invoice.dealReferences.consolidationCriteria,
      },
    })
  )
})

/**
 * Get Available Deals for Consolidation
 * GET /api/invoices/available-deals
 */
const getAvailableDeals = asyncHandler(async (req, res) => {
  const { criteria, month, year, brandId, agencyId, startDate, endDate } = req.query
  const creatorId = req.user.id

  let deals = []

  switch (criteria) {
    case 'monthly':
      deals = await InvoiceService.getMonthlyDeals(creatorId, parseInt(month), parseInt(year))
      break

    case 'brand_wise':
      deals = await InvoiceService.getBrandDeals(creatorId, brandId)
      break

    case 'agency_payout':
      deals = await InvoiceService.getAgencyPayoutDeals(creatorId, agencyId, { startDate, endDate })
      break

    case 'date_range':
      deals = await InvoiceService.getDateRangeDeals(creatorId, startDate, endDate)
      break

    default:
      // Get all eligible deals
      deals = await Deal.find({
        creatorId,
        status: { $in: ['completed', 'live', 'paid'] },
        hasInvoice: { $ne: true },
      })
        .populate('brandProfile')
        .sort({ completedAt: -1 })
  }

  // Calculate totals
  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0)
  const brands = [...new Set(deals.map((deal) => deal.brandProfile?.name).filter(Boolean))]
  const platforms = [...new Set(deals.map((deal) => deal.platform).filter(Boolean))]

  res.json(
    successResponse('Available deals retrieved successfully', {
      deals: deals.map((deal) => ({
        id: deal._id,
        brandName: deal.brandProfile?.name || 'Unknown Brand',
        platform: deal.platform,
        value: deal.value,
        completedAt: deal.completedAt,
        deliverables: deal.deliverables?.length || 1,
        status: deal.status,
      })),
      summary: {
        totalDeals: deals.length,
        totalValue,
        uniqueBrands: brands.length,
        brandNames: brands,
        platforms,
      },
    })
  )
})

// ============================================
// INVOICE MANAGEMENT CONTROLLERS
// ============================================

/**
 * Get Invoice by ID
 * GET /api/invoices/:invoiceId
 */
const getInvoiceById = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params
  const creatorId = req.user.id

  const invoice = await InvoiceService.getInvoiceById(invoiceId, creatorId)

  // Get payment history
  const payments = await PaymentTrackingService.getInvoicePayments(invoiceId)

  res.json(
    successResponse('Invoice retrieved successfully', {
      invoice,
      payments: payments.map((payment) => ({
        id: payment._id,
        paymentId: payment.paymentId,
        amount: payment.amountDetails.paidAmount,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        isVerified: payment.verification.isVerified,
      })),
    })
  )
})

/**
 * Get Invoices List with Filters
 * GET /api/invoices
 */
const getInvoicesList = asyncHandler(async (req, res) => {
  const creatorId = req.user.id
  const filters = req.query

  const result = await InvoiceService.getInvoicesList(creatorId, filters)
  res.json(successResponse('Invoices retrieved successfully', result))
})

/**
 * Update Invoice
 * PUT /api/invoices/:invoiceId
 */
const updateInvoice = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params
  const creatorId = req.user.id
  const updateData = req.body

  const updatedInvoice = await InvoiceService.updateInvoice(invoiceId, updateData, creatorId)

  res.json(
    successResponse('Invoice updated successfully', {
      invoice: {
        id: updatedInvoice._id,
        invoiceNumber: updatedInvoice.invoiceNumber,
        version: updatedInvoice.metadata.version,
        lastUpdated: updatedInvoice.updatedAt,
      },
    })
  )
})

/**
 * Delete/Cancel Invoice
 * DELETE /api/invoices/:invoiceId
 */
const deleteInvoice = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params
  const creatorId = req.user.id

  await InvoiceService.deleteInvoice(invoiceId, creatorId)

  res.json(successResponse('Invoice cancelled successfully'))
})

// ============================================
// TAX SETTINGS CONTROLLERS - YOUR KEY REQUIREMENT
// ============================================

/**
 * Get Creator's Tax Preferences - FIXED
 * GET /api/invoices/tax-preferences
 */
const getTaxPreferences = asyncHandler(async (req, res) => {
  const creatorId = req.user.id

  logInfo('Fetching tax preferences', { creatorId })

  try {
    // First verify the user exists
    const user = await User.findById(creatorId)
    if (!user) {
      logError('User not found for tax preferences', { creatorId })
      return res.status(404).json(errorResponse('User not found', null, 404))
    }

    // Get creator profile by userId (correct relationship)
    const creatorProfile = await CreatorProfile.findOne({ userId: creatorId })

    let taxPreferences

    if (creatorProfile && creatorProfile.taxPreferences) {
      // Use existing tax preferences from creator profile
      taxPreferences = creatorProfile.taxPreferences
    } else {
      // Use default tax preferences based on user type
      taxPreferences = {
        applyGST: true,
        gstRate: 18,
        gstType: 'cgst_sgst', // Default for intrastate
        gstExemptionReason: null,
        applyTDS: false,
        tdsRate: 10, // 10% for individuals
        entityType: 'individual',
        hasGSTExemption: false,
        exemptionCertificate: null,
        exemptionValidUpto: null,
        updatedAt: new Date(),
      }

      // If creator profile exists but no tax preferences, update it
      if (creatorProfile) {
        creatorProfile.taxPreferences = taxPreferences
        await creatorProfile.save()
        logInfo('Created default tax preferences for existing creator profile', { creatorId })
      }
    }

    res.json(
      successResponse('Tax preferences retrieved successfully', {
        taxPreferences,
        hasProfile: !!creatorProfile,
        profileCompleted: creatorProfile ? true : false,
      })
    )
  } catch (error) {
    logError('Error fetching tax preferences', { creatorId, error: error.message })
    return res.status(500).json(errorResponse('Failed to fetch tax preferences', error.message))
  }
})

/**
 * Update Creator's Tax Preferences - FIXED
 * PUT /api/invoices/tax-preferences
 */
const updateTaxPreferences = asyncHandler(async (req, res) => {
  const creatorId = req.user.id
  const {
    applyGST,
    gstRate,
    gstType,
    gstExemptionReason,
    applyTDS,
    tdsRate,
    entityType,
    hasGSTExemption,
    exemptionCertificate,
    exemptionValidUpto,
  } = req.body

  logInfo('Updating tax preferences', { creatorId, applyGST, applyTDS })

  try {
    // Verify user exists
    const user = await User.findById(creatorId)
    if (!user) {
      return res.status(404).json(errorResponse('User not found', null, 404))
    }

    // Find or create creator profile
    let creatorProfile = await CreatorProfile.findOne({ userId: creatorId })

    if (!creatorProfile) {
      // Create new creator profile if it doesn't exist
      creatorProfile = new CreatorProfile({
        userId: creatorId,
        creatorType: 'lifestyle', // Default, user can change later
        socialProfiles: {
          instagram: {},
          youtube: {},
        },
      })

      logInfo('Creating new creator profile for tax preferences', { creatorId })
    }

    // Update tax preferences
    const updatedTaxPreferences = {
      applyGST: applyGST !== undefined ? applyGST : true,
      gstRate: gstRate || 18,
      gstType: gstType || 'cgst_sgst',
      gstExemptionReason: gstExemptionReason || null,
      applyTDS: applyTDS !== undefined ? applyTDS : false,
      tdsRate: tdsRate || 10,
      entityType: entityType || 'individual',
      hasGSTExemption: hasGSTExemption || false,
      exemptionCertificate: exemptionCertificate || null,
      exemptionValidUpto: exemptionValidUpto ? new Date(exemptionValidUpto) : null,
      updatedAt: new Date(),
    }

    creatorProfile.taxPreferences = updatedTaxPreferences
    await creatorProfile.save()

    logInfo('Tax preferences updated successfully', {
      creatorId,
      applyGST: updatedTaxPreferences.applyGST,
      applyTDS: updatedTaxPreferences.applyTDS,
    })

    res.json(
      successResponse('Tax preferences updated successfully', {
        taxPreferences: updatedTaxPreferences,
      })
    )
  } catch (error) {
    logError('Error updating tax preferences', { creatorId, error: error.message })
    return res.status(500).json(errorResponse('Failed to update tax preferences', error.message))
  }
})

/**
 * Calculate Tax Preview for Invoice
 * POST /api/invoices/calculate-tax-preview
 */
const calculateTaxPreview = asyncHandler(async (req, res) => {
  const { lineItems, taxSettings, discountSettings } = req.body

  // Calculate subtotal
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0)
  let taxableAmount = subtotal

  // Apply discount
  if (discountSettings?.value > 0) {
    if (discountSettings.type === 'percentage') {
      taxableAmount = subtotal * (1 - discountSettings.value / 100)
    } else {
      taxableAmount = Math.max(0, subtotal - discountSettings.value)
    }
  }

  let finalAmount = taxableAmount
  let gstAmount = 0
  let tdsAmount = 0

  // Calculate GST
  if (taxSettings.gstSettings?.applyGST) {
    const gstRate = taxSettings.gstSettings.gstRate / 100
    gstAmount = taxableAmount * gstRate
    finalAmount += gstAmount
  }

  // Calculate TDS
  if (taxSettings.tdsSettings?.applyTDS) {
    const tdsRate = taxSettings.tdsSettings.tdsRate / 100
    tdsAmount = finalAmount * tdsRate
    finalAmount -= tdsAmount
  }

  const breakdown = {
    subtotal,
    discount: subtotal - taxableAmount,
    taxableAmount,
    gstAmount,
    cgstAmount: taxSettings.gstSettings?.gstType === 'cgst_sgst' ? gstAmount / 2 : 0,
    sgstAmount: taxSettings.gstSettings?.gstType === 'cgst_sgst' ? gstAmount / 2 : 0,
    igstAmount: taxSettings.gstSettings?.gstType === 'igst' ? gstAmount : 0,
    tdsAmount,
    finalAmount,
  }

  res.json(successResponse('Tax calculation preview', { breakdown }))
})

// ============================================
// PAYMENT TRACKING CONTROLLERS
// ============================================

/**
 * Record Payment for Invoice
 * POST /api/invoices/:invoiceId/payments
 */
const recordPayment = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params
  const creatorId = req.user.id
  const paymentData = req.body

  const payment = await PaymentTrackingService.recordPayment(invoiceId, paymentData, creatorId)

  res.status(201).json(
    successResponse('Payment recorded successfully', {
      payment: {
        id: payment._id,
        paymentId: payment.paymentId,
        amount: payment.amountDetails.paidAmount,
        remainingAmount: payment.amountDetails.remainingAmount,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
      },
    })
  )
})

/**
 * Get Payment History for Invoice
 * GET /api/invoices/:invoiceId/payments
 */
const getPaymentHistory = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params

  const payments = await PaymentTrackingService.getInvoicePayments(invoiceId)

  res.json(
    successResponse('Payment history retrieved successfully', {
      payments: payments.map((payment) => ({
        id: payment._id,
        paymentId: payment.paymentId,
        amount: payment.amountDetails.paidAmount,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        isVerified: payment.verification.isVerified,
        receiptNumber: payment.receipt?.receiptNumber,
        receiptUrl: payment.receipt?.receiptUrl,
      })),
    })
  )
})

/**
 * Verify Payment
 * PUT /api/invoices/payments/:paymentId/verify
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params
  const { verificationNotes } = req.body
  const verifiedBy = req.user.id

  const payment = await PaymentTrackingService.verifyPayment(
    paymentId,
    verifiedBy,
    verificationNotes
  )

  res.json(
    successResponse('Payment verified successfully', {
      payment: {
        id: payment._id,
        paymentId: payment.paymentId,
        isVerified: payment.verification.isVerified,
        verifiedAt: payment.verification.verifiedAt,
        receiptNumber: payment.receipt?.receiptNumber,
      },
    })
  )
})

// ============================================
// PDF GENERATION CONTROLLERS
// ============================================

/**
 * Generate Invoice PDF
 * POST /api/invoices/:invoiceId/generate-pdf
 */
const generateInvoicePDF = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params
  const { templateId } = req.body

  const result = await PDFGenerationService.generateInvoicePDF(invoiceId, templateId)

  res.json(successResponse('Invoice PDF generated successfully', result))
})

/**
 * Download Invoice PDF
 * GET /api/invoices/:invoiceId/download-pdf
 */
const downloadInvoicePDF = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params
  const creatorId = req.user.id

  const invoice = await Invoice.findOne({ _id: invoiceId, creatorId })

  if (!invoice) {
    return res.status(404).json(errorResponse('Invoice not found'))
  }

  if (!invoice.metadata.pdfUrl) {
    // Generate PDF if not exists
    const result = await PDFGenerationService.generateInvoicePDF(invoiceId)
    invoice.metadata.pdfUrl = result.pdfUrl
    await invoice.save()
  }

  // Update analytics
  invoice.metadata.analytics.downloadCount += 1
  invoice.metadata.analytics.lastDownloaded = new Date()
  await invoice.save()

  res.json(
    successResponse('PDF download link retrieved', {
      downloadUrl: invoice.metadata.pdfUrl,
      fileName: `${invoice.invoiceNumber}.pdf`,
    })
  )
})

// ============================================
// INVOICE ANALYTICS CONTROLLERS
// ============================================

/**
 * Get Invoice Analytics
 * GET /api/invoices/analytics
 */
const getInvoiceAnalytics = asyncHandler(async (req, res) => {
  const creatorId = req.user.id
  const { startDate, endDate } = req.query

  const dateRange = startDate && endDate ? { startDate, endDate } : {}

  const analytics = await InvoiceService.getInvoiceAnalytics(creatorId, dateRange)

  res.json(successResponse('Invoice analytics retrieved successfully', { analytics }))
})

/**
 * Get Invoice Dashboard Summary
 * GET /api/invoices/dashboard
 */
const getInvoiceDashboard = asyncHandler(async (req, res) => {
  const creatorId = req.user.id

  // Get current month analytics
  const currentMonth = new Date()
  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

  const [monthlyAnalytics, recentInvoices, pendingPayments, overdueInvoices] = await Promise.all([
    InvoiceService.getInvoiceAnalytics(creatorId, {
      startDate: startOfMonth,
      endDate: endOfMonth,
    }),

    Invoice.find({ creatorId })
      .sort({ 'invoiceSettings.invoiceDate': -1 })
      .limit(5)
      .select(
        'invoiceNumber clientDetails.name taxSettings.taxCalculation.finalAmount status invoiceSettings.invoiceDate'
      ),

    Invoice.find({
      creatorId,
      status: { $in: ['sent', 'partially_paid'] },
    })
      .sort({ 'invoiceSettings.dueDate': 1 })
      .limit(10)
      .select(
        'invoiceNumber clientDetails.name taxSettings.taxCalculation.finalAmount invoiceSettings.dueDate'
      ),

    Invoice.find({
      creatorId,
      status: 'overdue',
    })
      .sort({ 'invoiceSettings.dueDate': 1 })
      .select(
        'invoiceNumber clientDetails.name taxSettings.taxCalculation.finalAmount invoiceSettings.dueDate'
      ),
  ])

  res.json(
    successResponse('Invoice dashboard retrieved successfully', {
      monthlyAnalytics,
      recentInvoices,
      pendingPayments,
      overdueInvoices: overdueInvoices.length,
      quickStats: {
        totalInvoicesThisMonth: monthlyAnalytics.totalInvoices,
        revenueThisMonth: monthlyAnalytics.totalAmount,
        collectionRate: monthlyAnalytics.collectionRate,
        averageInvoiceValue:
          monthlyAnalytics.totalInvoices > 0
            ? monthlyAnalytics.totalAmount / monthlyAnalytics.totalInvoices
            : 0,
      },
    })
  )
})

// ============================================
// REMINDER MANAGEMENT CONTROLLERS
// ============================================

/**
 * Schedule Payment Reminders
 * POST /api/invoices/:invoiceId/schedule-reminders
 */
const schedulePaymentReminders = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params

  const reminders = await PaymentReminderService.scheduleReminders(invoiceId)

  res.json(
    successResponse('Payment reminders scheduled successfully', {
      reminderCount: reminders.length,
      reminders: reminders.map((r) => ({
        id: r._id,
        type: r.reminderType,
        scheduledDate: r.scheduledDate,
        daysPastDue: r.daysPastDue,
      })),
    })
  )
})

/**
 * Process Due Reminders (Admin/Cron job)
 * POST /api/invoices/process-reminders
 */
const processDueReminders = asyncHandler(async (req, res) => {
  const result = await PaymentReminderService.processDueReminders()

  res.json(successResponse('Reminders processed successfully', result))
})

// ============================================
// EXPORT CONTROLLERS
// ============================================

module.exports = {
  // Invoice Creation
  createIndividualInvoice,
  createConsolidatedInvoice,
  getAvailableDeals,

  // Invoice Management
  getInvoiceById,
  getInvoicesList,
  updateInvoice,
  deleteInvoice,

  // Tax Settings
  getTaxPreferences,
  updateTaxPreferences,
  calculateTaxPreview,

  // Payment Tracking
  recordPayment,
  getPaymentHistory,
  verifyPayment,

  // PDF Generation
  generateInvoicePDF,
  downloadInvoicePDF,

  // Analytics
  getInvoiceAnalytics,
  getInvoiceDashboard,

  // Reminders
  schedulePaymentReminders,
  processDueReminders,
}
