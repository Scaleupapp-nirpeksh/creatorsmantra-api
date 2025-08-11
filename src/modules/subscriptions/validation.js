//src/modules/subscriptions/validation.js

/**
 * CreatorsMantra Backend - Subscription Validation Schemas
 * Joi validation schemas for subscription management endpoints
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const Joi = require('joi');
const { isValidPhone, isValidEmail } = require('../../shared/utils');

// ============================================
// PAYMENT VERIFICATION SCHEMAS
// ============================================


const initiatePaymentVerificationSchema = Joi.object({
  // Make subscriptionId optional
  subscriptionId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid subscription ID format'
    }),

  // Add subscriptionTier as alternative
  subscriptionTier: Joi.string()
    .valid('starter', 'pro', 'elite', 'agency_starter', 'agency_pro')
    .messages({
      'any.only': 'Invalid subscription tier'
    }),

  paymentAmount: Joi.number()
    .required()
    .min(299)
    .max(50000)
    .messages({
      'number.min': 'Payment amount must be at least ₹299',
      'number.max': 'Payment amount cannot exceed ₹50,000',
      'any.required': 'Payment amount is required'
    }),

  paymentMethod: Joi.string()
    .valid('upi', 'bank_transfer', 'card', 'wallet')
    .default('upi')
    .messages({
      'any.only': 'Payment method must be one of: upi, bank_transfer, card, wallet'
    }),

  // UPI Details (required when paymentMethod is 'upi')
  upiDetails: Joi.when('paymentMethod', {
    is: 'upi',
    then: Joi.object({
      upiId: Joi.string()
        .pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/)
        .messages({
          'string.pattern.base': 'Invalid UPI ID format'
        }),
      
      transactionId: Joi.string()
        .alphanum()
        .min(8)
        .max(50)
        .messages({
          'string.alphanum': 'Transaction ID must contain only letters and numbers',
          'string.min': 'Transaction ID must be at least 8 characters',
          'string.max': 'Transaction ID cannot exceed 50 characters'
        }),
      
      bankReference: Joi.string()
        .alphanum()
        .max(50)
        .messages({
          'string.alphanum': 'Bank reference must contain only letters and numbers'
        }),
      
      senderName: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .pattern(/^[a-zA-Z\s]+$/)
        .messages({
          'string.pattern.base': 'Sender name must contain only letters and spaces',
          'string.min': 'Sender name must be at least 2 characters',
          'string.max': 'Sender name cannot exceed 100 characters'
        })
    }).required(),
    otherwise: Joi.optional()
  }),

  // Bank Transfer Details (required when paymentMethod is 'bank_transfer')
  bankDetails: Joi.when('paymentMethod', {
    is: 'bank_transfer',
    then: Joi.object({
      accountNumber: Joi.string()
        .pattern(/^[0-9]{9,18}$/)
        .required()
        .messages({
          'string.pattern.base': 'Account number must be 9-18 digits',
          'any.required': 'Account number is required for bank transfer'
        }),
      
      ifscCode: Joi.string()
        .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid IFSC code format',
          'any.required': 'IFSC code is required for bank transfer'
        }),
      
      bankName: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({
          'any.required': 'Bank name is required for bank transfer'
        }),
      
      transferReference: Joi.string()
        .alphanum()
        .max(50)
        .messages({
          'string.alphanum': 'Transfer reference must contain only letters and numbers'
        }),
      
      senderAccountName: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .pattern(/^[a-zA-Z\s]+$/)
        .required()
        .messages({
          'string.pattern.base': 'Account holder name must contain only letters and spaces',
          'any.required': 'Sender account name is required for bank transfer'
        })
    }).required(),
    otherwise: Joi.optional()
  }),

  // Payment Screenshot
  paymentScreenshot: Joi.object({
    originalUrl: Joi.string().uri().required(),
    fileName: Joi.string().required(),
    fileSize: Joi.number().min(1).max(10 * 1024 * 1024), // Max 10MB
    uploadedAt: Joi.date().default(Date.now)
  }).optional()
}).or('subscriptionId', 'subscriptionTier') // Require at least one
.messages({
  'object.missing': 'Either subscriptionId or subscriptionTier must be provided'
});

const manualPaymentVerificationSchema = Joi.object({
  status: Joi.string()
    .valid('verified', 'failed', 'disputed')
    .required()
    .messages({
      'any.only': 'Status must be one of: verified, failed, disputed',
      'any.required': 'Verification status is required'
    }),

  notes: Joi.string()
    .trim()
    .max(1000)
    .messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    }),

  failureReason: Joi.when('status', {
    is: 'failed',
    then: Joi.string()
      .valid(
        'invalid_amount',
        'unclear_screenshot',
        'wrong_upi_id',
        'duplicate_transaction',
        'insufficient_details',
        'fraudulent_activity',
        'other'
      )
      .required()
      .messages({
        'any.required': 'Failure reason is required when status is failed'
      }),
    otherwise: Joi.optional()
  })
});

// ============================================
// SUBSCRIPTION UPGRADE SCHEMAS
// ============================================

const subscriptionUpgradeSchema = Joi.object({
  toTier: Joi.string()
    .valid('starter', 'pro', 'elite', 'agency_starter', 'agency_pro')
    .required()
    .messages({
      'any.only': 'Invalid subscription tier',
      'any.required': 'Target subscription tier is required'
    }),

  reason: Joi.string()
    .valid(
      'feature_requirement',
      'cost_optimization',
      'business_growth',
      'team_expansion',
      'usage_increase',
      'trial_conversion',
      'other'
    )
    .messages({
      'any.only': 'Invalid reason for upgrade'
    }),

  reasonNotes: Joi.string()
    .trim()
    .max(500)
    .messages({
      'string.max': 'Reason notes cannot exceed 500 characters'
    }),

  effectiveDate: Joi.date()
    .min('now')
    .messages({
      'date.min': 'Effective date cannot be in the past'
    })
});

// ============================================
// SUBSCRIPTION CANCELLATION SCHEMAS
// ============================================

const subscriptionCancellationSchema = Joi.object({
  reason: Joi.string()
    .valid(
      'too_expensive',
      'not_using_features',
      'found_alternative',
      'business_closure',
      'technical_issues',
      'poor_support',
      'other'
    )
    .required()
    .messages({
      'any.only': 'Invalid cancellation reason',
      'any.required': 'Cancellation reason is required'
    }),

  reasonNotes: Joi.string()
    .trim()
    .max(1000)
    .messages({
      'string.max': 'Reason notes cannot exceed 1000 characters'
    }),

  effectiveDate: Joi.date()
    .min('now')
    .messages({
      'date.min': 'Effective date cannot be in the past'
    }),

  requestRefund: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Request refund must be true or false'
    })
});

// ============================================
// QUERY PARAMETER SCHEMAS
// ============================================

const getPendingPaymentsQuerySchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'under_review', 'verified', 'failed', 'disputed')
    .messages({
      'any.only': 'Invalid payment status filter'
    }),

  priority: Joi.string()
    .valid('low', 'medium', 'high', 'urgent')
    .messages({
      'any.only': 'Invalid priority filter'
    }),

  method: Joi.string()
    .valid('upi', 'bank_transfer', 'card', 'wallet')
    .messages({
      'any.only': 'Invalid payment method filter'
    }),

  dateFrom: Joi.date()
    .messages({
      'date.base': 'Invalid date format for dateFrom'
    }),

  dateTo: Joi.date()
    .min(Joi.ref('dateFrom'))
    .messages({
      'date.base': 'Invalid date format for dateTo',
      'date.min': 'dateTo must be after dateFrom'
    }),

  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    })
});

const getBillingHistoryQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .default(10)
    .messages({
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50'
    })
});

const getUpgradeRequestsQuerySchema = Joi.object({
  status: Joi.string()
    .valid('requested', 'payment_pending', 'processing', 'completed', 'failed', 'cancelled')
    .messages({
      'any.only': 'Invalid upgrade status filter'
    }),

  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .default(10)
    .messages({
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50'
    })
});

const getSubscriptionStatsQuerySchema = Joi.object({
  period: Joi.string()
    .valid('7d', '30d', '90d')
    .default('30d')
    .messages({
      'any.only': 'Period must be one of: 7d, 30d, 90d'
    })
});

// ============================================
// AUTO-RENEWAL SCHEMAS
// ============================================

const updateAutoRenewalSchema = Joi.object({
  autoRenewal: Joi.boolean()
    .required()
    .messages({
      'boolean.base': 'Auto renewal must be true or false',
      'any.required': 'Auto renewal setting is required'
    })
});

// ============================================
// PARAM VALIDATION SCHEMAS
// ============================================

const paymentIdParamSchema = Joi.object({
  paymentId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid payment ID format',
      'any.required': 'Payment ID is required'
    })
});

const upgradeIdParamSchema = Joi.object({
  upgradeId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid upgrade ID format',
      'any.required': 'Upgrade ID is required'
    })
});

// ============================================
// FILE UPLOAD VALIDATION
// ============================================

const validatePaymentScreenshot = (req, res, next) => {
  // Validate file presence
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Payment screenshot is required',
      code: 400
    });
  }

  // Validate file type
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Only JPEG and PNG images are allowed',
      code: 400
    });
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'File size cannot exceed 10MB',
      code: 400
    });
  }

  // Validate image dimensions (optional - can be implemented with sharp or jimp)
  // For now, we'll skip dimension validation

  next();
};

// ============================================
// CUSTOM VALIDATION FUNCTIONS
// ============================================

const validateSubscriptionTierChange = (fromTier, toTier) => {
  const validTiers = ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro'];
  
  if (!validTiers.includes(fromTier) || !validTiers.includes(toTier)) {
    throw new Error('Invalid subscription tier');
  }

  if (fromTier === toTier) {
    throw new Error('Cannot change to the same tier');
  }

  // Additional business logic validations can be added here
  // For example, preventing direct jumps from starter to agency_pro
  
  return true;
};

const validatePaymentAmount = (amount, expectedAmount, tolerance = 50) => {
  const difference = Math.abs(amount - expectedAmount);
  
  if (difference > tolerance) {
    throw new Error(`Payment amount mismatch. Expected: ₹${expectedAmount}, Received: ₹${amount}`);
  }
  
  return true;
};

const validateUPIId = (upiId) => {
  const upiPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;
  
  if (!upiPattern.test(upiId)) {
    throw new Error('Invalid UPI ID format');
  }
  
  // Additional UPI ID validations can be added here
  // For example, checking against known UPI providers
  
  return true;
};

const validateBankAccount = (accountNumber, ifscCode) => {
  // Account number validation (9-18 digits)
  const accountPattern = /^[0-9]{9,18}$/;
  if (!accountPattern.test(accountNumber)) {
    throw new Error('Invalid account number format');
  }
  
  // IFSC code validation
  const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscPattern.test(ifscCode)) {
    throw new Error('Invalid IFSC code format');
  }
  
  return true;
};

// ============================================
// COMBINED VALIDATION MIDDLEWARE
// ============================================

const validateCompletePaymentData = (req, res, next) => {
  try {
    const { paymentMethod, upiDetails, bankDetails, paymentAmount } = req.body;
    
    // Basic amount validation
    if (paymentAmount < 299 || paymentAmount > 50000) {
      throw new Error('Payment amount must be between ₹299 and ₹50,000');
    }
    
    // Payment method specific validations
    if (paymentMethod === 'upi' && upiDetails) {
      if (upiDetails.upiId) {
        validateUPIId(upiDetails.upiId);
      }
    }
    
    if (paymentMethod === 'bank_transfer' && bankDetails) {
      validateBankAccount(bankDetails.accountNumber, bankDetails.ifscCode);
    }
    
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
      code: 400
    });
  }
};

// ============================================
// EXPORT ALL SCHEMAS
// ============================================

module.exports = {
  // Payment verification schemas
  initiatePaymentVerificationSchema,
  manualPaymentVerificationSchema,
  
  // Subscription management schemas
  subscriptionUpgradeSchema,
  subscriptionCancellationSchema,
  updateAutoRenewalSchema,
  
  // Query parameter schemas
  getPendingPaymentsQuerySchema,
  getBillingHistoryQuerySchema,
  getUpgradeRequestsQuerySchema,
  getSubscriptionStatsQuerySchema,
  
  // Parameter validation schemas
  paymentIdParamSchema,
  upgradeIdParamSchema,
  
  // File upload validation
  validatePaymentScreenshot,
  
  // Custom validation functions
  validateSubscriptionTierChange,
  validatePaymentAmount,
  validateUPIId,
  validateBankAccount,
  validateCompletePaymentData
};