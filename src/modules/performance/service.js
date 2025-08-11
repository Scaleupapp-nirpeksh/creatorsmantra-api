/**
 * CreatorsMantra Backend - Performance Vault Service
 * Business logic for campaign analytics, AI analysis, and report generation
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Performance tracking service with AI integration and PDF generation
 * 
 * File Path: src/modules/performance/service.js
 */

const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');
const AWS = require('aws-sdk');
const OpenAI = require('openai');

const { Campaign, Screenshot, Report, PerformanceSettings } = require('./model');
const { User } = require('../auth/model');
const { Deal } = require('../deals/model');
const { successResponse, errorResponse } = require('../../shared/utils');
const { logInfo, logError, logWarn } = require('../../shared/utils');

// ============================================
// EXTERNAL SERVICE CONFIGURATION
// ============================================

// Validate required environment variables
const requiredEnvVars = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION || 'ap-south-1', // Default to Mumbai region
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY
};

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  logError('Missing required environment variables for Performance module', { 
    missingVars,
    message: 'Please set the following environment variables: ' + missingVars.join(', ')
  });
}

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: requiredEnvVars.AWS_ACCESS_KEY_ID,
  secretAccessKey: requiredEnvVars.AWS_SECRET_ACCESS_KEY,
  region: requiredEnvVars.AWS_REGION
});

// OpenAI Configuration
const openai = new OpenAI({
  apiKey: requiredEnvVars.OPENAI_API_KEY
});

// ============================================
// PERFORMANCE SERVICE CLASS
// ============================================

class PerformanceService {
  
  // ============================================
  // CAMPAIGN MANAGEMENT
  // ============================================

  /**
   * Create a new campaign
   * @param {String} userId - User ID
   * @param {Object} campaignData - Campaign details
   * @returns {Object} Created campaign
   */
  async createCampaign(userId, campaignData) {
    try {
      // Check subscription limits
      const user = await User.findById(userId);
      if (!user) {
        return errorResponse('User not found', 404);
      }

      // Check subscription tier limits
      const limits = User.getSubscriptionLimits(user.subscriptionTier);
      if (!user.hasFeatureAccess('basic_performance')) {
        return errorResponse('Performance tracking not available in your subscription tier', 403);
      }

      // Check campaign limits for starter tier
      if (user.subscriptionTier === 'starter') {
        const campaignCount = await Campaign.countDocuments({ userId, status: { $ne: 'archived' } });
        if (campaignCount >= 10) { // Starter limit
          return errorResponse('Campaign limit reached. Upgrade to create more campaigns.', 403);
        }
      }

      // Validate deal reference if provided
      if (campaignData.dealId) {
        const deal = await Deal.findOne({ _id: campaignData.dealId, userId });
        if (!deal) {
          return errorResponse('Deal not found or access denied', 404);
        }
        
        // Auto-populate from deal if not provided
        if (!campaignData.brandName) campaignData.brandName = deal.brandName;
        if (!campaignData.campaignValue) {
          campaignData.campaignValue = {
            amount: deal.dealValue.amount,
            currency: 'INR'
          };
        }
      }

      // Create campaign
      const campaign = new Campaign({
        userId,
        ...campaignData,
        status: 'draft'
      });

      await campaign.save();

      logInfo('Campaign created successfully', { 
        campaignId: campaign._id, 
        userId, 
        brandName: campaign.brandName 
      });

      return successResponse('Campaign created successfully', {
        campaign: {
          id: campaign._id,
          campaignName: campaign.campaignName,
          brandName: campaign.brandName,
          platform: campaign.platform,
          status: campaign.status,
          campaignPeriod: campaign.campaignPeriod,
          campaignValue: campaign.campaignValue,
          createdAt: campaign.createdAt
        }
      });

    } catch (error) {
      logError('Campaign creation failed', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get campaigns for a user with filters
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Campaigns list
   */
  async getCampaigns(userId, filters = {}) {
    try {
      const {
        page = 1,
        limit = 25,
        status,
        platform,
        brandName,
        dateFrom,
        dateTo,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      // Build query
      const query = { userId };
      
      if (status) query.status = status;
      if (platform) query.platform = platform;
      if (brandName) query.brandName = { $regex: brandName, $options: 'i' };
      
      if (dateFrom || dateTo) {
        query['campaignPeriod.startDate'] = {};
        if (dateFrom) query['campaignPeriod.startDate'].$gte = new Date(dateFrom);
        if (dateTo) query['campaignPeriod.startDate'].$lte = new Date(dateTo);
      }

      // Sort configuration
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const campaigns = await Campaign.find(query)
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('dealId', 'stage brandName dealValue')
        .lean();

      // Get total count for pagination
      const totalCampaigns = await Campaign.countDocuments(query);

      // Format response
      const formattedCampaigns = campaigns.map(campaign => ({
        id: campaign._id,
        campaignName: campaign.campaignName,
        brandName: campaign.brandName,
        platform: campaign.platform,
        status: campaign.status,
        campaignPeriod: campaign.campaignPeriod,
        campaignValue: campaign.campaignValue,
        performanceMetrics: campaign.performanceMetrics,
        aiAnalysis: {
          isAnalyzed: campaign.aiAnalysis?.isAnalyzed || false,
          performanceScore: campaign.aiAnalysis?.performanceScore,
          performanceSummary: campaign.aiAnalysis?.performanceSummary
        },
        deal: campaign.dealId ? {
          id: campaign.dealId._id,
          stage: campaign.dealId.stage,
          brandName: campaign.dealId.brandName
        } : null,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt
      }));

      return successResponse('Campaigns retrieved successfully', {
        campaigns: formattedCampaigns,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCampaigns / limit),
          totalCampaigns,
          hasNext: page * limit < totalCampaigns,
          hasPrev: page > 1
        },
        filters: { status, platform, brandName, dateFrom, dateTo }
      });

    } catch (error) {
      logError('Get campaigns failed', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get single campaign details
   * @param {String} userId - User ID
   * @param {String} campaignId - Campaign ID
   * @returns {Object} Campaign details
   */
  async getCampaignById(userId, campaignId) {
    try {
      const campaign = await Campaign.findOne({ _id: campaignId, userId })
        .populate('dealId', 'stage brandName dealValue campaignRequirements')
        .lean();

      if (!campaign) {
        return errorResponse('Campaign not found', 404);
      }

      // Get screenshots for this campaign
      const screenshots = await Screenshot.find({ campaignId })
        .sort({ uploadedAt: -1 })
        .lean();

      // Get reports for this campaign
      const reports = await Report.find({ campaignId })
        .sort({ generatedAt: -1 })
        .lean();

      // Format campaign data
      const formattedCampaign = {
        id: campaign._id,
        campaignName: campaign.campaignName,
        brandName: campaign.brandName,
        platform: campaign.platform,
        status: campaign.status,
        campaignPeriod: campaign.campaignPeriod,
        deliverables: campaign.deliverables,
        campaignValue: campaign.campaignValue,
        performanceMetrics: campaign.performanceMetrics,
        aiAnalysis: campaign.aiAnalysis,
        tags: campaign.tags,
        notes: campaign.notes,
        deal: campaign.dealId ? {
          id: campaign.dealId._id,
          stage: campaign.dealId.stage,
          brandName: campaign.dealId.brandName,
          dealValue: campaign.dealId.dealValue
        } : null,
        screenshots: screenshots.map(s => ({
          id: s._id,
          fileName: s.fileName,
          originalName: s.originalName,
          s3Url: s.s3Url,
          platform: s.platform,
          screenshotType: s.screenshotType,
          aiExtraction: s.aiExtraction,
          uploadedAt: s.uploadedAt
        })),
        reports: reports.map(r => ({
          id: r._id,
          reportName: r.reportName,
          reportType: r.reportType,
          template: r.template,
          s3Url: r.s3Url,
          generatedAt: r.generatedAt,
          downloadCount: r.downloadCount
        })),
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt
      };

      return successResponse('Campaign details retrieved', { campaign: formattedCampaign });

    } catch (error) {
      logError('Get campaign details failed', { userId, campaignId, error: error.message });
      throw error;
    }
  }

  /**
   * Update campaign
   * @param {String} userId - User ID
   * @param {String} campaignId - Campaign ID
   * @param {Object} updateData - Update data
   * @returns {Object} Updated campaign
   */
  async updateCampaign(userId, campaignId, updateData) {
    try {
      const campaign = await Campaign.findOne({ _id: campaignId, userId });
      
      if (!campaign) {
        return errorResponse('Campaign not found', 404);
      }

      // Update campaign
      Object.assign(campaign, updateData);
      campaign.updatedAt = new Date();
      
      await campaign.save();

      logInfo('Campaign updated successfully', { campaignId, userId });

      return successResponse('Campaign updated successfully', {
        campaign: {
          id: campaign._id,
          campaignName: campaign.campaignName,
          status: campaign.status,
          updatedAt: campaign.updatedAt
        }
      });

    } catch (error) {
      logError('Campaign update failed', { userId, campaignId, error: error.message });
      throw error;
    }
  }

  // ============================================
  // SCREENSHOT UPLOAD & PROCESSING
  // ============================================

  /**
   * Upload campaign screenshot
   * @param {String} userId - User ID
   * @param {String} campaignId - Campaign ID
   * @param {Object} fileData - File upload data
   * @returns {Object} Upload result
   */
  async uploadScreenshot(userId, campaignId, fileData) {
    try {
      // Verify campaign exists and user has access
      const campaign = await Campaign.findOne({ _id: campaignId, userId });
      if (!campaign) {
        return errorResponse('Campaign not found', 404);
      }

      // Check subscription limits
      const user = await User.findById(userId);
      if (user.subscriptionTier === 'starter') {
        const screenshotCount = await Screenshot.countDocuments({ userId });
        if (screenshotCount >= 25) { // Starter limit
          return errorResponse('Screenshot upload limit reached. Upgrade for unlimited uploads.', 403);
        }
      }

      // Upload to S3
      const s3Key = `performance/${userId}/${campaignId}/${Date.now()}_${fileData.originalname}`;
      
      const uploadParams = {
        Bucket: requiredEnvVars.AWS_S3_BUCKET,
        Key: s3Key,
        Body: fileData.buffer,
        ContentType: fileData.mimetype,
        ACL: 'private'
      };

      const s3Result = await s3.upload(uploadParams).promise();

      // Create screenshot record
      const screenshot = new Screenshot({
        campaignId,
        userId,
        fileName: `${Date.now()}_${fileData.originalname}`,
        originalName: fileData.originalname,
        fileSize: fileData.size,
        mimeType: fileData.mimetype,
        s3Key,
        s3Url: s3Result.Location,
        platform: campaign.platform,
        screenshotType: 'insights'
      });

      await screenshot.save();

      // Trigger AI processing if user has access
      if (user.hasFeatureAccess('ai_brief_analyzer')) {
        this.processScreenshotWithAI(screenshot._id).catch(error => {
          logError('AI processing failed', { screenshotId: screenshot._id, error: error.message });
        });
      }

      logInfo('Screenshot uploaded successfully', { 
        screenshotId: screenshot._id, 
        campaignId, 
        userId,
        fileName: screenshot.fileName
      });

      return successResponse('Screenshot uploaded successfully', {
        screenshot: {
          id: screenshot._id,
          fileName: screenshot.fileName,
          originalName: screenshot.originalName,
          s3Url: screenshot.s3Url,
          platform: screenshot.platform,
          uploadedAt: screenshot.uploadedAt
        }
      });

    } catch (error) {
      logError('Screenshot upload failed', { userId, campaignId, error: error.message });
      throw error;
    }
  }

  /**
   * Process screenshot with AI to extract metrics
   * @param {String} screenshotId - Screenshot ID
   * @returns {Promise} Processing result
   */
  async processScreenshotWithAI(screenshotId) {
    try {
      const screenshot = await Screenshot.findById(screenshotId)
        .populate('campaignId');

      if (!screenshot) {
        throw new Error('Screenshot not found');
      }

      // Prepare AI prompt for metric extraction
      const prompt = `
        Analyze this social media analytics screenshot and extract key performance metrics.
        Platform: ${screenshot.platform}
        Campaign: ${screenshot.campaignId.campaignName}
        
        Extract the following metrics if visible:
        - Impressions/Views
        - Reach
        - Likes
        - Comments
        - Shares
        - Saves
        - Clicks
        - Profile visits
        - Any other engagement metrics
        
        Return the data in JSON format with numeric values only.
        If a metric is not visible, use 0.
        
        Example format:
        {
          "impressions": 150000,
          "reach": 120000,
          "likes": 5500,
          "comments": 234,
          "shares": 156,
          "saves": 890,
          "clicks": 234,
          "profileVisits": 45
        }
      `;

      // Call OpenAI Vision API (Note: This would need image input in real implementation)
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: screenshot.s3Url }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      let extractedData = {};
      let confidence = 0;

      try {
        // Parse AI response
        const responseText = aiResponse.choices[0].message.content;
        extractedData = JSON.parse(responseText);
        confidence = 85; // Base confidence for successful extraction

      } catch (parseError) {
        logWarn('AI response parsing failed', { screenshotId, error: parseError.message });
        confidence = 0;
      }

      // Update screenshot with AI results
      screenshot.aiExtraction = {
        isProcessed: true,
        processedAt: new Date(),
        extractedData,
        confidence,
        error: confidence === 0 ? 'Failed to parse metrics' : null
      };

      await screenshot.save();

      // Update campaign metrics if extraction was successful
      if (confidence > 50 && Object.keys(extractedData).length > 0) {
        await this.updateCampaignMetrics(screenshot.campaignId._id, extractedData);
      }

      logInfo('Screenshot AI processing completed', { 
        screenshotId, 
        confidence,
        metricsExtracted: Object.keys(extractedData).length
      });

      return { success: true, confidence, extractedData };

    } catch (error) {
      // Update screenshot with error
      await Screenshot.findByIdAndUpdate(screenshotId, {
        'aiExtraction.isProcessed': true,
        'aiExtraction.processedAt': new Date(),
        'aiExtraction.error': error.message,
        'aiExtraction.confidence': 0
      });

      logError('Screenshot AI processing failed', { screenshotId, error: error.message });
      throw error;
    }
  }

  /**
   * Update campaign metrics from extracted data
   * @param {String} campaignId - Campaign ID
   * @param {Object} extractedData - Extracted metrics
   */
  async updateCampaignMetrics(campaignId, extractedData) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) return;

      // Merge extracted data with existing metrics (take higher values)
      const currentMetrics = campaign.performanceMetrics;
      const updatedMetrics = { ...currentMetrics };

      Object.keys(extractedData).forEach(key => {
        const newValue = parseInt(extractedData[key]) || 0;
        const currentValue = parseInt(currentMetrics[key]) || 0;
        updatedMetrics[key] = Math.max(newValue, currentValue);
      });

      campaign.performanceMetrics = updatedMetrics;
      campaign.lastAnalyzedAt = new Date();
      await campaign.save();

      logInfo('Campaign metrics updated from AI extraction', { campaignId });

    } catch (error) {
      logError('Campaign metrics update failed', { campaignId, error: error.message });
    }
  }

  // ============================================
  // AI ANALYSIS & INSIGHTS
  // ============================================

  /**
   * Generate AI analysis for campaign
   * @param {String} userId - User ID
   * @param {String} campaignId - Campaign ID
   * @returns {Object} AI analysis results
   */
  async generateCampaignAnalysis(userId, campaignId) {
    try {
      // Check subscription access
      const user = await User.findById(userId);
      if (!user.hasFeatureAccess('ai_brief_analyzer')) {
        return errorResponse('AI analysis not available in your subscription tier', 403);
      }

      const campaign = await Campaign.findOne({ _id: campaignId, userId });
      if (!campaign) {
        return errorResponse('Campaign not found', 404);
      }

      if (campaign.aiAnalysis.isAnalyzed) {
        return successResponse('Campaign already analyzed', { 
          analysis: campaign.aiAnalysis 
        });
      }

      const startTime = Date.now();

      // Prepare campaign data for AI analysis
      const metrics = campaign.performanceMetrics;
      const campaignDetails = {
        name: campaign.campaignName,
        brand: campaign.brandName,
        platform: campaign.platform,
        duration: campaign.campaignPeriod.duration,
        value: campaign.campaignValue.amount,
        deliverables: campaign.deliverables
      };

      // Create AI analysis prompt
      const prompt = `
        Analyze this influencer marketing campaign performance and provide professional insights.
        
        Campaign Details:
        - Campaign: ${campaignDetails.name}
        - Brand: ${campaignDetails.brand}
        - Platform: ${campaignDetails.platform}
        - Duration: ${campaignDetails.duration} days
        - Investment: ₹${campaignDetails.value?.toLocaleString('en-IN')}
        
        Performance Metrics:
        - Impressions: ${metrics.impressions?.toLocaleString('en-IN') || 'N/A'}
        - Reach: ${metrics.reach?.toLocaleString('en-IN') || 'N/A'}
        - Likes: ${metrics.likes?.toLocaleString('en-IN') || 'N/A'}
        - Comments: ${metrics.comments?.toLocaleString('en-IN') || 'N/A'}
        - Shares: ${metrics.shares?.toLocaleString('en-IN') || 'N/A'}
        - Saves: ${metrics.saves?.toLocaleString('en-IN') || 'N/A'}
        - Clicks: ${metrics.clicks?.toLocaleString('en-IN') || 'N/A'}
        
        Please provide:
        1. A professional 2-3 sentence performance summary suitable for client reports
        2. 3-5 key insights about the campaign performance
        3. 2-3 recommendations for future campaigns
        4. A performance score out of 100
        5. How this compares to industry benchmarks
        
        Format your response as JSON:
        {
          "performanceSummary": "Professional summary here...",
          "insights": ["Insight 1", "Insight 2", ...],
          "recommendations": ["Recommendation 1", "Recommendation 2", ...],
          "performanceScore": 85,
          "benchmarkComparison": {
            "industryAvgEngagement": 3.2,
            "performanceVsAverage": 1.8,
            "ranking": "excellent"
          }
        }
      `;

      // Call OpenAI API
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.3
      });

      let analysis = {};
      
      try {
        const responseText = aiResponse.choices[0].message.content;
        analysis = JSON.parse(responseText);
      } catch (parseError) {
        logError('AI analysis parsing failed', { campaignId, error: parseError.message });
        return errorResponse('AI analysis generation failed', 500);
      }

      // Update campaign with AI analysis
      const processingTime = Date.now() - startTime;
      
      campaign.aiAnalysis = {
        isAnalyzed: true,
        analyzedAt: new Date(),
        performanceSummary: analysis.performanceSummary,
        insights: analysis.insights || [],
        recommendations: analysis.recommendations || [],
        performanceScore: analysis.performanceScore || 0,
        benchmarkComparison: analysis.benchmarkComparison || {},
        aiVersion: '1.0',
        processingTime
      };

      await campaign.save();

      logInfo('Campaign AI analysis completed', { 
        campaignId, 
        userId,
        score: analysis.performanceScore,
        processingTime
      });

      return successResponse('Campaign analysis generated successfully', {
        analysis: campaign.aiAnalysis
      });

    } catch (error) {
      logError('Campaign AI analysis failed', { userId, campaignId, error: error.message });
      throw error;
    }
  }

  // ============================================
  // REPORT GENERATION
  // ============================================

  /**
   * Generate campaign report PDF
   * @param {String} userId - User ID
   * @param {String} campaignId - Campaign ID
   * @param {Object} reportConfig - Report configuration
   * @returns {Object} Generated report details
   */
  async generateCampaignReport(userId, campaignId, reportConfig = {}) {
    try {
      const user = await User.findById(userId);
      const campaign = await Campaign.findOne({ _id: campaignId, userId })
        .populate('dealId', 'brandName stage');

      if (!campaign) {
        return errorResponse('Campaign not found', 404);
      }

      // Get user's performance settings for branding
      let settings = await PerformanceSettings.findOne({ userId });
      if (!settings) {
        settings = new PerformanceSettings({ userId });
        await settings.save();
      }

      const startTime = Date.now();

      // Merge report config with user settings
      const finalConfig = {
        template: reportConfig.template || settings.reportSettings.defaultTemplate,
        branding: reportConfig.branding || settings.branding,
        includeComparison: reportConfig.includeComparison ?? settings.reportSettings.includeComparison,
        includeBenchmarks: reportConfig.includeBenchmarks ?? settings.reportSettings.includeBenchmarks,
        includeRecommendations: reportConfig.includeRecommendations ?? settings.reportSettings.includeRecommendations
      };

      // Generate PDF
      const pdfBuffer = await this.createCampaignPDF(campaign, finalConfig, user);

      // Upload PDF to S3
      const fileName = `${campaign.campaignName}_Performance_Report_${Date.now()}.pdf`;
      const s3Key = `reports/${userId}/${campaignId}/${fileName}`;
      
      const uploadParams = {
        Bucket: requiredEnvVars.AWS_S3_BUCKET,
        Key: s3Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ACL: 'private'
      };

      const s3Result = await s3.upload(uploadParams).promise();

      // Create report record
      const report = new Report({
        campaignId,
        userId,
        reportName: `${campaign.campaignName} - Performance Report`,
        reportType: 'campaign_summary',
        fileName,
        s3Key,
        s3Url: s3Result.Location,
        fileSize: pdfBuffer.length,
        template: finalConfig.template,
        branding: finalConfig.branding,
        reportData: {
          totalImpressions: campaign.performanceMetrics.impressions,
          totalReach: campaign.performanceMetrics.reach,
          engagementRate: parseFloat(campaign.engagementRate),
          performanceScore: campaign.aiAnalysis?.performanceScore,
          campaignValue: campaign.campaignValue.amount
        },
        generationTime: Date.now() - startTime
      });

      await report.save();

      // Update user settings usage
      await PerformanceSettings.findOneAndUpdate(
        { userId },
        { 
          $inc: { 'usage.totalReports': 1 },
          $set: { 'usage.lastActivity': new Date() }
        }
      );

      logInfo('Campaign report generated successfully', { 
        reportId: report._id,
        campaignId, 
        userId,
        template: finalConfig.template,
        fileSize: pdfBuffer.length
      });

      return successResponse('Campaign report generated successfully', {
        report: {
          id: report._id,
          reportName: report.reportName,
          fileName: report.fileName,
          s3Url: report.s3Url,
          template: report.template,
          fileSize: report.fileSize,
          generatedAt: report.generatedAt
        }
      });

    } catch (error) {
      logError('Campaign report generation failed', { userId, campaignId, error: error.message });
      throw error;
    }
  }

  /**
   * Create campaign PDF report
   * @param {Object} campaign - Campaign data
   * @param {Object} config - Report configuration
   * @param {Object} user - User data
   * @returns {Buffer} PDF buffer
   */
  async createCampaignPDF(campaign, config, user) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Configure colors from branding
        const primaryColor = config.branding?.primaryColor || '#8B5CF6';
        const secondaryColor = config.branding?.secondaryColor || '#EC4899';
        const textColor = '#1F2937';
        const lightGray = '#F3F4F6';

        // Header with branding
        doc.fontSize(24)
           .fillColor(primaryColor)
           .text('Campaign Performance Report', 50, 50);

        if (config.branding?.brandName) {
          doc.fontSize(12)
             .fillColor(textColor)
             .text(`Prepared by: ${config.branding.brandName}`, 50, 80);
        }

        // Campaign Overview
        doc.fontSize(16)
           .fillColor(primaryColor)
           .text('Campaign Overview', 50, 120);

        doc.fontSize(12)
           .fillColor(textColor)
           .text(`Campaign Name: ${campaign.campaignName}`, 50, 150)
           .text(`Brand: ${campaign.brandName}`, 50, 170)
           .text(`Platform: ${campaign.platform.charAt(0).toUpperCase() + campaign.platform.slice(1)}`, 50, 190)
           .text(`Duration: ${campaign.campaignPeriod.duration} days`, 50, 210)
           .text(`Investment: ₹${campaign.campaignValue.amount.toLocaleString('en-IN')}`, 50, 230);

        // Performance Metrics
        doc.fontSize(16)
           .fillColor(primaryColor)
           .text('Key Performance Metrics', 50, 270);

        const metrics = campaign.performanceMetrics;
        let yPos = 300;

        const metricsList = [
          { label: 'Total Impressions', value: metrics.impressions?.toLocaleString('en-IN') || 'N/A' },
          { label: 'Total Reach', value: metrics.reach?.toLocaleString('en-IN') || 'N/A' },
          { label: 'Engagement Rate', value: `${campaign.engagementRate}%` },
          { label: 'Total Likes', value: metrics.likes?.toLocaleString('en-IN') || 'N/A' },
          { label: 'Total Comments', value: metrics.comments?.toLocaleString('en-IN') || 'N/A' },
          { label: 'Total Shares', value: metrics.shares?.toLocaleString('en-IN') || 'N/A' }
        ];

        metricsList.forEach(metric => {
          doc.fontSize(12)
             .fillColor(textColor)
             .text(`${metric.label}:`, 50, yPos)
             .text(metric.value, 250, yPos);
          yPos += 25;
        });

        // AI Analysis Section (if available and user has access)
        if (campaign.aiAnalysis?.isAnalyzed && config.includeRecommendations) {
          doc.addPage();
          
          doc.fontSize(16)
             .fillColor(primaryColor)
             .text('Performance Analysis', 50, 50);

          if (campaign.aiAnalysis.performanceSummary) {
            doc.fontSize(12)
               .fillColor(textColor)
               .text(campaign.aiAnalysis.performanceSummary, 50, 80, { width: 500, align: 'justify' });
          }

          // Performance Score
          if (campaign.aiAnalysis.performanceScore) {
            doc.fontSize(14)
               .fillColor(primaryColor)
               .text(`Performance Score: ${campaign.aiAnalysis.performanceScore}/100`, 50, 150);
          }

          // Key Insights
          if (campaign.aiAnalysis.insights?.length > 0) {
            doc.fontSize(14)
               .fillColor(primaryColor)
               .text('Key Insights:', 50, 190);

            let insightY = 220;
            campaign.aiAnalysis.insights.forEach((insight, index) => {
              doc.fontSize(12)
                 .fillColor(textColor)
                 .text(`${index + 1}. ${insight}`, 70, insightY, { width: 480 });
              insightY += 30;
            });
          }

          // Recommendations
          if (campaign.aiAnalysis.recommendations?.length > 0) {
            doc.fontSize(14)
               .fillColor(primaryColor)
               .text('Recommendations for Future Campaigns:', 50, insightY + 20);

            let recY = insightY + 50;
            campaign.aiAnalysis.recommendations.forEach((rec, index) => {
              doc.fontSize(12)
                 .fillColor(textColor)
                 .text(`${index + 1}. ${rec}`, 70, recY, { width: 480 });
              recY += 30;
            });
          }
        }

        // Footer
        const pages = doc.bufferedPageRange();
        for (let i = pages.start; i < pages.start + pages.count; i++) {
          doc.switchToPage(i);
          doc.fontSize(10)
             .fillColor('#666')
             .text(`Generated on ${new Date().toLocaleDateString('en-IN')} | Page ${i + 1} of ${pages.count}`, 
                   50, doc.page.height - 50, { align: 'center' });
          
          if (config.branding?.watermark !== false) {
            doc.text('Powered by CreatorsMantra', 50, doc.page.height - 30, { align: 'center' });
          }
        }

        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  // ============================================
  // ANALYTICS & DASHBOARD
  // ============================================

  /**
   * Get performance overview for user
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Performance overview
   */
  async getPerformanceOverview(userId, filters = {}) {
    try {
      const { period = '30d' } = filters;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Get campaign analytics
      const analytics = await Campaign.getCampaignAnalytics(userId, {
        dateFrom: startDate,
        dateTo: endDate
      });

      // Get top performing campaigns
      const topCampaigns = await Campaign.getTopPerformingCampaigns(userId, 5);

      // Get recent activity
      const recentCampaigns = await Campaign.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('campaignName brandName status updatedAt performanceMetrics.impressions')
        .lean();

      // Platform distribution
      const platformStats = await Campaign.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: '$platform',
            count: { $sum: 1 },
            totalValue: { $sum: '$campaignValue.amount' },
            avgImpressions: { $avg: '$performanceMetrics.impressions' }
          }
        }
      ]);

      const overviewData = analytics[0] || {
        totalCampaigns: 0,
        totalValue: 0,
        avgImpressions: 0,
        avgEngagement: 0,
        totalImpressions: 0,
        totalReach: 0,
        completedCampaigns: 0
      };

      return successResponse('Performance overview retrieved successfully', {
        overview: {
          ...overviewData,
          period,
          dateRange: { startDate, endDate }
        },
        topPerformingCampaigns: topCampaigns.map(c => ({
          id: c._id,
          campaignName: c.campaignName,
          brandName: c.brandName,
          platform: c.platform,
          performanceScore: c.aiAnalysis?.performanceScore,
          impressions: c.performanceMetrics?.impressions,
          engagementRate: c.engagementRate
        })),
        recentActivity: recentCampaigns.map(c => ({
          id: c._id,
          campaignName: c.campaignName,
          brandName: c.brandName,
          status: c.status,
          impressions: c.performanceMetrics?.impressions,
          updatedAt: c.updatedAt
        })),
        platformDistribution: platformStats.map(p => ({
          platform: p._id,
          campaigns: p.count,
          totalValue: p.totalValue,
          avgImpressions: Math.round(p.avgImpressions || 0)
        }))
      });

    } catch (error) {
      logError('Performance overview failed', { userId, error: error.message });
      throw error;
    }
  }

  // ============================================
  // SETTINGS MANAGEMENT
  // ============================================

  /**
   * Get user performance settings
   * @param {String} userId - User ID
   * @returns {Object} User settings
   */
  async getUserSettings(userId) {
    try {
      let settings = await PerformanceSettings.findOne({ userId });
      
      if (!settings) {
        settings = new PerformanceSettings({ userId });
        await settings.save();
      }

      return successResponse('Settings retrieved successfully', { settings });

    } catch (error) {
      logError('Get settings failed', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update user performance settings
   * @param {String} userId - User ID
   * @param {Object} updateData - Settings update data
   * @returns {Object} Updated settings
   */
  async updateUserSettings(userId, updateData) {
    try {
      const settings = await PerformanceSettings.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true, upsert: true }
      );

      logInfo('Performance settings updated', { userId });

      return successResponse('Settings updated successfully', { settings });

    } catch (error) {
      logError('Update settings failed', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = new PerformanceService();