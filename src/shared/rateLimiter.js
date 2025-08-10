/**
 * CreatorsMantra Backend - Rate Limiter
 * API rate limiting middleware
 */

const rateLimit = require('express-rate-limit');

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
 * Export as both a function and a shorthand
 */
module.exports = {
  rateLimit: createRateLimiter,
  createRateLimiter
};