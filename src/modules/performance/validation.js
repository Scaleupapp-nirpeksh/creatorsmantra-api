/**
 * CreatorsMantra Backend - Performance Vault Validation
 * Joi validation schemas for campaign analytics, file uploads, and reporting
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Performance tracking validation with Indian compliance and subscription awareness
 * 
 * File Path: src/modules/performance/validation.js
 */

const Joi = require('joi');
const mongoose = require('mongoose');

// ============================================
// CUSTOM VALIDATION HELPERS
// ============================================

/**
 * Custom MongoDB ObjectId validator
 */
const objectIdValidator = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

/**
 * Custom date validator for campaign periods
 */
const campaignDateValidator = (value, helpers) => {
  const date = new Date(value);
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  
  if (date < oneYearAgo || date > oneYearFromNow) {
    return helpers.error('date.range', { 
      message: 'Campaign date must be within one year from today' 
    });
  }
  return value;
};

/**
 * Custom INR amount validator
 */
const inrAmountValidator = (value, helpers) => {
  if (value < 100) {
    return helpers.error('number.min', { message: 'Amount must be at least ₹100' });
  }
  if (value > 10000000) { // 1 Crore limit
    return helpers.error('number.max', { message: 'Amount cannot exceed ₹1,00,00,000' });
  }
  return value;
};

/**
 * Custom color hex validator
 */
const colorHexValidator = (value, helpers) => {
  const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (!hexPattern.test(value)) {
    return helpers.error('string.pattern.base', { 
      message: 'Color must be a valid hex code (e.g., #8B5CF6)' 
    });
  }
  return value;
};

// ============================================
// REUSABLE FIELD SCHEMAS
// ============================================

// MongoDB ObjectId schema
const objectIdSchema = Joi.string()
  .custom(objectIdValidator, 'ObjectId validation')
  .messages({
    'any.invalid': 'Invalid ID format'
  });

// Campaign name schema
const campaignNameSchema = Joi.string()
  .trim()
  .min(3)
  .max(200)
  .pattern(/^[a-zA-Z0-9\s\-_&.,!()]+$/)
  .required()
  .messages({
    'string.min': 'Campaign name must be at least 3 characters long',
    'string.max': 'Campaign name cannot exceed 200 characters',
    'string.pattern.base': 'Campaign name contains invalid characters',
    'any.required': 'Campaign name is required'
  });

// Brand name schema
const brandNameSchema = Joi.string()
  .trim()
  .min(2)
  .max(100)
  .pattern(/^[a-zA-Z0-9\s\-_&.,!()]+$/)
  .required()
  .messages({
    'string.min': 'Brand name must be at least 2 characters long',
    'string.max': 'Brand name cannot exceed 100 characters',
    'string.pattern.base': 'Brand name contains invalid characters',
    'any.required': 'Brand name is required'
  });

// Platform schema
const platformSchema = Joi.string()
  .valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'other')
  .required()
  .messages({
    'any.only': 'Platform must be one of: instagram, youtube, linkedin, twitter, facebook, other',
    'any.required': 'Platform is required'
  });

// Campaign status schema
const campaignStatusSchema = Joi.string()
  .valid('draft', 'active', 'completed', 'archived')
  .messages({
    'any.only': 'Status must be one of: draft, active, completed, archived'
  });

// Deliverable type schema
const deliverableTypeSchema = Joi.string()
  .valid('post', 'reel', 'story', 'video', 'blog', 'tweet', 'other')
  .messages({
    'any.only': 'Deliverable type must be one of: post, reel, story, video, blog, tweet, other'
  });

// Date schema for campaigns
const campaignDateSchema = Joi.date()
  .custom(campaignDateValidator, 'Campaign date validation')
  .messages({
    'date.base': 'Invalid date format',
    'date.range': 'Campaign date must be within one year from today'
  });

// INR amount schema
const inrAmountSchema = Joi.number()
  .positive()
  .precision(2)
  .custom(inrAmountValidator, 'INR amount validation')
  .messages({
    'number.base': 'Amount must be a number',
    'number.positive': 'Amount must be positive',
    'number.precision': 'Amount can have maximum 2 decimal places'
  });

// Performance metrics schema
const performanceMetricsSchema = Joi.object({
  impressions: Joi.number().integer().min(0).max(1000000000).default(0),
  reach: Joi.number().integer().min(0).max(1000000000).default(0),
  likes: Joi.number().integer().min(0).max(100000000).default(0),
  comments: Joi.number().integer().min(0).max(10000000).default(0),
  shares: Joi.number().integer().min(0).max(10000000).default(0),
  saves: Joi.number().integer().min(0).max(10000000).default(0),
  clicks: Joi.number().integer().min(0).max(10000000).default(0),
  websiteClicks: Joi.number().integer().min(0).max(1000000).default(0),
  profileVisits: Joi.number().integer().min(0).max(1000000).default(0),
  views: Joi.number().integer().min(0).max(1000000000).default(0),
  watchTime: Joi.number().min(0).max(1000000).default(0), // minutes
  avgViewDuration: Joi.number().min(0).max(7200).default(0), // seconds
  platformSpecific: Joi.object().default({})
}).messages({
  'number.base': '{#label} must be a number',
  'number.integer': '{#label} must be a whole number',
  'number.min': '{#label} cannot be negative',
  'number.max': '{#label} value is too large'
});

// Color hex schema
const colorHexSchema = Joi.string()
  .custom(colorHexValidator, 'Color hex validation')
  .messages({
    'string.pattern.base': 'Color must be a valid hex code (e.g., #8B5CF6)'
  });

// ============================================
// PARAMETER VALIDATION SCHEMAS
// ============================================

// Campaign ID parameter
const campaignIdParamSchema = Joi.object({
  campaignId: objectIdSchema.required().messages({
    'any.required': 'Campaign ID is required'
  })
});

// Screenshot ID parameter
const screenshotIdParamSchema = Joi.object({
  screenshotId: objectIdSchema.required().messages({
    'any.required': 'Screenshot ID is required'
  })
});

// Report ID parameter
const reportIdParamSchema = Joi.object({
  reportId: objectIdSchema.required().messages({
    'any.required': 'Report ID is required'
  })
});

// ============================================
// CAMPAIGN MANAGEMENT SCHEMAS
// ============================================

// Create campaign schema
const createCampaignSchema = Joi.object({
  campaignName: campaignNameSchema,
  brandName: brandNameSchema,
  platform: platformSchema,
  
  dealId: objectIdSchema.optional().messages({
    'string.empty': 'Deal ID cannot be empty if provided'
  }),
  
  campaignPeriod: Joi.object({
    startDate: campaignDateSchema.required().messages({
      'any.required': 'Campaign start date is required'
    }),
    endDate: campaignDateSchema.required().messages({
      'any.required': 'Campaign end date is required'
    })
  }).required().custom((value, helpers) => {
    if (new Date(value.endDate) <= new Date(value.startDate)) {
      return helpers.error('object.custom', {
        message: 'End date must be after start date'
      });
    }
    
    const duration = Math.ceil((new Date(value.endDate) - new Date(value.startDate)) / (1000 * 60 * 60 * 24));
    if (duration > 365) {
      return helpers.error('object.custom', {
        message: 'Campaign duration cannot exceed 365 days'
      });
    }
    
    return value;
  }).messages({
    'any.required': 'Campaign period is required',
    'object.custom': '{#message}'
  }),
  
  deliverables: Joi.array().items(
    Joi.object({
      type: deliverableTypeSchema.required(),
      count: Joi.number().integer().min(1).max(100).required().messages({
        'number.base': 'Deliverable count must be a number',
        'number.integer': 'Deliverable count must be a whole number',
        'number.min': 'At least 1 deliverable is required',
        'number.max': 'Maximum 100 deliverables allowed per type',
        'any.required': 'Deliverable count is required'
      }),
      description: Joi.string().max(500).trim().optional().messages({
        'string.max': 'Deliverable description cannot exceed 500 characters'
      })
    })
  ).min(1).max(20).required().messages({
    'array.min': 'At least one deliverable is required',
    'array.max': 'Maximum 20 deliverable types allowed',
    'any.required': 'Deliverables are required'
  }),
  
  campaignValue: Joi.object({
    amount: inrAmountSchema.required().messages({
      'any.required': 'Campaign amount is required'
    }),
    currency: Joi.string().valid('INR').default('INR').messages({
      'any.only': 'Currency must be INR'
    }),
    paymentStatus: Joi.string().valid('pending', 'partial', 'paid').default('pending').messages({
      'any.only': 'Payment status must be pending, partial, or paid'
    })
  }).required().messages({
    'any.required': 'Campaign value is required'
  }),
  
  performanceMetrics: performanceMetricsSchema.optional(),
  
  tags: Joi.array().items(
    Joi.string().trim().min(1).max(50).pattern(/^[a-zA-Z0-9\s\-_]+$/).messages({
      'string.min': 'Tag must be at least 1 character',
      'string.max': 'Tag cannot exceed 50 characters',
      'string.pattern.base': 'Tag contains invalid characters'
    })
  ).max(10).unique().messages({
    'array.max': 'Maximum 10 tags allowed',
    'array.unique': 'Tags must be unique'
  }),
  
  notes: Joi.string().max(2000).trim().optional().messages({
    'string.max': 'Notes cannot exceed 2000 characters'
  }),
  
  status: campaignStatusSchema.default('draft')
});

// Update campaign schema
const updateCampaignSchema = Joi.object({
  campaignName: campaignNameSchema.optional(),
  brandName: brandNameSchema.optional(),
  platform: platformSchema.optional(),
  
  campaignPeriod: Joi.object({
    startDate: campaignDateSchema.optional(),
    endDate: campaignDateSchema.optional()
  }).optional().custom((value, helpers) => {
    if (value && value.startDate && value.endDate) {
      if (new Date(value.endDate) <= new Date(value.startDate)) {
        return helpers.error('object.custom', {
          message: 'End date must be after start date'
        });
      }
    }
    return value;
  }),
  
  deliverables: Joi.array().items(
    Joi.object({
      type: deliverableTypeSchema.required(),
      count: Joi.number().integer().min(1).max(100).required(),
      description: Joi.string().max(500).trim().optional()
    })
  ).min(1).max(20).optional(),
  
  campaignValue: Joi.object({
    amount: inrAmountSchema.optional(),
    paymentStatus: Joi.string().valid('pending', 'partial', 'paid').optional()
  }).optional(),
  
  performanceMetrics: performanceMetricsSchema.optional(),
  
  tags: Joi.array().items(
    Joi.string().trim().min(1).max(50).pattern(/^[a-zA-Z0-9\s\-_]+$/)
  ).max(10).unique().optional(),
  
  notes: Joi.string().max(2000).trim().optional(),
  
  status: campaignStatusSchema.optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Get campaigns query schema
const getCampaignsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(1000).default(1).messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be a whole number',
    'number.min': 'Page must be at least 1',
    'number.max': 'Page cannot exceed 1000'
  }),
  
  limit: Joi.number().integer().min(1).max(100).default(25).messages({
    'number.base': 'Limit must be a number',
    'number.integer': 'Limit must be a whole number',
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100'
  }),
  
  status: campaignStatusSchema.optional(),
  platform: platformSchema.optional(),
  
  brandName: Joi.string().trim().min(1).max(100).optional().messages({
    'string.min': 'Brand name filter must be at least 1 character',
    'string.max': 'Brand name filter cannot exceed 100 characters'
  }),
  
  dateFrom: Joi.date().iso().optional().messages({
    'date.base': 'Date from must be a valid date',
    'date.format': 'Date from must be in ISO format'
  }),
  
  dateTo: Joi.date().iso().optional().messages({
    'date.base': 'Date to must be a valid date',
    'date.format': 'Date to must be in ISO format'
  }),
  
  sortBy: Joi.string().valid(
    'createdAt', 'updatedAt', 'campaignName', 'brandName', 
    'campaignValue.amount', 'campaignPeriod.startDate', 'campaignPeriod.endDate'
  ).default('createdAt').messages({
    'any.only': 'Sort field must be one of: createdAt, updatedAt, campaignName, brandName, campaignValue.amount, campaignPeriod.startDate, campaignPeriod.endDate'
  }),
  
  sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
    'any.only': 'Sort order must be asc or desc'
  })
}).custom((value, helpers) => {
  if (value.dateFrom && value.dateTo && new Date(value.dateTo) < new Date(value.dateFrom)) {
    return helpers.error('object.custom', {
      message: 'Date to must be after date from'
    });
  }
  return value;
});

// Bulk update campaigns schema
const bulkUpdateCampaignsSchema = Joi.object({
  campaignIds: Joi.array().items(objectIdSchema).min(1).max(50).unique().required().messages({
    'array.base': 'Campaign IDs must be an array',
    'array.min': 'At least one campaign ID is required',
    'array.max': 'Maximum 50 campaigns can be updated at once',
    'array.unique': 'Campaign IDs must be unique',
    'any.required': 'Campaign IDs are required'
  }),
  
  updateData: Joi.object({
    status: campaignStatusSchema.optional(),
    tags: Joi.array().items(
      Joi.string().trim().min(1).max(50).pattern(/^[a-zA-Z0-9\s\-_]+$/)
    ).max(10).unique().optional(),
    notes: Joi.string().max(2000).trim().optional()
  }).min(1).required().messages({
    'object.min': 'At least one field must be provided for update',
    'any.required': 'Update data is required'
  })
});

// ============================================
// REPORT GENERATION SCHEMAS
// ============================================

// Generate report schema
const generateReportSchema = Joi.object({
  template: Joi.string().valid('minimal', 'professional', 'detailed', 'branded', 'white_label').default('professional').messages({
    'any.only': 'Template must be one of: minimal, professional, detailed, branded, white_label'
  }),
  
  branding: Joi.object({
    logoUrl: Joi.string().uri().optional().messages({
      'string.uri': 'Logo URL must be a valid URI'
    }),
    primaryColor: colorHexSchema.optional(),
    secondaryColor: colorHexSchema.optional(),
    accentColor: colorHexSchema.optional(),
    fontFamily: Joi.string().valid('Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat').optional().messages({
      'any.only': 'Font family must be one of: Inter, Roboto, Open Sans, Lato, Montserrat'
    }),
    brandName: Joi.string().trim().min(1).max(100).optional().messages({
      'string.min': 'Brand name must be at least 1 character',
      'string.max': 'Brand name cannot exceed 100 characters'
    })
  }).optional(),
  
  includeComparison: Joi.boolean().default(true),
  includeBenchmarks: Joi.boolean().default(true),
  includeRecommendations: Joi.boolean().default(true),
  watermark: Joi.boolean().default(true)
});

// Get reports query schema
const getReportsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(1000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  
  reportType: Joi.string().valid('campaign_summary', 'performance_analysis', 'client_report', 'comparison_report').optional().messages({
    'any.only': 'Report type must be one of: campaign_summary, performance_analysis, client_report, comparison_report'
  }),
  
  template: Joi.string().valid('minimal', 'professional', 'detailed', 'branded', 'white_label').optional(),
  
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional()
});

// Bulk generate reports schema
const bulkGenerateReportsSchema = Joi.object({
  campaignIds: Joi.array().items(objectIdSchema).min(1).max(10).unique().required().messages({
    'array.min': 'At least one campaign ID is required',
    'array.max': 'Maximum 10 reports can be generated at once',
    'array.unique': 'Campaign IDs must be unique',
    'any.required': 'Campaign IDs are required'
  }),
  
  reportConfig: generateReportSchema.optional()
});

// ============================================
// ANALYTICS & DASHBOARD SCHEMAS
// ============================================

// Analytics query schema
const analyticsQuerySchema = Joi.object({
  period: Joi.string().valid('7d', '30d', '90d', '1y').default('30d').messages({
    'any.only': 'Period must be one of: 7d, 30d, 90d, 1y'
  }),
  
  platform: platformSchema.optional(),
  status: campaignStatusSchema.optional(),
  
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional()
}).custom((value, helpers) => {
  if (value.dateFrom && value.dateTo && new Date(value.dateTo) < new Date(value.dateFrom)) {
    return helpers.error('object.custom', {
      message: 'Date to must be after date from'
    });
  }
  return value;
});

// Top campaigns query schema
const topCampaignsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(5).messages({
    'number.base': 'Limit must be a number',
    'number.integer': 'Limit must be a whole number',
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 50'
  }),
  
  sortBy: Joi.string().valid('performanceScore', 'impressions', 'engagementRate', 'campaignValue').default('performanceScore').messages({
    'any.only': 'Sort by must be one of: performanceScore, impressions, engagementRate, campaignValue'
  }),
  
  platform: platformSchema.optional(),
  
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional()
});

// ============================================
// SETTINGS & CONFIGURATION SCHEMAS
// ============================================

// Update settings schema
const updateSettingsSchema = Joi.object({
  branding: Joi.object({
    logoUrl: Joi.string().uri().optional(),
    primaryColor: colorHexSchema.optional(),
    secondaryColor: colorHexSchema.optional(),
    accentColor: colorHexSchema.optional(),
    fontFamily: Joi.string().valid('Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat').optional(),
    brandName: Joi.string().trim().min(1).max(100).optional()
  }).optional(),
  
  reportSettings: Joi.object({
    defaultTemplate: Joi.string().valid('minimal', 'professional', 'detailed', 'branded', 'white_label').optional(),
    includeComparison: Joi.boolean().optional(),
    includeBenchmarks: Joi.boolean().optional(),
    includeRecommendations: Joi.boolean().optional(),
    watermark: Joi.boolean().optional()
  }).optional(),
  
  aiSettings: Joi.object({
    summaryTone: Joi.string().valid('professional', 'casual', 'detailed', 'concise').optional().messages({
      'any.only': 'Summary tone must be one of: professional, casual, detailed, concise'
    }),
    includeInsights: Joi.boolean().optional(),
    includeRecommendations: Joi.boolean().optional(),
    benchmarkComparison: Joi.boolean().optional()
  }).optional(),
  
  notifications: Joi.object({
    campaignAnalysisComplete: Joi.boolean().optional(),
    reportGenerated: Joi.boolean().optional(),
    weeklyInsights: Joi.boolean().optional(),
    monthlyReport: Joi.boolean().optional()
  }).optional()
}).min(1).messages({
  'object.min': 'At least one setting must be provided for update'
});

// Update branding schema
const updateBrandingSchema = Joi.object({
  logoUrl: Joi.string().uri().optional().messages({
    'string.uri': 'Logo URL must be a valid URI'
  }),
  primaryColor: colorHexSchema.optional(),
  secondaryColor: colorHexSchema.optional(),
  accentColor: colorHexSchema.optional(),
  fontFamily: Joi.string().valid('Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat').optional().messages({
    'any.only': 'Font family must be one of: Inter, Roboto, Open Sans, Lato, Montserrat'
  }),
  brandName: Joi.string().trim().min(1).max(100).optional().messages({
    'string.min': 'Brand name must be at least 1 character',
    'string.max': 'Brand name cannot exceed 100 characters'
  })
}).min(1).messages({
  'object.min': 'At least one branding field must be provided'
});

// ============================================
// EXPORT ALL SCHEMAS
// ============================================

module.exports = {
  // Parameter schemas
  campaignIdParamSchema,
  screenshotIdParamSchema,
  reportIdParamSchema,
  
  // Campaign management schemas
  createCampaignSchema,
  updateCampaignSchema,
  getCampaignsQuerySchema,
  bulkUpdateCampaignsSchema,
  
  // Report generation schemas
  generateReportSchema,
  getReportsQuerySchema,
  bulkGenerateReportsSchema,
  
  // Analytics schemas
  analyticsQuerySchema,
  topCampaignsQuerySchema,
  
  // Settings schemas
  updateSettingsSchema,
  updateBrandingSchema,
  
  // Reusable field schemas (for testing or other modules)
  objectIdSchema,
  campaignNameSchema,
  brandNameSchema,
  platformSchema,
  campaignStatusSchema,
  deliverableTypeSchema,
  campaignDateSchema,
  inrAmountSchema,
  performanceMetricsSchema,
  colorHexSchema,
  
  // Custom validators (exported for reuse)
  objectIdValidator,
  campaignDateValidator,
  inrAmountValidator,
  colorHexValidator
};