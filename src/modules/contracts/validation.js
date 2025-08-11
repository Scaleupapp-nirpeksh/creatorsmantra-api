/**
 * CreatorsMantra Backend - Contract Upload & AI Review Module
 * Joi validation schemas for all contract endpoints and data integrity
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * 
 * File Path: src/modules/contracts/validation.js
 */

const Joi = require('joi');
const { logInfo, logError } = require('../../shared/utils');

// ================================
// COMMON VALIDATION PATTERNS
// ================================

// MongoDB ObjectId validation
const objectIdSchema = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('Invalid ID format');

// Indian email validation
const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .trim()
  .max(100)
  .message('Please enter a valid email address');

// Indian phone number validation (optional for contracts)
const phoneSchema = Joi.string()
  .pattern(/^(\+91|91)?[6-9]\d{9}$/)
  .message('Please enter a valid Indian phone number');

// Currency validation (INR focus)
const currencySchema = Joi.string()
  .valid('INR', 'USD', 'EUR')
  .default('INR')
  .message('Currency must be INR, USD, or EUR');

// Platform validation
const platformSchema = Joi.string()
  .valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'tiktok', 'snapchat', 'other')
  .message('Invalid platform specified');

// Contract status validation
const contractStatusSchema = Joi.string()
  .valid('uploaded', 'analyzing', 'analyzed', 'under_negotiation', 'finalized', 'signed', 'rejected')
  .message('Invalid contract status');

// Risk level validation
const riskLevelSchema = Joi.string()
  .valid('low', 'medium', 'high', 'critical')
  .message('Invalid risk level');

// Clause type validation
const clauseTypeSchema = Joi.string()
  .valid('payment_terms', 'usage_rights', 'deliverables', 'exclusivity', 'termination', 'liability', 'other')
  .message('Invalid clause type');

// Priority validation
const prioritySchema = Joi.string()
  .valid('must_have', 'important', 'nice_to_have')
  .default('important')
  .message('Priority must be must_have, important, or nice_to_have');

// Tone validation for emails
const toneSchema = Joi.string()
  .valid('professional', 'friendly', 'assertive')
  .default('professional')
  .message('Email tone must be professional, friendly, or assertive');

// ================================
// FILE UPLOAD VALIDATION
// ================================

/**
 * Validate contract file upload
 * Used in: POST /upload
 */
const contractFileUploadSchema = Joi.object({
  // File is handled by multer, but we validate metadata
  brandName: Joi.string()
    .required()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z0-9\s\-&.,()]+$/)
    .message('Brand name must be 2-100 characters and contain only letters, numbers, spaces, and basic punctuation'),

  brandEmail: emailSchema.optional(),

  contractValue: Joi.number()
    .optional()
    .min(0)
    .max(100000000) // 10 Crore limit
    .precision(2)
    .message('Contract value must be a positive number up to ₹10 Crore'),

  platforms: Joi.alternatives()
    .try(
      Joi.array().items(platformSchema).min(1).max(10),
      Joi.string().pattern(/^[a-z,\s]+$/).custom((value, helpers) => {
        const platforms = value.split(',').map(p => p.trim());
        const validPlatforms = ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'tiktok', 'snapchat', 'other'];
        const invalidPlatforms = platforms.filter(p => !validPlatforms.includes(p));
        if (invalidPlatforms.length > 0) {
          return helpers.error('any.invalid');
        }
        return platforms;
      })
    )
    .optional()
    .message('Platforms must be a valid array or comma-separated list'),

  tags: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().trim().min(1).max(50)).max(20),
      Joi.string().custom((value, helpers) => {
        const tags = value.split(',').map(t => t.trim()).filter(t => t.length > 0);
        if (tags.length > 20) return helpers.error('array.max');
        if (tags.some(t => t.length > 50)) return helpers.error('string.max');
        return tags;
      })
    )
    .optional()
    .message('Tags must be valid strings, maximum 20 tags of 50 characters each'),

  notes: Joi.string()
    .optional()
    .trim()
    .max(2000)
    .message('Notes cannot exceed 2000 characters')
}).options({ stripUnknown: true });

/**
 * Validate file upload requirements (used in middleware)
 */
const fileValidationSchema = Joi.object({
  fieldname: Joi.string().valid('contractFile').required(),
  originalname: Joi.string().required().max(255),
  encoding: Joi.string().required(),
  mimetype: Joi.string()
    .valid(
      'application/pdf',
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    )
    .required()
    .message('File must be PDF, DOC, DOCX, JPG, or PNG format'),
  size: Joi.number()
    .max(26214400) // 25MB
    .required()
    .message('File size cannot exceed 25MB'),
  buffer: Joi.binary().required()
});

// ================================
// CONTRACT RETRIEVAL VALIDATION
// ================================

/**
 * Validate contract ID parameter
 * Used in: GET /:contractId, POST /:contractId/analyze, etc.
 */
const contractIdParamSchema = Joi.object({
  contractId: objectIdSchema.required()
});

/**
 * Validate contract listing query parameters
 * Used in: GET /contracts
 */
const contractListQuerySchema = Joi.object({
  status: contractStatusSchema.optional(),
  
  brandName: Joi.string()
    .optional()
    .trim()
    .min(1)
    .max(100)
    .message('Brand name filter must be 1-100 characters'),

  riskLevel: riskLevelSchema.optional(),

  limit: Joi.number()
    .optional()
    .integer()
    .min(1)
    .max(100)
    .default(50)
    .message('Limit must be between 1 and 100'),

  page: Joi.number()
    .optional()
    .integer()
    .min(1)
    .default(1)
    .message('Page must be a positive integer'),

  sortBy: Joi.string()
    .optional()
    .valid('createdAt', 'updatedAt', 'brandName', 'contractValue', 'status')
    .default('createdAt')
    .message('Invalid sort field'),

  sortOrder: Joi.string()
    .optional()
    .valid('asc', 'desc')
    .default('desc')
    .message('Sort order must be asc or desc')
}).options({ stripUnknown: true });

// ================================
// AI ANALYSIS VALIDATION
// ================================

/**
 * Validate manual analysis trigger
 * Used in: POST /:contractId/analyze
 */
const analyzeContractSchema = Joi.object({
  force: Joi.boolean()
    .optional()
    .default(false)
    .message('Force parameter must be boolean'),

  includeComparison: Joi.boolean()
    .optional()
    .default(true)
    .message('Include comparison parameter must be boolean')
}).options({ stripUnknown: true });

// ================================
// NEGOTIATION VALIDATION
// ================================

/**
 * Validate negotiation points structure
 * Used in: POST /:contractId/negotiation-email, POST /:contractId/negotiations
 */
const negotiationPointSchema = Joi.object({
  clauseType: clauseTypeSchema.required(),
  
  originalClause: Joi.string()
    .required()
    .trim()
    .min(10)
    .max(2000)
    .message('Original clause must be 10-2000 characters'),

  proposedChange: Joi.string()
    .required()
    .trim()
    .min(10)
    .max(2000)
    .message('Proposed change must be 10-2000 characters'),

  reasoning: Joi.string()
    .required()
    .trim()
    .min(10)
    .max(1000)
    .message('Reasoning must be 10-1000 characters'),

  priority: prioritySchema.required(),

  status: Joi.string()
    .optional()
    .valid('pending', 'accepted', 'rejected', 'counter_offered')
    .default('pending')
    .message('Invalid negotiation status')
});

/**
 * Validate negotiation email generation
 * Used in: POST /:contractId/negotiation-email
 */
const negotiationEmailSchema = Joi.object({
  negotiationPoints: Joi.array()
    .items(negotiationPointSchema)
    .required()
    .min(1)
    .max(20)
    .message('Must provide 1-20 negotiation points'),

  tone: toneSchema.required(),

  customMessage: Joi.string()
    .optional()
    .trim()
    .max(500)
    .message('Custom message cannot exceed 500 characters'),

  includeAttachments: Joi.boolean()
    .optional()
    .default(false)
    .message('Include attachments must be boolean')
}).options({ stripUnknown: true });

/**
 * Validate saving negotiation history
 * Used in: POST /:contractId/negotiations
 */
const saveNegotiationSchema = Joi.object({
  negotiationPoints: Joi.array()
    .items(negotiationPointSchema)
    .required()
    .min(1)
    .max(20)
    .message('Must provide 1-20 negotiation points'),

  emailTemplate: Joi.object({
    subject: Joi.string()
      .required()
      .trim()
      .min(5)
      .max(200)
      .message('Email subject must be 5-200 characters'),

    body: Joi.string()
      .required()
      .trim()
      .min(50)
      .max(5000)
      .message('Email body must be 50-5000 characters'),

    tone: toneSchema.required()
  }).required(),

  emailSent: Joi.boolean()
    .optional()
    .default(false)
    .message('Email sent status must be boolean'),

  notes: Joi.string()
    .optional()
    .trim()
    .max(1000)
    .message('Notes cannot exceed 1000 characters')
}).options({ stripUnknown: true });

// ================================
// TEMPLATE & KNOWLEDGE BASE VALIDATION
// ================================

/**
 * Validate template query parameters
 * Used in: GET /templates
 */
const templateQuerySchema = Joi.object({
  category: Joi.string()
    .required()
    .valid('collaboration', 'sponsorship', 'partnership', 'licensing', 'employment', 'other')
    .message('Invalid template category'),

  platforms: Joi.string()
    .optional()
    .pattern(/^[a-z,\s]+$/)
    .custom((value, helpers) => {
      const platforms = value.split(',').map(p => p.trim());
      const validPlatforms = ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'tiktok', 'snapchat', 'other'];
      const invalidPlatforms = platforms.filter(p => !validPlatforms.includes(p));
      if (invalidPlatforms.length > 0) {
        return helpers.error('any.invalid');
      }
      return platforms;
    })
    .message('Invalid platforms in query'),

  industry: Joi.string()
    .optional()
    .valid('fashion', 'beauty', 'tech', 'food', 'travel', 'fitness', 'gaming', 'lifestyle', 'education', 'other')
    .message('Invalid industry specified')
}).options({ stripUnknown: true });

/**
 * Validate clause alternative parameters
 * Used in: GET /clause-alternatives/:clauseType
 */
const clauseAlternativeParamSchema = Joi.object({
  clauseType: clauseTypeSchema.required()
});

const clauseAlternativeQuerySchema = Joi.object({
  context: Joi.string()
    .optional()
    .custom((value, helpers) => {
      try {
        return JSON.parse(value);
      } catch (error) {
        return helpers.error('any.invalid');
      }
    })
    .message('Context must be valid JSON'),

  limit: Joi.number()
    .optional()
    .integer()
    .min(1)
    .max(10)
    .default(5)
    .message('Limit must be between 1 and 10')
}).options({ stripUnknown: true });

// ================================
// WORKFLOW & INTEGRATION VALIDATION
// ================================

/**
 * Validate contract to deal conversion
 * Used in: POST /:contractId/convert-to-deal
 */
const convertToDealSchema = Joi.object({
  dealValue: Joi.number()
    .optional()
    .min(0)
    .max(100000000)
    .precision(2)
    .message('Deal value must be positive and up to ₹10 Crore'),

  currency: currencySchema.optional(),

  timeline: Joi.object({
    startDate: Joi.date()
      .optional()
      .min('now')
      .message('Start date cannot be in the past'),

    endDate: Joi.date()
      .optional()
      .greater(Joi.ref('startDate'))
      .message('End date must be after start date')
  }).optional(),

  deliverables: Joi.array()
    .items(Joi.object({
      type: Joi.string()
        .required()
        .valid('reel', 'post', 'story', 'video', 'article', 'other')
        .message('Invalid deliverable type'),

      quantity: Joi.number()
        .required()
        .integer()
        .min(1)
        .max(100)
        .message('Quantity must be between 1 and 100'),

      description: Joi.string()
        .optional()
        .trim()
        .max(200)
        .message('Description cannot exceed 200 characters')
    }))
    .optional()
    .max(50)
    .message('Maximum 50 deliverables allowed'),

  notes: Joi.string()
    .optional()
    .trim()
    .max(1000)
    .message('Notes cannot exceed 1000 characters')
}).options({ stripUnknown: true });

/**
 * Validate contract status update
 * Used in: PATCH /:contractId/status
 */
const updateStatusSchema = Joi.object({
  status: contractStatusSchema.required(),

  notes: Joi.string()
    .optional()
    .trim()
    .max(1000)
    .message('Notes cannot exceed 1000 characters'),

  notifyBrand: Joi.boolean()
    .optional()
    .default(false)
    .message('Notify brand must be boolean')
}).options({ stripUnknown: true });

// ================================
// ANALYTICS VALIDATION
// ================================

/**
 * Validate analytics query parameters
 * Used in: GET /analytics
 */
const analyticsQuerySchema = Joi.object({
  timeframe: Joi.string()
    .optional()
    .valid('7d', '30d', '90d', '1y', 'all')
    .default('30d')
    .message('Invalid timeframe specified'),

  includeNegotiations: Joi.boolean()
    .optional()
    .default(true)
    .message('Include negotiations must be boolean'),

  groupBy: Joi.string()
    .optional()
    .valid('brand', 'platform', 'risk_level', 'month')
    .message('Invalid groupBy parameter')
}).options({ stripUnknown: true });

// ================================
// BRAND RESPONSE VALIDATION
// ================================

/**
 * Validate brand response to negotiation
 * Used in: PATCH /:contractId/negotiations/:negotiationId/response
 */
const brandResponseSchema = Joi.object({
  responseType: Joi.string()
    .required()
    .valid('full_acceptance', 'partial_acceptance', 'counter_offer', 'rejection')
    .message('Invalid response type'),

  responseNotes: Joi.string()
    .optional()
    .trim()
    .max(2000)
    .message('Response notes cannot exceed 2000 characters'),

  acceptedPoints: Joi.array()
    .items(objectIdSchema)
    .optional()
    .when('responseType', {
      is: 'partial_acceptance',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .message('Accepted points required for partial acceptance'),

  counterOffer: Joi.object({
    proposedTerms: Joi.string()
      .required()
      .trim()
      .min(20)
      .max(2000)
      .message('Proposed terms must be 20-2000 characters'),

    reasoning: Joi.string()
      .optional()
      .trim()
      .max(1000)
      .message('Reasoning cannot exceed 1000 characters')
  })
    .optional()
    .when('responseType', {
      is: 'counter_offer',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
}).options({ stripUnknown: true });

// ================================
// VALIDATION MIDDLEWARE FACTORY
// ================================

/**
 * Create validation middleware for specific schema
 * @param {Object} schema - Joi validation schema
 * @param {String} target - Validation target (body, params, query)
 * @returns {Function} Express middleware function
 */
const createValidationMiddleware = (schema, target = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[target];
    
    const { error, value } = schema.validate(dataToValidate);
    
    if (error) {
      logError('Validation failed', {
        target,
        path: req.path,
        method: req.method,
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        userId: req.user?.userId
      });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        })),
        code: 400,
        timestamp: new Date().toISOString()
      });
    }

    // Replace original data with validated/sanitized data
    req[target] = value;
    next();
  };
};

// ================================
// CUSTOM VALIDATION FUNCTIONS
// ================================

/**
 * Validate file upload size and type
 * @param {Object} file - Multer file object
 * @returns {Object} Validation result
 */
const validateContractFile = (file) => {
  if (!file) {
    return {
      isValid: false,
      error: 'Contract file is required'
    };
  }

  const { error } = fileValidationSchema.validate(file);
  
  if (error) {
    return {
      isValid: false,
      error: error.details[0].message
    };
  }

  return { isValid: true };
};

/**
 * Validate subscription tier access
 * @param {String} requiredTier - Required subscription tier
 * @param {String} userTier - User's current tier
 * @returns {Boolean} Access allowed
 */
const validateSubscriptionAccess = (requiredTier, userTier) => {
  const tierHierarchy = {
    starter: 1,
    pro: 2,
    elite: 3,
    agency_starter: 4,
    agency_pro: 5
  };

  const requiredLevel = tierHierarchy[requiredTier] || 0;
  const userLevel = tierHierarchy[userTier] || 0;

  return userLevel >= requiredLevel;
};

// ================================
// EXPORTS
// ================================
module.exports = {
  // Validation Middleware Factory
  createValidationMiddleware,

  // File Upload Validation
  contractFileUploadSchema,
  fileValidationSchema,
  validateContractFile,

  // Parameter Validation
  contractIdParamSchema,
  clauseAlternativeParamSchema,

  // Query Validation
  contractListQuerySchema,
  templateQuerySchema,
  clauseAlternativeQuerySchema,
  analyticsQuerySchema,

  // Body Validation
  analyzeContractSchema,
  negotiationEmailSchema,
  saveNegotiationSchema,
  convertToDealSchema,
  updateStatusSchema,
  brandResponseSchema,

  // Custom Validation
  validateSubscriptionAccess,

  // Common Schemas (for reuse)
  objectIdSchema,
  emailSchema,
  phoneSchema,
  currencySchema,
  platformSchema,
  contractStatusSchema,
  riskLevelSchema,
  clauseTypeSchema,
  prioritySchema,
  toneSchema,
  negotiationPointSchema,

  // Validation Helpers
  validators: {
    contractUpload: createValidationMiddleware(contractFileUploadSchema, 'body'),
    contractId: createValidationMiddleware(contractIdParamSchema, 'params'),
    contractList: createValidationMiddleware(contractListQuerySchema, 'query'),
    analyzeContract: createValidationMiddleware(analyzeContractSchema, 'body'),
    negotiationEmail: createValidationMiddleware(negotiationEmailSchema, 'body'),
    saveNegotiation: createValidationMiddleware(saveNegotiationSchema, 'body'),
    templates: createValidationMiddleware(templateQuerySchema, 'query'),
    clauseAlternativeParams: createValidationMiddleware(clauseAlternativeParamSchema, 'params'),
    clauseAlternativeQuery: createValidationMiddleware(clauseAlternativeQuerySchema, 'query'),
    convertToDeal: createValidationMiddleware(convertToDealSchema, 'body'),
    updateStatus: createValidationMiddleware(updateStatusSchema, 'body'),
    analytics: createValidationMiddleware(analyticsQuerySchema, 'query')
  }
};

// ================================
// INITIALIZATION LOG
// ================================
logInfo('Contract validation schemas initialized', {
  totalSchemas: 15,
  fileValidation: true,
  paramValidation: true,
  queryValidation: true,
  bodyValidation: true,
  customValidators: 2,
  middlewareFactory: true,
  validationHelpers: 12,
  timestamp: new Date().toISOString()
});