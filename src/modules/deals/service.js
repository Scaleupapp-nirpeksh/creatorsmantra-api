/**
 * CreatorsMantra Backend - Deal CRM Service
 * Business logic for deal pipeline management, brand relationships, and revenue tracking
 *
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const { Deal, BrandProfile, DealTemplate } = require('./model')
const { User, CreatorProfile } = require('../auth/model')
const {
  successResponse,
  errorResponse,
  generateRandomString,
  calculateGST,
  calculateTDS,
  formatCurrency,
  sendEmail,
  logInfo,
  logError,
} = require('../../shared/utils')

class DealService {
  // ============================================
  // DEAL CREATION & MANAGEMENT
  // ============================================

  /**
   * Create a new deal
   * @param {Object} dealData - Deal information
   * @param {String} userId - Creator's user ID
   * @returns {Object} Created deal
   */
  async createDeal(dealData, userId) {
    try {
      const {
        title,
        brand,
        platform,
        deliverables,
        dealValue,
        timeline,
        campaignRequirements,
        source,
        templateId,
      } = dealData

      // Validate user subscription limits
      const user = await User.findById(userId)
      if (!user) {
        throw new Error('User not found')
      }

      const subscriptionLimits = User.getSubscriptionLimits(user.subscriptionTier)
      const activeDealsCount = await Deal.countDocuments({
        userId,
        status: 'active',
        isDeleted: false,
      })

      if (
        subscriptionLimits.maxActiveDeals !== -1 &&
        activeDealsCount >= subscriptionLimits.maxActiveDeals
      ) {
        throw new Error(
          `Active deals limit reached. Upgrade to ${this.getNextTier(
            user.subscriptionTier
          )} plan for unlimited deals.`
        )
      }

      // If using template, merge template data
      let mergedDealData = dealData
      if (templateId) {
        const template = await DealTemplate.findById(templateId)
        if (template && template.userId.toString() === userId) {
          mergedDealData = this.mergeTemplateData(dealData, template.template)

          // Update template usage stats
          template.usage.timesUsed += 1
          template.usage.lastUsed = new Date()
          await template.save()
        }
      }

      // Create the deal
      const deal = new Deal({
        userId,
        title,
        brand: {
          name: brand.name,
          contactPerson: brand.contactPerson || {},
          website: brand.website,
          industry: brand.industry || 'other',
          companySize: brand.companySize || 'startup',
        },
        platform,
        deliverables: deliverables.map((d) => ({
          type: d.type,
          quantity: d.quantity,
          description: d.description,
          specifications: d.specifications || {},
          deadline: d.deadline ? new Date(d.deadline) : null,
          status: 'pending',
        })),
        dealValue: {
          amount: dealValue.amount,
          currency: dealValue.currency || 'INR',
          paymentTerms: dealValue.paymentTerms || '50_50',
          customPaymentTerms: dealValue.customPaymentTerms,
          gstApplicable: dealValue.gstApplicable !== false,
          tdsApplicable: dealValue.tdsApplicable || false,
        },
        timeline: {
          pitchedDate: new Date(),
          responseDeadline: timeline.responseDeadline ? new Date(timeline.responseDeadline) : null,
          contentDeadline: timeline.contentDeadline ? new Date(timeline.contentDeadline) : null,
          goLiveDate: timeline.goLiveDate ? new Date(timeline.goLiveDate) : null,
          paymentDueDate: timeline.paymentDueDate ? new Date(timeline.paymentDueDate) : null,
        },
        campaignRequirements: campaignRequirements || {},
        source: source || 'direct_outreach',
        stage: 'pitched',
        status: 'active',
      })

      await deal.save()

      // Create or update brand profile
      await this.createOrUpdateBrandProfile(userId, brand)

      // Add initial communication if provided
      if (dealData.initialCommunication) {
        await this.addCommunication(deal._id, {
          ...dealData.initialCommunication,
          createdBy: userId,
        })
      }

      logInfo('Deal created successfully', {
        userId,
        dealId: deal.dealId,
        brandName: brand.name,
        dealValue: dealValue.amount,
      })

      return successResponse(
        'Deal created successfully',
        {
          dealId: deal._id,
          dealNumber: deal.dealId,
          stage: deal.stage,
          value: deal.dealValue.finalAmount,
          brand: deal.brand.name,
        },
        201
      )
    } catch (error) {
      logError('Deal creation failed', { userId, error: error.message })
      throw error
    }
  }

  // --------------- NEW UPDATED ROUTES ---------------
  /**
   * Update Deal's data
   * @param {Object} dId - Deal ID
   * @param {String} payload - To udpate / Keys to patch
   * @param {String} returnModified - if true returns updated document
   * @returns {Object} returns updated document or null
   */
  async patchDealById(dId, payload, returnModified = false) {
    if (!dId || !payload) throw new Error('Invalid Params')

    const _result = await Deal.findByIdAndUpdate({ _id: dId }, payload, {
      new: returnModified,
    })

    // console.log(_result)
    return _result
  }
  // --------------- NEW UPDATED ROUTES ---------------

  /**
   * Update deal information
   * @param {String} dealId - Deal ID
   * @param {Object} updateData - Updated deal data
   * @param {String} userId - User ID
   * @returns {Object} Updated deal
   */
  async updateDeal(dealId, updateData, userId) {
    try {
      const deal = await Deal.findOne({
        _id: dealId,
        userId,
        isDeleted: false,
      })

      if (!deal) {
        throw new Error('Deal not found or access denied')
      }

      // Validate stage transition if stage is being updated
      if (updateData.stage && updateData.stage !== deal.stage) {
        const isValidTransition = this.validateStageTransition(deal.stage, updateData.stage)
        if (!isValidTransition) {
          throw new Error(`Invalid stage transition from ${deal.stage} to ${updateData.stage}`)
        }

        // Auto-update timeline based on stage
        updateData.timeline = updateData.timeline || {}

        if (updateData.stage === 'in_talks' && !deal.timeline.negotiationStartDate) {
          updateData.timeline.negotiationStartDate = new Date()
        } else if (updateData.stage === 'live' && !deal.timeline.contractSignedDate) {
          updateData.timeline.contractSignedDate = new Date()
          updateData.timeline.contentCreationStart = new Date()
        } else if (updateData.stage === 'completed' && !deal.timeline.completedDate) {
          updateData.timeline.completedDate = new Date()
        }
      }

      // Update deal fields
      Object.keys(updateData).forEach((key) => {
        if (key === 'timeline' && updateData.timeline) {
          deal.timeline = { ...deal.timeline.toObject(), ...updateData.timeline }
        } else if (key === 'dealValue' && updateData.dealValue) {
          deal.dealValue = { ...deal.dealValue.toObject(), ...updateData.dealValue }
        } else if (key !== '_id' && key !== 'userId' && key !== 'dealId') {
          deal[key] = updateData[key]
        }
      })

      await deal.save()

      // Update brand profile collaboration stats if brand changed
      if (updateData.brand) {
        await this.createOrUpdateBrandProfile(userId, updateData.brand)
      }

      logInfo('Deal updated successfully', {
        userId,
        dealId: deal.dealId,
        updatedFields: Object.keys(updateData),
      })

      return successResponse('Deal updated successfully', {
        dealId: deal._id,
        stage: deal.stage,
        value: deal.dealValue.finalAmount,
        lastModified: deal.updatedAt,
      })
    } catch (error) {
      logError('Deal update failed', { dealId, userId, error: error.message })
      throw error
    }
  }

  /**
   * Get deal details
   * @param {String} dealId - Deal ID
   * @param {String} userId - User ID
   * @returns {Object} Deal details
   */
  async getDeal(dealId, userId) {
    try {
      const deal = await Deal.findOne({
        _id: dealId,
        userId,
        isDeleted: false,
      }).populate('invoices')
      // TODO:
      // .populate('assignedManager', 'fullName email')
      // .populate('collaborators.userId', 'fullName email')

      if (!deal) throw new Error('Deal not found or access denied')

      // Get brand profile if exists
      const brandProfile = await BrandProfile.findOne({
        userId,
        name: deal.brand.name,
      })

      const responseData = {
        ...deal.toObject(),
        progress: deal.getProgress(),
        deliverableProgress: deal.getDeliverableProgress(),
        isOverdue: deal.isOverdue(),
        brandProfile: brandProfile || null,
        alerts: this.generateDealAlerts(deal),
      }

      return successResponse('Deal details retrieved', responseData)
    } catch (error) {
      logError('Get deal failed', { dealId, userId, error: error.message })
      throw error
    }
  }

  /**
   * Get deals list with filtering and pagination
   * @param {String} userId - User ID
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Object} Paginated deals list
   */
  async getDeals(userId, filters = {}, pagination = {}) {
    try {
      const {
        stage,
        status,
        platform,
        brand,
        priority,
        dateFrom,
        dateTo,
        search,
        tags,
        minValue,
        maxValue,
        source,
      } = filters

      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination

      // Build query
      const query = {
        userId,
        isDeleted: false,
      }

      if (stage) query.stage = Array.isArray(stage) ? { $in: stage } : stage
      if (status) query.status = status
      if (platform) query.platform = platform
      if (priority) query.priority = priority
      if (source) query.source = source
      if (brand) query['brand.name'] = new RegExp(brand, 'i')
      if (tags && tags.length > 0) query.tags = { $in: tags }

      // Value range filter
      if (minValue || maxValue) {
        query['dealValue.amount'] = {}
        if (minValue) query['dealValue.amount'].$gte = minValue
        if (maxValue) query['dealValue.amount'].$lte = maxValue
      }

      // Date range filter
      if (dateFrom || dateTo) {
        query.createdAt = {}
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom)
        if (dateTo) query.createdAt.$lte = new Date(dateTo)
      }

      // Search filter
      if (search) {
        query.$or = [
          { title: new RegExp(search, 'i') },
          { 'brand.name': new RegExp(search, 'i') },
          { 'brand.contactPerson.name': new RegExp(search, 'i') },
          { dealId: new RegExp(search, 'i') },
          { tags: new RegExp(search, 'i') },
        ]
      }

      // Pagination
      const skip = (page - 1) * limit
      const sort = {}
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1

      // Execute query
      const [deals, total] = await Promise.all([
        Deal.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('assignedManager', 'fullName')
          .lean(),
        Deal.countDocuments(query),
      ])

      const totalPages = Math.ceil(total / limit)

      // Add computed fields to deals
      const enrichedDeals = deals.map((deal) => ({
        ...deal,
        progress: this.calculateProgress(deal.stage),
        daysSinceCreated: Math.floor(
          (Date.now() - deal.createdAt.getTime()) / (24 * 60 * 60 * 1000)
        ),
        isOverdue: this.checkIfOverdue(deal),
        nextAction: this.getNextAction(deal),
      }))

      return successResponse('Deals retrieved successfully', {
        deals: enrichedDeals,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: total,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          limit,
        },
        summary: {
          totalDeals: total,
          activeDeals: deals.filter((d) => d.status === 'active').length,
          totalValue: deals.reduce((sum, d) => sum + d.dealValue.amount, 0),
          avgDealValue:
            total > 0 ? deals.reduce((sum, d) => sum + d.dealValue.amount, 0) / total : 0,
        },
      })
    } catch (error) {
      logError('Get deals failed', { userId, filters, error: error.message })
      throw error
    }
  }

  // ============================================
  // DEAL PIPELINE MANAGEMENT
  // ============================================

  /**
   * Update deal stage
   * @param {String} dealId - Deal ID
   * @param {String} newStage - New stage
   * @param {String} userId - User ID
   * @param {Object} additionalData - Additional data for stage update
   * @returns {Object} Updated deal
   */
  async updateDealStage(dealId, newStage, userId, additionalData = {}) {
    try {
      const deal = await Deal.findOne({
        _id: dealId,
        userId,
        isDeleted: false,
      })

      if (!deal) {
        throw new Error('Deal not found or access denied')
      }

      const oldStage = deal.stage

      // Validate stage transition
      if (!this.validateStageTransition(oldStage, newStage)) {
        throw new Error(`Invalid stage transition from ${oldStage} to ${newStage}`)
      }

      // Update stage and relevant timeline
      deal.stage = newStage

      const stageUpdateActions = {
        in_talks: () => {
          if (!deal.timeline.negotiationStartDate) {
            deal.timeline.negotiationStartDate = new Date()
          }
        },
        negotiating: () => {
          // Can set custom negotiation details
          if (additionalData.negotiationNotes) {
            deal.internalNotes = deal.internalNotes
              ? `${deal.internalNotes}\n\nNegotiation Notes: ${additionalData.negotiationNotes}`
              : `Negotiation Notes: ${additionalData.negotiationNotes}`
          }
        },
        live: () => {
          if (!deal.timeline.contractSignedDate) {
            deal.timeline.contractSignedDate = new Date()
          }
          if (!deal.timeline.contentCreationStart) {
            deal.timeline.contentCreationStart = new Date()
          }
          // Set go-live date if provided
          if (additionalData.goLiveDate) {
            deal.timeline.goLiveDate = new Date(additionalData.goLiveDate)
          }
        },
        completed: () => {
          if (!deal.timeline.completedDate) {
            deal.timeline.completedDate = new Date()
          }
          // Set payment due date (typically 30 days from completion)
          if (!deal.timeline.paymentDueDate) {
            const paymentDueDate = new Date()
            paymentDueDate.setDate(paymentDueDate.getDate() + 30)
            deal.timeline.paymentDueDate = paymentDueDate
          }
        },
        paid: () => {
          deal.status = 'completed'
          // Create performance tracking entry if not exists
          if (!deal.performance.isTracked) {
            deal.performance.isTracked = true
          }
        },
        cancelled: () => {
          deal.status = 'cancelled'
          if (additionalData.cancellationReason) {
            deal.internalNotes = deal.internalNotes
              ? `${deal.internalNotes}\n\nCancellation Reason: ${additionalData.cancellationReason}`
              : `Cancellation Reason: ${additionalData.cancellationReason}`
          }
        },
        rejected: () => {
          deal.status = 'cancelled'
          if (additionalData.rejectionReason) {
            deal.internalNotes = deal.internalNotes
              ? `${deal.internalNotes}\n\nRejection Reason: ${additionalData.rejectionReason}`
              : `Rejection Reason: ${additionalData.rejectionReason}`
          }
        },
      }

      // Execute stage-specific actions
      if (stageUpdateActions[newStage]) {
        stageUpdateActions[newStage]()
      }

      await deal.save()

      // Add automatic communication log
      const communicationMessage = this.getStageUpdateMessage(oldStage, newStage)
      await this.addCommunication(dealId, {
        type: 'other', // ✅ Valid enum value
        direction: 'outbound', // ✅ Valid enum value
        subject: `Stage updated: ${oldStage} → ${newStage}`,
        summary: communicationMessage,
        outcome: 'neutral',
        createdBy: userId,
      })

      // Update brand profile stats
      const brandProfile = await BrandProfile.findOne({
        userId,
        name: deal.brand.name,
      })

      if (brandProfile) {
        await brandProfile.updateCollaborationStats()
      }

      logInfo('Deal stage updated', {
        userId,
        dealId: deal.dealId,
        oldStage,
        newStage,
        dealValue: deal.dealValue.amount,
      })

      return successResponse('Deal stage updated successfully', {
        dealId: deal._id,
        oldStage,
        newStage,
        progress: deal.getProgress(),
        nextActions: this.getNextActions(deal),
      })
    } catch (error) {
      logError('Deal stage update failed', { dealId, newStage, userId, error: error.message })
      throw error
    }
  }

  /**
   * Get pipeline overview
   * @param {String} userId - User ID
   * @param {Object} filters - Optional filters
   * @returns {Object} Pipeline statistics
   */
  async getPipelineOverview(userId, filters = {}) {
    try {
      const { dateFrom, dateTo } = filters

      const query = {
        userId,
        isDeleted: false,
      }

      // Apply date filter if provided
      if (dateFrom || dateTo) {
        query.createdAt = {}
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom)
        if (dateTo) query.createdAt.$lte = new Date(dateTo)
      }

      // Aggregate pipeline data
      const [stageStats, platformStats, revenueStats] = await Promise.all([
        // Stage distribution
        Deal.aggregate([
          { $match: query },
          {
            $group: {
              _id: '$stage',
              count: { $sum: 1 },
              totalValue: { $sum: '$dealValue.amount' },
              avgValue: { $avg: '$dealValue.amount' },
            },
          },
        ]),

        // Platform distribution
        Deal.aggregate([
          { $match: query },
          {
            $group: {
              _id: '$platform',
              count: { $sum: 1 },
              totalValue: { $sum: '$dealValue.amount' },
            },
          },
        ]),

        // Revenue metrics
        Deal.aggregate([
          { $match: query },
          {
            $group: {
              _id: null,
              totalDeals: { $sum: 1 },
              totalPipelineValue: { $sum: '$dealValue.amount' },
              totalRevenue: {
                $sum: {
                  $cond: [{ $in: ['$stage', ['completed', 'paid']] }, '$dealValue.finalAmount', 0],
                },
              },
              activeDeals: {
                $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
              },
              avgDealValue: { $avg: '$dealValue.amount' },
              conversionRate: {
                $multiply: [
                  {
                    $divide: [
                      { $sum: { $cond: [{ $eq: ['$stage', 'paid'] }, 1, 0] } },
                      '$totalDeals',
                    ],
                  },
                  100,
                ],
              },
            },
          },
        ]),
      ])

      // Format stage statistics
      const stageData = {}
      const stages = [
        'pitched',
        'in_talks',
        'negotiating',
        'live',
        'completed',
        'paid',
        'cancelled',
        'rejected',
      ]

      stages.forEach((stage) => {
        const stageInfo = stageStats.find((s) => s._id === stage) || {
          count: 0,
          totalValue: 0,
          avgValue: 0,
        }
        stageData[stage] = {
          count: stageInfo.count,
          totalValue: stageInfo.totalValue,
          avgValue: Math.round(stageInfo.avgValue || 0),
        }
      })

      // Format platform statistics
      const platformData = {}
      platformStats.forEach((p) => {
        platformData[p._id] = {
          count: p.count,
          totalValue: p.totalValue,
        }
      })

      // Calculate conversion funnel
      const conversionFunnel = this.calculateConversionFunnel(stageData)

      // Get deals needing attention
      const dealsNeedingAttention = await Deal.findDealsNeedingAttention(userId)

      const responseData = {
        overview: revenueStats[0] || {
          totalDeals: 0,
          totalPipelineValue: 0,
          totalRevenue: 0,
          activeDeals: 0,
          avgDealValue: 0,
          conversionRate: 0,
        },
        stageDistribution: stageData,
        platformDistribution: platformData,
        conversionFunnel,
        dealsNeedingAttention: dealsNeedingAttention.length,
        alerts: {
          overdueResponse: dealsNeedingAttention.filter(
            (d) => d.stage === 'pitched' && d.isOverdue()
          ).length,
          overdueContent: dealsNeedingAttention.filter(
            (d) => ['live', 'in_talks'].includes(d.stage) && d.isOverdue()
          ).length,
          overduePayment: dealsNeedingAttention.filter(
            (d) => d.stage === 'completed' && d.isOverdue()
          ).length,
        },
      }

      return successResponse('Pipeline overview retrieved', responseData)
    } catch (error) {
      logError('Pipeline overview failed', { userId, error: error.message })
      throw error
    }
  }

  // ============================================
  // DEAL COMMUNICATION MANAGEMENT
  // ============================================

  /**
   * Add communication to deal
   * @param {String} dealId - Deal ID
   * @param {Object} communicationData - Communication details
   * @returns {Object} Success response
   */
  async addCommunication(dealId, communicationData) {
    try {
      const {
        type,
        direction,
        subject,
        summary,
        outcome,
        nextAction,
        followUpDate,
        attachments,
        createdBy,
      } = communicationData

      const deal = await Deal.findById(dealId)
      if (!deal) {
        throw new Error('Deal not found')
      }

      const communication = {
        type,
        direction,
        subject,
        summary,
        outcome: outcome || 'neutral',
        nextAction,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        attachments: attachments || [],
        createdAt: new Date(),
        createdBy,
      }

      deal.communications.push(communication)
      await deal.save()

      logInfo('Communication added to deal', {
        dealId: deal.dealId,
        type,
        direction,
        createdBy,
      })

      return successResponse('Communication added successfully', {
        communicationId: deal.communications[deal.communications.length - 1]._id,
        dealId: deal._id,
        totalCommunications: deal.communications.length,
      })
    } catch (error) {
      logError('Add communication failed', { dealId, error: error.message })
      throw error
    }
  }

  // ============================================
  // BRAND PROFILE MANAGEMENT
  // ============================================

  /**
   * Create or update brand profile
   * @param {String} userId - User ID
   * @param {Object} brandData - Brand information
   * @returns {Object} Brand profile
   */
  async createOrUpdateBrandProfile(userId, brandData) {
    try {
      let brandProfile = await BrandProfile.findOne({
        userId,
        name: brandData.name,
      })

      if (brandProfile) {
        // Update existing brand profile
        Object.keys(brandData).forEach((key) => {
          if (key !== 'name' && brandData[key] !== undefined) {
            if (key === 'primaryContact') {
              brandProfile.primaryContact = {
                ...brandProfile.primaryContact.toObject(),
                ...brandData[key],
              }
            } else {
              brandProfile[key] = brandData[key]
            }
          }
        })

        await brandProfile.save()
        await brandProfile.updateCollaborationStats()
      } else {
        // Create new brand profile
        brandProfile = new BrandProfile({
          userId,
          name: brandData.name,
          website: brandData.website,
          description: brandData.description,
          industry: brandData.industry || 'other',
          companySize: brandData.companySize || 'startup',
          primaryContact: brandData.contactPerson || {},
          status: 'potential',
        })

        await brandProfile.save()
      }

      return brandProfile
    } catch (error) {
      logError('Brand profile creation/update failed', {
        userId,
        brandName: brandData.name,
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Get brand profiles
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Brand profiles list
   */
  async getBrandProfiles(userId, filters = {}) {
    try {
      const { status, industry, search, page = 1, limit = 20 } = filters

      const query = { userId }
      if (status) query.status = status
      if (industry) query.industry = industry
      if (search) {
        query.$or = [
          { name: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') },
          { 'primaryContact.name': new RegExp(search, 'i') },
        ]
      }

      const skip = (page - 1) * limit

      const [brands, total] = await Promise.all([
        BrandProfile.find(query)
          .sort({ 'collaborationHistory.lastCollaboration': -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        BrandProfile.countDocuments(query),
      ])

      const totalPages = Math.ceil(total / limit)

      return successResponse('Brand profiles retrieved', {
        brands: brands.map((brand) => ({
          ...brand.toObject(),
          brandScore: brand.brandScore,
          totalSocialReach: brand.totalSocialReach,
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: total,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      })
    } catch (error) {
      logError('Get brand profiles failed', { userId, error: error.message })
      throw error
    }
  }

  // ============================================
  // DEAL TEMPLATES
  // ============================================

  /**
   * Create deal template
   * @param {String} userId - User ID
   * @param {Object} templateData - Template data
   * @returns {Object} Created template
   */
  async createDealTemplate(userId, templateData) {
    try {
      const {
        name,
        description,
        category,
        platform,
        deliverables,
        defaultValue,
        paymentTerms,
        timeline,
        campaignRequirements,
        isPublic,
      } = templateData

      const template = new DealTemplate({
        userId,
        name,
        description,
        category,
        template: {
          platform,
          deliverables,
          defaultValue,
          paymentTerms,
          timeline,
          campaignRequirements,
        },
        isPublic: isPublic || false,
        tags: templateData.tags || [],
      })

      await template.save()

      logInfo('Deal template created', {
        userId,
        templateId: template._id,
        name,
        category,
      })

      return successResponse(
        'Deal template created successfully',
        {
          templateId: template._id,
          name: template.name,
          category: template.category,
        },
        201
      )
    } catch (error) {
      logError('Deal template creation failed', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Get deal templates
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Templates list
   */
  async getDealTemplates(userId, filters = {}) {
    try {
      const { category, isPublic } = filters

      const query = {
        $or: [
          { userId }, // User's own templates
          { isPublic: true }, // Public templates
        ],
      }

      if (category) query['template.platform'] = category
      if (isPublic !== undefined) query.isPublic = isPublic

      const templates = await DealTemplate.find(query)
        .sort({ 'usage.timesUsed': -1, createdAt: -1 })
        .populate('userId', 'fullName')

      return successResponse('Deal templates retrieved', {
        templates: templates.map((template) => ({
          id: template._id,
          name: template.name,
          description: template.description,
          category: template.category,
          template: template.template,
          usage: template.usage,
          isOwn: template.userId._id.toString() === userId,
          createdBy: template.userId.fullName,
          createdAt: template.createdAt,
        })),
      })
    } catch (error) {
      logError('Get deal templates failed', { userId, error: error.message })
      throw error
    }
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  /**
   * Get revenue analytics
   * @param {String} userId - User ID
   * @param {String} period - Time period (7d, 30d, 90d, 1y)
   * @returns {Object} Revenue analytics
   */
  async getRevenueAnalytics(userId, period = '30d') {
    try {
      const analytics = await Deal.getRevenueAnalytics(userId, period)

      if (!analytics || analytics.length === 0) {
        return successResponse('Revenue analytics retrieved', {
          totalDeals: 0,
          totalValue: 0,
          totalRevenue: 0,
          paidDeals: 0,
          paidRevenue: 0,
          avgDealValue: 0,
          conversionRate: 0,
          period,
        })
      }

      const data = analytics[0]
      data.conversionRate = data.totalDeals > 0 ? (data.paidDeals / data.totalDeals) * 100 : 0
      data.period = period

      return successResponse('Revenue analytics retrieved', data)
    } catch (error) {
      logError('Revenue analytics failed', { userId, period, error: error.message })
      throw error
    }
  }

  /**
   * Get deal insights and recommendations
   * @param {String} userId - User ID
   * @returns {Object} Deal insights
   */
  async getDealInsights(userId) {
    try {
      // Get various insights
      const [topBrands, platformPerformance, monthlyTrends, dealCycle] = await Promise.all([
        this.getTopBrands(userId),
        this.getPlatformPerformance(userId),
        this.getMonthlyTrends(userId),
        this.getDealCycleAnalysis(userId),
      ])

      const insights = {
        topBrands,
        platformPerformance,
        monthlyTrends,
        dealCycle,
        recommendations: this.generateRecommendations({
          topBrands,
          platformPerformance,
          monthlyTrends,
          dealCycle,
        }),
      }

      return successResponse('Deal insights retrieved', insights)
    } catch (error) {
      logError('Deal insights failed', { userId, error: error.message })
      throw error
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Validate stage transition
   * @param {String} currentStage - Current stage
   * @param {String} newStage - New stage
   * @returns {Boolean} Is valid transition
   */
  validateStageTransition(currentStage, newStage) {
    const validTransitions = {
      pitched: ['in_talks', 'rejected', 'cancelled'],
      in_talks: ['negotiating', 'live', 'rejected', 'cancelled'],
      negotiating: ['live', 'rejected', 'cancelled'],
      live: ['completed', 'cancelled'],
      completed: ['paid', 'cancelled'],
      paid: [], // Final state
      cancelled: [], // Final state
      rejected: [], // Final state
    }

    return validTransitions[currentStage]?.includes(newStage) || false
  }

  /**
   * Calculate progress percentage for stage
   * @param {String} stage - Deal stage
   * @returns {Number} Progress percentage
   */
  calculateProgress(stage) {
    const stageProgress = {
      pitched: 10,
      in_talks: 25,
      negotiating: 40,
      live: 60,
      completed: 85,
      paid: 100,
      cancelled: 0,
      rejected: 0,
    }

    return stageProgress[stage] || 0
  }

  /**
   * Check if deal is overdue
   * @param {Object} deal - Deal object
   * @returns {Boolean} Is overdue
   */
  checkIfOverdue(deal) {
    const now = new Date()

    if (deal.timeline.responseDeadline && deal.stage === 'pitched') {
      return now > new Date(deal.timeline.responseDeadline)
    }

    if (deal.timeline.contentDeadline && ['live', 'in_talks'].includes(deal.stage)) {
      return now > new Date(deal.timeline.contentDeadline)
    }

    if (deal.timeline.paymentDueDate && deal.stage === 'completed') {
      return now > new Date(deal.timeline.paymentDueDate)
    }

    return false
  }

  /**
   * Get next action for deal
   * @param {Object} deal - Deal object
   * @returns {String} Next action
   */
  getNextAction(deal) {
    const actions = {
      pitched: 'Follow up with brand',
      in_talks: 'Continue negotiations',
      negotiating: 'Finalize terms',
      live: 'Create and submit content',
      completed: 'Follow up on payment',
      paid: 'Request testimonial',
      cancelled: 'Archive deal',
      rejected: 'Analyze feedback',
    }

    return actions[deal.stage] || 'Review deal status'
  }

  /**
   * Generate deal alerts
   * @param {Object} deal - Deal object
   * @returns {Array} Alert messages
   */
  generateDealAlerts(deal) {
    const alerts = []
    const now = new Date()

    // Response deadline alert
    if (deal.stage === 'pitched' && deal.timeline.responseDeadline) {
      const daysUntilDeadline = Math.ceil(
        (new Date(deal.timeline.responseDeadline) - now) / (24 * 60 * 60 * 1000)
      )
      if (daysUntilDeadline <= 0) {
        alerts.push({
          type: 'deadline_overdue',
          message: 'Response deadline has passed',
          severity: 'critical',
        })
      } else if (daysUntilDeadline <= 2) {
        alerts.push({
          type: 'deadline_approaching',
          message: `Response deadline in ${daysUntilDeadline} days`,
          severity: 'warning',
        })
      }
    }

    // Content deadline alert
    if (['live', 'in_talks'].includes(deal.stage) && deal.timeline.contentDeadline) {
      const daysUntilDeadline = Math.ceil(
        (new Date(deal.timeline.contentDeadline) - now) / (24 * 60 * 60 * 1000)
      )
      if (daysUntilDeadline <= 0) {
        alerts.push({
          type: 'content_overdue',
          message: 'Content deadline has passed',
          severity: 'critical',
        })
      } else if (daysUntilDeadline <= 3) {
        alerts.push({
          type: 'content_deadline_approaching',
          message: `Content deadline in ${daysUntilDeadline} days`,
          severity: 'warning',
        })
      }
    }

    // Payment overdue alert
    if (deal.stage === 'completed' && deal.timeline.paymentDueDate) {
      const daysOverdue = Math.ceil(
        (now - new Date(deal.timeline.paymentDueDate)) / (24 * 60 * 60 * 1000)
      )
      if (daysOverdue > 0) {
        alerts.push({
          type: 'payment_overdue',
          message: `Payment overdue by ${daysOverdue} days`,
          severity: 'critical',
        })
      }
    }

    return alerts
  }

  /**
   * Merge template data with deal data
   * @param {Object} dealData - Deal data
   * @param {Object} templateData - Template data
   * @returns {Object} Merged data
   */
  mergeTemplateData(dealData, templateData) {
    return {
      ...dealData,
      platform: dealData.platform || templateData.platform,
      deliverables: dealData.deliverables || templateData.deliverables,
      dealValue: {
        ...(templateData.defaultValue && { amount: templateData.defaultValue }),
        ...dealData.dealValue,
      },
      campaignRequirements: {
        ...templateData.campaignRequirements,
        ...dealData.campaignRequirements,
      },
    }
  }

  /**
   * Get stage update message
   * @param {String} oldStage - Old stage
   * @param {String} newStage - New stage
   * @returns {String} Update message
   */
  getStageUpdateMessage(oldStage, newStage) {
    const messages = {
      'pitched->in_talks': 'Brand showed interest, moving to discussions',
      'in_talks->negotiating': 'Started formal negotiations',
      'negotiating->live': 'Terms agreed, campaign is now live',
      'live->completed': 'Content delivered and campaign completed',
      'completed->paid': 'Payment received successfully',
      'any->cancelled': 'Deal has been cancelled',
      'any->rejected': 'Deal was rejected by the brand',
    }

    const key = `${oldStage}->${newStage}`
    return (
      messages[key] ||
      messages[`any->${newStage}`] ||
      `Stage updated from ${oldStage} to ${newStage}`
    )
  }

  /**
   * Calculate conversion funnel
   * @param {Object} stageData - Stage statistics
   * @returns {Object} Conversion funnel
   */
  calculateConversionFunnel(stageData) {
    const totalPitched = stageData.pitched.count
    if (totalPitched === 0) return {}

    return {
      pitched: { count: totalPitched, percentage: 100 },
      in_talks: {
        count: stageData.in_talks.count,
        percentage: Math.round((stageData.in_talks.count / totalPitched) * 100),
      },
      live: {
        count: stageData.live.count,
        percentage: Math.round((stageData.live.count / totalPitched) * 100),
      },
      completed: {
        count: stageData.completed.count,
        percentage: Math.round((stageData.completed.count / totalPitched) * 100),
      },
      paid: {
        count: stageData.paid.count,
        percentage: Math.round((stageData.paid.count / totalPitched) * 100),
      },
    }
  }

  /**
   * Get next tier for subscription upgrade suggestion
   * @param {String} currentTier - Current subscription tier
   * @returns {String} Next tier
   */
  getNextTier(currentTier) {
    const tierHierarchy = {
      starter: 'pro',
      pro: 'elite',
      elite: 'agency_starter',
      agency_starter: 'agency_pro',
    }

    return tierHierarchy[currentTier] || 'pro'
  }

  /**
   * Get next actions for deal
   * @param {Object} deal - Deal object
   * @returns {Array} Next actions
   */
  getNextActions(deal) {
    const actions = {
      pitched: [
        'Send follow-up email',
        'Schedule call with brand',
        'Update proposal based on feedback',
      ],
      in_talks: [
        'Send detailed proposal',
        'Negotiate deliverables',
        'Clarify timeline and requirements',
      ],
      negotiating: [
        'Finalize contract terms',
        'Set content guidelines',
        'Confirm payment schedule',
      ],
      live: [
        'Create content as per brief',
        'Share drafts for approval',
        'Schedule content publishing',
      ],
      completed: [
        'Submit performance report',
        'Send invoice for payment',
        'Request brand testimonial',
      ],
      paid: ['Archive deal', 'Rate brand collaboration', 'Plan future campaigns'],
    }

    return actions[deal.stage] || ['Review deal status']
  }

  // Additional analytics methods would be implemented here...
  // getTopBrands, getPlatformPerformance, getMonthlyTrends, etc.
}

module.exports = new DealService()
