/**
 * CreatorsMantra Backend - Performance Module Controller (Complete)
 * Combined services, controllers, and validations for performance tracking
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description All-in-one performance management with AI analysis and client reporting
 */

const { 
  PerformanceCase, 
  PerformanceEvidence, 
  PerformanceAnalysis, 
  PerformanceReport, 
  PerformanceSettings, 
  PerformancePortfolio 
} = require('./model');
const { Deal } = require('../deals/model');
const { User, CreatorProfile } = require('../auth/model');
const { successResponse, errorResponse } = require('../../shared/responses');
const { logInfo, logError, logWarning, asyncHandler } = require('../../shared/utils');
const { AppError } = require('../../shared/errors');
const Joi = require('joi');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const crypto = require('crypto');
const DOMPurify = require('isomorphic-dompurify');
const rateLimit = require('express-rate-limit');

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createPerformanceCaseSchema = Joi.object({
  dealId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid deal ID format',
      'any.required': 'Deal ID is required'
    }),
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'urgent')
    .default('medium'),
  notes: Joi.object({
    creatorNotes: Joi.string().max(1000).allow(''),
    managerNotes: Joi.string().max(1000).allow(''),
    internalNotes: Joi.string().max(1000).allow('')
  }).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
});

const updatePerformanceCaseSchema = Joi.object({
  status: Joi.string()
    .valid('initiated', 'evidence_collection', 'ai_processing', 'analysis_ready', 'report_generated', 'delivered_to_client', 'completed', 'archived')
    .optional(),
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'urgent')
    .optional(),
  notes: Joi.object({
    creatorNotes: Joi.string().max(1000).allow(''),
    managerNotes: Joi.string().max(1000).allow(''),
    internalNotes: Joi.string().max(1000).allow('')
  }).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  businessIntelligence: Joi.object({
    profitability: Joi.object({
      timeInvested: Joi.number().min(0).max(1000),
      costPerDeliverable: Joi.number().min(0),
      efficiency: Joi.string().valid('very_high', 'high', 'average', 'low', 'very_low')
    }).optional(),
    relationshipHealth: Joi.object({
      creatorSatisfaction: Joi.number().min(1).max(10),
      brandSatisfaction: Joi.number().min(1).max(10),
      collaborationRating: Joi.string().valid('excellent', 'good', 'average', 'challenging', 'difficult'),
      repeatProbability: Joi.string().valid('very_likely', 'likely', 'maybe', 'unlikely', 'never')
    }).optional()
  }).optional()
});

const uploadEvidenceSchema = Joi.object({
  evidenceType: Joi.string()
    .valid('content_screenshot', 'analytics_screenshot', 'brand_feedback', 'testimonial', 'additional_deliverable', 'custom')
    .required(),
  relatedDeliverableId: Joi.string().optional(),
  platform: Joi.string()
    .valid('instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'snapchat', 'other')
    .optional(),
  description: Joi.string().max(500).optional(),
  contentUrl: Joi.string().uri().optional(),
  extractedMetrics: Joi.object({
    views: Joi.number().min(0).optional(),
    likes: Joi.number().min(0).optional(),
    comments: Joi.number().min(0).optional(),
    shares: Joi.number().min(0).optional(),
    saves: Joi.number().min(0).optional(),
    reach: Joi.number().min(0).optional(),
    impressions: Joi.number().min(0).optional(),
    engagementRate: Joi.number().min(0).max(100).optional(),
    clickThroughRate: Joi.number().min(0).max(100).optional(),
    customMetrics: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      value: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
      unit: Joi.string().optional()
    })).optional()
  }).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(5).optional()
});

const generateReportSchema = Joi.object({
  template: Joi.string()
    .valid('basic', 'professional', 'detailed', 'branded', 'white_label')
    .required(),
  branding: Joi.object({
    includeCreatorLogo: Joi.boolean().default(true),
    logoUrl: Joi.string().uri().optional(),
    primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#667eea'),
    secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#764ba2'),
    fontFamily: Joi.string().default('Inter'),
    customFooter: Joi.string().max(200).optional(),
    watermark: Joi.string().max(50).optional()
  }).optional(),
  includeMetrics: Joi.array().items(
    Joi.string().valid('views', 'likes', 'comments', 'shares', 'saves', 'reach', 'impressions', 'engagementRate', 'clickThroughRate')
  ).optional(),
  customSections: Joi.array().items(Joi.object({
    title: Joi.string().required(),
    content: Joi.string().required()
  })).optional()
});

const settingsSchema = Joi.object({
  defaultReportSettings: Joi.object({
    template: Joi.string().valid('basic', 'professional', 'detailed', 'branded', 'white_label').optional(),
    includeMetrics: Joi.object({
      views: Joi.boolean().optional(),
      likes: Joi.boolean().optional(),
      comments: Joi.boolean().optional(),
      shares: Joi.boolean().optional(),
      saves: Joi.boolean().optional(),
      reach: Joi.boolean().optional(),
      impressions: Joi.boolean().optional(),
      engagementRate: Joi.boolean().optional(),
      clickThroughRate: Joi.boolean().optional()
    }).optional(),
    autoGenerateReports: Joi.boolean().optional(),
    autoSendToClients: Joi.boolean().optional()
  }).optional(),
  brandingSettings: Joi.object({
    colors: Joi.object({
      primary: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
      secondary: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
      accent: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional()
    }).optional(),
    fonts: Joi.object({
      heading: Joi.string().optional(),
      body: Joi.string().optional()
    }).optional(),
    contactInfo: Joi.object({
      website: Joi.string().uri().optional(),
      email: Joi.string().email().optional(),
      phone: Joi.string().optional(),
      address: Joi.string().optional()
    }).optional(),
    footerText: Joi.string().max(200).optional(),
    socialMedia: Joi.array().items(Joi.object({
      platform: Joi.string().required(),
      handle: Joi.string().required(),
      url: Joi.string().uri().optional()
    })).optional()
  }).optional(),
  notifications: Joi.object({
    emailNotifications: Joi.boolean().optional(),
    analysisCompleted: Joi.boolean().optional(),
    reportGenerated: Joi.boolean().optional(),
    clientInteraction: Joi.boolean().optional(),
    performanceInsights: Joi.boolean().optional()
  }).optional(),
  integrations: Joi.object({
    rateCardOptimization: Joi.boolean().optional(),
    dealSuggestions: Joi.boolean().optional(),
    portfolioUpdates: Joi.boolean().optional()
  }).optional()
});

// ============================================
// RATE LIMITERS
// ============================================

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later.'
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per window
  message: 'Upload limit exceeded, please try again later.'
});

const aiAnalysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 AI analysis requests per hour
  message: 'AI analysis limit exceeded, please try again later.'
});

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../../uploads/performance');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const userId = req.user?.userId || 'unknown';
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    cb(null, `${userId}_${uniqueSuffix}_${baseName}${fileExtension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: JPG, PNG, WEBP, PDF, TXT, DOC, DOCX'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files per upload
  },
  fileFilter: fileFilter
});

// ============================================
// SERVICE FUNCTIONS
// ============================================

class PerformanceService {
  
  // Check subscription access
  static checkSubscriptionAccess(user, feature) {
    const tierFeatures = {
      starter: ['basic_performance'],
      pro: ['basic_performance', 'ai_analysis', 'professional_reports'],
      elite: ['basic_performance', 'ai_analysis', 'professional_reports', 'advanced_analytics', 'branded_reports'],
      agency_starter: ['all_creator_features', 'multi_creator_dashboard'],
      agency_pro: ['all_features', 'white_label_reports']
    };
    
    const userFeatures = tierFeatures[user.subscriptionTier] || [];
    return userFeatures.includes(feature) || userFeatures.includes('all_features') || userFeatures.includes('all_creator_features');
  }

  // Auto-create performance case from completed deal
  static async createFromCompletedDeal(dealId, userId) {
    try {
      const deal = await Deal.findById(dealId);
      
      if (!deal) {
        throw new AppError('Deal not found', 404, 'DEAL_NOT_FOUND');
      }
      
      if (deal.userId.toString() !== userId.toString()) {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }
      
      if (!['completed', 'paid'].includes(deal.stage)) {
        throw new AppError('Deal must be completed or paid', 400, 'INVALID_DEAL_STAGE');
      }
      
      // Check if performance case already exists
      const existingCase = await PerformanceCase.findOne({ dealId });
      if (existingCase) {
        return existingCase;
      }
      
      // Get manager if exists
      const creatorProfile = await CreatorProfile.findOne({ userId });
      const activeManager = creatorProfile?.managers.find(m => m.status === 'active');
      
      const performanceCase = await PerformanceCase.create({
        dealId,
        creatorId: userId,
        managerId: activeManager?.managerId || null,
        creationTrigger: 'deal_completed',
        status: 'evidence_collection'
      });
      
      logInfo('Performance case created from completed deal', { 
        performanceCaseId: performanceCase._id,
        dealId,
        userId 
      });
      
      return performanceCase;
      
    } catch (error) {
      logError('Error creating performance case from deal', { error: error.message, dealId, userId });
      throw error;
    }
  }

  // AI Analysis using OpenAI
  static async performAIAnalysis(performanceCaseId) {
    try {
      const performanceCase = await PerformanceCase.findById(performanceCaseId);
      if (!performanceCase) {
        throw new AppError('Performance case not found', 404, 'CASE_NOT_FOUND');
      }

      // Get all evidence for this case
      const evidence = await PerformanceEvidence.find({ performanceCaseId });
      
      if (evidence.length === 0) {
        throw new AppError('No evidence available for analysis', 400, 'NO_EVIDENCE');
      }

      // Create or update analysis record
      let analysis = await PerformanceAnalysis.findOne({ performanceCaseId });
      if (!analysis) {
        analysis = await PerformanceAnalysis.create({ performanceCaseId });
      }

      analysis.aiAnalysis.status = 'processing';
      analysis.aiAnalysis.processedAt = new Date();
      await analysis.save();

      // Prepare data for AI analysis
      const analysisPrompt = this.buildAnalysisPrompt(performanceCase, evidence);
      
      // Call OpenAI API
      const openaiResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert social media performance analyst. Analyze campaign performance and provide actionable insights.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const aiInsights = JSON.parse(openaiResponse.data.choices[0].message.content);

      // Update analysis with AI results
      analysis.aiAnalysis = {
        status: 'completed',
        processedAt: new Date(),
        processingTime: Math.floor((new Date() - analysis.aiAnalysis.processedAt) / 1000),
        model: 'gpt-4',
        prompt: analysisPrompt,
        rawResponse: JSON.stringify(aiInsights),
        confidence: aiInsights.confidence || 0.8
      };

      analysis.performanceComparison = aiInsights.performanceComparison || {};
      analysis.insights = aiInsights.insights || {};
      analysis.businessMetrics = aiInsights.businessMetrics || {};
      analysis.predictions = aiInsights.predictions || {};

      await analysis.save();

      // Update performance case summary
      performanceCase.aiAnalysisSummary = {
        overallPerformance: aiInsights.overallPerformance || 'met_expectations',
        keyAchievements: aiInsights.insights?.keySuccessFactors || [],
        improvementAreas: aiInsights.insights?.improvementAreas || [],
        confidenceScore: aiInsights.confidence || 0.8,
        lastAnalyzedAt: new Date()
      };

      performanceCase.status = 'analysis_ready';
      await performanceCase.save();

      logInfo('AI analysis completed', { performanceCaseId, confidence: aiInsights.confidence });

      return analysis;

    } catch (error) {
      // Update analysis status to failed
      const analysis = await PerformanceAnalysis.findOne({ performanceCaseId });
      if (analysis) {
        analysis.aiAnalysis.status = 'failed';
        analysis.aiAnalysis.error = error.message;
        await analysis.save();
      }

      logError('AI analysis failed', { error: error.message, performanceCaseId });
      throw error;
    }
  }

  // Build AI analysis prompt
  static buildAnalysisPrompt(performanceCase, evidence) {
    const dealInfo = performanceCase.dealInfo;
    const evidenceData = evidence.map(e => ({
      type: e.evidenceType,
      platform: e.platform,
      metrics: e.extractedMetrics,
      description: e.description
    }));

    return `
Analyze this social media campaign performance:

CAMPAIGN DETAILS:
- Brand: ${dealInfo.brandName}
- Platform: ${dealInfo.primaryPlatform}
- Campaign Title: ${dealInfo.title}
- Deal Value: ${dealInfo.dealValue.currency} ${dealInfo.dealValue.amount}
- Deliverables: ${dealInfo.deliverables.length} items

PERFORMANCE TARGETS:
${JSON.stringify(dealInfo.performanceTargets, null, 2)}

ACTUAL PERFORMANCE DATA:
${JSON.stringify(evidenceData, null, 2)}

Please provide analysis in the following JSON format:
{
  "overallPerformance": "excellent|above_expectations|met_expectations|below_expectations|poor",
  "confidence": 0.8,
  "performanceComparison": {
    "overallScore": 85,
    "metricsComparison": [
      {
        "metric": "views",
        "expected": 10000,
        "actual": 12000,
        "performance": "exceeded",
        "percentageDifference": 20
      }
    ],
    "topPerformers": ["Instagram Reel"],
    "underPerformers": ["Instagram Story"]
  },
  "insights": {
    "keySuccessFactors": ["High engagement rate", "Optimal posting time"],
    "improvementAreas": ["Story completion rate", "Call-to-action clarity"],
    "contentOptimizations": ["Use trending audio", "Include clear CTA"],
    "timingRecommendations": ["Post between 7-9 PM"],
    "audienceInsights": ["High engagement from 18-24 age group"],
    "platformSpecificTips": [
      {
        "platform": "instagram",
        "recommendations": ["Use Reels for higher reach"]
      }
    ]
  },
  "businessMetrics": {
    "costPerEngagement": 2.5,
    "costPerView": 0.1,
    "engagementValue": 15.3,
    "brandAwarenessScore": 78,
    "repeatCollaborationScore": 85
  },
  "predictions": {
    "nextDealValue": {
      "estimated": 25000,
      "confidence": 0.7,
      "reasoning": "Strong performance metrics justify 25% rate increase"
    },
    "optimalPricing": [
      {
        "deliverable": "Instagram Reel",
        "suggestedPrice": 15000,
        "reasoning": "High engagement and reach metrics"
      }
    ],
    "riskFactors": ["Declining story engagement"],
    "opportunities": ["Expand to video content"]
  }
}
`;
  }

  // Generate PDF Report
  static async generatePDFReport(performanceCaseId, template, branding = {}) {
    try {
      const performanceCase = await PerformanceCase.findById(performanceCaseId)
        .populate('creatorId', 'fullName email')
        .populate('managerId', 'fullName email');
        
      if (!performanceCase) {
        throw new AppError('Performance case not found', 404, 'CASE_NOT_FOUND');
      }

      const analysis = await PerformanceAnalysis.findOne({ performanceCaseId });
      const evidence = await PerformanceEvidence.find({ performanceCaseId });

      // Create PDF document
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
      });

      const fileName = `performance_report_${performanceCase.caseId}_${Date.now()}.pdf`;
      const filePath = path.join(__dirname, '../../../uploads/performance/reports', fileName);
      
      // Ensure reports directory exists
      const reportsDir = path.dirname(filePath);
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      doc.pipe(fs.createWriteStream(filePath));

      // Header with branding
      doc.fontSize(24)
         .fillColor(branding.primaryColor || '#667eea')
         .text('Performance Report', 50, 50);

      doc.fontSize(16)
         .fillColor('#333')
         .text(`Campaign: ${performanceCase.dealInfo.title}`, 50, 90)
         .text(`Brand: ${performanceCase.dealInfo.brandName}`, 50, 115)
         .text(`Creator: ${performanceCase.creatorId.fullName}`, 50, 140);

      // Executive Summary
      doc.fontSize(18)
         .fillColor(branding.primaryColor || '#667eea')
         .text('Executive Summary', 50, 190);

      if (analysis) {
        doc.fontSize(12)
           .fillColor('#333')
           .text(`Overall Performance: ${analysis.performanceComparison.overallScore || 'N/A'}/100`, 50, 220)
           .text(`Campaign Status: ${performanceCase.aiAnalysisSummary.overallPerformance || 'Under Review'}`, 50, 240);
      }

      // Key Metrics Section
      doc.fontSize(18)
         .fillColor(branding.primaryColor || '#667eea')
         .text('Key Performance Metrics', 50, 290);

      let yPosition = 320;
      evidence.forEach((item, index) => {
        if (item.extractedMetrics && Object.keys(item.extractedMetrics).length > 0) {
          doc.fontSize(14)
             .fillColor('#333')
             .text(`${item.evidenceType.replace('_', ' ').toUpperCase()}:`, 50, yPosition);
          
          yPosition += 20;
          
          Object.entries(item.extractedMetrics).forEach(([key, value]) => {
            if (value && key !== 'customMetrics' && key !== 'extractionStatus') {
              doc.fontSize(11)
                 .text(`• ${key}: ${typeof value === 'number' ? value.toLocaleString() : value}`, 70, yPosition);
              yPosition += 15;
            }
          });
          
          yPosition += 10;
        }
      });

      // Insights Section
      if (analysis && analysis.insights) {
        doc.fontSize(18)
           .fillColor(branding.primaryColor || '#667eea')
           .text('Key Insights & Recommendations', 50, yPosition);

        yPosition += 30;

        if (analysis.insights.keySuccessFactors?.length > 0) {
          doc.fontSize(14)
             .fillColor('#333')
             .text('Success Factors:', 50, yPosition);
          
          yPosition += 20;
          
          analysis.insights.keySuccessFactors.forEach(factor => {
            doc.fontSize(11)
               .text(`• ${factor}`, 70, yPosition);
            yPosition += 15;
          });
        }

        if (analysis.insights.improvementAreas?.length > 0) {
          yPosition += 10;
          doc.fontSize(14)
             .fillColor('#333')
             .text('Areas for Improvement:', 50, yPosition);
          
          yPosition += 20;
          
          analysis.insights.improvementAreas.forEach(area => {
            doc.fontSize(11)
               .text(`• ${area}`, 70, yPosition);
            yPosition += 15;
          });
        }
      }

      // Footer
      if (branding.customFooter) {
        doc.fontSize(10)
           .fillColor('#666')
           .text(branding.customFooter, 50, doc.page.height - 100);
      }

      doc.end();

      // Wait for PDF generation to complete
      await new Promise((resolve, reject) => {
        doc.on('end', resolve);
        doc.on('error', reject);
      });

      logInfo('PDF report generated', { performanceCaseId, fileName });

      return {
        fileName,
        filePath,
        fileSize: fs.statSync(filePath).size
      };

    } catch (error) {
      logError('PDF generation failed', { error: error.message, performanceCaseId });
      throw error;
    }
  }

  // Update rate card based on performance data
  static async updateRateCardFromPerformance(performanceCaseId) {
    try {
      const performanceCase = await PerformanceCase.findById(performanceCaseId);
      const analysis = await PerformanceAnalysis.findOne({ performanceCaseId });
      
      if (!performanceCase || !analysis) {
        throw new AppError('Performance data not found', 404, 'DATA_NOT_FOUND');
      }

      const creatorProfile = await CreatorProfile.findOne({ userId: performanceCase.creatorId });
      if (!creatorProfile) {
        return;
      }

      // Calculate performance multiplier
      let performanceMultiplier = 1.0;
      if (analysis.performanceComparison.overallScore >= 90) {
        performanceMultiplier = 1.2; // 20% increase for excellent performance
      } else if (analysis.performanceComparison.overallScore >= 80) {
        performanceMultiplier = 1.1; // 10% increase for good performance
      } else if (analysis.performanceComparison.overallScore < 60) {
        performanceMultiplier = 0.9; // 10% decrease for poor performance
      }

      // Update rate card based on primary platform and deliverables
      const platform = performanceCase.dealInfo.primaryPlatform;
      
      if (platform === 'instagram' && creatorProfile.rateCard.instagram) {
        performanceCase.dealInfo.deliverables.forEach(deliverable => {
          if (deliverable.type === 'instagram_post') {
            const newRate = Math.round(creatorProfile.rateCard.instagram.post * performanceMultiplier);
            creatorProfile.rateCard.instagram.post = newRate;
          } else if (deliverable.type === 'instagram_reel') {
            const newRate = Math.round(creatorProfile.rateCard.instagram.reel * performanceMultiplier);
            creatorProfile.rateCard.instagram.reel = newRate;
          } else if (deliverable.type === 'instagram_story') {
            const newRate = Math.round(creatorProfile.rateCard.instagram.story * performanceMultiplier);
            creatorProfile.rateCard.instagram.story = newRate;
          }
        });
      } else if (platform === 'youtube' && creatorProfile.rateCard.youtube) {
        performanceCase.dealInfo.deliverables.forEach(deliverable => {
          if (deliverable.type === 'youtube_video') {
            const newRate = Math.round(creatorProfile.rateCard.youtube.dedicated * performanceMultiplier);
            creatorProfile.rateCard.youtube.dedicated = newRate;
          } else if (deliverable.type === 'youtube_short') {
            const newRate = Math.round(creatorProfile.rateCard.youtube.shorts * performanceMultiplier);
            creatorProfile.rateCard.youtube.shorts = newRate;
          }
        });
      }

      creatorProfile.rateCard.lastUpdated = new Date();
      await creatorProfile.save();

      // Store rate card feedback
      performanceCase.rateCardFeedback = {
        suggestedRateAdjustment: {
          deliverableType: performanceCase.dealInfo.deliverables[0]?.type,
          currentRate: performanceCase.dealInfo.dealValue.amount,
          suggestedRate: Math.round(performanceCase.dealInfo.dealValue.amount * performanceMultiplier),
          adjustmentReason: `Performance score: ${analysis.performanceComparison.overallScore}`,
          confidence: 0.8
        }
      };

      await performanceCase.save();

      logInfo('Rate card updated from performance', { 
        creatorId: performanceCase.creatorId,
        performanceMultiplier,
        overallScore: analysis.performanceComparison.overallScore
      });

    } catch (error) {
      logError('Rate card update failed', { error: error.message, performanceCaseId });
    }
  }
}

// ============================================
// CONTROLLER FUNCTIONS
// ============================================

/**
 * Create new performance case
 * POST /api/v1/performance/cases
 */
const createPerformanceCase = asyncHandler(async (req, res) => {
  const { error, value } = createPerformanceCaseSchema.validate(req.body);
  if (error) {
    return res.status(400).json(errorResponse(
      'Validation failed',
      { errors: error.details.map(d => d.message) },
      400
    ));
  }

  const userId = req.user.userId;
  const { dealId, priority, notes, tags } = value;

  // Check if user has access to create performance cases
  if (!PerformanceService.checkSubscriptionAccess(req.user, 'basic_performance')) {
    return res.status(403).json(errorResponse(
      'Upgrade required for performance tracking',
      { requiredTier: 'pro' },
      403
    ));
  }

  const performanceCase = await PerformanceService.createFromCompletedDeal(dealId, userId);

  // Update with additional data
  if (priority) performanceCase.priority = priority;
  if (notes) performanceCase.notes = notes;
  if (tags) performanceCase.tags = tags;

  await performanceCase.save();

  res.status(201).json(successResponse(
    'Performance case created successfully',
    {
      performanceCase: {
        id: performanceCase._id,
        caseId: performanceCase.caseId,
        dealInfo: performanceCase.dealInfo,
        status: performanceCase.status,
        evidenceCollection: performanceCase.evidenceCollection,
        createdAt: performanceCase.createdAt
      }
    },
    201
  ));
});

/**
 * Get performance cases for user
 * GET /api/v1/performance/cases
 */
const getPerformanceCases = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { status, priority, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {
    $or: [
      { creatorId: userId },
      { managerId: userId }
    ],
    isArchived: false
  };

  if (status) query.status = status;
  if (priority) query.priority = priority;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [cases, totalCount] = await Promise.all([
    PerformanceCase.find(query)
      .populate('creatorId', 'fullName email profilePicture')
      .populate('managerId', 'fullName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    PerformanceCase.countDocuments(query)
  ]);

  res.json(successResponse(
    'Performance cases retrieved successfully',
    {
      cases,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    }
  ));
});

/**
 * Get single performance case
 * GET /api/v1/performance/cases/:id
 */
const getPerformanceCase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const performanceCase = await PerformanceCase.findById(id)
    .populate('creatorId', 'fullName email profilePicture')
    .populate('managerId', 'fullName email');

  if (!performanceCase) {
    return res.status(404).json(errorResponse('Performance case not found', null, 404));
  }

  // Check access
  const hasAccess = await performanceCase.hasUserAccess(userId, 'view');
  if (!hasAccess) {
    return res.status(403).json(errorResponse('Access denied', null, 403));
  }

  // Get related data
  const [evidence, analysis, reports] = await Promise.all([
    PerformanceEvidence.find({ performanceCaseId: id }).sort({ createdAt: -1 }),
    PerformanceAnalysis.findOne({ performanceCaseId: id }),
    PerformanceReport.find({ performanceCaseId: id }).sort({ createdAt: -1 })
  ]);

  res.json(successResponse(
    'Performance case retrieved successfully',
    {
      performanceCase,
      evidence,
      analysis,
      reports
    }
  ));
});

/**
 * Update performance case
 * PUT /api/v1/performance/cases/:id
 */
const updatePerformanceCase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const { error, value } = updatePerformanceCaseSchema.validate(req.body);
  if (error) {
    return res.status(400).json(errorResponse(
      'Validation failed',
      { errors: error.details.map(d => d.message) },
      400
    ));
  }

  const performanceCase = await PerformanceCase.findById(id);
  if (!performanceCase) {
    return res.status(404).json(errorResponse('Performance case not found', null, 404));
  }

  // Check access
  const hasAccess = await performanceCase.hasUserAccess(userId, 'edit');
  if (!hasAccess) {
    return res.status(403).json(errorResponse('Access denied', null, 403));
  }

  // Update fields
  Object.assign(performanceCase, value);
  performanceCase.updatedAt = new Date();

  await performanceCase.save();

  res.json(successResponse(
    'Performance case updated successfully',
    { performanceCase }
  ));
});

/**
 * Upload evidence files
 * POST /api/v1/performance/cases/:id/evidence
 */
const uploadEvidence = [
  uploadLimiter,
  upload.array('files', 5),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json(errorResponse('No files uploaded', null, 400));
    }

    const { error, value } = uploadEvidenceSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(
        'Validation failed',
        { errors: error.details.map(d => d.message) },
        400
      ));
    }

    const performanceCase = await PerformanceCase.findById(id);
    if (!performanceCase) {
      return res.status(404).json(errorResponse('Performance case not found', null, 404));
    }

    // Check access
    const hasAccess = await performanceCase.hasUserAccess(userId, 'edit');
    if (!hasAccess) {
      return res.status(403).json(errorResponse('Access denied', null, 403));
    }

    const uploadedEvidence = [];

    for (const file of req.files) {
      const evidence = await PerformanceEvidence.create({
        performanceCaseId: id,
        uploadedBy: userId,
        evidenceType: value.evidenceType,
        relatedDeliverableId: value.relatedDeliverableId,
        platform: value.platform,
        description: value.description,
        contentUrl: value.contentUrl,
        extractedMetrics: value.extractedMetrics,
        tags: value.tags,
        fileInfo: {
          originalName: file.originalname,
          storedName: file.filename,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileExtension: path.extname(file.originalname)
        }
      });

      uploadedEvidence.push(evidence);
    }

    // Update evidence collection status
    const evidenceType = value.evidenceType;
    if (performanceCase.evidenceCollection.checklist[evidenceType]) {
      performanceCase.evidenceCollection.checklist[evidenceType].collected = true;
      performanceCase.evidenceCollection.checklist[evidenceType].fileCount += req.files.length;
    }

    performanceCase.evidenceCollection.totalFilesUploaded += req.files.length;
    performanceCase.evidenceCollection.lastUpdated = new Date();

    // Update status if all required evidence is collected
    if (performanceCase.status === 'initiated') {
      performanceCase.status = 'evidence_collection';
    }

    await performanceCase.save();

    logInfo('Evidence uploaded', {
      performanceCaseId: id,
      fileCount: req.files.length,
      evidenceType: value.evidenceType,
      userId
    });

    res.status(201).json(successResponse(
      'Evidence uploaded successfully',
      { 
        evidence: uploadedEvidence,
        performanceCase: {
          id: performanceCase._id,
          evidenceCollection: performanceCase.evidenceCollection,
          status: performanceCase.status
        }
      },
      201
    ));
  })
];

/**
 * Trigger AI analysis
 * POST /api/v1/performance/cases/:id/analyze
 */
const triggerAIAnalysis = [
  aiAnalysisLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    // Check subscription access
    if (!PerformanceService.checkSubscriptionAccess(req.user, 'ai_analysis')) {
      return res.status(403).json(errorResponse(
        'AI analysis requires Pro subscription',
        { requiredTier: 'pro' },
        403
      ));
    }

    const performanceCase = await PerformanceCase.findById(id);
    if (!performanceCase) {
      return res.status(404).json(errorResponse('Performance case not found', null, 404));
    }

    // Check access
    const hasAccess = await performanceCase.hasUserAccess(userId, 'view');
    if (!hasAccess) {
      return res.status(403).json(errorResponse('Access denied', null, 403));
    }

    if (performanceCase.evidenceCollection.completionPercentage < 50) {
      return res.status(400).json(errorResponse(
        'Insufficient evidence for analysis',
        { completionPercentage: performanceCase.evidenceCollection.completionPercentage },
        400
      ));
    }

    // Start AI analysis (async)
    PerformanceService.performAIAnalysis(id).catch(error => {
      logError('AI analysis background process failed', { error: error.message, performanceCaseId: id });
    });

    // Update status immediately
    performanceCase.status = 'ai_processing';
    await performanceCase.save();

    res.json(successResponse(
      'AI analysis started successfully',
      {
        performanceCase: {
          id: performanceCase._id,
          status: performanceCase.status,
          message: 'Analysis is processing. You will be notified when complete.'
        }
      }
    ));
  })
];

/**
 * Generate performance report
 * POST /api/v1/performance/cases/:id/reports
 */
const generateReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const { error, value } = generateReportSchema.validate(req.body);
  if (error) {
    return res.status(400).json(errorResponse(
      'Validation failed',
      { errors: error.details.map(d => d.message) },
      400
    ));
  }

  const performanceCase = await PerformanceCase.findById(id);
  if (!performanceCase) {
    return res.status(404).json(errorResponse('Performance case not found', null, 404));
  }

  // Check access
  const hasAccess = await performanceCase.hasUserAccess(userId, 'generate_report');
  if (!hasAccess) {
    return res.status(403).json(errorResponse('Access denied', null, 403));
  }

  // Check subscription access for advanced templates
  if (['branded', 'white_label'].includes(value.template)) {
    if (!PerformanceService.checkSubscriptionAccess(req.user, 'branded_reports')) {
      return res.status(403).json(errorResponse(
        'Advanced report templates require Elite subscription',
        { requiredTier: 'elite' },
        403
      ));
    }
  }

  // Create report record
  const report = await PerformanceReport.create({
    performanceCaseId: id,
    generatedBy: userId,
    template: value.template,
    branding: value.branding || {},
    generationStatus: {
      status: 'generating',
      startedAt: new Date()
    }
  });

  try {
    // Generate PDF in background
    const pdfInfo = await PerformanceService.generatePDFReport(id, value.template, value.branding);
    
    // Update report with file info
    report.fileInfo = {
      fileName: pdfInfo.fileName,
      filePath: pdfInfo.filePath,
      fileSize: pdfInfo.fileSize,
      fileUrl: `/api/v1/performance/reports/${report._id}/download`
    };

    report.generationStatus = {
      status: 'completed',
      startedAt: report.generationStatus.startedAt,
      completedAt: new Date(),
      processingTime: Math.floor((new Date() - report.generationStatus.startedAt) / 1000)
    };

    await report.save();

    // Update performance case
    performanceCase.clientCommunication.reportGenerated = true;
    performanceCase.clientCommunication.reportGeneratedAt = new Date();
    
    if (performanceCase.status === 'analysis_ready') {
      performanceCase.status = 'report_generated';
    }
    
    await performanceCase.save();

    res.status(201).json(successResponse(
      'Report generated successfully',
      { 
        report: {
          id: report._id,
          reportId: report.reportId,
          template: report.template,
          fileInfo: report.fileInfo,
          generationStatus: report.generationStatus,
          createdAt: report.createdAt
        }
      },
      201
    ));

  } catch (error) {
    // Update report status to failed
    report.generationStatus.status = 'failed';
    report.generationStatus.error = error.message;
    await report.save();

    logError('Report generation failed', { error: error.message, reportId: report._id });

    res.status(500).json(errorResponse(
      'Report generation failed',
      { error: error.message },
      500
    ));
  }
});

/**
 * Download report
 * GET /api/v1/performance/reports/:reportId/download
 */
const downloadReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.userId;

  const report = await PerformanceReport.findById(reportId)
    .populate({
      path: 'performanceCaseId',
      select: 'creatorId managerId'
    });

  if (!report) {
    return res.status(404).json(errorResponse('Report not found', null, 404));
  }

  // Check access
  const performanceCase = report.performanceCaseId;
  const hasAccess = await performanceCase.hasUserAccess(userId, 'view');
  if (!hasAccess) {
    return res.status(403).json(errorResponse('Access denied', null, 403));
  }

  if (!report.fileInfo.filePath || !fs.existsSync(report.fileInfo.filePath)) {
    return res.status(404).json(errorResponse('Report file not found', null, 404));
  }

  // Update download stats
  report.sharing.downloadCount += 1;
  report.sharing.lastAccessedAt = new Date();
  await report.save();

  // Set headers for file download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${report.fileInfo.fileName}"`);

  // Stream file to response
  const fileStream = fs.createReadStream(report.fileInfo.filePath);
  fileStream.pipe(res);
});

/**
 * Send report to client
 * POST /api/v1/performance/reports/:reportId/send
 */
const sendReportToClient = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.userId;
  const { clientEmail, subject, message } = req.body;

  if (!clientEmail) {
    return res.status(400).json(errorResponse('Client email is required', null, 400));
  }

  const report = await PerformanceReport.findById(reportId)
    .populate({
      path: 'performanceCaseId',
      select: 'creatorId managerId dealInfo clientCommunication'
    });

  if (!report) {
    return res.status(404).json(errorResponse('Report not found', null, 404));
  }

  // Check access
  const performanceCase = report.performanceCaseId;
  const hasAccess = await performanceCase.hasUserAccess(userId, 'send_to_client');
  if (!hasAccess) {
    return res.status(403).json(errorResponse('Access denied', null, 403));
  }

  // TODO: Implement email sending service
  // For now, we'll just update the tracking
  
  report.clientInteraction = {
    sentToClient: true,
    sentAt: new Date(),
    sentBy: userId,
    clientEmail,
    emailSubject: subject || `Performance Report - ${performanceCase.dealInfo.title}`,
    emailBody: message || 'Please find attached your campaign performance report.',
    deliveryStatus: 'sent'
  };

  await report.save();

  // Update performance case
  performanceCase.clientCommunication.reportSent = true;
  performanceCase.clientCommunication.reportSentAt = new Date();
  performanceCase.clientCommunication.sentBy = userId;
  performanceCase.clientCommunication.sentTo = clientEmail;
  
  if (performanceCase.status === 'report_generated') {
    performanceCase.status = 'delivered_to_client';
  }

  await performanceCase.save();

  logInfo('Report sent to client', {
    reportId,
    clientEmail,
    performanceCaseId: performanceCase._id,
    sentBy: userId
  });

  res.json(successResponse(
    'Report sent to client successfully',
    {
      report: {
        id: report._id,
        clientInteraction: report.clientInteraction
      },
      performanceCase: {
        id: performanceCase._id,
        status: performanceCase.status,
        clientCommunication: performanceCase.clientCommunication
      }
    }
  ));
});

/**
 * Get/Update user settings
 * GET/PUT /api/v1/performance/settings
 */
const getSettings = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  let settings = await PerformanceSettings.findOne({ userId });
  
  if (!settings) {
    // Create default settings
    settings = await PerformanceSettings.create({ userId });
  }

  res.json(successResponse(
    'Settings retrieved successfully',
    { settings }
  ));
});

const updateSettings = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const { error, value } = settingsSchema.validate(req.body);
  if (error) {
    return res.status(400).json(errorResponse(
      'Validation failed',
      { errors: error.details.map(d => d.message) },
      400
    ));
  }

  let settings = await PerformanceSettings.findOne({ userId });
  
  if (!settings) {
    settings = await PerformanceSettings.create({ 
      userId,
      ...value
    });
  } else {
    Object.assign(settings, value);
    settings.updatedAt = new Date();
    await settings.save();
  }

  res.json(successResponse(
    'Settings updated successfully',
    { settings }
  ));
});

/**
 * Get performance analytics/dashboard
 * GET /api/v1/performance/analytics
 */
const getAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { period = '30d', platform } = req.query;

  // Date range calculation
  const now = new Date();
  let startDate;
  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const matchQuery = {
    $or: [
      { creatorId: userId },
      { managerId: userId }
    ],
    createdAt: { $gte: startDate },
    isArchived: false
  };

  if (platform) {
    matchQuery['dealInfo.primaryPlatform'] = platform;
  }

  // Aggregate performance data
  const [overviewStats, statusDistribution, platformStats, recentCases] = await Promise.all([
    PerformanceCase.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalCases: { $sum: 1 },
          completedCases: {
            $sum: { $cond: [{ $in: ['$status', ['completed', 'delivered_to_client']] }, 1, 0] }
          },
          totalDealValue: { $sum: '$dealInfo.dealValue.amount' },
          avgCompletionRate: { $avg: '$evidenceCollection.completionPercentage' },
          avgConfidenceScore: { $avg: '$aiAnalysisSummary.confidenceScore' }
        }
      }
    ]),

    PerformanceCase.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),

    PerformanceCase.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$dealInfo.primaryPlatform',
          count: { $sum: 1 },
          totalValue: { $sum: '$dealInfo.dealValue.amount' },
          avgPerformance: { $avg: '$aiAnalysisSummary.confidenceScore' }
        }
      }
    ]),

    PerformanceCase.find(matchQuery)
      .populate('creatorId', 'fullName profilePicture')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('caseId dealInfo status aiAnalysisSummary createdAt')
  ]);

  const analytics = {
    overview: overviewStats[0] || {
      totalCases: 0,
      completedCases: 0,
      totalDealValue: 0,
      avgCompletionRate: 0,
      avgConfidenceScore: 0
    },
    statusDistribution: statusDistribution.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    platformStats: platformStats.map(stat => ({
      platform: stat._id,
      caseCount: stat.count,
      totalValue: stat.totalValue,
      avgPerformance: Math.round((stat.avgPerformance || 0) * 100)
    })),
    recentCases,
    period,
    generatedAt: new Date()
  };

  res.json(successResponse(
    'Analytics retrieved successfully',
    { analytics }
  ));
});

/**
 * Archive performance case
 * DELETE /api/v1/performance/cases/:id
 */
const archivePerformanceCase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const performanceCase = await PerformanceCase.findById(id);
  if (!performanceCase) {
    return res.status(404).json(errorResponse('Performance case not found', null, 404));
  }

  // Check access
  const hasAccess = await performanceCase.hasUserAccess(userId, 'edit');
  if (!hasAccess) {
    return res.status(403).json(errorResponse('Access denied', null, 403));
  }

  performanceCase.isArchived = true;
  performanceCase.archivedAt = new Date();
  performanceCase.archivedBy = userId;
  performanceCase.status = 'archived';

  await performanceCase.save();

  res.json(successResponse('Performance case archived successfully'));
});

// ============================================
// RATE LIMITERS EXPORT
// ============================================

const rateLimiters = {
  standard: standardLimiter,
  upload: uploadLimiter,
  aiAnalysis: aiAnalysisLimiter
};

// ============================================
// EXPORT ALL CONTROLLERS
// ============================================

module.exports = {
  // Main Controllers
  createPerformanceCase,
  getPerformanceCases,
  getPerformanceCase,
  updatePerformanceCase,
  uploadEvidence,
  triggerAIAnalysis,
  generateReport,
  downloadReport,
  sendReportToClient,
  getSettings,
  updateSettings,
  getAnalytics,
  archivePerformanceCase,
  
  // Rate Limiters
  rateLimiters,
  
  // Service Class (for internal use)
  PerformanceService
};