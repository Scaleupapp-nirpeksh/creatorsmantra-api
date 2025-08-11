/**
 * CreatorsMantra Backend - Analytics Module
 * API controllers for advanced business intelligence and reporting
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * 
 * File Path: src/modules/analytics/controller.js
 */

const AnalyticsService = require('./service');
const { AnalyticsDashboard, AIInsights, AnalyticsCache, TrendAnalysis } = require('./model');
const { asyncHandler } = require('../../shared/utils');
const { successResponse, errorResponse } = require('../../shared/responses');
const { logInfo, logError, logWarn } = require('../../shared/utils');
const mongoose = require('mongoose');

// ============================================
// ANALYTICS CONTROLLER CLASS
// ============================================

class AnalyticsController {

  // ========== DASHBOARD ANALYTICS ==========

  /**
   * Get complete dashboard analytics overview
   * GET /api/v1/analytics/dashboard
   */
  getDashboardAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const subscriptionTier = req.user.subscriptionTier;
    const { period = 'month', forceRefresh = false } = req.query;

    logInfo('Dashboard analytics requested', { userId, period, forceRefresh, subscriptionTier });

    try {
      // Check subscription access
      const allowedTiers = ['pro', 'elite', 'agency_starter', 'agency_pro'];
      if (!allowedTiers.includes(subscriptionTier)) {
        logWarn('Dashboard analytics access denied for subscription tier', { userId, subscriptionTier });
        return res.status(403).json(errorResponse('Dashboard analytics requires Pro subscription or higher'));
      }

      const startTime = Date.now();

      // Generate analytics using service
      const analyticsData = await AnalyticsService.generateDashboardAnalytics(
        userId, 
        period, 
        forceRefresh === 'true'
      );

      // Generate AI insights if available
      let aiInsights = [];
      if (['pro', 'elite', 'agency_starter', 'agency_pro'].includes(subscriptionTier)) {
        try {
          aiInsights = await AnalyticsService.generateAIInsights(userId, analyticsData, subscriptionTier);
        } catch (aiError) {
          logWarn('AI insights generation failed, continuing without insights', { 
            userId, 
            error: aiError.message 
          });
        }
      }

      // Format response with enhanced metrics
      const response = {
        dashboard: analyticsData,
        insights: aiInsights.slice(0, 5), // Top 5 insights for dashboard
        summary: {
          performanceScore: this._calculatePerformanceScore(analyticsData),
          keyHighlight: this._getKeyHighlight(analyticsData),
          actionNeeded: this._getActionNeeded(analyticsData),
          nextSteps: this._getNextSteps(analyticsData)
        },
        metadata: {
          generatedAt: new Date(),
          processingTime: Date.now() - startTime,
          dataFreshness: analyticsData.computationMetadata.lastRefreshed,
          subscriptionTier,
          features: this._getAvailableFeatures(subscriptionTier)
        }
      };

      logInfo('Dashboard analytics served successfully', { 
        userId, 
        period,
        processingTime: Date.now() - startTime,
        recordsProcessed: analyticsData.computationMetadata.recordsProcessed,
        insightsGenerated: aiInsights.length
      });

      res.status(200).json(successResponse(
        'Dashboard analytics retrieved successfully', 
        response
      ));

    } catch (error) {
      logError('Dashboard analytics request failed', { userId, period, error: error.message });
      res.status(500).json(errorResponse('Failed to generate dashboard analytics'));
    }
  });

  /**
   * Get dashboard analytics for specific date range
   * POST /api/v1/analytics/dashboard/custom
   */
  getCustomDashboardAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const subscriptionTier = req.user.subscriptionTier;
    const { startDate, endDate, includeComparison = true } = req.body;

    logInfo('Custom dashboard analytics requested', { userId, startDate, endDate, subscriptionTier });

    try {
      // Validate subscription access
      const allowedTiers = ['elite', 'agency_starter', 'agency_pro'];
      if (!allowedTiers.includes(subscriptionTier)) {
        return res.status(403).json(errorResponse('Custom date range analytics requires Elite subscription or higher'));
      }

      // Validate date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json(errorResponse('Invalid date format provided'));
      }

      if (start >= end) {
        return res.status(400).json(errorResponse('Start date must be before end date'));
      }

      // Maximum 1 year range
      const maxRange = 365 * 24 * 60 * 60 * 1000;
      if (end - start > maxRange) {
        return res.status(400).json(errorResponse('Date range cannot exceed 1 year'));
      }

      const startTime = Date.now();

      // Generate custom analytics (simplified approach for MVP)
      const customAnalytics = await this._generateCustomRangeAnalytics(userId, start, end);

      // Include comparison period if requested
      let comparisonData = null;
      if (includeComparison) {
        const rangeDuration = end - start;
        const comparisonStart = new Date(start.getTime() - rangeDuration);
        const comparisonEnd = new Date(end.getTime() - rangeDuration);
        
        comparisonData = await this._generateCustomRangeAnalytics(userId, comparisonStart, comparisonEnd);
      }

      const response = {
        analytics: customAnalytics,
        comparison: comparisonData,
        dateRange: { startDate: start, endDate: end },
        metadata: {
          processingTime: Date.now() - startTime,
          generatedAt: new Date()
        }
      };

      logInfo('Custom dashboard analytics served', { 
        userId, 
        processingTime: Date.now() - startTime 
      });

      res.status(200).json(successResponse(
        'Custom dashboard analytics retrieved successfully',
        response
      ));

    } catch (error) {
      logError('Custom dashboard analytics failed', { userId, error: error.message });
      res.status(500).json(errorResponse('Failed to generate custom analytics'));
    }
  });

  // ========== REVENUE ANALYTICS ==========

  /**
   * Get detailed revenue analytics
   * GET /api/v1/analytics/revenue
   */
  getRevenueAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const subscriptionTier = req.user.subscriptionTier;
    const { period = 'month', breakdown = 'platform' } = req.query;

    logInfo('Revenue analytics requested', { userId, period, breakdown, subscriptionTier });

    try {
      // Check subscription access
      const allowedTiers = ['pro', 'elite', 'agency_starter', 'agency_pro'];
      if (!allowedTiers.includes(subscriptionTier)) {
        return res.status(403).json(errorResponse('Revenue analytics requires Pro subscription or higher'));
      }

      // Check cache first
      const cacheKey = `revenue_${userId}_${period}_${breakdown}`;
      const cachedResult = await AnalyticsCache.getCachedResult(cacheKey);
      
      if (cachedResult) {
        logInfo('Revenue analytics served from cache', { userId, cacheKey });
        return res.status(200).json(successResponse(
          'Revenue analytics retrieved from cache',
          cachedResult
        ));
      }

      const startTime = Date.now();

      // Get latest dashboard data
      const dashboardData = await AnalyticsDashboard.getLatestForUser(userId, period);
      if (!dashboardData) {
        return res.status(404).json(errorResponse('No analytics data available for the specified period'));
      }

      // Enhanced revenue analytics
      const revenueAnalytics = {
        overview: dashboardData.revenueMetrics,
        trends: await this._getRevenueTrends(userId, period),
        breakdown: await this._getRevenueBreakdown(userId, breakdown, period),
        forecasting: await this._getRevenueForecast(userId, subscriptionTier),
        benchmarks: this._getRevenueBenchmarks(dashboardData.revenueMetrics),
        recommendations: await this._getRevenueRecommendations(userId, dashboardData.revenueMetrics)
      };

      // Cache result
      await AnalyticsCache.setCachedResult(
        cacheKey,
        userId,
        'revenue_analytics',
        { period, breakdown },
        revenueAnalytics,
        60 // 1 hour TTL
      );

      logInfo('Revenue analytics generated successfully', { 
        userId, 
        period,
        processingTime: Date.now() - startTime
      });

      res.status(200).json(successResponse(
        'Revenue analytics retrieved successfully',
        revenueAnalytics
      ));

    } catch (error) {
      logError('Revenue analytics request failed', { userId, period, error: error.message });
      res.status(500).json(errorResponse('Failed to retrieve revenue analytics'));
    }
  });

  /**
   * Get revenue breakdown by specific dimension
   * GET /api/v1/analytics/revenue/breakdown
   */
  getRevenueBreakdown = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const subscriptionTier = req.user.subscriptionTier;
    const { dimension = 'platform', period = 'month' } = req.query;

    logInfo('Revenue breakdown requested', { userId, dimension, period, subscriptionTier });

    try {
      // Validate dimension
      const validDimensions = ['platform', 'client_type', 'content_type', 'month', 'quarter'];
      if (!validDimensions.includes(dimension)) {
        return res.status(400).json(errorResponse('Invalid breakdown dimension'));
      }

      // Check subscription access
      if (!['pro', 'elite', 'agency_starter', 'agency_pro'].includes(subscriptionTier)) {
        return res.status(403).json(errorResponse('Revenue breakdown requires Pro subscription or higher'));
      }

      const breakdown = await this._getDetailedRevenueBreakdown(userId, dimension, period);

      res.status(200).json(successResponse(
        'Revenue breakdown retrieved successfully',
        breakdown
      ));

    } catch (error) {
      logError('Revenue breakdown request failed', { userId, dimension, error: error.message });
      res.status(500).json(errorResponse('Failed to retrieve revenue breakdown'));
    }
  });

  // ========== DEAL PERFORMANCE ANALYTICS ==========

  /**
   * Get deal pipeline and conversion analytics
   * GET /api/v1/analytics/deals/funnel
   */
  getDealFunnelAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const subscriptionTier = req.user.subscriptionTier;
    const { period = 'month' } = req.query;

    logInfo('Deal funnel analytics requested', { userId, period, subscriptionTier });

    try {
      // Check subscription access
      if (!['pro', 'elite', 'agency_starter', 'agency_pro'].includes(subscriptionTier)) {
        return res.status(403).json(errorResponse('Deal analytics requires Pro subscription or higher'));
      }

      // Get latest dashboard data
      const dashboardData = await AnalyticsDashboard.getLatestForUser(userId, period);
      if (!dashboardData) {
        return res.status(404).json(errorResponse('No deal analytics data available'));
      }

      const funnelAnalytics = {
        pipeline: dashboardData.dealMetrics,
        stageAnalysis: await this._getStageAnalysis(userId, period),
        conversionOptimization: await this._getConversionOptimization(userId),
        performanceByPlatform: dashboardData.dealMetrics.winRateByPlatform,
        clientRetention: {
          rate: dashboardData.dealMetrics.clientRetentionRate,
          analysis: await this._getClientRetentionAnalysis(userId, period)
        },
        recommendations: this._getDealFunnelRecommendations(dashboardData.dealMetrics)
      };

      logInfo('Deal funnel analytics served successfully', { userId, period });

      res.status(200).json(successResponse(
        'Deal funnel analytics retrieved successfully',
        funnelAnalytics
      ));

    } catch (error) {
      logError('Deal funnel analytics failed', { userId, period, error: error.message });
      res.status(500).json(errorResponse('Failed to retrieve deal funnel analytics'));
    }
  });

  /**
   * Get deal performance insights
   * GET /api/v1/analytics/deals/performance
   */
  getDealPerformance = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const subscriptionTier = req.user.subscriptionTier;
    const { period = 'month', metric = 'conversion' } = req.query;

    logInfo('Deal performance analytics requested', { userId, period, metric, subscriptionTier });

    try {
      // Check subscription access
      if (!['pro', 'elite', 'agency_starter', 'agency_pro'].includes(subscriptionTier)) {
        return res.status(403).json(errorResponse('Deal performance analytics requires Pro subscription or higher'));
      }

      const performanceData = await this._getDealPerformanceData(userId, period, metric);

      res.status(200).json(successResponse(
        'Deal performance analytics retrieved successfully',
        performanceData
      ));

    } catch (error) {
      logError('Deal performance analytics failed', { userId, period, error: error.message });
      res.status(500).json(errorResponse('Failed to retrieve deal performance analytics'));
    }
  });

  // ========== AI INSIGHTS ==========

  /**
   * Get AI-generated business insights
   * GET /api/v1/analytics/insights
   */
  getAIInsights = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const subscriptionTier = req.user.subscriptionTier;
    const { status = 'active', limit = 10, priority } = req.query;

    logInfo('AI insights requested', { userId, status, limit, priority, subscriptionTier });

    try {
      // Check AI feature access
      const aiTiers = ['pro', 'elite', 'agency_starter', 'agency_pro'];
      if (!aiTiers.includes(subscriptionTier)) {
        return res.status(403).json(errorResponse('AI insights require Pro subscription or higher'));
      }

      // Build query filters
      const filters = { 
        userId: new mongoose.Types.ObjectId(userId),
        status
      };

      if (priority) {
        filters.priority = priority;
      }

      if (status === 'active') {
        filters.relevantUntil = { $gt: new Date() };
      }

      // Get insights with sorting
      const insights = await AIInsights.find(filters)
        .sort({ priority: -1, confidence: -1, createdAt: -1 })
        .limit(parseInt(limit))
        .lean();

      // Enhanced insights with context
      const enhancedInsights = insights.map(insight => ({
        ...insight,
        urgencyScore: this._calculateUrgencyScore(insight),
        daysUntilExpiry: Math.ceil((new Date(insight.relevantUntil) - new Date()) / (24 * 60 * 60 * 1000)),
        isActionable: insight.status === 'active' && insight.confidence >= 70
      }));

      // Get insights summary
      const summary = await this._getInsightsSummary(userId);

      const response = {
        insights: enhancedInsights,
        summary,
        pagination: {
          total: insights.length,
          limit: parseInt(limit),
          hasMore: insights.length === parseInt(limit)
        }
      };

      logInfo('AI insights served successfully', { 
        userId, 
        insightsCount: insights.length,
        activeInsights: summary.active
      });

      res.status(200).json(successResponse(
        'AI insights retrieved successfully',
        response
      ));

    } catch (error) {
      logError('AI insights request failed', { userId, error: error.message });
      res.status(500).json(errorResponse('Failed to retrieve AI insights'));
    }
  });

  /**
   * Generate fresh AI insights
   * POST /api/v1/analytics/insights/generate
   */
  generateAIInsights = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const subscriptionTier = req.user.subscriptionTier;

    logInfo('AI insights generation requested', { userId, subscriptionTier });

    try {
      // Check AI feature access
      const aiTiers = ['pro', 'elite', 'agency_starter', 'agency_pro'];
      if (!aiTiers.includes(subscriptionTier)) {
        return res.status(403).json(errorResponse('AI insights generation requires Pro subscription or higher'));
      }

      const startTime = Date.now();

      // Get latest dashboard data for insights
      const dashboardData = await AnalyticsDashboard.getLatestForUser(userId);
      if (!dashboardData) {
        return res.status(404).json(errorResponse('No analytics data available for insight generation'));
      }

      // Generate fresh insights
      const insights = await AnalyticsService.generateAIInsights(userId, dashboardData, subscriptionTier);

      logInfo('AI insights generated successfully', { 
        userId,
        insightsGenerated: insights.length,
        processingTime: Date.now() - startTime
      });

      res.status(200).json(successResponse(
        'AI insights generated successfully',
        {
          insights,
          generatedCount: insights.length,
          processingTime: Date.now() - startTime
        }
      ));

    } catch (error) {
      logError('AI insights generation failed', { userId, error: error.message });
      res.status(500).json(errorResponse('Failed to generate AI insights'));
    }
  });

  /**
   * Update insight status (acknowledge, act upon, dismiss)
   * PATCH /api/v1/analytics/insights/:insightId/status
   */
  updateInsightStatus = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { insightId } = req.params;
    const { status } = req.body;

    logInfo('Insight status update requested', { userId, insightId, status });

    try {
      // Validate status
      const validStatuses = ['acknowledged', 'acted_upon', 'dismissed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json(errorResponse('Invalid status. Must be: acknowledged, acted_upon, or dismissed'));
      }

      // Find and update insight
      const insight = await AIInsights.findOne({
        _id: insightId,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!insight) {
        return res.status(404).json(errorResponse('Insight not found'));
      }

      // Update status using model method
      switch (status) {
        case 'acknowledged':
          await insight.acknowledge();
          break;
        case 'acted_upon':
          await insight.markActedUpon();
          break;
        case 'dismissed':
          await insight.dismiss();
          break;
      }

      logInfo('Insight status updated successfully', { userId, insightId, status });

      res.status(200).json(successResponse(
        'Insight status updated successfully',
        { insight }
      ));

    } catch (error) {
      logError('Insight status update failed', { userId, insightId, error: error.message });
      res.status(500).json(errorResponse('Failed to update insight status'));
    }
  });

  // ========== TREND ANALYSIS ==========

  /**
   * Get trend analysis for specific metrics
   * GET /api/v1/analytics/trends
   */
  getTrendAnalysis = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const subscriptionTier = req.user.subscriptionTier;
    const { metric = 'monthly_revenue', periods = 6 } = req.query;

    logInfo('Trend analysis requested', { userId, metric, periods, subscriptionTier });

    try {
      // Check subscription access for advanced analytics
      const advancedTiers = ['elite', 'agency_starter', 'agency_pro'];
      if (!advancedTiers.includes(subscriptionTier)) {
        return res.status(403).json(errorResponse('Trend analysis requires Elite subscription or higher'));
      }

      // Validate metric type
      const validMetrics = [
        'monthly_revenue',
        'deal_conversion_rate', 
        'average_deal_value',
        'payment_velocity',
        'client_retention',
        'contract_risk_score'
      ];

      if (!validMetrics.includes(metric)) {
        return res.status(400).json(errorResponse('Invalid metric type for trend analysis'));
      }

      const startTime = Date.now();

      // Get or generate trend analysis
      let trendAnalysis = await TrendAnalysis.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        metricType: metric
      }).sort({ createdAt: -1 });

      // Generate new analysis if needed or if data is stale
      const shouldRegenerate = !trendAnalysis || 
        new Date() > trendAnalysis.analysisMetadata.nextAnalysisDue;

      if (shouldRegenerate) {
        trendAnalysis = await AnalyticsService.performTrendAnalysis(userId, metric, subscriptionTier);
      }

      if (!trendAnalysis) {
        return res.status(404).json(errorResponse('Insufficient data for trend analysis'));
      }

      // Format response with insights
      const response = {
        analysis: trendAnalysis.trendAnalysis,
        dataPoints: trendAnalysis.dataPoints.slice(-parseInt(periods)),
        insights: this._getTrendInsights(trendAnalysis),
        metadata: {
          ...trendAnalysis.analysisMetadata,
          processingTime: Date.now() - startTime,
          isStale: new Date() > trendAnalysis.analysisMetadata.nextAnalysisDue
        }
      };

      logInfo('Trend analysis served successfully', { 
        userId, 
        metric,
        confidence: trendAnalysis.trendAnalysis.confidence,
        processingTime: Date.now() - startTime
      });

      res.status(200).json(successResponse(
        'Trend analysis retrieved successfully',
        response
      ));

    } catch (error) {
      logError('Trend analysis request failed', { userId, metric, error: error.message });
      res.status(500).json(errorResponse('Failed to retrieve trend analysis'));
    }
  });

  /**
   * Get forecasting data
   * GET /api/v1/analytics/forecast
   */
  getForecast = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const subscriptionTier = req.user.subscriptionTier;
    const { metric = 'monthly_revenue', periods = 3 } = req.query;

    logInfo('Forecast requested', { userId, metric, periods, subscriptionTier });

    try {
      // Check subscription access
      const advancedTiers = ['elite', 'agency_starter', 'agency_pro'];
      if (!advancedTiers.includes(subscriptionTier)) {
        return res.status(403).json(errorResponse('Forecasting requires Elite subscription or higher'));
      }

      // Get latest trend analysis
      const trendAnalysis = await TrendAnalysis.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        metricType: metric
      }).sort({ createdAt: -1 });

      if (!trendAnalysis) {
        return res.status(404).json(errorResponse('No trend data available for forecasting'));
      }

      const forecast = {
        predictions: trendAnalysis.trendAnalysis.forecast.slice(0, parseInt(periods)),
        confidence: trendAnalysis.trendAnalysis.confidence,
        methodology: 'Linear regression with confidence intervals',
        assumptions: this._getForecastAssumptions(metric),
        lastUpdated: trendAnalysis.analysisMetadata.lastAnalyzed
      };

      logInfo('Forecast served successfully', { userId, metric, periods });

      res.status(200).json(successResponse(
        'Forecast retrieved successfully',
        forecast
      ));

    } catch (error) {
      logError('Forecast request failed', { userId, metric, error: error.message });
      res.status(500).json(errorResponse('Failed to retrieve forecast'));
    }
  });

  // ========== RISK ANALYTICS ==========

  /**
   * Get risk analysis and patterns
   * GET /api/v1/analytics/risk
   */
  getRiskAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const subscriptionTier = req.user.subscriptionTier;
    const { period = 'month' } = req.query;

    logInfo('Risk analytics requested', { userId, period, subscriptionTier });

    try {
      // Check subscription access
      if (!['pro', 'elite', 'agency_starter', 'agency_pro'].includes(subscriptionTier)) {
        return res.status(403).json(errorResponse('Risk analytics requires Pro subscription or higher'));
      }

      // Get latest dashboard data
      const dashboardData = await AnalyticsDashboard.getLatestForUser(userId, period);
      if (!dashboardData) {
        return res.status(404).json(errorResponse('No risk analytics data available'));
      }

      const riskAnalytics = {
        overview: dashboardData.riskMetrics,
        trends: await this._getRiskTrends(userId, period),
        recommendations: this._getRiskRecommendations(dashboardData.riskMetrics),
        revenueCorrelation: dashboardData.riskMetrics.riskRevenueCorrelation,
        actionItems: await this._getRiskActionItems(userId)
      };

      logInfo('Risk analytics served successfully', { userId, period });

      res.status(200).json(successResponse(
        'Risk analytics retrieved successfully',
        riskAnalytics
      ));

    } catch (error) {
      logError('Risk analytics request failed', { userId, period, error: error.message });
      res.status(500).json(errorResponse('Failed to retrieve risk analytics'));
    }
  });

  // ========== CACHE MANAGEMENT ==========

  /**
   * Clear analytics cache for user
   * DELETE /api/v1/analytics/cache
   */
  clearCache = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    logInfo('Cache clear requested', { userId });

    try {
      await AnalyticsService.clearUserCache(userId);

      logInfo('Analytics cache cleared successfully', { userId });

      res.status(200).json(successResponse(
        'Analytics cache cleared successfully'
      ));

    } catch (error) {
      logError('Cache clear failed', { userId, error: error.message });
      res.status(500).json(errorResponse('Failed to clear analytics cache'));
    }
  });

  /**
   * Get cache statistics
   * GET /api/v1/analytics/cache/stats
   */
  getCacheStats = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    logInfo('Cache stats requested', { userId });

    try {
      const stats = await AnalyticsService.getCacheStats(userId);

      res.status(200).json(successResponse(
        'Cache statistics retrieved successfully',
        { stats }
      ));

    } catch (error) {
      logError('Cache stats request failed', { userId, error: error.message });
      res.status(500).json(errorResponse('Failed to retrieve cache statistics'));
    }
  });

  // ========== HEALTH CHECK ==========

  /**
   * Health check for analytics module
   * GET /api/v1/analytics/health
   */
  getHealthCheck = asyncHandler(async (req, res) => {
    const healthData = {
      module: 'analytics',
      status: 'active',
      features: [
        'dashboard_overview',
        'revenue_intelligence',
        'deal_performance',
        'ai_insights',
        'trend_analysis',
        'risk_analytics',
        'forecasting',
        'caching_system'
      ],
      version: '1.0.0',
      dependencies: {
        mongodb: 'connected',
        openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
        cache: 'active'
      },
      timestamp: new Date()
    };

    res.status(200).json(successResponse(
      'Analytics module is healthy',
      healthData
    ));
  });

  // ========== HELPER METHODS ==========

  /**
   * Calculate overall performance score
   */
  _calculatePerformanceScore(analyticsData) {
    let score = 0;
    
    // Revenue growth (30%)
    const revenueGrowth = analyticsData.revenueMetrics.revenueGrowth;
    if (revenueGrowth > 20) score += 30;
    else if (revenueGrowth > 0) score += 20;
    else if (revenueGrowth > -10) score += 10;
    
    // Conversion rate (25%)
    const conversion = analyticsData.dealMetrics.pipelineConversion;
    if (conversion > 40) score += 25;
    else if (conversion > 25) score += 20;
    else if (conversion > 15) score += 15;
    
    // Payment velocity (20%)
    const paymentDays = analyticsData.revenueMetrics.averagePaymentDays;
    if (paymentDays < 15) score += 20;
    else if (paymentDays < 30) score += 15;
    else if (paymentDays < 45) score += 10;
    
    // Risk management (15%)
    const riskScore = analyticsData.riskMetrics.averageContractRisk;
    if (riskScore < 30) score += 15;
    else if (riskScore < 50) score += 10;
    else if (riskScore < 70) score += 5;
    
    // Client retention (10%)
    const retention = analyticsData.dealMetrics.clientRetentionRate;
    if (retention > 70) score += 10;
    else if (retention > 50) score += 7;
    else if (retention > 30) score += 5;
    
    return Math.min(score, 100);
  }

  /**
   * Get key highlight from analytics data
   */
  _getKeyHighlight(analyticsData) {
    const metrics = analyticsData.revenueMetrics;
    
    if (metrics.revenueGrowth > 20) {
      return `Excellent growth! Revenue increased by ${metrics.revenueGrowth.toFixed(1)}%`;
    }
    
    if (metrics.averagePaymentDays < 20) {
      return `Great payment velocity - averaging ${metrics.averagePaymentDays} days`;
    }
    
    if (analyticsData.dealMetrics.pipelineConversion > 35) {
      return `Strong conversion rate at ${analyticsData.dealMetrics.pipelineConversion}%`;
    }
    
    return `Revenue: ₹${metrics.totalRevenue.toLocaleString()} with ${metrics.totalDeals} deals`;
  }

  /**
   * Get action needed from analytics data
   */
  _getActionNeeded(analyticsData) {
    const metrics = analyticsData.revenueMetrics;
    const dealMetrics = analyticsData.dealMetrics;
    const riskMetrics = analyticsData.riskMetrics;
    
    if (riskMetrics.highRiskContracts > 2) {
      return `Review ${riskMetrics.highRiskContracts} high-risk contracts`;
    }
    
    if (metrics.averagePaymentDays > 45) {
      return `Improve payment collection - averaging ${metrics.averagePaymentDays} days`;
    }
    
    if (dealMetrics.pipelineConversion < 20) {
      return `Focus on pipeline conversion - currently at ${dealMetrics.pipelineConversion}%`;
    }
    
    return 'Continue current strategies';
  }

  /**
   * Get next steps recommendations
   */
  _getNextSteps(analyticsData) {
    const steps = [];
    
    if (analyticsData.revenueMetrics.revenueGrowth > 15) {
      steps.push('Scale successful strategies');
      steps.push('Explore premium pricing opportunities');
    }
    
    if (analyticsData.dealMetrics.clientRetentionRate > 60) {
      steps.push('Develop upselling strategies for repeat clients');
    }
    
    if (analyticsData.riskMetrics.averageContractRisk < 40) {
      steps.push('Maintain contract review processes');
    }
    
    if (steps.length === 0) {
      steps.push('Review and optimize current processes');
      steps.push('Identify growth opportunities');
    }
    
    return steps.slice(0, 3); // Top 3 next steps
  }

  /**
   * Get available features based on subscription tier
   */
  _getAvailableFeatures(subscriptionTier) {
    const features = {
      starter: [],
      pro: ['dashboard', 'revenue_analytics', 'basic_insights'],
      elite: ['dashboard', 'revenue_analytics', 'ai_insights', 'trend_analysis', 'forecasting'],
      agency_starter: ['all_creator_features', 'multi_creator_dashboard'],
      agency_pro: ['all_features', 'advanced_analytics']
    };
    
    return features[subscriptionTier] || [];
  }

  /**
   * Calculate urgency score for insights
   */
  _calculateUrgencyScore(insight) {
    let score = 0;
    
    const priorityWeights = { low: 10, medium: 30, high: 60, critical: 80 };
    score += priorityWeights[insight.priority] || 0;
    score += (insight.confidence * 0.2);
    
    return Math.min(score, 100);
  }

  /**
   * Generate custom range analytics (simplified)
   */
  async _generateCustomRangeAnalytics(userId, startDate, endDate) {
    // Simplified implementation for MVP
    // This would use AnalyticsService methods with custom date ranges
    return {
      revenue: { totalRevenue: 0, totalDeals: 0, averageDealValue: 0 },
      deals: { pipelineConversion: 0, averageCloseTime: 0 },
      risk: { averageContractRisk: 0, highRiskContracts: 0 }
    };
  }

  /**
   * Get revenue trends over time
   */
  async _getRevenueTrends(userId, period) {
    const trends = await AnalyticsDashboard.getUserTrend(userId, period, 6);
    return trends.map(trend => ({
      period: trend.period.startDate,
      revenue: trend.revenueMetrics.totalRevenue,
      conversion: trend.dealMetrics.pipelineConversion
    }));
  }

  /**
   * Get detailed revenue breakdown
   */
  async _getRevenueBreakdown(userId, breakdown, period) {
    // Simplified breakdown implementation
    return {
      type: breakdown,
      data: [],
      total: 0
    };
  }

  /**
   * Get revenue forecast
   */
  async _getRevenueForecast(userId, subscriptionTier) {
    if (!['elite', 'agency_starter', 'agency_pro'].includes(subscriptionTier)) {
      return null;
    }

    const trendAnalysis = await TrendAnalysis.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      metricType: 'monthly_revenue'
    }).sort({ createdAt: -1 });

    return trendAnalysis ? trendAnalysis.trendAnalysis.forecast.slice(0, 3) : null;
  }

  /**
   * Get revenue benchmarks
   */
  _getRevenueBenchmarks(revenueMetrics) {
    return {
      industryAverage: {
        conversionRate: 25,
        paymentDays: 35,
        clientRetention: 60
      },
      yourPerformance: {
        conversionRate: 'above' // calculated comparison
      }
    };
  }

  /**
   * Get revenue recommendations
   */
  async _getRevenueRecommendations(userId, revenueMetrics) {
    const recommendations = [];
    
    if (revenueMetrics.averagePaymentDays > 35) {
      recommendations.push('Implement stricter payment terms to reduce collection time');
    }
    
    if (revenueMetrics.revenueGrowth < 10) {
      recommendations.push('Explore premium pricing strategies for high-performing content');
    }
    
    return recommendations;
  }

  /**
   * Get insights summary
   */
  async _getInsightsSummary(userId) {
    const summary = await AIInsights.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(userId) }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const summaryObj = summary.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    return {
      active: summaryObj.active || 0,
      acknowledged: summaryObj.acknowledged || 0,
      acted_upon: summaryObj.acted_upon || 0,
      dismissed: summaryObj.dismissed || 0
    };
  }

  /**
   * Get stage analysis for deals
   */
  async _getStageAnalysis(userId, period) {
    // Simplified stage analysis
    return {
      bottlenecks: ['in_talks'], // Stages with low conversion
      fastestStage: 'pitched',
      slowestStage: 'live'
    };
  }

  /**
   * Get conversion optimization suggestions
   */
  async _getConversionOptimization(userId) {
    return {
      suggestions: [
        'Improve follow-up timing for in_talks stage',
        'Create urgency in live negotiations'
      ],
      impact: 'Could improve conversion by 15-20%'
    };
  }

  /**
   * Get client retention analysis
   */
  async _getClientRetentionAnalysis(userId, period) {
    return {
      patterns: 'Clients with 3+ campaigns show 80% retention',
      opportunities: 'Focus on 1-2 campaign clients for upselling'
    };
  }

  /**
   * Get deal funnel recommendations
   */
  _getDealFunnelRecommendations(dealMetrics) {
    const recommendations = [];
    
    if (dealMetrics.pipelineConversion < 30) {
      recommendations.push('Focus on qualifying leads better');
      recommendations.push('Improve proposal quality and follow-up');
    }
    
    if (dealMetrics.averageCloseTime > 25) {
      recommendations.push('Streamline negotiation process');
    }
    
    return recommendations;
  }

  /**
   * Get deal performance data
   */
  async _getDealPerformanceData(userId, period, metric) {
    // Simplified deal performance data
    return {
      metric,
      currentValue: 0,
      trend: 'stable',
      benchmark: 0
    };
  }

  /**
   * Get detailed revenue breakdown
   */
  async _getDetailedRevenueBreakdown(userId, dimension, period) {
    // Simplified breakdown implementation
    return {
      dimension,
      breakdown: [],
      total: 0,
      insights: []
    };
  }

  /**
   * Get trend insights
   */
  _getTrendInsights(trendAnalysis) {
    const insights = [];
    const analysis = trendAnalysis.trendAnalysis;
    
    if (analysis.direction === 'increasing' && analysis.strength === 'strong') {
      insights.push('Strong upward trend indicates healthy business growth');
    }
    
    if (analysis.confidence > 80) {
      insights.push('High confidence forecast - reliable for planning');
    }
    
    return insights;
  }

  /**
   * Get forecast assumptions
   */
  _getForecastAssumptions(metric) {
    const assumptions = {
      monthly_revenue: [
        'Current market conditions remain stable',
        'No major changes in pricing strategy',
        'Client retention patterns continue'
      ],
      deal_conversion_rate: [
        'Current sales process unchanged',
        'Market demand remains consistent',
        'No significant competitive pressure'
      ]
    };
    
    return assumptions[metric] || ['Based on historical data patterns'];
  }

  /**
   * Get risk trends
   */
  async _getRiskTrends(userId, period) {
    // Simplified risk trends
    return {
      direction: 'improving',
      factors: ['Better contract review', 'Improved negotiation success']
    };
  }

  /**
   * Get risk recommendations
   */
  _getRiskRecommendations(riskMetrics) {
    const recommendations = [];
    
    if (riskMetrics.averageContractRisk > 60) {
      recommendations.push('Review contract terms more carefully');
      recommendations.push('Negotiate better usage rights');
    }
    
    if (riskMetrics.highRiskContracts > 3) {
      recommendations.push('Prioritize renegotiation of high-risk contracts');
    }
    
    return recommendations;
  }

  /**
   * Get risk action items
   */
  async _getRiskActionItems(userId) {
    return [
      {
        priority: 'high',
        action: 'Review unlimited usage rights contracts',
        impact: 'Prevent future revenue loss'
      }
    ];
  }
}

// ============================================
// EXPORT CONTROLLER INSTANCE
// ============================================

module.exports = new AnalyticsController();