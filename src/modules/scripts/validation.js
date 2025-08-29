//src/modules/scripts/validation.js
/**
 * CreatorsMantra Backend - Content Script Generator Validation
 * Joi validation schemas for script management API endpoints
 * 
 * @author CreatorsMantra Team
 * @version 2.0.0
 * @description Input validation for script creation, updates, AI processing, and deal connection
 */

const Joi = require('joi');

// ============================================
// CUSTOM VALIDATION RULES
// ============================================

// MongoDB ObjectId validation
const objectIdSchema = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    'string.pattern.base': 'Invalid ID format. Must be a valid MongoDB ObjectId.',
    'any.required': 'ID is required'
  });

// Subscription tier validation
const subscriptionTierSchema = Joi.string()
  .valid('starter', 'pro', 'elite', 'agency_starter', 'agency_pro')
  .messages({
    'any.only': 'Invalid subscription tier',
    'any.required': 'Subscription tier is required'
  });

// Script status validation
const scriptStatusSchema = Joi.string()
  .valid('draft', 'generated', 'reviewed', 'approved', 'in_production', 'completed')
  .messages({
    'any.only': 'Invalid script status. Must be one of: draft, generated, reviewed, approved, in_production, completed',
    'any.required': 'Script status is required'
  });

// Input type validation
const inputTypeSchema = Joi.string()
  .valid('text_brief', 'file_upload', 'video_transcription')
  .messages({
    'any.only': 'Invalid input type. Must be text_brief, file_upload, or video_transcription',
    'any.required': 'Input type is required'
  });

// Platform validation with comprehensive list
const platformSchema = Joi.string()
  .valid(
    'instagram_reel', 'instagram_post', 'instagram_story',
    'youtube_video', 'youtube_shorts',
    'linkedin_video', 'linkedin_post',
    'twitter_post', 'facebook_reel', 'tiktok_video'
  )
  .messages({
    'any.only': 'Invalid platform',
    'any.required': 'Platform is required'
  });

// Granularity level validation
const granularitySchema = Joi.string()
  .valid('basic', 'detailed', 'comprehensive')
  .messages({
    'any.only': 'Invalid granularity level. Must be basic, detailed, or comprehensive',
    'any.required': 'Granularity level is required'
  });

// Duration validation
const durationSchema = Joi.string()
  .valid('15_seconds', '30_seconds', '60_seconds', '90_seconds', '3_minutes', '5_minutes', '10_minutes', 'custom')
  .messages({
    'any.only': 'Invalid duration option',
    'any.required': 'Duration is required'
  });

// Variation type validation
const variationTypeSchema = Joi.string()
  .valid('hook_variation', 'cta_variation', 'scene_order', 'brand_integration', 'ending_variation')
  .messages({
    'any.only': 'Invalid variation type',
    'any.required': 'Variation type is required'
  });

// ============================================
// SCRIPT CREATION SCHEMAS
// ============================================

/**
 * Create Text Script Schema
 * POST /api/scripts/create-text
 */
const createTextScriptSchema = Joi.object({
  title: Joi.string()
    .min(3)
    .max(200)
    .required()
    .trim()
    .messages({
      'string.min': 'Script title must be at least 3 characters long',
      'string.max': 'Script title cannot exceed 200 characters',
      'any.required': 'Script title is required'
    }),
  
  briefText: Joi.string()
    .min(50)
    .max(50000)
    .required()
    .messages({
      'string.min': 'Brief text must be at least 50 characters long',
      'string.max': 'Brief text cannot exceed 50,000 characters',
      'any.required': 'Brief text is required'
    }),
  
  platform: platformSchema.required(),
  
  granularityLevel: granularitySchema.default('detailed').optional(),
  
  targetDuration: durationSchema.default('60_seconds').optional(),
  
  customDuration: Joi.number()
    .integer()
    .min(5)
    .max(3600)
    .optional()
    .when('targetDuration', {
      is: 'custom',
      then: Joi.required().messages({
        'any.required': 'Custom duration is required when target duration is set to custom'
      }),
      otherwise: Joi.optional()
    })
    .messages({
      'number.min': 'Custom duration must be at least 5 seconds',
      'number.max': 'Custom duration cannot exceed 1 hour (3600 seconds)',
      'number.integer': 'Custom duration must be a whole number'
    }),
  
  creatorStyleNotes: Joi.string()
    .max(2000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Creator style notes cannot exceed 2000 characters'
    }),
  
  notes: Joi.string()
    .max(2000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Notes cannot exceed 2000 characters'
    }),
  
  tags: Joi.array()
    .items(
      Joi.string()
        .max(30)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .messages({
          'string.max': 'Tag cannot exceed 30 characters',
          'string.pattern.base': 'Tags can only contain letters, numbers, hyphens, and underscores'
        })
    )
    .max(10)
    .unique()
    .optional()
    .messages({
      'array.max': 'Cannot have more than 10 tags',
      'array.unique': 'Tags must be unique'
    })
}).custom((value, helpers) => {
  // Platform-duration compatibility validation
  const platformDurationLimits = {
    'instagram_story': ['15_seconds'],
    'instagram_reel': ['15_seconds', '30_seconds', '60_seconds', '90_seconds', 'custom'],
    'youtube_shorts': ['15_seconds', '30_seconds', '60_seconds', 'custom'],
    'tiktok_video': ['15_seconds', '30_seconds', '60_seconds', '90_seconds', '3_minutes', 'custom'],
    'youtube_video': ['custom', '3_minutes', '5_minutes', '10_minutes'],
    'linkedin_video': ['30_seconds', '60_seconds', '3_minutes', '5_minutes', '10_minutes', 'custom']
  };
  
  const allowedDurations = platformDurationLimits[value.platform];
  if (allowedDurations && !allowedDurations.includes(value.targetDuration)) {
    return helpers.error('any.invalid', { 
      message: `Duration ${value.targetDuration} is not compatible with platform ${value.platform}` 
    });
  }
  
  return value;
});

/**
 * Create File Script Schema
 * POST /api/scripts/create-file
 */
const createFileScriptSchema = Joi.object({
  title: Joi.string()
    .min(3)
    .max(200)
    .optional()
    .trim()
    .messages({
      'string.min': 'Script title must be at least 3 characters long',
      'string.max': 'Script title cannot exceed 200 characters'
    }),
  
  platform: platformSchema.required(),
  granularityLevel: granularitySchema.default('detailed').optional(),
  targetDuration: durationSchema.default('60_seconds').optional(),
  customDuration: Joi.number()
    .integer()
    .min(5)
    .max(3600)
    .optional()
    .when('targetDuration', {
      is: 'custom',
      then: Joi.required()
    }),
  
  creatorStyleNotes: Joi.string()
    .max(2000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Creator style notes cannot exceed 2000 characters'
    }),
  
  tags: Joi.array()
    .items(
      Joi.string()
        .max(30)
        .pattern(/^[a-zA-Z0-9_-]+$/)
    )
    .max(10)
    .unique()
    .optional()
});

/**
 * Create Video Script Schema
 * POST /api/scripts/create-video
 */
const createVideoScriptSchema = Joi.object({
  title: Joi.string()
    .min(3)
    .max(200)
    .optional()
    .trim()
    .messages({
      'string.min': 'Script title must be at least 3 characters long',
      'string.max': 'Script title cannot exceed 200 characters'
    }),
  
  platform: platformSchema.required(),
  granularityLevel: granularitySchema.default('detailed').optional(),
  targetDuration: durationSchema.default('60_seconds').optional(),
  customDuration: Joi.number()
    .integer()
    .min(5)
    .max(3600)
    .optional()
    .when('targetDuration', {
      is: 'custom',
      then: Joi.required()
    }),
  
  creatorStyleNotes: Joi.string()
    .max(2000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Creator style notes cannot exceed 2000 characters'
    }),
  
  tags: Joi.array()
    .items(
      Joi.string()
        .max(30)
        .pattern(/^[a-zA-Z0-9_-]+$/)
    )
    .max(10)
    .unique()
    .optional()
});

// ============================================
// SCRIPT RETRIEVAL SCHEMAS
// ============================================

/**
 * Get Scripts Query Schema
 * GET /api/scripts
 */
const getScriptsQuerySchema = Joi.object({
  status: Joi.alternatives()
    .try(
      scriptStatusSchema,
      Joi.string().valid('all')
    )
    .optional()
    .messages({
      'any.only': 'Invalid status filter'
    }),
  
  platform: Joi.alternatives()
    .try(
      platformSchema,
      Joi.string().valid('all')
    )
    .optional()
    .messages({
      'any.only': 'Invalid platform filter'
    }),
  
  inputType: Joi.alternatives()
    .try(
      inputTypeSchema,
      Joi.string().valid('all')
    )
    .optional()
    .messages({
      'any.only': 'Invalid input type filter'
    }),
  
  page: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(1)
    .optional()
    .messages({
      'number.min': 'Page number must be at least 1',
      'number.max': 'Page number cannot exceed 1000',
      'number.integer': 'Page must be an integer'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .optional()
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100 items per page',
      'number.integer': 'Limit must be an integer'
    }),
  
  sortBy: Joi.string()
    .valid('createdAt', 'updatedAt', 'title', 'status', 'platform', 'estimatedDuration', 'complexityScore')
    .default('createdAt')
    .optional()
    .messages({
      'any.only': 'Invalid sort field'
    }),
  
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .optional()
    .messages({
      'any.only': 'Sort order must be either asc or desc'
    }),
  
  search: Joi.string()
    .min(2)
    .max(100)
    .allow('')
    .optional()
    .messages({
      'string.min': 'Search query must be at least 2 characters',
      'string.max': 'Search query cannot exceed 100 characters'
    }),
  
  dateFrom: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'Date must be in ISO format (YYYY-MM-DD)'
    }),
  
  dateTo: Joi.date()
    .iso()
    .min(Joi.ref('dateFrom'))
    .optional()
    .messages({
      'date.format': 'Date must be in ISO format (YYYY-MM-DD)',
      'date.min': 'End date must be after start date'
    })
});

/**
 * Script ID Parameter Schema
 * Used in /:scriptId routes
 */
const scriptIdParamSchema = Joi.object({
  scriptId: objectIdSchema.required()
});

/**
 * Status Parameter Schema
 * Used in /status/:status routes
 */
const statusParamSchema = Joi.object({
  status: scriptStatusSchema.required()
});

/**
 * Export Script Schema
 * GET /api/scripts/:scriptId/export
 */
const exportScriptSchema = Joi.object({
  scriptId: objectIdSchema.required(),
  format: Joi.string()
    .valid('json', 'text')
    .default('json')
    .optional()
    .messages({
      'any.only': 'Export format must be either json or text'
    })
});

// ============================================
// SCRIPT UPDATE SCHEMAS
// ============================================

/**
 * Update Script Schema
 * PATCH /api/scripts/:scriptId
 */
const updateScriptSchema = Joi.object({
  title: Joi.string()
    .min(3)
    .max(200)
    .trim()
    .optional()
    .messages({
      'string.min': 'Script title must be at least 3 characters long',
      'string.max': 'Script title cannot exceed 200 characters'
    }),
  
  creatorStyleNotes: Joi.string()
    .max(2000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Creator style notes cannot exceed 2000 characters'
    }),
  
  tags: Joi.array()
    .items(
      Joi.string()
        .max(30)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .messages({
          'string.max': 'Tag cannot exceed 30 characters',
          'string.pattern.base': 'Tags can only contain letters, numbers, hyphens, and underscores'
        })
    )
    .max(10)
    .unique()
    .optional()
    .messages({
      'array.max': 'Cannot have more than 10 tags',
      'array.unique': 'Tags must be unique'
    }),
  
  status: scriptStatusSchema.optional(),
  
  creatorNotes: Joi.string()
    .max(2000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Creator notes cannot exceed 2000 characters'
    }),
  
  granularityLevel: granularitySchema.optional(),
  
  targetDuration: durationSchema.optional(),
  
  customDuration: Joi.number()
    .integer()
    .min(5)
    .max(3600)
    .optional()
    .messages({
      'number.min': 'Custom duration must be at least 5 seconds',
      'number.max': 'Custom duration cannot exceed 1 hour',
      'number.integer': 'Custom duration must be a whole number'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

/**
 * Update Status Schema
 * PATCH /api/scripts/:scriptId/status
 */
const updateStatusSchema = Joi.object({
  status: scriptStatusSchema.required(),
  
  reason: Joi.string()
    .max(300)
    .optional()
    .messages({
      'string.max': 'Status change reason cannot exceed 300 characters'
    }),
    
  oldStatus: Joi.string()
    .optional()
});

/**
 * Update Notes Schema
 * PATCH /api/scripts/:scriptId/notes
 */
const updateNotesSchema = Joi.object({
  notes: Joi.string()
    .max(2000)
    .allow('')
    .required()
    .messages({
      'string.max': 'Creator notes cannot exceed 2000 characters',
      'any.required': 'Notes field is required'
    })
});

/**
 * Update Tags Schema
 * PATCH /api/scripts/:scriptId/tags
 */
const updateTagsSchema = Joi.object({
  tags: Joi.array()
    .items(
      Joi.string()
        .max(30)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .messages({
          'string.max': 'Tag cannot exceed 30 characters',
          'string.pattern.base': 'Tags can only contain letters, numbers, hyphens, and underscores'
        })
    )
    .max(10)
    .unique()
    .required()
    .messages({
      'array.max': 'Cannot have more than 10 tags',
      'array.unique': 'Tags must be unique',
      'any.required': 'Tags array is required'
    })
});

/**
 * Bulk Update Schema
 * PATCH /api/scripts/bulk-update
 */
const bulkUpdateSchema = Joi.object({
  scriptIds: Joi.array()
    .items(objectIdSchema)
    .min(1)
    .max(50)
    .unique()
    .required()
    .messages({
      'array.min': 'At least one script ID is required',
      'array.max': 'Cannot update more than 50 scripts at once',
      'array.unique': 'Script IDs must be unique',
      'any.required': 'Script IDs array is required'
    }),
  
  updateData: Joi.object({
    status: scriptStatusSchema.optional(),
    
    tags: Joi.array()
      .items(
        Joi.string()
          .max(30)
          .pattern(/^[a-zA-Z0-9_-]+$/)
      )
      .max(10)
      .unique()
      .optional(),
    
    creatorNotes: Joi.string()
      .max(2000)
      .allow('')
      .optional(),
      
    granularityLevel: granularitySchema.optional()
  }).min(1).required().messages({
    'object.min': 'At least one field must be provided for bulk update',
    'any.required': 'Update data is required'
  })
});

// ============================================
// AI PROCESSING SCHEMAS
// ============================================

/**
 * Create Variation Schema
 * POST /api/scripts/:scriptId/variations
 */
const createVariationSchema = Joi.object({
  type: variationTypeSchema.required(),
  
  title: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.min': 'Variation title must be at least 3 characters long',
      'string.max': 'Variation title cannot exceed 100 characters',
      'any.required': 'Variation title is required'
    }),
  
  description: Joi.string()
    .min(10)
    .max(300)
    .required()
    .messages({
      'string.min': 'Variation description must be at least 10 characters long',
      'string.max': 'Variation description cannot exceed 300 characters',
      'any.required': 'Variation description is required'
    }),
  
  changes: Joi.object()
    .required()
    .messages({
      'any.required': 'Variation changes object is required'
    })
}).custom((value, helpers) => {
  // Validate changes object based on variation type
  const { type, changes } = value;
  
  switch (type) {
    case 'hook_variation':
      if (!changes.hook || typeof changes.hook.text !== 'string') {
        return helpers.error('any.invalid', { 
          message: 'Hook variation must include changes.hook.text' 
        });
      }
      break;
      
    case 'cta_variation':
      if (!changes.callToAction || typeof changes.callToAction.primary !== 'string') {
        return helpers.error('any.invalid', { 
          message: 'CTA variation must include changes.callToAction.primary' 
        });
      }
      break;
      
    case 'scene_order':
      if (!changes.scenes || !Array.isArray(changes.scenes)) {
        return helpers.error('any.invalid', { 
          message: 'Scene order variation must include changes.scenes array' 
        });
      }
      break;
  }
  
  return value;
});

// ============================================
// DEAL CONNECTION SCHEMAS
// ============================================

/**
 * Link Deal Parameter Schema
 * Used in /:scriptId/link-deal/:dealId routes
 */
const linkDealParamSchema = Joi.object({
  scriptId: objectIdSchema.required(),
  dealId: objectIdSchema.required()
});

// ============================================
// SEARCH SCHEMAS
// ============================================

/**
 * Search Scripts Schema
 * POST /api/scripts/search
 */
const searchScriptsSchema = Joi.object({
  query: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Search query must be at least 2 characters',
      'string.max': 'Search query cannot exceed 100 characters',
      'any.required': 'Search query is required'
    }),
  
  filters: Joi.object({
    status: Joi.array()
      .items(scriptStatusSchema)
      .unique()
      .optional()
      .messages({
        'array.unique': 'Status filters must be unique'
      }),
    
    platform: Joi.array()
      .items(platformSchema)
      .unique()
      .optional()
      .messages({
        'array.unique': 'Platform filters must be unique'
      }),
    
    inputType: Joi.array()
      .items(inputTypeSchema)
      .unique()
      .optional()
      .messages({
        'array.unique': 'Input type filters must be unique'
      }),
    
    granularityLevel: Joi.array()
      .items(granularitySchema)
      .unique()
      .optional()
      .messages({
        'array.unique': 'Granularity filters must be unique'
      }),
    
    durationRange: Joi.object({
      min: Joi.number().integer().min(5).max(3600).optional(),
      max: Joi.number().integer().min(Joi.ref('min')).max(3600).optional()
    }).optional(),
    
    complexityRange: Joi.object({
      min: Joi.number().integer().min(0).max(100).optional(),
      max: Joi.number().integer().min(Joi.ref('min')).max(100).optional()
    }).optional(),
    
    dateRange: Joi.object({
      from: Joi.date().iso().optional(),
      to: Joi.date().iso().min(Joi.ref('from')).optional()
    }).optional(),
    
    tags: Joi.array()
      .items(
        Joi.string()
          .max(30)
          .pattern(/^[a-zA-Z0-9_-]+$/)
      )
      .unique()
      .optional()
      .messages({
        'array.unique': 'Tag filters must be unique'
      }),
    
    dealLinked: Joi.boolean().optional(),
    
    brandName: Joi.string()
      .max(100)
      .optional()
      .messages({
        'string.max': 'Brand name filter cannot exceed 100 characters'
      })
  }).optional(),
  
  page: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(1)
    .optional(),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .optional(),
  
  sortBy: Joi.string()
    .valid('relevance', 'createdAt', 'updatedAt', 'title', 'complexityScore', 'estimatedDuration')
    .default('relevance')
    .optional(),
  
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .optional()
});

// ============================================
// FILE UPLOAD VALIDATION
// ============================================

/**
 * File Upload Validation Schema
 * Used in multer middleware
 */
const fileUploadSchema = Joi.object({
  originalname: Joi.string()
    .required()
    .messages({
      'any.required': 'Original filename is required'
    }),
  
  mimetype: Joi.string()
    .valid(
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    )
    .required()
    .messages({
      'any.only': 'Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed',
      'any.required': 'File type is required'
    }),
  
  size: Joi.number()
    .max(50 * 1024 * 1024) // 50MB max (will be checked against subscription limits)
    .required()
    .messages({
      'number.max': 'File size cannot exceed 50MB',
      'any.required': 'File size is required'
    })
});

/**
 * Video Upload Validation Schema
 * Used in video upload middleware
 */
const videoUploadSchema = Joi.object({
  originalname: Joi.string()
    .required()
    .messages({
      'any.required': 'Original filename is required'
    }),
  
  mimetype: Joi.string()
    .valid(
      'video/mp4',
      'video/mov',
      'video/avi',
      'video/quicktime',
      'video/x-msvideo'
    )
    .required()
    .messages({
      'any.only': 'Invalid video type. Only MP4, MOV, and AVI files are allowed',
      'any.required': 'Video type is required'
    }),
  
  size: Joi.number()
    .max(200 * 1024 * 1024) // 200MB max (will be checked against subscription limits)
    .required()
    .messages({
      'number.max': 'Video size cannot exceed 200MB',
      'any.required': 'Video size is required'
    })
});

// ============================================
// CUSTOM VALIDATION FUNCTIONS
// ============================================

/**
 * Validate platform-specific constraints
 * @param {Object} value - Input object
 * @param {String} platform - Platform type
 * @returns {Boolean} Valid or not
 */
const validatePlatformConstraints = (value, platform) => {
  const constraints = {
    'instagram_story': {
      maxDuration: 15,
      requiredAspectRatio: '9:16'
    },
    'instagram_reel': {
      maxDuration: 90,
      requiredAspectRatio: '9:16'
    },
    'youtube_shorts': {
      maxDuration: 60,
      requiredAspectRatio: '9:16'
    },
    'youtube_video': {
      maxDuration: 3600,
      requiredAspectRatio: '16:9'
    },
    'linkedin_video': {
      maxDuration: 600,
      requiredAspectRatio: '16:9'
    }
  };
  
  const platformConstraints = constraints[platform];
  if (!platformConstraints) return true;
  
  // Validate duration if custom duration is provided
  if (value.customDuration && value.customDuration > platformConstraints.maxDuration) {
    return false;
  }
  
  return true;
};

/**
 * Validate subscription tier feature access
 * @param {String} tier - Subscription tier
 * @param {String} feature - Feature being accessed
 * @returns {Boolean} Has access or not
 */
const validateFeatureAccess = (tier, feature) => {
  const tierFeatures = {
    starter: ['basic_creation', 'text_input', 'file_upload'],
    pro: ['basic_creation', 'text_input', 'file_upload', 'video_transcription', 'ab_testing', 'trends'],
    elite: ['all_features'],
    agency_starter: ['all_features', 'bulk_operations'],
    agency_pro: ['all_features', 'bulk_operations', 'advanced_features']
  };
  
  const userFeatures = tierFeatures[tier] || tierFeatures.starter;
  return userFeatures.includes(feature) || userFeatures.includes('all_features');
};

/**
 * Clean and sanitize text input
 * @param {String} text - Raw text input
 * @returns {String} Sanitized text
 */
const sanitizeTextInput = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .trim();
};

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Custom Joi extension for text sanitization
 */
const sanitizeExtension = {
  type: 'string',
  base: Joi.string(),
  messages: {
    'string.sanitized': 'Text has been sanitized'
  },
  rules: {
    sanitize: {
      method() {
        return this.$_addRule({ name: 'sanitize' });
      },
      validate(value, helpers) {
        return sanitizeTextInput(value);
      }
    }
  }
};

// Extend Joi with sanitization
const ExtendedJoi = Joi.extend(sanitizeExtension);

// ============================================
// EXPORT ALL SCHEMAS
// ============================================

module.exports = {
  // Script creation schemas
  createTextScriptSchema,
  createFileScriptSchema,
  createVideoScriptSchema,
  
  // Script retrieval schemas
  getScriptsQuerySchema,
  scriptIdParamSchema,
  statusParamSchema,
  exportScriptSchema,
  
  // Script update schemas
  updateScriptSchema,
  updateStatusSchema,
  updateNotesSchema,
  updateTagsSchema,
  bulkUpdateSchema,
  
  // AI processing schemas
  createVariationSchema,
  
  // Deal connection schemas
  linkDealParamSchema,
  
  // Search schemas
  searchScriptsSchema,
  
  // File upload schemas
  fileUploadSchema,
  videoUploadSchema,
  
  // Reusable component schemas
  objectIdSchema,
  subscriptionTierSchema,
  scriptStatusSchema,
  inputTypeSchema,
  platformSchema,
  granularitySchema,
  durationSchema,
  variationTypeSchema,
  
  // Validation helpers
  validatePlatformConstraints,
  validateFeatureAccess,
  sanitizeTextInput,
  ExtendedJoi
};