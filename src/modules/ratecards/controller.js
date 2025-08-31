/**
 * CreatorsMantra Backend - Rate Card Controller
 * Handles HTTP requests for rate card management
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const RateCardService = require('./service');
const { successResponse, errorResponse } = require('../../shared/responses');
const { logInfo, logError, asyncHandler } = require('../../shared/utils');
const { AppError } = require('../../shared/errors');

class RateCardController {
  /**
   * Create new rate card
   * POST /api/ratecards
   */
  createRateCard = asyncHandler(async (req, res) => {
    try {
      logInfo('Create rate card request', { 
        userId: req.user.id,
        hasMetrics: !!req.body.creatorMetrics 
      });

      const rateCard = await RateCardService.createRateCard(
        req.body,
        req.user.id
      );

      res.status(201).json(
        successResponse('Rate card created successfully', {
          rateCard,
          aiSuggestionsApplied: !!rateCard.aiSuggestions?.generated
        })
      );
    } catch (error) {
      logError('Create rate card failed', { 
        error: error.message,
        userId: req.user.id 
      });
      throw error;
    }
  });

  /**
   * Get all rate cards for creator
   * GET /api/ratecards
   */
  getRateCards = asyncHandler(async (req, res) => {
    try {
      logInfo('Get rate cards request', { 
        userId: req.user.id,
        filters: req.query 
      });

      const { status, isTemplate, page = 1, limit = 10 } = req.query;

      const filter = {
        creator: req.user.id,
        isDeleted: false
      };

      if (status) filter.status = status;
      if (isTemplate !== undefined) filter.isTemplate = isTemplate === 'true';

      const rateCards = await RateCardService.RateCard
        .find(filter)
        .sort('-createdAt')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select('-versionHistory');

      const total = await RateCardService.RateCard.countDocuments(filter);

      res.json(
        successResponse('Rate cards fetched successfully', {
          rateCards,
          pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
          }
        })
      );
    } catch (error) {
      logError('Get rate cards failed', { 
        error: error.message,
        userId: req.user.id 
      });
      throw error;
    }
  });

  /**
   * Get single rate card
   * GET /api/ratecards/:id
   */
  getRateCard = asyncHandler(async (req, res) => {
    try {
      logInfo('Get rate card request', { 
        rateCardId: req.params.id,
        userId: req.user.id 
      });

      const rateCard = await RateCardService.RateCard
        .findOne({
          _id: req.params.id,
          creator: req.user.id,
          isDeleted: false
        })
        .populate('creator', 'name email businessDetails');

      if (!rateCard) {
        throw new AppError('Rate card not found', 404);
      }

      res.json(
        successResponse('Rate card fetched successfully', { rateCard })
      );
    } catch (error) {
      logError('Get rate card failed', { 
        error: error.message,
        rateCardId: req.params.id 
      });
      throw error;
    }
  });

  /**
   * Update rate card
   * PUT /api/ratecards/:id
   */
  updateRateCard = asyncHandler(async (req, res) => {
    try {
      logInfo('Update rate card request', { 
        rateCardId: req.params.id,
        userId: req.user.id 
      });

      const rateCard = await RateCardService.updateRateCard(
        req.params.id,
        req.body,
        req.user.id
      );

      res.json(
        successResponse('Rate card updated successfully', { rateCard })
      );
    } catch (error) {
      logError('Update rate card failed', { 
        error: error.message,
        rateCardId: req.params.id 
      });
      throw error;
    }
  });

  /**
   * Delete rate card (soft delete)
   * DELETE /api/ratecards/:id
   */
  deleteRateCard = asyncHandler(async (req, res) => {
    try {
      logInfo('Delete rate card request', { 
        rateCardId: req.params.id,
        userId: req.user.id 
      });

      const rateCard = await RateCardService.RateCard.findOne({
        _id: req.params.id,
        creator: req.user.id,
        isDeleted: false
      });

      if (!rateCard) {
        throw new AppError('Rate card not found', 404);
      }

      rateCard.isDeleted = true;
      rateCard.deletedAt = new Date();
      rateCard.status = 'archived';
      await rateCard.save();

      res.json(
        successResponse('Rate card deleted successfully')
      );
    } catch (error) {
      logError('Delete rate card failed', { 
        error: error.message,
        rateCardId: req.params.id 
      });
      throw error;
    }
  });

  generateAISuggestions = asyncHandler(async (req, res) => {
    try {
      logInfo('Generate AI suggestions request', { 
        userId: req.user.id,
        metrics: req.body 
      });
  
      // Fix: Add null check for subscription
      const userSubscription = req.user?.subscription?.plan || req.user?.subscriptionTier || 'starter';
      
      if (!['pro', 'elite', 'agency_starter', 'agency_pro'].includes(userSubscription)) {
        throw new AppError('AI suggestions are available for Pro and Elite plans only', 403);
      }
  
      const suggestions = await RateCardService.generateAIPricingSuggestions(req.body);
  
      if (!suggestions) {
        throw new AppError('Unable to generate suggestions. Please try again.', 500);
      }
  
      res.json(
        successResponse('AI suggestions generated successfully', { suggestions })
      );
    } catch (error) {
      logError('Generate AI suggestions failed', { 
        error: error.message,
        userId: req.user.id 
      });
      throw error;
    }
  });

  /**
   * Create package deal
   * POST /api/ratecards/:id/packages
   */
  createPackage = asyncHandler(async (req, res) => {
    try {
      logInfo('Create package request', { 
        rateCardId: req.params.id,
        userId: req.user.id 
      });

      const rateCard = await RateCardService.createPackage(
        req.params.id,
        req.body,
        req.user.id
      );

      res.status(201).json(
        successResponse('Package created successfully', { 
          rateCard,
          package: rateCard.packages[rateCard.packages.length - 1]
        })
      );
    } catch (error) {
      logError('Create package failed', { 
        error: error.message,
        rateCardId: req.params.id 
      });
      throw error;
    }
  });

  /**
   * Update package
   * PUT /api/ratecards/:id/packages/:packageId
   */
  updatePackage = asyncHandler(async (req, res) => {
    try {
      logInfo('Update package request', { 
        rateCardId: req.params.id,
        packageId: req.params.packageId,
        userId: req.user.id 
      });

      const rateCard = await RateCardService.RateCard.findOne({
        _id: req.params.id,
        creator: req.user.id,
        isDeleted: false
      });

      if (!rateCard) {
        throw new AppError('Rate card not found', 404);
      }

      const packageIndex = rateCard.packages.findIndex(
        p => p._id.toString() === req.params.packageId
      );

      if (packageIndex === -1) {
        throw new AppError('Package not found', 404);
      }

      // Update package
      Object.assign(rateCard.packages[packageIndex], req.body);
      
      // Recalculate savings
      const pkg = rateCard.packages[packageIndex];
      pkg.pricing.savings.amount = pkg.pricing.individualTotal - pkg.pricing.packagePrice;
      pkg.pricing.savings.percentage = 
        ((pkg.pricing.savings.amount / pkg.pricing.individualTotal) * 100).toFixed(2);

      await rateCard.save();

      res.json(
        successResponse('Package updated successfully', { 
          package: rateCard.packages[packageIndex]
        })
      );
    } catch (error) {
      logError('Update package failed', { 
        error: error.message,
        packageId: req.params.packageId 
      });
      throw error;
    }
  });

  /**
   * Delete package
   * DELETE /api/ratecards/:id/packages/:packageId
   */
  deletePackage = asyncHandler(async (req, res) => {
    try {
      logInfo('Delete package request', { 
        rateCardId: req.params.id,
        packageId: req.params.packageId,
        userId: req.user.id 
      });

      const rateCard = await RateCardService.RateCard.findOne({
        _id: req.params.id,
        creator: req.user.id,
        isDeleted: false
      });

      if (!rateCard) {
        throw new AppError('Rate card not found', 404);
      }

      rateCard.packages = rateCard.packages.filter(
        p => p._id.toString() !== req.params.packageId
      );

      await rateCard.save();

      res.json(
        successResponse('Package deleted successfully')
      );
    } catch (error) {
      logError('Delete package failed', { 
        error: error.message,
        packageId: req.params.packageId 
      });
      throw error;
    }
  });

  /**
   * Generate PDF
   * GET /api/ratecards/:id/pdf
   */
  generatePDF = asyncHandler(async (req, res) => {
    try {
      logInfo('Generate PDF request', { 
        rateCardId: req.params.id,
        userId: req.user.id 
      });

      const pdfBuffer = await RateCardService.generatePDF(
        req.params.id,
        req.user.id
      );

      // Set response headers
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rate-card-${req.params.id}.pdf"`,
        'Content-Length': pdfBuffer.length
      });

      res.send(pdfBuffer);
    } catch (error) {
      logError('Generate PDF failed', { 
        error: error.message,
        rateCardId: req.params.id 
      });
      throw error;
    }
  });

  /**
   * Share rate card
   * POST /api/ratecards/:id/share
   */
  shareRateCard = asyncHandler(async (req, res) => {
    try {
      logInfo('Share rate card request', { 
        rateCardId: req.params.id,
        userId: req.user.id,
        options: req.body 
      });

      const shareInfo = await RateCardService.shareRateCard(
        req.params.id,
        req.body,
        req.user.id
      );

      res.json(
        successResponse('Rate card shared successfully', shareInfo)
      );
    } catch (error) {
      logError('Share rate card failed', { 
        error: error.message,
        rateCardId: req.params.id 
      });
      throw error;
    }
  });

  /**
   * Get public rate card (no auth required)
   * GET /api/ratecards/public/:shortCode
   */
  getPublicRateCard = asyncHandler(async (req, res) => {
    try {
      logInfo('Get public rate card request', { 
        shortCode: req.params.shortCode 
      });

      const rateCard = await RateCardService.RateCard.getByShortCode(
        req.params.shortCode
      );

      if (!rateCard) {
        throw new AppError('Rate card not found or expired', 404);
      }

      // Check password if set
      if (rateCard.sharing.password) {
        const providedPassword = req.headers['x-rate-card-password'];
        if (providedPassword !== rateCard.sharing.password) {
          throw new AppError('Invalid password', 401);
        }
      }

      // Increment view count
      await rateCard.incrementViewCount();

      // Remove sensitive data
      const publicData = {
        title: rateCard.title,
        creatorName: rateCard.creator.name,
        deliverables: rateCard.deliverables,
        packages: rateCard.packages.filter(p => p.active),
        terms: {
          paymentTerms: rateCard.terms.paymentTerms,
          validity: rateCard.terms.validity,
          usageRights: rateCard.terms.usageRights
        },
        template: rateCard.template,
        sharing: {
          allowDownload: rateCard.sharing.allowDownload
        }
      };

      res.json(
        successResponse('Public rate card fetched successfully', publicData)
      );
    } catch (error) {
      logError('Get public rate card failed', { 
        error: error.message,
        shortCode: req.params.shortCode 
      });
      throw error;
    }
  });

  /**
   * Get rate card analytics
   * GET /api/ratecards/:id/analytics
   */
  getAnalytics = asyncHandler(async (req, res) => {
    try {
      logInfo('Get analytics request', { 
        rateCardId: req.params.id,
        userId: req.user.id 
      });

      // Check if user has access to analytics (Elite only)
      if (!['elite', 'agency_starter', 'agency_pro'].includes(req.user.subscription.plan)) {
        throw new AppError('Analytics are available for Elite plans only', 403);
      }

      const analytics = await RateCardService.getRateCardAnalytics(
        req.params.id,
        req.user.id
      );

      res.json(
        successResponse('Analytics fetched successfully', analytics)
      );
    } catch (error) {
      logError('Get analytics failed', { 
        error: error.message,
        rateCardId: req.params.id 
      });
      throw error;
    }
  });

  /**
   * Bulk update rates
   * POST /api/ratecards/bulk-update
   */
  bulkUpdateRates = asyncHandler(async (req, res) => {
    try {
      logInfo('Bulk update rates request', { 
        userId: req.user.id,
        options: req.body 
      });

      // Check if user has access to bulk operations (Pro/Elite only)
      if (!['pro', 'elite', 'agency_starter', 'agency_pro'].includes(req.user.subscription.plan)) {
        throw new AppError('Bulk operations are available for Pro and Elite plans only', 403);
      }

      const updatedIds = await RateCardService.bulkUpdateRates(
        req.user.id,
        req.body
      );

      res.json(
        successResponse('Rates updated successfully', {
          updatedCount: updatedIds.length,
          rateCardIds: updatedIds
        })
      );
    } catch (error) {
      logError('Bulk update failed', { 
        error: error.message,
        userId: req.user.id 
      });
      throw error;
    }
  });

  /**
   * Clone rate card
   * POST /api/ratecards/:id/clone
   */
  cloneRateCard = asyncHandler(async (req, res) => {
    try {
      logInfo('Clone rate card request', { 
        rateCardId: req.params.id,
        userId: req.user.id 
      });

      const originalRateCard = await RateCardService.RateCard.findOne({
        _id: req.params.id,
        creator: req.user.id,
        isDeleted: false
      });

      if (!originalRateCard) {
        throw new AppError('Rate card not found', 404);
      }

      // Create clone
      const cloneData = originalRateCard.toObject();
      delete cloneData._id;
      delete cloneData.createdAt;
      delete cloneData.updatedAt;
      delete cloneData.sharing;
      delete cloneData.analytics;
      delete cloneData.versionHistory;
      
      cloneData.title = `${cloneData.title} (Copy)`;
      cloneData.status = 'draft';
      cloneData.version = 1;
      cloneData.templateSource = originalRateCard._id;

      const clonedRateCard = await RateCardService.createRateCard(
        cloneData,
        req.user.id
      );

      res.status(201).json(
        successResponse('Rate card cloned successfully', { 
          rateCard: clonedRateCard 
        })
      );
    } catch (error) {
      logError('Clone rate card failed', { 
        error: error.message,
        rateCardId: req.params.id 
      });
      throw error;
    }
  });

  getTemplates = asyncHandler(async (req, res) => {
    try {
      logInfo('Get templates request', { userId: req.user.id });
  
      // Fix: Handle case when creator doesn't have templates yet
      const templates = await RateCardService.RateCard.find({
        creator: req.user.id,
        isTemplate: true,
        isDeleted: false
      }).select('title template createdAt').lean(); // Use lean() for better performance
  
      // System templates
      const systemTemplates = [
        {
          _id: 'system_fashion',
          title: 'Fashion & Lifestyle Template',
          template: { designId: 'bold_gradient' },
          system: true
        },
        {
          _id: 'system_tech',
          title: 'Tech Creator Template',
          template: { designId: 'corporate_professional' },
          system: true
        },
        {
          _id: 'system_food',
          title: 'Food & Travel Template',
          template: { designId: 'creative_playful' },
          system: true
        }
      ];
  
      res.json(
        successResponse('Templates fetched successfully', {
          userTemplates: templates || [],
          systemTemplates
        })
      );
    } catch (error) {
      logError('Get templates failed', { 
        error: error.message,
        userId: req.user.id 
      });
      throw error;
    }
  });

  /**
   * Save as template
   * POST /api/ratecards/:id/save-as-template
   */
  saveAsTemplate = asyncHandler(async (req, res) => {
    try {
      logInfo('Save as template request', { 
        rateCardId: req.params.id,
        userId: req.user.id 
      });

      const rateCard = await RateCardService.RateCard.findOne({
        _id: req.params.id,
        creator: req.user.id,
        isDeleted: false
      });

      if (!rateCard) {
        throw new AppError('Rate card not found', 404);
      }

      rateCard.isTemplate = true;
      rateCard.title = req.body.templateName || `${rateCard.title} Template`;
      await rateCard.save();

      res.json(
        successResponse('Saved as template successfully', { 
          templateId: rateCard._id,
          templateName: rateCard.title
        })
      );
    } catch (error) {
      logError('Save as template failed', { 
        error: error.message,
        rateCardId: req.params.id 
      });
      throw error;
    }
  });

  /**
   * Get version history
   * GET /api/ratecards/:id/versions
   */
  getVersionHistory = asyncHandler(async (req, res) => {
    try {
      logInfo('Get version history request', { 
        rateCardId: req.params.id,
        userId: req.user.id 
      });

      const rateCard = await RateCardService.RateCard.findOne({
        _id: req.params.id,
        creator: req.user.id,
        isDeleted: false
      }).select('versionHistory version');

      if (!rateCard) {
        throw new AppError('Rate card not found', 404);
      }

      res.json(
        successResponse('Version history fetched successfully', {
          currentVersion: rateCard.version,
          history: rateCard.versionHistory
        })
      );
    } catch (error) {
      logError('Get version history failed', { 
        error: error.message,
        rateCardId: req.params.id 
      });
      throw error;
    }
  });

  /**
   * Restore version
   * POST /api/ratecards/:id/restore-version
   */
  restoreVersion = asyncHandler(async (req, res) => {
    try {
      logInfo('Restore version request', { 
        rateCardId: req.params.id,
        version: req.body.version,
        userId: req.user.id 
      });

      const rateCard = await RateCardService.RateCard.findOne({
        _id: req.params.id,
        creator: req.user.id,
        isDeleted: false
      });

      if (!rateCard) {
        throw new AppError('Rate card not found', 404);
      }

      await rateCard.restoreVersion(req.body.version);

      res.json(
        successResponse('Version restored successfully', { 
          rateCard,
          restoredVersion: req.body.version,
          currentVersion: rateCard.version
        })
      );
    } catch (error) {
      logError('Restore version failed', { 
        error: error.message,
        version: req.body.version 
      });
      throw error;
    }
  });
}

module.exports = new RateCardController();