/**
 * CreatorsMantra Backend - Enhanced Rate Limiter
 * API rate limiting middleware with subscription tier support
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const rateLimit = require('express-rate-limit');
const { logError } = require('./utils');

/**
 * Create rate limiter with custom options
 * @param {Object} options - Rate limiter options
 */
const createRateLimiter = (options = {}) => {
  const defaults = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  };

  return rateLimit({ ...defaults, ...options });
};

/**
 * Rate limiting based on subscription tier
 * @param {string} operation - Operation type (brief_creation, ai_processing, general_api)
 * @returns {Function} Express middleware function
 */
const rateLimitByTier = (operation) => {
  return async (req, res, next) => {
    try {
      const tier = req.user?.subscriptionTier || 'starter';
      
      const limits = {
        brief_creation: {
          starter: { windowMs: 60 * 60 * 1000, max: 5 }, // 5 per hour
          pro: { windowMs: 60 * 60 * 1000, max: 15 }, // 15 per hour
          elite: { windowMs: 60 * 60 * 1000, max: 50 }, // 50 per hour
          agency_starter: { windowMs: 60 * 60 * 1000, max: 100 },
          agency_pro: { windowMs: 60 * 60 * 1000, max: 200 }
        },
        ai_processing: {
          starter: { windowMs: 60 * 60 * 1000, max: 0 }, // No AI for starter
          pro: { windowMs: 60 * 60 * 1000, max: 10 },
          elite: { windowMs: 60 * 60 * 1000, max: 25 },
          agency_starter: { windowMs: 60 * 60 * 1000, max: 50 },
          agency_pro: { windowMs: 60 * 60 * 1000, max: 100 }
        },
        file_upload: {
          starter: { windowMs: 60 * 60 * 1000, max: 10 }, // 10 per hour
          pro: { windowMs: 60 * 60 * 1000, max: 30 }, // 30 per hour
          elite: { windowMs: 60 * 60 * 1000, max: 100 }, // 100 per hour
          agency_starter: { windowMs: 60 * 60 * 1000, max: 200 },
          agency_pro: { windowMs: 60 * 60 * 1000, max: 500 }
        },
        general_api: {
          starter: { windowMs: 15 * 60 * 1000, max: 50 },
          pro: { windowMs: 15 * 60 * 1000, max: 100 },
          elite: { windowMs: 15 * 60 * 1000, max: 200 },
          agency_starter: { windowMs: 15 * 60 * 1000, max: 300 },
          agency_pro: { windowMs: 15 * 60 * 1000, max: 500 }
        },
        search_api: {
          starter: { windowMs: 15 * 60 * 1000, max: 20 },
          pro: { windowMs: 15 * 60 * 1000, max: 50 },
          elite: { windowMs: 15 * 60 * 1000, max: 100 },
          agency_starter: { windowMs: 15 * 60 * 1000, max: 150 },
          agency_pro: { windowMs: 15 * 60 * 1000, max: 300 }
        }
      };

      const config = limits[operation]?.[tier] || limits.general_api[tier];
      
      // Check if operation is not allowed for this tier
      if (config.max === 0) {
        return res.status(403).json({
          success: false,
          message: `${operation.replace('_', ' ')} not available in ${tier} plan. Please upgrade your subscription.`,
          code: 403,
          upgrade_required: true,
          current_tier: tier,
          timestamp: new Date().toISOString()
        });
      }

      // Create dynamic rate limiter for this operation and tier
      const limiter = rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        message: {
          success: false,
          message: `Rate limit exceeded for ${tier} plan. You can make ${config.max} ${operation.replace('_', ' ')} requests per ${config.windowMs / 60000} minutes. Try again later.`,
          code: 429,
          rate_limit: {
            operation,
            tier,
            max_requests: config.max,
            window_minutes: config.windowMs / 60000,
            reset_time: new Date(Date.now() + config.windowMs).toISOString()
          },
          timestamp: new Date().toISOString()
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
          // Create unique key for user and operation
          const userId = req.user?.userId || req.ip;
          return `${userId}-${operation}`;
        },
        // Add custom headers for client-side handling
        onLimitReached: (req, res) => {
          res.set({
            'X-RateLimit-Operation': operation,
            'X-RateLimit-Tier': tier,
            'X-RateLimit-Upgrade-Available': 'true'
          });
        }
      });

      // Apply the rate limiter
      limiter(req, res, next);
      
    } catch (error) {
      logError('Rate limiting error', { 
        error: error.message, 
        operation,
        userId: req.user?.userId,
        tier: req.user?.subscriptionTier 
      });
      
      // Continue without rate limiting if there's an error
      next();
    }
  };
};

/**
 * Simple rate limiter for authentication endpoints
 * @param {number} maxAttempts - Maximum attempts
 * @param {number} windowMs - Window in milliseconds
 * @returns {Function} Express middleware function
 */
const authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  return createRateLimiter({
    windowMs,
    max: maxAttempts,
    message: {
      success: false,
      message: 'Too many authentication attempts. Please try again later.',
      code: 429,
      timestamp: new Date().toISOString()
    },
    keyGenerator: (req) => {
      // Use email or IP for authentication rate limiting
      return req.body?.email || req.ip;
    }
  });
};

/**
 * Rate limiter for password reset attempts
 * @returns {Function} Express middleware function
 */
const passwordResetRateLimit = () => {
  return createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: {
      success: false,
      message: 'Too many password reset attempts. Please wait an hour before trying again.',
      code: 429,
      timestamp: new Date().toISOString()
    },
    keyGenerator: (req) => {
      return req.body?.email || req.ip;
    }
  });
};

/**
 * Rate limiter for file uploads
 * @returns {Function} Express middleware function
 */
const fileUploadRateLimit = () => {
  return rateLimitByTier('file_upload');
};

/**
 * Get rate limit configuration for a tier and operation
 * @param {string} tier - Subscription tier
 * @param {string} operation - Operation type
 * @returns {Object} Rate limit configuration
 */
const getRateLimitConfig = (tier, operation) => {
  const limits = {
    brief_creation: {
      starter: { max: 5, windowMinutes: 60 },
      pro: { max: 15, windowMinutes: 60 },
      elite: { max: 50, windowMinutes: 60 },
      agency_starter: { max: 100, windowMinutes: 60 },
      agency_pro: { max: 200, windowMinutes: 60 }
    },
    ai_processing: {
      starter: { max: 0, windowMinutes: 60 },
      pro: { max: 10, windowMinutes: 60 },
      elite: { max: 25, windowMinutes: 60 },
      agency_starter: { max: 50, windowMinutes: 60 },
      agency_pro: { max: 100, windowMinutes: 60 }
    },
    file_upload: {
      starter: { max: 10, windowMinutes: 60 },
      pro: { max: 30, windowMinutes: 60 },
      elite: { max: 100, windowMinutes: 60 },
      agency_starter: { max: 200, windowMinutes: 60 },
      agency_pro: { max: 500, windowMinutes: 60 }
    }
  };

  return limits[operation]?.[tier] || { max: 0, windowMinutes: 60 };
};

/**
 * Export as both a function and a shorthand
 */
module.exports = {
  rateLimit: createRateLimiter,
  createRateLimiter,
  rateLimitByTier,
  authRateLimit,
  passwordResetRateLimit,
  fileUploadRateLimit,
  getRateLimitConfig
};