
//src/shared/middleware.js
/**
 * CreatorsMantra Backend - Essential Middleware
 * Minimal middleware functions for core functionality
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const cors = require('cors');
const helmet = require('helmet');
const { verifyToken, errorResponse, log } = require('./utils');

// ============================================
// CORS MIDDLEWARE
// ============================================

/**
 * CORS configuration for frontend communication
 */
const corsMiddleware = cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// ============================================
// SECURITY MIDDLEWARE
// ============================================

/**
 * Basic security headers using Helmet
 */
const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
});

// ============================================
// REQUEST PARSING MIDDLEWARE
// ============================================

/**
 * JSON body parser with size limit
 */
const jsonParser = require('express').json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
});

/**
 * URL encoded parser
 */
const urlencodedParser = require('express').urlencoded({ 
  extended: true, 
  limit: '10mb' 
});

// ============================================
// REQUEST LOGGING MIDDLEWARE
// ============================================

/**
 * Simple request logging middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  log('info', 'Incoming Request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')
  });
  
  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body) {
    const duration = Date.now() - startTime;
    
    log('info', 'Response Sent', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
    
    return originalJson.call(this, body);
  };
  
  next();
};

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * JWT Authentication middleware
 * Verifies JWT token and adds user info to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        errorResponse('Access token is required', null, 401)
      );
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json(
        errorResponse('Access token is required', null, 401)
      );
    }
    
    // Verify token
    const decoded = verifyToken(token);
    
    // Add user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      subscriptionTier: decoded.subscriptionTier
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json(
        errorResponse('Token has expired', { code: 'TOKEN_EXPIRED' }, 401)
      );
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json(
        errorResponse('Invalid token', { code: 'INVALID_TOKEN' }, 401)
      );
    }
    
    log('error', 'Authentication Error', { error: error.message });
    return res.status(401).json(
      errorResponse('Authentication failed', null, 401)
    );
  }
};

/**
 * Optional authentication middleware
 * Adds user info if token is present but doesn't fail if missing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token) {
        const decoded = verifyToken(token);
        req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          subscriptionTier: decoded.subscriptionTier
        };
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

// ============================================
// AUTHORIZATION MIDDLEWARE
// ============================================

/**
 * Role-based authorization middleware
 * @param {Array} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
const authorizeRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(
        errorResponse('Authentication required', null, 401)
      );
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json(
        errorResponse('Insufficient permissions', { 
          required: allowedRoles,
          current: req.user.role 
        }, 403)
      );
    }
    
    next();
  };
};

/**
 * Subscription tier authorization middleware
 * @param {Array} allowedTiers - Array of allowed subscription tiers
 * @returns {Function} Middleware function
 */
const authorizeSubscription = (allowedTiers = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(
        errorResponse('Authentication required', null, 401)
      );
    }
    
    if (!allowedTiers.includes(req.user.subscriptionTier)) {
      return res.status(403).json(
        errorResponse('Subscription upgrade required', { 
          required: allowedTiers,
          current: req.user.subscriptionTier 
        }, 403)
      );
    }
    
    next();
  };
};

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

/**
 * Request validation middleware using Joi
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate (body, params, query)
 * @returns {Function} Middleware function
 */
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));
      
      return res.status(400).json(
        errorResponse('Validation failed', { 
          errors: validationErrors 
        }, 400)
      );
    }
    
    // Replace request property with validated value
    req[property] = value;
    next();
  };
};

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

/**
 * Global error handling middleware
 * Must be the last middleware in the chain
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  log('error', 'Global Error Handler', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  // Default error
  let error = {
    message: err.message || 'Internal Server Error',
    statusCode: err.statusCode || 500,
    code: err.code || 'INTERNAL_ERROR'
  };
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      message: `Validation Error: ${message}`,
      statusCode: 400,
      code: 'VALIDATION_ERROR'
    };
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = {
      message: `${field} already exists`,
      statusCode: 400,
      code: 'DUPLICATE_FIELD'
    };
  }
  
  // Mongoose cast error
  if (err.name === 'CastError') {
    error = {
      message: 'Invalid ID format',
      statusCode: 400,
      code: 'INVALID_ID'
    };
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid token',
      statusCode: 401,
      code: 'INVALID_TOKEN'
    };
  }
  
  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expired',
      statusCode: 401,
      code: 'TOKEN_EXPIRED'
    };
  }
  
  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      message: 'File size too large',
      statusCode: 400,
      code: 'FILE_TOO_LARGE'
    };
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = {
      message: 'Unexpected file field',
      statusCode: 400,
      code: 'UNEXPECTED_FILE'
    };
  }
  
  // Send error response
  res.status(error.statusCode).json(
    errorResponse(error.message, { 
      code: error.code,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }, error.statusCode)
  );
};

/**
 * 404 Not Found middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const notFoundHandler = (req, res) => {
  res.status(404).json(
    errorResponse(`Route ${req.originalUrl} not found`, { 
      method: req.method,
      url: req.originalUrl 
    }, 404)
  );
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Security & CORS
  corsMiddleware,
  securityMiddleware,
  
  // Request parsing
  jsonParser,
  urlencodedParser,
  
  // Logging
  requestLogger,
  
  // Authentication & Authorization
  authenticateUser,
  optionalAuth,
  authorizeRoles,
  authorizeSubscription,
  
  // Validation
  validateRequest,
  
  // Error handling
  errorHandler,
  notFoundHandler
};