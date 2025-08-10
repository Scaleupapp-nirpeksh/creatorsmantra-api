//src/modules/subscriptions/routes.js
/**
 * CreatorsMantra Backend - Subscription Routes
 * API endpoints for subscription management
 * 
 * FIXED: Correct middleware names and route ordering
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');

const subscriptionController = require('./controller');
const { 
  authenticateUser,  // FIXED: Changed from authenticateToken
  authorizeRoles, 
  validateRequest,
  authorizeSubscription  // FIXED: Using authorizeSubscription instead of checkSubscriptionAccess
} = require('../../shared/middleware');

const {
  initiatePaymentVerificationSchema,
  manualPaymentVerificationSchema,
  subscriptionUpgradeSchema,
  subscriptionCancellationSchema,
  updateAutoRenewalSchema,
  getPendingPaymentsQuerySchema,
  getBillingHistoryQuerySchema,
  getUpgradeRequestsQuerySchema,
  getSubscriptionStatsQuerySchema,
  paymentIdParamSchema,
  upgradeIdParamSchema,
  validatePaymentScreenshot,
  validateCompletePaymentData
} = require('./validation');

const router = express.Router();

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================

const paymentVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many payment verification attempts. Please try again later.',
    code: 429
  },
  standardHeaders: true,
  legacyHeaders: false
});

const subscriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Too many subscription requests. Please try again later.',
    code: 429
  },
  standardHeaders: true,
  legacyHeaders: false
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many admin requests. Please try again later.',
    code: 429
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// SUBSCRIPTION TIERS (for authorization)
// ============================================

const ALLOWED_TIERS = ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro'];

// ============================================
// FILE UPLOAD CONFIGURATION (Conditional)
// ============================================

let upload;

// Only configure S3 if AWS credentials are available
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'ap-south-1'
  });

  upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.AWS_S3_BUCKET || 'creatorsmantra-payments',
      key: function (req, file, cb) {
        const userId = req.user.id;
        const timestamp = Date.now();
        const filename = `payments/${userId}/${timestamp}-${file.originalname}`;
        cb(null, filename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
      metadata: function (req, file, cb) {
        cb(null, {
          userId: req.user.id,
          uploadedAt: new Date().toISOString(),
          originalName: file.originalname
        });
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1
    },
    fileFilter: function (req, file, cb) {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    }
  });
} else {
  // Fallback to memory storage if S3 is not configured
  upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1
    },
    fileFilter: function (req, file, cb) {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    }
  });
}

// ============================================
// PUBLIC/UTILITY ROUTES (No params, no auth)
// ============================================

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Subscription module is healthy',
    data: {
      module: 'subscriptions',
      status: 'active',
      features: [
        'payment_verification',
        'billing_cycles',
        'subscription_upgrades',
        'renewal_management'
      ],
      version: '1.0.0'
    },
    timestamp: new Date().toISOString()
  });
});

// Get subscription tiers (public)
router.get('/tiers', (req, res) => {
  const subscriptionService = require('./service');
  const pricing = subscriptionService.getSubscriptionPricing();
  
  res.status(200).json({
    success: true,
    message: 'Subscription tiers retrieved',
    data: pricing,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ROUTES WITHOUT PARAMETERS (Auth required)
// ============================================

// Payment verification routes
router.post('/payments/verify',
  paymentVerificationLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  validateRequest(initiatePaymentVerificationSchema),
  validateCompletePaymentData,
  subscriptionController.initiatePaymentVerification
);

router.get('/payments/pending',
  adminLimiter,
  authenticateUser,
  authorizeRoles(['admin', 'super_admin']),
  validateRequest(getPendingPaymentsQuerySchema, 'query'),
  subscriptionController.getPendingPayments
);

// Billing cycle routes
router.get('/billing/current',
  subscriptionLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(ALLOWED_TIERS),
  subscriptionController.getCurrentBillingCycle
);

router.get('/billing/history',
  subscriptionLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(ALLOWED_TIERS),
  validateRequest(getBillingHistoryQuerySchema, 'query'),
  subscriptionController.getBillingHistory
);

// Subscription management routes
router.get('/overview',
  subscriptionLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(ALLOWED_TIERS),
  subscriptionController.getSubscriptionOverview
);

router.post('/upgrade',
  subscriptionLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(ALLOWED_TIERS),
  validateRequest(subscriptionUpgradeSchema),
  subscriptionController.requestSubscriptionUpgrade
);

router.get('/upgrades',
  subscriptionLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member', 'admin', 'super_admin']),
  validateRequest(getUpgradeRequestsQuerySchema, 'query'),
  subscriptionController.getUpgradeRequests
);

router.post('/cancel',
  subscriptionLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(ALLOWED_TIERS),
  validateRequest(subscriptionCancellationSchema),
  subscriptionController.cancelSubscription
);

router.get('/stats',
  adminLimiter,
  authenticateUser,
  authorizeRoles(['admin', 'super_admin']),
  validateRequest(getSubscriptionStatsQuerySchema, 'query'),
  subscriptionController.getSubscriptionStatistics
);

// Renewal & reminder routes
router.post('/reminders/send',
  adminLimiter,
  authenticateUser,
  authorizeRoles(['admin', 'super_admin']),
  subscriptionController.sendRenewalReminders
);

router.get('/reminders',
  subscriptionLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(ALLOWED_TIERS),
  subscriptionController.getRenewalReminders
);

router.put('/auto-renewal',
  subscriptionLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(ALLOWED_TIERS),
  validateRequest(updateAutoRenewalSchema),
  subscriptionController.updateAutoRenewal
);

// ============================================
// ROUTES WITH ONE PARAMETER
// ============================================

// Get tier features (public)
router.get('/features/:tier', (req, res) => {
  const { tier } = req.params;
  
  const validTiers = ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro'];
  
  if (!validTiers.includes(tier)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid subscription tier',
      code: 400
    });
  }
  
  const User = require('../auth/model').User;
  const limits = User.getSubscriptionLimits(tier);
  
  res.status(200).json({
    success: true,
    message: `Features for ${tier} tier retrieved`,
    data: {
      tier,
      features: limits.features,
      limits: {
        maxActiveDeals: limits.maxActiveDeals,
        maxInvoicesPerMonth: limits.maxInvoicesPerMonth,
        maxUsers: limits.maxUsers,
        maxCreators: limits.maxCreators
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Payment specific routes
router.get('/payments/:paymentId',
  subscriptionLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member', 'admin', 'super_admin']),
  validateRequest(paymentIdParamSchema, 'params'),
  subscriptionController.getPaymentDetails
);

router.post('/payments/:paymentId/screenshot',
  paymentVerificationLimiter,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  validateRequest(paymentIdParamSchema, 'params'),
  upload.single('screenshot'),
  validatePaymentScreenshot,
  subscriptionController.uploadPaymentScreenshot
);

router.put('/payments/:paymentId/verify',
  adminLimiter,
  authenticateUser,
  authorizeRoles(['admin', 'super_admin']),
  validateRequest(paymentIdParamSchema, 'params'),
  validateRequest(manualPaymentVerificationSchema),
  subscriptionController.verifyPaymentManually
);

// Upgrade specific routes
router.put('/upgrades/:upgradeId/process',
  adminLimiter,
  authenticateUser,
  authorizeRoles(['admin', 'super_admin']),
  validateRequest(upgradeIdParamSchema, 'params'),
  subscriptionController.processUpgradeRequest
);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// Handle multer file upload errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum allowed size is 10MB.',
        code: 400
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only 1 file allowed.',
        code: 400
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'File upload error: ' + error.message,
      code: 400
    });
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image files (JPEG, PNG) are allowed.',
      code: 400
    });
  }
  
  next(error);
});

module.exports = router;