/**
 * Security Middleware
 * @module middlewares/security
 * @description Comprehensive security middleware for request protection, headers, and sanitization
 * 
 * File Path: src/middlewares/security.middleware.js
 * 
 * Security Features:
 * - Helmet.js security headers (CSP, HSTS, X-Frame-Options)
 * - CORS with whitelist and credentials
 * - MongoDB query injection prevention
 * - XSS attack prevention
 * - Request size limiting
 * - File upload validation and sanitization
 * - IP tracking and blocking
 * - Security event logging
 */

const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const config = require('../config/environment');
const logger = require('../config/logger');
const { sanitize } = require('../utils/sanitize.util');
const { ERROR_CODES, HTTP_STATUS, ALLOWED_EXTENSIONS, MIME_TYPES } = require('../config/constants');
const ResponseUtil = require('../utils/response.util');
const redisClient = require('../config/redis');

/**
 * Security Configuration
 */
const SECURITY_CONFIG = {
  // Blocked IPs cache key
  blockedIPsKey: 'security:blocked:ips',
  
  // Suspicious activity threshold
  suspiciousThreshold: 10,
  
  // File upload limits
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
  
  // Request limits
  maxUrlLength: 2048,
  maxBodyDepth: 10,
  
  // Security headers
  frameOptions: 'DENY',
  xssProtection: '1; mode=block',
  contentTypeOptions: 'nosniff',
  
  // CORS allowed methods
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  
  // Rate limit for suspicious activity
  suspiciousActivityTTL: 3600, // 1 hour block
};

/**
 * Helmet Security Headers Configuration
 * Configures various HTTP headers to secure the application
 */
const helmetConfig = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://api.openai.com', 'https://api.razorpay.com'],
      mediaSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      frameSrc: ["'self'", 'https://api.razorpay.com'],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: config.isProduction ? [] : null,
    },
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  
  // X-Frame-Options
  frameguard: {
    action: SECURITY_CONFIG.frameOptions,
  },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-XSS-Protection (for older browsers)
  xssFilter: true,
  
  // X-Permitted-Cross-Domain-Policies
  permittedCrossDomainPolicies: false,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  
  // X-DNS-Prefetch-Control
  dnsPrefetchControl: {
    allow: false,
  },
  
  // X-Download-Options (IE8+)
  ieNoOpen: true,
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
};

/**
 * CORS Configuration
 * Configures Cross-Origin Resource Sharing policies
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.) in development
    if (!origin && !config.isProduction) {
      return callback(null, true);
    }
    
    // Check if origin is in whitelist
    const allowedOrigins = config.security.corsOrigin;
    
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { 
        origin, 
        allowedOrigins,
        ip: this.ip 
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  credentials: true, // Allow cookies and credentials
  
  methods: SECURITY_CONFIG.allowedMethods,
  
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID',
    'X-API-Key',
    'X-Device-ID',
    'X-App-Version',
  ],
  
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Total-Count',
    'X-Page-Count',
  ],
  
  maxAge: 86400, // 24 hours
  
  preflightContinue: false,
  
  optionsSuccessStatus: 204,
};

/**
 * IP Blocking Middleware
 * Blocks requests from blacklisted IP addresses
 */
async function ipBlockingMiddleware(req, res, next) {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Check if IP is blocked
    const isBlocked = await redisClient.sismember(SECURITY_CONFIG.blockedIPsKey, clientIP);
    
    if (isBlocked) {
      logger.warn('Blocked IP attempted access', { 
        ip: clientIP, 
        path: req.path,
        method: req.method 
      });
      
      return ResponseUtil.forbidden(res, 'Access denied');
    }
    
    next();
  } catch (error) {
    logger.error('IP blocking check failed', { error: error.message });
    next(); // Continue on error to avoid blocking legitimate requests
  }
}

/**
 * Request Validation Middleware
 * Validates request structure and prevents malformed requests
 */
function requestValidationMiddleware(req, res, next) {
  try {
    // Check URL length
    if (req.originalUrl.length > SECURITY_CONFIG.maxUrlLength) {
      logger.warn('URL too long', { 
        url: req.originalUrl.substring(0, 100),
        length: req.originalUrl.length 
      });
      return ResponseUtil.badRequest(res, 'URL too long');
    }
    
    // Check for null bytes in URL
    if (req.originalUrl.includes('\0')) {
      logger.warn('Null byte in URL detected', { ip: req.ip });
      return ResponseUtil.badRequest(res, 'Invalid URL');
    }
    
    // Validate JSON depth (prevent deep nesting attacks)
    if (req.body && typeof req.body === 'object') {
      const depth = getObjectDepth(req.body);
      if (depth > SECURITY_CONFIG.maxBodyDepth) {
        logger.warn('Request body too deeply nested', { 
          depth, 
          ip: req.ip 
        });
        return ResponseUtil.badRequest(res, 'Request body too complex');
      }
    }
    
    // Sanitize headers
    sanitizeHeaders(req);
    
    next();
  } catch (error) {
    logger.error('Request validation error', { error: error.message });
    return ResponseUtil.serverError(res, error);
  }
}

/**
 * File Upload Security Middleware
 * Validates and sanitizes file uploads
 */
function fileUploadSecurityMiddleware(req, res, next) {
  try {
    // Skip if no files
    if (!req.files && !req.file) {
      return next();
    }
    
    const files = req.files || [req.file];
    const filesArray = Array.isArray(files) ? files : [files];
    
    // Check file count
    if (filesArray.length > SECURITY_CONFIG.maxFiles) {
      logger.warn('Too many files uploaded', { 
        count: filesArray.length,
        ip: req.ip 
      });
      return ResponseUtil.badRequest(res, `Maximum ${SECURITY_CONFIG.maxFiles} files allowed`);
    }
    
    // Validate each file
    for (const file of filesArray) {
      // Check file size
      if (file.size > SECURITY_CONFIG.maxFileSize) {
        logger.warn('File too large', { 
          filename: file.originalname,
          size: file.size,
          ip: req.ip 
        });
        return ResponseUtil.badRequest(res, 'File too large');
      }
      
      // Validate MIME type
      if (!isValidMimeType(file.mimetype)) {
        logger.warn('Invalid file type', { 
          filename: file.originalname,
          mimetype: file.mimetype,
          ip: req.ip 
        });
        return ResponseUtil.badRequest(res, 'Invalid file type');
      }
      
      // Sanitize filename
      file.originalname = sanitize.fileName(file.originalname, { 
        validateExtension: true 
      });
      
      // Check for double extensions
      if (hasDoubleExtension(file.originalname)) {
        logger.warn('Double extension detected', { 
          filename: file.originalname,
          ip: req.ip 
        });
        return ResponseUtil.badRequest(res, 'Invalid filename');
      }
      
      // Add security metadata
      file.securityChecked = true;
      file.checkedAt = new Date().toISOString();
    }
    
    next();
  } catch (error) {
    logger.error('File upload security error', { error: error.message });
    return ResponseUtil.serverError(res, error);
  }
}

/**
 * Suspicious Activity Detection
 * Tracks and blocks suspicious patterns
 */
async function suspiciousActivityMiddleware(req, res, next) {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    const suspiciousPatterns = [
      /\.\.\//g, // Directory traversal
      /<script/gi, // Script injection
      /SELECT.*FROM/gi, // SQL injection
      /UNION.*SELECT/gi, // SQL injection
      /\$where/g, // MongoDB injection
      /\$gt|\$lt|\$ne|\$eq/g, // MongoDB operators
      /eval\(/gi, // Code execution
      /javascript:/gi, // JavaScript protocol
    ];
    
    // Check URL and body for suspicious patterns
    const requestData = JSON.stringify({
      url: req.originalUrl,
      body: req.body,
      query: req.query,
    });
    
    let suspiciousScore = 0;
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestData)) {
        suspiciousScore++;
        logger.warn('Suspicious pattern detected', { 
          pattern: pattern.toString(),
          ip: clientIP,
          path: req.path 
        });
      }
    }
    
    // Track suspicious activity
    if (suspiciousScore > 0) {
      const key = `security:suspicious:${clientIP}`;
      const count = await redisClient.incr(key);
      
      // Set expiry on first increment
      if (count === 1) {
        await redisClient.expire(key, SECURITY_CONFIG.suspiciousActivityTTL);
      }
      
      // Block if threshold exceeded
      if (count > SECURITY_CONFIG.suspiciousThreshold) {
        await redisClient.sadd(SECURITY_CONFIG.blockedIPsKey, clientIP);
        await redisClient.expire(SECURITY_CONFIG.blockedIPsKey, SECURITY_CONFIG.suspiciousActivityTTL);
        
        logger.error('IP blocked for suspicious activity', { 
          ip: clientIP,
          score: suspiciousScore,
          count 
        });
        
        return ResponseUtil.forbidden(res, 'Access denied due to suspicious activity');
      }
    }
    
    next();
  } catch (error) {
    logger.error('Suspicious activity detection error', { error: error.message });
    next(); // Continue on error
  }
}

/**
 * Security Headers Middleware
 * Adds additional security headers not covered by Helmet
 */
function additionalSecurityHeaders(req, res, next) {
  // Cache-Control for sensitive pages
  if (req.path.includes('/api/') || req.path.includes('/auth/')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  
  // Feature Policy / Permissions Policy
  res.set('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );
  
  // X-Content-Security-Policy (for older browsers)
  res.set('X-Content-Security-Policy', "default-src 'self'");
  
  // Expect-CT header for certificate transparency
  if (config.isProduction) {
    res.set('Expect-CT', 'max-age=86400, enforce');
  }
  
  next();
}

/**
 * Helper Functions
 */

/**
 * Get object nesting depth
 * @param {Object} obj - Object to check
 * @param {number} currentDepth - Current depth
 * @returns {number} Maximum depth
 */
function getObjectDepth(obj, currentDepth = 0) {
  if (currentDepth > SECURITY_CONFIG.maxBodyDepth) {
    return currentDepth;
  }
  
  if (typeof obj !== 'object' || obj === null) {
    return currentDepth;
  }
  
  let maxDepth = currentDepth;
  
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      const depth = getObjectDepth(value, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
  }
  
  return maxDepth;
}

/**
 * Sanitize request headers
 * @param {Object} req - Express request object
 */
function sanitizeHeaders(req) {
  const dangerousHeaders = [
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-forwarded-for',
  ];
  
  // Remove potentially dangerous headers in production
  if (config.isProduction) {
    dangerousHeaders.forEach(header => {
      delete req.headers[header];
    });
  }
  
  // Sanitize remaining headers
  Object.keys(req.headers).forEach(key => {
    if (typeof req.headers[key] === 'string') {
      req.headers[key] = sanitize.input(req.headers[key], { 
        maxLength: 1000 
      });
    }
  });
}

/**
 * Check if MIME type is valid
 * @param {string} mimetype - MIME type to check
 * @returns {boolean} Is valid
 */
function isValidMimeType(mimetype) {
  return config.upload.allowedMimeTypes.includes(mimetype);
}

/**
 * Check for double extensions
 * @param {string} filename - Filename to check
 * @returns {boolean} Has double extension
 */
function hasDoubleExtension(filename) {
  const parts = filename.split('.');
  if (parts.length < 3) return false;
  
  const suspiciousExtensions = ['php', 'exe', 'sh', 'bat', 'cmd', 'com'];
  
  for (let i = 1; i < parts.length - 1; i++) {
    if (suspiciousExtensions.includes(parts[i].toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Combined Security Middleware
 * Combines all security middlewares in the correct order
 */
const securityMiddleware = [
  // 1. IP Blocking (first to reject blocked IPs immediately)
  ipBlockingMiddleware,
  
  // 2. Helmet (security headers)
  helmet(helmetConfig),
  
  // 3. CORS
  cors(corsOptions),
  
  // 4. Compression
  compression({
    filter: (req, res) => {
      // Don't compress responses with this request header
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Use compression filter function
      return compression.filter(req, res);
    },
    level: 6, // Compression level (0-9)
  }),
  
  // 5. MongoDB Sanitization
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      logger.warn('MongoDB injection attempt sanitized', { 
        key,
        ip: req.ip,
        path: req.path 
      });
    },
  }),
  
  // 6. XSS Clean
  xss(),
  
  // 7. Prevent HTTP Parameter Pollution
  hpp({
    whitelist: ['sort', 'fields', 'page', 'limit'], // Allowed duplicate params
  }),
  
  // 8. Request Validation
  requestValidationMiddleware,
  
  // 9. File Upload Security
  fileUploadSecurityMiddleware,
  
  // 10. Suspicious Activity Detection
  suspiciousActivityMiddleware,
  
  // 11. Additional Security Headers
  additionalSecurityHeaders,
];

/**
 * Export middleware array and individual components
 */
module.exports = securityMiddleware;

// Export individual middlewares for selective use
module.exports.ipBlocking = ipBlockingMiddleware;
module.exports.helmet = helmet(helmetConfig);
module.exports.cors = cors(corsOptions);
module.exports.mongoSanitize = mongoSanitize();
module.exports.requestValidation = requestValidationMiddleware;
module.exports.fileUploadSecurity = fileUploadSecurityMiddleware;
module.exports.suspiciousActivity = suspiciousActivityMiddleware;
module.exports.securityHeaders = additionalSecurityHeaders;

// Export configuration for testing
module.exports.SECURITY_CONFIG = SECURITY_CONFIG;