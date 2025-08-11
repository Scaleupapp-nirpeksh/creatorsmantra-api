/**
 * CreatorsMantra Backend - Performance Vault Models
 * MongoDB schemas for campaign analytics, screenshot storage, and report generation
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Performance tracking models with AI analysis and branded reporting
 * 
 * File Path: src/modules/performance/model.js
 */

const mongoose = require('mongoose');
const { logInfo, logError } = require('../../shared/utils');

// ============================================
// CAMPAIGN PERFORMANCE SCHEMA
// ============================================

/**
 * Main campaign tracking schema
 * Stores campaign details, metrics, and AI analysis results
 */
const campaignSchema = new mongoose.Schema({
  // Basic Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  dealId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal',
    required: false, // Can create campaigns without deals
    index: true
  },
  campaignName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  brandName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  platform: {
    type: String,
    required: true,
    enum: ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'other'],
    lowercase: true
  },
  
  // Campaign Timeline
  campaignPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    duration: {
      type: Number, // Days
      default: function() {
        if (this.campaignPeriod.startDate && this.campaignPeriod.endDate) {
          return Math.ceil((this.campaignPeriod.endDate - this.campaignPeriod.startDate) / (1000 * 60 * 60 * 24));
        }
        return 1;
      }
    }
  },
  
  // Content Details
  deliverables: [{
    type: {
      type: String,
      enum: ['post', 'reel', 'story', 'video', 'blog', 'tweet', 'other'],
      required: true
    },
    count: {
      type: Number,
      required: true,
      min: 1
    },
    description: {
      type: String,
      maxlength: 500
    }
  }],
  
  // Campaign Value (in INR)
  campaignValue: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR']
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid'],
      default: 'pending'
    }
  },
  
  // Extracted Metrics (from screenshots + manual input)
  performanceMetrics: {
    // Reach & Impressions
    impressions: {
      type: Number,
      default: 0,
      min: 0
    },
    reach: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Engagement
    likes: {
      type: Number,
      default: 0,
      min: 0
    },
    comments: {
      type: Number,
      default: 0,
      min: 0
    },
    shares: {
      type: Number,
      default: 0,
      min: 0
    },
    saves: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Actions
    clicks: {
      type: Number,
      default: 0,
      min: 0
    },
    websiteClicks: {
      type: Number,
      default: 0,
      min: 0
    },
    profileVisits: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Video Specific (YouTube, Instagram Reels)
    views: {
      type: Number,
      default: 0,
      min: 0
    },
    watchTime: {
      type: Number,
      default: 0,
      min: 0 // In minutes
    },
    avgViewDuration: {
      type: Number,
      default: 0,
      min: 0 // In seconds
    },
    
    // Platform Specific
    platformSpecific: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  
  // AI Analysis Results
  aiAnalysis: {
    isAnalyzed: {
      type: Boolean,
      default: false
    },
    analyzedAt: {
      type: Date
    },
    
    // Performance Summary (AI Generated)
    performanceSummary: {
      type: String,
      maxlength: 1000
    },
    
    // Key Insights (AI Generated)
    insights: [{
      type: String,
      maxlength: 300
    }],
    
    // Recommendations (AI Generated)
    recommendations: [{
      type: String,
      maxlength: 300
    }],
    
    // Performance Score (AI Calculated)
    performanceScore: {
      type: Number,
      min: 0,
      max: 100
    },
    
    // Comparison with benchmarks
    benchmarkComparison: {
      industryAvgEngagement: Number,
      performanceVsAverage: Number, // Multiplier (1.5x, 2x etc)
      ranking: String // 'excellent', 'good', 'average', 'below_average'
    },
    
    // AI Processing Details
    aiVersion: {
      type: String,
      default: '1.0'
    },
    processingTime: {
      type: Number // Milliseconds
    }
  },
  
  // Campaign Status & Workflow
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'archived'],
    default: 'draft'
  },
  
  // Tags for categorization
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  // Notes and additional information
  notes: {
    type: String,
    maxlength: 2000
  },
  
  // Tracking
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastAnalyzedAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'campaigns'
});

// ============================================
// SCREENSHOT STORAGE SCHEMA
// ============================================

/**
 * Schema for storing uploaded analytics screenshots
 */
const screenshotSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // File Information
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true,
    max: 10485760 // 10MB limit
  },
  mimeType: {
    type: String,
    required: true,
    enum: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
  },
  
  // Storage Information
  s3Key: {
    type: String,
    required: true
  },
  s3Url: {
    type: String,
    required: true
  },
  
  // Platform & Type
  platform: {
    type: String,
    required: true,
    enum: ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'other']
  },
  screenshotType: {
    type: String,
    enum: ['insights', 'analytics', 'performance', 'engagement', 'reach', 'other'],
    default: 'insights'
  },
  
  // AI Extraction Status
  aiExtraction: {
    isProcessed: {
      type: Boolean,
      default: false
    },
    processedAt: {
      type: Date
    },
    extractedData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    error: {
      type: String
    }
  },
  
  // Upload tracking
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'screenshots'
});

// ============================================
// REPORT GENERATION SCHEMA
// ============================================

/**
 * Schema for tracking generated reports
 */
const reportSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Report Information
  reportName: {
    type: String,
    required: true,
    trim: true
  },
  reportType: {
    type: String,
    enum: ['campaign_summary', 'performance_analysis', 'client_report', 'comparison_report'],
    default: 'campaign_summary'
  },
  
  // File Information
  fileName: {
    type: String,
    required: true
  },
  s3Key: {
    type: String,
    required: true
  },
  s3Url: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  
  // Report Configuration
  template: {
    type: String,
    enum: ['minimal', 'professional', 'detailed', 'branded', 'white_label'],
    default: 'professional'
  },
  branding: {
    logoUrl: String,
    primaryColor: String,
    secondaryColor: String,
    fontFamily: String,
    brandName: String
  },
  
  // Report Metrics (for quick access)
  reportData: {
    totalImpressions: Number,
    totalReach: Number,
    engagementRate: Number,
    performanceScore: Number,
    campaignValue: Number
  },
  
  // Generation Details
  generatedAt: {
    type: Date,
    default: Date.now
  },
  generationTime: {
    type: Number // Milliseconds
  },
  
  // Access & Sharing
  isShared: {
    type: Boolean,
    default: false
  },
  shareToken: {
    type: String,
    unique: true,
    sparse: true
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloadedAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'reports'
});

// ============================================
// PERFORMANCE SETTINGS SCHEMA
// ============================================

/**
 * Schema for user performance settings and preferences
 */
const performanceSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Branding Settings
  branding: {
    logoUrl: {
      type: String
    },
    primaryColor: {
      type: String,
      default: '#8B5CF6' // CreatorsMantra purple
    },
    secondaryColor: {
      type: String,
      default: '#EC4899' // CreatorsMantra pink
    },
    accentColor: {
      type: String,
      default: '#3B82F6' // CreatorsMantra blue
    },
    fontFamily: {
      type: String,
      enum: ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'],
      default: 'Inter'
    },
    brandName: {
      type: String,
      trim: true,
      maxlength: 100
    }
  },
  
  // Report Preferences
  reportSettings: {
    defaultTemplate: {
      type: String,
      enum: ['minimal', 'professional', 'detailed', 'branded', 'white_label'],
      default: 'professional'
    },
    includeComparison: {
      type: Boolean,
      default: true
    },
    includeBenchmarks: {
      type: Boolean,
      default: true
    },
    includeRecommendations: {
      type: Boolean,
      default: true
    },
    watermark: {
      type: Boolean,
      default: true
    }
  },
  
  // AI Preferences
  aiSettings: {
    summaryTone: {
      type: String,
      enum: ['professional', 'casual', 'detailed', 'concise'],
      default: 'professional'
    },
    includeInsights: {
      type: Boolean,
      default: true
    },
    includeRecommendations: {
      type: Boolean,
      default: true
    },
    benchmarkComparison: {
      type: Boolean,
      default: true
    }
  },
  
  // Notification Settings
  notifications: {
    campaignAnalysisComplete: {
      type: Boolean,
      default: true
    },
    reportGenerated: {
      type: Boolean,
      default: true
    },
    weeklyInsights: {
      type: Boolean,
      default: false
    },
    monthlyReport: {
      type: Boolean,
      default: false
    }
  },
  
  // Platform Integrations
  integrations: {
    instagram: {
      enabled: Boolean,
      accessToken: String,
      lastSync: Date
    },
    youtube: {
      enabled: Boolean,
      accessToken: String,
      lastSync: Date
    }
  },
  
  // Usage Analytics
  usage: {
    totalCampaigns: {
      type: Number,
      default: 0
    },
    totalReports: {
      type: Number,
      default: 0
    },
    totalScreenshots: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  collection: 'performance_settings'
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

// Campaign indexes
campaignSchema.index({ userId: 1, createdAt: -1 });
campaignSchema.index({ userId: 1, status: 1 });
campaignSchema.index({ userId: 1, platform: 1 });
campaignSchema.index({ dealId: 1 });
campaignSchema.index({ brandName: 1, userId: 1 });
campaignSchema.index({ 'campaignPeriod.startDate': 1, 'campaignPeriod.endDate': 1 });

// Screenshot indexes
screenshotSchema.index({ campaignId: 1, uploadedAt: -1 });
screenshotSchema.index({ userId: 1, platform: 1 });
screenshotSchema.index({ 'aiExtraction.isProcessed': 1 });

// Report indexes
reportSchema.index({ campaignId: 1, generatedAt: -1 });
reportSchema.index({ userId: 1, reportType: 1 });
reportSchema.index({ shareToken: 1 });

// ============================================
// VIRTUAL FIELDS
// ============================================

// Campaign virtuals
campaignSchema.virtual('engagementRate').get(function() {
  const { likes, comments, shares, saves, impressions } = this.performanceMetrics;
  const totalEngagements = likes + comments + shares + saves;
  return impressions > 0 ? ((totalEngagements / impressions) * 100).toFixed(2) : 0;
});

campaignSchema.virtual('reachRate').get(function() {
  const { reach, impressions } = this.performanceMetrics;
  return impressions > 0 ? ((reach / impressions) * 100).toFixed(2) : 0;
});

campaignSchema.virtual('cpm').get(function() {
  const { impressions } = this.performanceMetrics;
  const { amount } = this.campaignValue;
  return impressions > 0 ? ((amount / impressions) * 1000).toFixed(2) : 0;
});

campaignSchema.virtual('totalScreenshots', {
  ref: 'Screenshot',
  localField: '_id',
  foreignField: 'campaignId',
  count: true
});

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get campaign analytics for a user
 */
campaignSchema.statics.getCampaignAnalytics = function(userId, filters = {}) {
  const matchStage = { userId: mongoose.Types.ObjectId(userId) };
  
  // Apply filters
  if (filters.platform) matchStage.platform = filters.platform;
  if (filters.status) matchStage.status = filters.status;
  if (filters.dateFrom) {
    matchStage['campaignPeriod.startDate'] = { $gte: new Date(filters.dateFrom) };
  }
  if (filters.dateTo) {
    matchStage['campaignPeriod.endDate'] = { $lte: new Date(filters.dateTo) };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalCampaigns: { $sum: 1 },
        totalValue: { $sum: '$campaignValue.amount' },
        avgImpressions: { $avg: '$performanceMetrics.impressions' },
        avgEngagement: { $avg: { 
          $divide: [
            { $add: ['$performanceMetrics.likes', '$performanceMetrics.comments', '$performanceMetrics.shares'] },
            '$performanceMetrics.impressions'
          ]
        }},
        totalImpressions: { $sum: '$performanceMetrics.impressions' },
        totalReach: { $sum: '$performanceMetrics.reach' },
        completedCampaigns: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        }
      }
    }
  ]);
};

/**
 * Get top performing campaigns
 */
campaignSchema.statics.getTopPerformingCampaigns = function(userId, limit = 5) {
  return this.find({ userId })
    .sort({ 'aiAnalysis.performanceScore': -1, 'performanceMetrics.impressions': -1 })
    .limit(limit)
    .populate('dealId', 'brandName stage')
    .select('campaignName brandName performanceMetrics aiAnalysis platform campaignValue');
};

// ============================================
// MIDDLEWARE
// ============================================

// Pre-save middleware to update metrics
campaignSchema.pre('save', function(next) {
  if (this.isModified('performanceMetrics')) {
    this.updatedAt = new Date();
  }
  next();
});

// Post-save middleware for analytics
campaignSchema.post('save', async function(doc) {
  try {
    // Update user's performance settings usage
    await PerformanceSettings.findOneAndUpdate(
      { userId: doc.userId },
      { 
        $inc: { 'usage.totalCampaigns': 1 },
        $set: { 'usage.lastActivity': new Date() }
      },
      { upsert: true }
    );
    
    logInfo('Campaign analytics updated', { campaignId: doc._id, userId: doc.userId });
  } catch (error) {
    logError('Failed to update campaign analytics', { error: error.message });
  }
});

// ============================================
// EXPORT MODELS
// ============================================

const Campaign = mongoose.model('Campaign', campaignSchema);
const Screenshot = mongoose.model('Screenshot', screenshotSchema);
const Report = mongoose.model('Report', reportSchema);
const PerformanceSettings = mongoose.model('PerformanceSettings', performanceSettingsSchema);

module.exports = {
  Campaign,
  Screenshot,
  Report,
  PerformanceSettings
};