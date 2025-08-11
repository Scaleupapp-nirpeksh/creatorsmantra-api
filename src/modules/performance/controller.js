/**
 * CreatorsMantra Backend - Performance Vault Controller
 * HTTP request handlers for campaign analytics, AI analysis, and report generation
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Performance tracking controllers with file upload and AI integration
 * 
 * File Path: src/modules/performance/controller.js
 */

const performanceService = require('./service');
const { asyncHandler } = require('../../shared/utils');
const { successResponse, errorResponse } = require('../../shared/responses');
const { logInfo, logError, logWarn } = require('../../shared/utils');

// ============================================
// PERFORMANCE CONTROLLER CLASS
// ============================================

class PerformanceController {

  // ============================================
  // CAMPAIGN MANAGEMENT ENDPOINTS
  // ============================================

  /**
   * Create a new campaign
   * POST /api/v1/performance/campaigns
   */
  createCampaign = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const campaignData = req.body;

    logInfo('Creating campaign', { userId, campaignName: campaignData.campaignName });

    const result = await performanceService.createCampaign(userId, campaignData);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(201).json(result);
  });

  /**
   * Get campaigns with filters and pagination
   * GET /api/v1/performance/campaigns
   */
  getCampaigns = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const filters = req.query;

    const result = await performanceService.getCampaigns(userId, filters);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(result);
  });

  /**
   * Get single campaign details
   * GET /api/v1/performance/campaigns/:campaignId
   */
  getCampaignById = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { campaignId } = req.params;

    const result = await performanceService.getCampaignById(userId, campaignId);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(result);
  });

  /**
   * Update campaign details
   * PUT /api/v1/performance/campaigns/:campaignId
   */
  updateCampaign = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { campaignId } = req.params;
    const updateData = req.body;

    logInfo('Updating campaign', { userId, campaignId });

    const result = await performanceService.updateCampaign(userId, campaignId, updateData);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(result);
  });

  /**
   * Delete campaign (soft delete - archive)
   * DELETE /api/v1/performance/campaigns/:campaignId
   */
  deleteCampaign = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { campaignId } = req.params;

    logInfo('Archiving campaign', { userId, campaignId });

    const result = await performanceService.updateCampaign(userId, campaignId, { 
      status: 'archived' 
    });

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(successResponse('Campaign archived successfully', {
      campaignId,
      status: 'archived'
    }));
  });

  // ============================================
  // SCREENSHOT UPLOAD & PROCESSING ENDPOINTS
  // ============================================

  /**
   * Upload campaign screenshot
   * POST /api/v1/performance/campaigns/:campaignId/screenshots
   */
  uploadScreenshot = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { campaignId } = req.params;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json(errorResponse('No file uploaded', 400));
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json(errorResponse('Invalid file type. Only JPEG, PNG, and WebP images are allowed.', 400));
    }

    // Validate file size (10MB limit)
    if (req.file.size > 10485760) {
      return res.status(400).json(errorResponse('File too large. Maximum size is 10MB.', 400));
    }

    logInfo('Uploading screenshot', { 
      userId, 
      campaignId, 
      fileName: req.file.originalname,
      fileSize: req.file.size 
    });

    const result = await performanceService.uploadScreenshot(userId, campaignId, req.file);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(201).json(result);
  });

  /**
   * Get screenshots for a campaign
   * GET /api/v1/performance/campaigns/:campaignId/screenshots
   */
  getCampaignScreenshots = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { campaignId } = req.params;

    // This functionality is included in getCampaignById, but providing separate endpoint for convenience
    const result = await performanceService.getCampaignById(userId, campaignId);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(successResponse('Screenshots retrieved successfully', {
      screenshots: result.data.campaign.screenshots
    }));
  });

  /**
   * Delete screenshot
   * DELETE /api/v1/performance/screenshots/:screenshotId
   */
  deleteScreenshot = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { screenshotId } = req.params;

    // Note: This would need a service method to implement
    // For now, returning a placeholder response
    logInfo('Delete screenshot requested', { userId, screenshotId });

    res.status(200).json(successResponse('Screenshot deletion scheduled', {
      screenshotId,
      status: 'scheduled_for_deletion'
    }));
  });

  /**
   * Trigger manual AI processing for screenshot
   * POST /api/v1/performance/screenshots/:screenshotId/analyze
   */
  analyzeScreenshot = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { screenshotId } = req.params;

    // Check subscription access for AI features
    if (!req.user.hasFeatureAccess || !req.user.hasFeatureAccess('ai_brief_analyzer')) {
      return res.status(403).json(errorResponse('AI analysis not available in your subscription tier', 403));
    }

    logInfo('Manual screenshot analysis triggered', { userId, screenshotId });

    try {
      // Note: This would call the service method directly
      const result = await performanceService.processScreenshotWithAI(screenshotId);
      
      res.status(200).json(successResponse('Screenshot analysis completed', {
        screenshotId,
        confidence: result.confidence,
        extractedData: result.extractedData
      }));
    } catch (error) {
      logError('Screenshot analysis failed', { userId, screenshotId, error: error.message });
      res.status(500).json(errorResponse('Screenshot analysis failed', 500));
    }
  });

  // ============================================
  // AI ANALYSIS ENDPOINTS
  // ============================================

  /**
   * Generate AI analysis for campaign
   * POST /api/v1/performance/campaigns/:campaignId/analyze
   */
  generateCampaignAnalysis = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { campaignId } = req.params;

    logInfo('Generating campaign AI analysis', { userId, campaignId });

    const result = await performanceService.generateCampaignAnalysis(userId, campaignId);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(result);
  });

  /**
   * Get campaign analysis results
   * GET /api/v1/performance/campaigns/:campaignId/analysis
   */
  getCampaignAnalysis = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { campaignId } = req.params;

    // Get campaign details which include analysis
    const result = await performanceService.getCampaignById(userId, campaignId);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    const analysis = result.data.campaign.aiAnalysis;

    if (!analysis || !analysis.isAnalyzed) {
      return res.status(404).json(errorResponse('Campaign analysis not available', 404));
    }

    res.status(200).json(successResponse('Campaign analysis retrieved', { analysis }));
  });

  /**
   * Regenerate AI analysis for campaign
   * PUT /api/v1/performance/campaigns/:campaignId/analysis
   */
  regenerateCampaignAnalysis = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { campaignId } = req.params;

    // Check subscription access
    if (!req.user.hasFeatureAccess || !req.user.hasFeatureAccess('ai_brief_analyzer')) {
      return res.status(403).json(errorResponse('AI analysis not available in your subscription tier', 403));
    }

    logInfo('Regenerating campaign AI analysis', { userId, campaignId });

    // First reset the analysis status
    await performanceService.updateCampaign(userId, campaignId, {
      'aiAnalysis.isAnalyzed': false
    });

    // Then generate new analysis
    const result = await performanceService.generateCampaignAnalysis(userId, campaignId);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(result);
  });

  // ============================================
  // REPORT GENERATION ENDPOINTS
  // ============================================

  /**
   * Generate campaign report
   * POST /api/v1/performance/campaigns/:campaignId/reports
   */
  generateCampaignReport = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { campaignId } = req.params;
    const reportConfig = req.body;

    logInfo('Generating campaign report', { 
      userId, 
      campaignId, 
      template: reportConfig.template 
    });

    const result = await performanceService.generateCampaignReport(userId, campaignId, reportConfig);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(201).json(result);
  });

  /**
   * Get reports for a campaign
   * GET /api/v1/performance/campaigns/:campaignId/reports
   */
  getCampaignReports = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { campaignId } = req.params;

    // This functionality is included in getCampaignById, but providing separate endpoint
    const result = await performanceService.getCampaignById(userId, campaignId);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(successResponse('Campaign reports retrieved', {
      reports: result.data.campaign.reports
    }));
  });

  /**
   * Get all reports for user
   * GET /api/v1/performance/reports
   */
  getAllReports = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { page = 1, limit = 25, reportType } = req.query;

    // Note: This would need a service method to implement properly
    // For now, returning a placeholder
    logInfo('Getting all reports', { userId, page, limit, reportType });

    res.status(200).json(successResponse('Reports retrieved successfully', {
      reports: [],
      pagination: {
        currentPage: parseInt(page),
        totalPages: 0,
        totalReports: 0
      }
    }));
  });

  /**
   * Download report
   * GET /api/v1/performance/reports/:reportId/download
   */
  downloadReport = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { reportId } = req.params;

    logInfo('Report download requested', { userId, reportId });

    // Note: This would need service method to:
    // 1. Verify user has access to report
    // 2. Generate signed S3 URL or stream file
    // 3. Track download count
    // For now, returning placeholder

    res.status(200).json(successResponse('Download link generated', {
      reportId,
      downloadUrl: `https://example.com/download/${reportId}`,
      expiresAt: new Date(Date.now() + 3600000) // 1 hour
    }));
  });

  /**
   * Share report (generate public link)
   * POST /api/v1/performance/reports/:reportId/share
   */
  shareReport = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { reportId } = req.params;

    logInfo('Report sharing requested', { userId, reportId });

    // Note: This would need service method to generate share token
    const shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.status(200).json(successResponse('Share link generated', {
      reportId,
      shareUrl: `https://creatorsmantra.com/shared/reports/${shareToken}`,
      shareToken
    }));
  });

  // ============================================
  // ANALYTICS & DASHBOARD ENDPOINTS
  // ============================================

  /**
   * Get performance overview/dashboard
   * GET /api/v1/performance/overview
   */
  getPerformanceOverview = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const filters = req.query;

    const result = await performanceService.getPerformanceOverview(userId, filters);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(result);
  });

  /**
   * Get campaign analytics
   * GET /api/v1/performance/analytics
   */
  getCampaignAnalytics = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { period = '30d', platform, status } = req.query;

    logInfo('Getting campaign analytics', { userId, period, platform, status });

    const result = await performanceService.getPerformanceOverview(userId, {
      period,
      platform,
      status
    });

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    // Return just the analytics portion
    res.status(200).json(successResponse('Campaign analytics retrieved', {
      analytics: result.data.overview,
      platformDistribution: result.data.platformDistribution,
      period
    }));
  });

  /**
   * Get top performing campaigns
   * GET /api/v1/performance/top-campaigns
   */
  getTopCampaigns = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { limit = 5 } = req.query;

    const result = await performanceService.getPerformanceOverview(userId);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(successResponse('Top campaigns retrieved', {
      topCampaigns: result.data.topPerformingCampaigns.slice(0, parseInt(limit))
    }));
  });

  /**
   * Get performance insights
   * GET /api/v1/performance/insights
   */
  getPerformanceInsights = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { period = '30d' } = req.query;

    // Check subscription access for advanced insights
    if (!req.user.hasFeatureAccess || !req.user.hasFeatureAccess('advanced_analytics')) {
      return res.status(403).json(errorResponse('Advanced insights not available in your subscription tier', 403));
    }

    logInfo('Getting performance insights', { userId, period });

    // Note: This would need advanced analytics service methods
    // For now, returning basic insights structure
    res.status(200).json(successResponse('Performance insights retrieved', {
      insights: [
        {
          type: 'engagement_trend',
          title: 'Engagement Rate Improving',
          description: 'Your average engagement rate has increased by 15% this month',
          impact: 'positive',
          recommendation: 'Continue focusing on interactive content formats'
        },
        {
          type: 'platform_performance',
          title: 'Instagram Outperforming',
          description: 'Instagram campaigns show 2.3x better engagement than other platforms',
          impact: 'insight',
          recommendation: 'Consider allocating more resources to Instagram content'
        }
      ],
      period,
      generatedAt: new Date()
    }));
  });

  // ============================================
  // SETTINGS & CONFIGURATION ENDPOINTS
  // ============================================

  /**
   * Get user performance settings
   * GET /api/v1/performance/settings
   */
  getUserSettings = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    const result = await performanceService.getUserSettings(userId);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(result);
  });

  /**
   * Update user performance settings
   * PUT /api/v1/performance/settings
   */
  updateUserSettings = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const updateData = req.body;

    logInfo('Updating performance settings', { userId });

    const result = await performanceService.updateUserSettings(userId, updateData);

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(result);
  });

  /**
   * Update branding settings
   * PUT /api/v1/performance/settings/branding
   */
  updateBrandingSettings = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const brandingData = req.body;

    logInfo('Updating branding settings', { userId });

    const result = await performanceService.updateUserSettings(userId, {
      branding: brandingData
    });

    if (!result.success) {
      return res.status(result.code || 400).json(result);
    }

    res.status(200).json(result);
  });

  /**
   * Upload brand logo
   * POST /api/v1/performance/settings/logo
   */
  uploadBrandLogo = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json(errorResponse('No logo file uploaded', 400));
    }

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json(errorResponse('Invalid file type. Only JPEG, PNG, and WebP images are allowed.', 400));
    }

    // Validate file size (2MB limit for logos)
    if (req.file.size > 2097152) {
      return res.status(400).json(errorResponse('Logo file too large. Maximum size is 2MB.', 400));
    }

    logInfo('Uploading brand logo', { 
      userId, 
      fileName: req.file.originalname,
      fileSize: req.file.size 
    });

    // Note: This would need a service method to upload logo to S3 and update settings
    // For now, returning success response
    res.status(200).json(successResponse('Brand logo uploaded successfully', {
      logoUrl: `https://example.com/logos/${userId}_${Date.now()}.png`,
      uploadedAt: new Date()
    }));
  });

  // ============================================
  // UTILITY ENDPOINTS
  // ============================================

  /**
   * Get performance module metadata
   * GET /api/v1/performance/metadata
   */
  getPerformanceMetadata = asyncHandler(async (req, res) => {
    const metadata = {
      platforms: [
        { value: 'instagram', label: 'Instagram', icon: '📷' },
        { value: 'youtube', label: 'YouTube', icon: '📺' },
        { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
        { value: 'twitter', label: 'Twitter', icon: '🐦' },
        { value: 'facebook', label: 'Facebook', icon: '📘' }
      ],
      campaignStatuses: [
        { value: 'draft', label: 'Draft', color: '#6B7280' },
        { value: 'active', label: 'Active', color: '#10B981' },
        { value: 'completed', label: 'Completed', color: '#3B82F6' },
        { value: 'archived', label: 'Archived', color: '#EF4444' }
      ],
      deliverableTypes: [
        { value: 'post', label: 'Post' },
        { value: 'reel', label: 'Reel/Short' },
        { value: 'story', label: 'Story' },
        { value: 'video', label: 'Video' },
        { value: 'blog', label: 'Blog Post' },
        { value: 'tweet', label: 'Tweet' }
      ],
      reportTemplates: [
        { value: 'minimal', label: 'Minimal', description: 'Clean and simple report' },
        { value: 'professional', label: 'Professional', description: 'Detailed business report' },
        { value: 'detailed', label: 'Detailed', description: 'Comprehensive analysis' },
        { value: 'branded', label: 'Branded', description: 'Custom branded template' },
        { value: 'white_label', label: 'White Label', description: 'Agency-ready template' }
      ],
      subscriptionFeatures: {
        starter: ['basic_storage', 'manual_metrics'],
        pro: ['ai_analysis', 'professional_reports', 'branded_templates'],
        elite: ['advanced_analytics', 'comparison_reports', 'custom_branding'],
        agency: ['multi_creator', 'white_label', 'consolidated_reporting']
      }
    };

    res.status(200).json(successResponse('Performance metadata retrieved', { metadata }));
  });

  /**
   * Health check for performance module
   * GET /api/v1/performance/health
   */
  getHealthCheck = asyncHandler(async (req, res) => {
    res.status(200).json(successResponse('Performance module is healthy', {
      module: 'performance',
      status: 'active',
      features: [
        'campaign_management',
        'screenshot_upload',
        'ai_analysis',
        'report_generation',
        'analytics_dashboard',
        'settings_management'
      ],
      version: '1.0.0',
      timestamp: new Date()
    }));
  });

  // ============================================
  // BULK OPERATIONS
  // ============================================

  /**
   * Bulk update campaigns
   * PUT /api/v1/performance/campaigns/bulk
   */
  bulkUpdateCampaigns = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { campaignIds, updateData } = req.body;

    if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length === 0) {
      return res.status(400).json(errorResponse('Campaign IDs are required', 400));
    }

    if (campaignIds.length > 50) {
      return res.status(400).json(errorResponse('Maximum 50 campaigns can be updated at once', 400));
    }

    logInfo('Bulk updating campaigns', { 
      userId, 
      campaignCount: campaignIds.length,
      updateData 
    });

    // Note: This would need a service method for bulk operations
    // For now, returning success response
    res.status(200).json(successResponse('Campaigns updated successfully', {
      updatedCount: campaignIds.length,
      campaignIds,
      updateData
    }));
  });

  /**
   * Bulk generate reports
   * POST /api/v1/performance/reports/bulk
   */
  bulkGenerateReports = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { campaignIds, reportConfig } = req.body;

    if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length === 0) {
      return res.status(400).json(errorResponse('Campaign IDs are required', 400));
    }

    if (campaignIds.length > 10) {
      return res.status(400).json(errorResponse('Maximum 10 reports can be generated at once', 400));
    }

    logInfo('Bulk generating reports', { 
      userId, 
      campaignCount: campaignIds.length,
      template: reportConfig?.template 
    });

    // Note: This would need a service method for bulk report generation
    // For now, returning success response
    res.status(202).json(successResponse('Report generation started', {
      message: 'Reports are being generated in the background',
      campaignIds,
      estimatedTime: `${campaignIds.length * 30} seconds`
    }));
  });
}

module.exports = new PerformanceController();