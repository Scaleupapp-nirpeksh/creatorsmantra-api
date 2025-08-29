//src/modules/briefs/model.js
/**
 * CreatorsMantra Backend - Brief Analyzer Model
 * MongoDB schema for brand brief storage and AI analysis results
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * @description Brief schema with AI extraction, file upload, and deal conversion
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ============================================
// BRIEF SCHEMA
// ============================================

const briefSchema = new Schema({
  // ========== OWNERSHIP & IDENTIFICATION ==========
  briefId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  creatorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // ========== INPUT SOURCE ==========
  inputType: {
    type: String,
    enum: ['text_paste', 'file_upload'],
    required: true,
    index: true
  },
  
  // Original brief content
  originalContent: {
    rawText: {
      type: String,
      maxlength: 50000 // 50KB max text
    },
    
    // File upload details (if applicable)
    uploadedFile: {
      filename: { type: String },
      originalName: { type: String },
      fileSize: { type: Number },
      mimeType: { type: String },
      uploadPath: { type: String },
      uploadedAt: { type: Date }
    }
  },
  
  // ========== AI EXTRACTION RESULTS ==========
  aiExtraction: {
    // Processing status
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true
    },
    
    // Extracted brand information
    brandInfo: {
      name: { type: String, maxlength: 100 },
      contactPerson: { type: String, maxlength: 100 },
      email: { type: String },
      phone: { type: String },
      company: { type: String, maxlength: 100 }
    },
    
    // Campaign/Project details
    campaignInfo: {
      name: { type: String, maxlength: 200 },
      type: { type: String }, // Product launch, brand awareness, etc.
      description: { type: String, maxlength: 1000 }
    },
    
    // Extracted deliverables
    deliverables: [{
      type: {
        type: String,
        enum: [
          'instagram_post',
          'instagram_reel', 
          'instagram_story',
          'youtube_video',
          'youtube_shorts',
          'linkedin_post',
          'twitter_post',
          'blog_post',
          'other'
        ]
      },
      quantity: { type: Number, min: 1, default: 1 },
      description: { type: String, maxlength: 500 },
      duration: { type: String }, // For video content
      requirements: [{ type: String, maxlength: 200 }],
      platform: { type: String },
      estimatedValue: { type: Number, min: 0 } // AI estimated value
    }],
    
    // Timeline information
    timeline: {
      briefDate: { type: Date },
      contentDeadline: { type: Date },
      postingStartDate: { type: Date },
      postingEndDate: { type: Date },
      campaignDuration: { type: String },
      isUrgent: { type: Boolean, default: false }
    },
    
    // Budget information
    budget: {
      mentioned: { type: Boolean, default: false },
      amount: { type: Number, min: 0 },
      currency: { type: String, default: 'INR' },
      isRange: { type: Boolean, default: false },
      minAmount: { type: Number, min: 0 },
      maxAmount: { type: Number, min: 0 },
      paymentTerms: { type: String },
      advancePercentage: { type: Number, min: 0, max: 100 }
    },
    
    // Brand guidelines
    brandGuidelines: {
      hashtags: [{ type: String, maxlength: 50 }],
      mentions: [{ type: String, maxlength: 50 }],
      brandColors: [{ type: String }],
      brandTone: { type: String },
      keyMessages: [{ type: String, maxlength: 200 }],
      restrictions: [{ type: String, maxlength: 200 }],
      styling: { type: String, maxlength: 500 }
    },
    
    // Usage rights and legal
    usageRights: {
      duration: { type: String },
      scope: [{ type: String }], // organic, paid, cross-platform
      territory: { type: String },
      isPerpetual: { type: Boolean, default: false },
      exclusivity: {
        required: { type: Boolean, default: false },
        duration: { type: String },
        scope: { type: String }
      }
    },
    
    // Content requirements
    contentRequirements: {
      revisionRounds: { type: Number, min: 0 },
      approvalProcess: { type: String },
      contentFormat: [{ type: String }],
      qualityGuidelines: [{ type: String }],
      technicalSpecs: {
        resolution: { type: String },
        aspectRatio: { type: String },
        fileFormat: [{ type: String }]
      }
    },
    
    // Missing information flagged by AI
    missingInfo: [{
      category: {
        type: String,
        enum: [
          'budget',
          'timeline', 
          'usage_rights',
          'exclusivity',
          'payment_terms',
          'content_specs',
          'brand_guidelines',
          'contact_info',
          'deliverables',
          'approval_process'
        ]
      },
      description: { type: String, maxlength: 200 },
      importance: {
        type: String,
        enum: ['critical', 'important', 'nice_to_have'],
        default: 'important'
      }
    }],
    
    // Risk assessment
    riskAssessment: {
      overallRisk: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low'
      },
      riskFactors: [{
        type: { type: String },
        description: { type: String },
        severity: {
          type: String,
          enum: ['low', 'medium', 'high']
        }
      }]
    },
    
    // AI processing metadata
    processingMetadata: {
      modelUsed: { type: String, default: 'gpt-3.5-turbo' },
      tokensUsed: { type: Number },
      processingTime: { type: Number }, // in milliseconds
      confidenceScore: { type: Number, min: 0, max: 100 },
      extractionVersion: { type: String, default: '1.0' }
    }
  },
  
  // ========== CLARIFICATION MANAGEMENT ==========
  clarifications: {
    // Auto-generated clarification questions
    suggestedQuestions: [{
      question: { type: String, maxlength: 300 },
      category: { type: String },
      priority: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'medium'
      },
      isAnswered: { type: Boolean, default: false },
      answer: { type: String, maxlength: 1000 },
      answeredAt: { type: Date }
    }],
    
    // Custom questions added by creator
    customQuestions: [{
      question: { type: String, maxlength: 300 },
      addedAt: { type: Date, default: Date.now },
      isAnswered: { type: Boolean, default: false },
      answer: { type: String, maxlength: 1000 },
      answeredAt: { type: Date }
    }],
    
    // Email template for brand clarification
    clarificationEmail: {
      generated: { type: Boolean, default: false },
      subject: { type: String },
      body: { type: String, maxlength: 5000 },
      sentAt: { type: Date },
      responseReceived: { type: Boolean, default: false }
    }
  },
  
  // ========== DEAL CONVERSION ==========
  dealConversion: {
    isConverted: { type: Boolean, default: false },
    dealId: {
      type: Schema.Types.ObjectId,
      ref: 'Deal',
      sparse: true
    },
    convertedAt: { type: Date },
    conversionMethod: {
      type: String,
      enum: ['one_click', 'manual_edit'],
    },
    
    // Pre-conversion deal data
    proposedDealData: {
      estimatedValue: { type: Number },
      suggestedRates: {
        type: Map,
        of: Number
      },
      timelineAdjustments: { type: String },
      recommendedChanges: [{ type: String }]
    }
  },
  
  // ========== STATUS & WORKFLOW ==========
  status: {
    type: String,
    enum: [
      'draft',           // Recently created, being processed
      'analyzed',        // AI analysis completed
      'needs_clarification', // Missing info identified
      'ready_for_deal',  // All info available, ready to convert
      'converted',       // Converted to deal
      'archived'         // No longer active
    ],
    default: 'draft',
    index: true
  },
  
  // Tags for organization
  tags: [{
    type: String,
    maxlength: 30
  }],
  
  // Creator notes
  creatorNotes: {
    type: String,
    maxlength: 2000
  },
  
  // ========== SUBSCRIPTION TRACKING ==========
  subscriptionTier: {
    type: String,
    enum: ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro'],
    required: true,
    index: true
  },
  
  // ========== AUDIT FIELDS ==========
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  
  deletedAt: {
    type: Date,
    sparse: true
  },
  
  lastProcessedAt: {
    type: Date
  },
  
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  collection: 'briefs'
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

// Compound indexes for common queries
briefSchema.index({ creatorId: 1, status: 1, createdAt: -1 });
briefSchema.index({ creatorId: 1, 'aiExtraction.status': 1 });
briefSchema.index({ creatorId: 1, isDeleted: 1, createdAt: -1 });
briefSchema.index({ 'aiExtraction.brandInfo.name': 1, creatorId: 1 });
briefSchema.index({ subscriptionTier: 1, createdAt: -1 });

// Text search index
briefSchema.index({
  'originalContent.rawText': 'text',
  'aiExtraction.brandInfo.name': 'text',
  'aiExtraction.campaignInfo.name': 'text',
  'creatorNotes': 'text'
});

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

// Generate brief ID before saving
briefSchema.pre('save', async function(next) {
  if (this.isNew && !this.briefId) {
    const user = await mongoose.model('User').findById(this.creatorId);
    if (user) {
      const year = new Date().getFullYear().toString().slice(-2);
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      
      // Get sequence number for this creator this month
      const briefCount = await mongoose.model('Brief').countDocuments({
        creatorId: this.creatorId,
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        }
      });
      
      const sequence = String(briefCount + 1).padStart(3, '0');
      this.briefId = `${user.fullName.substring(0, 3).toUpperCase()}${year}${month}B${sequence}`;
    }
  }
  next();
});

// Update lastProcessedAt when AI extraction is updated
briefSchema.pre('save', function(next) {
  if (this.isModified('aiExtraction') && this.aiExtraction.status === 'completed') {
    this.lastProcessedAt = new Date();
  }
  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

// Check if brief analysis is complete
briefSchema.methods.isAnalysisComplete = function() {
  return this.aiExtraction.status === 'completed' && 
         this.aiExtraction.deliverables.length > 0;
};

// Get estimated total value
briefSchema.methods.getEstimatedValue = function() {
  if (!this.aiExtraction.deliverables) return 0;
  
  return this.aiExtraction.deliverables.reduce((total, deliverable) => {
    return total + (deliverable.estimatedValue || 0);
  }, 0);
};

// Check if ready for deal conversion
briefSchema.methods.isReadyForDeal = function() {
  const criticalMissing = this.aiExtraction.missingInfo.filter(
    info => info.importance === 'critical'
  );
  
  return this.isAnalysisComplete() && 
         criticalMissing.length === 0 &&
         this.status === 'ready_for_deal';
};

// Get completion percentage
briefSchema.methods.getCompletionPercentage = function() {
  let completed = 0;
  let total = 10; // Total checkpoints
  
  // AI extraction completed
  if (this.aiExtraction.status === 'completed') completed++;
  
  // Brand info available
  if (this.aiExtraction.brandInfo.name) completed++;
  
  // Deliverables identified
  if (this.aiExtraction.deliverables.length > 0) completed++;
  
  // Timeline available
  if (this.aiExtraction.timeline.contentDeadline) completed++;
  
  // Budget information
  if (this.aiExtraction.budget.mentioned) completed++;
  
  // Brand guidelines
  if (this.aiExtraction.brandGuidelines.hashtags.length > 0) completed++;
  
  // Usage rights clarified
  if (this.aiExtraction.usageRights.duration) completed++;
  
  // No critical missing info
  const criticalMissing = this.aiExtraction.missingInfo.filter(
    info => info.importance === 'critical'
  );
  if (criticalMissing.length === 0) completed++;
  
  // Risk assessment done
  if (this.aiExtraction.riskAssessment.overallRisk) completed++;
  
  // Creator notes added (optional but good practice)
  if (this.creatorNotes) completed++;
  
  return Math.round((completed / total) * 100);
};

// Get days since brief creation
briefSchema.methods.getDaysOld = function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (24 * 60 * 60 * 1000));
};

// ============================================
// VIRTUAL FIELDS
// ============================================

// Virtual: Brief age in human readable format
briefSchema.virtual('briefAge').get(function() {
  const days = this.getDaysOld();
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
});

// Virtual: Total estimated value
briefSchema.virtual('estimatedValue').get(function() {
  return this.getEstimatedValue();
});

// Virtual: Completion status
briefSchema.virtual('completionStatus').get(function() {
  const percentage = this.getCompletionPercentage();
  if (percentage >= 90) return 'complete';
  if (percentage >= 70) return 'mostly_complete';
  if (percentage >= 40) return 'in_progress';
  return 'incomplete';
});

// ============================================
// STATIC METHODS
// ============================================

// Get briefs by status for a creator
briefSchema.statics.getByStatus = function(creatorId, status) {
  return this.find({
    creatorId,
    status,
    isDeleted: false
  }).sort({ createdAt: -1 });
};

// Get subscription tier limits for brief analysis
briefSchema.statics.getSubscriptionLimits = function(tier) {
  const limits = {
    starter: {
      maxBriefsPerMonth: 10,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      aiFeatures: false
    },
    pro: {
      maxBriefsPerMonth: 25,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      aiFeatures: true
    },
    elite: {
      maxBriefsPerMonth: -1, // unlimited
      maxFileSize: 25 * 1024 * 1024, // 25MB
      aiFeatures: true
    },
    agency_starter: {
      maxBriefsPerMonth: -1,
      maxFileSize: 25 * 1024 * 1024,
      aiFeatures: true
    },
    agency_pro: {
      maxBriefsPerMonth: -1,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      aiFeatures: true
    }
  };
  
  return limits[tier] || limits.starter;
};

// Find briefs ready for deal conversion
briefSchema.statics.getReadyForDeal = function(creatorId) {
  return this.find({
    creatorId,
    status: 'ready_for_deal',
    isDeleted: false,
    'dealConversion.isConverted': false
  }).sort({ lastProcessedAt: -1 });
};

// ============================================
// EXPORT MODEL
// ============================================

const Brief = mongoose.model('Brief', briefSchema);

module.exports = {
  Brief,
  briefSchema
};