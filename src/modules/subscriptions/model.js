// src/modules/subscriptions/model.js
/**
 * CreatorsMantra Backend - Subscription Management Models
 * Payment tracking, billing cycles, and subscription lifecycle management
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const mongoose = require('mongoose');
const { encryptData, decryptData } = require('../../shared/utils');

// ============================================
// PAYMENT TRACKING SCHEMA
// ============================================

const paymentTrackingSchema = new mongoose.Schema({
  // Reference to User
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Reference to Subscription History
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionHistory',
    required: true
  },
  
  // Payment Details
  paymentAmount: {
    type: Number,
    required: true,
    min: [0, 'Payment amount cannot be negative'],
    validate: {
      validator: function(value) {
        return value >= 299; // Minimum subscription amount
      },
      message: 'Payment amount must be at least ₹299'
    }
  },
  
  originalAmount: {
    type: Number,
    required: true,
    min: [0, 'Original amount cannot be negative']
  },
  
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount cannot be negative']
  },
  
  discountType: {
    type: String,
    enum: ['quarterly_discount', 'promotional', 'referral', 'none'],
    default: 'none'
  },
  
  // Payment Method Details
  paymentMethod: {
    type: String,
    enum: ['upi', 'bank_transfer', 'card', 'wallet', 'cash'],
    default: 'upi',
    required: true
  },
  
  // UPI Specific Fields
  upiDetails: {
    upiId: String,
    transactionId: String,
    bankReference: String,
    senderName: String,
    receiverUpiId: {
      type: String,
      default: 'creatorsmantra@paytm' // Default UPI ID
    }
  },
  
  // Bank Transfer Details (encrypted)
  bankDetails: {
    accountNumber: String, // Will be encrypted
    ifscCode: String,
    bankName: String,
    transferReference: String,
    senderAccountName: String
  },
  
  // Payment Verification
  paymentStatus: {
    type: String,
    enum: ['pending', 'under_review', 'verified', 'failed', 'disputed', 'refunded'],
    default: 'pending',
    required: true
  },
  
  verificationStage: {
    type: String,
    enum: ['screenshot_uploaded', 'details_verified', 'amount_verified', 'completed'],
    default: 'screenshot_uploaded'
  },
  
  // Screenshot Management
  paymentScreenshot: {
    originalUrl: String, // S3 URL for original screenshot
    compressedUrl: String, // S3 URL for compressed version
    thumbnailUrl: String, // S3 URL for thumbnail
    fileName: String,
    fileSize: Number,
    uploadedAt: Date
  },
  
  // Verification Details
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  verifiedAt: Date,
  
  verificationNotes: String,
  
  autoVerificationScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  verificationAttempts: {
    type: Number,
    default: 0,
    max: 3
  },
  
  // Failure Handling
  failureReason: {
    type: String,
    enum: [
      'invalid_amount',
      'unclear_screenshot',
      'wrong_upi_id',
      'duplicate_transaction',
      'insufficient_details',
      'fraudulent_activity',
      'other'
    ]
  },
  
  failureNotes: String,
  
  // Refund Management
  refundAmount: {
    type: Number,
    default: 0,
    min: [0, 'Refund amount cannot be negative']
  },
  
  refundReason: String,
  
  refundMethod: {
    type: String,
    enum: ['same_method', 'bank_transfer', 'upi', 'manual']
  },
  
  refundReference: String,
  
  refundDate: Date,
  
  refundedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Communication Tracking
  communicationLog: [{
    type: {
      type: String,
      enum: ['sms', 'email', 'whatsapp', 'call', 'internal_note']
    },
    message: String,
    sentAt: {
      type: Date,
      default: Date.now
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed']
    }
  }],
  
  // Metadata
  ipAddress: String,
  userAgent: String,
  deviceInfo: String,
  
  // Internal Flags
  flaggedForReview: {
    type: Boolean,
    default: false
  },
  
  flagReason: String,
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// BILLING CYCLE SCHEMA
// ============================================

const billingCycleSchema = new mongoose.Schema({
  // Reference to User
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Cycle Information
  cycleNumber: {
    type: Number,
    required: true,
    min: 1
  },
  
  cycleType: {
    type: String,
    enum: ['trial', 'quarterly', 'annual', 'custom'],
    default: 'quarterly',
    required: true
  },
  
  subscriptionTier: {
    type: String,
    enum: ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro'],
    required: true
  },
  
  // Cycle Dates
  cycleStartDate: {
    type: Date,
    required: true
  },
  
  cycleEndDate: {
    type: Date,
    required: true
  },
  
  // Payment Due Dates
  paymentDueDate: {
    type: Date,
    required: true
  },
  
  gracePeriodEndDate: {
    type: Date,
    required: true,
    default: function() {
      // 3 days grace period after cycle end
      return new Date(this.cycleEndDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    }
  },
  
  // Billing Amounts
  baseAmount: {
    type: Number,
    required: true,
    min: [0, 'Base amount cannot be negative']
  },
  
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount cannot be negative']
  },
  
  finalAmount: {
    type: Number,
    required: true,
    min: [0, 'Final amount cannot be negative']
  },
  
  gstAmount: {
    type: Number,
    default: 0,
    min: [0, 'GST amount cannot be negative']
  },
  
  totalAmountWithGst: {
    type: Number,
    required: true
  },
  
  // Proration Handling
  isProrated: {
    type: Boolean,
    default: false
  },
  
  prorationDetails: {
    originalCycleEndDate: Date,
    adjustedDays: Number,
    prorationFactor: Number,
    reason: {
      type: String,
      enum: ['upgrade', 'downgrade', 'mid_cycle_change', 'refund']
    }
  },
  
  // Cycle Status
  cycleStatus: {
    type: String,
    enum: ['upcoming', 'active', 'payment_pending', 'payment_overdue', 'completed', 'cancelled', 'refunded'],
    default: 'upcoming',
    required: true
  },
  
  // Payment Tracking
  paymentStatus: {
    type: String,
    enum: ['not_required', 'pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  
  paymentDate: Date,
  
  paymentReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentTracking'
  },
  
  // Renewal Management
  autoRenewal: {
    type: Boolean,
    default: true
  },
  
  renewalReminders: [{
    reminderType: {
      type: String,
      enum: ['7_days_before', '3_days_before', '1_day_before', 'due_date', 'overdue']
    },
    sentAt: Date,
    method: {
      type: String,
      enum: ['email', 'sms', 'push', 'whatsapp']
    },
    status: {
      type: String,
      enum: ['scheduled', 'sent', 'delivered', 'failed']
    }
  }],
  
  // Cancellation Handling
  cancellationRequest: {
    requestedAt: Date,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    effectiveDate: Date,
    refundEligible: Boolean,
    refundAmount: Number,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'processed']
    }
  },
  
  // Usage Tracking
  usageStats: {
    dealsCreated: {
      type: Number,
      default: 0
    },
    invoicesGenerated: {
      type: Number,
      default: 0
    },
    aiQueriesUsed: {
      type: Number,
      default: 0
    },
    storageUsed: {
      type: Number,
      default: 0 // in MB
    },
    lastActivityDate: Date
  },
  
  // Feature Usage Limits
  featureLimits: {
    maxActiveDeals: Number,
    maxInvoicesPerMonth: Number,
    maxUsers: Number,
    maxCreators: Number, // For agency plans
    maxAiQueries: Number,
    maxStorageMB: Number
  },
  
  // Notes and Internal Data
  internalNotes: String,
  
  billingContact: {
    email: String,
    phone: String,
    name: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// SUBSCRIPTION UPGRADE SCHEMA
// ============================================

const subscriptionUpgradeSchema = new mongoose.Schema({
  // Reference to User
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Upgrade Details
  upgradeType: {
    type: String,
    enum: ['upgrade', 'downgrade', 'plan_change'],
    required: true
  },
  
  fromTier: {
    type: String,
    enum: ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro'],
    required: true
  },
  
  toTier: {
    type: String,
    enum: ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro'],
    required: true
  },
  
  // Timing
  requestedAt: {
    type: Date,
    default: Date.now
  },
  
  effectiveDate: {
    type: Date,
    required: true
  },
  
  completedAt: Date,
  
  // Financial Impact
  currentCycleRefund: {
    type: Number,
    default: 0
  },
  
  newCycleCharge: {
    type: Number,
    default: 0
  },
  
  netAmount: {
    type: Number,
    default: 0 // Positive = charge, Negative = refund
  },
  
  // Proration Calculations
  prorationDetails: {
    remainingDaysInCurrentCycle: Number,
    currentPlanDailyRate: Number,
    newPlanDailyRate: Number,
    prorationAmount: Number,
    calculationMethod: {
      type: String,
      enum: ['daily_proration', 'no_proration', 'credit_forward']
    }
  },
  
  // Upgrade Status
  upgradeStatus: {
    type: String,
    enum: ['requested', 'payment_pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'requested'
  },
  
  // Payment Processing
  paymentRequired: {
    type: Boolean,
    default: false
  },
  
  paymentReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentTracking'
  },
  
  refundReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentTracking'
  },
  
  // Feature Access Transition
  featureTransition: {
    addedFeatures: [String],
    removedFeatures: [String],
    limitChanges: {
      maxActiveDeals: {
        from: Number,
        to: Number
      },
      maxUsers: {
        from: Number,
        to: Number
      },
      maxCreators: {
        from: Number,
        to: Number
      }
    }
  },
  
  // User Communication
  userNotified: {
    type: Boolean,
    default: false
  },
  
  notificationSentAt: Date,
  
  userConfirmation: {
    confirmed: Boolean,
    confirmedAt: Date,
    confirmationMethod: {
      type: String,
      enum: ['email', 'sms', 'app', 'manual']
    }
  },
  
  // Error Handling
  errors: [{
    errorCode: String,
    errorMessage: String,
    occurredAt: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }],
  
  // Rollback Information
  rollbackData: {
    canRollback: {
      type: Boolean,
      default: true
    },
    rollbackDeadline: Date,
    originalBillingCycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BillingCycle'
    }
  },
  
  // Admin Actions
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  adminNotes: String,
  
  // Reason for Upgrade/Downgrade
  reason: {
    type: String,
    enum: [
      'feature_requirement',
      'cost_optimization', 
      'business_growth',
      'team_expansion',
      'usage_increase',
      'trial_conversion',
      'other'
    ]
  },
  
  reasonNotes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// PAYMENT TRACKING METHODS & VIRTUALS
// ============================================

// Encrypt sensitive bank details before saving
paymentTrackingSchema.pre('save', async function(next) {
  if (this.isModified('bankDetails.accountNumber') && this.bankDetails.accountNumber) {
    this.bankDetails.accountNumber = encryptData(this.bankDetails.accountNumber);
  }
  next();
});

// Decrypt bank details when retrieved
paymentTrackingSchema.methods.getDecryptedBankDetails = function() {
  if (this.bankDetails.accountNumber) {
    return {
      ...this.bankDetails.toObject(),
      accountNumber: decryptData(this.bankDetails.accountNumber)
    };
  }
  return this.bankDetails;
};

// Check if payment is within verification time limit
paymentTrackingSchema.methods.isWithinVerificationWindow = function() {
  const maxVerificationTime = 48 * 60 * 60 * 1000; // 48 hours
  return (Date.now() - this.createdAt.getTime()) <= maxVerificationTime;
};

// Calculate verification score based on details
paymentTrackingSchema.methods.calculateVerificationScore = function() {
  let score = 0;
  
  // Amount match
  if (this.paymentAmount && this.originalAmount) {
    const difference = Math.abs(this.paymentAmount - this.originalAmount);
    if (difference === 0) score += 40;
    else if (difference <= 10) score += 30;
    else if (difference <= 50) score += 20;
  }
  
  // UPI details completeness
  if (this.upiDetails.transactionId) score += 20;
  if (this.upiDetails.senderName) score += 15;
  if (this.upiDetails.upiId) score += 15;
  
  // Screenshot quality
  if (this.paymentScreenshot.originalUrl) score += 10;
  
  this.autoVerificationScore = Math.min(score, 100);
  return score;
};

// Virtual: Days since payment
paymentTrackingSchema.virtual('daysSincePayment').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (24 * 60 * 60 * 1000));
});

// Virtual: Verification urgency
paymentTrackingSchema.virtual('verificationUrgency').get(function() {
  const days = this.daysSincePayment;
  if (days >= 2) return 'urgent';
  if (days >= 1) return 'high';
  return 'medium';
});

// ============================================
// BILLING CYCLE METHODS & VIRTUALS
// ============================================

// Calculate discount for quarterly billing
billingCycleSchema.methods.calculateQuarterlyDiscount = function() {
  if (this.cycleType === 'quarterly') {
    return Math.round(this.baseAmount * 0.10); // 10% discount
  }
  return 0;
};

// Calculate GST amount
billingCycleSchema.methods.calculateGST = function() {
  return Math.round(this.finalAmount * 0.18); // 18% GST
};

// Calculate total amount including GST
billingCycleSchema.methods.calculateTotalAmount = function() {
  return this.finalAmount + this.calculateGST();
};

// Update amounts before saving
billingCycleSchema.pre('save', function(next) {
  // Calculate discount
  this.discountAmount = this.calculateQuarterlyDiscount();
  
  // Calculate final amount
  this.finalAmount = this.baseAmount - this.discountAmount;
  
  // Calculate GST
  this.gstAmount = this.calculateGST();
  
  // Calculate total
  this.totalAmountWithGst = this.calculateTotalAmount();
  
  next();
});

// Check if cycle is in grace period
billingCycleSchema.methods.isInGracePeriod = function() {
  const now = new Date();
  return now > this.cycleEndDate && now <= this.gracePeriodEndDate;
};

// Check if cycle is overdue
billingCycleSchema.methods.isOverdue = function() {
  return new Date() > this.gracePeriodEndDate && this.paymentStatus !== 'completed';
};

// Virtual: Days remaining in cycle
billingCycleSchema.virtual('daysRemaining').get(function() {
  const remaining = Math.ceil((this.cycleEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
});

// Virtual: Days until payment due
billingCycleSchema.virtual('daysUntilDue').get(function() {
  const remaining = Math.ceil((this.paymentDueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return remaining;
});

// Virtual: Grace period days remaining
billingCycleSchema.virtual('graceDaysRemaining').get(function() {
  if (!this.isInGracePeriod()) return 0;
  const remaining = Math.ceil((this.gracePeriodEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
});

// ============================================
// SUBSCRIPTION UPGRADE METHODS & VIRTUALS
// ============================================

// Calculate proration amount
subscriptionUpgradeSchema.methods.calculateProration = function(currentCycleEndDate) {
  const now = new Date();
  const totalDaysInCycle = 90; // Quarterly billing
  const remainingDays = Math.ceil((currentCycleEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  
  // Get subscription tier pricing
  const pricing = {
    starter: 807, // Quarterly price with discount
    pro: 1887,
    elite: 3507,
    agency_starter: 8097,
    agency_pro: 18897
  };
  
  const fromPrice = pricing[this.fromTier];
  const toPrice = pricing[this.toTier];
  
  const fromDailyRate = fromPrice / totalDaysInCycle;
  const toDailyRate = toPrice / totalDaysInCycle;
  
  const refundAmount = Math.round(fromDailyRate * remainingDays);
  const chargeAmount = Math.round(toDailyRate * remainingDays);
  
  this.prorationDetails = {
    remainingDaysInCurrentCycle: remainingDays,
    currentPlanDailyRate: fromDailyRate,
    newPlanDailyRate: toDailyRate,
    prorationAmount: chargeAmount - refundAmount,
    calculationMethod: 'daily_proration'
  };
  
  this.currentCycleRefund = refundAmount;
  this.newCycleCharge = chargeAmount;
  this.netAmount = chargeAmount - refundAmount;
  
  return this.netAmount;
};

// Check if upgrade requires payment
subscriptionUpgradeSchema.methods.requiresPayment = function() {
  return this.netAmount > 0;
};

// Virtual: Upgrade direction
subscriptionUpgradeSchema.virtual('isUpgrade').get(function() {
  const tierHierarchy = {
    starter: 1,
    pro: 2,
    elite: 3,
    agency_starter: 4,
    agency_pro: 5
  };
  
  return tierHierarchy[this.toTier] > tierHierarchy[this.fromTier];
});

// Virtual: Processing time estimate
subscriptionUpgradeSchema.virtual('estimatedProcessingTime').get(function() {
  if (this.paymentRequired && this.netAmount > 0) {
    return '24-48 hours'; // Requires payment verification
  }
  return '2-4 hours'; // Immediate for downgrades or no payment
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

// Payment Tracking Indexes
paymentTrackingSchema.index({ userId: 1, createdAt: -1 });
paymentTrackingSchema.index({ paymentStatus: 1, createdAt: -1 });
paymentTrackingSchema.index({ verificationStage: 1, flaggedForReview: 1 });
paymentTrackingSchema.index({ 'upiDetails.transactionId': 1 });
paymentTrackingSchema.index({ paymentMethod: 1, paymentStatus: 1 });

// Billing Cycle Indexes
billingCycleSchema.index({ userId: 1, cycleNumber: -1 });
billingCycleSchema.index({ cycleStatus: 1, cycleEndDate: 1 });
billingCycleSchema.index({ paymentDueDate: 1, paymentStatus: 1 });
billingCycleSchema.index({ gracePeriodEndDate: 1, cycleStatus: 1 });

// Subscription Upgrade Indexes
subscriptionUpgradeSchema.index({ userId: 1, requestedAt: -1 });
subscriptionUpgradeSchema.index({ upgradeStatus: 1, effectiveDate: 1 });
subscriptionUpgradeSchema.index({ fromTier: 1, toTier: 1 });

// ============================================
// STATIC METHODS
// ============================================

// Find pending payments for verification
paymentTrackingSchema.statics.findPendingVerifications = function(limit = 50) {
  return this.find({
    paymentStatus: { $in: ['pending', 'under_review'] },
    verificationAttempts: { $lt: 3 }
  })
  .sort({ priority: -1, createdAt: 1 })
  .limit(limit)
  .populate('userId', 'fullName email phone subscriptionTier');
};

// Find overdue billing cycles
billingCycleSchema.statics.findOverdueCycles = function() {
  const now = new Date();
  return this.find({
    gracePeriodEndDate: { $lt: now },
    cycleStatus: { $in: ['payment_pending', 'payment_overdue'] },
    paymentStatus: { $ne: 'completed' }
  })
  .populate('userId', 'fullName email phone')
  .sort({ gracePeriodEndDate: 1 });
};

// Find cycles needing renewal reminders
billingCycleSchema.statics.findCyclesNeedingReminders = function() {
  const reminderDates = {
    '7_days_before': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    '3_days_before': new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    '1_day_before': new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    'due_date': new Date(),
    'overdue': new Date(Date.now() - 24 * 60 * 60 * 1000)
  };
  
  return this.find({
    cycleStatus: 'active',
    autoRenewal: true,
    $or: [
      { 
        paymentDueDate: { 
          $gte: reminderDates['7_days_before'], 
          $lte: new Date(reminderDates['7_days_before'].getTime() + 24 * 60 * 60 * 1000) 
        },
        'renewalReminders.reminderType': { $ne: '7_days_before' }
      },
      {
        paymentDueDate: { 
          $gte: reminderDates['3_days_before'], 
          $lte: new Date(reminderDates['3_days_before'].getTime() + 24 * 60 * 60 * 1000) 
        },
        'renewalReminders.reminderType': { $ne: '3_days_before' }
      }
      // Add other reminder conditions...
    ]
  })
  .populate('userId', 'fullName email phone preferences');
};

// ============================================
// EXPORT MODELS
// ============================================

const PaymentTracking = mongoose.model('PaymentTracking', paymentTrackingSchema);
const BillingCycle = mongoose.model('BillingCycle', billingCycleSchema);
const SubscriptionUpgrade = mongoose.model('SubscriptionUpgrade', subscriptionUpgradeSchema);

module.exports = {
  PaymentTracking,
  BillingCycle,
  SubscriptionUpgrade
};