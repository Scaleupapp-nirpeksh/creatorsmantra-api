/**
 * CreatorsMantra Backend - Performance Module Models (Complete)
 * Full implementation with proper relationships to existing models
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Performance case management, evidence storage, AI analysis, and client reporting
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// ============================================
// PERFORMANCE CASE MODEL
// ============================================

const performanceCaseSchema = new mongoose.Schema({
  // Unique identifier
  caseId: {
    type: String,
    unique: true,
    default: () => `PC${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
  },

  // Relationships
  dealId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal',
    required: true,
    unique: true,
    index: true
  },

  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },

  // Deal Information (Cached from Deal for performance)
  dealInfo: {
    dealId: String,
    title: { type: String, required: true },
    brandName: { type: String, required: true },
    brandEmail: String,
    brandContactPerson: String,
    
    primaryPlatform: { 
      type: String, 
      required: true,
      enum: ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'snapchat', 'multiple']
    },
    
    deliverables: [{
      deliverableId: String,
      type: { 
        type: String, 
        required: true,
        enum: [
          'instagram_post', 'instagram_reel', 'instagram_story', 'instagram_igtv',
          'youtube_video', 'youtube_short', 'youtube_community_post',
          'linkedin_post', 'linkedin_article', 'linkedin_video',
          'twitter_post', 'twitter_thread', 'twitter_space',
          'facebook_post', 'facebook_reel', 'facebook_story',
          'blog_post', 'podcast_mention', 'newsletter_mention',
          'website_review', 'app_review', 'product_unboxing',
          'brand_collaboration', 'event_coverage', 'other'
        ]
      },
      quantity: { type: Number, default: 1 },
      description: String,
      deadline: Date,
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'submitted', 'approved', 'revision_required', 'completed'],
        default: 'pending'
      },
      submissionUrl: String,
      specifications: {
        duration: Number,
        dimensions: String,
        hashtags: [String],
        mentions: [String],
        locationTagRequired: Boolean
      },
      expectedMetrics: {
        views: Number,
        likes: Number,
        comments: Number,
        shares: Number,
        saves: Number,
        reach: Number,
        impressions: Number,
        engagementRate: Number,
        clickThroughRate: Number,
        customMetrics: [{
          name: String,
          expectedValue: mongoose.Schema.Types.Mixed,
          unit: String
        }]
      }
    }],
    
    dealValue: {
      amount: { type: Number, required: true },
      finalAmount: Number,
      currency: { type: String, default: 'INR' },
      gstAmount: Number,
      tdsAmount: Number,
      paymentTerms: String
    },
    
    timeline: {
      dealCreatedDate: { type: Date, required: true },
      contractSignedDate: Date,
      contentCreationStart: Date,
      contentDeadline: Date,
      goLiveDate: Date,
      campaignEndDate: Date,
      dealCompletedDate: Date,
      paymentDueDate: Date
    },
    
    dealStage: {
      type: String,
      enum: ['pitched', 'in_talks', 'negotiating', 'live', 'completed', 'paid', 'cancelled', 'rejected'],
      required: true
    },
    
    dealStatus: {
      type: String,
      enum: ['active', 'paused', 'completed', 'cancelled'],
      required: true
    },
    
    invoiceIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    }],
    
    performanceTargets: {
      minViews: Number,
      minLikes: Number,
      minComments: Number,
      minShares: Number,
      minSaves: Number,
      ctr: Number,
      engagementRate: Number
    }
  },

  // Performance Case Status
  status: {
    type: String,
    enum: ['initiated', 'evidence_collection', 'ai_processing', 'analysis_ready', 'report_generated', 'delivered_to_client', 'completed', 'archived'],
    default: 'initiated',
    index: true
  },

  creationTrigger: {
    type: String,
    enum: ['deal_completed', 'manual_creation', 'scheduled_creation'],
    default: 'manual_creation'
  },

  // Evidence Collection Status
  evidenceCollection: {
    checklist: {
      contentScreenshots: { 
        collected: { type: Boolean, default: false }, 
        required: { type: Boolean, default: true },
        fileCount: { type: Number, default: 0 }
      },
      analyticsScreenshots: { 
        collected: { type: Boolean, default: false }, 
        required: { type: Boolean, default: true },
        fileCount: { type: Number, default: 0 }
      },
      brandFeedback: { 
        collected: { type: Boolean, default: false }, 
        required: { type: Boolean, default: false },
        fileCount: { type: Number, default: 0 }
      },
      additionalDeliverables: { 
        collected: { type: Boolean, default: false }, 
        required: { type: Boolean, default: false },
        fileCount: { type: Number, default: 0 }
      },
      customEvidence: [{
        name: String,
        collected: { type: Boolean, default: false },
        required: { type: Boolean, default: false },
        fileCount: { type: Number, default: 0 }
      }]
    },
    totalFilesUploaded: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },

  // AI Analysis Results Summary
  aiAnalysisSummary: {
    overallPerformance: {
      type: String,
      enum: ['excellent', 'above_expectations', 'met_expectations', 'below_expectations', 'poor'],
      default: null
    },
    keyAchievements: [String],
    improvementAreas: [String],
    confidenceScore: {
      type: Number,
      min: 0,
      max: 1
    },
    lastAnalyzedAt: Date
  },

  // Client Communication
  clientCommunication: {
    reportGenerated: { type: Boolean, default: false },
    reportGeneratedAt: Date,
    reportSent: { type: Boolean, default: false },
    reportSentAt: Date,
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentTo: String,
    
    clientFeedback: {
      received: { type: Boolean, default: false },
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comments: String,
      receivedAt: Date,
      satisfactionLevel: {
        type: String,
        enum: ['very_satisfied', 'satisfied', 'neutral', 'dissatisfied', 'very_dissatisfied']
      }
    },
    
    followUp: {
      required: { type: Boolean, default: false },
      scheduledDate: Date,
      completedAt: Date,
      notes: String,
      outcome: {
        type: String,
        enum: ['repeat_collaboration', 'referral_received', 'rate_increase', 'no_response', 'relationship_ended']
      }
    }
  },

  // Business Intelligence
  businessIntelligence: {
    profitability: {
      timeInvested: Number,
      hourlyRate: Number,
      costPerDeliverable: Number,
      profitMargin: Number,
      roiPercentage: Number,
      efficiency: {
        type: String,
        enum: ['very_high', 'high', 'average', 'low', 'very_low']
      }
    },
    
    processEfficiency: {
      daysToComplete: Number,
      revisionRounds: { type: Number, default: 0 },
      communicationCount: { type: Number, default: 0 },
      onTimeDelivery: { type: Boolean, default: true },
      clientResponseTime: Number
    },
    
    relationshipHealth: {
      creatorSatisfaction: {
        type: Number,
        min: 1,
        max: 10
      },
      brandSatisfaction: {
        type: Number,
        min: 1,
        max: 10
      },
      collaborationRating: {
        type: String,
        enum: ['excellent', 'good', 'average', 'challenging', 'difficult']
      },
      repeatProbability: {
        type: String,
        enum: ['very_likely', 'likely', 'maybe', 'unlikely', 'never']
      }
    },
    
    performanceInsights: {
      bestPerformingContent: String,
      optimalPostingTime: String,
      audienceEngagement: String,
      contentOptimizations: [String]
    }
  },

  // Rate card optimization data
  rateCardFeedback: {
    suggestedRateAdjustment: {
      deliverableType: String,
      currentRate: Number,
      suggestedRate: Number,
      adjustmentReason: String,
      confidence: Number
    },
    marketComparison: {
      aboveMarket: Boolean,
      marketAverage: Number,
      percentageDifference: Number
    }
  },

  // Manager access tracking
  managerAccess: {
    canView: { type: Boolean, default: true },
    canEdit: { type: Boolean, default: false },
    canGenerateReports: { type: Boolean, default: true },
    canSendToClients: { type: Boolean, default: false },
    lastAccessedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      accessedAt: Date,
      action: String
    }
  },

  // Metadata
  notes: {
    creatorNotes: String,
    managerNotes: String,
    internalNotes: String
  },
  
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  isArchived: { type: Boolean, default: false },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: Date,
  archivedAt: Date,
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// ============================================
// PERFORMANCE EVIDENCE MODEL
// ============================================

const performanceEvidenceSchema = new mongoose.Schema({
  performanceCaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PerformanceCase',
    required: true,
    index: true
  },

  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  evidenceType: {
    type: String,
    enum: ['content_screenshot', 'analytics_screenshot', 'brand_feedback', 'testimonial', 'additional_deliverable', 'custom'],
    required: true,
    index: true
  },

  relatedDeliverableId: String,
  
  platform: {
    type: String,
    enum: ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'snapchat', 'other']
  },

  fileInfo: {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    fileExtension: String,
    uploadedAt: { type: Date, default: Date.now }
  },

  description: String,
  contentUrl: String,
  
  extractedMetrics: {
    views: Number,
    likes: Number,
    comments: Number,
    shares: Number,
    saves: Number,
    reach: Number,
    impressions: Number,
    engagementRate: Number,
    clickThroughRate: Number,
    customMetrics: [{
      name: String,
      value: mongoose.Schema.Types.Mixed,
      unit: String
    }],
    extractionStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    extractionDate: Date,
    extractionMethod: {
      type: String,
      enum: ['ai_analysis', 'manual_entry'],
      default: 'ai_analysis'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1
    }
  },

  aiAnalysis: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    analysisDate: Date,
    insights: [String],
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    error: String
  },

  isValidated: { type: Boolean, default: false },
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  validatedAt: Date,
  validationNotes: String,

  tags: [String],
  isArchived: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ============================================
// PERFORMANCE ANALYSIS MODEL
// ============================================

const performanceAnalysisSchema = new mongoose.Schema({
  performanceCaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PerformanceCase',
    required: true,
    unique: true,
    index: true
  },

  // AI Analysis Results
  aiAnalysis: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    processedAt: Date,
    processingTime: Number,
    model: { type: String, default: 'gpt-4' },
    prompt: String,
    rawResponse: String,
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    error: String
  },

  // Performance vs Expectations Analysis
  performanceComparison: {
    overallScore: {
      type: Number,
      min: 0,
      max: 100
    },
    metricsComparison: [{
      metric: String,
      expected: Number,
      actual: Number,
      performance: {
        type: String,
        enum: ['exceeded', 'met', 'below', 'significantly_below']
      },
      percentageDifference: Number
    }],
    topPerformers: [String],
    underPerformers: [String]
  },

  // Insights & Recommendations
  insights: {
    keySuccessFactors: [String],
    improvementAreas: [String],
    contentOptimizations: [String],
    timingRecommendations: [String],
    audienceInsights: [String],
    platformSpecificTips: [{
      platform: String,
      recommendations: [String]
    }]
  },

  // Business Intelligence
  businessMetrics: {
    costPerEngagement: Number,
    costPerView: Number,
    engagementValue: Number,
    brandAwarenessScore: Number,
    conversionProbability: Number,
    repeatCollaborationScore: Number
  },

  // Future Predictions
  predictions: {
    nextDealValue: {
      estimated: Number,
      confidence: Number,
      reasoning: String
    },
    optimalPricing: [{
      deliverable: String,
      suggestedPrice: Number,
      reasoning: String
    }],
    riskFactors: [String],
    opportunities: [String]
  },

  // Metadata
  analysisVersion: { type: String, default: '1.0.0' },
  regenerationCount: { type: Number, default: 0 },
  lastRegeneratedAt: Date,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ============================================
// PERFORMANCE REPORT MODEL
// ============================================

const performanceReportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    unique: true,
    default: () => `PR${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
  },

  performanceCaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PerformanceCase',
    required: true,
    index: true
  },

  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  template: {
    type: String,
    enum: ['basic', 'professional', 'detailed', 'branded', 'white_label'],
    required: true
  },

  branding: {
    includeCreatorLogo: { type: Boolean, default: true },
    logoUrl: String,
    primaryColor: { type: String, default: '#667eea' },
    secondaryColor: { type: String, default: '#764ba2' },
    fontFamily: { type: String, default: 'Inter' },
    customFooter: String,
    watermark: String
  },

  content: {
    executiveSummary: String,
    campaignOverview: String,
    deliverablesSummary: String,
    performanceHighlights: [String],
    detailedMetrics: [{
      section: String,
      title: String,
      content: String,
      charts: [{
        type: String,
        data: mongoose.Schema.Types.Mixed,
        config: mongoose.Schema.Types.Mixed
      }]
    }],
    keyInsights: [String],
    recommendations: [String],
    nextSteps: [String],
    testimonials: [String]
  },

  fileInfo: {
    fileName: String,
    filePath: String,
    fileSize: Number,
    fileUrl: String,
    mimeType: { type: String, default: 'application/pdf' }
  },

  generationStatus: {
    status: {
      type: String,
      enum: ['pending', 'generating', 'completed', 'failed'],
      default: 'pending'
    },
    startedAt: Date,
    completedAt: Date,
    processingTime: Number,
    error: String
  },

  sharing: {
    isPublic: { type: Boolean, default: false },
    publicUrl: String,
    password: String,
    expiresAt: Date,
    downloadCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    lastAccessedAt: Date
  },

  clientInteraction: {
    sentToClient: { type: Boolean, default: false },
    sentAt: Date,
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    clientEmail: String,
    emailSubject: String,
    emailBody: String,
    deliveryStatus: {
      type: String,
      enum: ['sent', 'delivered', 'opened', 'downloaded', 'failed'],
      default: 'sent'
    }
  },

  version: { type: Number, default: 1 },
  isArchived: { type: Boolean, default: false },
  notes: String,
  tags: [String],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ============================================
// PERFORMANCE SETTINGS MODEL
// ============================================

const performanceSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  defaultReportSettings: {
    template: {
      type: String,
      enum: ['basic', 'professional', 'detailed', 'branded', 'white_label'],
      default: 'professional'
    },
    includeMetrics: {
      views: { type: Boolean, default: true },
      likes: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      shares: { type: Boolean, default: true },
      saves: { type: Boolean, default: true },
      reach: { type: Boolean, default: true },
      impressions: { type: Boolean, default: true },
      engagementRate: { type: Boolean, default: true },
      clickThroughRate: { type: Boolean, default: false }
    },
    autoGenerateReports: { type: Boolean, default: false },
    autoSendToClients: { type: Boolean, default: false }
  },

  brandingSettings: {
    logo: {
      url: String,
      fileName: String,
      uploadedAt: Date
    },
    colors: {
      primary: { type: String, default: '#667eea' },
      secondary: { type: String, default: '#764ba2' },
      accent: { type: String, default: '#f093fb' }
    },
    fonts: {
      heading: { type: String, default: 'Inter' },
      body: { type: String, default: 'Inter' }
    },
    contactInfo: {
      website: String,
      email: String,
      phone: String,
      address: String
    },
    footerText: String,
    socialMedia: [{
      platform: String,
      handle: String,
      url: String
    }]
  },

  notifications: {
    emailNotifications: { type: Boolean, default: true },
    analysisCompleted: { type: Boolean, default: true },
    reportGenerated: { type: Boolean, default: true },
    clientInteraction: { type: Boolean, default: true },
    performanceInsights: { type: Boolean, default: true }
  },

  privacy: {
    shareDataForInsights: { type: Boolean, default: true },
    allowBenchmarking: { type: Boolean, default: false },
    publicPortfolio: { type: Boolean, default: false }
  },

  integrations: {
    rateCardOptimization: { type: Boolean, default: true },
    dealSuggestions: { type: Boolean, default: true },
    portfolioUpdates: { type: Boolean, default: true }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// ============================================
// PERFORMANCE PORTFOLIO MODEL
// ============================================

const performancePortfolioSchema = new mongoose.Schema({
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  isPublic: { type: Boolean, default: false },
  publicUrl: {
    type: String,
    unique: true,
    sparse: true
  },

  featuredCases: [{
    performanceCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PerformanceCase'
    },
    displayOrder: { type: Number, default: 0 },
    customTitle: String,
    customDescription: String,
    showMetrics: { type: Boolean, default: true },
    showBrandName: { type: Boolean, default: true }
  }],

  statistics: {
    totalCases: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    totalEngagements: { type: Number, default: 0 },
    averagePerformance: { type: Number, default: 0 },
    topPlatforms: [String],
    successRate: { type: Number, default: 0 }
  },

  seo: {
    title: String,
    description: String,
    keywords: [String],
    ogImage: String
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastViewedAt: Date
});

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

performanceCaseSchema.pre('save', async function(next) {
  this.updatedAt = new Date();
  
  if (this.isNew && this.dealId) {
    try {
      const Deal = mongoose.model('Deal');
      const deal = await Deal.findById(this.dealId);
      
      if (deal) {
        this.dealInfo = {
          dealId: deal.dealId,
          title: deal.title,
          brandName: deal.brand.name,
          brandEmail: deal.brand.contactPerson?.email,
          brandContactPerson: deal.brand.contactPerson?.name,
          primaryPlatform: deal.platform,
          deliverables: deal.deliverables.map((d, index) => ({
            deliverableId: `${deal.dealId}-D${index + 1}`,
            type: d.type,
            quantity: d.quantity,
            description: d.description,
            deadline: d.deadline,
            status: d.status,
            submissionUrl: d.submissionUrl,
            specifications: d.specifications,
            expectedMetrics: {}
          })),
          dealValue: {
            amount: deal.dealValue.amount,
            finalAmount: deal.dealValue.finalAmount,
            currency: deal.dealValue.currency,
            gstAmount: deal.dealValue.gstAmount,
            tdsAmount: deal.dealValue.tdsAmount,
            paymentTerms: deal.dealValue.paymentTerms
          },
          timeline: {
            dealCreatedDate: deal.createdAt,
            contractSignedDate: deal.timeline.contractSignedDate,
            contentCreationStart: deal.timeline.contentCreationStart,
            contentDeadline: deal.timeline.contentDeadline,
            goLiveDate: deal.timeline.goLiveDate,
            campaignEndDate: deal.timeline.campaignEndDate,
            dealCompletedDate: deal.timeline.completedDate,
            paymentDueDate: deal.timeline.paymentDueDate
          },
          dealStage: deal.stage,
          dealStatus: deal.status,
          invoiceIds: deal.invoices || [],
          performanceTargets: deal.campaignRequirements?.performanceTargets || {}
        };
      }
    } catch (error) {
      console.error('Error populating deal info:', error);
    }
  }
  
  const checklist = this.evidenceCollection.checklist;
  const requiredItems = Object.keys(checklist).filter(key => 
    key !== 'customEvidence' && checklist[key].required
  ).length + (checklist.customEvidence?.filter(item => item.required).length || 0);
  
  const completedItems = Object.keys(checklist).filter(key => 
    key !== 'customEvidence' && checklist[key].required && checklist[key].collected
  ).length + (checklist.customEvidence?.filter(item => item.required && item.collected).length || 0);
  
  this.evidenceCollection.completionPercentage = requiredItems > 0 ? Math.round((completedItems / requiredItems) * 100) : 0;
  
  if (this.evidenceCollection.completionPercentage === 100 && this.status === 'evidence_collection') {
    this.status = 'ai_processing';
  }
  
  next();
});

performanceEvidenceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

performanceCaseSchema.methods.hasUserAccess = async function(userId, action = 'view') {
  if (this.creatorId.toString() === userId.toString()) {
    return true;
  }
  
  if (this.managerId && this.managerId.toString() === userId.toString()) {
    const CreatorProfile = mongoose.model('CreatorProfile');
    const creatorProfile = await CreatorProfile.findOne({ userId: this.creatorId });
    
    if (creatorProfile) {
      const manager = creatorProfile.managers.find(m => 
        m.managerId && m.managerId.toString() === userId.toString() && m.status === 'active'
      );
      
      if (manager) {
        switch (action) {
          case 'view':
            return true;
          case 'edit':
            return manager.permissions.deals?.editDeals || false;
          case 'generate_report':
            return manager.permissions.communication?.brandCommunication || false;
          case 'send_to_client':
            return manager.permissions.communication?.brandCommunication || false;
          default:
            return false;
        }
      }
    }
  }
  
  return false;
};

// ============================================
// STATIC METHODS
// ============================================

performanceCaseSchema.statics.createFromDeal = async function(dealId) {
  const Deal = mongoose.model('Deal');
  const deal = await Deal.findById(dealId);
  
  if (!deal || !['completed', 'paid'].includes(deal.stage)) {
    throw new Error('Deal must be completed or paid to create performance case');
  }
  
  const existingCase = await this.findOne({ dealId });
  if (existingCase) {
    throw new Error('Performance case already exists for this deal');
  }
  
  const CreatorProfile = mongoose.model('CreatorProfile');
  const creatorProfile = await CreatorProfile.findOne({ userId: deal.userId });
  const activeManager = creatorProfile?.managers.find(m => m.status === 'active');
  
  const performanceCase = new this({
    dealId,
    creatorId: deal.userId,
    managerId: activeManager?.managerId || null,
    creationTrigger: 'deal_completed',
    status: 'evidence_collection'
  });
  
  return performanceCase.save();
};

// ============================================
// INDEXES
// ============================================

performanceCaseSchema.index({ dealId: 1 }, { unique: true });
performanceCaseSchema.index({ creatorId: 1, status: 1 });
performanceCaseSchema.index({ managerId: 1 });
performanceCaseSchema.index({ createdAt: -1 });
performanceCaseSchema.index({ 'dealInfo.brandName': 1 });
performanceCaseSchema.index({ 'dealInfo.dealStage': 1 });
performanceCaseSchema.index({ isArchived: 1 });

performanceEvidenceSchema.index({ performanceCaseId: 1, evidenceType: 1 });
performanceEvidenceSchema.index({ uploadedBy: 1, createdAt: -1 });
performanceEvidenceSchema.index({ relatedDeliverableId: 1 });

performanceAnalysisSchema.index({ performanceCaseId: 1 });
performanceAnalysisSchema.index({ 'aiAnalysis.status': 1 });

performanceReportSchema.index({ performanceCaseId: 1, version: -1 });
performanceReportSchema.index({ generatedBy: 1, createdAt: -1 });
performanceReportSchema.index({ 'sharing.publicUrl': 1 });

performanceSettingsSchema.index({ userId: 1 });

performancePortfolioSchema.index({ creatorId: 1 });
performancePortfolioSchema.index({ publicUrl: 1 });

// ============================================
// EXPORT MODELS
// ============================================

const PerformanceCase = mongoose.model('PerformanceCase', performanceCaseSchema);
const PerformanceEvidence = mongoose.model('PerformanceEvidence', performanceEvidenceSchema);
const PerformanceAnalysis = mongoose.model('PerformanceAnalysis', performanceAnalysisSchema);
const PerformanceReport = mongoose.model('PerformanceReport', performanceReportSchema);
const PerformanceSettings = mongoose.model('PerformanceSettings', performanceSettingsSchema);
const PerformancePortfolio = mongoose.model('PerformancePortfolio', performancePortfolioSchema);

module.exports = {
  PerformanceCase,
  PerformanceEvidence,
  PerformanceAnalysis,
  PerformanceReport,
  PerformanceSettings,
  PerformancePortfolio
};