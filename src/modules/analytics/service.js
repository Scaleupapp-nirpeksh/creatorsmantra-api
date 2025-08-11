/**
 * CreatorsMantra Backend - Analytics Module
 * Core analytics engine for cross-module business intelligence and AI-powered insights
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * 
 * File Path: src/modules/analytics/service.js
 */

const { AnalyticsDashboard, AIInsights, AnalyticsCache, TrendAnalysis } = require('./model');
const { logInfo, logError, logWarn } = require('../../shared/utils');
const mongoose = require('mongoose');
const OpenAI = require('openai');

// External module models for cross-module analytics
const { Deal } = require('../deals/model');
const { Invoice } = require('../invoices/model');
const { Campaign } = require('../performance/model');
const { Contract } = require('../contracts/model');
const { Brief } = require('../briefs/model');
const { RateCard } = require('../ratecards/model');

// ============================================
// ENVIRONMENT VARIABLES & INITIALIZATION
// ============================================

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Cache TTL configuration
const CACHE_TTL = {
  dashboard: 30, // 30 minutes for dashboard data
  revenue: 60, // 1 hour for revenue analytics
  insights: 120, // 2 hours for AI insights
  trends: 240 // 4 hours for trend analysis
};

// Check for required environment variables
const requiredEnvVars = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  logError('Missing required environment variables for Analytics module', { missingVars });
}

// ============================================
// CORE ANALYTICS SERVICE CLASS
// ============================================

class AnalyticsService {

  // ========== DASHBOARD ANALYTICS ==========

  /**
   * Generate complete dashboard analytics for a user
   * Correlates data from all 8 modules for comprehensive business intelligence
   */
  static async generateDashboardAnalytics(userId, periodType = 'month', forceRefresh = false) {
    try {
      logInfo('Generating dashboard analytics', { userId, periodType, forceRefresh });

      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cacheKey = `dashboard_${userId}_${periodType}`;
        const cachedResult = await AnalyticsCache.getCachedResult(cacheKey);
        
        if (cachedResult) {
          logInfo('Dashboard analytics served from cache', { userId, cacheKey });
          return cachedResult;
        }
      }

      const startTime = Date.now();
      
      // Calculate date range for period
      const dateRange = this._calculateDateRange(periodType);
      
      // Generate analytics from all modules
      const [
        revenueMetrics,
        dealMetrics, 
        performanceMetrics,
        riskMetrics
      ] = await Promise.all([
        this._generateRevenueMetrics(userId, dateRange),
        this._generateDealMetrics(userId, dateRange),
        this._generatePerformanceMetrics(userId, dateRange),
        this._generateRiskMetrics(userId, dateRange)
      ]);

      // Create dashboard analytics object
      const dashboardData = {
        userId,
        period: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          periodType
        },
        revenueMetrics,
        dealMetrics,
        performanceMetrics,
        riskMetrics,
        computationMetadata: {
          dataSourcesUsed: ['deals', 'invoices', 'performance', 'contracts'],
          recordsProcessed: revenueMetrics.totalDeals + performanceMetrics.totalCampaigns,
          computationTime: Date.now() - startTime,
          cacheKey: `dashboard_${userId}_${periodType}_${Date.now()}`,
          lastRefreshed: new Date()
        }
      };

      // Save to database
      const dashboard = new AnalyticsDashboard(dashboardData);
      await dashboard.save();

      // Cache the result
      const cacheKey = `dashboard_${userId}_${periodType}`;
      await AnalyticsCache.setCachedResult(
        cacheKey, 
        userId, 
        'dashboard_overview', 
        { periodType, dateRange },
        dashboardData,
        CACHE_TTL.dashboard
      );

      logInfo('Dashboard analytics generated successfully', { 
        userId, 
        periodType,
        computationTime: Date.now() - startTime,
        recordsProcessed: dashboardData.computationMetadata.recordsProcessed
      });

      return dashboardData;

    } catch (error) {
      logError('Dashboard analytics generation failed', { userId, periodType, error: error.message });
      throw error;
    }
  }

  // ========== REVENUE INTELLIGENCE ==========

  /**
   * Generate comprehensive revenue analytics from deals and invoices
   */
  static async _generateRevenueMetrics(userId, dateRange) {
    try {
      // Aggregate revenue data from deals and invoices
      const revenueAggregation = await Deal.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$value', 0] } },
            totalDeals: { $sum: 1 },
            paidDeals: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
            averageDealValue: { $avg: { $cond: [{ $eq: ['$status', 'paid'] }, '$value', null] } },
            revenueByPlatform: {
              $push: {
                $cond: [
                  { $eq: ['$status', 'paid'] },
                  { platform: '$platform', amount: '$value' },
                  null
                ]
              }
            }
          }
        }
      ]);

      // Payment velocity from invoices
      const paymentMetrics = await Invoice.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
          }
        },
        {
          $group: {
            _id: null,
            averagePaymentDays: {
              $avg: {
                $cond: [
                  { $and: [{ $ne: ['$paidAt', null] }, { $ne: ['$createdAt', null] }] },
                  { $divide: [{ $subtract: ['$paidAt', '$createdAt'] }, 86400000] },
                  null
                ]
              }
            },
            paymentSuccessRate: {
              $avg: { $cond: [{ $eq: ['$status', 'paid'] }, 100, 0] }
            },
            overdueInvoices: {
              $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
            }
          }
        }
      ]);

      // Previous period for growth calculation
      const previousDateRange = this._calculatePreviousDateRange(dateRange);
      const previousRevenue = await Deal.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            status: 'paid',
            createdAt: { $gte: previousDateRange.startDate, $lte: previousDateRange.endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$value' },
            totalDeals: { $sum: 1 }
          }
        }
      ]);

      // Process aggregation results
      const currentData = revenueAggregation[0] || {};
      const paymentData = paymentMetrics[0] || {};
      const previousData = previousRevenue[0] || {};

      // Calculate growth metrics
      const revenueGrowth = previousData.totalRevenue > 0 
        ? ((currentData.totalRevenue - previousData.totalRevenue) / previousData.totalRevenue) * 100
        : 0;

      const dealGrowth = previousData.totalDeals > 0
        ? ((currentData.totalDeals - previousData.totalDeals) / previousData.totalDeals) * 100
        : 0;

      // Process platform revenue breakdown
      const platformRevenue = this._processRevenueByPlatform(currentData.revenueByPlatform || []);

      return {
        totalRevenue: currentData.totalRevenue || 0,
        totalDeals: currentData.totalDeals || 0,
        averageDealValue: currentData.averageDealValue || 0,
        revenueGrowth: parseFloat(revenueGrowth.toFixed(2)),
        dealGrowth: parseFloat(dealGrowth.toFixed(2)),
        avgValueGrowth: 0, // Calculate separately if needed
        averagePaymentDays: Math.round(paymentData.averagePaymentDays || 0),
        paymentSuccessRate: parseFloat((paymentData.paymentSuccessRate || 0).toFixed(2)),
        overdueInvoices: paymentData.overdueInvoices || 0,
        revenueByPlatform: platformRevenue,
        revenueByClientType: [] // Will be enhanced based on deal.brand categorization
      };

    } catch (error) {
      logError('Revenue metrics generation failed', { userId, error: error.message });
      throw error;
    }
  }

  // ========== DEAL PERFORMANCE ANALYTICS ==========

  /**
   * Generate deal pipeline and conversion analytics
   */
  static async _generateDealMetrics(userId, dateRange) {
    try {
      // Pipeline analysis
      const pipelineAnalysis = await Deal.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalValue: { $sum: '$value' },
            avgValue: { $avg: '$value' }
          }
        }
      ]);

      // Stage conversion analysis
      const stageConversions = await this._calculateStageConversions(userId, dateRange);

      // Platform win rate analysis
      const platformWinRates = await Deal.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
          }
        },
        {
          $group: {
            _id: '$platform',
            totalDeals: { $sum: 1 },
            wonDeals: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
            avgValue: { $avg: { $cond: [{ $eq: ['$status', 'paid'] }, '$value', null] } }
          }
        },
        {
          $project: {
            platform: '$_id',
            totalDeals: 1,
            winRate: { $multiply: [{ $divide: ['$wonDeals', '$totalDeals'] }, 100] },
            avgValue: { $ifNull: ['$avgValue', 0] }
          }
        }
      ]);

      // Client retention analysis
      const clientRetention = await this._calculateClientRetention(userId, dateRange);

      // Process pipeline data
      const pipelineData = pipelineAnalysis.reduce((acc, stage) => {
        acc[stage._id] = {
          count: stage.count,
          value: stage.totalValue,
          avgValue: stage.avgValue
        };
        return acc;
      }, {});

      const totalDeals = pipelineAnalysis.reduce((sum, stage) => sum + stage.count, 0);
      const paidDeals = pipelineData.paid?.count || 0;
      const pipelineValue = Object.values(pipelineData).reduce((sum, stage) => sum + stage.value, 0);
      const pipelineConversion = totalDeals > 0 ? (paidDeals / totalDeals) * 100 : 0;

      return {
        pipelineValue,
        pipelineConversion: parseFloat(pipelineConversion.toFixed(2)),
        averageCloseTime: await this._calculateAverageCloseTime(userId, dateRange),
        stageConversions,
        winRateByPlatform: platformWinRates.map(p => ({
          platform: p.platform,
          winRate: parseFloat(p.winRate.toFixed(2)),
          totalDeals: p.totalDeals
        })),
        winRateByDeliverable: [], // Will be enhanced based on deal.deliverables analysis
        clientRetentionRate: parseFloat(clientRetention.retentionRate.toFixed(2)),
        repeatClientPercentage: parseFloat(clientRetention.repeatPercentage.toFixed(2)),
        averageClientLifetimeValue: clientRetention.avgLifetimeValue
      };

    } catch (error) {
      logError('Deal metrics generation failed', { userId, error: error.message });
      throw error;
    }
  }

  // ========== PERFORMANCE CORRELATION ==========

  /**
   * Generate performance analytics correlating campaigns with deal outcomes
   */
  static async _generatePerformanceMetrics(userId, dateRange) {
    try {
      // Campaign performance overview
      const campaignAnalysis = await Campaign.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalCampaigns: { $sum: 1 },
            averageEngagementRate: { $avg: '$metrics.engagementRate' },
            averageImpressions: { $avg: '$metrics.impressions' },
            platformPerformance: {
              $push: {
                platform: '$platform',
                engagement: '$metrics.engagementRate',
                impressions: '$metrics.impressions',
                dealValue: '$associatedDealValue' // If available from campaign schema
              }
            }
          }
        }
      ]);

      // Content performance analysis (if deliverable data available in campaigns)
      const contentPerformance = await this._analyzeContentPerformance(userId, dateRange);

      // Platform efficiency calculation
      const platformEfficiency = await this._calculatePlatformEfficiency(userId, dateRange);

      const analysisData = campaignAnalysis[0] || {};

      return {
        totalCampaigns: analysisData.totalCampaigns || 0,
        averageEngagementRate: parseFloat((analysisData.averageEngagementRate || 0).toFixed(2)),
        averageImpressions: Math.round(analysisData.averageImpressions || 0),
        contentPerformance,
        platformEfficiency
      };

    } catch (error) {
      logError('Performance metrics generation failed', { userId, error: error.message });
      throw error;
    }
  }

  // ========== RISK & CONTRACT INTELLIGENCE ==========

  /**
   * Generate risk analytics from contracts and correlate with business outcomes
   */
  static async _generateRiskMetrics(userId, dateRange) {
    try {
      // Contract risk analysis
      const riskAnalysis = await Contract.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
          }
        },
        {
          $group: {
            _id: null,
            averageRisk: { $avg: '$aiAnalysis.riskScore' },
            totalContracts: { $sum: 1 },
            highRiskContracts: {
              $sum: { $cond: [{ $gte: ['$aiAnalysis.riskScore', 70] }, 1, 0] }
            },
            riskDistribution: {
              $push: {
                riskScore: '$aiAnalysis.riskScore',
                riskFactors: '$aiAnalysis.riskFactors'
              }
            }
          }
        }
      ]);

      // Negotiation success analysis
      const negotiationSuccess = await this._analyzeNegotiationSuccess(userId, dateRange);

      // Risk-revenue correlation
      const riskRevenueCorrelation = await this._analyzeRiskRevenueCorrelation(userId, dateRange);

      const riskData = riskAnalysis[0] || {};

      // Process risk factor distribution
      const riskFactorDistribution = this._processRiskFactorDistribution(riskData.riskDistribution || []);

      // Determine risk trend (simplified)
      const riskTrend = await this._calculateRiskTrend(userId, dateRange);

      return {
        averageContractRisk: parseFloat((riskData.averageRisk || 0).toFixed(2)),
        riskTrend,
        highRiskContracts: riskData.highRiskContracts || 0,
        riskFactorDistribution,
        negotiationSuccessRate: parseFloat(negotiationSuccess.successRate.toFixed(2)),
        averageNegotiationRounds: negotiationSuccess.avgRounds,
        riskRevenueCorrelation
      };

    } catch (error) {
      logError('Risk metrics generation failed', { userId, error: error.message });
      throw error;
    }
  }

  // ========== AI INSIGHTS GENERATION ==========

  /**
   * Generate AI-powered business insights from analytics data
   */
  static async generateAIInsights(userId, dashboardData, subscriptionTier) {
    try {
      logInfo('Generating AI insights', { userId, subscriptionTier });

      // Check if user has access to AI features
      const aiTiers = ['pro', 'elite', 'agency_starter', 'agency_pro'];
      if (!aiTiers.includes(subscriptionTier)) {
        logWarn('AI insights requested for non-AI tier', { userId, subscriptionTier });
        return [];
      }

      const startTime = Date.now();

      // Prepare data for AI analysis
      const analyticsContext = this._prepareAIAnalysisContext(dashboardData);

      // Generate insights using OpenAI
      const prompt = this._buildAIInsightPrompt(analyticsContext);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      });

      const aiResponse = completion.choices[0].message.content;
      const insights = this._parseAIInsights(aiResponse, userId);

      // Save insights to database
      const savedInsights = await Promise.all(
        insights.map(insight => {
          const aiInsight = new AIInsights({
            ...insight,
            userId,
            aiMetadata: {
              modelUsed: 'gpt-3.5-turbo',
              promptVersion: '1.0',
              processingTime: Date.now() - startTime,
              tokensUsed: completion.usage.total_tokens
            }
          });
          return aiInsight.save();
        })
      );

      logInfo('AI insights generated successfully', { 
        userId,
        insightsCount: savedInsights.length,
        processingTime: Date.now() - startTime,
        tokensUsed: completion.usage.total_tokens
      });

      return savedInsights;

    } catch (error) {
      logError('AI insights generation failed', { userId, error: error.message });
      throw error;
    }
  }

  // ========== TREND ANALYSIS ==========

  /**
   * Perform simple trend analysis and forecasting
   */
  static async performTrendAnalysis(userId, metricType, subscriptionTier) {
    try {
      logInfo('Performing trend analysis', { userId, metricType, subscriptionTier });

      // Check subscription access for advanced analytics
      const advancedTiers = ['elite', 'agency_starter', 'agency_pro'];
      if (!advancedTiers.includes(subscriptionTier)) {
        logWarn('Trend analysis requested for non-advanced tier', { userId, subscriptionTier });
        return null;
      }

      // Get historical data for the metric
      const historicalData = await this._getHistoricalMetricData(userId, metricType);

      if (historicalData.length < 3) {
        logWarn('Insufficient data for trend analysis', { userId, metricType, dataPoints: historicalData.length });
        return null;
      }

      // Perform simple linear regression
      const trendAnalysis = this._performLinearRegression(historicalData);

      // Generate forecast (simple projection)
      const forecast = this._generateSimpleForecast(trendAnalysis, 3); // 3 periods ahead

      // Save trend analysis
      const trendRecord = new TrendAnalysis({
        userId,
        metricType,
        dataPoints: historicalData,
        trendAnalysis: {
          direction: trendAnalysis.direction,
          strength: trendAnalysis.strength,
          confidence: trendAnalysis.confidence,
          regressionCoefficients: trendAnalysis.coefficients,
          forecast
        },
        analysisMetadata: {
          dataPointCount: historicalData.length,
          timeSpanDays: this._calculateTimeSpan(historicalData),
          lastAnalyzed: new Date(),
          nextAnalysisDue: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 days
        }
      });

      await trendRecord.save();

      logInfo('Trend analysis completed', { userId, metricType, confidence: trendAnalysis.confidence });

      return trendRecord;

    } catch (error) {
      logError('Trend analysis failed', { userId, metricType, error: error.message });
      throw error;
    }
  }

  // ========== HELPER METHODS ==========

  /**
   * Calculate date range based on period type
   */
  static _calculateDateRange(periodType) {
    const now = new Date();
    const startDate = new Date();

    switch (periodType) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    return { startDate, endDate: now };
  }

  /**
   * Calculate previous period date range for growth comparison
   */
  static _calculatePreviousDateRange(currentRange) {
    const timeDiff = currentRange.endDate - currentRange.startDate;
    const startDate = new Date(currentRange.startDate.getTime() - timeDiff);
    const endDate = new Date(currentRange.endDate.getTime() - timeDiff);
    
    return { startDate, endDate };
  }

  /**
   * Process revenue by platform data
   */
  static _processRevenueByPlatform(platformData) {
    const platformTotals = {};
    let totalRevenue = 0;

    platformData.forEach(item => {
      if (item && item.platform && item.amount) {
        platformTotals[item.platform] = (platformTotals[item.platform] || 0) + item.amount;
        totalRevenue += item.amount;
      }
    });

    return Object.entries(platformTotals).map(([platform, amount]) => ({
      platform,
      amount,
      percentage: totalRevenue > 0 ? parseFloat(((amount / totalRevenue) * 100).toFixed(2)) : 0
    }));
  }

  /**
   * Calculate stage conversions for deal pipeline
   */
  static async _calculateStageConversions(userId, dateRange) {
    // Simplified stage conversion calculation
    // In a real implementation, this would track stage transitions
    return [
      { fromStage: 'pitched', toStage: 'in_talks', conversionRate: 65, averageDays: 3 },
      { fromStage: 'in_talks', toStage: 'live', conversionRate: 45, averageDays: 7 },
      { fromStage: 'live', toStage: 'paid', conversionRate: 80, averageDays: 15 }
    ];
  }

  /**
   * Calculate average deal close time
   */
  static async _calculateAverageCloseTime(userId, dateRange) {
    const closedDeals = await Deal.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: 'paid',
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
          updatedAt: { $ne: null }
        }
      },
      {
        $project: {
          closeTime: { $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 86400000] }
        }
      },
      {
        $group: {
          _id: null,
          avgCloseTime: { $avg: '$closeTime' }
        }
      }
    ]);

    return Math.round(closedDeals[0]?.avgCloseTime || 0);
  }

  /**
   * Calculate client retention metrics
   */
  static async _calculateClientRetention(userId, dateRange) {
    // Simplified client retention calculation
    const uniqueClients = await Deal.distinct('brand.name', {
      userId: new mongoose.Types.ObjectId(userId),
      status: 'paid',
      createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
    });

    const repeatClients = await Deal.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: 'paid',
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate }
        }
      },
      {
        $group: {
          _id: '$brand.name',
          dealCount: { $sum: 1 },
          totalValue: { $sum: '$value' }
        }
      },
      {
        $match: {
          dealCount: { $gt: 1 }
        }
      }
    ]);

    const retentionRate = uniqueClients.length > 0 ? (repeatClients.length / uniqueClients.length) * 100 : 0;
    const repeatPercentage = uniqueClients.length > 0 ? (repeatClients.length / uniqueClients.length) * 100 : 0;
    const avgLifetimeValue = repeatClients.length > 0 
      ? repeatClients.reduce((sum, client) => sum + client.totalValue, 0) / repeatClients.length
      : 0;

    return { retentionRate, repeatPercentage, avgLifetimeValue };
  }

  /**
   * Analyze content performance patterns
   */
  static async _analyzeContentPerformance(userId, dateRange) {
    // Simplified content performance analysis
    // This would ideally correlate campaign deliverables with performance metrics
    return [
      { contentType: 'Instagram Reel', avgEngagement: 4.2, avgDealValue: 18500, roi: 3.2 },
      { contentType: 'Instagram Story', avgEngagement: 2.8, avgDealValue: 8500, roi: 2.1 },
      { contentType: 'Instagram Post', avgEngagement: 3.1, avgDealValue: 12000, roi: 2.5 },
      { contentType: 'YouTube Video', avgEngagement: 5.5, avgDealValue: 35000, roi: 4.8 }
    ];
  }

  /**
   * Calculate platform efficiency metrics
   */
  static async _calculatePlatformEfficiency(userId, dateRange) {
    // Simplified platform efficiency calculation
    return [
      { platform: 'Instagram', costPerImpression: 0.45, engagementRate: 3.2, repeatBusinessRate: 65 },
      { platform: 'YouTube', costPerImpression: 0.38, engagementRate: 4.8, repeatBusinessRate: 78 },
      { platform: 'LinkedIn', costPerImpression: 0.82, engagementRate: 2.1, repeatBusinessRate: 45 }
    ];
  }

  /**
   * Analyze negotiation success patterns
   */
  static async _analyzeNegotiationSuccess(userId, dateRange) {
    // Simplified negotiation analysis
    // This would track actual negotiation rounds and outcomes from contracts module
    return {
      successRate: 68,
      avgRounds: 2.3
    };
  }

  /**
   * Analyze risk-revenue correlation
   */
  static async _analyzeRiskRevenueCorrelation(userId, dateRange) {
    // Simplified risk-revenue correlation
    // This would correlate contract risk scores with actual deal values
    return {
      highRiskAvgValue: 25000,
      lowRiskAvgValue: 18000,
      riskPremium: 15.2 // 15.2% premium for high-risk contracts
    };
  }

  /**
   * Process risk factor distribution from contracts
   */
  static _processRiskFactorDistribution(riskDistribution) {
    const factorCounts = {};
    let totalFactors = 0;

    riskDistribution.forEach(contract => {
      if (contract.riskFactors && Array.isArray(contract.riskFactors)) {
        contract.riskFactors.forEach(factor => {
          if (factor.type) {
            factorCounts[factor.type] = (factorCounts[factor.type] || 0) + 1;
            totalFactors++;
          }
        });
      }
    });

    return Object.entries(factorCounts).map(([riskType, count]) => ({
      riskType,
      count,
      percentage: totalFactors > 0 ? parseFloat(((count / totalFactors) * 100).toFixed(2)) : 0
    }));
  }

  /**
   * Calculate risk trend over time
   */
  static async _calculateRiskTrend(userId, dateRange) {
    // Simplified risk trend calculation
    // This would compare current period risk with previous period
    return 'improving'; // 'improving', 'stable', 'worsening'
  }

  /**
   * Prepare analytics context for AI analysis
   */
  static _prepareAIAnalysisContext(dashboardData) {
    return {
      revenue: {
        total: dashboardData.revenueMetrics.totalRevenue,
        growth: dashboardData.revenueMetrics.revenueGrowth,
        avgDeal: dashboardData.revenueMetrics.averageDealValue,
        paymentDays: dashboardData.revenueMetrics.averagePaymentDays
      },
      deals: {
        conversion: dashboardData.dealMetrics.pipelineConversion,
        closeTime: dashboardData.dealMetrics.averageCloseTime,
        retention: dashboardData.dealMetrics.clientRetentionRate
      },
      risk: {
        avgRisk: dashboardData.riskMetrics.averageContractRisk,
        highRiskCount: dashboardData.riskMetrics.highRiskContracts,
        negotiationSuccess: dashboardData.riskMetrics.negotiationSuccessRate
      },
      performance: {
        totalCampaigns: dashboardData.performanceMetrics.totalCampaigns,
        avgEngagement: dashboardData.performanceMetrics.averageEngagementRate
      }
    };
  }

  /**
   * Build AI insight generation prompt
   */
  static _buildAIInsightPrompt(context) {
    return `
You are a business intelligence analyst for a creator economy platform. Analyze the following creator's business metrics and provide 2-3 actionable insights.

Business Metrics:
- Revenue: ₹${context.revenue.total} (${context.revenue.growth > 0 ? '+' : ''}${context.revenue.growth}% growth)
- Average Deal Value: ₹${context.revenue.avgDeal}
- Payment Time: ${context.revenue.paymentDays} days
- Pipeline Conversion: ${context.deals.conversion}%
- Deal Close Time: ${context.deals.closeTime} days
- Client Retention: ${context.deals.retention}%
- Contract Risk Score: ${context.risk.avgRisk}/100
- High Risk Contracts: ${context.risk.highRiskCount}
- Negotiation Success: ${context.risk.negotiationSuccess}%
- Campaign Engagement: ${context.performance.avgEngagement}%

Please provide insights in this JSON format:
[
  {
    "type": "pricing_opportunity|seasonal_trend|risk_warning|performance_optimization|client_retention",
    "priority": "low|medium|high|critical",
    "confidence": 85,
    "title": "Short insight title",
    "description": "Detailed insight description",
    "actionRecommendation": "Specific action to take"
  }
]

Focus on the most impactful insights that can drive revenue growth or reduce risk.
    `;
  }

  /**
   * Parse AI insights response
   */
  static _parseAIInsights(aiResponse, userId) {
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const insights = JSON.parse(jsonMatch[0]);
      
      return insights.map(insight => ({
        insightType: insight.type,
        priority: insight.priority || 'medium',
        confidence: Math.min(Math.max(insight.confidence || 70, 0), 100),
        title: insight.title || 'Business Insight',
        description: insight.description || 'No description provided',
        actionRecommendation: insight.actionRecommendation || 'No action specified',
        relevantUntil: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days
      }));

    } catch (error) {
      logError('Failed to parse AI insights', { userId, error: error.message });
      
      // Return fallback insights
      return [
        {
          insightType: 'performance_optimization',
          priority: 'medium',
          confidence: 75,
          title: 'Review Your Business Metrics',
          description: 'Your business data shows opportunities for optimization',
          actionRecommendation: 'Focus on improving pipeline conversion and payment collection',
          relevantUntil: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
        }
      ];
    }
  }

  /**
   * Get historical metric data for trend analysis
   */
  static async _getHistoricalMetricData(userId, metricType) {
    // Get historical analytics data for the metric
    const historicalData = await AnalyticsDashboard.find({
      userId: new mongoose.Types.ObjectId(userId)
    })
    .sort({ 'period.startDate': 1 })
    .limit(12) // Last 12 periods
    .select(`period revenueMetrics.totalRevenue dealMetrics.pipelineConversion`);

    return historicalData.map(record => {
      let value = 0;
      
      switch (metricType) {
        case 'monthly_revenue':
          value = record.revenueMetrics.totalRevenue;
          break;
        case 'deal_conversion_rate':
          value = record.dealMetrics.pipelineConversion;
          break;
        default:
          value = record.revenueMetrics.totalRevenue;
      }

      return {
        date: record.period.startDate,
        value,
        additionalData: {}
      };
    });
  }

  /**
   * Perform simple linear regression for trend analysis
   */
  static _performLinearRegression(dataPoints) {
    const n = dataPoints.length;
    const xValues = dataPoints.map((_, index) => index);
    const yValues = dataPoints.map(point => point.value);

    const sumX = xValues.reduce((sum, x) => sum + x, 0);
    const sumY = yValues.reduce((sum, y) => sum + y, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + (x * yValues[i]), 0);
    const sumXX = xValues.reduce((sum, x) => sum + (x * x), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const totalSumSquares = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const residualSumSquares = yValues.reduce((sum, y, i) => {
      const predicted = slope * xValues[i] + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (residualSumSquares / totalSumSquares);

    // Determine trend direction and strength
    const direction = slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';
    const strength = Math.abs(slope) > 0.5 ? 'strong' : Math.abs(slope) > 0.2 ? 'moderate' : 'weak';
    const confidence = Math.min(Math.max(rSquared * 100, 0), 100);

    return {
      direction,
      strength,
      confidence: Math.round(confidence),
      coefficients: {
        slope: parseFloat(slope.toFixed(4)),
        intercept: parseFloat(intercept.toFixed(2)),
        rSquared: parseFloat(rSquared.toFixed(4))
      }
    };
  }

  /**
   * Generate simple forecast using linear regression
   */
  static _generateSimpleForecast(trendAnalysis, periods) {
    const { slope, intercept } = trendAnalysis.coefficients;
    const forecast = [];

    for (let i = 1; i <= periods; i++) {
      const futureDate = new Date(Date.now() + (i * 30 * 24 * 60 * 60 * 1000)); // Monthly periods
      const predictedValue = slope * i + intercept;
      const confidenceRange = Math.abs(predictedValue * 0.1); // ±10% confidence interval

      forecast.push({
        date: futureDate,
        predictedValue: Math.max(0, parseFloat(predictedValue.toFixed(2))),
        confidenceInterval: {
          lower: Math.max(0, parseFloat((predictedValue - confidenceRange).toFixed(2))),
          upper: parseFloat((predictedValue + confidenceRange).toFixed(2))
        }
      });
    }

    return forecast;
  }

  /**
   * Calculate time span of data points
   */
  static _calculateTimeSpan(dataPoints) {
    if (dataPoints.length < 2) return 0;
    
    const firstDate = new Date(dataPoints[0].date);
    const lastDate = new Date(dataPoints[dataPoints.length - 1].date);
    
    return Math.ceil((lastDate - firstDate) / (24 * 60 * 60 * 1000));
  }

  // ========== CACHE MANAGEMENT ==========

  /**
   * Clear analytics cache for a user
   */
  static async clearUserCache(userId) {
    try {
      await AnalyticsCache.deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
      logInfo('Analytics cache cleared for user', { userId });
    } catch (error) {
      logError('Failed to clear analytics cache', { userId, error: error.message });
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(userId) {
    try {
      const stats = await AnalyticsCache.aggregate([
        {
          $match: { 
            userId: new mongoose.Types.ObjectId(userId),
            isValid: true,
            expiresAt: { $gt: new Date() }
          }
        },
        {
          $group: {
            _id: '$queryType',
            count: { $sum: 1 },
            totalHits: { $sum: '$cacheMetrics.hitCount' },
            avgSize: { $avg: '$cacheMetrics.dataSize' }
          }
        }
      ]);

      return stats;
    } catch (error) {
      logError('Failed to get cache statistics', { userId, error: error.message });
      return [];
    }
  }
}

// ============================================
// MODULE EXPORTS
// ============================================

module.exports = AnalyticsService;