/**
 * Validation Middleware
 * @module middlewares/validate
 * @description Request validation middleware using Joi with custom Indian business validations
 * 
 * File Path: src/middlewares/validate.middleware.js
 * 
 * Features:
 * - Joi schema validation for body, params, query, headers
 * - Custom validators for Indian formats (GST, PAN, IFSC, etc.)
 * - Automatic sanitization after validation
 * - Reusable validation schemas
 * - Clear error messages with field paths
 * - File upload validation
 * - Array and nested object validation
 */

const Joi = require('joi');
const logger = require('../config/logger');
const { sanitize } = require('../utils/sanitize.util');
const { validate } = require('../utils/validation.util');
const ResponseUtil = require('../utils/response.util');
const { 
  PLATFORMS, 
  DELIVERABLE_TYPES, 
  DEAL_STAGES,
  INVOICE_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  CURRENCIES,
  TAX_TYPES,
  REGEX_PATTERNS 
} = require('../config/constants');

/**
 * Custom Joi Extensions for Indian Validations
 */
const JoiExtended = Joi.extend(
  // Indian GST Validation
  {
    type: 'indianGST',
    base: Joi.string(),
    messages: {
      'indianGST.invalid': 'Invalid GST number format',
      'indianGST.checksum': 'Invalid GST checksum',
    },
    validate(value, helpers) {
      const result = validate.gst(value);
      if (!result.isValid) {
        return { value, errors: helpers.error('indianGST.invalid') };
      }
      return { value: result.formatted };
    },
  },
  
  // Indian PAN Validation
  {
    type: 'indianPAN',
    base: Joi.string(),
    messages: {
      'indianPAN.invalid': 'Invalid PAN format (Expected: AAAAA0000A)',
    },
    validate(value, helpers) {
      const result = validate.pan(value);
      if (!result.isValid) {
        return { value, errors: helpers.error('indianPAN.invalid') };
      }
      return { value: result.formatted };
    },
  },
  
  // Indian IFSC Validation
  {
    type: 'indianIFSC',
    base: Joi.string(),
    messages: {
      'indianIFSC.invalid': 'Invalid IFSC code format (Expected: AAAA0000000)',
    },
    validate(value, helpers) {
      const result = validate.ifsc(value);
      if (!result.isValid) {
        return { value, errors: helpers.error('indianIFSC.invalid') };
      }
      return { value: result.formatted };
    },
  },
  
  // Indian Mobile Validation
  {
    type: 'indianMobile',
    base: Joi.string(),
    messages: {
      'indianMobile.invalid': 'Invalid Indian mobile number',
    },
    validate(value, helpers) {
      const result = validate.mobile(value);
      if (!result.isValid) {
        return { value, errors: helpers.error('indianMobile.invalid') };
      }
      return { value: result.formatted };
    },
  },
  
  // UPI ID Validation
  {
    type: 'upiId',
    base: Joi.string(),
    messages: {
      'upiId.invalid': 'Invalid UPI ID format',
    },
    validate(value, helpers) {
      const result = validate.upi(value);
      if (!result.isValid) {
        return { value, errors: helpers.error('upiId.invalid') };
      }
      return { value: result.formatted };
    },
  },
  
  // Social Media Handle Validation
  {
    type: 'socialHandle',
    base: Joi.object(),
    messages: {
      'socialHandle.instagram': 'Invalid Instagram handle',
      'socialHandle.youtube': 'Invalid YouTube channel URL',
      'socialHandle.linkedin': 'Invalid LinkedIn profile URL',
    },
    validate(value, helpers) {
      const { platform, handle } = value;
      let result;
      
      switch (platform) {
        case PLATFORMS.INSTAGRAM:
          result = validate.instagram(handle);
          if (!result.isValid) {
            return { value, errors: helpers.error('socialHandle.instagram') };
          }
          break;
          
        case PLATFORMS.YOUTUBE:
          result = validate.youtube(handle);
          if (!result.isValid) {
            return { value, errors: helpers.error('socialHandle.youtube') };
          }
          break;
          
        case PLATFORMS.LINKEDIN:
          result = validate.linkedin(handle);
          if (!result.isValid) {
            return { value, errors: helpers.error('socialHandle.linkedin') };
          }
          break;
          
        default:
          return { value: { platform, handle } };
      }
      
      return { value: { platform, handle: result.formatted } };
    },
  }
);

/**
 * Common Validation Schemas
 */
const ValidationSchemas = {
  // ID Validations
  id: JoiExtended.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .message('Invalid ID format'),
  
  // Pagination
  pagination: {
    page: JoiExtended.number().integer().min(1).default(1),
    limit: JoiExtended.number().integer().min(1).max(100).default(20),
    sort: JoiExtended.string().valid('createdAt', '-createdAt', 'updatedAt', '-updatedAt'),
    search: JoiExtended.string().max(100).trim(),
  },
  
  // User Registration
  userRegistration: JoiExtended.object({
    email: JoiExtended.string().email().required(),
    password: JoiExtended.string()
      .min(8)
      .pattern(REGEX_PATTERNS.STRONG_PASSWORD)
      .message('Password must contain uppercase, lowercase, number and special character'),
    confirmPassword: JoiExtended.string()
      .valid(JoiExtended.ref('password'))
      .messages({ 'any.only': 'Passwords do not match' }),
    accountType: JoiExtended.string()
      .valid('agency', 'creator')
      .required(),
    agencyName: JoiExtended.when('accountType', {
      is: 'agency',
      then: JoiExtended.string().min(2).max(100).required(),
      otherwise: JoiExtended.forbidden(),
    }),
    creatorName: JoiExtended.when('accountType', {
      is: 'creator',
      then: JoiExtended.string().min(2).max(100).required(),
      otherwise: JoiExtended.forbidden(),
    }),
    mobile: JoiExtended.indianMobile().optional(),
    acceptTerms: JoiExtended.boolean().valid(true).required(),
  }),
  
  // Deal Creation
  dealCreation: JoiExtended.object({
    brandName: JoiExtended.string().min(2).max(100).required(),
    brandContact: JoiExtended.object({
      name: JoiExtended.string().max(100),
      email: JoiExtended.string().email(),
      phone: JoiExtended.indianMobile().optional(),
    }).optional(),
    platform: JoiExtended.string()
      .valid(...Object.values(PLATFORMS))
      .required(),
    deliverables: JoiExtended.array()
      .items(
        JoiExtended.object({
          type: JoiExtended.string()
            .valid(...Object.values(DELIVERABLE_TYPES))
            .required(),
          quantity: JoiExtended.number().integer().min(1).default(1),
          description: JoiExtended.string().max(500),
          deadline: JoiExtended.date().min('now').optional(),
        })
      )
      .min(1)
      .required(),
    dealValue: JoiExtended.number().min(0).max(100000000).required(), // Max 10 Cr
    currency: JoiExtended.string()
      .valid(...Object.values(CURRENCIES))
      .default(CURRENCIES.INR),
    stage: JoiExtended.string()
      .valid(...Object.values(DEAL_STAGES))
      .default(DEAL_STAGES.PITCHED),
    pitchDate: JoiExtended.date().optional(),
    expectedClosingDate: JoiExtended.date().min('now').optional(),
    notes: JoiExtended.string().max(2000).optional(),
    tags: JoiExtended.array().items(JoiExtended.string().max(50)).max(10),
    creatorId: JoiExtended.when('$userRole', {
      is: 'agency_member',
      then: JoiExtended.id().required(),
      otherwise: JoiExtended.forbidden(),
    }),
  }),
  
  // Invoice Creation
  invoiceCreation: JoiExtended.object({
    dealId: JoiExtended.id().optional(),
    invoiceNumber: JoiExtended.string()
      .pattern(/^[A-Z0-9\-\/]+$/)
      .max(50)
      .optional(),
    clientDetails: JoiExtended.object({
      name: JoiExtended.string().min(2).max(200).required(),
      email: JoiExtended.string().email().optional(),
      phone: JoiExtended.indianMobile().optional(),
      address: JoiExtended.string().max(500).optional(),
      gst: JoiExtended.indianGST().optional(),
      pan: JoiExtended.indianPAN().optional(),
    }).required(),
    lineItems: JoiExtended.array()
      .items(
        JoiExtended.object({
          description: JoiExtended.string().max(500).required(),
          quantity: JoiExtended.number().positive().required(),
          rate: JoiExtended.number().min(0).required(),
          amount: JoiExtended.number().min(0).optional(), // Auto-calculated
          taxRate: JoiExtended.number().min(0).max(100).optional(),
        })
      )
      .min(1)
      .required(),
    discountPercentage: JoiExtended.number().min(0).max(100).default(0),
    taxType: JoiExtended.string()
      .valid(...Object.values(TAX_TYPES))
      .default(TAX_TYPES.GST),
    taxRate: JoiExtended.number().min(0).max(100).optional(),
    isInterstate: JoiExtended.boolean().default(false),
    applyTDS: JoiExtended.boolean().default(false),
    tdsRate: JoiExtended.number().min(0).max(100).optional(),
    paymentTerms: JoiExtended.number().min(0).max(365).default(30),
    dueDate: JoiExtended.date().min('now').optional(),
    notes: JoiExtended.string().max(1000).optional(),
    termsAndConditions: JoiExtended.string().max(5000).optional(),
    bankDetails: JoiExtended.object({
      accountName: JoiExtended.string().max(100).required(),
      accountNumber: JoiExtended.string()
        .pattern(/^\d{9,18}$/)
        .required(),
      bankName: JoiExtended.string().max(100).required(),
      ifsc: JoiExtended.indianIFSC().required(),
      branch: JoiExtended.string().max(100).optional(),
      upi: JoiExtended.upiId().optional(),
    }).optional(),
  }),
  
  // Payment Recording
  paymentRecording: JoiExtended.object({
    invoiceId: JoiExtended.id().required(),
    amount: JoiExtended.number().positive().required(),
    paymentDate: JoiExtended.date().max('now').required(),
    paymentMethod: JoiExtended.string()
      .valid(...Object.values(PAYMENT_METHODS))
      .required(),
    transactionId: JoiExtended.string().max(100).optional(),
    bankReference: JoiExtended.string().max(100).optional(),
    notes: JoiExtended.string().max(500).optional(),
    tdsDeducted: JoiExtended.number().min(0).optional(),
    attachment: JoiExtended.string().uri().optional(),
  }),
  
  // Rate Card Creation
  rateCardCreation: JoiExtended.object({
    name: JoiExtended.string().min(2).max(100).required(),
    platform: JoiExtended.string()
      .valid(...Object.values(PLATFORMS))
      .required(),
    rates: JoiExtended.object()
      .pattern(
        JoiExtended.string().valid(...Object.values(DELIVERABLE_TYPES)),
        JoiExtended.number().min(0).max(10000000) // Max 1 Cr per deliverable
      )
      .min(1)
      .required(),
    packages: JoiExtended.array()
      .items(
        JoiExtended.object({
          name: JoiExtended.string().max(100).required(),
          description: JoiExtended.string().max(500).optional(),
          deliverables: JoiExtended.array()
            .items(
              JoiExtended.object({
                type: JoiExtended.string()
                  .valid(...Object.values(DELIVERABLE_TYPES))
                  .required(),
                quantity: JoiExtended.number().integer().min(1).required(),
              })
            )
            .min(1)
            .required(),
          price: JoiExtended.number().min(0).required(),
          validityDays: JoiExtended.number().integer().min(1).max(365).optional(),
        })
      )
      .max(10)
      .optional(),
    currency: JoiExtended.string()
      .valid(...Object.values(CURRENCIES))
      .default(CURRENCIES.INR),
    validFrom: JoiExtended.date().default(() => new Date()),
    validTo: JoiExtended.date().min(JoiExtended.ref('validFrom')).optional(),
    notes: JoiExtended.string().max(1000).optional(),
    isActive: JoiExtended.boolean().default(true),
  }),
  
  // Brief Upload
  briefUpload: JoiExtended.object({
    dealId: JoiExtended.id().optional(),
    brandName: JoiExtended.string().max(100).required(),
    content: JoiExtended.string().max(10000).optional(),
    file: JoiExtended.object({
      filename: JoiExtended.string().required(),
      mimetype: JoiExtended.string()
        .valid('application/pdf', 'application/msword', 
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
               'image/jpeg', 'image/png')
        .required(),
      size: JoiExtended.number().max(10485760).required(), // 10MB
    }).optional(),
    extractedData: JoiExtended.object({
      deliverables: JoiExtended.array().items(JoiExtended.string()),
      timeline: JoiExtended.object({
        briefDate: JoiExtended.date(),
        dueDate: JoiExtended.date(),
      }),
      budget: JoiExtended.number().min(0),
      guidelines: JoiExtended.array().items(JoiExtended.string()),
    }).optional(),
  }),
  
  // Performance Report
  performanceReport: JoiExtended.object({
    dealId: JoiExtended.id().required(),
    platform: JoiExtended.string()
      .valid(...Object.values(PLATFORMS))
      .required(),
    metrics: JoiExtended.object({
      impressions: JoiExtended.number().integer().min(0),
      reach: JoiExtended.number().integer().min(0),
      engagement: JoiExtended.number().integer().min(0),
      engagementRate: JoiExtended.number().min(0).max(100),
      clicks: JoiExtended.number().integer().min(0),
      conversions: JoiExtended.number().integer().min(0),
      views: JoiExtended.number().integer().min(0),
      likes: JoiExtended.number().integer().min(0),
      comments: JoiExtended.number().integer().min(0),
      shares: JoiExtended.number().integer().min(0),
      saves: JoiExtended.number().integer().min(0),
    }).required(),
    period: JoiExtended.object({
      startDate: JoiExtended.date().required(),
      endDate: JoiExtended.date()
        .min(JoiExtended.ref('startDate'))
        .required(),
    }).required(),
    screenshots: JoiExtended.array()
      .items(JoiExtended.string().uri())
      .max(10)
      .optional(),
    notes: JoiExtended.string().max(2000).optional(),
  }),
  
  // Email Validation
  email: JoiExtended.string()
    .email({ tlds: { allow: true } })
    .lowercase()
    .trim()
    .required(),
  
  // Password Validation
  password: JoiExtended.string()
    .min(8)
    .max(128)
    .pattern(REGEX_PATTERNS.STRONG_PASSWORD)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, lowercase letter, number, and special character',
    }),
  
  // File Upload Validation
  fileUpload: JoiExtended.object({
    fieldname: JoiExtended.string().required(),
    originalname: JoiExtended.string().required(),
    encoding: JoiExtended.string().required(),
    mimetype: JoiExtended.string().required(),
    size: JoiExtended.number().max(10485760).required(), // 10MB
    buffer: JoiExtended.binary().optional(),
    path: JoiExtended.string().optional(),
  }),
};

/**
 * Validation Middleware Factory
 * Creates a validation middleware for the given schema
 * 
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Property to validate (body, query, params, headers)
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware function
 */
function createValidator(schema, property = 'body', options = {}) {
  return async (req, res, next) => {
    try {
      // Default validation options
      const validationOptions = {
        abortEarly: false, // Report all errors
        allowUnknown: false, // Reject unknown keys
        stripUnknown: true, // Remove unknown keys
        context: {
          userRole: req.user?.role,
          userId: req.user?.id,
        },
        ...options,
      };
      
      // Get data to validate
      const dataToValidate = req[property];
      
      // Skip if no data and not required
      if (!dataToValidate && options.optional) {
        return next();
      }
      
      // Validate data
      const { error, value } = await schema.validateAsync(
        dataToValidate,
        validationOptions
      );
      
      if (error) {
        const errors = formatValidationErrors(error);
        logger.warn('Validation failed', {
          property,
          errors,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
        
        return ResponseUtil.validationError(res, errors, 'Validation failed');
      }
      
      // Sanitize validated data
      const sanitized = sanitizeValidatedData(value, schema);
      
      // Replace request property with sanitized data
      req[property] = sanitized;
      
      // Add validation metadata
      req.validationPassed = true;
      req.validatedAt = new Date().toISOString();
      
      next();
    } catch (error) {
      logger.error('Validation middleware error', {
        error: error.message,
        property,
        path: req.path,
      });
      
      if (error.isJoi) {
        const errors = formatValidationErrors(error);
        return ResponseUtil.validationError(res, errors, 'Validation failed');
      }
      
      return ResponseUtil.serverError(res, error);
    }
  };
}

/**
 * Combined Validator
 * Validates multiple request properties at once
 * 
 * @param {Object} schemas - Object with schemas for each property
 * @returns {Function} Express middleware function
 */
function validateRequest(schemas) {
  return async (req, res, next) => {
    try {
      const errors = {};
      
      // Validate each property
      for (const [property, schema] of Object.entries(schemas)) {
        if (!schema) continue;
        
        const dataToValidate = req[property];
        
        // Skip if no data and not required
        if (!dataToValidate && !schema._flags?.presence) {
          continue;
        }
        
        const { error, value } = await schema.validateAsync(dataToValidate, {
          abortEarly: false,
          allowUnknown: false,
          stripUnknown: true,
          context: {
            userRole: req.user?.role,
            userId: req.user?.id,
          },
        });
        
        if (error) {
          Object.assign(errors, formatValidationErrors(error));
        } else {
          // Sanitize and update request
          req[property] = sanitizeValidatedData(value, schema);
        }
      }
      
      // Check if any errors occurred
      if (Object.keys(errors).length > 0) {
        logger.warn('Request validation failed', {
          errors,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
        
        return ResponseUtil.validationError(res, errors, 'Validation failed');
      }
      
      // Mark as validated
      req.validationPassed = true;
      req.validatedAt = new Date().toISOString();
      
      next();
    } catch (error) {
      logger.error('Request validation error', {
        error: error.message,
        path: req.path,
      });
      
      return ResponseUtil.serverError(res, error);
    }
  };
}

/**
 * Format Validation Errors
 * Converts Joi errors to user-friendly format
 * 
 * @param {Object} error - Joi validation error
 * @returns {Object} Formatted errors
 */
function formatValidationErrors(error) {
  const errors = {};
  
  if (error.details && Array.isArray(error.details)) {
    error.details.forEach((detail) => {
      const path = detail.path.join('.');
      const message = detail.message.replace(/['"]/g, '');
      
      // Group errors by field
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(message);
    });
  }
  
  // Flatten single error arrays
  Object.keys(errors).forEach((key) => {
    if (errors[key].length === 1) {
      errors[key] = errors[key][0];
    }
  });
  
  return errors;
}

/**
 * Sanitize Validated Data
 * Apply sanitization after validation
 * 
 * @param {any} data - Validated data
 * @param {Object} schema - Joi schema used for validation
 * @returns {any} Sanitized data
 */
function sanitizeValidatedData(data, schema) {
  if (!data) return data;
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeValidatedData(item, schema));
  }
  
  // Handle objects
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip null/undefined values
      if (value == null) {
        sanitized[key] = value;
        continue;
      }
      
      // Apply specific sanitization based on type
      if (typeof value === 'string') {
        // Don't sanitize passwords, tokens, or encrypted data
        if (key.toLowerCase().includes('password') || 
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('secret')) {
          sanitized[key] = value;
        } else {
          sanitized[key] = sanitize.input(value, {
            trim: true,
            escapeHtml: false, // Don't escape as it's already validated
          });
        }
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeValidatedData(value, schema);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  // Handle strings
  if (typeof data === 'string') {
    return sanitize.input(data, {
      trim: true,
      escapeHtml: false,
    });
  }
  
  return data;
}

/**
 * Pre-built Validators
 * Ready-to-use validators for common endpoints
 */
const validators = {
  // Authentication
  register: createValidator(ValidationSchemas.userRegistration),
  login: createValidator(
    JoiExtended.object({
      email: ValidationSchemas.email,
      password: JoiExtended.string().required(),
      rememberMe: JoiExtended.boolean().optional(),
    })
  ),
  
  // Deal Management
  createDeal: createValidator(ValidationSchemas.dealCreation),
  updateDeal: createValidator(
    ValidationSchemas.dealCreation.fork(
      ['brandName', 'platform', 'deliverables', 'dealValue'],
      (schema) => schema.optional()
    )
  ),
  
  // Invoice Management
  createInvoice: createValidator(ValidationSchemas.invoiceCreation),
  recordPayment: createValidator(ValidationSchemas.paymentRecording),
  
  // Rate Card
  createRateCard: createValidator(ValidationSchemas.rateCardCreation),
  
  // Brief
  uploadBrief: createValidator(ValidationSchemas.briefUpload),
  
  // Performance
  submitPerformance: createValidator(ValidationSchemas.performanceReport),
  
  // Common
  validateId: createValidator(
    JoiExtended.object({
      id: ValidationSchemas.id,
    }),
    'params'
  ),
  
  validatePagination: createValidator(
    JoiExtended.object(ValidationSchemas.pagination),
    'query',
    { optional: true }
  ),
  
  validateFile: createValidator(
    ValidationSchemas.fileUpload,
    'file'
  ),
};

/**
 * Export validation middleware and utilities
 */
module.exports = {
  createValidator,
  validateRequest,
  validators,
  ValidationSchemas,
  JoiExtended,
  formatValidationErrors,
  sanitizeValidatedData,
};

// Export commonly used validators
module.exports.validateBody = (schema) => createValidator(schema, 'body');
module.exports.validateQuery = (schema) => createValidator(schema, 'query');
module.exports.validateParams = (schema) => createValidator(schema, 'params');
module.exports.validateHeaders = (schema) => createValidator(schema, 'headers');