/**
 * CreatorsMantra Backend - Authentication Routes
 * Complete API endpoints for authentication, registration, and user management
 *
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const express = require('express')
const rateLimit = require('express-rate-limit')
const Joi = require('joi')
const authService = require('./service')
const { User, CreatorProfile } = require('./model')
const { authenticateUser, validateRequest } = require('../../shared/middleware')
const { asyncHandler, successResponse, errorResponse, log } = require('../../shared/utils')

const router = express.Router()

// ============================================
// RATE LIMITING CONFIGURATIONS
// ============================================

// OTP rate limiting - max 3 requests per 15 minutes per IP
const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again after 15 minutes.',
    code: 'OTP_RATE_LIMIT',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Login rate limiting - max 10 requests per 15 minutes per IP
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    code: 'LOGIN_RATE_LIMIT',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Registration rate limiting - max 5 requests per hour per IP
const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again after 1 hour.',
    code: 'REGISTRATION_RATE_LIMIT',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ============================================
// VALIDATION SCHEMAS
// ============================================

const phoneSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid Indian mobile number',
      'any.required': 'Phone number is required',
    }),
})

const otpRequestSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid Indian mobile number',
      'any.required': 'Phone number is required',
    }),
  purpose: Joi.string().valid('registration', 'login', 'password_reset').default('registration'),
})

const otpVerificationSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
  otpCode: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.length': 'OTP must be 6 digits',
      'string.pattern.base': 'OTP must contain only numbers',
    }),
  purpose: Joi.string().valid('registration', 'login', 'password_reset').default('registration'),
})

const registrationSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Full name must be at least 2 characters',
    'string.max': 'Full name cannot exceed 100 characters',
  }),
  email: Joi.string().email().lowercase().required().messages({
    'string.email': 'Please provide a valid email address',
  }),
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    }),
  userType: Joi.string().valid('creator', 'creator_with_manager').default('creator'),
  creatorType: Joi.string()
    .valid(
      'lifestyle',
      'fashion',
      'beauty',
      'tech',
      'food',
      'travel',
      'fitness',
      'comedy',
      'education',
      'business',
      'other'
    )
    .default('lifestyle'),
  socialProfiles: Joi.object({
    instagram: Joi.object({
      username: Joi.string().trim().lowercase().allow(''),
      followersCount: Joi.number().min(0).default(0),
      avgLikes: Joi.number().min(0).default(0),
      avgComments: Joi.number().min(0).default(0),
    }).optional(),
    youtube: Joi.object({
      channelName: Joi.string().trim().allow(''),
      subscribersCount: Joi.number().min(0).default(0),
      avgViews: Joi.number().min(0).default(0),
    }).optional(),
  }).optional(),
})

const loginSchema = Joi.object({
  identifier: Joi.string().required().messages({
    'any.required': 'Email or phone number is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
})

const otpLoginSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
  otpCode: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required(),
})

const passwordResetSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
  otpCode: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    }),
})

const profileUpdateSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).optional(),
  dateOfBirth: Joi.date().max('now').optional(),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
  address: Joi.object({
    street: Joi.string().trim().max(200).allow('').optional(),
    city: Joi.string().trim().max(50).allow('').optional(),
    state: Joi.string().trim().max(50).allow('').optional(),
    pincode: Joi.string()
      .pattern(/^[1-9][0-9]{5}$/)
      .allow('')
      .optional(),
    country: Joi.string().trim().default('India').optional(),
  }).optional(),
  preferences: Joi.object({
    notifications: Joi.object({
      email: Joi.boolean().optional(),
      sms: Joi.boolean().optional(),
      push: Joi.boolean().optional(),
    }).optional(),
    language: Joi.string().valid('en', 'hi').optional(),
    timezone: Joi.string().default('Asia/Kolkata').optional(),
  }).optional(),
  creatorProfile: Joi.object({
    bio: Joi.string().max(500).allow('').optional(),
    experienceLevel: Joi.string()
      .valid('beginner', '1-2_years', '2-5_years', '5+_years')
      .optional(),
    contentCategories: Joi.array()
      .items(
        Joi.string().valid(
          'lifestyle',
          'fashion',
          'beauty',
          'tech',
          'food',
          'travel',
          'fitness',
          'comedy',
          'education',
          'business'
        )
      )
      .optional(),
    languages: Joi.array()
      .items(
        Joi.string().valid(
          'english',
          'hindi',
          'bengali',
          'telugu',
          'marathi',
          'tamil',
          'gujarati',
          'kannada',
          'malayalam',
          'punjabi'
        )
      )
      .optional(),
    socialProfiles: Joi.object({
      instagram: Joi.object({
        username: Joi.string().trim().lowercase().allow('').optional(),
        followersCount: Joi.number().min(0).optional(),
        avgLikes: Joi.number().min(0).optional(),
        avgComments: Joi.number().min(0).optional(),
      }).optional(),
      youtube: Joi.object({
        channelName: Joi.string().trim().allow('').optional(),
        subscribersCount: Joi.number().min(0).optional(),
        avgViews: Joi.number().min(0).optional(),
      }).optional(),
    }).optional(),
    bankDetails: Joi.object({
      accountHolderName: Joi.string().trim().max(100).allow('').optional(),
      accountNumber: Joi.string()
        .pattern(/^\d{9,18}$/)
        .allow('')
        .optional(),
      ifscCode: Joi.string()
        .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
        .uppercase()
        .allow('')
        .optional(),
      bankName: Joi.string().trim().max(100).allow('').optional(),
    }).optional(),
    upiDetails: Joi.object({
      primaryUpi: Joi.string()
        .pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/)
        .allow('')
        .optional(),
      secondaryUpi: Joi.string()
        .pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/)
        .allow('')
        .optional(),
    }).optional(),
    gstDetails: Joi.object({
      hasGst: Joi.boolean().optional(),
      gstNumber: Joi.string()
        .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
        .uppercase()
        .allow('')
        .optional(),
      businessName: Joi.string().trim().max(200).allow('').optional(),
      businessType: Joi.string()
        .valid('individual', 'proprietorship', 'partnership', 'llp', 'pvt_ltd', 'public_ltd')
        .optional(),
    }).optional(),
    panDetails: Joi.object({
      panNumber: Joi.string()
        .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
        .uppercase()
        .allow('')
        .optional(),
      panName: Joi.string().uppercase().trim().max(100).allow('').optional(),
    }).optional(),
  }).optional(),
})

const managerInvitationSchema = Joi.object({
  managerName: Joi.string().trim().min(2).max(100).required(),
  managerEmail: Joi.string().email().lowercase().required(),
  managerPhone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
  relationship: Joi.string()
    .valid('professional_manager', 'friend', 'family', 'agency_employee')
    .default('professional_manager'),
  revenueShare: Joi.number().min(0).max(50).default(0),
  permissions: Joi.object({
    profile: Joi.object({
      editBasicInfo: Joi.boolean().optional(),
      editSocialMedia: Joi.boolean().optional(),
    }).optional(),
    deals: Joi.object({
      createDeals: Joi.boolean().optional(),
      editDeals: Joi.boolean().optional(),
      negotiateRates: Joi.boolean().optional(),
    }).optional(),
    invoices: Joi.object({
      createInvoices: Joi.boolean().optional(),
      sendInvoices: Joi.boolean().optional(),
    }).optional(),
  }).optional(),
})

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
  }),
})

// ============================================
// AUTHENTICATION ROUTES
// ============================================

/**
 * @route   POST /api/v1/auth/check-phone
 * @desc    Check if phone number exists in database
 * @access  Public
 */
router.post(
  '/check-phone',
  validateRequest(phoneSchema),
  asyncHandler(async (req, res) => {
    const { phone } = req.body

    const result = await authService.checkPhoneExists(phone)

    res.status(200).json(successResponse('Phone check completed', result))
  })
)

/**
 * @route   POST /api/v1/auth/send-otp
 * @desc    Generate and send OTP to phone number
 * @access  Public
 */
router.post(
  '/send-otp',
  otpRateLimit,
  validateRequest(otpRequestSchema),
  asyncHandler(async (req, res) => {
    const { phone, purpose } = req.body

    const result = await authService.generateOTP(phone, purpose)

    res.status(200).json(successResponse('OTP sent successfully', result))
  })
)

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify OTP code
 * @access  Public
 */
router.post(
  '/verify-otp',
  validateRequest(otpVerificationSchema),
  asyncHandler(async (req, res) => {
    const { phone, otpCode, purpose } = req.body

    const result = await authService.verifyOTP(phone, otpCode, purpose)

    res.status(200).json(successResponse('OTP verified successfully', result))
  })
)

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new creator account
 * @access  Public
 */
router.post(
  '/register',
  registrationRateLimit,
  validateRequest(registrationSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.registerCreator(req.body)

    res.status(201).json(successResponse('Registration successful', result, 201))
  })
)

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login with email/phone and password
 * @access  Public
 */
router.post(
  '/login',
  loginRateLimit,
  validateRequest(loginSchema),
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body

    const result = await authService.loginWithPassword(identifier, password)

    res.status(200).json(successResponse('Login successful', result))
  })
)

/**
 * @route   POST /api/v1/auth/login-otp
 * @desc    Login with phone number and OTP
 * @access  Public
 */
router.post(
  '/login-otp',
  loginRateLimit,
  validateRequest(otpLoginSchema),
  asyncHandler(async (req, res) => {
    const { phone, otpCode } = req.body

    const result = await authService.loginWithOTP(phone, otpCode)

    res.status(200).json(successResponse('Login successful', result))
  })
)

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with OTP verification
 * @access  Public
 */
router.post(
  '/reset-password',
  otpRateLimit,
  validateRequest(passwordResetSchema),
  asyncHandler(async (req, res) => {
    const { phone, otpCode, newPassword } = req.body

    const result = await authService.resetPassword(phone, otpCode, newPassword)

    res.status(200).json(successResponse('Password reset successful', result))
  })
)

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh JWT tokens
 * @access  Public
 */
router.post(
  '/refresh',
  validateRequest(refreshTokenSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body

    const result = await authService.refreshTokens(refreshToken)

    res.status(200).json(successResponse('Tokens refreshed successfully', result))
  })
)

// ============================================
// PROTECTED ROUTES (REQUIRE AUTHENTICATION)
// ============================================

/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/profile',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userProfile = await authService.getUserProfile(req.user.id)

    res.status(200).json(successResponse('Profile retrieved successfully', { user: userProfile }))
  })
)

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticateUser,
  validateRequest(profileUpdateSchema),
  asyncHandler(async (req, res) => {
    const updatedProfile = await authService.updateUserProfile(req.user.id, req.body)

    res.status(200).json(successResponse('Profile updated successfully', { user: updatedProfile }))
  })
)

/**
 * @route   POST /api/v1/auth/invite-manager
 * @desc    Invite manager to creator account
 * @access  Private (Creator only)
 */
router.post(
  '/invite-manager',
  authenticateUser,
  validateRequest(managerInvitationSchema),
  asyncHandler(async (req, res) => {
    // Check if user is a creator
    if (req.user.role !== 'creator') {
      return res.status(403).json(errorResponse('Only creators can invite managers', null, 403))
    }

    const result = await authService.inviteManager(req.user.id, req.body)

    res.status(200).json(successResponse('Manager invitation sent successfully', result))
  })
)

/**
 * @route   POST /api/v1/auth/accept-manager-invitation
 * @desc    Accept manager invitation and create manager account
 * @access  Public
 */
router.post(
  '/accept-manager-invitation',
  validateRequest(
    Joi.object({
      invitationToken: Joi.string().optional(), // For future implementation
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      fullName: Joi.string().trim().min(2).max(100).required(),
      phone: Joi.string()
        .pattern(/^[6-9]\d{9}$/)
        .required(),
    })
  ),
  asyncHandler(async (req, res) => {
    const result = await authService.acceptManagerInvitation(req.body.invitationToken, req.body)

    res.status(201).json(successResponse('Manager invitation accepted successfully', result, 201))
  })
)

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const deviceId = req.body.deviceId || null

    const result = await authService.logout(req.user.id, deviceId)

    res.status(200).json(successResponse('Logged out successfully', result))
  })
)

/**
 * @route   DELETE /api/v1/auth/account
 * @desc    Delete user account (soft delete)
 * @access  Private
 */
router.delete(
  '/account',
  authenticateUser,
  asyncHandler(async (req, res) => {
    // Soft delete - mark account as inactive
    await User.findByIdAndUpdate(req.user.id, {
      accountStatus: 'inactive',
      deletedAt: new Date(),
    })

    log('info', 'User account deleted', { userId: req.user.id })

    res.status(200).json(
      successResponse('Account deleted successfully', {
        message: 'Your account has been deactivated. Contact support to reactivate.',
      })
    )
  })
)

// ============================================
// UTILITY ROUTES
// ============================================

/**
 * @route   GET /api/v1/auth/subscription-tiers
 * @desc    Get available subscription tiers and pricing
 * @access  Public
 */
router.get(
  '/subscription-tiers',
  asyncHandler(async (req, res) => {
    const config = require('../../shared/config')
    const subscriptionTiers = config.subscriptions.tiers

    res.status(200).json(
      successResponse('Subscription tiers retrieved successfully', {
        tiers: subscriptionTiers,
      })
    )
  })
)

/**
 * @route   GET /api/v1/auth/feature-access
 * @desc    Check user's feature access based on subscription
 * @access  Private
 */
router.get(
  '/feature-access',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
    const limits = User.getSubscriptionLimits(user.subscriptionTier)

    const featureAccess = {
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,
      hasActiveSubscription: user.hasActiveSubscription(),
      limits,
      features: {
        basicCrm: user.hasFeatureAccess('basic_crm'),
        aiPricing: user.hasFeatureAccess('ai_pricing'),
        aiBriefAnalyzer: user.hasFeatureAccess('ai_brief_analyzer'),
        aiContractReview: user.hasFeatureAccess('ai_contract_review'),
        advancedAnalytics: user.hasFeatureAccess('advanced_analytics'),
        multiCreatorDashboard: user.hasFeatureAccess('multi_creator_dashboard'),
        apiAccess: user.hasFeatureAccess('api_access'),
      },
    }

    res.status(200).json(successResponse('Feature access retrieved successfully', featureAccess))
  })
)

/**
 * @route   GET /api/v1/auth/suggested-rates
 * @desc    Get AI-suggested rates based on social media data
 * @access  Private
 */
router.get(
  '/suggested-rates',
  authenticateUser,
  asyncHandler(async (req, res) => {
    const creatorProfile = await CreatorProfile.findOne({ userId: req.user.id })

    if (!creatorProfile) {
      return res.status(404).json(errorResponse('Creator profile not found', null, 404))
    }

    const suggestedRates = creatorProfile.getSuggestedRates()

    res.status(200).json(
      successResponse('Suggested rates calculated successfully', {
        currentRates: creatorProfile.rateCard,
        suggestedRates,
        socialStats: {
          instagram: {
            followersCount: creatorProfile.socialProfiles.instagram.followersCount,
            engagementRate: creatorProfile.calculateEngagementRate('instagram'),
          },
          youtube: {
            subscribersCount: creatorProfile.socialProfiles.youtube.subscribersCount,
          },
        },
      })
    )
  })
)

// ============================================
// DEVELOPMENT/DEBUG ROUTES (DEV ONLY)
// ============================================

if (process.env.NODE_ENV === 'development') {
  /**
   * @route   POST /api/v1/auth/dev/generate-test-otp
   * @desc    Generate test OTP for development (bypasses SMS)
   * @access  Development only
   */
  router.post(
    '/dev/generate-test-otp',
    asyncHandler(async (req, res) => {
      const { phone } = req.body
      const testOtp = '123456' // Fixed OTP for development

      res.status(200).json(
        successResponse('Development OTP generated', {
          phone,
          otp: testOtp,
          message: 'Use this OTP for testing in development environment',
        })
      )
    })
  )

  /**
   * @route   GET /api/v1/auth/dev/user-stats
   * @desc    Get user statistics for development
   * @access  Development only
   */
  router.get(
    '/dev/user-stats',
    asyncHandler(async (req, res) => {
      const totalUsers = await User.countDocuments()
      const activeUsers = await User.countDocuments({ accountStatus: 'active' })
      const creatorProfiles = await CreatorProfile.countDocuments()
      const trialUsers = await User.countDocuments({ subscriptionStatus: 'trial' })
      const paidUsers = await User.countDocuments({ subscriptionStatus: 'active' })

      res.status(200).json(
        successResponse('User statistics', {
          totalUsers,
          activeUsers,
          creatorProfiles,
          trialUsers,
          paidUsers,
          conversionRate: totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 100) : 0,
        })
      )
    })
  )
}

// ============================================
// ERROR HANDLING FOR UNDEFINED ROUTES
// ============================================

router.use('*', (req, res) => {
  res.status(404).json(errorResponse(`Auth route ${req.originalUrl} not found`, null, 404))
})

module.exports = router
