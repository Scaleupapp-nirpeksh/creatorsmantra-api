//src/modules/briefs/validation.js
/**
 * CreatorsMantra Backend - Brief Analyzer Validation
 * Joi validation schemas for brief management API endpoints
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Input validation for brief creation, updates, AI processing, and deal conversion
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

// Brief status validation
const briefStatusSchema = Joi.string()
  .valid('draft', 'analyzed', 'needs_clarification', 'ready_for_deal', 'converted', 'archived')
  .messages({
    'any.only': 'Invalid brief status. Must be one of: draft, analyzed, needs_clarification, ready_for_deal, converted, archived',
    'any.required': 'Brief status is required'
  });

// Input type validation
const inputTypeSchema = Joi.string()
  .valid('text_paste', 'file_upload')
  .messages({
    'any.only': 'Invalid input type. Must be either text_paste or file_upload',
    'any.required': 'Input type is required'
  });

// Deliverable type validation
const deliverableTypeSchema = Joi.string()
  .valid(
    'instagram_post', 'instagram_reel', 'instagram_story',
    'youtube_video', 'youtube_shorts',
    'linkedin_post', 'twitter_post', 'blog_post', 'other'
  )
  .messages({
    'any.only': 'Invalid deliverable type',
    'any.required': 'Deliverable type is required'
  });

// Platform validation
const platformSchema = Joi.string()
  .valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'tiktok', 'other')
  .messages({
    'any.only': 'Invalid platform',
    'any.required': 'Platform is required'
  });

// Risk level validation
const riskLevelSchema = Joi.string()
  .valid('low', 'medium', 'high')
  .messages({
    'any.only': 'Invalid risk level. Must be low, medium, or high',
    'any.required': 'Risk level is required'
  });

// Priority validation
const prioritySchema = Joi.string()
  .valid('low', 'medium', 'high', 'critical')
  .messages({
    'any.only': 'Invalid priority level',
    'any.required': 'Priority is required'
  });

// ============================================
// BRIEF CREATION SCHEMAS
// ============================================

/**
 * Create Text Brief Schema
 * POST /api/briefs/create-text
 */
const createTextBriefSchema = Joi.object({
  rawText: Joi.string()
    .min(50)
    .max(50000)
    .required()
    .messages({
      'string.min': 'Brief text must be at least 50 characters long',
      'string.max': 'Brief text cannot exceed 50,000 characters',
      'any.required': 'Brief text is required'
    }),
  
  notes: Joi.string()
    .max(2000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Creator notes cannot exceed 2000 characters'
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
});

// ============================================
// BRIEF RETRIEVAL SCHEMAS
// ============================================

/**
 * Get Briefs Query Schema
 * GET /api/briefs
 */
const getBriefsQuerySchema = Joi.object({
  status: briefStatusSchema.optional(),
  
  inputType: inputTypeSchema.optional(),
  
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
    .valid('createdAt', 'updatedAt', 'status', 'estimatedValue', 'completionPercentage', 'briefId')
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
    }),
  
  estimatedValueMin: Joi.number()
    .min(0)
    .max(10000000)
    .optional()
    .messages({
      'number.min': 'Minimum estimated value cannot be negative',
      'number.max': 'Minimum estimated value cannot exceed ₹1 Crore'
    }),
  
  estimatedValueMax: Joi.number()
    .min(Joi.ref('estimatedValueMin'))
    .max(10000000)
    .optional()
    .messages({
      'number.min': 'Maximum estimated value must be greater than minimum',
      'number.max': 'Maximum estimated value cannot exceed ₹1 Crore'
    })
});

/**
 * Brief ID Parameter Schema
 * Used in /:briefId routes
 */
const briefIdParamSchema = Joi.object({
  briefId: objectIdSchema.required()
});

/**
 * Status Parameter Schema
 * Used in /status/:status routes
 */
const statusParamSchema = Joi.object({
  status: briefStatusSchema.required()
});

// ============================================
// BRIEF UPDATE SCHEMAS
// ============================================

/**
 * Update Brief Schema
 * PATCH /api/briefs/:briefId
 */
const updateBriefSchema = Joi.object({
  creatorNotes: Joi.string()
    .max(2000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Creator notes cannot exceed 2000 characters'
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
  
  status: briefStatusSchema.optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

/**
 * Update Status Schema
 * PATCH /api/briefs/:briefId/status
 */
const updateStatusSchema = Joi.object({
  status: briefStatusSchema.required(),
  
  reason: Joi.string()
    .max(200)
    .optional()
    .messages({
      'string.max': 'Status change reason cannot exceed 200 characters'
    })
});

/**
 * Update Notes Schema
 * PATCH /api/briefs/:briefId/notes
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
 * PATCH /api/briefs/:briefId/tags
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
 * PATCH /api/briefs/bulk-update
 */
const bulkUpdateSchema = Joi.object({
  briefIds: Joi.array()
    .items(objectIdSchema)
    .min(1)
    .max(50)
    .unique()
    .required()
    .messages({
      'array.min': 'At least one brief ID is required',
      'array.max': 'Cannot update more than 50 briefs at once',
      'array.unique': 'Brief IDs must be unique',
      'any.required': 'Brief IDs array is required'
    }),
  
  updateData: Joi.object({
    status: briefStatusSchema.optional(),
    
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
      .optional()
  }).min(1).required().messages({
    'object.min': 'At least one field must be provided for bulk update',
    'any.required': 'Update data is required'
  })
});

// ============================================
// CLARIFICATION SCHEMAS
// ============================================

/**
 * Add Question Schema
 * POST /api/briefs/:briefId/clarifications
 */
const addQuestionSchema = Joi.object({
  question: Joi.string()
    .min(10)
    .max(300)
    .required()
    .messages({
      'string.min': 'Question must be at least 10 characters long',
      'string.max': 'Question cannot exceed 300 characters',
      'any.required': 'Question text is required'
    }),
  
  category: Joi.string()
    .valid(
      'budget', 'timeline', 'usage_rights', 'exclusivity', 
      'payment_terms', 'content_specs', 'brand_guidelines', 
      'contact_info', 'deliverables', 'approval_process', 'other'
    )
    .default('other')
    .optional()
    .messages({
      'any.only': 'Invalid question category'
    }),
  
  priority: prioritySchema.default('medium').optional()
});

/**
 * Clarification Parameter Schema
 * Used in /:briefId/clarifications/:questionId routes
 */
const clarificationParamSchema = Joi.object({
  briefId: objectIdSchema.required(),
  questionId: objectIdSchema.required()
});

/**
 * Answer Question Schema
 * PATCH /api/briefs/:briefId/clarifications/:questionId
 */
const answerQuestionSchema = Joi.object({
  answer: Joi.string()
    .min(5)
    .max(1000)
    .required()
    .messages({
      'string.min': 'Answer must be at least 5 characters long',
      'string.max': 'Answer cannot exceed 1000 characters',
      'any.required': 'Answer is required'
    })
});

// ============================================
// DEAL CONVERSION SCHEMAS
// ============================================

/**
 * Convert to Deal Schema
 * POST /api/briefs/:briefId/convert-to-deal
 */
const convertToDealSchema = Joi.object({
  // Override brand information
  brandName: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Brand name cannot exceed 100 characters'
    }),
  
  // Override campaign name
  campaignName: Joi.string()
    .max(200)
    .optional()
    .messages({
      'string.max': 'Campaign name cannot exceed 200 characters'
    }),
  
  // Override platform
  platform: platformSchema.optional(),
  
  // Override deal amount
  amount: Joi.number()
    .min(0)
    .max(10000000)
    .optional()
    .messages({
      'number.min': 'Deal amount cannot be negative',
      'number.max': 'Deal amount cannot exceed ₹1 Crore'
    }),
  
  // Tax settings override
  gstApplicable: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'GST applicable must be true or false'
    }),
  
  tdsApplicable: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'TDS applicable must be true or false'
    }),
  
  // Timeline override
  responseDeadline: Joi.date()
    .iso()
    .min('now')
    .optional()
    .messages({
      'date.format': 'Response deadline must be in ISO format',
      'date.min': 'Response deadline must be in the future'
    }),
  
  contentDeadline: Joi.date()
    .iso()
    .min('now')
    .optional()
    .messages({
      'date.format': 'Content deadline must be in ISO format',
      'date.min': 'Content deadline must be in the future'
    }),
  
  // Priority override
  priority: Joi.string()
    .valid('low', 'medium', 'high')
    .optional()
    .messages({
      'any.only': 'Priority must be low, medium, or high'
    }),
  
  // Additional notes for deal
  dealNotes: Joi.string()
    .max(1000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Deal notes cannot exceed 1000 characters'
    })
});

// ============================================
// SEARCH SCHEMAS
// ============================================

/**
 * Search Briefs Schema
 * POST /api/briefs/search
 */
const searchBriefsSchema = Joi.object({
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
      .items(briefStatusSchema)
      .unique()
      .optional()
      .messages({
        'array.unique': 'Status filters must be unique'
      }),
    
    inputType: Joi.array()
      .items(inputTypeSchema)
      .unique()
      .optional()
      .messages({
        'array.unique': 'Input type filters must be unique'
      }),
    
    platforms: Joi.array()
      .items(platformSchema)
      .unique()
      .optional()
      .messages({
        'array.unique': 'Platform filters must be unique'
      }),
    
    riskLevel: Joi.array()
      .items(riskLevelSchema)
      .unique()
      .optional()
      .messages({
        'array.unique': 'Risk level filters must be unique'
      }),
    
    estimatedValueRange: Joi.object({
      min: Joi.number().min(0).max(10000000).optional(),
      max: Joi.number().min(Joi.ref('min')).max(10000000).optional()
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
    .valid('relevance', 'createdAt', 'updatedAt', 'estimatedValue', 'completionPercentage')
    .default('relevance')
    .optional(),
  
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .optional()
});

// ============================================
// AI EXTRACTION SCHEMAS
// ============================================

/**
 * Manual AI Extraction Schema
 * POST /api/briefs/:briefId/extract
 */
const triggerExtractionSchema = Joi.object({
  forceReprocess: Joi.boolean()
    .default(false)
    .optional()
    .messages({
      'boolean.base': 'Force reprocess must be true or false'
    }),
  
  extractionOptions: Joi.object({
    includeRiskAssessment: Joi.boolean().default(true).optional(),
    includePricingSuggestions: Joi.boolean().default(true).optional(),
    includeTimelineAnalysis: Joi.boolean().default(true).optional(),
    confidenceThreshold: Joi.number().min(0).max(100).default(70).optional()
  }).optional()
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

// ============================================
// EXPORT ALL SCHEMAS
// ============================================

module.exports = {
  // Brief creation schemas
  createTextBriefSchema,
  
  // Brief retrieval schemas
  getBriefsQuerySchema,
  briefIdParamSchema,
  statusParamSchema,
  
  // Brief update schemas
  updateBriefSchema,
  updateStatusSchema,
  updateNotesSchema,
  updateTagsSchema,
  bulkUpdateSchema,
  
  // Clarification schemas
  addQuestionSchema,
  clarificationParamSchema,
  answerQuestionSchema,
  
  // Deal conversion schemas
  convertToDealSchema,
  
  // Search schemas
  searchBriefsSchema,
  
  // AI extraction schemas
  triggerExtractionSchema,
  
  // File upload schemas
  fileUploadSchema,
  
  // Reusable component schemas
  objectIdSchema,
  subscriptionTierSchema,
  briefStatusSchema,
  inputTypeSchema,
  deliverableTypeSchema,
  platformSchema,
  riskLevelSchema,
  prioritySchema
};