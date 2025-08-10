/**
 * CreatorsMantra Backend - User & Creator Management Models
 * Complete user authentication and profile management with creator-manager relationships
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encryptData, decryptData } = require('../../shared/utils');

// ============================================
// USER SCHEMA (Base Authentication)
// ============================================

const userSchema = new mongoose.Schema({
  // Basic Identity
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Full name must be at least 2 characters'],
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
  },
  
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please provide a valid Indian mobile number']
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include password in queries by default
  },
  
  // Profile Information
  profilePicture: {
    type: String, // S3 URL
    default: null
  },
  
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true; // Optional field
        const age = (Date.now() - value.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        return age >= 13 && age <= 100; // Age between 13-100 years
      },
      message: 'Invalid date of birth'
    }
  },
  
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    default: 'prefer_not_to_say'
  },
  
  // Address Information
  address: {
    street: {
      type: String,
      trim: true,
      maxlength: [200, 'Street address cannot exceed 200 characters']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [50, 'City name cannot exceed 50 characters']
    },
    state: {
      type: String,
      trim: true,
      maxlength: [50, 'State name cannot exceed 50 characters']
    },
    pincode: {
      type: String,
      match: [/^[1-9][0-9]{5}$/, 'Please provide a valid Indian pincode']
    },
    country: {
      type: String,
      default: 'India',
      trim: true
    }
  },
  
  // User Type and Role
  userType: {
    type: String,
    required: true,
    enum: ['creator', 'creator_with_manager'],
    default: 'creator'
  },
  
  role: {
    type: String,
    required: true,
    enum: ['creator', 'manager', 'admin'],
    default: 'creator'
  },
  
  // Account Status
  accountStatus: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending_verification'],
    default: 'pending_verification'
  },
  
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  
  // Subscription Information
  subscriptionTier: {
    type: String,
    enum: ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro'],
    default: 'starter'
  },
  
  subscriptionStatus: {
    type: String,
    enum: ['trial', 'active', 'expired', 'cancelled', 'suspended'],
    default: 'trial'
  },
  
  subscriptionStartDate: {
    type: Date,
    default: Date.now
  },
  
  subscriptionEndDate: {
    type: Date,
    default: function() {
      // 14-day trial period
      return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    }
  },
  
  // Security & Auth
  lastLogin: {
    type: Date,
    default: null
  },
  
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  lockUntil: {
    type: Date,
    default: null
  },
  
  resetPasswordToken: {
    type: String,
    default: null
  },
  
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  
  // OTP Management
  otpCode: {
    type: String,
    default: null
  },
  
  otpExpires: {
    type: Date,
    default: null
  },
  
  otpAttempts: {
    type: Number,
    default: 0
  },
  
  // Device Management
  activeDevices: [{
    deviceId: String,
    deviceName: String,
    lastUsed: Date,
    isActive: Boolean
  }],
  
  // Preferences
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    },
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'hi']
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// CREATOR PROFILE SCHEMA
// ============================================

const creatorProfileSchema = new mongoose.Schema({
  // Reference to User
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Creator Business Information
  creatorType: {
    type: String,
    enum: ['lifestyle', 'fashion', 'beauty', 'tech', 'food', 'travel', 'fitness', 'comedy', 'education', 'business', 'other'],
    required: [true, 'Creator type is required']
  },
  
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    trim: true
  },
  
  // Experience Level
  experienceLevel: {
    type: String,
    enum: ['beginner', '1-2_years', '2-5_years', '5+_years'],
    default: 'beginner'
  },
  
  // Social Media Profiles (Manual Entry)
  socialProfiles: {
    instagram: {
      username: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^[a-zA-Z0-9._]{1,30}$/, 'Invalid Instagram username format']
      },
      url: String,
      followersCount: {
        type: Number,
        default: 0,
        min: [0, 'Follower count cannot be negative']
      },
      avgLikes: {
        type: Number,
        default: 0,
        min: [0, 'Average likes cannot be negative']
      },
      avgComments: {
        type: Number,
        default: 0,
        min: [0, 'Average comments cannot be negative']
      },
      engagementRate: {
        type: Number,
        default: 0,
        min: [0, 'Engagement rate cannot be negative'],
        max: [100, 'Engagement rate cannot exceed 100%']
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    },
    
    youtube: {
      channelName: {
        type: String,
        trim: true,
        maxlength: [100, 'Channel name cannot exceed 100 characters']
      },
      url: String,
      subscribersCount: {
        type: Number,
        default: 0,
        min: [0, 'Subscriber count cannot be negative']
      },
      avgViews: {
        type: Number,
        default: 0,
        min: [0, 'Average views cannot be negative']
      },
      totalVideos: {
        type: Number,
        default: 0,
        min: [0, 'Total videos cannot be negative']
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    }
  },
  
  // Content Information
  contentCategories: [{
    type: String,
    enum: ['lifestyle', 'fashion', 'beauty', 'tech', 'food', 'travel', 'fitness', 'comedy', 'education', 'business']
  }],
  
  languages: [{
    type: String,
    enum: ['english', 'hindi', 'bengali', 'telugu', 'marathi', 'tamil', 'gujarati', 'kannada', 'malayalam', 'punjabi']
  }],
  
  targetAudience: {
    ageGroup: {
      type: String,
      enum: ['13-18', '18-25', '25-35', '35-45', '45+'],
      default: '18-25'
    },
    gender: {
      type: String,
      enum: ['male_majority', 'female_majority', 'balanced'],
      default: 'balanced'
    },
    geography: {
      type: String,
      enum: ['tier_1_cities', 'tier_2_cities', 'tier_3_cities', 'rural', 'mixed'],
      default: 'mixed'
    }
  },
  
  // Rate Card Information
  rateCard: {
    instagram: {
      post: {
        type: Number,
        default: 0,
        min: [0, 'Rate cannot be negative']
      },
      reel: {
        type: Number,
        default: 0,
        min: [0, 'Rate cannot be negative']
      },
      story: {
        type: Number,
        default: 0,
        min: [0, 'Rate cannot be negative']
      },
      igtv: {
        type: Number,
        default: 0,
        min: [0, 'Rate cannot be negative']
      }
    },
    youtube: {
      integration: {
        type: Number,
        default: 0,
        min: [0, 'Rate cannot be negative']
      },
      dedicated: {
        type: Number,
        default: 0,
        min: [0, 'Rate cannot be negative']
      },
      shorts: {
        type: Number,
        default: 0,
        min: [0, 'Rate cannot be negative']
      }
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Financial Information (Encrypted)
  bankDetails: {
    accountHolderName: {
      type: String,
      trim: true,
      maxlength: [100, 'Account holder name cannot exceed 100 characters']
    },
    accountNumber: {
      type: String,
      set: function(value) {
        return value ? encryptData(value) : value;
      },
      get: function(value) {
        return value ? decryptData(value) : value;
      }
    },
    ifscCode: {
      type: String,
      uppercase: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format']
    },
    bankName: {
      type: String,
      trim: true,
      maxlength: [100, 'Bank name cannot exceed 100 characters']
    }
  },
  
  upiDetails: {
    primaryUpi: {
      type: String,
      set: function(value) {
        return value ? encryptData(value) : value;
      },
      get: function(value) {
        return value ? decryptData(value) : value;
      }
    },
    secondaryUpi: {
      type: String,
      set: function(value) {
        return value ? encryptData(value) : value;
      },
      get: function(value) {
        return value ? decryptData(value) : value;
      }
    }
  },
  
  // GST & Tax Information
  gstDetails: {
    hasGst: {
      type: Boolean,
      default: false
    },
    gstNumber: {
      type: String,
      uppercase: true,
      match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format'],
      set: function(value) {
        return value ? encryptData(value) : value;
      },
      get: function(value) {
        return value ? decryptData(value) : value;
      }
    },
    businessName: {
      type: String,
      trim: true,
      maxlength: [200, 'Business name cannot exceed 200 characters']
    },
    businessType: {
      type: String,
      enum: ['individual', 'proprietorship', 'partnership', 'llp', 'pvt_ltd', 'public_ltd']
    }
  },
  
  panDetails: {
    panNumber: {
      type: String,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number format'],
      set: function(value) {
        return value ? encryptData(value) : value;
      },
      get: function(value) {
        return value ? decryptData(value) : value;
      }
    },
    panName: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: [100, 'PAN name cannot exceed 100 characters']
    }
  },
  
  // Manager Relationship (if userType is 'creator_with_manager')
  managers: [{
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    managerName: String,
    managerEmail: String,
    managerPhone: String,
    relationship: {
      type: String,
      enum: ['professional_manager', 'friend', 'family', 'agency_employee'],
      default: 'professional_manager'
    },
    permissions: {
      profile: {
        viewProfile: { type: Boolean, default: true },
        editBasicInfo: { type: Boolean, default: true },
        editSocialMedia: { type: Boolean, default: false },
        editBankDetails: { type: Boolean, default: false },
        editPersonalInfo: { type: Boolean, default: false }
      },
      deals: {
        viewDeals: { type: Boolean, default: true },
        createDeals: { type: Boolean, default: true },
        editDeals: { type: Boolean, default: true },
        deleteDeals: { type: Boolean, default: false },
        negotiateRates: { type: Boolean, default: true }
      },
      invoices: {
        viewInvoices: { type: Boolean, default: true },
        createInvoices: { type: Boolean, default: true },
        sendInvoices: { type: Boolean, default: true },
        receivePayments: { type: Boolean, default: false }
      },
      communication: {
        emailNotifications: { type: Boolean, default: true },
        brandCommunication: { type: Boolean, default: true },
        contractNegotiation: { type: Boolean, default: true }
      }
    },
    revenueShare: {
      type: Number,
      default: 0,
      min: [0, 'Revenue share cannot be negative'],
      max: [50, 'Revenue share cannot exceed 50%']
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'inactive', 'removed'],
      default: 'pending'
    },
    invitedAt: {
      type: Date,
      default: Date.now
    },
    acceptedAt: Date,
    lastActive: Date
  }],
  
  // Creator Statistics
  stats: {
    totalDeals: {
      type: Number,
      default: 0
    },
    completedDeals: {
      type: Number,
      default: 0
    },
    totalEarnings: {
      type: Number,
      default: 0
    },
    avgDealValue: {
      type: Number,
      default: 0
    },
    topBrands: [String],
    lastDealDate: Date
  },
  
  // Creator Preferences
  workPreferences: {
    availabilityStatus: {
      type: String,
      enum: ['open_for_collaborations', 'selective', 'not_available'],
      default: 'open_for_collaborations'
    },
    preferredBrands: [String],
    excludedBrands: [String],
    minimumBudget: {
      type: Number,
      default: 0
    },
    turnaroundTime: {
      type: Number, // in days
      default: 7
    },
    workingDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============================================
// SUBSCRIPTION HISTORY SCHEMA
// ============================================

const subscriptionHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  tier: {
    type: String,
    required: true,
    enum: ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro']
  },
  
  status: {
    type: String,
    required: true,
    enum: ['trial', 'active', 'expired', 'cancelled', 'suspended']
  },
  
  startDate: {
    type: Date,
    required: true
  },
  
  endDate: {
    type: Date,
    required: true
  },
  
  paymentAmount: {
    type: Number,
    required: true,
    min: [0, 'Payment amount cannot be negative']
  },
  
  paymentMethod: {
    type: String,
    enum: ['upi', 'bank_transfer', 'card', 'wallet'],
    default: 'upi'
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'verified', 'failed', 'refunded'],
    default: 'pending'
  },
  
  paymentReference: String,
  
  paymentScreenshot: String, // S3 URL for payment proof
  
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  verifiedAt: Date,
  
  notes: String,
  
  cancellationReason: String,
  
  refundAmount: {
    type: Number,
    default: 0
  },
  
  refundDate: Date
}, {
  timestamps: true
});

// ============================================
// USER SCHEMA INDEXES
// ============================================

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ subscriptionStatus: 1, subscriptionEndDate: 1 });
userSchema.index({ accountStatus: 1 });
userSchema.index({ createdAt: -1 });

// ============================================
// CREATOR PROFILE INDEXES
// ============================================

creatorProfileSchema.index({ userId: 1 }, { unique: true });
creatorProfileSchema.index({ creatorType: 1 });
creatorProfileSchema.index({ 'socialProfiles.instagram.followersCount': -1 });
creatorProfileSchema.index({ 'socialProfiles.youtube.subscribersCount': -1 });
creatorProfileSchema.index({ 'managers.managerId': 1 });

// ============================================
// SUBSCRIPTION HISTORY INDEXES
// ============================================

subscriptionHistorySchema.index({ userId: 1, createdAt: -1 });
subscriptionHistorySchema.index({ status: 1, endDate: 1 });
subscriptionHistorySchema.index({ paymentStatus: 1 });

// ============================================
// USER SCHEMA METHODS
// ============================================

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Check if user is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // If we've reached max attempts and it's not locked already, lock the account
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // Lock for 2 hours
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Check subscription status
userSchema.methods.hasActiveSubscription = function() {
  return this.subscriptionStatus === 'active' && this.subscriptionEndDate > new Date();
};

// Check subscription tier access
userSchema.methods.hasFeatureAccess = function(feature) {
  const tierFeatures = {
    starter: ['basic_crm', 'basic_invoicing', 'basic_performance'],
    pro: ['basic_crm', 'basic_invoicing', 'basic_performance', 'ai_pricing', 'ai_brief_analyzer'],
    elite: ['basic_crm', 'basic_invoicing', 'basic_performance', 'ai_pricing', 'ai_brief_analyzer', 'ai_contract_review', 'advanced_analytics'],
    agency_starter: ['all_creator_features', 'multi_creator_dashboard', 'consolidated_billing', 'creator_assignment'],
    agency_pro: ['all_features', 'advanced_workflows', 'white_label_reporting', 'api_access']
  };
  
  const userFeatures = tierFeatures[this.subscriptionTier] || [];
  return userFeatures.includes(feature) || userFeatures.includes('all_features') || userFeatures.includes('all_creator_features');
};

// ============================================
// CREATOR PROFILE METHODS
// ============================================

// Calculate engagement rate
creatorProfileSchema.methods.calculateEngagementRate = function(platform) {
  if (platform === 'instagram') {
    const { followersCount, avgLikes, avgComments } = this.socialProfiles.instagram;
    if (followersCount === 0) return 0;
    
    const engagements = avgLikes + avgComments;
    return Math.round((engagements / followersCount) * 100 * 100) / 100;
  }
  
  return 0;
};

// Get suggested rates based on followers
creatorProfileSchema.methods.getSuggestedRates = function() {
  const instagramFollowers = this.socialProfiles.instagram.followersCount || 0;
  const youtubeSubscribers = this.socialProfiles.youtube.subscribersCount || 0;
  
  // Base rate per 1000 followers/subscribers
  const baseRates = {
    instagram: {
      post: 100,    // ₹100 per 1K followers
      reel: 150,    // ₹150 per 1K followers
      story: 50     // ₹50 per 1K followers
    },
    youtube: {
      integration: 300,  // ₹300 per 1K subscribers
      dedicated: 500     // ₹500 per 1K subscribers
    }
  };
  
  // Engagement multiplier
  const engagementRate = this.calculateEngagementRate('instagram');
  const engagementMultiplier = engagementRate > 3 ? 1.2 : engagementRate > 1 ? 1.1 : 1.0;
  
  return {
    instagram: {
      post: Math.round((instagramFollowers / 1000) * baseRates.instagram.post * engagementMultiplier),
      reel: Math.round((instagramFollowers / 1000) * baseRates.instagram.reel * engagementMultiplier),
      story: Math.round((instagramFollowers / 1000) * baseRates.instagram.story * engagementMultiplier)
    },
    youtube: {
      integration: Math.round((youtubeSubscribers / 1000) * baseRates.youtube.integration),
      dedicated: Math.round((youtubeSubscribers / 1000) * baseRates.youtube.dedicated)
    }
  };
};

// Update social media stats
creatorProfileSchema.methods.updateSocialStats = function(platform, stats) {
  if (platform === 'instagram' && this.socialProfiles.instagram) {
    Object.assign(this.socialProfiles.instagram, {
      ...stats,
      lastUpdated: new Date()
    });
  } else if (platform === 'youtube' && this.socialProfiles.youtube) {
    Object.assign(this.socialProfiles.youtube, {
      ...stats,
      lastUpdated: new Date()
    });
  }
  
  // Recalculate engagement rate
  if (platform === 'instagram') {
    this.socialProfiles.instagram.engagementRate = this.calculateEngagementRate('instagram');
  }
  
  return this.save();
};

// ============================================
// VIRTUAL PROPERTIES
// ============================================

// User virtual: Full profile completion percentage
userSchema.virtual('profileCompletion').get(function() {
  let completed = 0;
  const total = 10;
  
  if (this.fullName) completed++;
  if (this.email) completed++;
  if (this.phone) completed++;
  if (this.profilePicture) completed++;
  if (this.dateOfBirth) completed++;
  if (this.address && this.address.city) completed++;
  if (this.isEmailVerified) completed++;
  if (this.isPhoneVerified) completed++;
  
  return Math.round((completed / total) * 100);
});

// Creator profile virtual: Social media presence score
creatorProfileSchema.virtual('socialPresenceScore').get(function() {
  let score = 0;
  
  // Instagram scoring
  if (this.socialProfiles.instagram.username) score += 20;
  if (this.socialProfiles.instagram.followersCount > 1000) score += 15;
  if (this.socialProfiles.instagram.engagementRate > 1) score += 15;
  
  // YouTube scoring
  if (this.socialProfiles.youtube.channelName) score += 20;
  if (this.socialProfiles.youtube.subscribersCount > 1000) score += 15;
  
  // Content categories
  if (this.contentCategories.length > 0) score += 15;
  
  return Math.min(score, 100);
});

// ============================================
// STATIC METHODS
// ============================================

// Find user by email or phone
userSchema.statics.findByEmailOrPhone = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { phone: identifier }
    ]
  });
};

// Get subscription tier limits
userSchema.statics.getSubscriptionLimits = function(tier) {
  const limits = {
    starter: {
      maxActiveDeals: 10,
      maxInvoicesPerMonth: 20,
      maxUsers: 1,
      features: ['basic_crm', 'basic_invoicing', 'basic_performance']
    },
    pro: {
      maxActiveDeals: 25,
      maxInvoicesPerMonth: -1, // unlimited
      maxUsers: 1,
      features: ['basic_crm', 'basic_invoicing', 'basic_performance', 'ai_pricing', 'ai_brief_analyzer']
    },
    elite: {
      maxActiveDeals: 50,
      maxInvoicesPerMonth: -1,
      maxUsers: 2,
      features: ['basic_crm', 'basic_invoicing', 'basic_performance', 'ai_pricing', 'ai_brief_analyzer', 'ai_contract_review', 'advanced_analytics']
    },
    agency_starter: {
      maxActiveDeals: -1,
      maxInvoicesPerMonth: -1,
      maxUsers: 2,
      maxCreators: 8,
      features: ['all_creator_features', 'multi_creator_dashboard', 'consolidated_billing', 'creator_assignment']
    },
    agency_pro: {
      maxActiveDeals: -1,
      maxInvoicesPerMonth: -1,
      maxUsers: 5,
      maxCreators: 25,
      features: ['all_features', 'advanced_workflows', 'white_label_reporting', 'api_access']
    }
  };
  
  return limits[tier] || limits.starter;
};

// ============================================
// EXPORT MODELS
// ============================================

const User = mongoose.model('User', userSchema);
const CreatorProfile = mongoose.model('CreatorProfile', creatorProfileSchema);
const SubscriptionHistory = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);

module.exports = {
  User,
  CreatorProfile,
  SubscriptionHistory
};