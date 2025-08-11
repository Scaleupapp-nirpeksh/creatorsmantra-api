/**
 * CreatorsMantra Backend - Analytics Module
 * Advanced business intelligence and reporting system for creator economy management
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * 
 * File Path: src/modules/analytics/model.js
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ============================================
// ANALYTICS DASHBOARD SCHEMA
// ============================================

/**
 * Main analytics dashboard data storage
 * Stores pre-computed analytics to improve performance
 */
const analyticsDashboardSchema = new Schema({
  // User identification
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Time period for this analytics snapshot
  period: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    periodType: {
      type: String,
      enum: ['week', 'month', 'quarter', 'year'],
      required: true
    }
  },
  
  // ========== REVENUE INTELLIGENCE ==========
  revenueMetrics: {
    // Basic revenue metrics
    totalRevenue: { type: Number, default: 0, min: 0 },
    totalDeals: { type: Number, default: 0, min: 0 },
    averageDealValue: { type: Number, default: 0, min: 0 },
    
    // Growth metrics
    revenueGrowth: { type: Number, default: 0 }, // Percentage growth
    dealGrowth: { type: Number, default: 0 },
    avgValueGrowth: { type: Number, default: 0 },
    
    // Payment metrics
    averagePaymentDays: { type: Number, default: 0, min: 0 },
    paymentSuccessRate: { type: Number, default: 0, min: 0, max: 100 },
    overdueInvoices: { type: Number, default: 0, min: 0 },
    
    // Revenue breakdown
    revenueByPlatform: [{
      platform: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      percentage: { type: Number, required: true, min: 0, max: 100 }
    }],
    
    revenueByClientType: [{
      clientType: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      percentage: { type: Number, required: true, min: 0, max: 100 }
    }]
  },
  
  // ========== DEAL PERFORMANCE ANALYTICS ==========
  dealMetrics: {
    // Pipeline metrics
    pipelineValue: { type: Number, default: 0, min: 0 },
    pipelineConversion: { type: Number, default: 0, min: 0, max: 100 },
    averageCloseTime: { type: Number, default: 0, min: 0 }, // Days
    
    // Stage-wise conversion
    stageConversions: [{
      fromStage: { type: String, required: true },
      toStage: { type: String, required: true },
      conversionRate: { type: Number, required: true, min: 0, max: 100 },
      averageDays: { type: Number, required: true, min: 0 }
    }],
    
    // Win rate analysis
    winRateByPlatform: [{
      platform: { type: String, required: true },
      winRate: { type: Number, required: true, min: 0, max: 100 },
      totalDeals: { type: Number, required: true, min: 0 }
    }],
    
    winRateByDeliverable: [{
      deliverableType: { type: String, required: true },
      winRate: { type: Number, required: true, min: 0, max: 100 },
      avgValue: { type: Number, required: true, min: 0 }
    }],
    
    // Client metrics
    clientRetentionRate: { type: Number, default: 0, min: 0, max: 100 },
    repeatClientPercentage: { type: Number, default: 0, min: 0, max: 100 },
    averageClientLifetimeValue: { type: Number, default: 0, min: 0 }
  },
  
  // ========== PERFORMANCE CORRELATION ==========
  performanceMetrics: {
    // Campaign performance
    totalCampaigns: { type: Number, default: 0, min: 0 },
    averageEngagementRate: { type: Number, default: 0, min: 0 },
    averageImpressions: { type: Number, default: 0, min: 0 },
    
    // Content ROI
    contentPerformance: [{
      contentType: { type: String, required: true },
      avgEngagement: { type: Number, required: true, min: 0 },
      avgDealValue: { type: Number, required: true, min: 0 },
      roi: { type: Number, required: true }
    }],
    
    // Platform efficiency
    platformEfficiency: [{
      platform: { type: String, required: true },
      costPerImpression: { type: Number, required: true, min: 0 },
      engagementRate: { type: Number, required: true, min: 0 },
      repeatBusinessRate: { type: Number, required: true, min: 0, max: 100 }
    }]
  },
  
  // ========== RISK & CONTRACT INTELLIGENCE ==========
  riskMetrics: {
    // Overall risk assessment
    averageContractRisk: { type: Number, default: 0, min: 0, max: 100 },
    riskTrend: { type: String, enum: ['improving', 'stable', 'worsening'], default: 'stable' },
    
    // Risk breakdown
    highRiskContracts: { type: Number, default: 0, min: 0 },
    riskFactorDistribution: [{
      riskType: { type: String, required: true },
      count: { type: Number, required: true, min: 0 },
      percentage: { type: Number, required: true, min: 0, max: 100 }
    }],
    
    // Negotiation success
    negotiationSuccessRate: { type: Number, default: 0, min: 0, max: 100 },
    averageNegotiationRounds: { type: Number, default: 0, min: 0 },
    
    // Risk-revenue correlation
    riskRevenueCorrelation: {
      highRiskAvgValue: { type: Number, default: 0, min: 0 },
      lowRiskAvgValue: { type: Number, default: 0, min: 0 },
      riskPremium: { type: Number, default: 0 } // Percentage difference
    }
  },
  
  // ========== COMPUTATION METADATA ==========
  computationMetadata: {
    dataSourcesUsed: [{ type: String }], // ['deals', 'invoices', 'performance', 'contracts']
    recordsProcessed: { type: Number, default: 0, min: 0 },
    computationTime: { type: Number, default: 0, min: 0 }, // milliseconds
    cacheKey: { type: String, index: true },
    lastRefreshed: { type: Date, default: Date.now }
  }
}, {
  timestamps: true,
  collection: 'analytics_dashboards'
});

// ============================================
// AI INSIGHTS SCHEMA
// ============================================

/**
 * AI-generated business insights and recommendations
 * Stores intelligent analysis of creator's business patterns
 */
const aiInsightsSchema = new Schema({
  // User identification
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Insight classification
  insightType: {
    type: String,
    enum: [
      'pricing_opportunity',
      'seasonal_trend', 
      'risk_warning',
      'performance_optimization',
      'client_retention',
      'content_strategy',
      'revenue_forecast',
      'market_positioning'
    ],
    required: true,
    index: true
  },
  
  // Priority and urgency
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  
  // Insight content
  title: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 500,
    trim: true
  },
  
  actionRecommendation: {
    type: String,
    required: true,
    maxlength: 300,
    trim: true
  },
  
  // Supporting data
  dataSupport: {
    metricType: { type: String, required: true },
    currentValue: { type: mongoose.Schema.Types.Mixed },
    benchmarkValue: { type: mongoose.Schema.Types.Mixed },
    improvement: { type: String }, // "25% increase possible"
    timeframe: { type: String } // "within 30 days"
  },
  
  // Insight lifecycle
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'acted_upon', 'dismissed'],
    default: 'active',
    index: true
  },
  
  acknowledgedAt: { type: Date },
  actedUponAt: { type: Date },
  dismissedAt: { type: Date },
  
  // AI processing metadata
  aiMetadata: {
    modelUsed: { type: String, default: 'gpt-3.5-turbo' },
    promptVersion: { type: String, default: '1.0' },
    processingTime: { type: Number, min: 0 },
    tokensUsed: { type: Number, min: 0 }
  },
  
  // Expiry and relevance
  expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
  relevantUntil: { type: Date, required: true }
}, {
  timestamps: true,
  collection: 'ai_insights'
});

// ============================================
// ANALYTICS CACHE SCHEMA
// ============================================

/**
 * Caching layer for expensive analytics computations
 * Improves dashboard performance by storing pre-computed results
 */
const analyticsCacheSchema = new Schema({
  // Cache identification
  cacheKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Cache metadata
  queryType: {
    type: String,
    enum: [
      'dashboard_overview',
      'revenue_analytics',
      'deal_funnel',
      'performance_correlation',
      'risk_analysis',
      'ai_insights_generation'
    ],
    required: true,
    index: true
  },
  
  // Query parameters that generated this cache
  queryParameters: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Cached result data
  resultData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Cache performance metrics
  cacheMetrics: {
    computationTime: { type: Number, required: true, min: 0 },
    dataSize: { type: Number, required: true, min: 0 },
    hitCount: { type: Number, default: 0, min: 0 },
    lastAccessed: { type: Date, default: Date.now }
  },
  
  // Cache lifecycle
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }
  },
  
  isValid: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'analytics_cache'
});

// ============================================
// TREND ANALYSIS SCHEMA
// ============================================

/**
 * Historical trend data for predictive analytics
 * Stores time-series data for trend analysis and forecasting
 */
const trendAnalysisSchema = new Schema({
  // User and metric identification
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  metricType: {
    type: String,
    enum: [
      'monthly_revenue',
      'deal_conversion_rate',
      'average_deal_value',
      'payment_velocity',
      'client_retention',
      'contract_risk_score',
      'engagement_rate',
      'platform_performance'
    ],
    required: true,
    index: true
  },
  
  // Time series data points
  dataPoints: [{
    date: { type: Date, required: true },
    value: { type: Number, required: true },
    additionalData: { type: mongoose.Schema.Types.Mixed }
  }],
  
  // Trend analysis results
  trendAnalysis: {
    direction: {
      type: String,
      enum: ['increasing', 'decreasing', 'stable', 'volatile'],
      required: true
    },
    
    strength: {
      type: String,
      enum: ['weak', 'moderate', 'strong'],
      required: true
    },
    
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    
    // Simple linear regression coefficients
    regressionCoefficients: {
      slope: { type: Number, required: true },
      intercept: { type: Number, required: true },
      rSquared: { type: Number, min: 0, max: 1, required: true }
    },
    
    // Forecasting (simple projection)
    forecast: [{
      date: { type: Date, required: true },
      predictedValue: { type: Number, required: true },
      confidenceInterval: {
        lower: { type: Number, required: true },
        upper: { type: Number, required: true }
      }
    }]
  },
  
  // Analysis metadata
  analysisMetadata: {
    dataPointCount: { type: Number, required: true, min: 0 },
    timeSpanDays: { type: Number, required: true, min: 0 },
    lastAnalyzed: { type: Date, default: Date.now },
    nextAnalysisDue: { type: Date, required: true }
  }
}, {
  timestamps: true,
  collection: 'trend_analysis'
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

// Analytics Dashboard indexes
analyticsDashboardSchema.index({ userId: 1, 'period.periodType': 1, 'period.startDate': -1 });
analyticsDashboardSchema.index({ 'computationMetadata.cacheKey': 1 });

// AI Insights indexes
aiInsightsSchema.index({ userId: 1, status: 1, priority: -1 });
aiInsightsSchema.index({ insightType: 1, createdAt: -1 });
aiInsightsSchema.index({ relevantUntil: 1 }); // For cleanup

// Analytics Cache indexes
analyticsCacheSchema.index({ userId: 1, queryType: 1 });
analyticsCacheSchema.index({ 'cacheMetrics.lastAccessed': -1 });

// Trend Analysis indexes
trendAnalysisSchema.index({ userId: 1, metricType: 1 });
trendAnalysisSchema.index({ 'analysisMetadata.nextAnalysisDue': 1 });

// ============================================
// VIRTUAL FIELDS
// ============================================

// Analytics Dashboard virtuals
analyticsDashboardSchema.virtual('revenueGrowthText').get(function() {
  const growth = this.revenueMetrics.revenueGrowth;
  if (growth > 0) return `+${growth.toFixed(1)}% ↗️`;
  if (growth < 0) return `${growth.toFixed(1)}% ↘️`;
  return 'No change';
});

analyticsDashboardSchema.virtual('performanceScore').get(function() {
  let score = 0;
  
  // Revenue growth contribution (30%)
  if (this.revenueMetrics.revenueGrowth > 20) score += 30;
  else if (this.revenueMetrics.revenueGrowth > 0) score += 20;
  else if (this.revenueMetrics.revenueGrowth > -10) score += 10;
  
  // Conversion rate contribution (25%)
  if (this.dealMetrics.pipelineConversion > 40) score += 25;
  else if (this.dealMetrics.pipelineConversion > 25) score += 20;
  else if (this.dealMetrics.pipelineConversion > 15) score += 15;
  
  // Payment velocity contribution (20%)
  if (this.revenueMetrics.averagePaymentDays < 15) score += 20;
  else if (this.revenueMetrics.averagePaymentDays < 30) score += 15;
  else if (this.revenueMetrics.averagePaymentDays < 45) score += 10;
  
  // Risk management contribution (15%)
  if (this.riskMetrics.averageContractRisk < 30) score += 15;
  else if (this.riskMetrics.averageContractRisk < 50) score += 10;
  else if (this.riskMetrics.averageContractRisk < 70) score += 5;
  
  // Client retention contribution (10%)
  if (this.dealMetrics.clientRetentionRate > 70) score += 10;
  else if (this.dealMetrics.clientRetentionRate > 50) score += 7;
  else if (this.dealMetrics.clientRetentionRate > 30) score += 5;
  
  return Math.min(score, 100);
});

// AI Insights virtuals
aiInsightsSchema.virtual('urgencyScore').get(function() {
  let score = 0;
  
  // Priority weight
  const priorityWeights = { low: 10, medium: 30, high: 60, critical: 80 };
  score += priorityWeights[this.priority] || 0;
  
  // Confidence weight
  score += (this.confidence * 0.2);
  
  return Math.min(score, 100);
});

aiInsightsSchema.virtual('isActionable').get(function() {
  return this.status === 'active' && 
         this.confidence >= 70 && 
         this.relevantUntil > new Date();
});

// ============================================
// INSTANCE METHODS
// ============================================

// Analytics Dashboard methods
analyticsDashboardSchema.methods.getTopInsight = function() {
  const metrics = this.revenueMetrics;
  
  if (metrics.revenueGrowth > 20) {
    return {
      type: 'success',
      message: `Excellent growth! Revenue increased by ${metrics.revenueGrowth.toFixed(1)}%`,
      action: 'Scale successful strategies'
    };
  }
  
  if (metrics.averagePaymentDays > 45) {
    return {
      type: 'warning',
      message: `Payment delays averaging ${metrics.averagePaymentDays} days`,
      action: 'Review payment terms in contracts'
    };
  }
  
  if (this.dealMetrics.pipelineConversion < 20) {
    return {
      type: 'improvement',
      message: `Pipeline conversion at ${this.dealMetrics.pipelineConversion}%`,
      action: 'Focus on proposal quality and follow-ups'
    };
  }
  
  return {
    type: 'stable',
    message: 'Business metrics are stable',
    action: 'Look for growth opportunities'
  };
};

analyticsDashboardSchema.methods.refreshCache = async function() {
  this.computationMetadata.lastRefreshed = new Date();
  this.computationMetadata.cacheKey = `dashboard_${this.userId}_${Date.now()}`;
  return this.save();
};

// AI Insights methods
aiInsightsSchema.methods.acknowledge = async function() {
  this.status = 'acknowledged';
  this.acknowledgedAt = new Date();
  return this.save();
};

aiInsightsSchema.methods.markActedUpon = async function() {
  this.status = 'acted_upon';
  this.actedUponAt = new Date();
  return this.save();
};

aiInsightsSchema.methods.dismiss = async function() {
  this.status = 'dismissed';
  this.dismissedAt = new Date();
  return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

// Analytics Dashboard statics
analyticsDashboardSchema.statics.getLatestForUser = function(userId, periodType = 'month') {
  return this.findOne({ 
    userId, 
    'period.periodType': periodType 
  }).sort({ 'period.startDate': -1 });
};

analyticsDashboardSchema.statics.getUserTrend = function(userId, periodType, limit = 6) {
  return this.find({ 
    userId, 
    'period.periodType': periodType 
  })
  .sort({ 'period.startDate': -1 })
  .limit(limit)
  .select('period revenueMetrics.totalRevenue dealMetrics.pipelineConversion');
};

// AI Insights statics
aiInsightsSchema.statics.getActiveInsights = function(userId, limit = 10) {
  return this.find({ 
    userId, 
    status: 'active',
    relevantUntil: { $gt: new Date() }
  })
  .sort({ priority: -1, confidence: -1 })
  .limit(limit);
};

aiInsightsSchema.statics.getInsightsByType = function(userId, insightType) {
  return this.find({ userId, insightType })
    .sort({ createdAt: -1 });
};

// Analytics Cache statics
analyticsCacheSchema.statics.getCachedResult = async function(cacheKey) {
  const cache = await this.findOne({ 
    cacheKey, 
    isValid: true,
    expiresAt: { $gt: new Date() }
  });
  
  if (cache) {
    // Update hit count and last accessed
    cache.cacheMetrics.hitCount += 1;
    cache.cacheMetrics.lastAccessed = new Date();
    await cache.save();
    
    return cache.resultData;
  }
  
  return null;
};

analyticsCacheSchema.statics.setCachedResult = function(cacheKey, userId, queryType, queryParams, resultData, ttlMinutes = 60) {
  const expiresAt = new Date(Date.now() + (ttlMinutes * 60 * 1000));
  
  return this.findOneAndUpdate(
    { cacheKey },
    {
      cacheKey,
      userId,
      queryType,
      queryParameters: queryParams,
      resultData,
      cacheMetrics: {
        computationTime: 0,
        dataSize: JSON.stringify(resultData).length,
        hitCount: 0,
        lastAccessed: new Date()
      },
      expiresAt,
      isValid: true
    },
    { upsert: true, new: true }
  );
};

// ============================================
// MIDDLEWARE
// ============================================

// Pre-save middleware for analytics dashboard
analyticsDashboardSchema.pre('save', function(next) {
  // Generate cache key if not present
  if (!this.computationMetadata.cacheKey) {
    this.computationMetadata.cacheKey = `dashboard_${this.userId}_${this.period.periodType}_${Date.now()}`;
  }
  
  // Validate revenue metrics
  if (this.revenueMetrics.totalRevenue < 0) {
    return next(new Error('Total revenue cannot be negative'));
  }
  
  next();
});

// Pre-save middleware for AI insights
aiInsightsSchema.pre('save', function(next) {
  // Set expiry if not set
  if (!this.expiresAt) {
    // Most insights expire in 30 days
    this.expiresAt = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
  }
  
  // Validate confidence score
  if (this.confidence < 0 || this.confidence > 100) {
    return next(new Error('Confidence must be between 0 and 100'));
  }
  
  next();
});

// ============================================
// EXPORT MODELS
// ============================================

const AnalyticsDashboard = mongoose.model('AnalyticsDashboard', analyticsDashboardSchema);
const AIInsights = mongoose.model('AIInsights', aiInsightsSchema);
const AnalyticsCache = mongoose.model('AnalyticsCache', analyticsCacheSchema);
const TrendAnalysis = mongoose.model('TrendAnalysis', trendAnalysisSchema);

module.exports = {
  AnalyticsDashboard,
  AIInsights,
  AnalyticsCache,
  TrendAnalysis
};