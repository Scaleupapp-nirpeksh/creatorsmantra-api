/**
 * CreatorsMantra Backend - Analytics Module
 * Express routes for advanced business intelligence and reporting APIs
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * 
 * File Path: src/modules/analytics/routes.js
 */

const express = require('express');
const router = express.Router();

// Middleware imports
const { validateRequest, authenticateUser, authorizeSubscription } = require('../../shared/middleware');
const { rateLimit } = require('../../shared/rateLimiter');
const { logInfo, logWarn } = require('../../shared/utils');

// Controller and validation imports
const analyticsController = require('./controller');
const analyticsValidation = require('./validation');

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================

// Standard rate limiter for basic analytics
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many analytics requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// AI-specific rate limiter (more restrictive)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 AI requests per hour
  message: 'AI analytics rate limit exceeded, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Expensive analytics operations (trend analysis, forecasting)
const advancedLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 advanced requests per hour
  message: 'Advanced analytics rate limit exceeded, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Cache operations limiter
const cacheLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 cache operations per window
  message: 'Cache operation rate limit exceeded, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// SUBSCRIPTION TIER DEFINITIONS
// ============================================

// Subscription tiers for different feature access
const BASIC_ANALYTICS_TIERS = ['pro', 'elite', 'agency_starter', 'agency_pro'];
const AI_FEATURES_TIERS = ['pro', 'elite', 'agency_starter', 'agency_pro'];
const ADVANCED_ANALYTICS_TIERS = ['elite', 'agency_starter', 'agency_pro'];
const AGENCY_FEATURES_TIERS = ['agency_starter', 'agency_pro'];

// ============================================
// DASHBOARD ANALYTICS ROUTES
// ============================================

/**
 * Get complete dashboard analytics overview
 * GET /api/v1/analytics/dashboard
 * 
 * Subscription: Pro+
 * Rate Limit: 100/15min
 * Features: Revenue metrics, deal performance, risk analysis, performance correlation
 */
router.get('/dashboard',
  standardLimiter,
  authenticateUser,
  authorizeSubscription(BASIC_ANALYTICS_TIERS),
  validateRequest(analyticsValidation.dashboardQuerySchema, 'query'),
  analyticsController.getDashboardAnalytics
);

/**
 * Get dashboard analytics for custom date range
 * POST /api/v1/analytics/dashboard/custom
 * 
 * Subscription: Elite+
 * Rate Limit: 100/15min
 * Features: Custom date range analysis, period comparison
 */
router.post('/dashboard/custom',
  standardLimiter,
  authenticateUser,
  authorizeSubscription(ADVANCED_ANALYTICS_TIERS),
  validateRequest(analyticsValidation.customRangeSchema),
  analyticsController.getCustomDashboardAnalytics
);

// ============================================
// REVENUE INTELLIGENCE ROUTES
// ============================================

/**
 * Get detailed revenue analytics
 * GET /api/v1/analytics/revenue
 * 
 * Subscription: Pro+
 * Rate Limit: 100/15min
 * Features: Revenue trends, growth analysis, payment velocity, forecasting
 */
router.get('/revenue',
  standardLimiter,
  authenticateUser,
  authorizeSubscription(BASIC_ANALYTICS_TIERS),
  validateRequest(analyticsValidation.revenueQuerySchema, 'query'),
  analyticsController.getRevenueAnalytics
);

/**
 * Get revenue breakdown by dimension
 * GET /api/v1/analytics/revenue/breakdown
 * 
 * Subscription: Pro+
 * Rate Limit: 100/15min
 * Features: Platform breakdown, client type analysis, content performance
 */
router.get('/revenue/breakdown',
  standardLimiter,
  authenticateUser,
  authorizeSubscription(BASIC_ANALYTICS_TIERS),
  validateRequest(analyticsValidation.revenueBreakdownSchema, 'query'),
  analyticsController.getRevenueBreakdown
);

// ============================================
// DEAL PERFORMANCE ANALYTICS ROUTES
// ============================================

/**
 * Get deal pipeline and conversion analytics
 * GET /api/v1/analytics/deals/funnel
 * 
 * Subscription: Pro+
 * Rate Limit: 100/15min
 * Features: Pipeline conversion, stage analysis, bottleneck identification
 */
router.get('/deals/funnel',
  standardLimiter,
  authenticateUser,
  authorizeSubscription(BASIC_ANALYTICS_TIERS),
  validateRequest(analyticsValidation.dealAnalyticsSchema, 'query'),
  analyticsController.getDealFunnelAnalytics
);

/**
 * Get deal performance insights
 * GET /api/v1/analytics/deals/performance
 * 
 * Subscription: Pro+
 * Rate Limit: 100/15min
 * Features: Win rates, close times, client retention analysis
 */
router.get('/deals/performance',
  standardLimiter,
  authenticateUser,
  authorizeSubscription(BASIC_ANALYTICS_TIERS),
  validateRequest(analyticsValidation.dealPerformanceSchema, 'query'),
  analyticsController.getDealPerformance
);

// ============================================
// AI INSIGHTS ROUTES
// ============================================

/**
 * Get AI-generated business insights
 * GET /api/v1/analytics/insights
 * 
 * Subscription: Pro+
 * Rate Limit: 20/hour (AI-specific)
 * Features: Business recommendations, opportunity identification, risk warnings
 */
router.get('/insights',
  aiLimiter,
  authenticateUser,
  authorizeSubscription(AI_FEATURES_TIERS),
  validateRequest(analyticsValidation.insightsQuerySchema, 'query'),
  analyticsController.getAIInsights
);

/**
 * Generate fresh AI insights
 * POST /api/v1/analytics/insights/generate
 * 
 * Subscription: Pro+
 * Rate Limit: 20/hour (AI-specific)
 * Features: On-demand insight generation, latest data analysis
 */
router.post('/insights/generate',
  aiLimiter,
  authenticateUser,
  authorizeSubscription(AI_FEATURES_TIERS),
  analyticsController.generateAIInsights
);

/**
 * Update insight status (acknowledge, act upon, dismiss)
 * PATCH /api/v1/analytics/insights/:insightId/status
 * 
 * Subscription: Pro+
 * Rate Limit: 100/15min
 * Features: Insight lifecycle management, action tracking
 */
router.patch('/insights/:insightId/status',
  standardLimiter,
  authenticateUser,
  authorizeSubscription(AI_FEATURES_TIERS),
  validateRequest(analyticsValidation.insightIdSchema, 'params'),
  validateRequest(analyticsValidation.updateInsightStatusSchema),
  analyticsController.updateInsightStatus
);

// ============================================
// TREND ANALYSIS & FORECASTING ROUTES
// ============================================

/**
 * Get trend analysis for specific metrics
 * GET /api/v1/analytics/trends
 * 
 * Subscription: Elite+
 * Rate Limit: 10/hour (Advanced analytics)
 * Features: Historical trend analysis, confidence scoring, pattern recognition
 */
router.get('/trends',
  advancedLimiter,
  authenticateUser,
  authorizeSubscription(ADVANCED_ANALYTICS_TIERS),
  validateRequest(analyticsValidation.trendAnalysisSchema, 'query'),
  analyticsController.getTrendAnalysis
);

/**
 * Get forecasting data
 * GET /api/v1/analytics/forecast
 * 
 * Subscription: Elite+
 * Rate Limit: 10/hour (Advanced analytics)
 * Features: Revenue forecasting, predictive analytics, confidence intervals
 */
router.get('/forecast',
  advancedLimiter,
  authenticateUser,
  authorizeSubscription(ADVANCED_ANALYTICS_TIERS),
  validateRequest(analyticsValidation.forecastSchema, 'query'),
  analyticsController.getForecast
);

// ============================================
// RISK ANALYTICS ROUTES
// ============================================

/**
 * Get risk analysis and patterns
 * GET /api/v1/analytics/risk
 * 
 * Subscription: Pro+
 * Rate Limit: 100/15min
 * Features: Contract risk analysis, revenue correlation, mitigation recommendations
 */
router.get('/risk',
  standardLimiter,
  authenticateUser,
  authorizeSubscription(BASIC_ANALYTICS_TIERS),
  validateRequest(analyticsValidation.riskAnalyticsSchema, 'query'),
  analyticsController.getRiskAnalytics
);

// ============================================
// PERFORMANCE CORRELATION ROUTES
// ============================================

/**
 * Get performance correlation analytics
 * GET /api/v1/analytics/performance
 * 
 * Subscription: Pro+
 * Rate Limit: 100/15min
 * Features: Campaign performance correlation, content ROI, platform efficiency
 */
router.get('/performance',
  standardLimiter,
  authenticateUser,
  authorizeSubscription(BASIC_ANALYTICS_TIERS),
  validateRequest(analyticsValidation.performanceAnalyticsSchema, 'query'),
  analyticsController.getPerformanceAnalytics || ((req, res) => {
    res.status(501).json({ 
      success: false, 
      message: 'Performance analytics endpoint under development' 
    });
  })
);

// ============================================
// CACHE MANAGEMENT ROUTES
// ============================================

/**
 * Clear analytics cache for user
 * DELETE /api/v1/analytics/cache
 * 
 * Subscription: Pro+
 * Rate Limit: 5/15min (Cache operations)
 * Features: Force refresh analytics data, clear cached results
 */
router.delete('/cache',
  cacheLimiter,
  authenticateUser,
  authorizeSubscription(BASIC_ANALYTICS_TIERS),
  analyticsController.clearCache
);

/**
 * Get cache statistics
 * GET /api/v1/analytics/cache/stats
 * 
 * Subscription: Elite+
 * Rate Limit: 5/15min (Cache operations)
 * Features: Cache performance metrics, hit rates, optimization insights
 */
router.get('/cache/stats',
  cacheLimiter,
  authenticateUser,
  authorizeSubscription(ADVANCED_ANALYTICS_TIERS),
  analyticsController.getCacheStats
);

// ============================================
// EXPORT & REPORTING ROUTES
// ============================================

/**
 * Export analytics data
 * POST /api/v1/analytics/export
 * 
 * Subscription: Elite+
 * Rate Limit: 10/hour (Advanced analytics)
 * Features: Data export, custom formats, scheduled reports
 */
router.post('/export',
  advancedLimiter,
  authenticateUser,
  authorizeSubscription(ADVANCED_ANALYTICS_TIERS),
  validateRequest(analyticsValidation.exportSchema),
  (req, res) => {
    // Placeholder for future export functionality
    res.status(501).json({
      success: false,
      message: 'Analytics export feature coming soon',
      availableFormats: ['JSON', 'CSV', 'PDF'],
      estimatedAvailability: 'Q2 2024'
    });
  }
);

// ============================================
// COMPARISON & BENCHMARKING ROUTES
// ============================================

/**
 * Get industry benchmarks
 * GET /api/v1/analytics/benchmarks
 * 
 * Subscription: Elite+
 * Rate Limit: 100/15min
 * Features: Industry comparison, performance benchmarks, market positioning
 */
router.get('/benchmarks',
  standardLimiter,
  authenticateUser,
  authorizeSubscription(ADVANCED_ANALYTICS_TIERS),
  validateRequest(analyticsValidation.benchmarkSchema, 'query'),
  (req, res) => {
    // Placeholder for future benchmarking functionality
    res.status(501).json({
      success: false,
      message: 'Industry benchmarks feature in development',
      plannedMetrics: [
        'Average conversion rates by platform',
        'Payment velocity benchmarks',
        'Content performance standards',
        'Risk score comparisons'
      ]
    });
  }
);

// ============================================
// AGENCY-SPECIFIC ROUTES
// ============================================

/**
 * Get multi-creator analytics (Agency feature)
 * GET /api/v1/analytics/agency/overview
 * 
 * Subscription: Agency+
 * Rate Limit: 100/15min
 * Features: Portfolio analytics, creator comparison, consolidated reporting
 */
router.get('/agency/overview',
  standardLimiter,
  authenticateUser,
  authorizeSubscription(AGENCY_FEATURES_TIERS),
  validateRequest(analyticsValidation.agencyAnalyticsSchema, 'query'),
  (req, res) => {
    // Placeholder for agency analytics
    res.status(501).json({
      success: false,
      message: 'Agency analytics feature under development',
      features: [
        'Multi-creator dashboard',
        'Portfolio performance comparison',
        'Consolidated revenue analytics',
        'Creator performance ranking'
      ]
    });
  }
);

/**
 * Get creator comparison analytics (Agency feature)
 * GET /api/v1/analytics/agency/comparison
 * 
 * Subscription: Agency+
 * Rate Limit: 100/15min
 * Features: Side-by-side creator analysis, performance ranking, optimization suggestions
 */
router.get('/agency/comparison',
  standardLimiter,
  authenticateUser,
  authorizeSubscription(AGENCY_FEATURES_TIERS),
  validateRequest(analyticsValidation.creatorComparisonSchema, 'query'),
  (req, res) => {
    // Placeholder for creator comparison
    res.status(501).json({
      success: false,
      message: 'Creator comparison analytics coming soon',
      capabilities: [
        'Performance benchmarking',
        'Revenue comparison',
        'Growth rate analysis',
        'Risk assessment comparison'
      ]
    });
  }
);

// ============================================
// HEALTH CHECK & DOCUMENTATION
// ============================================

/**
 * Health check for analytics module
 * GET /api/v1/analytics/health
 * 
 * Public endpoint
 * Rate Limit: 100/15min
 * Features: Module status, dependency check, feature availability
 */
router.get('/health',
  standardLimiter,
  analyticsController.getHealthCheck
);

/**
 * Get analytics module documentation and metadata
 * GET /api/v1/analytics/docs
 * 
 * Public endpoint
 * Rate Limit: 100/15min
 * Features: API documentation, feature list, subscription requirements
 */
router.get('/docs',
  standardLimiter,
  (req, res) => {
    const documentation = {
      module: 'analytics',
      version: '1.0.0',
      description: 'Advanced business intelligence and analytics for creator economy management',
      
      endpoints: {
        dashboard: {
          path: '/dashboard',
          method: 'GET',
          subscription: 'Pro+',
          description: 'Complete business overview with revenue, deals, performance, and risk metrics'
        },
        revenue: {
          path: '/revenue',
          method: 'GET', 
          subscription: 'Pro+',
          description: 'Detailed revenue analytics with growth trends and forecasting'
        },
        insights: {
          path: '/insights',
          method: 'GET',
          subscription: 'Pro+',
          description: 'AI-generated business insights and recommendations'
        },
        trends: {
          path: '/trends',
          method: 'GET',
          subscription: 'Elite+',
          description: 'Historical trend analysis and predictive forecasting'
        },
        risk: {
          path: '/risk',
          method: 'GET',
          subscription: 'Pro+',
          description: 'Contract risk analysis and revenue correlation'
        }
      },
      
      subscriptionFeatures: {
        starter: ['No analytics access'],
        pro: [
          'Dashboard overview',
          'Revenue analytics',
          'Deal performance tracking',
          'AI business insights',
          'Risk analysis'
        ],
        elite: [
          'All Pro features',
          'Trend analysis',
          'Revenue forecasting',
          'Custom date ranges',
          'Advanced caching',
          'Cache statistics'
        ],
        agency: [
          'All Elite features',
          'Multi-creator analytics',
          'Portfolio comparison',
          'Consolidated reporting'
        ]
      },
      
      aiFeatures: {
        insightGeneration: 'AI-powered business recommendations with confidence scoring',
        trendAnalysis: 'Machine learning trend detection and forecasting',
        riskAssessment: 'Intelligent contract risk analysis and mitigation suggestions',
        opportunityIdentification: 'Data-driven growth opportunity discovery'
      },
      
      rateLimits: {
        standard: '100 requests per 15 minutes',
        aiFeatures: '20 requests per hour',
        advancedAnalytics: '10 requests per hour',
        cacheOperations: '5 requests per 15 minutes'
      },
      
      dataCorrelation: {
        crossModuleAnalysis: 'Correlates data from deals, invoices, performance, contracts, briefs, and rate cards',
        intelligentCaching: 'Optimized caching for sub-3-second dashboard load times',
        realTimeInsights: 'Dynamic analytics updated as new data flows in from other modules'
      }
    };

    res.status(200).json({
      success: true,
      message: 'Analytics module documentation retrieved',
      data: documentation,
      timestamp: new Date().toISOString()
    });
  }
);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

/**
 * Analytics-specific error handler
 * Handles analytics computation errors, AI failures, and data correlation issues
 */
router.use((error, req, res, next) => {
  logWarn('Analytics route error encountered', {
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    error: error.message
  });

  // Handle specific analytics errors
  if (error.name === 'AnalyticsComputationError') {
    return res.status(500).json({
      success: false,
      message: 'Analytics computation failed',
      code: 'ANALYTICS_COMPUTATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  if (error.name === 'AIInsightGenerationError') {
    return res.status(500).json({
      success: false,
      message: 'AI insight generation temporarily unavailable',
      code: 'AI_SERVICE_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  if (error.name === 'InsufficientDataError') {
    return res.status(404).json({
      success: false,
      message: 'Insufficient data for analytics computation',
      code: 'INSUFFICIENT_DATA',
      recommendation: 'Complete more deals and campaigns to enable analytics',
      timestamp: new Date().toISOString()
    });
  }

  // Pass to general error handler
  next(error);
});

// ============================================
// MODULE EXPORTS
// ============================================
module.exports = router;

// ============================================
// ROUTE REGISTRATION LOG
// ============================================
logInfo('Analytics routes initialized', {
  totalRoutes: 18,
  publicRoutes: 2, // health, docs
  authenticatedRoutes: 16,
  
  routesBySubscription: {
    pro: 12, // dashboard, revenue, deals, insights, risk, cache
    elite: 6, // trends, forecast, custom ranges, cache stats, export, benchmarks
    agency: 2, // agency overview, creator comparison
    public: 2 // health, docs
  },
  
  routesByMethod: {
    GET: 14,
    POST: 3, // custom dashboard, generate insights, export
    PATCH: 1, // update insight status
    DELETE: 1 // clear cache
  },
  
  rateLimitProfiles: {
    standard: 11, // 100/15min
    ai: 3, // 20/hour
    advanced: 4, // 10/hour  
    cache: 2 // 5/15min
  },
  
  features: {
    crossModuleAnalytics: true,
    aiInsights: true,
    trendAnalysis: true,
    riskAnalytics: true,
    caching: true,
    subscriptionGating: true
  },
  
  timestamp: new Date().toISOString()
});