//src/modules/deals/model.js

/**
 * CreatorsMantra Backend - Deal CRM Models
 * Deal pipeline management, brand relationships, and deal tracking
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const mongoose = require('mongoose');
const { encryptData, decryptData } = require('../../shared/utils');

// ============================================
// DEAL SCHEMA
// ============================================

const dealSchema = new mongoose.Schema({
  // Reference to User (Creator)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Deal Identification
  dealId: {
    type: String,
    unique: true,
    //required: true,
    index: true
  },

  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Deal title cannot exceed 200 characters']
  },

  // Brand Information
  brand: {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Brand name cannot exceed 100 characters']
    },
    
    contactPerson: {
      name: {
        type: String,
        trim: true,
        maxlength: [100, 'Contact person name cannot exceed 100 characters']
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
        validate: {
          validator: function(email) {
            if (!email) return true; // Optional field
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          },
          message: 'Invalid email format'
        }
      },
      phone: {
        type: String,
        validate: {
          validator: function(phone) {
            if (!phone) return true; // Optional field
            return /^[6-9]\d{9}$/.test(phone); // Indian mobile number
          },
          message: 'Invalid phone number format'
        }
      },
      designation: {
        type: String,
        trim: true,
        maxlength: [100, 'Designation cannot exceed 100 characters']
      }
    },

    website: {
      type: String,
      trim: true,
      validate: {
        validator: function(url) {
          if (!url) return true; // Optional field
          return /^https?:\/\/.+\..+/.test(url);
        },
        message: 'Invalid website URL format'
      }
    },

    industry: {
      type: String,
      enum: [
        'fashion', 'beauty', 'lifestyle', 'tech', 'food', 'travel', 
        'fitness', 'finance', 'education', 'entertainment', 'gaming',
        'automotive', 'real_estate', 'healthcare', 'home_decor', 'other'
      ],
      default: 'other'
    },

    companySize: {
      type: String,
      enum: ['startup', 'small', 'medium', 'large', 'enterprise'],
      default: 'startup'
    }
  },

  // Platform and Content Details
  platform: {
    type: String,
    required: true,
    enum: ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'snapchat', 'multiple']
  },

  deliverables: [{
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
    
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      max: [100, 'Quantity cannot exceed 100']
    },
    
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Deliverable description cannot exceed 500 characters']
    },
    
    specifications: {
      duration: Number, // For videos (in seconds)
      dimensions: String, // For images (e.g., "1080x1080")
      hashtags: [String],
      mentions: [String],
      musicRequired: Boolean,
      locationTagRequired: Boolean
    },
    
    deadline: Date,
    
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'submitted', 'approved', 'revision_required', 'completed'],
      default: 'pending'
    },
    
    submissionUrl: String, // URL to submitted content
    submittedAt: Date,
    approvedAt: Date,
    
    revisionNotes: String,
    revisionCount: {
      type: Number,
      default: 0,
      max: [5, 'Maximum 5 revisions allowed']
    }
  }],

  // Deal Stages and Status
  stage: {
    type: String,
    required: true,
    enum: ['pitched', 'in_talks', 'negotiating', 'live', 'completed', 'paid', 'cancelled', 'rejected'],
    default: 'pitched',
    index: true
  },

  status: {
    type: String,
    required: true,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active',
    index: true
  },

  // Financial Information
  dealValue: {
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR']
    },
    
    amount: {
      type: Number,
      required: true,
      min: [0, 'Deal value cannot be negative'],
      max: [10000000, 'Deal value cannot exceed ₹1 Cr'] // 1 Crore limit
    },
    
    breakdown: [{
      description: String,
      amount: Number,
      percentage: Number
    }],
    
    paymentTerms: {
      type: String,
      enum: ['full_advance', '50_50', '30_70', 'on_delivery', 'net_30', 'net_15', 'custom'],
      default: '50_50'
    },
    
    customPaymentTerms: String,
    
    gstApplicable: {
      type: Boolean,
      default: true
    },
    
    tdsApplicable: {
      type: Boolean,
      default: false
    },
    
    gstAmount: {
      type: Number,
      default: 0,
      min: [0, 'GST amount cannot be negative']
    },
    
    tdsAmount: {
      type: Number,
      default: 0,
      min: [0, 'TDS amount cannot be negative']
    },
    
    finalAmount: {
      type: Number,
      //required: true,
      min: [0, 'Final amount cannot be negative']
    }
  },

  // Timeline Management
  timeline: {
    pitchedDate: {
      type: Date,
      default: Date.now
    },
    
    responseDeadline: Date,
    
    negotiationStartDate: Date,
    
    contractSignedDate: Date,
    
    contentCreationStart: Date,
    
    contentDeadline: Date,
    
    goLiveDate: Date,
    
    campaignEndDate: Date,
    
    paymentDueDate: Date,
    
    completedDate: Date
  },

  // Campaign Requirements
  campaignRequirements: {
    exclusivity: {
      required: {
        type: Boolean,
        default: false
      },
      duration: Number, // in days
      categories: [String] // competitor categories to avoid
    },
    
    contentGuidelines: {
      mustInclude: [String],
      mustAvoid: [String],
      tone: {
        type: String,
        enum: ['professional', 'casual', 'humorous', 'educational', 'inspirational']
      },
      style: String
    },
    
    usageRights: {
      duration: {
        type: String,
        enum: ['1_month', '3_months', '6_months', '1_year', 'lifetime', 'custom'],
        default: '3_months'
      },
      platforms: [String],
      geography: {
        type: String,
        enum: ['india', 'global', 'specific_regions'],
        default: 'india'
      },
      whiteLabel: {
        type: Boolean,
        default: false
      }
    },
    
    performanceTargets: {
      minViews: Number,
      minLikes: Number,
      minComments: Number,
      minShares: Number,
      minSaves: Number,
      ctr: Number, // Click-through rate
      engagementRate: Number
    }
  },

  // Communication History
  communications: [{
    type: {
      type: String,
      enum: ['email', 'call', 'meeting', 'whatsapp', 'instagram_dm', 'other'],
      required: true
    },
    
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true
    },
    
    subject: {
      type: String,
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters']
    },
    
    summary: {
      type: String,
      trim: true,
      maxlength: [1000, 'Summary cannot exceed 1000 characters']
    },
    
    outcome: {
      type: String,
      enum: ['positive', 'neutral', 'negative', 'follow_up_required'],
      default: 'neutral'
    },
    
    nextAction: String,
    
    followUpDate: Date,
    
    attachments: [String], // URLs to files
    
    createdAt: {
      type: Date,
      default: Date.now
    },
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Internal Notes and Tags
  internalNotes: {
    type: String,
    maxlength: [2000, 'Internal notes cannot exceed 2000 characters']
  },

  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },

  // Deal Source and Attribution
  source: {
    type: String,
    enum: ['direct_outreach', 'brand_inquiry', 'referral', 'social_media', 'email_campaign', 'networking', 'repeat_client', 'other'],
    default: 'brand_inquiry'
  },

  referralSource: {
    type: String,
    trim: true
  },

  // Performance Tracking
  performance: {
    isTracked: {
      type: Boolean,
      default: false
    },
    
    metricsCollected: [{
      platform: String,
      metric: String,
      value: Number,
      timestamp: Date,
      screenshotUrl: String
    }],
    
    summary: {
      totalReach: Number,
      totalImpressions: Number,
      totalEngagement: Number,
      avgEngagementRate: Number,
      clickThroughs: Number,
      conversions: Number,
      roi: Number
    }
  },

  // Contract and Legal
  contract: {
    isRequired: {
      type: Boolean,
      default: false
    },
    
    status: {
      type: String,
      enum: ['not_required', 'pending', 'sent', 'reviewed', 'signed', 'completed'],
      default: 'not_required'
    },
    
    contractUrl: String, // URL to signed contract
    signedAt: Date,
    expiresAt: Date,
    
    keyTerms: {
      exclusivity: String,
      deliverables: String,
      timeline: String,
      payment: String,
      usageRights: String,
      cancellation: String
    }
  },

  // Invoice Reference
  invoices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  }],

  // Manager Assignment (for managed creators)
  assignedManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Deal Alerts and Reminders
  alerts: [{
    type: {
      type: String,
      enum: ['deadline_approaching', 'payment_overdue', 'follow_up_required', 'contract_expiring', 'performance_review']
    },
    message: String,
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info'
    },
    isRead: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Collaboration Features
  collaborators: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'manager'],
      default: 'viewer'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Competitive Analysis
  competitorAnalysis: {
    similarDeals: [{
      brand: String,
      creator: String,
      platform: String,
      estimatedValue: Number,
      deliverables: [String],
      performance: String,
      source: String
    }],
    
    marketRate: {
      min: Number,
      max: Number,
      average: Number,
      lastUpdated: Date
    }
  },

  // Archived and Deleted Status
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },

  archivedAt: Date,

  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Soft Delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },

  deletedAt: Date,

  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// BRAND PROFILE SCHEMA
// ============================================

const brandProfileSchema = new mongoose.Schema({
  // Reference to User (Creator who worked with this brand)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Brand Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: [100, 'Brand name cannot exceed 100 characters']
  },

  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },

  logo: {
    url: String,
    filename: String,
    uploadedAt: Date
  },

  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(url) {
        if (!url) return true;
        return /^https?:\/\/.+\..+/.test(url);
      },
      message: 'Invalid website URL format'
    }
  },

  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },

  // Brand Classification
  industry: {
    type: String,
    required: true,
    enum: [
      'fashion', 'beauty', 'lifestyle', 'tech', 'food', 'travel', 
      'fitness', 'finance', 'education', 'entertainment', 'gaming',
      'automotive', 'real_estate', 'healthcare', 'home_decor', 'other'
    ]
  },

  category: {
    type: String,
    enum: ['b2c', 'b2b', 'saas', 'ecommerce', 'marketplace', 'service', 'nonprofit', 'government']
  },

  companySize: {
    type: String,
    enum: ['startup', 'small', 'medium', 'large', 'enterprise'],
    default: 'startup'
  },

  headquarters: {
    country: {
      type: String,
      default: 'India'
    },
    city: String,
    state: String
  },

  // Contact Information
  primaryContact: {
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Contact name cannot exceed 100 characters']
    },
    designation: String,
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(email) {
          if (!email) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: 'Invalid email format'
      }
    },
    phone: {
      type: String,
      validate: {
        validator: function(phone) {
          if (!phone) return true;
          return /^[6-9]\d{9}$/.test(phone);
        },
        message: 'Invalid phone number format'
      }
    },
    linkedin: String,
    preferredContactMethod: {
      type: String,
      enum: ['email', 'phone', 'whatsapp', 'linkedin'],
      default: 'email'
    }
  },

  // Additional Contacts
  contacts: [{
    name: String,
    designation: String,
    email: String,
    phone: String,
    department: {
      type: String,
      enum: ['marketing', 'sales', 'partnerships', 'pr', 'hr', 'legal', 'finance', 'other']
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],

  // Social Media Presence
  socialMedia: {
    instagram: {
      handle: String,
      followers: Number,
      verified: Boolean,
      url: String
    },
    youtube: {
      channel: String,
      subscribers: Number,
      verified: Boolean,
      url: String
    },
    linkedin: {
      handle: String,
      followers: Number,
      url: String
    },
    twitter: {
      handle: String,
      followers: Number,
      verified: Boolean,
      url: String
    },
    facebook: {
      page: String,
      likes: Number,
      url: String
    }
  },

  // Collaboration History
  collaborationHistory: {
    totalDeals: {
      type: Number,
      default: 0
    },
    
    totalValue: {
      type: Number,
      default: 0
    },
    
    averageDealValue: {
      type: Number,
      default: 0
    },
    
    firstCollaboration: Date,
    lastCollaboration: Date,
    
    preferredPlatforms: [String],
    preferredDeliverables: [String],
    
    paymentBehavior: {
      averagePaymentDelay: Number, // in days
      paymentRating: {
        type: Number,
        min: 1,
        max: 5,
        default: 3
      },
      onTimePayments: Number,
      delayedPayments: Number
    },
    
    communicationRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    }
  },

  // Brand Preferences
  preferences: {
    budgetRange: {
      min: Number,
      max: Number,
      currency: {
        type: String,
        default: 'INR'
      }
    },
    
    campaignTypes: [{
      type: String,
      enum: ['brand_awareness', 'product_launch', 'seasonal', 'influencer_takeover', 'ugc', 'review', 'tutorial', 'lifestyle']
    }],
    
    contentStyle: [{
      type: String,
      enum: ['professional', 'casual', 'humorous', 'educational', 'inspirational', 'trendy']
    }],
    
    exclusivityRequirements: {
      required: Boolean,
      duration: Number,
      categories: [String]
    },
    
    usageRights: {
      defaultDuration: String,
      whitelabelPreference: Boolean,
      geographicScope: String
    },
    
    responseTime: {
      initial: Number, // hours
      revisions: Number, // hours
      finalApproval: Number // hours
    }
  },

  // Brand Guidelines
  guidelines: {
    brandColors: [String],
    fonts: [String],
    logoUsage: String,
    voiceAndTone: String,
    dosAndDonts: {
      dos: [String],
      donts: [String]
    },
    hashtags: {
      required: [String],
      recommended: [String],
      avoid: [String]
    }
  },

  // Notes and Internal Data
  internalNotes: {
    type: String,
    maxlength: [2000, 'Internal notes cannot exceed 2000 characters']
  },

  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],

  // Brand Status
  status: {
    type: String,
    enum: ['active', 'potential', 'blacklisted', 'inactive'],
    default: 'potential',
    index: true
  },

  blacklistReason: String,

  // Analytics and Insights
  analytics: {
    responseRate: Number, // percentage
    conversionRate: Number, // percentage
    averageNegotiationTime: Number, // days
    dealSuccess: {
      successful: Number,
      cancelled: Number,
      rejected: Number
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// DEAL TEMPLATE SCHEMA
// ============================================

const dealTemplateSchema = new mongoose.Schema({
  // Reference to User (Creator)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Template Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },

  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  category: {
    type: String,
    enum: ['instagram_post', 'instagram_reel', 'youtube_video', 'brand_collaboration', 'product_review', 'custom'],
    default: 'custom'
  },

  // Template Data (structure similar to deal schema)
  template: {
    platform: String,
    deliverables: [{
      type: String,
      quantity: Number,
      description: String,
      specifications: mongoose.Schema.Types.Mixed
    }],
    defaultValue: Number,
    paymentTerms: String,
    timeline: {
      responseDeadline: Number, // days
      contentDeadline: Number, // days
      revisionTime: Number // days
    },
    campaignRequirements: mongoose.Schema.Types.Mixed
  },

  // Usage Statistics
  usage: {
    timesUsed: {
      type: Number,
      default: 0
    },
    lastUsed: Date,
    successRate: Number // percentage of deals created from this template that were successful
  },

  // Template Settings
  isPublic: {
    type: Boolean,
    default: false
  },

  isDefault: {
    type: Boolean,
    default: false
  },

  tags: [String]
}, {
  timestamps: true
});

// ============================================
// DEAL SCHEMA METHODS & VIRTUALS
// ============================================

// Improved pre-save hooks in model.js

// Generate unique deal ID before saving
dealSchema.pre('save', async function(next) {
  if (this.isNew && !this.dealId) {
    try {
      const User = require('../auth/model').User;
      const user = await User.findById(this.userId);
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      
      // Count deals for this user this month
      const dealsThisMonth = await this.constructor.countDocuments({
        userId: this.userId,
        createdAt: {
          $gte: new Date(year, new Date().getMonth(), 1),
          $lt: new Date(year, new Date().getMonth() + 1, 1)
        }
      });
      
      const sequence = String(dealsThisMonth + 1).padStart(3, '0');
      const userPrefix = user.fullName ? user.fullName.substring(0, 3).toUpperCase() : 'USR';
      this.dealId = `${userPrefix}${year}${month}${sequence}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Calculate financial amounts before saving
dealSchema.pre('save', function(next) {
  // Initialize amounts if not set
  if (!this.dealValue.gstAmount) this.dealValue.gstAmount = 0;
  if (!this.dealValue.tdsAmount) this.dealValue.tdsAmount = 0;
  
  // Calculate GST if applicable
  if (this.dealValue.gstApplicable) {
    this.dealValue.gstAmount = Math.round(this.dealValue.amount * 0.18);
  }
  
  // Calculate TDS if applicable
  if (this.dealValue.tdsApplicable) {
    this.dealValue.tdsAmount = Math.round(this.dealValue.amount * 0.10);
  }
  
  // Calculate final amount
  this.dealValue.finalAmount = this.dealValue.amount + this.dealValue.gstAmount - this.dealValue.tdsAmount;
  
  next();
});

// Check if deal is overdue
dealSchema.methods.isOverdue = function() {
  const now = new Date();
  
  if (this.timeline.responseDeadline && this.stage === 'pitched') {
    return now > this.timeline.responseDeadline;
  }
  
  if (this.timeline.contentDeadline && ['live', 'in_talks'].includes(this.stage)) {
    return now > this.timeline.contentDeadline;
  }
  
  if (this.timeline.paymentDueDate && this.stage === 'completed') {
    return now > this.timeline.paymentDueDate;
  }
  
  return false;
};

// Get deal progress percentage
dealSchema.methods.getProgress = function() {
  const stageProgress = {
    pitched: 10,
    in_talks: 25,
    negotiating: 40,
    live: 60,
    completed: 85,
    paid: 100,
    cancelled: 0,
    rejected: 0
  };
  
  return stageProgress[this.stage] || 0;
};

// Calculate deliverable completion percentage
dealSchema.methods.getDeliverableProgress = function() {
  if (this.deliverables.length === 0) return 0;
  
  const completedDeliverables = this.deliverables.filter(d => d.status === 'completed').length;
  return Math.round((completedDeliverables / this.deliverables.length) * 100);
};

// Virtual: Days since deal was created
dealSchema.virtual('daysSinceCreated').get(function() {
  if (!this.createdAt) return 0;
  return Math.floor((Date.now() - this.createdAt.getTime()) / (24 * 60 * 60 * 1000));
});

// Virtual: Deal age in appropriate units
dealSchema.virtual('dealAge').get(function() {
  if (!this.createdAt) return 'Unknown';
  const days = this.daysSinceCreated;
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.floor(days / 7)} weeks`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  return `${Math.floor(days / 365)} years`;
});

// Virtual: Expected revenue (including GST, excluding TDS)
dealSchema.virtual('expectedRevenue').get(function() {
  return this.dealValue.finalAmount;
});

// Virtual: Communication count
dealSchema.virtual('communicationCount').get(function() {
  return this.communications.length;
});

// Virtual: Last communication date
dealSchema.virtual('lastCommunication').get(function() {
  if (!this.communications || this.communications.length === 0) return null;
  return this.communications[this.communications.length - 1].createdAt;
});

// ============================================
// BRAND PROFILE METHODS & VIRTUALS
// ============================================

// Generate slug before saving
brandProfileSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }
  next();
});

// Update collaboration history
brandProfileSchema.methods.updateCollaborationStats = async function() {
  const Deal = mongoose.model('Deal');
  
  const deals = await Deal.find({
    'brand.name': this.name,
    status: { $ne: 'cancelled' }
  });
  
  if (deals.length > 0) {
    this.collaborationHistory.totalDeals = deals.length;
    this.collaborationHistory.totalValue = deals.reduce((sum, deal) => sum + deal.dealValue.amount, 0);
    this.collaborationHistory.averageDealValue = this.collaborationHistory.totalValue / this.collaborationHistory.totalDeals;
    this.collaborationHistory.firstCollaboration = deals[0].createdAt;
    this.collaborationHistory.lastCollaboration = deals[deals.length - 1].createdAt;
    
    // Calculate payment behavior
    const paidDeals = deals.filter(deal => deal.stage === 'paid');
    this.collaborationHistory.paymentBehavior.onTimePayments = paidDeals.length;
    
    await this.save();
  }
};

// Virtual: Total social media reach
brandProfileSchema.virtual('totalSocialReach').get(function() {
  const social = this.socialMedia;
  return (social.instagram?.followers || 0) + 
         (social.youtube?.subscribers || 0) + 
         (social.linkedin?.followers || 0) + 
         (social.twitter?.followers || 0) + 
         (social.facebook?.likes || 0);
});

// Virtual: Brand score (based on collaboration history)
brandProfileSchema.virtual('brandScore').get(function() {
  const history = this.collaborationHistory;
  let score = 50; // Base score
  
  // Payment behavior (max 30 points)
  if (history.paymentBehavior.paymentRating >= 4) score += 20;
  else if (history.paymentBehavior.paymentRating >= 3) score += 10;
  
  // Communication rating (max 20 points)
  if (history.communicationRating >= 4) score += 15;
  else if (history.communicationRating >= 3) score += 10;
  
  // Deal frequency (max 15 points)
  if (history.totalDeals >= 10) score += 15;
  else if (history.totalDeals >= 5) score += 10;
  else if (history.totalDeals >= 1) score += 5;
  
  // Recent activity (max 10 points)
  if (history.lastCollaboration) {
    const daysSince = Math.floor((Date.now() - history.lastCollaboration.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSince <= 30) score += 10;
    else if (daysSince <= 90) score += 5;
  }
  
  return Math.min(score, 100);
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

// Deal indexes
dealSchema.index({ userId: 1, stage: 1 });
dealSchema.index({ userId: 1, status: 1 });
dealSchema.index({ userId: 1, createdAt: -1 });
dealSchema.index({ 'brand.name': 1 });
dealSchema.index({ platform: 1 });
dealSchema.index({ priority: 1, stage: 1 });
dealSchema.index({ 'timeline.contentDeadline': 1, stage: 1 });
dealSchema.index({ 'timeline.paymentDueDate': 1, stage: 1 });
dealSchema.index({ tags: 1 });
dealSchema.index({ isArchived: 1, isDeleted: 1 });

// Brand profile indexes
brandProfileSchema.index({ userId: 1 });
brandProfileSchema.index({ name: 1 });
brandProfileSchema.index({ slug: 1 });
brandProfileSchema.index({ industry: 1 });
brandProfileSchema.index({ status: 1 });
brandProfileSchema.index({ 'collaborationHistory.totalDeals': -1 });
brandProfileSchema.index({ 'collaborationHistory.totalValue': -1 });

// Deal template indexes
dealTemplateSchema.index({ userId: 1 });
dealTemplateSchema.index({ category: 1 });
dealTemplateSchema.index({ isPublic: 1 });

// ============================================
// STATIC METHODS
// ============================================

// Find deals needing attention
dealSchema.statics.findDealsNeedingAttention = function(userId) {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  
  return this.find({
    userId,
    status: 'active',
    $or: [
      // Overdue response
      { 
        stage: 'pitched',
        'timeline.responseDeadline': { $lt: now }
      },
      // Content deadline approaching
      {
        stage: { $in: ['live', 'in_talks'] },
        'timeline.contentDeadline': { 
          $gte: now,
          $lte: threeDaysFromNow
        }
      },
      // Payment overdue
      {
        stage: 'completed',
        'timeline.paymentDueDate': { $lt: now }
      }
    ]
  }).sort({ priority: -1, 'timeline.responseDeadline': 1 });
};

// Get revenue analytics
dealSchema.statics.getRevenueAnalytics = function(userId, period = '30d') {
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
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalDeals: { $sum: 1 },
        totalValue: { $sum: '$dealValue.amount' },
        totalRevenue: { $sum: '$dealValue.finalAmount' },
        paidDeals: {
          $sum: { $cond: [{ $eq: ['$stage', 'paid'] }, 1, 0] }
        },
        paidRevenue: {
          $sum: { $cond: [{ $eq: ['$stage', 'paid'] }, '$dealValue.finalAmount', 0] }
        },
        avgDealValue: { $avg: '$dealValue.amount' }
      }
    }
  ]);
};

// ============================================
// EXPORT MODELS
// ============================================

const Deal = mongoose.model('Deal', dealSchema);
const BrandProfile = mongoose.model('BrandProfile', brandProfileSchema);
const DealTemplate = mongoose.model('DealTemplate', dealTemplateSchema);

module.exports = {
  Deal,
  BrandProfile,
  DealTemplate
};