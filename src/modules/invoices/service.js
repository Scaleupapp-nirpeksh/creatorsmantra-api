/**
 * CreatorsMantra Backend - Invoice Service
 * Complete business logic for invoice management with consolidated billing
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Invoice operations, tax calculations, PDF generation, payment tracking
 */

const { Invoice, PaymentTracking, InvoiceTemplate, PaymentReminder } = require('./model');
const { Deal } = require('../deals/model');
const { User } = require('../auth/model');
const { 
  successResponse, 
  errorResponse, 
  generateRandomString,
  formatCurrency,
  calculateGST,
  calculateTDS,
  sendEmail,
  uploadToS3,
  logInfo,
  logError
} = require('../../shared/utils');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ============================================
// INVOICE CREATION SERVICE
// ============================================

class InvoiceService {
  
  /**
   * Create Individual Invoice from Single Deal
   * @param {Object} invoiceData - Invoice creation data
   * @param {String} creatorId - Creator ID
   * @returns {Object} Created invoice
   */
  async createIndividualInvoice(invoiceData, creatorId) {
    try {
      logInfo('Creating individual invoice', { creatorId, dealId: invoiceData.dealId });

      // Validate deal exists and belongs to creator
      const deal = await Deal.findOne({ 
        _id: invoiceData.dealId, 
        creatorId,
        status: { $in: ['completed', 'live', 'paid'] }
      });

      if (!deal) {
        throw new Error('Deal not found or not eligible for invoicing');
      }

      // Check if invoice already exists for this deal
      const existingInvoice = await Invoice.findOne({
        'dealReferences.dealId': invoiceData.dealId,
        creatorId,
        status: { $ne: 'cancelled' }
      });

      if (existingInvoice) {
        throw new Error('Invoice already exists for this deal');
      }

      // Get creator's tax preferences
      const creator = await User.findById(creatorId).populate('creatorProfile');
      const taxPreferences = creator.creatorProfile?.taxPreferences || {};

      // Build line items from deal deliverables
      const lineItems = this.buildLineItemsFromDeal(deal);

      // Create invoice object
      const invoiceObj = {
        invoiceType: 'individual',
        creatorId,
        dealReferences: {
          dealId: invoiceData.dealId,
          dealIds: [invoiceData.dealId],
          consolidationCriteria: 'custom_selection',
          dealsSummary: {
            totalDeals: 1,
            totalBrands: 1,
            totalDeliverables: deal.deliverables?.length || 1,
            platforms: [deal.platform]
          }
        },
        clientDetails: this.buildClientDetailsFromDeal(deal, invoiceData.clientDetails),
        lineItems,
        taxSettings: this.buildTaxSettings(taxPreferences, invoiceData.taxSettings),
        invoiceSettings: this.buildInvoiceSettings(invoiceData.invoiceSettings),
        bankDetails: invoiceData.bankDetails || creator.creatorProfile?.bankDetails,
        status: 'draft'
      };

      // Generate invoice number
      const invoice = new Invoice(invoiceObj);
      invoice.generateInvoiceNumber();

      // Calculate amounts (pre-save hook will handle this)
      await invoice.save();

      logInfo('Individual invoice created successfully', { 
        invoiceId: invoice._id, 
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.taxSettings.taxCalculation.finalAmount
      });

      return invoice;

    } catch (error) {
      logError('Error creating individual invoice', { error: error.message, creatorId });
      throw error;
    }
  }

  /**
   * Create Consolidated Invoice from Multiple Deals - YOUR KEY REQUIREMENT
   * @param {Object} consolidationData - Consolidation parameters
   * @param {String} creatorId - Creator ID  
   * @returns {Object} Created consolidated invoice
   */
  async createConsolidatedInvoice(consolidationData, creatorId) {
    try {
      logInfo('Creating consolidated invoice', { 
        creatorId, 
        criteria: consolidationData.criteria,
        dealCount: consolidationData.dealIds?.length 
      });

      let deals = [];
      let consolidationCriteria = consolidationData.criteria;

      // Get deals based on consolidation criteria
      switch (consolidationData.criteria) {
        case 'monthly':
          deals = await this.getMonthlyDeals(creatorId, consolidationData.month, consolidationData.year);
          break;

        case 'brand_wise':
          deals = await this.getBrandDeals(creatorId, consolidationData.brandId);
          break;

        case 'agency_payout':
          deals = await this.getAgencyPayoutDeals(creatorId, consolidationData.agencyId, consolidationData.dateRange);
          break;

        case 'date_range':
          deals = await this.getDateRangeDeals(creatorId, consolidationData.startDate, consolidationData.endDate);
          break;

        case 'custom_selection':
          deals = await this.getSelectedDeals(creatorId, consolidationData.dealIds);
          break;

        default:
          throw new Error('Invalid consolidation criteria');
      }

      if (!deals || deals.length === 0) {
        throw new Error('No eligible deals found for consolidation');
      }

      // Validate deals are eligible for invoicing
      const eligibleDeals = deals.filter(deal => 
        ['completed', 'live', 'paid'].includes(deal.status) &&
        !deal.hasInvoice // Assuming we add this flag
      );

      if (eligibleDeals.length === 0) {
        throw new Error('No eligible deals found for invoicing');
      }

      // Get creator's tax preferences
      const creator = await User.findById(creatorId).populate('creatorProfile');
      const taxPreferences = creator.creatorProfile?.taxPreferences || {};

      // Build consolidated line items
      const lineItems = this.buildConsolidatedLineItems(eligibleDeals);

      // Calculate deal summary
      const dealsSummary = this.calculateDealsSummary(eligibleDeals);

      // Determine client details for consolidated invoice
      const clientDetails = this.buildConsolidatedClientDetails(eligibleDeals, consolidationData);

      // Create consolidated invoice object
      const invoiceObj = {
        invoiceType: consolidationData.criteria === 'agency_payout' ? 'agency_payout' : 'consolidated',
        creatorId,
        dealReferences: {
          dealIds: eligibleDeals.map(deal => deal._id),
          consolidationCriteria,
          consolidationPeriod: {
            startDate: consolidationData.startDate,
            endDate: consolidationData.endDate
          },
          dealsSummary
        },
        clientDetails,
        lineItems,
        taxSettings: this.buildTaxSettings(taxPreferences, consolidationData.taxSettings),
        invoiceSettings: this.buildInvoiceSettings(consolidationData.invoiceSettings),
        bankDetails: consolidationData.bankDetails || creator.creatorProfile?.bankDetails,
        status: 'draft'
      };

      // Generate invoice number
      const invoice = new Invoice(invoiceObj);
      invoice.generateInvoiceNumber();

      // Save invoice
      await invoice.save();

      // Mark deals as invoiced
      await Deal.updateMany(
        { _id: { $in: eligibleDeals.map(d => d._id) } },
        { hasInvoice: true, invoiceId: invoice._id }
      );

      logInfo('Consolidated invoice created successfully', {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        dealCount: eligibleDeals.length,
        totalAmount: invoice.taxSettings.taxCalculation.finalAmount
      });

      return invoice;

    } catch (error) {
      logError('Error creating consolidated invoice', { error: error.message, creatorId });
      throw error;
    }
  }

  /**
   * Get Monthly Deals for Consolidation
   * @param {String} creatorId - Creator ID
   * @param {Number} month - Month (1-12)
   * @param {Number} year - Year
   * @returns {Array} Deals array
   */
  async getMonthlyDeals(creatorId, month, year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return await Deal.find({
      creatorId,
      status: { $in: ['completed', 'live', 'paid'] },
      completedAt: { $gte: startDate, $lte: endDate },
      hasInvoice: { $ne: true }
    }).populate('brandProfile');
  }

  /**
   * Get Brand-specific Deals for Consolidation
   * @param {String} creatorId - Creator ID
   * @param {String} brandId - Brand ID
   * @returns {Array} Deals array
   */
  async getBrandDeals(creatorId, brandId) {
    return await Deal.find({
      creatorId,
      brandId,
      status: { $in: ['completed', 'live', 'paid'] },
      hasInvoice: { $ne: true }
    }).populate('brandProfile');
  }

  /**
   * Get Agency Payout Deals - YOUR SPECIFIC USE CASE
   * @param {String} creatorId - Creator ID
   * @param {String} agencyId - Agency ID
   * @param {Object} dateRange - Date range
   * @returns {Array} Deals array
   */
  async getAgencyPayoutDeals(creatorId, agencyId, dateRange) {
    const query = {
      creatorId,
      status: { $in: ['completed', 'paid'] },
      hasInvoice: { $ne: true }
    };

    // Add agency filter if specified
    if (agencyId) {
      query['brandProfile.parentAgency'] = agencyId;
    }

    // Add date range filter
    if (dateRange) {
      query.completedAt = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate)
      };
    }

    return await Deal.find(query).populate('brandProfile');
  }

  /**
   * Get Date Range Deals for Consolidation
   * @param {String} creatorId - Creator ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Deals array
   */
  async getDateRangeDeals(creatorId, startDate, endDate) {
    return await Deal.find({
      creatorId,
      status: { $in: ['completed', 'live', 'paid'] },
      completedAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      hasInvoice: { $ne: true }
    }).populate('brandProfile');
  }

  /**
   * Get Selected Deals for Consolidation
   * @param {String} creatorId - Creator ID
   * @param {Array} dealIds - Array of deal IDs
   * @returns {Array} Deals array
   */
  async getSelectedDeals(creatorId, dealIds) {
    return await Deal.find({
      _id: { $in: dealIds },
      creatorId,
      status: { $in: ['completed', 'live', 'paid'] },
      hasInvoice: { $ne: true }
    }).populate('brandProfile');
  }

  /**
   * Build Line Items from Single Deal
   * @param {Object} deal - Deal object
   * @returns {Array} Line items array
   */
  buildLineItemsFromDeal(deal) {
    const lineItems = [];

    // Add deliverables as line items
    if (deal.deliverables && deal.deliverables.length > 0) {
      deal.deliverables.forEach(deliverable => {
        lineItems.push({
          description: `${deliverable.type} - ${deliverable.description}`,
          dealId: deal._id,
          itemType: 'content_creation',
          platform: deal.platform,
          deliverableType: deliverable.type,
          quantity: deliverable.quantity || 1,
          rate: deliverable.rate || (deal.value / deal.deliverables.length),
          amount: deliverable.rate || (deal.value / deal.deliverables.length),
          hsnCode: '998314'
        });
      });
    } else {
      // Single line item for the entire deal
      lineItems.push({
        description: `${deal.platform} Campaign - ${deal.brandProfile?.name || 'Brand Campaign'}`,
        dealId: deal._id,
        itemType: 'content_creation',
        platform: deal.platform,
        quantity: 1,
        rate: deal.value,
        amount: deal.value,
        hsnCode: '998314'
      });
    }

    return lineItems;
  }

  /**
   * Build Consolidated Line Items from Multiple Deals
   * @param {Array} deals - Array of deals
   * @returns {Array} Consolidated line items
   */
  buildConsolidatedLineItems(deals) {
    const lineItems = [];

    deals.forEach(deal => {
      // Group by deal for better organization
      const dealLineItems = this.buildLineItemsFromDeal(deal);
      lineItems.push(...dealLineItems);
    });

    // Optionally group similar items
    return this.groupSimilarLineItems(lineItems);
  }

  /**
   * Group Similar Line Items for Cleaner Invoice
   * @param {Array} lineItems - Line items array
   * @returns {Array} Grouped line items
   */
  groupSimilarLineItems(lineItems) {
    const grouped = {};

    lineItems.forEach(item => {
      const key = `${item.platform}_${item.deliverableType}_${item.rate}`;
      
      if (grouped[key]) {
        grouped[key].quantity += item.quantity;
        grouped[key].amount += item.amount;
        grouped[key].description += ` + Additional`;
      } else {
        grouped[key] = { ...item };
      }
    });

    return Object.values(grouped);
  }

  /**
   * Calculate Deals Summary for Consolidated Invoice
   * @param {Array} deals - Array of deals
   * @returns {Object} Summary object
   */
  calculateDealsSummary(deals) {
    const brands = new Set();
    const platforms = new Set();
    let totalDeliverables = 0;

    deals.forEach(deal => {
      if (deal.brandProfile?._id) brands.add(deal.brandProfile._id.toString());
      if (deal.platform) platforms.add(deal.platform);
      totalDeliverables += deal.deliverables?.length || 1;
    });

    return {
      totalDeals: deals.length,
      totalBrands: brands.size,
      totalDeliverables,
      platforms: Array.from(platforms)
    };
  }

  /**
   * Build Client Details from Deal
   * @param {Object} deal - Deal object
   * @param {Object} overrideDetails - Override client details
   * @returns {Object} Client details
   */
  buildClientDetailsFromDeal(deal, overrideDetails = {}) {
    const brandProfile = deal.brandProfile || {};
    
    return {
      name: overrideDetails.name || brandProfile.name || 'Client',
      email: overrideDetails.email || brandProfile.email,
      phone: overrideDetails.phone || brandProfile.phone,
      address: overrideDetails.address || brandProfile.address || {},
      taxInfo: {
        gstNumber: overrideDetails.gstNumber || brandProfile.gstNumber,
        panNumber: overrideDetails.panNumber || brandProfile.panNumber,
        isInterstate: overrideDetails.isInterstate || this.checkIfInterstate(brandProfile.state)
      },
      clientType: overrideDetails.clientType || 'brand'
    };
  }

  /**
   * Build Client Details for Consolidated Invoice
   * @param {Array} deals - Array of deals
   * @param {Object} consolidationData - Consolidation data
   * @returns {Object} Client details
   */
  buildConsolidatedClientDetails(deals, consolidationData) {
    // For agency payout, use agency details
    if (consolidationData.criteria === 'agency_payout' && consolidationData.agencyDetails) {
      return {
        name: consolidationData.agencyDetails.name,
        email: consolidationData.agencyDetails.email,
        phone: consolidationData.agencyDetails.phone,
        address: consolidationData.agencyDetails.address || {},
        clientType: 'agency'
      };
    }

    // For multiple brands, create a generic client entry
    const brands = deals.map(deal => deal.brandProfile?.name).filter(name => name);
    const uniqueBrands = [...new Set(brands)];

    if (uniqueBrands.length === 1) {
      // Single brand, use brand details
      return this.buildClientDetailsFromDeal(deals[0], consolidationData.clientDetails);
    } else {
      // Multiple brands, use consolidated details
      return {
        name: consolidationData.clientDetails?.name || `Multiple Brands (${uniqueBrands.length})`,
        email: consolidationData.clientDetails?.email,
        phone: consolidationData.clientDetails?.phone,
        address: consolidationData.clientDetails?.address || {},
        clientType: 'multiple_brands'
      };
    }
  }

  /**
   * Build Tax Settings with Creator Preferences - YOUR KEY REQUIREMENT
   * @param {Object} taxPreferences - Creator's tax preferences
   * @param {Object} overrideSettings - Override settings
   * @returns {Object} Tax settings
   */
  buildTaxSettings(taxPreferences, overrideSettings = {}) {
    return {
      gstSettings: {
        applyGST: overrideSettings.applyGST !== undefined ? overrideSettings.applyGST : taxPreferences.applyGST !== false,
        gstRate: overrideSettings.gstRate || taxPreferences.gstRate || 18,
        gstType: overrideSettings.gstType || taxPreferences.gstType || 'cgst_sgst',
        exemptionReason: overrideSettings.gstExemptionReason || taxPreferences.gstExemptionReason
      },
      tdsSettings: {
        applyTDS: overrideSettings.applyTDS !== undefined ? overrideSettings.applyTDS : taxPreferences.applyTDS || false,
        tdsRate: overrideSettings.tdsRate || taxPreferences.tdsRate || 10,
        entityType: overrideSettings.entityType || taxPreferences.entityType || 'individual',
        exemptionCertificate: {
          hasExemption: overrideSettings.hasGSTExemption || taxPreferences.hasGSTExemption || false,
          certificateNumber: overrideSettings.exemptionCertificate || taxPreferences.exemptionCertificate,
          validUpto: overrideSettings.exemptionValidUpto ? new Date(overrideSettings.exemptionValidUpto) : null
        }
      },
      taxCalculation: {
        subtotal: 0,
        totalDiscount: 0,
        taxableAmount: 0,
        gstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        tdsAmount: 0,
        totalWithGST: 0,
        finalAmount: 0
      }
    };
  }

  /**
   * Build Invoice Settings
   * @param {Object} settingsData - Invoice settings data
   * @returns {Object} Invoice settings
   */
  buildInvoiceSettings(settingsData = {}) {
    const invoiceDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (settingsData.paymentTerms || 30));

    return {
      currency: settingsData.currency || 'INR',
      invoiceDate,
      dueDate,
      paymentTerms: settingsData.paymentTerms || 30,
      overallDiscount: {
        type: settingsData.discountType || 'percentage',
        value: settingsData.discountValue || 0
      },
      notes: settingsData.notes || '',
      termsAndConditions: settingsData.termsAndConditions || this.getDefaultTermsAndConditions()
    };
  }

  /**
   * Check if transaction is interstate
   * @param {String} clientState - Client state
   * @returns {Boolean} Is interstate
   */
  checkIfInterstate(clientState) {
    // This would need to be implemented based on creator's state
    // For now, return false (same state)
    return false;
  }

  /**
   * Get Default Terms and Conditions
   * @returns {String} Default terms
   */
  getDefaultTermsAndConditions() {
    return `1. Payment is due within 30 days of invoice date.
2. Late payments may incur additional charges.
3. All content rights as per signed agreement.
4. Invoice amount is inclusive of all applicable taxes.
5. Please quote invoice number in all correspondence.`;
  }

  // ============================================
  // INVOICE MANAGEMENT OPERATIONS
  // ============================================

  /**
   * Get Invoice by ID with Population
   * @param {String} invoiceId - Invoice ID
   * @param {String} creatorId - Creator ID  
   * @returns {Object} Invoice with populated data
   */
  async getInvoiceById(invoiceId, creatorId) {
    try {
      const invoice = await Invoice.findOne({ _id: invoiceId, creatorId })
        .populate('dealReferences.dealId')
        .populate('dealReferences.dealIds')
        .populate('metadata.templateId');

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      return invoice;
    } catch (error) {
      logError('Error fetching invoice', { error: error.message, invoiceId });
      throw error;
    }
  }

  /**
   * Get Invoices List with Filters
   * @param {String} creatorId - Creator ID
   * @param {Object} filters - Filter options
   * @returns {Object} Paginated invoices list
   */
  async getInvoicesList(creatorId, filters = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        invoiceType,
        dateRange,
        clientName,
        sortBy = 'invoiceDate',
        sortOrder = 'desc'
      } = filters;

      // Build query
      const query = { creatorId };

      if (status) {
        if (Array.isArray(status)) {
          query.status = { $in: status };
        } else {
          query.status = status;
        }
      }

      if (invoiceType) {
        query.invoiceType = invoiceType;
      }

      if (dateRange) {
        query['invoiceSettings.invoiceDate'] = {
          $gte: new Date(dateRange.startDate),
          $lte: new Date(dateRange.endDate)
        };
      }

      if (clientName) {
        query['clientDetails.name'] = { $regex: clientName, $options: 'i' };
      }

      // Sort configuration
      const sortConfig = {};
      sortConfig[sortBy === 'invoiceDate' ? 'invoiceSettings.invoiceDate' : sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const skip = (page - 1) * limit;
      
      const [invoices, totalCount] = await Promise.all([
        Invoice.find(query)
          .sort(sortConfig)
          .skip(skip)
          .limit(parseInt(limit))
          .populate('dealReferences.dealId', 'brandProfile platform')
          .select('-bankDetails'), // Exclude sensitive data
        
        Invoice.countDocuments(query)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        invoices,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      };

    } catch (error) {
      logError('Error fetching invoices list', { error: error.message, creatorId });
      throw error;
    }
  }

  /**
   * Update Invoice
   * @param {String} invoiceId - Invoice ID
   * @param {Object} updateData - Update data
   * @param {String} creatorId - Creator ID
   * @returns {Object} Updated invoice
   */
  async updateInvoice(invoiceId, updateData, creatorId) {
    try {
      const invoice = await Invoice.findOne({ _id: invoiceId, creatorId });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Check if invoice can be updated
      if (invoice.status === 'paid') {
        throw new Error('Cannot update paid invoice');
      }

      // Track revision
      invoice.metadata.revisions.push({
        version: (invoice.metadata.version || 1) + 1,
        changes: updateData.revisionNotes || 'Invoice updated',
        changedBy: creatorId,
        changedAt: new Date()
      });

      invoice.metadata.version = (invoice.metadata.version || 1) + 1;

      // Update fields
      if (updateData.clientDetails) {
        invoice.clientDetails = { ...invoice.clientDetails, ...updateData.clientDetails };
      }

      if (updateData.lineItems) {
        invoice.lineItems = updateData.lineItems;
      }

      if (updateData.taxSettings) {
        invoice.taxSettings = { ...invoice.taxSettings, ...updateData.taxSettings };
      }

      if (updateData.invoiceSettings) {
        invoice.invoiceSettings = { ...invoice.invoiceSettings, ...updateData.invoiceSettings };
      }

      if (updateData.notes) {
        invoice.invoiceSettings.notes = updateData.notes;
      }

      // Save updated invoice
      await invoice.save();

      logInfo('Invoice updated successfully', { invoiceId, version: invoice.metadata.version });

      return invoice;

    } catch (error) {
      logError('Error updating invoice', { error: error.message, invoiceId });
      throw error;
    }
  }

  /**
   * Delete/Cancel Invoice
   * @param {String} invoiceId - Invoice ID
   * @param {String} creatorId - Creator ID
   * @returns {Object} Success response
   */
  async deleteInvoice(invoiceId, creatorId) {
    try {
      const invoice = await Invoice.findOne({ _id: invoiceId, creatorId });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Check if invoice can be deleted
      if (['paid', 'partially_paid'].includes(invoice.status)) {
        throw new Error('Cannot delete invoice with payments');
      }

      // Soft delete - mark as cancelled
      invoice.status = 'cancelled';
      await invoice.save();

      // Unmark deals as invoiced if this was the invoice
      if (invoice.dealReferences.dealIds.length > 0) {
        await Deal.updateMany(
          { _id: { $in: invoice.dealReferences.dealIds } },
          { $unset: { hasInvoice: 1, invoiceId: 1 } }
        );
      }

      logInfo('Invoice cancelled successfully', { invoiceId });

      return { success: true, message: 'Invoice cancelled successfully' };

    } catch (error) {
      logError('Error deleting invoice', { error: error.message, invoiceId });
      throw error;
    }
  }

  // ============================================
  // INVOICE ANALYTICS & REPORTING
  // ============================================

  /**
   * Get Invoice Analytics
   * @param {String} creatorId - Creator ID
   * @param {Object} dateRange - Date range filter
   * @returns {Object} Analytics data
   */
  async getInvoiceAnalytics(creatorId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      const query = { creatorId };

      if (startDate && endDate) {
        query['invoiceSettings.invoiceDate'] = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      // Aggregate analytics
      const analytics = await Invoice.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: 1 },
            totalAmount: { $sum: '$taxSettings.taxCalculation.finalAmount' },
            paidAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'paid'] }, '$taxSettings.taxCalculation.finalAmount', 0]
              }
            },
            pendingAmount: {
              $sum: {
                $cond: [{ $ne: ['$status', 'paid'] }, '$taxSettings.taxCalculation.finalAmount', 0]
              }
            },
            overdueCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0]
              }
            }
          }
        }
      ]);

      // Status breakdown
      const statusBreakdown = await Invoice.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$taxSettings.taxCalculation.finalAmount' }
          }
        }
      ]);

      // Invoice type breakdown
      const typeBreakdown = await Invoice.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$invoiceType',
            count: { $sum: 1 },
            amount: { $sum: '$taxSettings.taxCalculation.finalAmount' }
          }
        }
      ]);

      const result = analytics[0] || {
        totalInvoices: 0,
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        overdueCount: 0
      };

      result.statusBreakdown = statusBreakdown;
      result.typeBreakdown = typeBreakdown;
      result.collectionRate = result.totalAmount > 0 ? (result.paidAmount / result.totalAmount) * 100 : 0;

      return result;

    } catch (error) {
      logError('Error getting invoice analytics', { error: error.message, creatorId });
      throw error;
    }
  }
}

// ============================================
// EXPORT SERVICE
// ============================================

module.exports = new InvoiceService();