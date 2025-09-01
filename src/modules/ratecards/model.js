/**
 * CreatorsMantra Backend - Rate Card Module
 * Professional rate card management with AI-assisted pricing
 * 
 * @author CreatorsMantra Team
 * @version 2.0.0
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

// ============================================
// RATE CARD SCHEMA - MAIN MODEL
// ============================================

const rateCardSchema = new mongoose.Schema({
  // ========== OWNERSHIP & ACCESS ==========
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Manager who created/last edited (if applicable)
  managedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ========== BASIC INFORMATION ==========
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
    default: 'My Rate Card'
  },

  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  // ========== CREATOR METRICS (MANUAL ENTRY) ==========
  metrics: {
    platforms: [{
      name: {
        type: String,
        required: true,
        enum: ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook'],
        index: true
      },
      
      metrics: {
        followers: {
          type: Number,
          required: true,
          min: [0, 'Followers cannot be negative'],
          max: [1000000000, 'Followers count seems unrealistic']
        },
        
        engagementRate: {
          type: Number,
          required: true,
          min: [0, 'Engagement rate cannot be negative'],
          max: [100, 'Engagement rate cannot exceed 100%']
        },
        
        avgViews: {
          type: Number,
          min: [0, 'Average views cannot be negative']
        },
        
        avgLikes: {
          type: Number,
          min: [0, 'Average likes cannot be negative']
        }
      },
      
      // When metrics were last updated
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Creator's niche/category
    niche: {
      type: String,
      required: true,
      enum: ['fashion', 'beauty', 'tech', 'finance', 'food', 'travel', 'home styling', 
             'lifestyle', 'fitness', 'gaming', 'education', 'entertainment',
             'business', 'health', 'parenting', 'sports', 'music', 'art', 'other'],
      index: true
    },
    
    // Location for regional pricing
    location: {
      city: {
        type: String,
        required: true,
        trim: true,
        maxlength: [50, 'City name cannot exceed 50 characters']
      },
      
      cityTier: {
        type: String,
        enum: ['metro', 'tier1', 'tier2', 'tier3'],
        required: true,
        default: 'tier1'
      },
      
      state: {
        type: String,
        trim: true,
        maxlength: [50, 'State name cannot exceed 50 characters']
      }
    },
    
    // Content languages offered
    languages: [{
      type: String,
      enum: ['english', 'hindi', 'tamil', 'telugu', 'bengali', 'marathi',
             'gujarati', 'kannada', 'malayalam', 'punjabi', 'other']
    }],
    
    // Years of experience
    experience: {
      type: String,
      enum: ['beginner', '1-2_years', '2-5_years', '5+_years'],
      default: 'beginner'
    }
  },

  // ========== PRICING STRUCTURE ==========
  pricing: {
    // Platform-specific deliverable rates
    deliverables: [{
      platform: {
        type: String,
        required: true,
        enum: ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook']
      },
      
      rates: [{
        type: {
          type: String,
          required: true
          // Instagram: reel, post, story, carousel, igtv, live
          // YouTube: video, short, community_post, live_stream
          // LinkedIn: post, article, video, newsletter
        },
        
        description: {
          type: String,
          maxlength: [200, 'Description cannot exceed 200 characters']
        },
        
        // AI suggested vs User final rates
        pricing: {
          aiSuggested: {
            type: Number,
            min: [0, 'Price cannot be negative']
          },
          
          userRate: {
            type: Number,
            required: true,
            min: [0, 'Price cannot be negative'],
            max: [10000000, 'Price cannot exceed ₹1 Cr']
          },
          
          // Market position indicator
          marketPosition: {
            type: String,
            enum: ['below_market', 'at_market', 'above_market', 'premium'],
            default: 'at_market'
          }
        },
        
        // Delivery commitments
        turnaroundTime: {
          value: {
            type: Number,
            default: 3,
            min: [1, 'Turnaround time must be at least 1 day']
          },
          unit: {
            type: String,
            enum: ['hours', 'days', 'weeks'],
            default: 'days'
          }
        },
        
        revisionsIncluded: {
          type: Number,
          default: 2,
          min: [0, 'Revisions cannot be negative'],
          max: [10, 'Maximum 10 revisions']
        }
      }]
    }],
    
    // Currency setting
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD']
    }
  },

  // ========== PACKAGES ==========
  packages: [{
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Package name cannot exceed 100 characters']
    },
    
    description: {
      type: String,
      maxlength: [500, 'Package description cannot exceed 500 characters']
    },
    
    // AI suggested vs User created
    isAISuggested: {
      type: Boolean,
      default: false
    },
    
    // Package components
    items: [{
      platform: {
        type: String,
        required: true,
        enum: ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook']
      },
      
      deliverableType: {
        type: String,
        required: true
      },
      
      quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity must be at least 1'],
        max: [100, 'Quantity cannot exceed 100']
      }
    }],
    
    // Pricing
    pricing: {
      individualTotal: {
        type: Number,
        required: true,
        min: [0, 'Total cannot be negative']
      },
      
      packagePrice: {
        type: Number,
        required: true,
        min: [0, 'Package price cannot be negative']
      },
      
      savings: {
        amount: {
          type: Number,
          default: 0
        },
        percentage: {
          type: Number,
          default: 0,
          min: [0, 'Savings cannot be negative'],
          max: [100, 'Savings cannot exceed 100%']
        }
      }
    },
    
    // Package validity
    validity: {
      value: {
        type: Number,
        default: 30
      },
      unit: {
        type: String,
        enum: ['days', 'weeks', 'months'],
        default: 'days'
      }
    },
    
    // Highlight popular packages
    isPopular: {
      type: Boolean,
      default: false
    }
  }],

  // ========== PROFESSIONAL DETAILS ==========
  professionalDetails: {
    // Payment terms
    paymentTerms: {
      type: {
        type: String,
        enum: ['100_advance', '50_50', '30_70', 'on_delivery', 'net_15', 'net_30', 'custom'],
        default: '50_50'
      },
      
      customTerms: {
        type: String,
        maxlength: [500, 'Custom terms cannot exceed 500 characters']
      }
    },
    
    // Usage rights
    usageRights: {
      duration: {
        type: String,
        enum: ['1_month', '3_months', '6_months', '1_year', 'perpetual', 'custom'],
        default: '3_months'
      },
      
      platforms: [{
        type: String,
        enum: ['owned_media', 'paid_media', 'all_digital', 'print', 'broadcast', 'all']
      }],
      
      geography: {
        type: String,
        enum: ['india', 'asia', 'global', 'custom'],
        default: 'india'
      },
      
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
    
    // Revision policy
    revisionPolicy: {
      type: String,
      maxlength: [500, 'Revision policy cannot exceed 500 characters']
    },
    
    // Cancellation terms
    cancellationTerms: {
      type: String,
      maxlength: [500, 'Cancellation terms cannot exceed 500 characters']
    },
    
    // Additional notes
    additionalNotes: {
      type: String,
      maxlength: [1000, 'Additional notes cannot exceed 1000 characters']
    }
  },

  // ========== PUBLIC SHARING ==========
  sharing: {
    isPublic: {
      type: Boolean,
      default: false,
      index: true
    },
    
    publicId: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      index: true
    },
    
    publicUrl: {
      type: String
    },
    
    qrCodeUrl: {
      type: String
    },
    
    // Share settings
    settings: {
      allowDownload: {
        type: Boolean,
        default: true
      },
      
      showContactForm: {
        type: Boolean,
        default: true
      },
      
      requirePassword: {
        type: Boolean,
        default: false
      },
      
      password: {
        type: String,
        select: false // Don't include in queries by default
      }
    },
    
    // Expiry
    expiresAt: {
      type: Date,
      index: true
    },
    
    // Analytics
    analytics: {
      totalViews: {
        type: Number,
        default: 0
      },
      
      uniqueViews: {
        type: Number,
        default: 0
      },
      
      downloads: {
        type: Number,
        default: 0
      },
      
      inquiries: {
        type: Number,
        default: 0
      },
      
      lastViewedAt: Date,
      
      viewLog: [{
        timestamp: Date,
        ipHash: String, // Hashed for privacy
        userAgent: String,
        referrer: String
      }]
    }
  },

  // ========== VERSION MANAGEMENT ==========
  version: {
    current: {
      type: Number,
      default: 1
    },
    
    status: {
      type: String,
      enum: ['draft', 'active', 'archived', 'expired'],
      default: 'draft',
      index: true
    },
    
    publishedAt: Date,
    
    archivedAt: Date
  },

  // ========== AI SUGGESTIONS METADATA ==========
  aiMetadata: {
    lastSuggestionDate: Date,
    
    suggestionVersion: String, // AI model version used
    
    confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    
    marketData: {
      averageRates: mongoose.Schema.Types.Mixed,
      competitorCount: Number,
      lastUpdated: Date
    },
    
    acceptanceRate: {
      type: Number,
      min: 0,
      max: 100
    }
  },

  // ========== SUBSCRIPTION CHECK ==========
  subscriptionTier: {
    type: String,
    enum: ['pro', 'elite', 'agency_starter', 'agency_pro'],
    required: true
  },

  // ========== SOFT DELETE ==========
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
// RATE CARD VERSION HISTORY SCHEMA
// ============================================

const rateCardHistorySchema = new mongoose.Schema({
  // Reference to main rate card
  rateCardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RateCard',
    required: true,
    index: true
  },
  
  // Version info
  version: {
    type: Number,
    required: true
  },
  
  // Who made the change
  editedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // What changed
  changeType: {
    type: String,
    enum: ['creation', 'metrics_update', 'pricing_change', 'package_update', 'terms_update', 'other'], // Added 'creation'
    required: true
  },
  
  changeSummary: {
    type: String,
    maxlength: [500, 'Change summary cannot exceed 500 characters']
  },
  
  // Snapshot of the rate card at this version
  snapshot: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

// ============================================
// INDEXES
// ============================================

// Compound indexes for common queries
rateCardSchema.index({ creatorId: 1, 'version.status': 1 });
rateCardSchema.index({ creatorId: 1, isDeleted: 1, createdAt: -1 });
rateCardSchema.index({ 'sharing.publicId': 1, 'sharing.isPublic': 1 });
rateCardSchema.index({ 'sharing.expiresAt': 1, 'version.status': 1 });

rateCardHistorySchema.index({ rateCardId: 1, version: -1 });
rateCardHistorySchema.index({ rateCardId: 1, createdAt: -1 });

// ============================================
// METHODS
// ============================================

// Generate unique public ID
rateCardSchema.methods.generatePublicId = async function() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let publicId;
  let isUnique = false;
  
  while (!isUnique) {
    publicId = '';
    for (let i = 0; i < 6; i++) {
      publicId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    const existing = await this.constructor.findOne({ 'sharing.publicId': publicId });
    if (!existing) {
      isUnique = true;
    }
  }
  
  this.sharing.publicId = publicId;
  this.sharing.publicUrl = `${process.env.BASE_URL || 'https://creatorsmantra.com'}/card/${publicId}`;
  
  return publicId;
};

// Calculate package savings
rateCardSchema.methods.calculatePackageSavings = function() {
  this.packages.forEach(package => {
    const { individualTotal, packagePrice } = package.pricing;
    
    if (individualTotal > 0) {
      package.pricing.savings.amount = individualTotal - packagePrice;
      package.pricing.savings.percentage = Math.round(
        ((individualTotal - packagePrice) / individualTotal) * 100
      );
    }
  });
};

// Track view
rateCardSchema.methods.trackView = async function(metadata = {}) {
  this.sharing.analytics.totalViews += 1;
  this.sharing.analytics.lastViewedAt = new Date();
  
  // Add to view log (keep last 100 entries)
  this.sharing.analytics.viewLog.push({
    timestamp: new Date(),
    ipHash: metadata.ipHash || null,
    userAgent: metadata.userAgent || null,
    referrer: metadata.referrer || null
  });
  
  if (this.sharing.analytics.viewLog.length > 100) {
    this.sharing.analytics.viewLog = this.sharing.analytics.viewLog.slice(-100);
  }
  
  await this.save();
};

// Create version snapshot
rateCardSchema.methods.createSnapshot = async function(changeType, changeSummary, editedBy) {
  const RateCardHistory = mongoose.model('RateCardHistory');
  
  const snapshot = {
    metrics: this.metrics,
    pricing: this.pricing,
    packages: this.packages,
    professionalDetails: this.professionalDetails
  };
  
  await RateCardHistory.create({
    rateCardId: this._id,
    version: this.version.current,
    editedBy,
    changeType,
    changeSummary,
    snapshot
  });
  
  this.version.current += 1;
};

// Check if expired
rateCardSchema.methods.isExpired = function() {
  if (!this.sharing.expiresAt) return false;
  return new Date() > this.sharing.expiresAt;
};

// ============================================
// VIRTUALS
// ============================================

// Total reach across platforms
rateCardSchema.virtual('totalReach').get(function() {
  return this.metrics.platforms.reduce((sum, platform) => {
    return sum + (platform.metrics.followers || 0);
  }, 0);
});

// Average engagement rate
rateCardSchema.virtual('avgEngagementRate').get(function() {
  if (!this.metrics.platforms.length) return 0;
  
  const totalEngagement = this.metrics.platforms.reduce((sum, platform) => {
    return sum + (platform.metrics.engagementRate || 0);
  }, 0);
  
  return Math.round((totalEngagement / this.metrics.platforms.length) * 100) / 100;
});

// Days since last update
rateCardSchema.virtual('daysSinceUpdate').get(function() {
  const lastUpdate = this.updatedAt || this.createdAt;
  const days = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
  return days;
});

// ============================================
// STATICS
// ============================================

// Find active rate cards for creator
rateCardSchema.statics.findActiveForCreator = function(creatorId) {
  return this.find({
    creatorId,
    'version.status': 'active',
    isDeleted: false
  }).sort('-createdAt');
};

// Find by public ID
rateCardSchema.statics.findByPublicId = function(publicId) {
  return this.findOne({
    'sharing.publicId': publicId.toUpperCase(),
    'sharing.isPublic': true,
    'version.status': 'active',
    isDeleted: false
  });
};

// Get market benchmarks
rateCardSchema.statics.getMarketBenchmarks = async function(niche, followerCount) {
  // This would typically query aggregated data
  // For now, return calculated benchmarks
  const benchmarks = {
    fashion: { base: 100, multiplier: 1.3 },
    tech: { base: 150, multiplier: 1.5 },
    food: { base: 80, multiplier: 1.1 },
    // ... other niches
  };
  
  const nicheBenchmark = benchmarks[niche] || { base: 100, multiplier: 1.0 };
  const followerMultiplier = Math.log10(Math.max(followerCount, 1000)) / 3;
  
  return {
    suggested: Math.round(nicheBenchmark.base * followerMultiplier * nicheBenchmark.multiplier),
    min: Math.round(nicheBenchmark.base * followerMultiplier * 0.7),
    max: Math.round(nicheBenchmark.base * followerMultiplier * 1.5)
  };
};

// ============================================
// EXPORTS
// ============================================

const RateCard = mongoose.model('RateCard', rateCardSchema);
const RateCardHistory = mongoose.model('RateCardHistory', rateCardHistorySchema);

module.exports = {
  RateCard,
  RateCardHistory
};