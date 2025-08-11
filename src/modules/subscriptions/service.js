// src/modules/subscriptions/service.js
/**
 * CreatorsMantra Backend - Subscription Service
 * Business logic for payment verification, billing cycles, and subscription management
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const { PaymentTracking, BillingCycle, SubscriptionUpgrade } = require('./model');
const { User, SubscriptionHistory } = require('../auth/model');
const { 
  successResponse, 
  errorResponse, 
  generateRandomString,
  calculateGST,
  calculateTDS,
  formatCurrency,
  sendSMS,
  sendEmail,
  logInfo,
  logError 
} = require('../../shared/utils');

class SubscriptionService {
  
  // ============================================
  // PAYMENT VERIFICATION WORKFLOW
  // ============================================
  

/**
 * Initiate payment verification process
 * @param {Object} paymentData - Payment details including screenshot
 * @param {String} userId - User ID making the payment
 * @returns {Object} Payment tracking record
 */
async initiatePaymentVerification(paymentData, userId) {
  try {
    const { 
      subscriptionId,
      subscriptionTier, // NEW: Allow subscriptionTier as alternative
      paymentAmount,
      paymentMethod = 'upi',
      upiDetails = {},
      bankDetails = {},
      paymentScreenshot,
      ipAddress,
      userAgent 
    } = paymentData;

    // Validate user and subscription
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    let subscription;
    
    // Try to find existing subscription first
    if (subscriptionId) {
      subscription = await SubscriptionHistory.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }
    } else if (subscriptionTier) {
      // NEW: Create subscription if subscriptionTier is provided instead
      subscription = await this.createQuickSubscription(userId, subscriptionTier, paymentAmount);
    } else {
      throw new Error('Either subscriptionId or subscriptionTier must be provided');
    }

    // Get current billing cycle
    let currentCycle = await BillingCycle.findOne({
      userId,
      cycleStatus: { $in: ['upcoming', 'payment_pending'] }
    }).sort({ cycleNumber: -1 });

    // NEW: Create billing cycle if it doesn't exist
    if (!currentCycle) {
      currentCycle = await this.createQuickBillingCycle(userId, subscription);
    }

    // Validate payment amount
    const expectedAmount = currentCycle.totalAmountWithGst;
    const amountDifference = Math.abs(paymentAmount - expectedAmount);
    
    if (amountDifference > 50) { // Allow ₹50 difference for rounding
      throw new Error(`Payment amount mismatch. Expected: ₹${expectedAmount}, Received: ₹${paymentAmount}`);
    }

    // Create payment tracking record
    const paymentTracking = new PaymentTracking({
      userId,
      subscriptionId: subscription._id,
      paymentAmount,
      originalAmount: expectedAmount,
      discountAmount: currentCycle.discountAmount,
      discountType: currentCycle.cycleType === 'quarterly' ? 'quarterly_discount' : 'none',
      paymentMethod,
      upiDetails: paymentMethod === 'upi' ? {
        upiId: upiDetails.upiId,
        transactionId: upiDetails.transactionId,
        bankReference: upiDetails.bankReference,
        senderName: upiDetails.senderName,
        receiverUpiId: 'creatorsmantra@paytm'
      } : undefined,
      bankDetails: paymentMethod === 'bank_transfer' ? bankDetails : undefined,
      paymentScreenshot: paymentScreenshot,
      paymentStatus: 'pending',
      verificationStage: 'screenshot_uploaded',
      ipAddress,
      userAgent,
      priority: amountDifference > 10 ? 'high' : 'medium'
    });

    // Calculate auto verification score
    paymentTracking.calculateVerificationScore();

    await paymentTracking.save();

    // Update billing cycle status
    await BillingCycle.findByIdAndUpdate(currentCycle._id, {
      cycleStatus: 'payment_pending',
      paymentStatus: 'processing',
      paymentReference: paymentTracking._id
    });

    // Send confirmation SMS/Email
    await this.sendPaymentConfirmation(user, paymentTracking);

    logInfo('Payment verification initiated', {
      userId,
      paymentTrackingId: paymentTracking._id,
      subscriptionId: subscription._id,
      amount: paymentAmount,
      method: paymentMethod
    });

    return successResponse(
      'Payment submitted for verification',
      {
        paymentTrackingId: paymentTracking._id,
        subscriptionId: subscription._id,
        verificationTimeframe: '24-48 hours',
        expectedAmount,
        receivedAmount: paymentAmount,
        verificationStage: paymentTracking.verificationStage
      }
    );

  } catch (error) {
    logError('Payment verification initiation failed', { userId, error: error.message });
    throw error;
  }
}

// NEW: Add these helper methods to the SubscriptionService class

/**
 * Create a quick subscription for payment processing
 * Robust version that tries multiple status values
 * @param {String} userId - User ID
 * @param {String} subscriptionTier - Subscription tier
 * @param {Number} paymentAmount - Payment amount
 * @returns {Object} Created subscription
 */
async createQuickSubscription(userId, subscriptionTier, paymentAmount) {
  try {
    const pricing = this.getSubscriptionPricing();
    const tierPricing = pricing[subscriptionTier];
    
    if (!tierPricing) {
      throw new Error('Invalid subscription tier');
    }

    // Determine billing cycle based on payment amount
    const isQuarterly = Math.abs(paymentAmount - tierPricing.quarterly) <= Math.abs(paymentAmount - tierPricing.monthly);
    const billingCycle = isQuarterly ? 'quarterly' : 'monthly';
    const duration = isQuarterly ? 90 : 30; // days

    // Try different status values until one works
    const statusesToTry = ['trial', 'active', 'inactive', 'created', 'pending_verification'];
    let subscription = null;
    let lastError = null;

    for (const status of statusesToTry) {
      try {
        subscription = new SubscriptionHistory({
          userId,
          tier: subscriptionTier, // Model expects 'tier', not 'subscriptionTier'
          paymentAmount: paymentAmount, // Model expects 'paymentAmount', not 'amount'
          billingCycle,
          status: status,
          paymentStatus: 'pending',
          startDate: new Date(),
          endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
        });

        await subscription.save();
        
        logInfo('Quick subscription created', {
          userId,
          subscriptionId: subscription._id,
          tier: subscriptionTier,
          billingCycle,
          statusUsed: status
        });

        return subscription;

      } catch (err) {
        lastError = err;
        // If it's a validation error for status, try the next one
        if (err.name === 'ValidationError' && err.message.includes('is not a valid enum value for path `status`')) {
          continue;
        } else {
          // If it's a different error, throw it immediately
          throw err;
        }
      }
    }

    // If we get here, none of the status values worked
    logError('All status values failed', {
      userId,
      subscriptionTier,
      triedStatuses: statusesToTry,
      lastError: lastError.message
    });

    throw new Error(`Could not create subscription. Please check SubscriptionHistory model status enum values. Last error: ${lastError.message}`);

  } catch (error) {
    // Log detailed validation errors
    if (error.name === 'ValidationError') {
      logError('Subscription validation failed', {
        userId,
        subscriptionTier,
        validationErrors: Object.keys(error.errors).map(field => ({
          field,
          message: error.errors[field].message,
          value: error.errors[field].value
        }))
      });
    }
    throw error;
  }
}

/**
 * Create a quick billing cycle for the subscription
 * @param {String} userId - User ID
 * @param {Object} subscription - Subscription object
 * @returns {Object} Created billing cycle
 */
async createQuickBillingCycle(userId, subscription) {
  try {
    const baseAmount = subscription.paymentAmount;
    const discountAmount = subscription.billingCycle === 'quarterly' ? Math.round(baseAmount * 0.10) : 0;
    const finalAmount = baseAmount - discountAmount;
    const gstAmount = Math.round(finalAmount * 0.18);
    const totalAmountWithGst = finalAmount + gstAmount;

    const billingCycle = new BillingCycle({
      userId,
      cycleNumber: 1,
      cycleType: subscription.billingCycle || 'quarterly',
      subscriptionTier: subscription.tier,
      cycleStartDate: subscription.startDate,
      cycleEndDate: subscription.endDate,
      paymentDueDate: new Date(subscription.endDate.getTime() - 7 * 24 * 60 * 60 * 1000),
      baseAmount: baseAmount,
      discountAmount: discountAmount,           // Add this
      finalAmount: finalAmount,                 // Add this
      gstAmount: gstAmount,                     // Add this
      totalAmountWithGst: totalAmountWithGst,   // Add this
      cycleStatus: 'upcoming',
      paymentStatus: 'pending'
    });

    await billingCycle.save();

    logInfo('Quick billing cycle created', {
      userId,
      billingCycleId: billingCycle._id,
      cycleNumber: billingCycle.cycleNumber
    });

    return billingCycle;

  } catch (error) {
    logError('Creating quick billing cycle failed', { userId, error: error.message });
    throw error;
  }
}

  /**
   * Manual payment verification by admin
   * @param {String} paymentTrackingId - Payment tracking ID
   * @param {Object} verificationData - Verification details
   * @param {String} verifiedBy - Admin user ID
   * @returns {Object} Verification result
   */
  async verifyPaymentManually(paymentTrackingId, verificationData, verifiedBy) {
    try {
      const { status, notes, failureReason } = verificationData;

      const paymentTracking = await PaymentTracking.findById(paymentTrackingId)
        .populate('userId', 'fullName email phone subscriptionTier');

      if (!paymentTracking) {
        throw new Error('Payment tracking record not found');
      }

      if (paymentTracking.paymentStatus === 'verified') {
        throw new Error('Payment already verified');
      }

      // Update payment tracking
      paymentTracking.paymentStatus = status;
      paymentTracking.verifiedBy = verifiedBy;
      paymentTracking.verifiedAt = new Date();
      paymentTracking.verificationNotes = notes;

      if (status === 'failed') {
        paymentTracking.failureReason = failureReason;
        paymentTracking.failureNotes = notes;
      }

      await paymentTracking.save();

      if (status === 'verified') {
        // Process successful payment
        await this.processSuccessfulPayment(paymentTracking);
      } else if (status === 'failed') {
        // Handle failed payment
        await this.handleFailedPayment(paymentTracking);
      }

      logInfo('Payment verification completed', {
        paymentTrackingId,
        status,
        verifiedBy,
        userId: paymentTracking.userId._id
      });

      return successResponse(
        `Payment ${status} successfully`,
        {
          paymentTrackingId,
          status,
          verifiedAt: paymentTracking.verifiedAt
        }
      );

    } catch (error) {
      logError('Manual payment verification failed', { paymentTrackingId, error: error.message });
      throw error;
    }
  }

  /**
   * Process successful payment
   * @param {Object} paymentTracking - Payment tracking record
   */
  async processSuccessfulPayment(paymentTracking) {
    try {
      const userId = paymentTracking.userId._id || paymentTracking.userId;

      // Update billing cycle
      const billingCycle = await BillingCycle.findOne({
        userId,
        paymentReference: paymentTracking._id
      });

      if (billingCycle) {
        billingCycle.cycleStatus = 'active';
        billingCycle.paymentStatus = 'completed';
        billingCycle.paymentDate = new Date();
        await billingCycle.save();
      }

      // Update user subscription status
      await User.findByIdAndUpdate(userId, {
        subscriptionStatus: 'active',
        lastLogin: new Date()
      });

      // Update subscription history
      await SubscriptionHistory.findByIdAndUpdate(paymentTracking.subscriptionId, {
        status: 'active',
        paymentStatus: 'verified',
        verifiedBy: paymentTracking.verifiedBy,
        verifiedAt: paymentTracking.verifiedAt
      });

      // Create next billing cycle
      await this.createNextBillingCycle(userId, billingCycle);

      // Send success notification
      const user = await User.findById(userId);
      await this.sendPaymentSuccessNotification(user, paymentTracking, billingCycle);

      logInfo('Successful payment processed', {
        userId,
        paymentTrackingId: paymentTracking._id,
        amount: paymentTracking.paymentAmount
      });

    } catch (error) {
      logError('Processing successful payment failed', { 
        paymentTrackingId: paymentTracking._id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Handle failed payment
   * @param {Object} paymentTracking - Payment tracking record
   */
  async handleFailedPayment(paymentTracking) {
    try {
      const userId = paymentTracking.userId._id || paymentTracking.userId;

      // Update billing cycle status
      await BillingCycle.findOneAndUpdate(
        { userId, paymentReference: paymentTracking._id },
        { 
          cycleStatus: 'payment_overdue',
          paymentStatus: 'failed'
        }
      );

      // Send failure notification with instructions
      const user = await User.findById(userId);
      await this.sendPaymentFailureNotification(user, paymentTracking);

      logInfo('Failed payment handled', {
        userId,
        paymentTrackingId: paymentTracking._id,
        reason: paymentTracking.failureReason
      });

    } catch (error) {
      logError('Handling failed payment failed', { 
        paymentTrackingId: paymentTracking._id, 
        error: error.message 
      });
      throw error;
    }
  }

  // ============================================
  // BILLING CYCLE MANAGEMENT
  // ============================================

  /**
   * Create next billing cycle
   * @param {String} userId - User ID
   * @param {Object} currentCycle - Current billing cycle
   */
  async createNextBillingCycle(userId, currentCycle) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Calculate next cycle dates
      const nextCycleStart = new Date(currentCycle.cycleEndDate);
      const nextCycleEnd = new Date(nextCycleStart);
      nextCycleEnd.setMonth(nextCycleEnd.getMonth() + 3); // 3 months later

      const paymentDueDate = new Date(nextCycleEnd);
      paymentDueDate.setDate(paymentDueDate.getDate() - 7); // Payment due 7 days before cycle end

      // Get subscription tier pricing
      const tierPricing = this.getSubscriptionPricing();
      const baseAmount = tierPricing[user.subscriptionTier].quarterly;

      const nextCycle = new BillingCycle({
        userId,
        cycleNumber: currentCycle.cycleNumber + 1,
        cycleType: 'quarterly',
        subscriptionTier: user.subscriptionTier,
        cycleStartDate: nextCycleStart,
        cycleEndDate: nextCycleEnd,
        paymentDueDate,
        baseAmount,
        cycleStatus: 'upcoming',
        paymentStatus: 'pending',
        autoRenewal: true
      });

      await nextCycle.save();

      logInfo('Next billing cycle created', {
        userId,
        cycleNumber: nextCycle.cycleNumber,
        cycleStart: nextCycleStart,
        cycleEnd: nextCycleEnd
      });

      return nextCycle;

    } catch (error) {
      logError('Creating next billing cycle failed', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get pending payments for admin review
   * @param {Object} filters - Filter criteria
   * @param {Number} page - Page number
   * @param {Number} limit - Records per page
   * @returns {Object} Paginated payment list
   */
  async getPendingPayments(filters = {}, page = 1, limit = 20) {
    try {
      const { status, priority, method, dateFrom, dateTo } = filters;

      const query = {
        paymentStatus: status || { $in: ['pending', 'under_review'] }
      };

      if (priority) query.priority = priority;
      if (method) query.paymentMethod = method;
      
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const skip = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        PaymentTracking.find(query)
          .populate('userId', 'fullName email phone subscriptionTier')
          .sort({ priority: -1, createdAt: 1 })
          .skip(skip)
          .limit(limit),
        PaymentTracking.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      return successResponse('Pending payments retrieved', {
        payments: payments.map(payment => ({
          id: payment._id,
          user: payment.userId,
          amount: payment.paymentAmount,
          method: payment.paymentMethod,
          status: payment.paymentStatus,
          priority: payment.priority,
          verificationStage: payment.verificationStage,
          daysSincePayment: payment.daysSincePayment,
          verificationUrgency: payment.verificationUrgency,
          autoVerificationScore: payment.autoVerificationScore,
          screenshot: payment.paymentScreenshot,
          upiDetails: payment.upiDetails,
          createdAt: payment.createdAt
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      logError('Getting pending payments failed', { filters, error: error.message });
      throw error;
    }
  }

  // ============================================
  // SUBSCRIPTION UPGRADE/DOWNGRADE
  // ============================================

  /**
   * Request subscription tier change
   * @param {String} userId - User ID
   * @param {Object} upgradeData - Upgrade details
   * @returns {Object} Upgrade request result
   */
  async requestSubscriptionUpgrade(userId, upgradeData) {
    try {
      const { toTier, reason, reasonNotes, effectiveDate } = upgradeData;

      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const fromTier = user.subscriptionTier;
      
      if (fromTier === toTier) {
        throw new Error('User is already on the requested tier');
      }

      // Get current billing cycle
      const currentCycle = await BillingCycle.findOne({
        userId,
        cycleStatus: 'active'
      });

      if (!currentCycle) {
        throw new Error('No active billing cycle found');
      }

      // Create upgrade request
      const upgradeRequest = new SubscriptionUpgrade({
        userId,
        upgradeType: this.getUpgradeType(fromTier, toTier),
        fromTier,
        toTier,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        reason,
        reasonNotes
      });

      // Calculate proration
      const prorationAmount = upgradeRequest.calculateProration(currentCycle.cycleEndDate);
      
      // Determine if payment is required
      upgradeRequest.paymentRequired = upgradeRequest.requiresPayment();

      await upgradeRequest.save();

      // Update upgrade status based on payment requirement
      if (upgradeRequest.paymentRequired) {
        upgradeRequest.upgradeStatus = 'payment_pending';
        await upgradeRequest.save();
      } else {
        // Process immediate upgrade for downgrades
        await this.processSubscriptionUpgrade(upgradeRequest._id);
      }

      logInfo('Subscription upgrade requested', {
        userId,
        fromTier,
        toTier,
        upgradeId: upgradeRequest._id,
        paymentRequired: upgradeRequest.paymentRequired,
        netAmount: upgradeRequest.netAmount
      });

      return successResponse('Subscription upgrade requested', {
        upgradeId: upgradeRequest._id,
        fromTier,
        toTier,
        netAmount: upgradeRequest.netAmount,
        paymentRequired: upgradeRequest.paymentRequired,
        estimatedProcessingTime: upgradeRequest.estimatedProcessingTime,
        prorationDetails: upgradeRequest.prorationDetails
      });

    } catch (error) {
      logError('Subscription upgrade request failed', { userId, upgradeData, error: error.message });
      throw error;
    }
  }

  /**
   * Process subscription upgrade after payment verification
   * @param {String} upgradeId - Upgrade request ID
   * @returns {Object} Processing result
   */
  async processSubscriptionUpgrade(upgradeId) {
    try {
      const upgradeRequest = await SubscriptionUpgrade.findById(upgradeId);
      if (!upgradeRequest) {
        throw new Error('Upgrade request not found');
      }

      if (upgradeRequest.upgradeStatus === 'completed') {
        throw new Error('Upgrade already processed');
      }

      const userId = upgradeRequest.userId;

      // Update user subscription tier
      await User.findByIdAndUpdate(userId, {
        subscriptionTier: upgradeRequest.toTier,
        subscriptionStatus: 'active'
      });

      // Update current billing cycle
      await BillingCycle.findOneAndUpdate(
        { userId, cycleStatus: 'active' },
        { 
          subscriptionTier: upgradeRequest.toTier,
          // Update feature limits based on new tier
          featureLimits: User.getSubscriptionLimits(upgradeRequest.toTier)
        }
      );

      // Update upgrade request status
      upgradeRequest.upgradeStatus = 'completed';
      upgradeRequest.completedAt = new Date();
      await upgradeRequest.save();

      // Send notification to user
      const user = await User.findById(userId);
      await this.sendUpgradeCompletionNotification(user, upgradeRequest);

      logInfo('Subscription upgrade processed', {
        userId,
        upgradeId,
        fromTier: upgradeRequest.fromTier,
        toTier: upgradeRequest.toTier
      });

      return successResponse('Subscription upgrade completed', {
        newTier: upgradeRequest.toTier,
        completedAt: upgradeRequest.completedAt,
        featureLimits: User.getSubscriptionLimits(upgradeRequest.toTier)
      });

    } catch (error) {
      logError('Processing subscription upgrade failed', { upgradeId, error: error.message });
      throw error;
    }
  }

  // ============================================
  // RENEWAL & REMINDER MANAGEMENT
  // ============================================

  /**
   * Send renewal reminders
   * @returns {Object} Reminder sending results
   */
  async sendRenewalReminders() {
    try {
      const cyclesNeedingReminders = await BillingCycle.findCyclesNeedingReminders();
      
      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      for (const cycle of cyclesNeedingReminders) {
        try {
          const reminderType = this.determineReminderType(cycle.paymentDueDate);
          
          if (reminderType) {
            await this.sendRenewalReminder(cycle, reminderType);
            results.sent++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            cycleId: cycle._id,
            userId: cycle.userId,
            error: error.message
          });
        }
      }

      logInfo('Renewal reminders processed', results);
      return successResponse('Renewal reminders sent', results);

    } catch (error) {
      logError('Sending renewal reminders failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Process subscription cancellation
   * @param {String} userId - User ID
   * @param {Object} cancellationData - Cancellation details
   * @returns {Object} Cancellation result
   */
  async processSubscriptionCancellation(userId, cancellationData) {
    try {
      const { reason, effectiveDate, requestRefund } = cancellationData;

      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const currentCycle = await BillingCycle.findOne({
        userId,
        cycleStatus: 'active'
      });

      if (!currentCycle) {
        throw new Error('No active subscription found');
      }

      // Calculate refund eligibility
      const refundEligible = requestRefund && this.isRefundEligible(currentCycle);
      let refundAmount = 0;

      if (refundEligible) {
        refundAmount = this.calculateRefundAmount(currentCycle);
      }

      // Update billing cycle with cancellation request
      currentCycle.cancellationRequest = {
        requestedAt: new Date(),
        requestedBy: userId,
        reason,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : currentCycle.cycleEndDate,
        refundEligible,
        refundAmount,
        status: 'pending'
      };

      await currentCycle.save();

      // Update user status
      await User.findByIdAndUpdate(userId, {
        subscriptionStatus: 'cancelled'
      });

      logInfo('Subscription cancellation processed', {
        userId,
        reason,
        refundEligible,
        refundAmount
      });

      return successResponse('Subscription cancellation requested', {
        effectiveDate: currentCycle.cancellationRequest.effectiveDate,
        refundEligible,
        refundAmount,
        status: 'pending_review'
      });

    } catch (error) {
      logError('Subscription cancellation failed', { userId, error: error.message });
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get subscription pricing for all tiers
   * @returns {Object} Pricing structure
   */
  getSubscriptionPricing() {
    return {
      starter: {
        monthly: 299,
        quarterly: 807, // 10% discount
        features: ['basic_crm', 'basic_invoicing', 'basic_performance']
      },
      pro: {
        monthly: 699,
        quarterly: 1887, // 10% discount
        features: ['basic_crm', 'basic_invoicing', 'ai_pricing', 'ai_brief_analyzer']
      },
      elite: {
        monthly: 1299,
        quarterly: 3507, // 10% discount
        features: ['all_pro_features', 'ai_contract_review', 'advanced_analytics']
      },
      agency_starter: {
        monthly: 2999,
        quarterly: 8097, // 10% discount
        features: ['all_creator_features', 'multi_creator_dashboard']
      },
      agency_pro: {
        monthly: 6999,
        quarterly: 18897, // 10% discount
        features: ['all_features', 'advanced_workflows', 'api_access']
      }
    };
  }

  /**
   * Determine upgrade type
   * @param {String} fromTier - Current tier
   * @param {String} toTier - Target tier
   * @returns {String} Upgrade type
   */
  getUpgradeType(fromTier, toTier) {
    const tierHierarchy = {
      starter: 1,
      pro: 2,
      elite: 3,
      agency_starter: 4,
      agency_pro: 5
    };

    if (tierHierarchy[toTier] > tierHierarchy[fromTier]) {
      return 'upgrade';
    } else if (tierHierarchy[toTier] < tierHierarchy[fromTier]) {
      return 'downgrade';
    }
    return 'plan_change';
  }

  /**
   * Determine reminder type based on due date
   * @param {Date} paymentDueDate - Payment due date
   * @returns {String|null} Reminder type
   */
  determineReminderType(paymentDueDate) {
    const now = new Date();
    const diffDays = Math.ceil((paymentDueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 7) return '7_days_before';
    if (diffDays === 3) return '3_days_before';
    if (diffDays === 1) return '1_day_before';
    if (diffDays === 0) return 'due_date';
    if (diffDays < 0) return 'overdue';

    return null;
  }

  /**
   * Check if refund is eligible
   * @param {Object} billingCycle - Billing cycle
   * @returns {Boolean} Refund eligibility
   */
  isRefundEligible(billingCycle) {
    const now = new Date();
    const cycleStart = billingCycle.cycleStartDate;
    const daysSinceStart = Math.floor((now.getTime() - cycleStart.getTime()) / (24 * 60 * 60 * 1000));
    
    // Refund eligible if less than 15 days since cycle start
    return daysSinceStart <= 15;
  }

  /**
   * Calculate refund amount
   * @param {Object} billingCycle - Billing cycle
   * @returns {Number} Refund amount
   */
  calculateRefundAmount(billingCycle) {
    const now = new Date();
    const totalDays = Math.floor((billingCycle.cycleEndDate.getTime() - billingCycle.cycleStartDate.getTime()) / (24 * 60 * 60 * 1000));
    const remainingDays = Math.floor((billingCycle.cycleEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    const prorationFactor = remainingDays / totalDays;
    return Math.round(billingCycle.finalAmount * prorationFactor);
  }

  // ============================================
  // NOTIFICATION METHODS
  // ============================================

  /**
   * Send payment confirmation
   * @param {Object} user - User object
   * @param {Object} paymentTracking - Payment tracking record
   */
  async sendPaymentConfirmation(user, paymentTracking) {
    try {
      const message = `Payment of ₹${paymentTracking.paymentAmount} received for verification. Reference: ${paymentTracking._id.toString().slice(-8)}. Verification will be completed within 24-48 hours.`;
      
      if (user.preferences.notifications.sms) {
        await sendSMS(user.phone, message);
      }

      if (user.preferences.notifications.email) {
        await sendEmail({
          to: user.email,
          subject: 'Payment Confirmation - CreatorsMantra',
          template: 'payment-confirmation',
          data: {
            userName: user.fullName,
            amount: formatCurrency(paymentTracking.paymentAmount),
            reference: paymentTracking._id.toString().slice(-8),
            verificationTimeframe: '24-48 hours'
          }
        });
      }

    } catch (error) {
      logError('Sending payment confirmation failed', { 
        userId: user._id, 
        paymentTrackingId: paymentTracking._id,
        error: error.message 
      });
    }
  }

  /**
   * Send payment success notification
   * @param {Object} user - User object
   * @param {Object} paymentTracking - Payment tracking record
   * @param {Object} billingCycle - Billing cycle
   */
  async sendPaymentSuccessNotification(user, paymentTracking, billingCycle) {
    try {
      const message = `Payment verified! Your ${user.subscriptionTier} subscription is now active until ${billingCycle.cycleEndDate.toLocaleDateString('en-IN')}. Welcome to CreatorsMantra!`;
      
      if (user.preferences.notifications.sms) {
        await sendSMS(user.phone, message);
      }

      if (user.preferences.notifications.email) {
        await sendEmail({
          to: user.email,
          subject: 'Payment Verified - Subscription Active',
          template: 'payment-success',
          data: {
            userName: user.fullName,
            subscriptionTier: user.subscriptionTier,
            amount: formatCurrency(paymentTracking.paymentAmount),
            cycleEndDate: billingCycle.cycleEndDate.toLocaleDateString('en-IN'),
            features: User.getSubscriptionLimits(user.subscriptionTier).features
          }
        });
      }

    } catch (error) {
      logError('Sending payment success notification failed', { 
        userId: user._id, 
        error: error.message 
      });
    }
  }

  /**
   * Send payment failure notification
   * @param {Object} user - User object
   * @param {Object} paymentTracking - Payment tracking record
   */
  async sendPaymentFailureNotification(user, paymentTracking) {
    try {
      const message = `Payment verification failed: ${paymentTracking.failureReason}. Please contact support or try again with correct payment details.`;
      
      if (user.preferences.notifications.sms) {
        await sendSMS(user.phone, message);
      }

      if (user.preferences.notifications.email) {
        await sendEmail({
          to: user.email,
          subject: 'Payment Verification Failed',
          template: 'payment-failure',
          data: {
            userName: user.fullName,
            failureReason: paymentTracking.failureReason,
            amount: formatCurrency(paymentTracking.paymentAmount),
            supportContact: 'support@creatorsmantra.com'
          }
        });
      }

    } catch (error) {
      logError('Sending payment failure notification failed', { 
        userId: user._id, 
        error: error.message 
      });
    }
  }

  /**
   * Send renewal reminder
   * @param {Object} billingCycle - Billing cycle
   * @param {String} reminderType - Type of reminder
   */
  async sendRenewalReminder(billingCycle, reminderType) {
    try {
      const user = await User.findById(billingCycle.userId);
      if (!user) return;

      const daysText = {
        '7_days_before': '7 days',
        '3_days_before': '3 days',
        '1_day_before': '1 day',
        'due_date': 'today',
        'overdue': 'overdue'
      };

      const message = `Your CreatorsMantra subscription renewal is due ${daysText[reminderType]}. Amount: ₹${billingCycle.totalAmountWithGst}. Please make payment to continue service.`;
      
      if (user.preferences.notifications.sms) {
        await sendSMS(user.phone, message);
      }

      // Add reminder to billing cycle
      billingCycle.renewalReminders.push({
        reminderType,
        sentAt: new Date(),
        method: 'sms',
        status: 'sent'
      });

      await billingCycle.save();

    } catch (error) {
      logError('Sending renewal reminder failed', { 
        billingCycleId: billingCycle._id, 
        reminderType,
        error: error.message 
      });
    }
  }

  /**
   * Send upgrade completion notification
   * @param {Object} user - User object
   * @param {Object} upgradeRequest - Upgrade request
   */
  async sendUpgradeCompletionNotification(user, upgradeRequest) {
    try {
      const message = `Subscription upgraded to ${upgradeRequest.toTier}! New features are now available. Welcome to your enhanced CreatorsMantra experience.`;
      
      if (user.preferences.notifications.sms) {
        await sendSMS(user.phone, message);
      }

      if (user.preferences.notifications.email) {
        await sendEmail({
          to: user.email,
          subject: 'Subscription Upgrade Complete',
          template: 'upgrade-completion',
          data: {
            userName: user.fullName,
            newTier: upgradeRequest.toTier,
            features: User.getSubscriptionLimits(upgradeRequest.toTier).features,
            completedAt: upgradeRequest.completedAt.toLocaleDateString('en-IN')
          }
        });
      }

    } catch (error) {
      logError('Sending upgrade completion notification failed', { 
        userId: user._id, 
        upgradeId: upgradeRequest._id,
        error: error.message 
      });
    }
  }
}

module.exports = new SubscriptionService();