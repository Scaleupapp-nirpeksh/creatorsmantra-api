/**
 * CreatorsMantra Backend - Rate Card Module
 * Mongoose model for creator rate cards with AI pricing suggestions
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const mongoose = require('mongoose');
const { logInfo, logError } = require('../../shared/utils');

// Rate Card Schema
const rateCardSchema = new mongoose.Schema({
  // Creator Association
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Rate Card Metadata
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    default: 'My Rate Card'
  },
  
  version: {
    type: Number,
    default: 1
  },
  
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft',
    index: true
  },
  
  // Creator Metrics (for AI suggestions)
  creatorMetrics: {
    platforms: [{
      name: {
        type: String,
        enum: ['instagram', 'youtube', 'linkedin', 'twitter'],
        required: true
      },
      followers: {
        type: Number,
        required: true,
        min: 0
      },
      engagementRate: {
        type: Number,
        min: 0,
        max: 100
      },
      avgViews: Number,
      verified: {
        type: Boolean,
        default: false
      }
    }],
    
    niche: {
      type: String,
      enum: ['fashion', 'beauty', 'tech', 'finance', 'food', 'travel', 
             'lifestyle', 'fitness', 'gaming', 'education', 'entertainment', 
             'business', 'health', 'parenting', 'general'],
      required: true
    },
    
    location: {
      city: String,
      state: String,
      country: {
        type: String,
        default: 'India'
      }
    },
    
    language: [{
      type: String,
      enum: ['english', 'hindi', 'tamil', 'telugu', 'bengali', 'marathi', 
             'gujarati', 'kannada', 'malayalam', 'punjabi', 'other']
    }]
  },
  
  // Deliverables with Platform-specific Rates
  deliverables: [{
    platform: {
      type: String,
      enum: ['instagram', 'youtube', 'linkedin', 'twitter'],
      required: true
    },
    
    items: [{
      type: {
        type: String,
        required: true
        // Instagram: reel, post, story, story_series, igtv, live
        // YouTube: dedicated_video, integration, shorts, live_stream
        // LinkedIn: article, post, video, newsletter
      },
      
      description: {
        type: String,
        maxlength: 200
      },
      
      // Pricing Information
      pricing: {
        basePrice: {
          type: Number,
          required: true,
          min: 0
        },
        
        aiSuggestedPrice: {
          type: Number,
          min: 0
        },
        
        finalPrice: {
          type: Number,
          required: true,
          min: 0
        },
        
        currency: {
          type: String,
          default: 'INR'
        },
        
        priceUnit: {
          type: String,
          enum: ['per_post', 'per_video', 'per_story', 'per_hour', 'per_campaign'],
          default: 'per_post'
        }
      },
      
      // Delivery Information
      turnaroundTime: {
        value: Number,
        unit: {
          type: String,
          enum: ['hours', 'days', 'weeks'],
          default: 'days'
        }
      },
      
      includedRevisions: {
        type: Number,
        default: 2,
        min: 0
      },
      
      active: {
        type: Boolean,
        default: true
      }
    }]
  }],
  
  // Package Deals
  packages: [{
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    
    description: {
      type: String,
      maxlength: 500
    },
    
    items: [{
      deliverableId: mongoose.Schema.Types.ObjectId,
      quantity: {
        type: Number,
        default: 1,
        min: 1
      },
      description: String
    }],
    
    pricing: {
      individualTotal: {
        type: Number,
        required: true
      },
      
      packagePrice: {
        type: Number,
        required: true
      },
      
      savings: {
        amount: Number,
        percentage: Number
      }
    },
    
    validity: {
      value: Number,
      unit: {
        type: String,
        enum: ['days', 'weeks', 'months'],
        default: 'days'
      }
    },
    
    popular: {
      type: Boolean,
      default: false
    },
    
    active: {
      type: Boolean,
      default: true
    }
  }],
  
  // Template & Branding
  template: {
    designId: {
      type: String,
      enum: ['minimal_clean', 'bold_gradient', 'corporate_professional', 
             'creative_playful', 'luxury_premium'],
      default: 'minimal_clean'
    },
    
    customization: {
      primaryColor: {
        type: String,
        default: '#8B5CF6'
      },
      
      secondaryColor: {
        type: String,
        default: '#EC4899'
      },
      
      accentColor: {
        type: String,
        default: '#3B82F6'
      },
      
      fontFamily: {
        type: String,
        enum: ['inter', 'poppins', 'montserrat', 'playfair', 'roboto'],
        default: 'inter'
      },
      
      logoUrl: String,
      
      watermarkEnabled: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Terms & Conditions
  terms: {
    paymentTerms: {
      type: String,
      enum: ['100_advance', '50_50', '25_75', 'post_delivery', 'custom'],
      default: '50_50'
    },
    
    customPaymentTerms: String,
    
    usageRights: {
      duration: {
        value: Number,
        unit: {
          type: String,
          enum: ['days', 'months', 'years', 'perpetual'],
          default: 'months'
        }
      },
      
      platforms: [{
        type: String,
        enum: ['owned_channels', 'paid_promotion', 'all_digital', 
               'print', 'broadcast', 'unlimited']
      }],
      
      exclusivity: {
        required: {
          type: Boolean,
          default: false
        },
        duration: {
          value: Number,
          unit: {
            type: String,
            enum: ['days', 'weeks', 'months']
          }
        }
      }
    },
    
    cancellationPolicy: {
      type: String,
      maxlength: 500
    },
    
    additionalTerms: [{
      type: String,
      maxlength: 200
    }],
    
    validity: {
      days: {
        type: Number,
        default: 30,
        min: 7,
        max: 90
      },
      
      expiryDate: Date
    }
  },
  
  // AI Pricing Suggestions Tracking
  aiSuggestions: {
    generated: {
      type: Boolean,
      default: false
    },
    
    generatedAt: Date,
    
    acceptanceRate: {
      type: Number,
      min: 0,
      max: 100
    },
    
    suggestedRates: [{
      deliverableType: String,
      platform: String,
      suggestedPrice: Number,
      marketRange: {
        min: Number,
        max: Number
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100
      },
      dataSources: Number,
      reasoning: String
    }],
    
    marketComparison: {
      percentile: Number,
      similarCreators: Number,
      averageMarketRate: Number
    }
  },
  
  // Sharing & Access
  sharing: {
    publicUrl: {
      type: String,
      unique: true,
      sparse: true
    },
    
    shortCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true
    },
    
    password: String,
    
    expiresAt: Date,
    
    viewCount: {
      type: Number,
      default: 0
    },
    
    lastViewedAt: Date,
    
    allowDownload: {
      type: Boolean,
      default: true
    }
  },
  
  // Analytics & Performance
  analytics: {
    timesShared: {
      type: Number,
      default: 0
    },
    
    timesViewed: {
      type: Number,
      default: 0
    },
    
    dealsInitiated: {
      type: Number,
      default: 0
    },
    
    dealsWon: {
      type: Number,
      default: 0
    },
    
    totalRevenue: {
      type: Number,
      default: 0
    },
    
    conversionRate: {
      type: Number,
      min: 0,
      max: 100
    },
    
    avgDealSize: Number,
    
    topPerformingPackage: String,
    
    brandsEngaged: [{
      brandName: String,
      engagedAt: Date,
      converted: Boolean
    }]
  },
  
  // Version Control
  versionHistory: [{
    version: Number,
    createdAt: Date,
    changes: String,
    rates: mongoose.Schema.Types.Mixed,
    restorable: {
      type: Boolean,
      default: true
    }
  }],
  
  // Parent/Child relationship for templates
  isTemplate: {
    type: Boolean,
    default: false
  },
  
  templateSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RateCard'
  },
  
  // Metadata
  notes: {
    type: String,
    maxlength: 1000
  },
  
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Subscription tier check
  subscriptionTier: {
    type: String,
    enum: ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro'],
    required: true
  },
  
  // Agency/Manager Access
  agency: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  managedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  deletedAt: Date

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
rateCardSchema.index({ creator: 1, status: 1 });
rateCardSchema.index({ 'sharing.shortCode': 1 });
rateCardSchema.index({ 'sharing.publicUrl': 1 });
rateCardSchema.index({ creator: 1, version: -1 });
rateCardSchema.index({ status: 1, isDeleted: 1 });
rateCardSchema.index({ 'analytics.dealsWon': -1 });

// Virtual for active rate cards
rateCardSchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.isDeleted;
});

// Virtual for package count
rateCardSchema.virtual('packageCount').get(function() {
  return this.packages ? this.packages.filter(p => p.active).length : 0;
});

// Pre-save middleware
rateCardSchema.pre('save', async function(next) {
  try {
    // Auto-generate short code if not exists
    if (this.isNew && !this.sharing.shortCode) {
      this.sharing.shortCode = await generateUniqueShortCode();
    }
    
    // Calculate expiry date based on validity
    if (this.terms.validity.days && !this.terms.validity.expiryDate) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + this.terms.validity.days);
      this.terms.validity.expiryDate = expiryDate;
    }
    
    // Calculate package savings
    this.packages.forEach(package => {
      if (package.pricing.individualTotal && package.pricing.packagePrice) {
        package.pricing.savings.amount = 
          package.pricing.individualTotal - package.pricing.packagePrice;
        package.pricing.savings.percentage = 
          ((package.pricing.savings.amount / package.pricing.individualTotal) * 100).toFixed(2);
      }
    });
    
    // Update analytics conversion rate
    if (this.analytics.dealsInitiated > 0) {
      this.analytics.conversionRate = 
        ((this.analytics.dealsWon / this.analytics.dealsInitiated) * 100).toFixed(2);
    }
    
    next();
  } catch (error) {
    logError('Error in rate card pre-save middleware', { error: error.message });
    next(error);
  }
});

// Helper function to generate unique short code
async function generateUniqueShortCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let shortCode;
  let isUnique = false;
  
  while (!isUnique) {
    shortCode = '';
    for (let i = 0; i < 6; i++) {
      shortCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    const existing = await mongoose.model('RateCard').findOne({ 
      'sharing.shortCode': shortCode 
    });
    
    if (!existing) {
      isUnique = true;
    }
  }
  
  return shortCode;
}

// Instance methods
rateCardSchema.methods.incrementViewCount = async function() {
  this.sharing.viewCount += 1;
  this.sharing.lastViewedAt = new Date();
  this.analytics.timesViewed += 1;
  await this.save();
};

rateCardSchema.methods.createVersion = async function(changes) {
  const newVersion = this.version + 1;
  
  // Save current state to version history
  this.versionHistory.push({
    version: this.version,
    createdAt: new Date(),
    changes: changes || 'Version created',
    rates: {
      deliverables: this.deliverables,
      packages: this.packages
    }
  });
  
  this.version = newVersion;
  await this.save();
  
  logInfo('Rate card version created', { 
    rateCardId: this._id, 
    newVersion 
  });
  
  return newVersion;
};

rateCardSchema.methods.restoreVersion = async function(versionNumber) {
  const versionData = this.versionHistory.find(v => v.version === versionNumber);
  
  if (!versionData || !versionData.restorable) {
    throw new Error('Version not found or not restorable');
  }
  
  this.deliverables = versionData.rates.deliverables;
  this.packages = versionData.rates.packages;
  await this.createVersion(`Restored from version ${versionNumber}`);
  
  logInfo('Rate card version restored', { 
    rateCardId: this._id, 
    restoredVersion: versionNumber 
  });
};

// Static methods
rateCardSchema.statics.findActiveByCreator = function(creatorId) {
  return this.find({
    creator: creatorId,
    status: 'active',
    isDeleted: false
  }).sort('-createdAt');
};

rateCardSchema.statics.getByShortCode = async function(shortCode) {
  const rateCard = await this.findOne({
    'sharing.shortCode': shortCode.toUpperCase(),
    status: 'active',
    isDeleted: false
  });
  
  if (rateCard && rateCard.sharing.expiresAt && rateCard.sharing.expiresAt < new Date()) {
    throw new Error('Rate card link has expired');
  }
  
  return rateCard;
};

const RateCard = mongoose.model('RateCard', rateCardSchema);

module.exports = RateCard;