/**
 * CreatorsMantra Backend - Analytics Module
 * Joi validation schemas for analytics API endpoints and data integrity
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * 
 * File Path: src/modules/analytics/validation.js
 */

const Joi = require('joi');
const mongoose = require('mongoose');

// ============================================
// HELPER VALIDATION SCHEMAS
// ============================================

// ObjectId validation schema
const objectIdSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  })
  .messages({
    'any.invalid': 'Invalid ObjectId format'
  });

// Date validation schema with range limits
const dateSchema = Joi.date()
  .iso()
  .min('2020-01-01')
  .max('2030-12-31')
  .messages({
    'date.base': 'Date must be a valid ISO date',
    'date.format': 'Date must be in ISO format (YYYY-MM-DD)',
    'date.min': 'Date cannot be before 2020-01-01',
    'date.max': 'Date cannot be after 2030-12-31'
  });

// Period type validation
const periodTypeSchema = Joi.string()
  .valid('week', 'month', 'quarter', 'year')
  .default('month')
  .messages({
    'any.only': 'Period must be one of: week, month, quarter, year'
  });

// Metric type validation for trend analysis
const metricTypeSchema = Joi.string()
  .valid(
    'monthly_revenue',
    'deal_conversion_rate',
    'average_deal_value',
    'payment_velocity',
    'client_retention',
    'contract_risk_score',
    'engagement_rate',
    'platform_performance'
  )
  .messages({
    'any.only': 'Metric type must be one of: monthly_revenue, deal_conversion_rate, average_deal_value, payment_velocity, client_retention, contract_risk_score, engagement_rate, platform_performance'
  });

// Breakdown dimension validation
const dimensionSchema = Joi.string()
  .valid('platform', 'client_type', 'content_type', 'month', 'quarter', 'brand', 'deliverable')
  .messages({
    'any.only': 'Dimension must be one of: platform, client_type, content_type, month, quarter, brand, deliverable'
  });

// Insight type validation
const insightTypeSchema = Joi.string()
  .valid(
    'pricing_opportunity',
    'seasonal_trend',
    'risk_warning',
    'performance_optimization',
    'client_retention',
    'content_strategy',
    'revenue_forecast',
    'market_positioning'
  )
  .messages({
    'any.only': 'Insight type must be one of: pricing_opportunity, seasonal_trend, risk_warning, performance_optimization, client_retention, content_strategy, revenue_forecast, market_positioning'
  });

// Priority level validation
const prioritySchema = Joi.string()
  .valid('low', 'medium', 'high', 'critical')
  .messages({
    'any.only': 'Priority must be one of: low, medium, high, critical'
  });

// Status validation
const statusSchema = Joi.string()
  .valid('active', 'acknowledged', 'acted_upon', 'dismissed')
  .messages({
    'any.only': 'Status must be one of: active, acknowledged, acted_upon, dismissed'
  });

// Pagination validation
const paginationSchema = {
  page: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
      'number.max': 'Page cannot exceed 1000'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(25)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    })
};

// ============================================
// DASHBOARD ANALYTICS VALIDATION
// ============================================

// Dashboard query parameters
const dashboardQuerySchema = Joi.object({
  period: periodTypeSchema,
  
  forceRefresh: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Force refresh must be a boolean value'
    }),
  
  includeInsights: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include insights must be a boolean value'
    }),
  
  insightLimit: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(5)
    .messages({
      'number.base': 'Insight limit must be a number',
      'number.integer': 'Insight limit must be an integer',
      'number.min': 'Insight limit must be at least 1',
      'number.max': 'Insight limit cannot exceed 10'
    })
});

// Custom date range request body
const customRangeSchema = Joi.object({
  startDate: dateSchema.required().messages({
    'any.required': 'Start date is required for custom range analytics'
  }),
  
  endDate: dateSchema.required().messages({
    'any.required': 'End date is required for custom range analytics'
  }),
  
  includeComparison: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include comparison must be a boolean value'
    }),
  
  comparisonType: Joi.string()
    .valid('previous_period', 'year_over_year', 'custom')
    .default('previous_period')
    .messages({
      'any.only': 'Comparison type must be one of: previous_period, year_over_year, custom'
    }),
  
  customComparisonStart: dateSchema.when('comparisonType', {
    is: 'custom',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }).messages({
    'any.required': 'Custom comparison start date is required when comparison type is custom',
    'any.unknown': 'Custom comparison start date is only allowed when comparison type is custom'
  }),
  
  customComparisonEnd: dateSchema.when('comparisonType', {
    is: 'custom',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }).messages({
    'any.required': 'Custom comparison end date is required when comparison type is custom',
    'any.unknown': 'Custom comparison end date is only allowed when comparison type is custom'
  })
}).custom((value, helpers) => {
  // Validate date range
  if (new Date(value.startDate) >= new Date(value.endDate)) {
    return helpers.error('any.invalid', { message: 'Start date must be before end date' });
  }
  
  // Validate maximum range (1 year)
  const maxRange = 365 * 24 * 60 * 60 * 1000;
  if (new Date(value.endDate) - new Date(value.startDate) > maxRange) {
    return helpers.error('any.invalid', { message: 'Date range cannot exceed 1 year' });
  }
  
  // Validate custom comparison dates if provided
  if (value.comparisonType === 'custom') {
    if (new Date(value.customComparisonStart) >= new Date(value.customComparisonEnd)) {
      return helpers.error('any.invalid', { message: 'Custom comparison start date must be before end date' });
    }
  }
  
  return value;
});

// ============================================
// REVENUE ANALYTICS VALIDATION
// ============================================

// Revenue analytics query parameters
const revenueQuerySchema = Joi.object({
  period: periodTypeSchema,
  
  breakdown: dimensionSchema.default('platform'),
  
  includeForecasting: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Include forecasting must be a boolean value'
    }),
  
  includeBenchmarks: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include benchmarks must be a boolean value'
    }),
  
  currency: Joi.string()
    .valid('INR')
    .default('INR')
    .messages({
      'any.only': 'Currency must be INR for Indian market compliance'
    }),
  
  groupBy: Joi.string()
    .valid('day', 'week', 'month', 'quarter')
    .default('month')
    .messages({
      'any.only': 'Group by must be one of: day, week, month, quarter'
    })
});

// Revenue breakdown query parameters
const revenueBreakdownSchema = Joi.object({
  dimension: dimensionSchema.required().messages({
    'any.required': 'Breakdown dimension is required'
  }),
  
  period: periodTypeSchema,
  
  sortBy: Joi.string()
    .valid('value', 'percentage', 'count', 'growth')
    .default('value')
    .messages({
      'any.only': 'Sort by must be one of: value, percentage, count, growth'
    }),
  
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'Sort order must be either asc or desc'
    }),
  
  topN: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .default(10)
    .messages({
      'number.base': 'Top N must be a number',
      'number.integer': 'Top N must be an integer',
      'number.min': 'Top N must be at least 1',
      'number.max': 'Top N cannot exceed 50'
    })
});

// ============================================
// DEAL ANALYTICS VALIDATION
// ============================================

// Deal funnel analytics query parameters
const dealAnalyticsSchema = Joi.object({
  period: periodTypeSchema,
  
  includeStageAnalysis: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include stage analysis must be a boolean value'
    }),
  
  includePlatformBreakdown: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include platform breakdown must be a boolean value'
    }),
  
  includeClientRetention: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include client retention must be a boolean value'
    }),
  
  filterByPlatform: Joi.array()
    .items(Joi.string().valid('Instagram', 'YouTube', 'LinkedIn', 'Twitter', 'TikTok', 'Facebook'))
    .unique()
    .messages({
      'array.unique': 'Platform filters must be unique',
      'any.only': 'Platform must be one of: Instagram, YouTube, LinkedIn, Twitter, TikTok, Facebook'
    }),
  
  minDealValue: Joi.number()
    .min(0)
    .messages({
      'number.base': 'Minimum deal value must be a number',
      'number.min': 'Minimum deal value cannot be negative'
    }),
  
  maxDealValue: Joi.number()
    .min(0)
    .messages({
      'number.base': 'Maximum deal value must be a number',
      'number.min': 'Maximum deal value cannot be negative'
    })
}).custom((value, helpers) => {
  // Validate deal value range
  if (value.minDealValue && value.maxDealValue && value.minDealValue >= value.maxDealValue) {
    return helpers.error('any.invalid', { message: 'Minimum deal value must be less than maximum deal value' });
  }
  return value;
});

// Deal performance analytics query parameters
const dealPerformanceSchema = Joi.object({
  period: periodTypeSchema,
  
  metric: Joi.string()
    .valid('conversion', 'close_time', 'win_rate', 'retention', 'value', 'velocity')
    .default('conversion')
    .messages({
      'any.only': 'Metric must be one of: conversion, close_time, win_rate, retention, value, velocity'
    }),
  
  groupBy: dimensionSchema.default('platform'),
  
  includeComparison: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include comparison must be a boolean value'
    }),
  
  benchmarkType: Joi.string()
    .valid('industry', 'platform', 'historical')
    .default('platform')
    .messages({
      'any.only': 'Benchmark type must be one of: industry, platform, historical'
    })
});

// ============================================
// AI INSIGHTS VALIDATION
// ============================================

// AI insights query parameters
const insightsQuerySchema = Joi.object({
  status: statusSchema.default('active'),
  
  priority: prioritySchema.optional(),
  
  insightType: insightTypeSchema.optional(),
  
  ...paginationSchema,
  
  minConfidence: Joi.number()
    .min(0)
    .max(100)
    .default(70)
    .messages({
      'number.base': 'Minimum confidence must be a number',
      'number.min': 'Minimum confidence cannot be less than 0',
      'number.max': 'Minimum confidence cannot exceed 100'
    }),
  
  sortBy: Joi.string()
    .valid('priority', 'confidence', 'created_date', 'relevance')
    .default('priority')
    .messages({
      'any.only': 'Sort by must be one of: priority, confidence, created_date, relevance'
    }),
  
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'Sort order must be either asc or desc'
    }),
  
  includeExpired: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Include expired must be a boolean value'
    })
});

// Insight ID parameter validation
const insightIdSchema = Joi.object({
  insightId: objectIdSchema.required().messages({
    'any.required': 'Insight ID is required'
  })
});

// Update insight status request body
const updateInsightStatusSchema = Joi.object({
  status: Joi.string()
    .valid('acknowledged', 'acted_upon', 'dismissed')
    .required()
    .messages({
      'any.required': 'Status is required',
      'any.only': 'Status must be one of: acknowledged, acted_upon, dismissed'
    }),
  
  notes: Joi.string()
    .max(500)
    .trim()
    .optional()
    .messages({
      'string.max': 'Notes cannot exceed 500 characters'
    }),
  
  actionTaken: Joi.string()
    .max(300)
    .trim()
    .when('status', {
      is: 'acted_upon',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'string.max': 'Action taken cannot exceed 300 characters',
      'any.required': 'Action taken is required when marking insight as acted upon'
    }),
  
  dismissalReason: Joi.string()
    .valid('not_relevant', 'already_implemented', 'not_feasible', 'incorrect_analysis', 'other')
    .when('status', {
      is: 'dismissed',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
    .messages({
      'any.required': 'Dismissal reason is required when dismissing an insight',
      'any.unknown': 'Dismissal reason is only allowed when dismissing an insight',
      'any.only': 'Dismissal reason must be one of: not_relevant, already_implemented, not_feasible, incorrect_analysis, other'
    })
});

// ============================================
// TREND ANALYSIS & FORECASTING VALIDATION
// ============================================

// Trend analysis query parameters
const trendAnalysisSchema = Joi.object({
  metric: metricTypeSchema.required().messages({
    'any.required': 'Metric type is required for trend analysis'
  }),
  
  periods: Joi.number()
    .integer()
    .min(3)
    .max(24)
    .default(6)
    .messages({
      'number.base': 'Periods must be a number',
      'number.integer': 'Periods must be an integer',
      'number.min': 'At least 3 periods required for trend analysis',
      'number.max': 'Maximum 24 periods allowed for trend analysis'
    }),
  
  analysisType: Joi.string()
    .valid('linear', 'seasonal', 'growth')
    .default('linear')
    .messages({
      'any.only': 'Analysis type must be one of: linear, seasonal, growth'
    }),
  
  includeSeasonality: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Include seasonality must be a boolean value'
    }),
  
  confidenceLevel: Joi.number()
    .valid(90, 95, 99)
    .default(95)
    .messages({
      'any.only': 'Confidence level must be one of: 90, 95, 99'
    })
});

// Forecasting query parameters
const forecastSchema = Joi.object({
  metric: metricTypeSchema.required().messages({
    'any.required': 'Metric type is required for forecasting'
  }),
  
  periods: Joi.number()
    .integer()
    .min(1)
    .max(12)
    .default(3)
    .messages({
      'number.base': 'Forecast periods must be a number',
      'number.integer': 'Forecast periods must be an integer',
      'number.min': 'At least 1 period required for forecasting',
      'number.max': 'Maximum 12 periods allowed for forecasting'
    }),
  
  method: Joi.string()
    .valid('linear_regression', 'moving_average', 'exponential_smoothing')
    .default('linear_regression')
    .messages({
      'any.only': 'Forecast method must be one of: linear_regression, moving_average, exponential_smoothing'
    }),
  
  includeConfidenceInterval: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include confidence interval must be a boolean value'
    }),
  
  adjustForSeasonality: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Adjust for seasonality must be a boolean value'
    })
});

// ============================================
// RISK ANALYTICS VALIDATION
// ============================================

// Risk analytics query parameters
const riskAnalyticsSchema = Joi.object({
  period: periodTypeSchema,
  
  riskLevel: Joi.string()
    .valid('all', 'low', 'medium', 'high')
    .default('all')
    .messages({
      'any.only': 'Risk level must be one of: all, low, medium, high'
    }),
  
  includeCorrelation: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include correlation must be a boolean value'
    }),
  
  includeRecommendations: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include recommendations must be a boolean value'
    }),
  
  groupBy: Joi.string()
    .valid('contract_type', 'risk_factor', 'client', 'month')
    .default('risk_factor')
    .messages({
      'any.only': 'Group by must be one of: contract_type, risk_factor, client, month'
    }),
  
  minRiskScore: Joi.number()
    .min(0)
    .max(100)
    .default(0)
    .messages({
      'number.base': 'Minimum risk score must be a number',
      'number.min': 'Minimum risk score cannot be less than 0',
      'number.max': 'Minimum risk score cannot exceed 100'
    })
});

// ============================================
// PERFORMANCE ANALYTICS VALIDATION
// ============================================

// Performance analytics query parameters
const performanceAnalyticsSchema = Joi.object({
  period: periodTypeSchema,
  
  platform: Joi.array()
    .items(Joi.string().valid('Instagram', 'YouTube', 'LinkedIn', 'Twitter', 'TikTok', 'Facebook'))
    .unique()
    .messages({
      'array.unique': 'Platform filters must be unique',
      'any.only': 'Platform must be one of: Instagram, YouTube, LinkedIn, Twitter, TikTok, Facebook'
    }),
  
  metric: Joi.string()
    .valid('engagement', 'impressions', 'reach', 'roi', 'conversion')
    .default('engagement')
    .messages({
      'any.only': 'Metric must be one of: engagement, impressions, reach, roi, conversion'
    }),
  
  contentType: Joi.array()
    .items(Joi.string().valid('post', 'reel', 'story', 'video', 'carousel', 'live'))
    .unique()
    .messages({
      'array.unique': 'Content type filters must be unique',
      'any.only': 'Content type must be one of: post, reel, story, video, carousel, live'
    }),
  
  includeROI: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include ROI must be a boolean value'
    })
});

// ============================================
// EXPORT & REPORTING VALIDATION
// ============================================

// Data export request body
const exportSchema = Joi.object({
  exportType: Joi.string()
    .valid('dashboard', 'revenue', 'deals', 'insights', 'performance', 'risk', 'complete')
    .required()
    .messages({
      'any.required': 'Export type is required',
      'any.only': 'Export type must be one of: dashboard, revenue, deals, insights, performance, risk, complete'
    }),
  
  format: Joi.string()
    .valid('json', 'csv', 'pdf', 'xlsx')
    .default('json')
    .messages({
      'any.only': 'Format must be one of: json, csv, pdf, xlsx'
    }),
  
  period: periodTypeSchema,
  
  startDate: dateSchema.optional(),
  
  endDate: dateSchema.optional(),
  
  includeCharts: Joi.boolean()
    .default(true)
    .when('format', {
      is: Joi.string().valid('pdf', 'xlsx'),
      then: Joi.valid(true, false),
      otherwise: Joi.valid(false)
    })
    .messages({
      'boolean.base': 'Include charts must be a boolean value',
      'any.only': 'Charts are only supported for PDF and XLSX formats'
    }),
  
  compression: Joi.string()
    .valid('none', 'gzip', 'zip')
    .default('none')
    .messages({
      'any.only': 'Compression must be one of: none, gzip, zip'
    }),
  
  emailDelivery: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Email delivery must be a boolean value'
    }),
  
  recipientEmail: Joi.string()
    .email()
    .when('emailDelivery', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
    .messages({
      'string.email': 'Recipient email must be a valid email address',
      'any.required': 'Recipient email is required when email delivery is enabled',
      'any.unknown': 'Recipient email is only allowed when email delivery is enabled'
    })
}).custom((value, helpers) => {
  // Validate date range if both dates provided
  if (value.startDate && value.endDate && new Date(value.startDate) >= new Date(value.endDate)) {
    return helpers.error('any.invalid', { message: 'Start date must be before end date' });
  }
  return value;
});

// ============================================
// BENCHMARKING VALIDATION
// ============================================

// Benchmark query parameters
const benchmarkSchema = Joi.object({
  metric: Joi.string()
    .valid('conversion_rate', 'payment_velocity', 'client_retention', 'engagement_rate', 'deal_value')
    .required()
    .messages({
      'any.required': 'Metric is required for benchmarking',
      'any.only': 'Metric must be one of: conversion_rate, payment_velocity, client_retention, engagement_rate, deal_value'
    }),
  
  industry: Joi.string()
    .valid('fashion', 'tech', 'finance', 'food', 'travel', 'lifestyle', 'education', 'all')
    .default('all')
    .messages({
      'any.only': 'Industry must be one of: fashion, tech, finance, food, travel, lifestyle, education, all'
    }),
  
  followerRange: Joi.string()
    .valid('1k-10k', '10k-100k', '100k-1m', '1m+', 'all')
    .default('all')
    .messages({
      'any.only': 'Follower range must be one of: 1k-10k, 10k-100k, 100k-1m, 1m+, all'
    }),
  
  platform: Joi.string()
    .valid('Instagram', 'YouTube', 'LinkedIn', 'Twitter', 'TikTok', 'Facebook', 'all')
    .default('all')
    .messages({
      'any.only': 'Platform must be one of: Instagram, YouTube, LinkedIn, Twitter, TikTok, Facebook, all'
    }),
  
  period: periodTypeSchema,
  
  includePercentile: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include percentile must be a boolean value'
    })
});

// ============================================
// AGENCY ANALYTICS VALIDATION
// ============================================

// Agency analytics query parameters
const agencyAnalyticsSchema = Joi.object({
  period: periodTypeSchema,
  
  creatorIds: Joi.array()
    .items(objectIdSchema)
    .unique()
    .max(25)
    .messages({
      'array.unique': 'Creator IDs must be unique',
      'array.max': 'Maximum 25 creators allowed for comparison'
    }),
  
  includeIndividualMetrics: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include individual metrics must be a boolean value'
    }),
  
  includePortfolioSummary: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include portfolio summary must be a boolean value'
    }),
  
  sortBy: Joi.string()
    .valid('revenue', 'conversion', 'retention', 'growth', 'performance_score')
    .default('revenue')
    .messages({
      'any.only': 'Sort by must be one of: revenue, conversion, retention, growth, performance_score'
    }),
  
  topPerformers: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(5)
    .messages({
      'number.base': 'Top performers must be a number',
      'number.integer': 'Top performers must be an integer',
      'number.min': 'At least 1 top performer required',
      'number.max': 'Maximum 10 top performers allowed'
    })
});

// Creator comparison query parameters
const creatorComparisonSchema = Joi.object({
  creatorIds: Joi.array()
    .items(objectIdSchema)
    .min(2)
    .max(10)
    .unique()
    .required()
    .messages({
      'any.required': 'Creator IDs are required for comparison',
      'array.min': 'At least 2 creators required for comparison',
      'array.max': 'Maximum 10 creators allowed for comparison',
      'array.unique': 'Creator IDs must be unique'
    }),
  
  period: periodTypeSchema,
  
  metrics: Joi.array()
    .items(Joi.string().valid('revenue', 'conversion', 'retention', 'performance', 'risk', 'growth'))
    .unique()
    .default(['revenue', 'conversion', 'performance'])
    .messages({
      'array.unique': 'Metrics must be unique',
      'any.only': 'Metric must be one of: revenue, conversion, retention, performance, risk, growth'
    }),
  
  includeRanking: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include ranking must be a boolean value'
    }),
  
  includeRecommendations: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Include recommendations must be a boolean value'
    })
});

// ============================================
// CACHE MANAGEMENT VALIDATION
// ============================================

// Cache operation query parameters
const cacheQuerySchema = Joi.object({
  cacheType: Joi.string()
    .valid('all', 'dashboard', 'revenue', 'insights', 'trends', 'performance')
    .default('all')
    .messages({
      'any.only': 'Cache type must be one of: all, dashboard, revenue, insights, trends, performance'
    }),
  
  includeStats: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Include stats must be a boolean value'
    })
});

// ============================================
// UTILITY VALIDATION FUNCTIONS
// ============================================

/**
 * Validate subscription tier for analytics features
 */
const validateSubscriptionTier = (requiredTiers) => {
  return Joi.string()
    .valid(...requiredTiers)
    .required()
    .messages({
      'any.required': 'Subscription tier validation is required',
      'any.only': `Feature requires one of these subscription tiers: ${requiredTiers.join(', ')}`
    });
};

/**
 * Validate date range with custom logic
 */
const validateDateRange = (startDate, endDate, maxDays = 365) => {
  if (!startDate || !endDate) return true;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start >= end) {
    throw new Error('Start date must be before end date');
  }
  
  const diffDays = (end - start) / (1000 * 60 * 60 * 24);
  if (diffDays > maxDays) {
    throw new Error(`Date range cannot exceed ${maxDays} days`);
  }
  
  return true;
};

/**
 * Validate analytics query complexity based on subscription tier
 */
const validateQueryComplexity = (queryParams, subscriptionTier) => {
  const complexityLimits = {
    pro: { maxFilters: 3, maxMetrics: 2, maxPeriods: 6 },
    elite: { maxFilters: 5, maxMetrics: 5, maxPeriods: 12 },
    agency_starter: { maxFilters: 5, maxMetrics: 5, maxPeriods: 12 },
    agency_pro: { maxFilters: 10, maxMetrics: 10, maxPeriods: 24 }
  };
  
  const limits = complexityLimits[subscriptionTier] || complexityLimits.pro;
  
  // Validate based on tier limits
  const filterCount = Object.keys(queryParams).length;
  if (filterCount > limits.maxFilters) {
    throw new Error(`Query complexity exceeds limit for ${subscriptionTier} tier`);
  }
  
  return true;
};

// ============================================
// EXPORTED VALIDATION SCHEMAS
// ============================================

module.exports = {
  // Core schemas
  objectIdSchema,
  dateSchema,
  periodTypeSchema,
  metricTypeSchema,
  dimensionSchema,
  insightTypeSchema,
  prioritySchema,
  statusSchema,
  paginationSchema,
  
  // Dashboard analytics
  dashboardQuerySchema,
  customRangeSchema,
  
  // Revenue analytics
  revenueQuerySchema,
  revenueBreakdownSchema,
  
  // Deal analytics
  dealAnalyticsSchema,
  dealPerformanceSchema,
  
  // AI insights
  insightsQuerySchema,
  insightIdSchema,
  updateInsightStatusSchema,
  
  // Trend analysis & forecasting
  trendAnalysisSchema,
  forecastSchema,
  
  // Risk analytics
  riskAnalyticsSchema,
  
  // Performance analytics
  performanceAnalyticsSchema,
  
  // Export & reporting
  exportSchema,
  
  // Benchmarking
  benchmarkSchema,
  
  // Agency analytics
  agencyAnalyticsSchema,
  creatorComparisonSchema,
  
  // Cache management
  cacheQuerySchema,
  
  // Utility functions
  validateSubscriptionTier,
  validateDateRange,
  validateQueryComplexity
};