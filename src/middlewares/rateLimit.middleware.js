/**
 * Rate Limiting Middleware
 * @module middlewares/rateLimit
 * @description Advanced rate limiting with Redis for DDoS protection and API abuse prevention
 * 
 * File Path: src/middlewares/rateLimit.middleware.js
 * 
 * Features:
 * - Multiple rate limit strategies (IP, User, API Key)
 * - Distributed rate limiting with Redis
 * - Dynamic rate limits based on user tier
 * - Endpoint-specific limits
 * - Burst protection
 * - Gradual backoff for repeat offenders
 * - Whitelist/Blacklist support
 * - Rate limit headers for client awareness
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const logger = require('../config/logger');
const redisClient = require('../config/redis');
const ResponseUtil = require('../utils/response.util');
const { USER_ROLES, ACCOUNT_TYPES, ERROR_CODES } = require('../config/constants');

/**
 * Rate Limit Configuration
 */
const RATE_LIMIT_CONFIG = {
  // Global limits
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests, please try again later',
  },
  
  // Tier-based limits (requests per 15 minutes)
  tiers: {
    anonymous: 50,
    free: 100,
    creator: 500,
    agency: 1000,
    enterprise: 5000,
    admin: 10000,
  },
  
  // Endpoint-specific limits
  endpoints: {
    // Authentication endpoints - stricter limits
    '/api/v1/auth/login': {
      windowMs: 15 * 60 * 1000,
      max: 5,
      skipSuccessfulRequests: true,
    },
    '/api/v1/auth/register': {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3,
    },
    '/api/v1/auth/forgot-password': {
      windowMs: 60 * 60 * 1000,
      max: 3,
    },
    '/api/v1/auth/verify-otp': {
      windowMs: 15 * 60 * 1000,
      max: 5,
    },
    
    // AI endpoints - expensive operations
    '/api/v1/ai/analyze-brief': {
      windowMs: 60 * 60 * 1000,
      max: 20,
    },
    '/api/v1/ai/generate-pitch': {
      windowMs: 60 * 60 * 1000,
      max: 20,
    },
    '/api/v1/ai/suggest-pricing': {
      windowMs: 60 * 60 * 1000,
      max: 30,
    },
    
    // File uploads - bandwidth intensive
    '/api/v1/upload': {
      windowMs: 15 * 60 * 1000,
      max: 20,
    },
    
    // Report generation - resource intensive
    '/api/v1/reports/generate': {
      windowMs: 60 * 60 * 1000,
      max: 10,
    },
    
    // Bulk operations
    '/api/v1/bulk': {
      windowMs: 60 * 60 * 1000,
      max: 5,
    },
  },
  
  // Burst protection
  burst: {
    tokens: 10, // Initial tokens
    refillRate: 1, // Tokens per second
    maxTokens: 20, // Maximum tokens in bucket
  },
  
  // Progressive penalties
  penalties: {
    attempts: [5, 10, 20], // Violation thresholds
    multipliers: [2, 4, 8], // Penalty multipliers
    blockDuration: 24 * 60 * 60 * 1000, // 24 hour block for severe violations
  },
  
  // Redis keys
  redisKeys: {
    rateLimit: 'ratelimit:',
    violations: 'violations:',
    blocked: 'blocked:',
    whitelist: 'whitelist:',
    burst: 'burst:',
  },
  
  // Headers
  headers: {
    limit: 'X-RateLimit-Limit',
    remaining: 'X-RateLimit-Remaining',
    reset: 'X-RateLimit-Reset',
    retryAfter: 'Retry-After',
  },
};

/**
 * Get User Tier
 * Determines rate limit tier based on user role and subscription
 * 
 * @param {Object} req - Express request object
 * @returns {string} Tier name
 */
function getUserTier(req) {
  if (!req.user) {
    return 'anonymous';
  }
  
  const { role, accountType, subscription } = req.user;
  
  // Admin gets highest tier
  if (role === USER_ROLES.ADMIN) {
    return 'admin';
  }
  
  // Check subscription level
  if (subscription?.plan === 'enterprise') {
    return 'enterprise';
  }
  
  // Agency accounts
  if (accountType === ACCOUNT_TYPES.AGENCY) {
    return 'agency';
  }
  
  // Creator accounts
  if (accountType === ACCOUNT_TYPES.CREATOR) {
    return subscription?.plan === 'paid' ? 'creator' : 'free';
  }
  
  return 'free';
}

/**
 * Create Rate Limiter
 * Factory function to create configured rate limiters
 * 
 * @param {Object} options - Rate limiter options
 * @returns {Function} Express rate limit middleware
 */
function createRateLimiter(options = {}) {
  const config = {
    windowMs: options.windowMs || RATE_LIMIT_CONFIG.global.windowMs,
    max: options.max || RATE_LIMIT_CONFIG.global.max,
    message: options.message || RATE_LIMIT_CONFIG.global.message,
    standardHeaders: true,
    legacyHeaders: false,
    
    // Redis store for distributed rate limiting
    store: new RedisStore({
      client: redisClient.client,
      prefix: RATE_LIMIT_CONFIG.redisKeys.rateLimit,
      sendCommand: (...args) => redisClient.client.sendCommand(args),
    }),
    
    // Key generator - combines IP and user ID if authenticated
    keyGenerator: (req) => {
      const userId = req.user?.id || req.user?._id;
      const ip = req.ip || req.connection.remoteAddress;
      
      if (userId) {
        return `user:${userId}`;
      }
      
      if (req.apiKey) {
        return `apikey:${req.apiKey}`;
      }
      
      return `ip:${ip}`;
    },
    
    // Skip function for whitelisted IPs or users
    skip: async (req) => {
      // Check whitelist
      if (await isWhitelisted(req)) {
        return true;
      }
      
      // Skip for admin users
      if (req.user?.role === USER_ROLES.ADMIN && !options.includeAdmin) {
        return true;
      }
      
      return false;
    },
    
    // Handler for rate limit exceeded
    handler: async (req, res) => {
      const key = options.keyGenerator ? options.keyGenerator(req) : 
                  `${req.user?.id || req.ip}`;
      
      // Log rate limit violation
      logger.warn('Rate limit exceeded', {
        key,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id,
      });
      
      // Track violations for progressive penalties
      await trackViolation(key);
      
      // Check if should be blocked
      const blocked = await checkAndBlock(key);
      
      if (blocked) {
        return ResponseUtil.forbidden(res, 'Access blocked due to repeated violations');
      }
      
      // Calculate retry after
      const retryAfter = Math.ceil(options.windowMs / 1000);
      
      return ResponseUtil.tooManyRequests(
        res,
        options.message || 'Too many requests, please try again later',
        retryAfter
      );
    },
    
    ...options,
  };
  
  return rateLimit(config);
}

/**
 * Dynamic Rate Limiter
 * Adjusts limits based on user tier
 */
const dynamicRateLimiter = async (req, res, next) => {
  try {
    const tier = getUserTier(req);
    const limit = RATE_LIMIT_CONFIG.tiers[tier];
    
    // Create tier-specific limiter
    const limiter = createRateLimiter({
      windowMs: RATE_LIMIT_CONFIG.global.windowMs,
      max: limit,
      message: `Rate limit exceeded for ${tier} tier. Limit: ${limit} requests per 15 minutes`,
      keyGenerator: (req) => {
        const baseKey = req.user?.id || req.apiKey || req.ip;
        return `${tier}:${baseKey}`;
      },
    });
    
    // Apply the limiter
    limiter(req, res, next);
  } catch (error) {
    logger.error('Dynamic rate limiter error', {
      error: error.message,
      userId: req.user?.id,
    });
    next(); // Continue on error to avoid blocking requests
  }
};

/**
 * Endpoint-Specific Rate Limiters
 * Creates limiters for specific endpoints
 */
const endpointLimiters = {};

// Pre-create limiters for configured endpoints
Object.entries(RATE_LIMIT_CONFIG.endpoints).forEach(([path, config]) => {
  endpointLimiters[path] = createRateLimiter({
    ...config,
    keyGenerator: (req) => {
      const baseKey = req.user?.id || req.ip;
      return `endpoint:${path}:${baseKey}`;
    },
  });
});

/**
 * Apply Endpoint Limiter
 * Middleware to apply endpoint-specific limits
 */
const applyEndpointLimiter = (req, res, next) => {
  const limiter = endpointLimiters[req.path];
  
  if (limiter) {
    return limiter(req, res, next);
  }
  
  // Check for pattern matches (e.g., /api/v1/auth/*)
  for (const [pattern, limiter] of Object.entries(endpointLimiters)) {
    if (req.path.startsWith(pattern.replace(/\*$/, ''))) {
      return limiter(req, res, next);
    }
  }
  
  next();
};

/**
 * Burst Rate Limiter
 * Token bucket algorithm for burst protection
 */
const burstRateLimiter = async (req, res, next) => {
  try {
    const key = `${RATE_LIMIT_CONFIG.redisKeys.burst}${req.user?.id || req.ip}`;
    const now = Date.now();
    
    // Get current bucket state
    let bucket = await redisClient.get(key);
    
    if (!bucket) {
      // Initialize bucket
      bucket = {
        tokens: RATE_LIMIT_CONFIG.burst.tokens,
        lastRefill: now,
      };
    }
    
    // Calculate tokens to add based on time passed
    const timePassed = (now - bucket.lastRefill) / 1000; // in seconds
    const tokensToAdd = timePassed * RATE_LIMIT_CONFIG.burst.refillRate;
    
    // Update bucket
    bucket.tokens = Math.min(
      bucket.tokens + tokensToAdd,
      RATE_LIMIT_CONFIG.burst.maxTokens
    );
    bucket.lastRefill = now;
    
    // Check if request can proceed
    if (bucket.tokens < 1) {
      logger.warn('Burst limit exceeded', {
        key,
        path: req.path,
        tokens: bucket.tokens,
      });
      
      return ResponseUtil.tooManyRequests(
        res,
        'Request rate too high, please slow down',
        1 // Retry after 1 second
      );
    }
    
    // Consume a token
    bucket.tokens -= 1;
    
    // Save bucket state
    await redisClient.set(key, bucket, 60); // TTL 60 seconds
    
    // Add headers
    res.set('X-Burst-Tokens-Remaining', Math.floor(bucket.tokens));
    
    next();
  } catch (error) {
    logger.error('Burst rate limiter error', {
      error: error.message,
    });
    next(); // Continue on error
  }
};

/**
 * Track Violations
 * Records rate limit violations for progressive penalties
 * 
 * @param {string} key - Violator key
 */
async function trackViolation(key) {
  try {
    const violationKey = `${RATE_LIMIT_CONFIG.redisKeys.violations}${key}`;
    const count = await redisClient.incr(violationKey);
    
    // Set expiry on first violation
    if (count === 1) {
      await redisClient.expire(violationKey, 86400); // 24 hours
    }
    
    logger.info('Rate limit violation tracked', {
      key,
      violations: count,
    });
    
    return count;
  } catch (error) {
    logger.error('Violation tracking error', {
      error: error.message,
      key,
    });
    return 0;
  }
}

/**
 * Check and Block
 * Checks violations and blocks repeat offenders
 * 
 * @param {string} key - Violator key
 * @returns {Promise<boolean>} Is blocked
 */
async function checkAndBlock(key) {
  try {
    const violationKey = `${RATE_LIMIT_CONFIG.redisKeys.violations}${key}`;
    const violations = await redisClient.get(violationKey);
    
    if (!violations) {
      return false;
    }
    
    // Check against penalty thresholds
    const { attempts, blockDuration } = RATE_LIMIT_CONFIG.penalties;
    const shouldBlock = violations >= attempts[attempts.length - 1];
    
    if (shouldBlock) {
      const blockKey = `${RATE_LIMIT_CONFIG.redisKeys.blocked}${key}`;
      await redisClient.set(blockKey, {
        violations,
        blockedAt: new Date().toISOString(),
        reason: 'Repeated rate limit violations',
      }, blockDuration / 1000); // Convert to seconds
      
      logger.warn('User/IP blocked for rate limit violations', {
        key,
        violations,
        duration: blockDuration,
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Block check error', {
      error: error.message,
      key,
    });
    return false;
  }
}

/**
 * Check if Blocked
 * Middleware to check if requester is blocked
 */
const checkBlocked = async (req, res, next) => {
  try {
    const key = req.user?.id || req.ip;
    const blockKey = `${RATE_LIMIT_CONFIG.redisKeys.blocked}${key}`;
    
    const blockData = await redisClient.get(blockKey);
    
    if (blockData) {
      logger.warn('Blocked user/IP attempted access', {
        key,
        path: req.path,
        blockData,
      });
      
      return ResponseUtil.forbidden(
        res,
        'Access blocked due to repeated violations. Please contact support.'
      );
    }
    
    next();
  } catch (error) {
    logger.error('Block check error', {
      error: error.message,
    });
    next(); // Continue on error
  }
};

/**
 * Check if Whitelisted
 * Checks if request should bypass rate limiting
 * 
 * @param {Object} req - Express request object
 * @returns {Promise<boolean>} Is whitelisted
 */
async function isWhitelisted(req) {
  try {
    const key = req.user?.id || req.ip;
    const whitelistKey = `${RATE_LIMIT_CONFIG.redisKeys.whitelist}${key}`;
    
    const exists = await redisClient.exists(whitelistKey);
    return exists;
  } catch (error) {
    logger.error('Whitelist check error', {
      error: error.message,
    });
    return false;
  }
}

/**
 * Add to Whitelist
 * Utility function to whitelist a user or IP
 * 
 * @param {string} key - User ID or IP
 * @param {number} duration - Duration in seconds (0 for permanent)
 */
async function addToWhitelist(key, duration = 0) {
  try {
    const whitelistKey = `${RATE_LIMIT_CONFIG.redisKeys.whitelist}${key}`;
    
    if (duration > 0) {
      await redisClient.set(whitelistKey, {
        addedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + duration * 1000).toISOString(),
      }, duration);
    } else {
      await redisClient.set(whitelistKey, {
        addedAt: new Date().toISOString(),
        permanent: true,
      });
    }
    
    logger.info('Added to whitelist', {
      key,
      duration: duration || 'permanent',
    });
  } catch (error) {
    logger.error('Whitelist add error', {
      error: error.message,
      key,
    });
  }
}

/**
 * Remove from Whitelist
 * Utility function to remove from whitelist
 * 
 * @param {string} key - User ID or IP
 */
async function removeFromWhitelist(key) {
  try {
    const whitelistKey = `${RATE_LIMIT_CONFIG.redisKeys.whitelist}${key}`;
    await redisClient.delete(whitelistKey);
    
    logger.info('Removed from whitelist', { key });
  } catch (error) {
    logger.error('Whitelist remove error', {
      error: error.message,
      key,
    });
  }
}

/**
 * Reset Rate Limit
 * Utility function to reset rate limit for a key
 * 
 * @param {string} key - User ID or IP
 */
async function resetRateLimit(key) {
  try {
    // Clear all rate limit keys for this user/IP
    const pattern = `${RATE_LIMIT_CONFIG.redisKeys.rateLimit}*${key}*`;
    const keys = await redisClient.client.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.client.del(...keys);
    }
    
    // Clear violations
    const violationKey = `${RATE_LIMIT_CONFIG.redisKeys.violations}${key}`;
    await redisClient.delete(violationKey);
    
    // Clear block
    const blockKey = `${RATE_LIMIT_CONFIG.redisKeys.blocked}${key}`;
    await redisClient.delete(blockKey);
    
    logger.info('Rate limit reset', {
      key,
      clearedKeys: keys.length,
    });
  } catch (error) {
    logger.error('Rate limit reset error', {
      error: error.message,
      key,
    });
  }
}

/**
 * Get Rate Limit Status
 * Returns current rate limit status for a key
 * 
 * @param {string} key - User ID or IP
 * @returns {Promise<Object>} Rate limit status
 */
async function getRateLimitStatus(key) {
  try {
    const status = {
      key,
      limits: {},
      violations: 0,
      blocked: false,
      whitelisted: false,
    };
    
    // Check if blocked
    const blockKey = `${RATE_LIMIT_CONFIG.redisKeys.blocked}${key}`;
    const blockData = await redisClient.get(blockKey);
    status.blocked = !!blockData;
    if (blockData) {
      status.blockData = blockData;
    }
    
    // Check violations
    const violationKey = `${RATE_LIMIT_CONFIG.redisKeys.violations}${key}`;
    status.violations = (await redisClient.get(violationKey)) || 0;
    
    // Check whitelist
    const whitelistKey = `${RATE_LIMIT_CONFIG.redisKeys.whitelist}${key}`;
    status.whitelisted = await redisClient.exists(whitelistKey);
    
    // Get current limits (simplified - in production, would query actual limits)
    const pattern = `${RATE_LIMIT_CONFIG.redisKeys.rateLimit}*${key}*`;
    const limitKeys = await redisClient.client.keys(pattern);
    
    for (const limitKey of limitKeys) {
      const ttl = await redisClient.ttl(limitKey);
      const value = await redisClient.get(limitKey);
      
      status.limits[limitKey] = {
        value,
        ttl,
        resetsAt: ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null,
      };
    }
    
    return status;
  } catch (error) {
    logger.error('Get rate limit status error', {
      error: error.message,
      key,
    });
    return null;
  }
}

/**
 * API Key Rate Limiter
 * Special handling for API key authentication
 */
const apiKeyRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour for API keys
  keyGenerator: (req) => `apikey:${req.apiKey}`,
  message: 'API key rate limit exceeded',
});

/**
 * Combined Rate Limiter Middleware
 * Applies all rate limiting strategies
 */
const rateLimitMiddleware = [
  checkBlocked,           // 1. Check if blocked
  applyEndpointLimiter,   // 2. Apply endpoint-specific limits
  dynamicRateLimiter,     // 3. Apply tier-based limits
  burstRateLimiter,       // 4. Apply burst protection
];

/**
 * Export rate limiting middlewares and utilities
 */
module.exports = {
  // Main middleware
  rateLimitMiddleware,
  
  // Individual limiters
  createRateLimiter,
  dynamicRateLimiter,
  endpointLimiters,
  burstRateLimiter,
  apiKeyRateLimiter,
  checkBlocked,
  
  // Utility functions
  addToWhitelist,
  removeFromWhitelist,
  resetRateLimit,
  getRateLimitStatus,
  getUserTier,
  
  // Configuration
  RATE_LIMIT_CONFIG,
  
  // Convenience limiters for common use cases
  strict: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many requests',
  }),
  
  moderate: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Too many requests',
  }),
  
  lenient: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Too many requests',
  }),
};