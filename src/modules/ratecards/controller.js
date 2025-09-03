/**
 * CreatorsMantra Backend - Rate Card Controller (Complete Production Version)
 * Full implementation with all production-grade features
 * 
 * @author CreatorsMantra Team
 * @version 2.1.1 - Fixed Pricing Logic
 */

const { RateCard, RateCardHistory } = require('./model');
const { User, CreatorProfile } = require('../auth/model');
const { Deal } = require('../deals/model');
const { successResponse, errorResponse } = require('../../shared/responses');
const { logInfo, logError, logWarning, asyncHandler } = require('../../shared/utils');
const { AppError } = require('../../shared/errors');
const Joi = require('joi');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const crypto = require('crypto');
const DOMPurify = require('isomorphic-dompurify');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ============================================
// ERROR CODES STANDARDIZATION
// ============================================

const ERROR_CODES = {
  // Validation Errors (4000-4099)
  VALIDATION_FAILED: { code: 'RC4000', message: 'Validation failed' },
  INVALID_METRICS: { code: 'RC4001', message: 'Invalid platform metrics' },
  INVALID_PRICING: { code: 'RC4002', message: 'Invalid pricing structure' },
  INVALID_PACKAGE: { code: 'RC4003', message: 'Invalid package configuration' },
  INVALID_PUBLIC_ID: { code: 'RC4004', message: 'Invalid public ID format' },
  
  // Authorization Errors (4100-4199)
  SUBSCRIPTION_REQUIRED: { code: 'RC4100', message: 'Pro or Elite subscription required' },
  RATE_CARD_LIMIT: { code: 'RC4101', message: 'Rate card limit reached for your plan' },
  NO_PERMISSION: { code: 'RC4102', message: 'You do not have permission to access this rate card' },
  MANAGER_PERMISSION: { code: 'RC4103', message: 'Manager permissions required' },
  
  // Not Found Errors (4200-4299)
  RATE_CARD_NOT_FOUND: { code: 'RC4200', message: 'Rate card not found' },
  PACKAGE_NOT_FOUND: { code: 'RC4201', message: 'Package not found' },
  HISTORY_NOT_FOUND: { code: 'RC4202', message: 'History record not found' },
  
  // Business Logic Errors (4300-4399)
  INCOMPLETE_RATE_CARD: { code: 'RC4300', message: 'Rate card must have at least one deliverable' },
  ALREADY_PUBLISHED: { code: 'RC4301', message: 'Rate card is already published' },
  EXPIRED_RATE_CARD: { code: 'RC4302', message: 'Rate card has expired' },
  PASSWORD_REQUIRED: { code: 'RC4303', message: 'Password required to access this rate card' },
  DUPLICATE_PACKAGE: { code: 'RC4304', message: 'Package with this name already exists' },
  
  // External Service Errors (5000-5099)
  AI_SERVICE_ERROR: { code: 'RC5000', message: 'AI pricing service unavailable' },
  PDF_GENERATION_ERROR: { code: 'RC5001', message: 'PDF generation failed' },
  QR_CODE_ERROR: { code: 'RC5002', message: 'QR code generation failed' },
  
  // Server Errors (5100-5199)
  DATABASE_ERROR: { code: 'RC5100', message: 'Database operation failed' },
  TRANSACTION_FAILED: { code: 'RC5101', message: 'Transaction failed, changes rolled back' },
  CACHE_ERROR: { code: 'RC5102', message: 'Cache operation failed' }
};

// ============================================
// CACHE CONFIGURATION
// ============================================

const cacheConfig = {
  stdTTL: 600, // 10 minutes default
  checkperiod: 120, // Check for expired keys every 2 minutes
  errorOnMissing: false,
  useClones: false
};

const cache = new NodeCache(cacheConfig);

// Cache keys generator
const CACHE_KEYS = {
  RATE_CARD: (id) => `rate_card:${id}`,
  USER_RATE_CARDS: (userId) => `user_rate_cards:${userId}`,
  PUBLIC_RATE_CARD: (publicId) => `public_rate_card:${publicId}`,
  AI_SUGGESTIONS: (metrics) => `ai_suggestions:${crypto.createHash('md5').update(JSON.stringify(metrics)).digest('hex')}`,
  MARKET_BENCHMARKS: (niche, tier) => `benchmarks:${niche}:${tier}`
};

// ============================================
// RATE LIMITING CONFIGURATIONS
// ============================================

const rateLimiters = {
  // General API rate limit
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  }),
  
  // AI suggestions rate limit
  aiSuggestions: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 AI calls per hour
    message: 'AI suggestion limit reached, please try again later',
    keyGenerator: (req) => req.user?.id || req.ip
  }),
  
  // PDF generation rate limit
  pdfGeneration: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 PDFs per 15 minutes
    message: 'PDF generation limit reached, please wait',
    keyGenerator: (req) => req.user?.id || req.ip
  }),
  
  // Public access rate limit
  publicAccess: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: 'Too many requests to public rate cards',
    keyGenerator: (req) => req.ip
  })
};

class RateCardController {
  
  // ============================================
  // VALIDATION SCHEMAS
  // ============================================
  
  validationSchemas = {
    // Create rate card validation
    createRateCard: Joi.object({
      title: Joi.string().trim().max(100).default('My Rate Card'),
      description: Joi.string().trim().max(500).allow(''),
      
      metrics: Joi.object({
        platforms: Joi.array().items(
          Joi.object({
            name: Joi.string().valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook').required(),
            metrics: Joi.object({
              // Convert string to number, handle empty strings
              followers: Joi.alternatives()
                .try(
                  Joi.number().min(0).max(1000000000),
                  Joi.string().pattern(/^\d+$/).custom((value) => {
                    const num = parseInt(value, 10);
                    if (num > 1000000000) throw new Error('Followers cannot exceed 1,000,000,000');
                    return num;
                  })
                )
                .required(),
                
              engagementRate: Joi.alternatives()
                .try(
                  Joi.number().min(0).max(100),
                  Joi.string().pattern(/^\d*\.?\d+$/).custom((value) => {
                    const num = parseFloat(value);
                    if (num > 100) throw new Error('Engagement rate cannot exceed 100%');
                    return num;
                  })
                )
                .required(),
                
              // Handle empty strings for optional fields
              avgViews: Joi.alternatives()
                .try(
                  Joi.number().min(0),
                  Joi.string().allow('').custom((value) => {
                    if (value === '' || value === null || value === undefined) return null;
                    const num = parseInt(value, 10);
                    return isNaN(num) ? null : num;
                  })
                )
                .optional()
                .default(null),
                
              avgLikes: Joi.alternatives()
                .try(
                  Joi.number().min(0),
                  Joi.string().allow('').custom((value) => {
                    if (value === '' || value === null || value === undefined) return null;
                    const num = parseInt(value, 10);
                    return isNaN(num) ? null : num;
                  })
                )
                .optional()
                .default(null)
            }).required()
          })
        ).min(1).required(),
        
        niche: Joi.string().valid(
          'fashion', 'beauty', 'tech', 'finance', 'food', 'travel',
          'lifestyle', 'fitness', 'gaming', 'education', 'entertainment',
          'business', 'health', 'parenting', 'sports', 'music', 'art', 'other'
        ).required(),
        
        location: Joi.object({
          city: Joi.string().trim().max(50).required(),
          cityTier: Joi.string().valid('metro', 'tier1', 'tier2', 'tier3').required(),
          state: Joi.string().trim().max(50).optional().allow('')
        }).required(),
        
        languages: Joi.array().items(
          Joi.string().valid(
            'english', 'hindi', 'tamil', 'telugu', 'bengali', 'marathi',
            'gujarati', 'kannada', 'malayalam', 'punjabi', 'other'
          )
        ).optional(),
        
        experience: Joi.string().valid('beginner', '1-2_years', '2-5_years', '5+_years').optional()
      }).required()
    }),
    
    // Update metrics validation
    updateMetrics: Joi.object({
      platforms: Joi.array().items(
        Joi.object({
          name: Joi.string().valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook').required(),
          metrics: Joi.object({
            followers: Joi.number().min(0).max(1000000000).required(),
            engagementRate: Joi.number().min(0).max(100).required(),
            avgViews: Joi.number().min(0).optional(),
            avgLikes: Joi.number().min(0).optional()
          }).required()
        })
      ).min(1)
    }),
    
    // Update pricing validation
    updatePricing: Joi.object({
      deliverables: Joi.array().items(
        Joi.object({
          platform: Joi.string().valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook').required(),
          rates: Joi.array().items(
            Joi.object({
              type: Joi.string().required(),
              description: Joi.string().max(200).optional(),
              pricing: Joi.object({
                userRate: Joi.number().min(0).max(10000000).required()
              }).required(),
              turnaroundTime: Joi.object({
                value: Joi.number().min(1).optional(),
                unit: Joi.string().valid('hours', 'days', 'weeks').optional()
              }).optional(),
              revisionsIncluded: Joi.number().min(0).max(10).optional()
            })
          ).required()
        })
      ).required()
    }),
    
    // Create package validation
    createPackage: Joi.object({
      name: Joi.string().trim().max(100).required(),
      description: Joi.string().max(500).allow(''),
      items: Joi.array().items(
        Joi.object({
          platform: Joi.string().valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook').required(),
          deliverableType: Joi.string().required(),
          quantity: Joi.number().min(1).max(100).required()
        })
      ).min(1).required(),
      packagePrice: Joi.number().min(0).required(),
      validity: Joi.object({
        value: Joi.number().min(1).optional(),
        unit: Joi.string().valid('days', 'weeks', 'months').optional()
      }).optional(),
      isPopular: Joi.boolean().optional()
    }),
    
    // Update package validation
    updatePackage: Joi.object({
      name: Joi.string().trim().max(100).optional(),
      description: Joi.string().max(500).allow('').optional(),
      packagePrice: Joi.number().min(0).optional(),
      validity: Joi.object({
        value: Joi.number().min(1).optional(),
        unit: Joi.string().valid('days', 'weeks', 'months').optional()
      }).optional(),
      isPopular: Joi.boolean().optional()
    }),
    
    // Professional details validation - FIXED SCHEMA
    updateProfessionalDetails: Joi.object({
      paymentTerms: Joi.object({
        type: Joi.string().valid('100_advance', '50_50', '30_70', 'on_delivery', 'net_15', 'net_30', 'custom').optional(),
        customTerms: Joi.when('type', {
          is: 'custom',
          then: Joi.string().max(500).required(),
          otherwise: Joi.string().max(500).empty('').optional() // FIXED: Use .empty('') instead of .allow('')
        })
      }).optional(),
      usageRights: Joi.object({
        duration: Joi.string().valid('1_month', '3_months', '6_months', '1_year', 'perpetual', 'custom').optional(),
        platforms: Joi.array().items(
          Joi.string().valid('owned_media', 'paid_media', 'all_digital', 'print', 'broadcast', 'all')
        ).optional(),
        geography: Joi.string().valid('india', 'asia', 'global', 'custom').optional(),
        exclusivity: Joi.object({
          required: Joi.boolean().optional(),
          duration: Joi.object({
            value: Joi.number().min(1).optional(),
            unit: Joi.string().valid('days', 'weeks', 'months').optional()
          }).optional()
        }).optional()
      }).optional(),
      revisionPolicy: Joi.string().max(500).empty('').optional(), // FIXED: Use .empty('')
      cancellationTerms: Joi.string().max(500).empty('').optional(), // FIXED: Use .empty('')
      additionalNotes: Joi.string().max(1000).empty('').optional() // FIXED: Use .empty('') and corrected max length
    }),
    
    // Share settings validation
    updateShareSettings: Joi.object({
      allowDownload: Joi.boolean().optional(),
      showContactForm: Joi.boolean().optional(),
      requirePassword: Joi.boolean().optional(),
      password: Joi.string().min(4).max(20).optional(),
      expiryDays: Joi.number().min(1).max(365).optional()
    })
  };

  // ============================================
  // INPUT SANITIZATION
  // ============================================
  
  /**
   * Fixed sanitize input to preserve data types
   */
  sanitizeInput = (input) => {
    if (typeof input === 'string') {
      // Remove HTML tags and scripts
      return DOMPurify.sanitize(input, { 
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true 
      }).trim();
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    // Preserve numbers, booleans, null, undefined as-is
    return input;
  };

  /**
   * Enhanced sanitizeAndValidate method with detailed logging
   */
  sanitizeAndValidate = (schema, data) => {
    try {
      // Log input data
      logInfo('Validation input', { data: JSON.stringify(data, null, 2) });
      
      // First sanitize
      const sanitized = this.sanitizeInput(data);
      logInfo('Sanitized data', { sanitized: JSON.stringify(sanitized, null, 2) });
      
      // Then validate
      const { error, value } = schema.validate(sanitized, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });
      
      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type,
          value: detail.context?.value
        }));
        
        // Log detailed validation errors
        logError('Validation errors', { errors, originalData: data });
        
        // Create AppError with explicit property setting
        const appError = new AppError(
          ERROR_CODES.VALIDATION_FAILED.message,
          400,
          ERROR_CODES.VALIDATION_FAILED.code,
          { errors }
        );
        
        // Ensure properties are set (defensive programming)
        appError.statusCode = 400;
        appError.code = ERROR_CODES.VALIDATION_FAILED.code;
        appError.name = 'AppError';
        
        logError('AppError details', {
          message: appError.message,
          statusCode: appError.statusCode,
          code: appError.code,
          data: appError.data,
          hasCode: !!appError.code,
          name: appError.name
        });
        
        throw appError;
      }
      
      return value;
    } catch (error) {
      // Log any unexpected errors during validation
      logError('Validation method error', {
        error: error.message,
        stack: error.stack,
        hasCode: !!error.code,
        code: error.code
      });
      throw error;
    }
  };

  // ============================================
  // TRANSACTION HANDLING
  // ============================================
  
  /**
   * Execute with transaction
   */
  withTransaction = async (callback) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      logError('Transaction failed', { error: error.message });
      
      throw new AppError(
        ERROR_CODES.TRANSACTION_FAILED.message,
        500,
        ERROR_CODES.TRANSACTION_FAILED.code,
        { originalError: error.message }
      );
    } finally {
      session.endSession();
    }
  };

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Check subscription access
   */
  checkSubscriptionAccess = async (user) => {
    const allowedPlans = ['pro', 'elite', 'agency_starter', 'agency_pro'];
    const userPlan = user.subscription?.plan || user.subscriptionTier;
    
    if (!allowedPlans.includes(userPlan)) {
      throw new AppError(
        ERROR_CODES.SUBSCRIPTION_REQUIRED.message,
        403,
        ERROR_CODES.SUBSCRIPTION_REQUIRED.code
      );
    }
    
    // Check rate card limits
    const limits = {
      pro: 3,
      elite: -1, // Unlimited
      agency_starter: 10,
      agency_pro: -1
    };
    
    const limit = limits[userPlan];
    if (limit !== -1) {
      const count = await RateCard.countDocuments({
        creatorId: user._id,
        isDeleted: false,
        'version.status': { $ne: 'archived' }
      });
      
      if (count >= limit) {
        throw new AppError(
          ERROR_CODES.RATE_CARD_LIMIT.message,
          403,
          ERROR_CODES.RATE_CARD_LIMIT.code,
          { limit, current: count }
        );
      }
    }
  };

  /**
   * Check rate card ownership
   */
  checkOwnership = async (rateCardId, userId, allowManager = false) => {
    const rateCard = await RateCard.findOne({
      _id: rateCardId,
      isDeleted: false
    });
    
    if (!rateCard) {
      throw new AppError(
        ERROR_CODES.RATE_CARD_NOT_FOUND.message,
        404,
        ERROR_CODES.RATE_CARD_NOT_FOUND.code
      );
    }
    
    // Check if user is creator or their manager
    const isOwner = rateCard.creatorId.toString() === userId.toString();
    const isManager = allowManager && rateCard.managedBy?.toString() === userId.toString();
    
    if (!isOwner && !isManager) {
      // Check if user is a manager of this creator
      const creatorProfile = await CreatorProfile.findOne({
        userId: rateCard.creatorId,
        'managers.managerId': userId,
        'managers.status': 'active'
      });
      
      if (!creatorProfile) {
        throw new AppError(
          ERROR_CODES.NO_PERMISSION.message,
          403,
          ERROR_CODES.NO_PERMISSION.code
        );
      }
    }
    
    return rateCard;
  };

  // ============================================
  // AI INTEGRATION - FIXED PRICING LOGIC
  // ============================================

  /**
   * Generate AI pricing suggestions
   */
  generateAIPricing = async (metrics) => {
    try {
      if (!OPENAI_API_KEY) {
        logWarning('OpenAI API key not configured, using fallback pricing');
        return this.generateFallbackPricing(metrics);
      }

      const prompt = this.buildAIPrompt(metrics);
      
      const response = await axios.post(
        OPENAI_API_URL,
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert in Indian influencer marketing pricing with deep knowledge of current market rates. Return ONLY valid JSON without markdown formatting or code blocks. Do not wrap your response in ```json or ``` tags. Your response must be pure JSON that can be directly parsed. Focus on realistic pricing that matches actual Indian influencer market standards.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1500
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      // Enhanced JSON parsing with markdown cleanup
      try {
        let aiResponseText = response.data.choices[0].message.content;
        
        // Strip markdown code blocks if present
        aiResponseText = aiResponseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .replace(/^```/g, '')
          .replace(/```$/g, '')
          .trim();
        
        const aiResponse = JSON.parse(aiResponseText);
        return this.processAIResponse(aiResponse, metrics);
        
      } catch (parseError) {
        logError('Failed to parse AI response', { 
          error: parseError.message,
          rawResponse: response.data.choices[0].message.content.substring(0, 500)
        });
        return this.generateFallbackPricing(metrics);
      }
      
    } catch (error) {
      logError('AI pricing generation failed', { 
        error: error.message,
        code: error.code,
        timeout: error.code === 'ECONNABORTED',
        status: error.response?.status
      });
      
      return this.generateFallbackPricing(metrics);
    }
  };

  /**
   * Build AI prompt for pricing - IMPROVED SCALE-AWARE VERSION
   */
  buildAIPrompt = (metrics) => {
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isFestiveSeason = this.checkFestiveSeason();
    
    // Calculate total reach and determine creator tier
    const totalReach = metrics.platforms.reduce((sum, p) => sum + p.metrics.followers, 0);
    const maxFollowers = Math.max(...metrics.platforms.map(p => p.metrics.followers));
    
    let creatorTier = 'micro';
    let expectedRanges = {};
    
    if (maxFollowers >= 1000000) {
      creatorTier = 'mega';
      expectedRanges = {
        instagram: { reel: [150000, 350000], post: [75000, 175000], story: [25000, 60000] },
        youtube: { video: [300000, 600000], short: [150000, 300000] }
      };
    } else if (maxFollowers >= 100000) {
      creatorTier = 'macro';
      expectedRanges = {
        instagram: { reel: [50000, 150000], post: [25000, 75000], story: [8000, 25000] },
        youtube: { video: [100000, 300000], short: [50000, 150000] }
      };
    } else {
      creatorTier = 'micro';
      expectedRanges = {
        instagram: { reel: [5000, 25000], post: [3000, 15000], story: [1000, 5000] },
        youtube: { video: [15000, 50000], short: [8000, 25000] }
      };
    }
    
    return `Generate rate card pricing for Indian ${creatorTier}-influencer:

CREATOR PROFILE:
Total Reach: ${totalReach.toLocaleString()} followers
Tier: ${creatorTier.toUpperCase()}-INFLUENCER

Platform Details:
${metrics.platforms.map(p => 
  `- ${p.name}: ${p.metrics.followers.toLocaleString()} followers, ${p.metrics.engagementRate}% engagement`
).join('\n')}

Market Context:
- Niche: ${metrics.niche} (${['tech', 'finance', 'fashion', 'beauty'].includes(metrics.niche) ? 'Premium niche +20-30%' : 'Standard niche'})
- Location: ${metrics.location.city} (${metrics.location.cityTier}) ${metrics.location.cityTier === 'metro' ? '- Metro premium +30-50%' : ''}
- Experience: ${metrics.experience?.replace('_', ' ') || 'Not specified'}
- Languages: ${metrics.languages?.join(', ') || 'Not specified'}
- Current Period: ${currentMonth}
${isFestiveSeason ? '- FESTIVE SEASON: Add 15-25% premium to all rates' : ''}

CRITICAL - EXPECTED PRICING FOR ${creatorTier.toUpperCase()}-INFLUENCER:
${Object.entries(expectedRanges).map(([platform, rates]) => 
  `${platform.toUpperCase()}: ${Object.entries(rates).map(([type, range]) => 
    `${type} ₹${range[0].toLocaleString()}-${range[1].toLocaleString()}`
  ).join(', ')}`
).join('\n')}

Your pricing MUST fall within these realistic ranges for Indian market. 

Return JSON with this exact structure:
{
  "platforms": {
    "instagram": {
      "reel": { "suggested": 175000, "min": 150000, "max": 200000, "reasoning": "Based on 1.75M followers, fashion niche, metro location" },
      "post": { "suggested": 125000, "min": 100000, "max": 150000, "reasoning": "Premium post pricing for mega-influencer" },
      "story": { "suggested": 40000, "min": 35000, "max": 45000, "reasoning": "Story pricing per piece for mega scale" }
    }
  },
  "packages": [
    {
      "name": "Starter Package",
      "description": "Perfect for first collaboration",
      "items": [
        { "platform": "instagram", "deliverableType": "reel", "quantity": 1 },
        { "platform": "instagram", "deliverableType": "story", "quantity": 3 }
      ],
      "suggestedPrice": 285000,
      "reasoning": "10% package discount on individual rates"
    }
  ],
  "marketInsights": {
    "position": "at_market",
    "competitors": 150,
    "averageRate": 150000,
    "confidence": 90,
    "seasonalAdjustment": ${isFestiveSeason}
  }
}`;
  };

  /**
   * Check if current period is festive season
   */
  checkFestiveSeason = () => {
    const month = new Date().getMonth();
    // October (9), November (10), December (11), January (0), March (2) are typically festive in India
    return [9, 10, 11, 0, 2].includes(month);
  };

  /**
   * Process AI response - ENHANCED VERSION
   */
  processAIResponse = (aiResponse, metrics) => {
    // Validate and sanitize AI response
    const processed = {
      platforms: {},
      packages: [],
      marketInsights: aiResponse.marketInsights || {}
    };
    
    // Process platform pricing with better error handling
    Object.keys(aiResponse.platforms || {}).forEach(platform => {
      if (metrics.platforms.find(p => p.name === platform)) {
        processed.platforms[platform] = {};
        
        Object.entries(aiResponse.platforms[platform]).forEach(([type, pricing]) => {
          if (pricing && typeof pricing === 'object') {
            processed.platforms[platform][type] = {
              suggested: Math.max(0, Math.min(10000000, pricing.suggested || 0)),
              min: Math.max(0, pricing.min || 0),
              max: Math.min(10000000, pricing.max || pricing.suggested || 0),
              reasoning: pricing.reasoning || 'AI generated based on market analysis'
            };
          }
        });
      }
    });
    
    // Process packages with corrected field mapping
    if (Array.isArray(aiResponse.packages)) {
      processed.packages = aiResponse.packages.slice(0, 3).map(pkg => {
        const processedPackage = {
          name: pkg.name || 'Unnamed Package',
          description: pkg.description || '',
          items: [],
          suggestedPrice: Math.max(0, Math.min(10000000, pkg.suggestedPrice || 0)),
          reasoning: pkg.reasoning || 'AI generated package'
        };
        
        // Process package items with proper field mapping
        if (Array.isArray(pkg.items)) {
          processedPackage.items = pkg.items.map(item => ({
            platform: item.platform,
            deliverableType: item.deliverableType || item.type, // Handle both field names
            quantity: Math.max(1, Math.min(100, item.quantity || 1))
          }));
        }
        
        return processedPackage;
      });
    }
    
    return processed;
  };

  /**
   * Fallback pricing when AI is unavailable - FIXED REALISTIC RATES
   */
  generateFallbackPricing = (metrics) => {
    const pricing = { platforms: {}, packages: [], marketInsights: {} };
    
    // REALISTIC base rates per 1000 followers (in INR) - MAJOR FIX
    const baseRates = {
      instagram: { 
        reel: 80,        // Was 500 - realistic: 80-120 per 1K followers
        post: 50,        // Was 300 - realistic: 40-80 per 1K
        story: 15,       // Was 100 - realistic: 10-25 per 1K
        carousel: 60,    // Was 400 - realistic: 50-90 per 1K
        igtv: 90,        // Was 600 - realistic: 80-130 per 1K
        live: 100        // Was 800 - realistic: 90-150 per 1K
      },
      youtube: { 
        video: 200,      // Was 1000 - realistic: 150-300 per 1K
        short: 60,       // Was 300 - realistic: 50-100 per 1K
        community_post: 20, // Was 100 - realistic: 15-35 per 1K
        live_stream: 250    // Was 1500 - realistic: 200-400 per 1K
      },
      linkedin: { 
        post: 40,        // Was 200 - realistic: 30-60 per 1K
        article: 80,     // Was 500 - realistic: 60-120 per 1K
        video: 100,      // Was 800 - realistic: 80-150 per 1K
        newsletter: 120  // Was 600 - realistic: 100-180 per 1K
      },
      twitter: { 
        post: 25,        // Was 100 - realistic: 20-40 per 1K
        thread: 45,      // Was 200 - realistic: 35-70 per 1K
        space: 80        // Was 500 - realistic: 60-120 per 1K
      },
      facebook: { 
        post: 30,        // Was 150 - realistic: 25-50 per 1K
        reel: 70,        // Was 400 - realistic: 60-100 per 1K
        story: 20,       // Was 80 - realistic: 15-35 per 1K
        live: 90         // Was 600 - realistic: 80-140 per 1K
      }
    };
    
    // Niche multipliers
    const nicheMultipliers = {
      tech: 1.5, finance: 1.5, business: 1.4,
      fashion: 1.3, beauty: 1.3, lifestyle: 1.2,
      fitness: 1.2, food: 1.1, travel: 1.1,
      health: 1.1, education: 1.0, entertainment: 0.9,
      gaming: 1.1, sports: 1.0, music: 0.9, art: 1.0,
      parenting: 1.1, other: 1.0
    };
    
    // City tier multipliers
    const cityMultipliers = {
      metro: 1.4,    // Increased from 1.3 for metro premium
      tier1: 1.1, 
      tier2: 0.9, 
      tier3: 0.7
    };
    
    // Experience multipliers
    const experienceMultipliers = {
      'beginner': 0.8,
      '1-2_years': 1.0,
      '2-5_years': 1.2,
      '5+_years': 1.5
    };
    
    // Calculate pricing for each platform
    metrics.platforms.forEach(platform => {
      const followers = platform.metrics.followers;
      const engagement = platform.metrics.engagementRate;
      const engagementMultiplier = engagement > 5 ? 1.3 : engagement > 3 ? 1.15 : 1.0;
      const expMultiplier = experienceMultipliers[metrics.experience] || 1.0;
      
      pricing.platforms[platform.name] = {};
      
      Object.entries(baseRates[platform.name] || {}).forEach(([type, baseRate]) => {
        let calculated = Math.round(
          (followers / 1000) * 
          baseRate * 
          nicheMultipliers[metrics.niche] * 
          cityMultipliers[metrics.location.cityTier] * 
          engagementMultiplier *
          expMultiplier
        );
        
        // CRITICAL FIX: Add scale validation to ensure realistic pricing
        if (followers > 1000000) {
          // Mega-influencer minimum floors
          const megaFloors = {
            instagram: { reel: 100000, post: 50000, story: 20000, carousel: 75000, igtv: 120000 },
            youtube: { video: 250000, short: 120000, community_post: 25000 },
            linkedin: { post: 40000, article: 80000, video: 100000 },
            twitter: { post: 30000, thread: 50000 },
            facebook: { post: 35000, reel: 80000, story: 25000 }
          };
          
          const platformFloors = megaFloors[platform.name] || {};
          const minFloor = platformFloors[type] || calculated;
          calculated = Math.max(calculated, minFloor);
          
          logInfo('Applied mega-influencer pricing floor', { 
            platform: platform.name, 
            type, 
            followers, 
            originalCalculated: Math.round((followers / 1000) * baseRate * nicheMultipliers[metrics.niche] * cityMultipliers[metrics.location.cityTier] * engagementMultiplier * expMultiplier),
            floorApplied: minFloor,
            finalPrice: calculated 
          });
          
        } else if (followers > 100000) {
          // Macro-influencer minimum floors
          const macroFloors = {
            instagram: { reel: 25000, post: 15000, story: 5000 },
            youtube: { video: 75000, short: 35000 }
          };
          
          const platformFloors = macroFloors[platform.name] || {};
          const minFloor = platformFloors[type] || calculated;
          calculated = Math.max(calculated, minFloor);
        }
        
        pricing.platforms[platform.name][type] = {
          suggested: calculated,
          min: Math.round(calculated * 0.8),
          max: Math.round(calculated * 1.2),
          reasoning: `Calculated based on ${followers.toLocaleString()} followers, ${engagement}% engagement, and market standards for ${metrics.location.cityTier} city`
        };
      });
    });
    
    // Generate realistic packages
    if (pricing.platforms.instagram) {
      const reelPrice = pricing.platforms.instagram.reel?.suggested || 0;
      const postPrice = pricing.platforms.instagram.post?.suggested || 0;
      const storyPrice = pricing.platforms.instagram.story?.suggested || 0;
      
      pricing.packages = [
        {
          name: 'Starter Package',
          description: 'Perfect for first-time collaboration',
          items: [
            { platform: 'instagram', deliverableType: 'reel', quantity: 1 },
            { platform: 'instagram', deliverableType: 'story', quantity: 3 }
          ],
          suggestedPrice: Math.round((reelPrice + (storyPrice * 3)) * 0.9),
          reasoning: '10% package discount on individual rates'
        },
        {
          name: 'Growth Package',
          description: 'Comprehensive brand visibility',
          items: [
            { platform: 'instagram', deliverableType: 'reel', quantity: 2 },
            { platform: 'instagram', deliverableType: 'post', quantity: 1 },
            { platform: 'instagram', deliverableType: 'story', quantity: 5 }
          ],
          suggestedPrice: Math.round(((reelPrice * 2) + postPrice + (storyPrice * 5)) * 0.85),
          reasoning: '15% package discount for larger commitment'
        }
      ];
    }
    
    pricing.marketInsights = {
      position: 'at_market',
      confidence: 70,
      averageRate: Math.round(
        Object.values(pricing.platforms)
          .flatMap(p => Object.values(p))
          .reduce((sum, rate) => sum + rate.suggested, 0) / 
        Object.values(pricing.platforms)
          .flatMap(p => Object.values(p)).length
      )
    };
    
    return pricing;
  };

  // ============================================
  // PDF GENERATION
  // ============================================
  
  /**
   * Build PDF content
   */
  buildPDFContent = async (doc, rateCard) => {
    const primaryColor = '#8B5CF6';
    const secondaryColor = '#6B7280';
    const accentColor = '#10B981';
    
    // Header Section
    doc.fillColor(primaryColor)
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('RATE CARD', { align: 'center' });
    
    doc.moveDown(0.5);
    
    // Creator Info
    doc.fillColor('#1F2937')
       .fontSize(20)
       .text(rateCard.creatorId.fullName, { align: 'center' });
    
    doc.fontSize(12)
       .fillColor(secondaryColor)
       .text(rateCard.title || 'Professional Rate Card', { align: 'center' });
    
    if (rateCard.description) {
      doc.fontSize(10)
         .text(rateCard.description, { align: 'center' });
    }
    
    // Add line separator
    doc.moveDown()
       .moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .strokeColor(primaryColor)
       .lineWidth(2)
       .stroke();
    
    doc.moveDown();
    
    // Metrics Section
    doc.fillColor('#1F2937')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('CREATOR METRICS');
    
    doc.moveDown(0.5)
       .fontSize(11)
       .font('Helvetica');
    
    // Platform metrics
    rateCard.metrics.platforms.forEach(platform => {
      doc.fillColor(primaryColor)
         .text(`${platform.name.toUpperCase()}`, { continued: true })
         .fillColor('#1F2937')
         .text(`: ${platform.metrics.followers.toLocaleString()} followers | ${platform.metrics.engagementRate}% engagement`);
    });
    
    doc.moveDown()
       .fillColor(secondaryColor)
       .text(`Niche: ${rateCard.metrics.niche}`)
       .text(`Location: ${rateCard.metrics.location.city} (${rateCard.metrics.location.cityTier})`)
       .text(`Languages: ${rateCard.metrics.languages?.join(', ') || 'Not specified'}`)
       .text(`Experience: ${rateCard.metrics.experience?.replace('_', ' ') || 'Not specified'}`);
    
    doc.moveDown(1.5);
    
    // Pricing Section
    doc.fillColor('#1F2937')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('DELIVERABLE PRICING');
    
    doc.moveDown(0.5)
       .fontSize(11)
       .font('Helvetica');
    
    // Create pricing table
    let yPosition = doc.y;
    
    rateCard.pricing.deliverables.forEach(platform => {
      if (yPosition > 650) {
        doc.addPage();
        yPosition = 50;
      }
      
      doc.fillColor(primaryColor)
         .fontSize(13)
         .font('Helvetica-Bold')
         .text(platform.platform.toUpperCase(), 50, yPosition);
      
      yPosition += 25;
      
      platform.rates.forEach(rate => {
        doc.fillColor('#1F2937')
           .fontSize(11)
           .font('Helvetica')
           .text(`• ${rate.type.replace('_', ' ')}`, 70, yPosition)
           .text(`₹${rate.pricing.userRate.toLocaleString('en-IN')}`, 400, yPosition, { width: 95, align: 'right' });
        
        if (rate.turnaroundTime) {
          doc.fontSize(9)
             .fillColor(secondaryColor)
             .text(`  ${rate.turnaroundTime.value} ${rate.turnaroundTime.unit}`, 70, yPosition + 12);
        }
        
        yPosition += rate.turnaroundTime ? 28 : 20;
      });
      
      yPosition += 10;
    });
    
    doc.y = yPosition;
    doc.moveDown();
    
    // Packages Section
    if (rateCard.packages && rateCard.packages.length > 0) {
      if (doc.y > 600) {
        doc.addPage();
      }
      
      doc.fillColor('#1F2937')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('PACKAGE DEALS');
      
      doc.moveDown(0.5)
         .fontSize(11)
         .font('Helvetica');
      
      rateCard.packages.forEach(pkg => {
        if (doc.y > 650) {
          doc.addPage();
        }
        
        doc.fillColor(primaryColor)
           .fontSize(13)
           .font('Helvetica-Bold')
           .text(pkg.name);
        
        if (pkg.description) {
          doc.fillColor(secondaryColor)
             .fontSize(10)
             .font('Helvetica')
             .text(pkg.description);
        }
        
        // Package items
        doc.fontSize(10)
           .fillColor('#1F2937');
        
        pkg.items.forEach(item => {
          doc.text(`  • ${item.quantity}x ${item.platform} ${item.deliverableType}`, { indent: 20 });
        });
        
        doc.fontSize(12)
           .text(`Package Price: ₹${pkg.pricing.packagePrice.toLocaleString('en-IN')}`, { continued: true });
        
        if (pkg.pricing.savings.percentage > 0) {
          doc.fillColor(accentColor)
             .text(` (Save ${pkg.pricing.savings.percentage}%)`);
        } else {
          doc.text('');
        }
        
        doc.moveDown(0.5);
      });
    }
    
    // Terms Section
    if (doc.y > 600) {
      doc.addPage();
    }
    
    doc.moveDown()
       .fillColor('#1F2937')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('TERMS & CONDITIONS');
    
    doc.moveDown(0.5)
       .fontSize(10)
       .font('Helvetica')
       .fillColor(secondaryColor);
    
    const terms = rateCard.professionalDetails || {};
    
    doc.text(`• Payment Terms: ${this.formatPaymentTerms(terms.paymentTerms?.type)}`)
       .text(`• Usage Rights: ${terms.usageRights?.duration || 'As per agreement'}`)
       .text(`• Geography: ${terms.usageRights?.geography || 'India'}`)
       .text(`• Revisions: As specified per deliverable`)
       .text(`• Cancellation: ${terms.cancellationTerms || 'As per agreement'}`);
    
    if (terms.additionalNotes) {
      doc.moveDown()
         .text('Additional Notes:', { underline: true })
         .text(terms.additionalNotes);
    }
    
    // Footer
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 100;
    
    doc.fontSize(8)
       .fillColor('#9CA3AF')
       .text('Generated by CreatorsMantra', 50, footerY, { align: 'center', width: 495 })
       .text(`Document ID: ${rateCard.sharing.publicId || rateCard._id}`, 50, footerY + 12, { align: 'center', width: 495 })
       .text(new Date().toLocaleDateString('en-IN', { 
         year: 'numeric', 
         month: 'long', 
         day: 'numeric' 
       }), 50, footerY + 24, { align: 'center', width: 495 });
    
    // Add QR code if available
    if (rateCard.sharing.qrCodeUrl) {
      try {
        const qrBuffer = Buffer.from(rateCard.sharing.qrCodeUrl.split(',')[1], 'base64');
        doc.image(qrBuffer, 480, footerY - 50, { width: 50, height: 50 });
      } catch (err) {
        logWarning('QR code embedding failed', { error: err.message });
      }
    }
  };

  /**
   * Format payment terms for display
   */
  formatPaymentTerms = (terms) => {
    const termMap = {
      '100_advance': '100% Advance',
      '50_50': '50% Advance, 50% Post-delivery',
      '30_70': '30% Advance, 70% Post-delivery',
      'on_delivery': '100% Post-delivery',
      'net_15': 'Net 15 days',
      'net_30': 'Net 30 days',
      'custom': 'Custom Terms'
    };
    
    return termMap[terms] || 'Standard Terms';
  };

  // ============================================
  // MAIN CONTROLLER METHODS
  // ============================================

  /**
   * Create new rate card
   * POST /api/ratecards
   */
  createRateCard = asyncHandler(async (req, res) => {
    try {
      logInfo('Create rate card request', { userId: req.user.id });
      
      // Check subscription access
      await this.checkSubscriptionAccess(req.user);
      
      // Sanitize and validate
      const validatedData = this.sanitizeAndValidate(
        this.validationSchemas.createRateCard,
        req.body
      );
      
      // Check AI suggestions cache
      const cacheKey = CACHE_KEYS.AI_SUGGESTIONS(validatedData.metrics);
      let aiPricing = cache.get(cacheKey);
      
      if (!aiPricing) {
        aiPricing = await this.generateAIPricing(validatedData.metrics);
        cache.set(cacheKey, aiPricing, 3600); // Cache for 1 hour
      }
      
      // Create with transaction
      const rateCard = await this.withTransaction(async (session) => {
        const newRateCard = new RateCard({
          creatorId: req.user.id,
          lastEditedBy: req.user.id,
          subscriptionTier: req.user.subscription?.plan || req.user.subscriptionTier,
          title: validatedData.title,
          description: validatedData.description,
          metrics: validatedData.metrics,
          pricing: {
            deliverables: this.buildInitialPricing(validatedData.metrics, aiPricing),
            currency: 'INR'
          },
          packages: this.buildInitialPackages(aiPricing),
          aiMetadata: {
            lastSuggestionDate: new Date(),
            suggestionVersion: '2.0',
            confidence: aiPricing.marketInsights?.confidence || 70,
            marketData: aiPricing.marketInsights
          },
          version: {
            current: 1,
            status: 'draft'
          }
        });
        
        await newRateCard.save({ session });
        
        // Create initial history entry
        await RateCardHistory.create([{
          rateCardId: newRateCard._id,
          version: 1,
          editedBy: req.user.id,
          changeType: 'creation',
          changeSummary: 'Initial rate card creation',
          snapshot: {
            metrics: newRateCard.metrics,
            pricing: newRateCard.pricing,
            packages: newRateCard.packages,
            professionalDetails: newRateCard.professionalDetails
          }
        }], { session });
        
        return newRateCard;
      });
      
      // Clear user's rate cards cache
      cache.del(CACHE_KEYS.USER_RATE_CARDS(req.user.id));
      
      logInfo('Rate card created successfully', {
        rateCardId: rateCard._id,
        hasAISuggestions: true
      });
      
      res.status(201).json(
        successResponse('Rate card created successfully', {
          rateCard,
          aiSuggestions: aiPricing
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
      
      const { status = 'all', page = 1, limit = 10 } = req.query;
      const cacheKey = `${CACHE_KEYS.USER_RATE_CARDS(req.user.id)}:${status}`;
      
      // Check cache
      let cachedData = cache.get(cacheKey);
      
      if (!cachedData) {
        // Build query
        const query = {
          $or: [
            { creatorId: req.user.id },
            { managedBy: req.user.id }
          ],
          isDeleted: false
        };
        
        if (status !== 'all') {
          query['version.status'] = status;
        }
        
        // Check if user is a manager
        const managedCreators = await CreatorProfile.find({
          'managers.managerId': req.user.id,
          'managers.status': 'active'
        }).select('userId');
        
        if (managedCreators.length > 0) {
          query.$or.push({
            creatorId: { $in: managedCreators.map(c => c.userId) }
          });
        }
        
        // Fetch rate cards
        const rateCards = await RateCard.find(query)
          .populate('creatorId', 'fullName email')
          .populate('lastEditedBy', 'fullName')
          .sort('-updatedAt')
          .select('-sharing.analytics.viewLog -sharing.settings.password')
          .lean();
        
        cachedData = rateCards;
        cache.set(cacheKey, cachedData, 300); // Cache for 5 minutes
      }
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedData = cachedData.slice(startIndex, endIndex);
      
      res.json(
        successResponse('Rate cards fetched successfully', {
          rateCards: paginatedData,
          pagination: {
            total: cachedData.length,
            page: parseInt(page),
            pages: Math.ceil(cachedData.length / limit),
            limit: parseInt(limit)
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
      
      // Check cache
      const cacheKey = CACHE_KEYS.RATE_CARD(req.params.id);
      let rateCard = cache.get(cacheKey);
      
      if (!rateCard) {
        rateCard = await this.checkOwnership(req.params.id, req.user.id, true);
        
        // Populate references
        await rateCard.populate([
          { path: 'creatorId', select: 'fullName email phone' },
          { path: 'lastEditedBy', select: 'fullName' },
          { path: 'managedBy', select: 'fullName' }
        ]);
        
        cache.set(cacheKey, rateCard.toObject(), 600); // Cache for 10 minutes
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
   * Update metrics and regenerate pricing
   * PUT /api/ratecards/:id/metrics
   */
  updateMetrics = asyncHandler(async (req, res) => {
    try {
      logInfo('Update metrics request', {
        rateCardId: req.params.id,
        userId: req.user.id
      });
      
      const rateCard = await this.checkOwnership(req.params.id, req.user.id, true);
      
      // Sanitize and validate
      const validatedData = this.sanitizeAndValidate(
        this.validationSchemas.updateMetrics,
        req.body
      );
      
      // Generate new AI pricing
      const aiPricing = await this.generateAIPricing({
        ...rateCard.metrics.toObject(),
        platforms: validatedData.platforms
      });
      
      // Use transaction for update
      await this.withTransaction(async (session) => {
        // Create history snapshot
        await RateCardHistory.create([{
          rateCardId: rateCard._id,
          version: rateCard.version.current,
          editedBy: req.user.id,
          changeType: 'metrics_update',
          changeSummary: 'Updated platform metrics and regenerated pricing',
          snapshot: {
            metrics: rateCard.metrics,
            pricing: rateCard.pricing,
            packages: rateCard.packages,
            professionalDetails: rateCard.professionalDetails
          }
        }], { session });
        
        // Update metrics
        if (validatedData.platforms) {
          validatedData.platforms.forEach(platform => {
            platform.metrics.lastUpdated = new Date();
          });
          rateCard.metrics.platforms = validatedData.platforms;
        }
        
        // Update AI metadata
        rateCard.aiMetadata = {
          lastSuggestionDate: new Date(),
          suggestionVersion: '2.0',
          confidence: aiPricing.marketInsights?.confidence || 70,
          marketData: aiPricing.marketInsights
        };
        
        rateCard.version.current += 1;
        rateCard.lastEditedBy = req.user.id;
        
        await rateCard.save({ session });
      });
      
      // Clear caches
      this.clearRateCardCaches(rateCard);
      
      logInfo('Metrics updated successfully', { rateCardId: req.params.id });
      
      res.json(
        successResponse('Metrics updated and pricing regenerated', {
          rateCard,
          newSuggestions: aiPricing
        })
      );
      
    } catch (error) {
      logError('Update metrics failed', {
        error: error.message,
        rateCardId: req.params.id
      });
      throw error;
    }
  });

  /**
   * Update pricing
   * PUT /api/ratecards/:id/pricing
   */
  updatePricing = asyncHandler(async (req, res) => {
    try {
      logInfo('Update pricing request', {
        rateCardId: req.params.id,
        userId: req.user.id
      });
      
      const rateCard = await this.checkOwnership(req.params.id, req.user.id, true);
      
      // Sanitize and validate
      const validatedData = this.sanitizeAndValidate(
        this.validationSchemas.updatePricing,
        req.body
      );
      
      await this.withTransaction(async (session) => {
        // Create history snapshot
        await RateCardHistory.create([{
          rateCardId: rateCard._id,
          version: rateCard.version.current,
          editedBy: req.user.id,
          changeType: 'pricing_change',
          changeSummary: 'Updated deliverable pricing',
          snapshot: {
            metrics: rateCard.metrics,
            pricing: rateCard.pricing,
            packages: rateCard.packages,
            professionalDetails: rateCard.professionalDetails
          }
        }], { session });
        
        // Update pricing
        rateCard.pricing.deliverables = validatedData.deliverables;
        rateCard.lastEditedBy = req.user.id;
        rateCard.version.current += 1;
        
        // Calculate AI acceptance rate
        if (rateCard.aiMetadata.marketData) {
          const acceptanceRate = this.calculateAcceptanceRate(
            rateCard.pricing.deliverables,
            rateCard.aiMetadata.marketData
          );
          rateCard.aiMetadata.acceptanceRate = acceptanceRate;
        }
        
        await rateCard.save({ session });
      });
      
      // Clear caches
      this.clearRateCardCaches(rateCard);
      
      logInfo('Pricing updated successfully', { rateCardId: req.params.id });
      
      res.json(
        successResponse('Pricing updated successfully', { rateCard })
      );
      
    } catch (error) {
      logError('Update pricing failed', {
        error: error.message,
        rateCardId: req.params.id
      });
      throw error;
    }
  });

  /**
   * Create package
   * POST /api/ratecards/:id/packages
   */
  createPackage = asyncHandler(async (req, res) => {
    try {
      logInfo('Create package request', {
        rateCardId: req.params.id,
        userId: req.user.id
      });
      
      const rateCard = await this.checkOwnership(req.params.id, req.user.id, true);
      
      // Sanitize and validate
      const validatedData = this.sanitizeAndValidate(
        this.validationSchemas.createPackage,
        req.body
      );
      
      // Check for duplicate package name
      if (rateCard.packages.some(pkg => pkg.name === validatedData.name)) {
        throw new AppError(
          ERROR_CODES.DUPLICATE_PACKAGE.message,
          400,
          ERROR_CODES.DUPLICATE_PACKAGE.code
        );
      }
      
      // Calculate individual total
      let individualTotal = 0;
      validatedData.items.forEach(item => {
        const platform = rateCard.pricing.deliverables.find(d => d.platform === item.platform);
        if (platform) {
          const rate = platform.rates.find(r => r.type === item.deliverableType);
          if (rate) {
            individualTotal += rate.pricing.userRate * item.quantity;
          }
        }
      });
      
      // Create package
      const newPackage = {
        ...validatedData,
        isAISuggested: false,
        pricing: {
          individualTotal,
          packagePrice: validatedData.packagePrice,
          savings: {
            amount: individualTotal - validatedData.packagePrice,
            percentage: individualTotal > 0 
              ? Math.round(((individualTotal - validatedData.packagePrice) / individualTotal) * 100)
              : 0
          }
        },
        validity: validatedData.validity || { value: 30, unit: 'days' }
      };
      
      await this.withTransaction(async (session) => {
        // Create history snapshot
        await RateCardHistory.create([{
          rateCardId: rateCard._id,
          version: rateCard.version.current,
          editedBy: req.user.id,
          changeType: 'package_update',
          changeSummary: `Added package: ${validatedData.name}`,
          snapshot: {
            metrics: rateCard.metrics,
            pricing: rateCard.pricing,
            packages: rateCard.packages,
            professionalDetails: rateCard.professionalDetails
          }
        }], { session });
        
        rateCard.packages.push(newPackage);
        rateCard.lastEditedBy = req.user.id;
        rateCard.version.current += 1;
        
        await rateCard.save({ session });
      });
      
      // Clear caches
      this.clearRateCardCaches(rateCard);
      
      logInfo('Package created successfully', {
        rateCardId: req.params.id,
        packageName: validatedData.name
      });
      
      res.status(201).json(
        successResponse('Package created successfully', {
          rateCard,
          package: newPackage
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
      
      const rateCard = await this.checkOwnership(req.params.id, req.user.id, true);
      
      // Find package
      const packageIndex = rateCard.packages.findIndex(
        p => p._id.toString() === req.params.packageId
      );
      
      if (packageIndex === -1) {
        throw new AppError(
          ERROR_CODES.PACKAGE_NOT_FOUND.message,
          404,
          ERROR_CODES.PACKAGE_NOT_FOUND.code
        );
      }
      
      // Sanitize and validate
      const validatedData = this.sanitizeAndValidate(
        this.validationSchemas.updatePackage,
        req.body
      );
      
      await this.withTransaction(async (session) => {
        // Create history snapshot
        await RateCardHistory.create([{
          rateCardId: rateCard._id,
          version: rateCard.version.current,
          editedBy: req.user.id,
          changeType: 'package_update',
          changeSummary: `Updated package: ${rateCard.packages[packageIndex].name}`,
          snapshot: {
            metrics: rateCard.metrics,
            pricing: rateCard.pricing,
            packages: rateCard.packages,
            professionalDetails: rateCard.professionalDetails
          }
        }], { session });
        
        // Update package
        Object.assign(rateCard.packages[packageIndex], validatedData);
        
        // Recalculate savings if price changed
        if (validatedData.packagePrice !== undefined) {
          const pkg = rateCard.packages[packageIndex];
          pkg.pricing.packagePrice = validatedData.packagePrice;
          pkg.pricing.savings.amount = pkg.pricing.individualTotal - pkg.pricing.packagePrice;
          pkg.pricing.savings.percentage = pkg.pricing.individualTotal > 0
            ? Math.round(((pkg.pricing.individualTotal - pkg.pricing.packagePrice) / pkg.pricing.individualTotal) * 100)
            : 0;
        }
        
        rateCard.lastEditedBy = req.user.id;
        rateCard.version.current += 1;
        
        await rateCard.save({ session });
      });
      
      // Clear caches
      this.clearRateCardCaches(rateCard);
      
      logInfo('Package updated successfully', {
        rateCardId: req.params.id,
        packageId: req.params.packageId
      });
      
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
      
      const rateCard = await this.checkOwnership(req.params.id, req.user.id, true);
      
      // Find package
      const packageIndex = rateCard.packages.findIndex(
        p => p._id.toString() === req.params.packageId
      );
      
      if (packageIndex === -1) {
        throw new AppError(
          ERROR_CODES.PACKAGE_NOT_FOUND.message,
          404,
          ERROR_CODES.PACKAGE_NOT_FOUND.code
        );
      }
      
      await this.withTransaction(async (session) => {
        const packageName = rateCard.packages[packageIndex].name;
        
        // Create history snapshot
        await RateCardHistory.create([{
          rateCardId: rateCard._id,
          version: rateCard.version.current,
          editedBy: req.user.id,
          changeType: 'package_update',
          changeSummary: `Deleted package: ${packageName}`,
          snapshot: {
            metrics: rateCard.metrics,
            pricing: rateCard.pricing,
            packages: rateCard.packages,
            professionalDetails: rateCard.professionalDetails
          }
        }], { session });
        
        // Remove package
        rateCard.packages.splice(packageIndex, 1);
        rateCard.lastEditedBy = req.user.id;
        rateCard.version.current += 1;
        
        await rateCard.save({ session });
      });
      
      // Clear caches
      this.clearRateCardCaches(rateCard);
      
      logInfo('Package deleted successfully', {
        rateCardId: req.params.id,
        packageId: req.params.packageId
      });
      
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
   * Update professional details - FIXED VERSION
   * PUT /api/ratecards/:id/professional-details
   */
  updateProfessionalDetails = asyncHandler(async (req, res) => {
    try {
      logInfo('Update professional details request', {
        rateCardId: req.params.id,
        userId: req.user.id,
        body: req.body
      });
      
      const rateCard = await this.checkOwnership(req.params.id, req.user.id, true);
      
      // Sanitize and validate
      const validatedData = this.sanitizeAndValidate(
        this.validationSchemas.updateProfessionalDetails,
        req.body
      );
      
      logInfo('Validation successful', { validatedData });
      
      await this.withTransaction(async (session) => {
        // Create history snapshot
        await RateCardHistory.create([{
          rateCardId: rateCard._id,
          version: rateCard.version.current,
          editedBy: req.user.id,
          changeType: 'terms_update',
          changeSummary: 'Updated professional details and terms',
          snapshot: {
            metrics: rateCard.metrics,
            pricing: rateCard.pricing,
            packages: rateCard.packages,
            professionalDetails: rateCard.professionalDetails
          }
        }], { session });
        
        // Update professional details
        rateCard.professionalDetails = {
          ...rateCard.professionalDetails.toObject(),
          ...validatedData
        };
        rateCard.lastEditedBy = req.user.id;
        rateCard.version.current += 1;
        
        await rateCard.save({ session });
      });
      
      // Clear caches
      this.clearRateCardCaches(rateCard);
      
      logInfo('Professional details updated', { rateCardId: req.params.id });
      
      res.json(
        successResponse('Professional details updated successfully', { rateCard })
      );
      
    } catch (error) {
      logError('Update professional details failed', {
        error: error.message,
        rateCardId: req.params.id,
        errorCode: error.code,
        errorType: error.constructor.name
      });
      throw error;
    }
  });

  /**
   * Publish rate card
   * POST /api/ratecards/:id/publish
   */
  publishRateCard = asyncHandler(async (req, res) => {
    try {
      logInfo('Publish rate card request', {
        rateCardId: req.params.id,
        userId: req.user.id
      });
      
      const rateCard = await this.checkOwnership(req.params.id, req.user.id, true);
      
      // Check if rate card is complete
      if (!rateCard.pricing.deliverables.length) {
        throw new AppError(
          ERROR_CODES.INCOMPLETE_RATE_CARD.message,
          400,
          ERROR_CODES.INCOMPLETE_RATE_CARD.code
        );
      }
      
      // Check if already published
      if (rateCard.version.status === 'active' && rateCard.sharing.isPublic) {
        throw new AppError(
          ERROR_CODES.ALREADY_PUBLISHED.message,
          400,
          ERROR_CODES.ALREADY_PUBLISHED.code
        );
      }
      
      // Generate public ID if not exists
      if (!rateCard.sharing.publicId) {
        await rateCard.generatePublicId();
      }
      
      // Generate QR code
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(rateCard.sharing.publicUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#1F2937',
            light: '#FFFFFF'
          }
        });
        rateCard.sharing.qrCodeUrl = qrCodeDataUrl;
      } catch (error) {
        logError('QR code generation failed', { error: error.message });
        throw new AppError(
          ERROR_CODES.QR_CODE_ERROR.message,
          500,
          ERROR_CODES.QR_CODE_ERROR.code
        );
      }
      
      // Update status
      rateCard.version.status = 'active';
      rateCard.version.publishedAt = new Date();
      rateCard.sharing.isPublic = true;
      
      // Set expiry (6 months by default)
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 6);
      rateCard.sharing.expiresAt = expiryDate;
      
      rateCard.lastEditedBy = req.user.id;
      await rateCard.save();
      
      // Clear caches
      this.clearRateCardCaches(rateCard);
      
      logInfo('Rate card published', {
        rateCardId: req.params.id,
        publicId: rateCard.sharing.publicId
      });
      
      res.json(
        successResponse('Rate card published successfully', {
          rateCard,
          publicUrl: rateCard.sharing.publicUrl,
          publicId: rateCard.sharing.publicId,
          qrCode: rateCard.sharing.qrCodeUrl
        })
      );
      
    } catch (error) {
      logError('Publish rate card failed', {
        error: error.message,
        rateCardId: req.params.id
      });
      throw error;
    }
  });

  /**
   * Update share settings
   * PUT /api/ratecards/:id/share-settings
   */
  updateShareSettings = asyncHandler(async (req, res) => {
    try {
      logInfo('Update share settings request', {
        rateCardId: req.params.id,
        userId: req.user.id
      });
      
      const rateCard = await this.checkOwnership(req.params.id, req.user.id, true);
      
      // Sanitize and validate
      const validatedData = this.sanitizeAndValidate(
        this.validationSchemas.updateShareSettings,
        req.body
      );
      
      // Update share settings
      if (validatedData.allowDownload !== undefined) {
        rateCard.sharing.settings.allowDownload = validatedData.allowDownload;
      }
      
      if (validatedData.showContactForm !== undefined) {
        rateCard.sharing.settings.showContactForm = validatedData.showContactForm;
      }
      
      if (validatedData.requirePassword !== undefined) {
        rateCard.sharing.settings.requirePassword = validatedData.requirePassword;
      }
      
      if (validatedData.password) {
        // Hash password in production
        rateCard.sharing.settings.password = validatedData.password;
      }
      
      if (validatedData.expiryDays) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + validatedData.expiryDays);
        rateCard.sharing.expiresAt = expiryDate;
      }
      
      await rateCard.save();
      
      // Clear caches
      this.clearRateCardCaches(rateCard);
      
      logInfo('Share settings updated', { rateCardId: req.params.id });
      
      res.json(
        successResponse('Share settings updated successfully', {
          shareSettings: rateCard.sharing.settings,
          expiresAt: rateCard.sharing.expiresAt
        })
      );
      
    } catch (error) {
      logError('Update share settings failed', {
        error: error.message,
        rateCardId: req.params.id
      });
      throw error;
    }
  });

  /**
   * Get public rate card (no auth required)
   * GET /api/ratecards/public/:publicId
   */
  getPublicRateCard = asyncHandler(async (req, res) => {
    try {
      logInfo('Get public rate card request', {
        publicId: req.params.publicId
      });
      
      // Check cache
      const cacheKey = CACHE_KEYS.PUBLIC_RATE_CARD(req.params.publicId);
      let publicData = cache.get(cacheKey);
      
      if (!publicData) {
        const rateCard = await RateCard.findByPublicId(req.params.publicId);
        
        if (!rateCard) {
          throw new AppError(
            ERROR_CODES.RATE_CARD_NOT_FOUND.message,
            404,
            ERROR_CODES.RATE_CARD_NOT_FOUND.code
          );
        }
        
        // Check if expired
        if (rateCard.isExpired()) {
          throw new AppError(
            ERROR_CODES.EXPIRED_RATE_CARD.message,
            410,
            ERROR_CODES.EXPIRED_RATE_CARD.code
          );
        }
        
        // Check password if required
        if (rateCard.sharing.settings.requirePassword) {
          const providedPassword = req.headers['x-rate-card-password'];
          if (!providedPassword || providedPassword !== rateCard.sharing.settings.password) {
            throw new AppError(
              ERROR_CODES.PASSWORD_REQUIRED.message,
              401,
              ERROR_CODES.PASSWORD_REQUIRED.code
            );
          }
        }
        
        // Populate creator info
        await rateCard.populate('creatorId', 'fullName email');
        
        // Prepare public data (remove sensitive info)
        publicData = {
          title: rateCard.title,
          description: rateCard.description,
          creator: {
            name: rateCard.creatorId.fullName,
            email: rateCard.sharing.settings.showContactForm ? rateCard.creatorId.email : undefined
          },
          metrics: {
            platforms: rateCard.metrics.platforms,
            niche: rateCard.metrics.niche,
            location: rateCard.metrics.location,
            languages: rateCard.metrics.languages,
            experience: rateCard.metrics.experience
          },
          pricing: rateCard.pricing,
          packages: rateCard.packages,
          professionalDetails: rateCard.professionalDetails,
          totalReach: rateCard.totalReach,
          avgEngagementRate: rateCard.avgEngagementRate,
          sharing: {
            allowDownload: rateCard.sharing.settings.allowDownload,
            showContactForm: rateCard.sharing.settings.showContactForm
          }
        };
        
        // Cache public data
        cache.set(cacheKey, publicData, 1800); // Cache for 30 minutes
        
        // Track view asynchronously
        const ipHash = crypto
          .createHash('sha256')
          .update(req.ip || 'unknown')
          .digest('hex');
        
        rateCard.trackView({
          ipHash,
          userAgent: req.headers['user-agent'],
          referrer: req.headers.referer
        }).catch(err => logError('View tracking failed', { error: err.message }));
      }
      
      res.json(
        successResponse('Public rate card fetched successfully', publicData)
      );
      
    } catch (error) {
      logError('Get public rate card failed', {
        error: error.message,
        publicId: req.params.publicId
      });
      throw error;
    }
  });

  /**
   * Generate PDF for rate card
   * GET /api/ratecards/:id/pdf
   */
  generatePDF = asyncHandler(async (req, res) => {
    try {
      logInfo('Generate PDF request', {
        rateCardId: req.params.id,
        userId: req.user.id
      });
      
      const rateCard = await this.checkOwnership(req.params.id, req.user.id, true);
      
      // Populate creator details
      await rateCard.populate('creatorId', 'fullName email phone');
      
      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Rate Card - ${rateCard.creatorId.fullName}`,
          Author: 'CreatorsMantra',
          Subject: 'Professional Rate Card',
          Keywords: 'rate card, influencer, pricing',
          CreationDate: new Date()
        }
      });
      
      // Generate PDF content
      await this.buildPDFContent(doc, rateCard);
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rate-card-${rateCard.sharing.publicId || rateCard._id}.pdf"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      // Stream PDF to response
      doc.pipe(res);
      doc.end();
      
      logInfo('PDF generated successfully', { rateCardId: req.params.id });
      
    } catch (error) {
      logError('PDF generation failed', {
        error: error.message,
        rateCardId: req.params.id
      });
      
      throw new AppError(
        ERROR_CODES.PDF_GENERATION_ERROR.message,
        500,
        ERROR_CODES.PDF_GENERATION_ERROR.code
      );
    }
  });

  /**
   * Get rate card history
   * GET /api/ratecards/:id/history
   */
  getRateCardHistory = asyncHandler(async (req, res) => {
    try {
      logInfo('Get rate card history request', {
        rateCardId: req.params.id,
        userId: req.user.id
      });
      
      await this.checkOwnership(req.params.id, req.user.id, true);
      
      const { page = 1, limit = 20 } = req.query;
      
      const history = await RateCardHistory.find({
        rateCardId: req.params.id
      })
      .populate('editedBy', 'fullName')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
      
      const total = await RateCardHistory.countDocuments({
        rateCardId: req.params.id
      });
      
      res.json(
        successResponse('Rate card history fetched successfully', {
          history,
          pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            limit: parseInt(limit)
          }
        })
      );
      
    } catch (error) {
      logError('Get rate card history failed', {
        error: error.message,
        rateCardId: req.params.id
      });
      throw error;
    }
  });

  /**
   * Restore from history
   * POST /api/ratecards/:id/restore/:historyId
   */
  restoreFromHistory = asyncHandler(async (req, res) => {
    try {
      logInfo('Restore from history request', {
        rateCardId: req.params.id,
        historyId: req.params.historyId,
        userId: req.user.id
      });
      
      const rateCard = await this.checkOwnership(req.params.id, req.user.id, false);
      
      const historyRecord = await RateCardHistory.findOne({
        _id: req.params.historyId,
        rateCardId: req.params.id
      });
      
      if (!historyRecord) {
        throw new AppError(
          ERROR_CODES.HISTORY_NOT_FOUND.message,
          404,
          ERROR_CODES.HISTORY_NOT_FOUND.code
        );
      }
      
      await this.withTransaction(async (session) => {
        // Create snapshot of current state
        await RateCardHistory.create([{
          rateCardId: rateCard._id,
          version: rateCard.version.current,
          editedBy: req.user.id,
          changeType: 'restore',
          changeSummary: `Restored from version ${historyRecord.version}`,
          snapshot: {
            metrics: rateCard.metrics,
            pricing: rateCard.pricing,
            packages: rateCard.packages,
            professionalDetails: rateCard.professionalDetails
          }
        }], { session });
        
        // Restore from history
        rateCard.metrics = historyRecord.snapshot.metrics;
        rateCard.pricing = historyRecord.snapshot.pricing;
        rateCard.packages = historyRecord.snapshot.packages;
        rateCard.professionalDetails = historyRecord.snapshot.professionalDetails;
        rateCard.version.current += 1;
        rateCard.lastEditedBy = req.user.id;
        
        await rateCard.save({ session });
      });
      
      // Clear caches
      this.clearRateCardCaches(rateCard);
      
      logInfo('Restored from history successfully', {
        rateCardId: req.params.id,
        historyId: req.params.historyId
      });
      
      res.json(
        successResponse('Rate card restored successfully', { rateCard })
      );
      
    } catch (error) {
      logError('Restore from history failed', {
        error: error.message,
        historyId: req.params.historyId
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
      
      const rateCard = await this.checkOwnership(req.params.id, req.user.id, false);
      
      // Soft delete
      rateCard.isDeleted = true;
      rateCard.deletedAt = new Date();
      rateCard.deletedBy = req.user.id;
      rateCard.version.status = 'archived';
      rateCard.version.archivedAt = new Date();
      rateCard.sharing.isPublic = false;
      
      await rateCard.save();
      
      // Clear all caches
      this.clearRateCardCaches(rateCard);
      
      logInfo('Rate card deleted', { rateCardId: req.params.id });
      
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

  /**
   * Get analytics
   * GET /api/ratecards/:id/analytics
   */
  getAnalytics = asyncHandler(async (req, res) => {
    try {
      logInfo('Get analytics request', {
        rateCardId: req.params.id,
        userId: req.user.id
      });
      
      const rateCard = await this.checkOwnership(req.params.id, req.user.id, true);
      
      // Prepare analytics data
      const analytics = {
        views: {
          total: rateCard.sharing.analytics.totalViews,
          unique: rateCard.sharing.analytics.uniqueViews,
          lastViewed: rateCard.sharing.analytics.lastViewedAt
        },
        engagement: {
          downloads: rateCard.sharing.analytics.downloads,
          inquiries: rateCard.sharing.analytics.inquiries
        },
        performance: {
          daysSinceCreated: rateCard.daysSinceUpdate,
          versionCount: rateCard.version.current,
          packageCount: rateCard.packages.length,
          deliverableCount: rateCard.pricing.deliverables.reduce(
            (count, platform) => count + platform.rates.length, 0
          )
        },
        aiInsights: {
          acceptanceRate: rateCard.aiMetadata.acceptanceRate,
          marketPosition: rateCard.aiMetadata.marketData?.position,
          confidence: rateCard.aiMetadata.confidence
        }
      };
      
      res.json(
        successResponse('Analytics fetched successfully', { analytics })
      );
      
    } catch (error) {
      logError('Get analytics failed', {
        error: error.message,
        rateCardId: req.params.id
      });
      throw error;
    }
  });

  // ============================================
  // HELPER METHODS FOR BUILDING DATA
  // ============================================

  /**
   * Build initial pricing structure
   */
  buildInitialPricing = (metrics, aiPricing) => {
    const deliverables = [];
    
    metrics.platforms.forEach(platform => {
      const platformPricing = aiPricing.platforms[platform.name] || {};
      const rates = [];
      
      Object.entries(platformPricing).forEach(([type, pricing]) => {
        rates.push({
          type,
          pricing: {
            aiSuggested: pricing.suggested,
            userRate: pricing.suggested, // Start with AI suggestion
            marketPosition: this.getMarketPosition(pricing.suggested, pricing.min, pricing.max)
          },
          turnaroundTime: { value: 3, unit: 'days' },
          revisionsIncluded: 2
        });
      });
      
      if (rates.length > 0) {
        deliverables.push({
          platform: platform.name,
          rates
        });
      }
    });
    
    return deliverables;
  };

  /**
   * Build initial packages
   */
  buildInitialPackages = (aiPricing) => {
    if (!aiPricing.packages || !aiPricing.packages.length) {
      return [];
    }
    
    return aiPricing.packages.map(pkg => ({
      ...pkg,
      isAISuggested: true,
      pricing: {
        individualTotal: Math.round(pkg.suggestedPrice * 1.11), // Add 11% to show savings
        packagePrice: pkg.suggestedPrice,
        savings: {
          amount: Math.round(pkg.suggestedPrice * 0.1),
          percentage: 10
        }
      },
      validity: { value: 30, unit: 'days' },
      isPopular: false
    }));
  };

  /**
   * Get market position
   */
  getMarketPosition = (price, min, max) => {
    if (!min || !max || min === max) return 'at_market';
    
    const range = max - min;
    const position = (price - min) / range;
    
    if (position < 0.3) return 'below_market';
    if (position < 0.7) return 'at_market';
    if (position < 0.9) return 'above_market';
    return 'premium';
  };

  /**
   * Calculate AI acceptance rate
   */
  calculateAcceptanceRate = (deliverables, marketData) => {
    let totalRates = 0;
    let acceptedRates = 0;
    
    deliverables.forEach(platform => {
      platform.rates.forEach(rate => {
        totalRates++;
        
        // Check if user kept AI suggestion (within 10% variance)
        if (rate.pricing.aiSuggested && rate.pricing.userRate) {
          const variance = Math.abs(rate.pricing.userRate - rate.pricing.aiSuggested) / rate.pricing.aiSuggested;
          if (variance <= 0.1) {
            acceptedRates++;
          }
        }
      });
    });
    
    return totalRates > 0 ? Math.round((acceptedRates / totalRates) * 100) : 0;
  };

  /**
   * Clear rate card caches
   */
  clearRateCardCaches = (rateCard) => {
    cache.del(CACHE_KEYS.RATE_CARD(rateCard._id));
    cache.del(CACHE_KEYS.USER_RATE_CARDS(rateCard.creatorId));
    
    if (rateCard.sharing.publicId) {
      cache.del(CACHE_KEYS.PUBLIC_RATE_CARD(rateCard.sharing.publicId));
    }
    
    // Clear any status-specific caches
    ['all', 'draft', 'active', 'archived'].forEach(status => {
      cache.del(`${CACHE_KEYS.USER_RATE_CARDS(rateCard.creatorId)}:${status}`);
    });
  };
}

// Export controller with rate limiters
const controller = new RateCardController();
controller.rateLimiters = rateLimiters;

module.exports = controller;