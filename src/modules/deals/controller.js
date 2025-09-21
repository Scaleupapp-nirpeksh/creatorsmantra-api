/**
 * CreatorsMantra Backend - Deal CRM Controller
 * Request/response handling for deal management endpoints
 *
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const dealService = require('./service')
const { successResponse, errorResponse, asyncHandler } = require('../../shared/utils')

class DealController {
  // ============================================
  // DEAL CRUD OPERATIONS
  // ============================================

  /**
   * Create a new deal
   * POST /api/v1/deals
   */
  createDeal = asyncHandler(async (req, res) => {
    const userId = req.user.id
    const dealData = req.body

    const result = await dealService.createDeal(dealData, userId)
    res.status(201).json(result)
  })

  // --------------- NEW UPDATED ROUTES ---------------
  /**
   * Update deal information
   * PUT /api/v1/deals/:dealId
   */
  patchDealById = asyncHandler(async (req, res) => {
    const { dealId } = req.params
    const { payload, returnModified } = req.body
    const result = await dealService.patchDealById(dealId, payload, returnModified)
    res.status(200).json(result)
  })
  // --------------- NEW UPDATED ROUTES ---------------

  /**
   * Get deals list with filtering and pagination
   * GET /api/v1/deals
   */
  getDeals = asyncHandler(async (req, res) => {
    const userId = req.user.id
    const filters = {
      stage: req.query.stage,
      status: req.query.status,
      platform: req.query.platform,
      brand: req.query.brand,
      priority: req.query.priority,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      search: req.query.search,
      tags: req.query.tags ? req.query.tags.split(',') : undefined,
      minValue: req.query.minValue ? parseFloat(req.query.minValue) : undefined,
      maxValue: req.query.maxValue ? parseFloat(req.query.maxValue) : undefined,
      source: req.query.source,
    }

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'desc',
    }

    const result = await dealService.getDeals(userId, filters, pagination)
    res.status(200).json(result)
  })

  /**
   * Get specific deal details
   * GET /api/v1/deals/:dealId
   */
  getDeal = asyncHandler(async (req, res) => {
    const { dealId } = req.params
    const userId = req.user.id

    const result = await dealService.getDeal(dealId, userId)
    res.status(200).json(result)
  })

  /**
   * Update deal information
   * PUT /api/v1/deals/:dealId
   */
  updateDeal = asyncHandler(async (req, res) => {
    const { dealId } = req.params
    const userId = req.user.id
    const updateData = req.body

    const result = await dealService.updateDeal(dealId, updateData, userId)
    res.status(200).json(result)
  })

  /**
   * Delete deal (soft delete)
   * DELETE /api/v1/deals/:dealId
   */
  deleteDeal = asyncHandler(async (req, res) => {
    const { dealId } = req.params
    const userId = req.user.id

    const Deal = require('./model').Deal

    const deal = await Deal.findOne({
      _id: dealId,
      userId,
      isDeleted: false,
    })

    if (!deal) {
      return res.status(404).json(errorResponse('Deal not found or access denied', 404))
    }

    // Soft delete
    deal.isDeleted = true
    deal.deletedAt = new Date()
    deal.deletedBy = userId
    await deal.save()

    res.status(200).json(
      successResponse('Deal deleted successfully', {
        dealId: deal._id,
        deletedAt: deal.deletedAt,
      })
    )
  })

  /**
   * Archive deal
   * PUT /api/v1/deals/:dealId/archive
   */
  archiveDeal = asyncHandler(async (req, res) => {
    const { dealId } = req.params
    const userId = req.user.id

    const Deal = require('./model').Deal

    const deal = await Deal.findOne({
      _id: dealId,
      userId,
      isDeleted: false,
    })

    if (!deal) {
      return res.status(404).json(errorResponse('Deal not found or access denied', 404))
    }

    deal.isArchived = !deal.isArchived
    deal.archivedAt = deal.isArchived ? new Date() : null
    deal.archivedBy = deal.isArchived ? userId : null
    await deal.save()

    res.status(200).json(
      successResponse(`Deal ${deal.isArchived ? 'archived' : 'unarchived'} successfully`, {
        dealId: deal._id,
        isArchived: deal.isArchived,
        archivedAt: deal.archivedAt,
      })
    )
  })

  // ============================================
  // DEAL PIPELINE MANAGEMENT
  // ============================================

  /**
   * Update deal stage
   * PUT /api/v1/deals/:dealId/stage
   */
  updateDealStage = asyncHandler(async (req, res) => {
    const { dealId } = req.params
    const { stage, ...additionalData } = req.body
    const userId = req.user.id

    const result = await dealService.updateDealStage(dealId, stage, userId, additionalData)
    res.status(200).json(result)
  })

  /**
   * Get pipeline overview
   * GET /api/v1/deals/pipeline/overview
   */
  getPipelineOverview = asyncHandler(async (req, res) => {
    const userId = req.user.id
    const filters = {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    }

    const result = await dealService.getPipelineOverview(userId, filters)
    res.status(200).json(result)
  })

  /**
   * Get deals by stage (for Kanban view)
   * GET /api/v1/deals/pipeline/:stage
   */
  getDealsByStage = asyncHandler(async (req, res) => {
    const { stage } = req.params
    const userId = req.user.id

    const filters = {
      stage: stage === 'all' ? undefined : stage,
      status: 'active',
      platform: req.query.platform,
      priority: req.query.priority,
      search: req.query.search,
    }

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      sortBy: req.query.sortBy || 'priority',
      sortOrder: req.query.sortOrder || 'desc',
    }

    const result = await dealService.getDeals(userId, filters, pagination)
    res.status(200).json(result)
  })

  /**
   * Get deals needing attention
   * GET /api/v1/deals/attention
   */
  getDealsNeedingAttention = asyncHandler(async (req, res) => {
    const userId = req.user.id

    const Deal = require('./model').Deal
    const dealsNeedingAttention = await Deal.findDealsNeedingAttention(userId)

    const enrichedDeals = dealsNeedingAttention.map((deal) => ({
      id: deal._id,
      dealId: deal.dealId,
      title: deal.title,
      brand: deal.brand.name,
      stage: deal.stage,
      priority: deal.priority,
      dealValue: deal.dealValue.amount,
      isOverdue: deal.isOverdue(),
      daysSinceCreated: deal.daysSinceCreated,
      alerts: dealService.generateDealAlerts ? dealService.generateDealAlerts(deal) : [],
      timeline: {
        responseDeadline: deal.timeline.responseDeadline,
        contentDeadline: deal.timeline.contentDeadline,
        paymentDueDate: deal.timeline.paymentDueDate,
      },
    }))

    res.status(200).json(
      successResponse('Deals needing attention retrieved', {
        deals: enrichedDeals,
        count: enrichedDeals.length,
        categories: {
          overdueResponse: enrichedDeals.filter((d) => d.stage === 'pitched' && d.isOverdue).length,
          overdueContent: enrichedDeals.filter(
            (d) => ['live', 'in_talks'].includes(d.stage) && d.isOverdue
          ).length,
          overduePayment: enrichedDeals.filter((d) => d.stage === 'completed' && d.isOverdue)
            .length,
        },
      })
    )
  })

  // ============================================
  // DEAL COMMUNICATION
  // ============================================

  /**
   * Add communication to deal
   * POST /api/v1/deals/:dealId/communications
   */
  addCommunication = asyncHandler(async (req, res) => {
    const { dealId } = req.params
    const userId = req.user.id
    const communicationData = {
      ...req.body,
      createdBy: userId,
    }

    const result = await dealService.addCommunication(dealId, communicationData)
    res.status(201).json(result)
  })

  /**
   * Get deal communications
   * GET /api/v1/deals/:dealId/communications
   */
  getDealCommunications = asyncHandler(async (req, res) => {
    const { dealId } = req.params
    const userId = req.user.id

    const Deal = require('./model').Deal

    const deal = await Deal.findOne({
      _id: dealId,
      userId,
      isDeleted: false,
    })
      .populate('communications.createdBy', 'fullName')
      .select('communications')

    if (!deal) {
      return res.status(404).json(errorResponse('Deal not found or access denied', 404))
    }

    const communications = deal.communications
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((comm) => ({
        id: comm._id,
        type: comm.type,
        direction: comm.direction,
        subject: comm.subject,
        summary: comm.summary,
        outcome: comm.outcome,
        nextAction: comm.nextAction,
        followUpDate: comm.followUpDate,
        attachments: comm.attachments,
        createdAt: comm.createdAt,
        createdBy: comm.createdBy,
      }))

    res.status(200).json(
      successResponse('Deal communications retrieved', {
        dealId: deal._id,
        communications,
        totalCommunications: communications.length,
      })
    )
  })

  /**
   * Update communication
   * PUT /api/v1/deals/:dealId/communications/:commId
   */
  updateCommunication = asyncHandler(async (req, res) => {
    const { dealId, commId } = req.params
    const userId = req.user.id
    const updateData = req.body

    const Deal = require('./model').Deal

    const deal = await Deal.findOne({
      _id: dealId,
      userId,
      isDeleted: false,
    })

    if (!deal) {
      return res.status(404).json(errorResponse('Deal not found or access denied', 404))
    }

    const communication = deal.communications.id(commId)
    if (!communication) {
      return res.status(404).json(errorResponse('Communication not found', 404))
    }

    // Update communication fields
    Object.keys(updateData).forEach((key) => {
      if (key !== '_id' && updateData[key] !== undefined) {
        communication[key] = updateData[key]
      }
    })

    await deal.save()

    res.status(200).json(
      successResponse('Communication updated successfully', {
        dealId: deal._id,
        communicationId: communication._id,
        updatedAt: new Date(),
      })
    )
  })

  // ============================================
  // DEAL DELIVERABLES
  // ============================================

  /**
   * Update deliverable status
   * PUT /api/v1/deals/:dealId/deliverables/:deliverableId
   */
  updateDeliverable = asyncHandler(async (req, res) => {
    const { dealId, deliverableId } = req.params
    const userId = req.user.id
    const { status, submissionUrl, revisionNotes } = req.body

    const Deal = require('./model').Deal

    const deal = await Deal.findOne({
      _id: dealId,
      userId,
      isDeleted: false,
    })

    if (!deal) {
      return res.status(404).json(errorResponse('Deal not found or access denied', 404))
    }

    const deliverable = deal.deliverables.id(deliverableId)
    if (!deliverable) {
      return res.status(404).json(errorResponse('Deliverable not found', 404))
    }

    // Update deliverable based on status
    deliverable.status = status

    if (status === 'submitted') {
      deliverable.submissionUrl = submissionUrl
      deliverable.submittedAt = new Date()
    } else if (status === 'approved') {
      deliverable.approvedAt = new Date()
    } else if (status === 'revision_required') {
      deliverable.revisionNotes = revisionNotes
      deliverable.revisionCount += 1
    } else if (status === 'completed') {
      deliverable.approvedAt = deliverable.approvedAt || new Date()
    }

    await deal.save()

    // Check if all deliverables are completed
    const allCompleted = deal.deliverables.every((d) => d.status === 'completed')
    if (allCompleted && deal.stage === 'live') {
      // Auto-advance to completed stage
      await dealService.updateDealStage(dealId, 'completed', userId, {
        autoAdvanced: true,
        reason: 'All deliverables completed',
      })
    }

    res.status(200).json(
      successResponse('Deliverable updated successfully', {
        dealId: deal._id,
        deliverableId: deliverable._id,
        status: deliverable.status,
        progress: deal.getDeliverableProgress(),
        allCompleted,
      })
    )
  })

  /**
   * Add deliverable to deal
   * POST /api/v1/deals/:dealId/deliverables
   */
  addDeliverable = asyncHandler(async (req, res) => {
    const { dealId } = req.params
    const userId = req.user.id
    const deliverableData = req.body

    const Deal = require('./model').Deal

    const deal = await Deal.findOne({
      _id: dealId,
      userId,
      isDeleted: false,
    })

    if (!deal) {
      return res.status(404).json(errorResponse('Deal not found or access denied', 404))
    }

    const newDeliverable = {
      type: deliverableData.type,
      quantity: deliverableData.quantity,
      description: deliverableData.description,
      specifications: deliverableData.specifications || {},
      deadline: deliverableData.deadline ? new Date(deliverableData.deadline) : null,
      status: 'pending',
    }

    deal.deliverables.push(newDeliverable)
    await deal.save()

    const addedDeliverable = deal.deliverables[deal.deliverables.length - 1]

    res.status(201).json(
      successResponse('Deliverable added successfully', {
        dealId: deal._id,
        deliverable: addedDeliverable,
        totalDeliverables: deal.deliverables.length,
      })
    )
  })

  // ============================================
  // BRAND PROFILES
  // ============================================

  /**
   * Get brand profiles
   * GET /api/v1/deals/brands
   */
  getBrandProfiles = asyncHandler(async (req, res) => {
    const userId = req.user.id
    const filters = {
      status: req.query.status,
      industry: req.query.industry,
      search: req.query.search,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    }

    const result = await dealService.getBrandProfiles(userId, filters)
    res.status(200).json(result)
  })

  /**
   * Get specific brand profile
   * GET /api/v1/deals/brands/:brandId
   */
  getBrandProfile = asyncHandler(async (req, res) => {
    const { brandId } = req.params
    const userId = req.user.id

    const BrandProfile = require('./model').BrandProfile

    const brand = await BrandProfile.findOne({
      _id: brandId,
      userId,
    })

    if (!brand) {
      return res.status(404).json(errorResponse('Brand profile not found', 404))
    }

    // Get deals with this brand
    const Deal = require('./model').Deal
    const deals = await Deal.find({
      userId,
      'brand.name': brand.name,
      isDeleted: false,
    })
      .select('dealId stage dealValue.amount timeline.completedDate createdAt')
      .sort({ createdAt: -1 })
      .limit(10)

    const responseData = {
      ...brand.toObject(),
      brandScore: brand.brandScore,
      totalSocialReach: brand.totalSocialReach,
      recentDeals: deals,
    }

    res.status(200).json(successResponse('Brand profile retrieved', responseData))
  })

  /**
   * Update brand profile
   * PUT /api/v1/deals/brands/:brandId
   */
  updateBrandProfile = asyncHandler(async (req, res) => {
    const { brandId } = req.params
    const userId = req.user.id
    const updateData = req.body

    const BrandProfile = require('./model').BrandProfile

    const brand = await BrandProfile.findOne({
      _id: brandId,
      userId,
    })

    if (!brand) {
      return res.status(404).json(errorResponse('Brand profile not found', 404))
    }

    // Update brand fields
    Object.keys(updateData).forEach((key) => {
      if (key !== '_id' && key !== 'userId' && updateData[key] !== undefined) {
        if (typeof brand[key] === 'object' && brand[key] !== null && !Array.isArray(brand[key])) {
          brand[key] = { ...brand[key].toObject(), ...updateData[key] }
        } else {
          brand[key] = updateData[key]
        }
      }
    })

    await brand.save()

    res.status(200).json(
      successResponse('Brand profile updated successfully', {
        brandId: brand._id,
        name: brand.name,
        updatedAt: brand.updatedAt,
      })
    )
  })

  // ============================================
  // DEAL TEMPLATES
  // ============================================

  /**
   * Create deal template
   * POST /api/v1/deals/templates
   */
  createDealTemplate = asyncHandler(async (req, res) => {
    const userId = req.user.id
    const templateData = req.body

    const result = await dealService.createDealTemplate(userId, templateData)
    res.status(201).json(result)
  })

  /**
   * Get deal templates
   * GET /api/v1/deals/templates
   */
  getDealTemplates = asyncHandler(async (req, res) => {
    const userId = req.user.id
    const filters = {
      category: req.query.category,
      isPublic: req.query.isPublic === 'true',
    }

    const result = await dealService.getDealTemplates(userId, filters)
    res.status(200).json(result)
  })

  /**
   * Update deal template
   * PUT /api/v1/deals/templates/:templateId
   */
  updateDealTemplate = asyncHandler(async (req, res) => {
    const { templateId } = req.params
    const userId = req.user.id
    const updateData = req.body

    const DealTemplate = require('./model').DealTemplate

    const template = await DealTemplate.findOne({
      _id: templateId,
      userId,
    })

    if (!template) {
      return res.status(404).json(errorResponse('Template not found or access denied', 404))
    }

    // Update template fields
    Object.keys(updateData).forEach((key) => {
      if (key !== '_id' && key !== 'userId' && updateData[key] !== undefined) {
        template[key] = updateData[key]
      }
    })

    await template.save()

    res.status(200).json(
      successResponse('Deal template updated successfully', {
        templateId: template._id,
        name: template.name,
        updatedAt: template.updatedAt,
      })
    )
  })

  /**
   * Delete deal template
   * DELETE /api/v1/deals/templates/:templateId
   */
  deleteDealTemplate = asyncHandler(async (req, res) => {
    const { templateId } = req.params
    const userId = req.user.id

    const DealTemplate = require('./model').DealTemplate

    const template = await DealTemplate.findOne({
      _id: templateId,
      userId,
    })

    if (!template) {
      return res.status(404).json(errorResponse('Template not found or access denied', 404))
    }

    await template.deleteOne()

    res.status(200).json(
      successResponse('Deal template deleted successfully', {
        templateId: template._id,
      })
    )
  })

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  /**
   * Get revenue analytics
   * GET /api/v1/deals/analytics/revenue
   */
  getRevenueAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.id
    const period = req.query.period || '30d'

    const result = await dealService.getRevenueAnalytics(userId, period)
    res.status(200).json(result)
  })

  /**
   * Get deal insights and recommendations
   * GET /api/v1/deals/analytics/insights
   */
  getDealInsights = asyncHandler(async (req, res) => {
    const userId = req.user.id

    const result = await dealService.getDealInsights(userId)
    res.status(200).json(result)
  })

  /**
   * Get deal statistics summary
   * GET /api/v1/deals/analytics/summary
   */
  getDealSummary = asyncHandler(async (req, res) => {
    const userId = req.user.id
    const { period = '30d' } = req.query

    const Deal = require('./model').Deal

    // Calculate date range
    const now = new Date()
    let startDate

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    const [summaryStats, stageCounts] = await Promise.all([
      Deal.aggregate([
        {
          $match: {
            userId: new Deal.base.Types.ObjectId(userId),
            createdAt: { $gte: startDate },
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            totalDeals: { $sum: 1 },
            totalValue: { $sum: '$dealValue.amount' },
            avgDealValue: { $avg: '$dealValue.amount' },
            paidDeals: {
              $sum: { $cond: [{ $eq: ['$stage', 'paid'] }, 1, 0] },
            },
            paidValue: {
              $sum: { $cond: [{ $eq: ['$stage', 'paid'] }, '$dealValue.finalAmount', 0] },
            },
            activeDeals: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
          },
        },
      ]),
      Deal.aggregate([
        {
          $match: {
            userId: new Deal.base.Types.ObjectId(userId),
            isDeleted: false,
            status: 'active',
          },
        },
        {
          $group: {
            _id: '$stage',
            count: { $sum: 1 },
            value: { $sum: '$dealValue.amount' },
          },
        },
      ]),
    ])

    const summary = summaryStats[0] || {
      totalDeals: 0,
      totalValue: 0,
      avgDealValue: 0,
      paidDeals: 0,
      paidValue: 0,
      activeDeals: 0,
    }

    const stageBreakdown = {}
    const stages = ['pitched', 'in_talks', 'negotiating', 'live', 'completed', 'paid']

    stages.forEach((stage) => {
      const stageData = stageCounts.find((s) => s._id === stage) || { count: 0, value: 0 }
      stageBreakdown[stage] = stageData
    })

    // Calculate conversion rate
    summary.conversionRate =
      summary.totalDeals > 0 ? Math.round((summary.paidDeals / summary.totalDeals) * 100) : 0

    res.status(200).json(
      successResponse('Deal summary retrieved', {
        summary,
        stageBreakdown,
        period,
      })
    )
  })

  // ============================================
  // UTILITY ENDPOINTS
  // ============================================

  /**
   * Get deal options/metadata
   * GET /api/v1/deals/metadata
   */
  getDealMetadata = asyncHandler(async (req, res) => {
    const metadata = {
      stages: [
        { value: 'pitched', label: 'Pitched', description: 'Initial proposal sent to brand' },
        {
          value: 'in_talks',
          label: 'In Talks',
          description: 'Brand showed interest, discussing details',
        },
        {
          value: 'negotiating',
          label: 'Negotiating',
          description: 'Formal negotiations in progress',
        },
        { value: 'live', label: 'Live', description: 'Campaign is active, creating content' },
        {
          value: 'completed',
          label: 'Completed',
          description: 'Content delivered, awaiting payment',
        },
        { value: 'paid', label: 'Paid', description: 'Payment received, deal completed' },
        { value: 'cancelled', label: 'Cancelled', description: 'Deal was cancelled' },
        { value: 'rejected', label: 'Rejected', description: 'Deal was rejected by brand' },
      ],
      platforms: [
        { value: 'instagram', label: 'Instagram' },
        { value: 'youtube', label: 'YouTube' },
        { value: 'linkedin', label: 'LinkedIn' },
        { value: 'twitter', label: 'Twitter' },
        { value: 'facebook', label: 'Facebook' },
        { value: 'snapchat', label: 'Snapchat' },
        { value: 'multiple', label: 'Multiple Platforms' },
      ],
      deliverableTypes: [
        { value: 'instagram_post', label: 'Instagram Post' },
        { value: 'instagram_reel', label: 'Instagram Reel' },
        { value: 'instagram_story', label: 'Instagram Story' },
        { value: 'youtube_video', label: 'YouTube Video' },
        { value: 'youtube_short', label: 'YouTube Short' },
        { value: 'linkedin_post', label: 'LinkedIn Post' },
        { value: 'blog_post', label: 'Blog Post' },
        { value: 'product_unboxing', label: 'Product Unboxing' },
        { value: 'brand_collaboration', label: 'Brand Collaboration' },
      ],
      industries: [
        { value: 'fashion', label: 'Fashion' },
        { value: 'beauty', label: 'Beauty' },
        { value: 'lifestyle', label: 'Lifestyle' },
        { value: 'tech', label: 'Technology' },
        { value: 'food', label: 'Food & Beverage' },
        { value: 'travel', label: 'Travel' },
        { value: 'fitness', label: 'Fitness' },
        { value: 'finance', label: 'Finance' },
        { value: 'education', label: 'Education' },
        { value: 'entertainment', label: 'Entertainment' },
      ],
      paymentTerms: [
        { value: 'full_advance', label: '100% Advance' },
        { value: '50_50', label: '50% Advance, 50% on Completion' },
        { value: '30_70', label: '30% Advance, 70% on Completion' },
        { value: 'on_delivery', label: '100% on Delivery' },
        { value: 'net_30', label: 'Net 30 Days' },
        { value: 'net_15', label: 'Net 15 Days' },
        { value: 'custom', label: 'Custom Terms' },
      ],
      priorities: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' },
      ],
      sources: [
        { value: 'direct_outreach', label: 'Direct Outreach' },
        { value: 'brand_inquiry', label: 'Brand Inquiry' },
        { value: 'referral', label: 'Referral' },
        { value: 'social_media', label: 'Social Media' },
        { value: 'networking', label: 'Networking' },
        { value: 'repeat_client', label: 'Repeat Client' },
      ],
    }

    res.status(200).json(successResponse('Deal metadata retrieved', metadata))
  })

  /**
   * Quick deal actions
   * POST /api/v1/deals/:dealId/actions/:action
   */
  performQuickAction = asyncHandler(async (req, res) => {
    const { dealId, action } = req.params
    const userId = req.user.id
    const actionData = req.body

    const Deal = require('./model').Deal

    const deal = await Deal.findOne({
      _id: dealId,
      userId,
      isDeleted: false,
    })

    if (!deal) {
      return res.status(404).json(errorResponse('Deal not found or access denied', 404))
    }

    let result

    switch (action) {
      case 'duplicate':
        // Create a copy of the deal
        const duplicatedDeal = new Deal({
          ...deal.toObject(),
          _id: undefined,
          dealId: undefined,
          title: `${deal.title} (Copy)`,
          stage: 'pitched',
          timeline: {
            pitchedDate: new Date(),
          },
          communications: [],
          createdAt: undefined,
          updatedAt: undefined,
        })

        await duplicatedDeal.save()

        result = successResponse('Deal duplicated successfully', {
          originalDealId: dealId,
          newDealId: duplicatedDeal._id,
          newDealNumber: duplicatedDeal.dealId,
        })
        break

      case 'convert_to_template':
        // Convert deal to template
        const templateResult = await dealService.createDealTemplate(userId, {
          name: `Template: ${deal.title}`,
          description: `Template created from deal ${deal.dealId}`,
          category: deal.platform,
          platform: deal.platform,
          deliverables: deal.deliverables,
          defaultValue: deal.dealValue.amount,
          paymentTerms: deal.dealValue.paymentTerms,
          campaignRequirements: deal.campaignRequirements,
        })

        result = templateResult
        break

      case 'send_reminder':
        // Add reminder communication
        await dealService.addCommunication(dealId, {
          type: 'email',
          direction: 'outbound',
          subject: actionData.subject || 'Follow-up reminder',
          summary: actionData.message || 'Sent follow-up reminder to brand',
          outcome: 'follow_up_required',
          followUpDate: actionData.followUpDate ? new Date(actionData.followUpDate) : null,
          createdBy: userId,
        })

        result = successResponse('Reminder sent successfully')
        break

      default:
        return res.status(400).json(errorResponse(`Unknown action: ${action}`, 400))
    }

    res.status(200).json(result)
  })

  /**
   * Bulk update deals
   * PUT /api/v1/deals/bulk
   */
  bulkUpdateDeals = asyncHandler(async (req, res) => {
    const userId = req.user.id
    const { dealIds, updateData } = req.body

    if (!dealIds || !Array.isArray(dealIds) || dealIds.length === 0) {
      return res.status(400).json(errorResponse('Deal IDs array is required', 400))
    }

    if (dealIds.length > 50) {
      return res.status(400).json(errorResponse('Cannot update more than 50 deals at once', 400))
    }

    const Deal = require('./model').Deal

    // Validate that user owns all deals
    const deals = await Deal.find({
      _id: { $in: dealIds },
      userId,
      isDeleted: false,
    })

    if (deals.length !== dealIds.length) {
      return res.status(403).json(errorResponse('Some deals not found or access denied', 403))
    }

    // Perform bulk update
    const allowedFields = ['stage', 'priority', 'tags', 'status']
    const filteredUpdateData = {}

    Object.keys(updateData).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredUpdateData[key] = updateData[key]
      }
    })

    const updateResult = await Deal.updateMany(
      { _id: { $in: dealIds } },
      { $set: filteredUpdateData }
    )

    res.status(200).json(
      successResponse('Deals updated successfully', {
        updatedCount: updateResult.modifiedCount,
        totalRequested: dealIds.length,
        updatedFields: Object.keys(filteredUpdateData),
      })
    )
  })
}

module.exports = new DealController()
