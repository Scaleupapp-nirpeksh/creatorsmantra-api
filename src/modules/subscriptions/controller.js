    // src/modules/subscriptions/controller.js
    /**
     * CreatorsMantra Backend - Subscription Controller
     * Request/response handling for subscription management endpoints
     * 
     * @author CreatorsMantra Team
     * @version 1.0.0
     */

    const subscriptionService = require('./service');
    const { successResponse, errorResponse, asyncHandler } = require('../../shared/utils');

    class SubscriptionController {

    // ============================================
    // PAYMENT VERIFICATION ENDPOINTS
    // ============================================

    /**
     * Initiate payment verification
     * POST /api/v1/subscriptions/payments/verify
     */
    initiatePaymentVerification = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const paymentData = {
        ...req.body,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
        };

        const result = await subscriptionService.initiatePaymentVerification(paymentData, userId);
        res.status(201).json(result);
    });

    /**
     * Manual payment verification by admin
     * PUT /api/v1/subscriptions/payments/:paymentId/verify
     */
    verifyPaymentManually = asyncHandler(async (req, res) => {
        const { paymentId } = req.params;
        const verificationData = req.body;
        const verifiedBy = req.user.id;

        const result = await subscriptionService.verifyPaymentManually(paymentId, verificationData, verifiedBy);
        res.status(200).json(result);
    });

    /**
     * Get payment details
     * GET /api/v1/subscriptions/payments/:paymentId
     */
    getPaymentDetails = asyncHandler(async (req, res) => {
        const { paymentId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Find payment tracking record
        const PaymentTracking = require('./model').PaymentTracking;
        let query = { _id: paymentId };

        // Non-admin users can only see their own payments
        if (userRole !== 'admin' && userRole !== 'super_admin') {
        query.userId = userId;
        }

        const payment = await PaymentTracking.findOne(query)
        .populate('userId', 'fullName email phone subscriptionTier');

        if (!payment) {
        return res.status(404).json(errorResponse('Payment not found', 404));
        }

        // Prepare response data based on user role
        const responseData = {
        id: payment._id,
        amount: payment.paymentAmount,
        originalAmount: payment.originalAmount,
        discountAmount: payment.discountAmount,
        paymentMethod: payment.paymentMethod,
        status: payment.paymentStatus,
        verificationStage: payment.verificationStage,
        daysSincePayment: payment.daysSincePayment,
        verificationUrgency: payment.verificationUrgency,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
        };

        // Add sensitive details for admin users
        if (userRole === 'admin' || userRole === 'super_admin') {
        responseData.user = payment.userId;
        responseData.upiDetails = payment.upiDetails;
        responseData.bankDetails = payment.getDecryptedBankDetails();
        responseData.verificationNotes = payment.verificationNotes;
        responseData.failureReason = payment.failureReason;
        responseData.autoVerificationScore = payment.autoVerificationScore;
        responseData.communicationLog = payment.communicationLog;
        responseData.flaggedForReview = payment.flaggedForReview;
        responseData.priority = payment.priority;
        }

        // Add screenshot for payment owner or admin
        if (payment.userId._id.toString() === userId || userRole === 'admin' || userRole === 'super_admin') {
        responseData.paymentScreenshot = payment.paymentScreenshot;
        }

        res.status(200).json(successResponse('Payment details retrieved', responseData));
    });

    /**
     * Get pending payments for admin review
     * GET /api/v1/subscriptions/payments/pending
     */
    getPendingPayments = asyncHandler(async (req, res) => {
        const { status, priority, method, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

        const filters = {
        status,
        priority,
        method,
        dateFrom,
        dateTo
        };

        const result = await subscriptionService.getPendingPayments(
        filters,
        parseInt(page),
        parseInt(limit)
        );

        res.status(200).json(result);
    });

    /**
     * Upload payment screenshot
     * POST /api/v1/subscriptions/payments/:paymentId/screenshot
     */
    uploadPaymentScreenshot = asyncHandler(async (req, res) => {
        const { paymentId } = req.params;
        const userId = req.user.id;
    
        // Check if file was uploaded
        if (!req.file) {
        return res.status(400).json(errorResponse('Payment screenshot is required', 400));
        }
    
        const PaymentTracking = require('./model').PaymentTracking;
        
        // Find payment record
        const payment = await PaymentTracking.findOne({ 
        _id: paymentId, 
        userId,
        paymentStatus: 'pending'
        });
    
        if (!payment) {
        return res.status(404).json(errorResponse('Payment record not found or already processed', 404));
        }
    
        // Update payment with screenshot details (using base64 for memory storage)
        payment.paymentScreenshot = {
        originalUrl: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadedAt: new Date()
        };
    
        payment.verificationStage = 'screenshot_uploaded';
        
        // Recalculate verification score
        payment.calculateVerificationScore();
    
        await payment.save();
    
        res.status(200).json(successResponse('Payment screenshot uploaded successfully', {
        paymentId: payment._id,
        screenshotUrl: 'Screenshot uploaded successfully',
        verificationStage: payment.verificationStage,
        autoVerificationScore: payment.autoVerificationScore
        }));
    });

    // ============================================
    // BILLING CYCLE MANAGEMENT
    // ============================================

    /**
     * Get user's current billing cycle
     * GET /api/v1/subscriptions/billing/current
     */
    getCurrentBillingCycle = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const BillingCycle = require('./model').BillingCycle;
        
        const currentCycle = await BillingCycle.findOne({
        userId,
        cycleStatus: { $in: ['active', 'payment_pending', 'payment_overdue'] }
        }).sort({ cycleNumber: -1 });

        if (!currentCycle) {
        return res.status(404).json(errorResponse('No active billing cycle found', 404));
        }

        const responseData = {
        id: currentCycle._id,
        cycleNumber: currentCycle.cycleNumber,
        subscriptionTier: currentCycle.subscriptionTier,
        cycleStartDate: currentCycle.cycleStartDate,
        cycleEndDate: currentCycle.cycleEndDate,
        paymentDueDate: currentCycle.paymentDueDate,
        baseAmount: currentCycle.baseAmount,
        discountAmount: currentCycle.discountAmount,
        finalAmount: currentCycle.finalAmount,
        gstAmount: currentCycle.gstAmount,
        totalAmountWithGst: currentCycle.totalAmountWithGst,
        cycleStatus: currentCycle.cycleStatus,
        paymentStatus: currentCycle.paymentStatus,
        daysRemaining: currentCycle.daysRemaining,
        daysUntilDue: currentCycle.daysUntilDue,
        isInGracePeriod: currentCycle.isInGracePeriod(),
        graceDaysRemaining: currentCycle.graceDaysRemaining,
        isOverdue: currentCycle.isOverdue(),
        usageStats: currentCycle.usageStats,
        featureLimits: currentCycle.featureLimits
        };

        res.status(200).json(successResponse('Current billing cycle retrieved', responseData));
    });

    /**
     * Get billing history
     * GET /api/v1/subscriptions/billing/history
     */
    getBillingHistory = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;

        const BillingCycle = require('./model').BillingCycle;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [cycles, total] = await Promise.all([
        BillingCycle.find({ userId })
            .sort({ cycleNumber: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('paymentReference', 'paymentAmount paymentMethod paymentStatus verifiedAt'),
        BillingCycle.countDocuments({ userId })
        ]);

        const totalPages = Math.ceil(total / parseInt(limit));

        const responseData = {
        cycles: cycles.map(cycle => ({
            id: cycle._id,
            cycleNumber: cycle.cycleNumber,
            subscriptionTier: cycle.subscriptionTier,
            cycleStartDate: cycle.cycleStartDate,
            cycleEndDate: cycle.cycleEndDate,
            totalAmount: cycle.totalAmountWithGst,
            cycleStatus: cycle.cycleStatus,
            paymentStatus: cycle.paymentStatus,
            paymentDate: cycle.paymentDate,
            paymentReference: cycle.paymentReference
        })),
        pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalRecords: total,
            hasNext: parseInt(page) < totalPages,
            hasPrev: parseInt(page) > 1
        }
        };

        res.status(200).json(successResponse('Billing history retrieved', responseData));
    });

    // ============================================
    // SUBSCRIPTION UPGRADE/DOWNGRADE
    // ============================================

    /**
     * Request subscription upgrade/downgrade
     * POST /api/v1/subscriptions/upgrade
     */
    requestSubscriptionUpgrade = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const upgradeData = req.body;

        const result = await subscriptionService.requestSubscriptionUpgrade(userId, upgradeData);
        res.status(201).json(result);
    });

    /**
     * Get upgrade requests
     * GET /api/v1/subscriptions/upgrades
     */
    getUpgradeRequests = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { status, page = 1, limit = 10 } = req.query;

        const SubscriptionUpgrade = require('./model').SubscriptionUpgrade;
        
        let query = {};
        
        // Non-admin users can only see their own upgrades
        if (userRole !== 'admin' && userRole !== 'super_admin') {
        query.userId = userId;
        }

        if (status) {
        query.upgradeStatus = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [upgrades, total] = await Promise.all([
        SubscriptionUpgrade.find(query)
            .sort({ requestedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'fullName email subscriptionTier')
            .populate('paymentReference', 'paymentAmount paymentStatus'),
        SubscriptionUpgrade.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / parseInt(limit));

        const responseData = {
        upgrades: upgrades.map(upgrade => ({
            id: upgrade._id,
            user: userRole === 'admin' || userRole === 'super_admin' ? upgrade.userId : undefined,
            upgradeType: upgrade.upgradeType,
            fromTier: upgrade.fromTier,
            toTier: upgrade.toTier,
            netAmount: upgrade.netAmount,
            paymentRequired: upgrade.paymentRequired,
            upgradeStatus: upgrade.upgradeStatus,
            requestedAt: upgrade.requestedAt,
            effectiveDate: upgrade.effectiveDate,
            completedAt: upgrade.completedAt,
            estimatedProcessingTime: upgrade.estimatedProcessingTime,
            isUpgrade: upgrade.isUpgrade,
            reason: upgrade.reason,
            prorationDetails: upgrade.prorationDetails
        })),
        pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalRecords: total,
            hasNext: parseInt(page) < totalPages,
            hasPrev: parseInt(page) > 1
        }
        };

        res.status(200).json(successResponse('Upgrade requests retrieved', responseData));
    });

    /**
     * Process upgrade request (admin only)
     * PUT /api/v1/subscriptions/upgrades/:upgradeId/process
     */
    processUpgradeRequest = asyncHandler(async (req, res) => {
        const { upgradeId } = req.params;

        const result = await subscriptionService.processSubscriptionUpgrade(upgradeId);
        res.status(200).json(result);
    });

    // ============================================
    // SUBSCRIPTION MANAGEMENT
    // ============================================

    /**
     * Get subscription overview
     * GET /api/v1/subscriptions/overview
     */
    getSubscriptionOverview = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        // Get user with subscription details
        const User = require('../auth/model').User;
        const user = await User.findById(userId).select(
        'subscriptionTier subscriptionStatus subscriptionStartDate subscriptionEndDate'
        );

        if (!user) {
        return res.status(404).json(errorResponse('User not found', 404));
        }

        // Get current billing cycle
        const BillingCycle = require('./model').BillingCycle;
        const currentCycle = await BillingCycle.findOne({
        userId,
        cycleStatus: { $in: ['active', 'payment_pending', 'payment_overdue'] }
        });

        // Get subscription limits and features
        const subscriptionLimits = User.getSubscriptionLimits(user.subscriptionTier);
        const subscriptionPricing = subscriptionService.getSubscriptionPricing();

        const responseData = {
        subscription: {
            tier: user.subscriptionTier,
            status: user.subscriptionStatus,
            startDate: user.subscriptionStartDate,
            endDate: user.subscriptionEndDate,
            isActive: user.hasActiveSubscription(),
            features: subscriptionLimits.features,
            limits: {
            maxActiveDeals: subscriptionLimits.maxActiveDeals,
            maxInvoicesPerMonth: subscriptionLimits.maxInvoicesPerMonth,
            maxUsers: subscriptionLimits.maxUsers,
            maxCreators: subscriptionLimits.maxCreators
            }
        },
        currentCycle: currentCycle ? {
            cycleNumber: currentCycle.cycleNumber,
            daysRemaining: currentCycle.daysRemaining,
            nextPaymentDue: currentCycle.paymentDueDate,
            nextPaymentAmount: currentCycle.totalAmountWithGst,
            isInGracePeriod: currentCycle.isInGracePeriod(),
            isOverdue: currentCycle.isOverdue()
        } : null,
        availableTiers: Object.keys(subscriptionPricing).map(tier => ({
            name: tier,
            monthlyPrice: subscriptionPricing[tier].monthly,
            quarterlyPrice: subscriptionPricing[tier].quarterly,
            features: subscriptionPricing[tier].features,
            isCurrentTier: tier === user.subscriptionTier
        }))
        };

        res.status(200).json(successResponse('Subscription overview retrieved', responseData));
    });

    /**
     * Cancel subscription
     * POST /api/v1/subscriptions/cancel
     */
    cancelSubscription = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const cancellationData = req.body;

        const result = await subscriptionService.processSubscriptionCancellation(userId, cancellationData);
        res.status(200).json(result);
    });

    /**
     * Get subscription statistics (admin only)
     * GET /api/v1/subscriptions/stats
     */
    getSubscriptionStatistics = asyncHandler(async (req, res) => {
        const { period = '30d' } = req.query;

        const User = require('../auth/model').User;
        const PaymentTracking = require('./model').PaymentTracking;
        const BillingCycle = require('./model').BillingCycle;

        // Calculate date range
        const now = new Date();
        let startDate;
        
        switch (period) {
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case '90d':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Aggregate statistics
        const [
        totalUsers,
        activeSubscriptions,
        tierDistribution,
        revenueStats,
        pendingPayments,
        overduePayments
        ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ subscriptionStatus: 'active' }),
        User.aggregate([
            { $group: { _id: '$subscriptionTier', count: { $sum: 1 } } }
        ]),
        PaymentTracking.aggregate([
            { 
            $match: { 
                paymentStatus: 'verified',
                verifiedAt: { $gte: startDate }
            }
            },
            {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$paymentAmount' },
                totalPayments: { $sum: 1 },
                averagePayment: { $avg: '$paymentAmount' }
            }
            }
        ]),
        PaymentTracking.countDocuments({ 
            paymentStatus: { $in: ['pending', 'under_review'] }
        }),
        BillingCycle.countDocuments({
            cycleStatus: 'payment_overdue'
        })
        ]);

        const responseData = {
        overview: {
            totalUsers,
            activeSubscriptions,
            trialUsers: totalUsers - activeSubscriptions,
            conversionRate: totalUsers > 0 ? ((activeSubscriptions / totalUsers) * 100).toFixed(2) : 0
        },
        tierDistribution: tierDistribution.reduce((acc, tier) => {
            acc[tier._id] = tier.count;
            return acc;
        }, {}),
        revenue: {
            totalRevenue: revenueStats[0]?.totalRevenue || 0,
            totalPayments: revenueStats[0]?.totalPayments || 0,
            averagePayment: revenueStats[0]?.averagePayment || 0,
            period
        },
        payments: {
            pendingVerification: pendingPayments,
            overduePayments
        }
        };

        res.status(200).json(successResponse('Subscription statistics retrieved', responseData));
    });

    // ============================================
    // RENEWAL & REMINDER MANAGEMENT
    // ============================================

    /**
     * Send renewal reminders (admin only - typically called by cron job)
     * POST /api/v1/subscriptions/reminders/send
     */
    sendRenewalReminders = asyncHandler(async (req, res) => {
        const result = await subscriptionService.sendRenewalReminders();
        res.status(200).json(result);
    });

    /**
     * Get renewal reminders status
     * GET /api/v1/subscriptions/reminders
     */
    getRenewalReminders = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const BillingCycle = require('./model').BillingCycle;
        
        const currentCycle = await BillingCycle.findOne({
        userId,
        cycleStatus: 'active'
        });

        if (!currentCycle) {
        return res.status(404).json(errorResponse('No active billing cycle found', 404));
        }

        const responseData = {
        nextRenewal: {
            dueDate: currentCycle.paymentDueDate,
            amount: currentCycle.totalAmountWithGst,
            daysUntilDue: currentCycle.daysUntilDue,
            autoRenewal: currentCycle.autoRenewal
        },
        reminders: currentCycle.renewalReminders.map(reminder => ({
            type: reminder.reminderType,
            sentAt: reminder.sentAt,
            method: reminder.method,
            status: reminder.status
        }))
        };

        res.status(200).json(successResponse('Renewal reminders retrieved', responseData));
    });

    /**
     * Update auto-renewal settings
     * PUT /api/v1/subscriptions/auto-renewal
     */
    updateAutoRenewal = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { autoRenewal } = req.body;

        const BillingCycle = require('./model').BillingCycle;
        
        const updatedCycle = await BillingCycle.findOneAndUpdate(
        { userId, cycleStatus: 'active' },
        { autoRenewal },
        { new: true }
        );

        if (!updatedCycle) {
        return res.status(404).json(errorResponse('No active billing cycle found', 404));
        }

        res.status(200).json(successResponse('Auto-renewal settings updated', {
        autoRenewal: updatedCycle.autoRenewal
        }));
    });
    }

    module.exports = new SubscriptionController();