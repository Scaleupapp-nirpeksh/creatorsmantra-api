//src/modules/scripts/model.js
/**
 * CreatorsMantra Backend - Content Script Generator Model
 * MongoDB schema for content script generation and management
 * 
 * @author CreatorsMantra Team
 * @version 2.0.0
 * @description Script generation model for content creators
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ============================================
// SCRIPT SCHEMA
// ============================================

const scriptSchema = new Schema({
  // ========== OWNERSHIP & IDENTIFICATION ==========
  scriptId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Script title cannot exceed 200 characters']
  },
  
  // ========== INPUT SOURCE ==========
  inputType: {
    type: String,
    enum: ['text_brief', 'file_upload', 'video_transcription'],
    required: true,
    index: true
  },
  
  // Original content input
  originalContent: {
    briefText: {
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
    },
    
    // Video transcription details (if applicable)
    videoFile: {
      filename: { type: String },
      originalName: { type: String },
      fileSize: { type: Number },
      mimeType: { type: String },
      uploadPath: { type: String },
      duration: { type: Number }, // in seconds
      uploadedAt: { type: Date }
    },
    
    // Transcription results
    transcription: {
      originalText: { type: String, maxlength: 100000 },
      cleanedText: { type: String, maxlength: 100000 },
      speakerCount: { type: Number, default: 1 },
      language: { type: String, default: 'en' },
      confidence: { type: Number, min: 0, max: 1 },
      processingTime: { type: Number }, // milliseconds
      transcribedAt: { type: Date }
    }
  },
  
  // Creator's style and preferences
  creatorStyleNotes: {
    type: String,
    maxlength: 2000,
    trim: true
  },
  
  // ========== SCRIPT CONFIGURATION ==========
  platform: {
    type: String,
    required: true,
    enum: [
      'instagram_reel',
      'instagram_post', 
      'instagram_story',
      'youtube_video',
      'youtube_shorts',
      'linkedin_video',
      'linkedin_post',
      'twitter_post',
      'facebook_reel',
      'tiktok_video'
    ],
    index: true
  },
  
  granularityLevel: {
    type: String,
    required: true,
    enum: ['basic', 'detailed', 'comprehensive'],
    default: 'detailed'
  },
  
  targetDuration: {
    type: String,
    enum: ['15_seconds', '30_seconds', '60_seconds', '90_seconds', '3_minutes', '5_minutes', '10_minutes', 'custom'],
    default: '60_seconds'
  },
  
  customDuration: {
    type: Number, // in seconds for custom duration
    min: 5,
    max: 3600 // 1 hour max
  },
  
  // ========== AI GENERATION RESULTS ==========
  aiGeneration: {
    // Processing status
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true
    },
    
    // Core script content
    generatedScript: {
      // Opening hook (critical first few seconds)
      hook: {
        text: { type: String, maxlength: 500 },
        visualCue: { type: String, maxlength: 300 },
        duration: { type: String, default: '0-3 seconds' },
        notes: { type: String, maxlength: 200 }
      },
      
      // Main content scenes
      scenes: [{
        sceneNumber: {
          type: Number,
          required: true,
          min: 1
        },
        title: {
          type: String,
          maxlength: 100
        },
        timeframe: {
          type: String, // "3-15 seconds", "15-30 seconds"
          maxlength: 50
        },
        dialogue: {
          type: String,
          maxlength: 1000
        },
        visualDescription: {
          type: String,
          maxlength: 500
        },
        cameraAngle: {
          type: String,
          maxlength: 100
        },
        lighting: {
          type: String,
          maxlength: 100
        },
        props: [{ 
          type: String, 
          maxlength: 50 
        }],
        transitions: {
          type: String,
          maxlength: 200
        },
        notes: {
          type: String,
          maxlength: 300
        }
      }],
      
      // Brand integration points
      brandMentions: [{
        timing: { type: String, maxlength: 50 }, // "at 15 seconds"
        type: { 
          type: String, 
          enum: ['natural_mention', 'product_showcase', 'logo_display', 'verbal_cta'] 
        },
        content: { type: String, maxlength: 300 },
        duration: { type: String, maxlength: 50 },
        placement: { 
          type: String, 
          enum: ['background', 'foreground', 'overlay', 'verbal'] 
        }
      }],
      
      // Call to action
      callToAction: {
        primary: {
          type: String,
          maxlength: 200
        },
        secondary: {
          type: String,
          maxlength: 200
        },
        placement: {
          type: String,
          enum: ['beginning', 'middle', 'end', 'throughout'],
          default: 'end'
        },
        visualTreatment: {
          type: String,
          maxlength: 200
        }
      },
      
      // Social media elements
      hashtags: {
        primary: [{ 
          type: String, 
          maxlength: 50 
        }],
        secondary: [{ 
          type: String, 
          maxlength: 50 
        }],
        trending: [{ 
          type: String, 
          maxlength: 50 
        }]
      },
      
      mentions: [{
        handle: { type: String, maxlength: 50 },
        purpose: { type: String, maxlength: 100 },
        timing: { type: String, maxlength: 50 }
      }],
      
      // Music and audio
      audioSuggestions: {
        musicStyle: { type: String, maxlength: 100 },
        trendingAudio: { type: String, maxlength: 100 },
        voiceoverNotes: { type: String, maxlength: 300 },
        soundEffects: [{ type: String, maxlength: 100 }]
      },
      
      // Additional content elements
      textOverlays: [{
        text: { type: String, maxlength: 100 },
        timing: { type: String, maxlength: 50 },
        style: { type: String, maxlength: 100 },
        position: { type: String, maxlength: 50 }
      }],
      
      // Alternative endings or variations
      alternativeEndings: [{
        description: { type: String, maxlength: 200 },
        content: { type: String, maxlength: 500 },
        useCase: { type: String, maxlength: 100 }
      }]
    },
    
    // A/B Testing Variations
    scriptVariations: {
        type: [{
          variationType: {
            type: String,
            enum: ['hook_variation', 'cta_variation', 'scene_order', 'brand_integration', 'ending_variation'],
            required: true
          },
          title: { type: String, maxlength: 100 },
          description: { type: String, maxlength: 300 },
          changes: {
            type: Schema.Types.Mixed
          },
          createdAt: { type: Date, default: Date.now },
          selected: { type: Boolean, default: false }
        }],
        default: [] // Add this default
      },
    
    // Trend Integration Data
    trendIntegration: {
      trendingHashtags: [{
        hashtag: { type: String, maxlength: 50 },
        trendScore: { type: Number, min: 0, max: 100 },
        platform: { type: String },
        category: { type: String, maxlength: 50 }
      }],
      trendingAudio: [{
        title: { type: String, maxlength: 100 },
        artist: { type: String, maxlength: 100 },
        platform: { type: String },
        usage: { type: String, maxlength: 200 }
      }],
      viralElements: [{
        element: { type: String, maxlength: 100 },
        description: { type: String, maxlength: 300 },
        howToUse: { type: String, maxlength: 300 }
      }],
      lastUpdated: { type: Date, default: Date.now }
    },
    
    // AI Processing metadata
    processingMetadata: {
      modelUsed: { type: String, default: 'gpt-4' },
      tokensUsed: { type: Number },
      processingTime: { type: Number }, // in milliseconds
      confidenceScore: { type: Number, min: 0, max: 100 },
      generationVersion: { type: String, default: '2.0' },
      temperature: { type: Number, default: 0.7 },
      retryCount: { type: Number, default: 0 },
      lastError: { type: String }
    }
  },
  
  // ========== DEAL INTEGRATION ==========
  dealConnection: {
    isLinked: { type: Boolean, default: false },
    dealId: {
      type: Schema.Types.ObjectId,
      ref: 'Deal',
      sparse: true
    },
    dealTitle: { type: String, maxlength: 200 },
    brandName: { type: String, maxlength: 100 },
    linkedAt: { type: Date },
    linkedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // ========== SCRIPT STATUS ==========
  status: {
    type: String,
    enum: ['draft', 'generated', 'reviewed', 'approved', 'in_production', 'completed'],
    default: 'draft',
    index: true
  },
  
  // Tags for organization
  tags: [{
    type: String,
    maxlength: 30,
    trim: true
  }],
  
  // Creator notes and feedback
  creatorNotes: {
    type: String,
    maxlength: 2000
  },
  
  // Script feedback and improvements
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: { type: String, maxlength: 1000 },
    improvements: [{ type: String, maxlength: 300 }],
    submittedAt: { type: Date }
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
  },
  
  // Script usage tracking
  usageStats: {
    timesGenerated: { type: Number, default: 1 },
    variationsCreated: { type: Number, default: 0 },
    lastUsed: { type: Date, default: Date.now },
    avgProcessingTime: { type: Number }, // milliseconds
    successfulGenerations: { type: Number, default: 0 },
    failedGenerations: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  collection: 'scripts'
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

// Compound indexes for common queries
scriptSchema.index({ userId: 1, status: 1, createdAt: -1 });
scriptSchema.index({ userId: 1, platform: 1, createdAt: -1 });
scriptSchema.index({ userId: 1, 'aiGeneration.status': 1 });
scriptSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
scriptSchema.index({ subscriptionTier: 1, createdAt: -1 });
scriptSchema.index({ 'dealConnection.dealId': 1 });
scriptSchema.index({ 'dealConnection.brandName': 1, userId: 1 });

// Text search index
scriptSchema.index({
  title: 'text',
  'originalContent.briefText': 'text',
  creatorStyleNotes: 'text',
  'aiGeneration.generatedScript.scenes.dialogue': 'text',
  creatorNotes: 'text'
});

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

// Generate script ID before saving
scriptSchema.pre('save', async function(next) {
  if (this.isNew && !this.scriptId) {
    try {
      const User = require('../auth/model').User;
      const user = await User.findById(this.userId);
      
      if (user) {
        const year = new Date().getFullYear().toString().slice(-2);
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        
        // Get sequence number for this creator this month
        const scriptCount = await mongoose.model('Script').countDocuments({
          userId: this.userId,
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
          }
        });
        
        const sequence = String(scriptCount + 1).padStart(3, '0');
        const userPrefix = user.fullName ? user.fullName.substring(0, 3).toUpperCase() : 'USR';
        this.scriptId = `${userPrefix}${year}${month}S${sequence}`;
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Update lastProcessedAt when AI generation is completed
scriptSchema.pre('save', function(next) {
  if (this.isModified('aiGeneration') && this.aiGeneration.status === 'completed') {
    this.lastProcessedAt = new Date();
    this.usageStats.successfulGenerations += 1;
  }
  
  if (this.isModified('aiGeneration') && this.aiGeneration.status === 'failed') {
    this.usageStats.failedGenerations += 1;
  }
  
  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

// Check if script generation is complete
scriptSchema.methods.isGenerationComplete = function() {
  return this.aiGeneration.status === 'completed' && 
         this.aiGeneration.generatedScript &&
         this.aiGeneration.generatedScript.scenes &&
         this.aiGeneration.generatedScript.scenes.length > 0;
};

// Get estimated script duration
scriptSchema.methods.getEstimatedDuration = function() {
  if (this.customDuration) return this.customDuration;
  
  const durationMap = {
    '15_seconds': 15,
    '30_seconds': 30,
    '60_seconds': 60,
    '90_seconds': 90,
    '3_minutes': 180,
    '5_minutes': 300,
    '10_minutes': 600
  };
  
  return durationMap[this.targetDuration] || 60;
};

// Calculate script complexity score
scriptSchema.methods.getComplexityScore = function() {
  if (!this.isGenerationComplete()) return 0;
  
  let score = 0;
  const script = this.aiGeneration.generatedScript;
  
  // Base score from scenes
  score += script.scenes.length * 10;
  
  // Brand mentions complexity
  score += script.brandMentions.length * 5;
  
  // Visual elements
  if (script.textOverlays) score += script.textOverlays.length * 3;
  if (script.audioSuggestions) score += 10;
  
  // Variations
  score += this.aiGeneration.scriptVariations.length * 15;
  
  return Math.min(score, 100);
};

// Get platform-specific requirements
scriptSchema.methods.getPlatformRequirements = function() {
  const requirements = {
    'instagram_reel': {
      maxDuration: 90,
      aspectRatio: '9:16',
      resolution: '1080x1920',
      features: ['music', 'effects', 'text_overlay']
    },
    'instagram_post': {
      maxDuration: 0, // static post
      aspectRatio: '1:1',
      resolution: '1080x1080',
      features: ['carousel', 'single_image']
    },
    'youtube_video': {
      maxDuration: 3600, // 1 hour
      aspectRatio: '16:9',
      resolution: '1920x1080',
      features: ['intro', 'outro', 'chapters', 'end_screen']
    },
    'youtube_shorts': {
      maxDuration: 60,
      aspectRatio: '9:16',
      resolution: '1080x1920',
      features: ['music', 'effects', 'quick_cuts']
    },
    'linkedin_video': {
      maxDuration: 600, // 10 minutes
      aspectRatio: '16:9',
      resolution: '1920x1080',
      features: ['professional_tone', 'captions', 'cta']
    }
  };
  
  return requirements[this.platform] || requirements['instagram_reel'];
};

// Check if ready for production
scriptSchema.methods.isReadyForProduction = function() {
  return this.isGenerationComplete() && 
         this.status === 'approved' &&
         this.dealConnection.isLinked;
};

// Get days since script creation
scriptSchema.methods.getDaysOld = function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (24 * 60 * 60 * 1000));
};

// ============================================
// VIRTUAL FIELDS
// ============================================

// Virtual: Script age in human readable format
scriptSchema.virtual('scriptAge').get(function() {
  const days = this.getDaysOld();
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
});

// Virtual: Total scenes count
scriptSchema.virtual('totalScenes').get(function() {
  return this.aiGeneration?.generatedScript?.scenes?.length || 0;
});

// Virtual: Generation success rate
scriptSchema.virtual('generationSuccessRate').get(function() {
  const total = this.usageStats.successfulGenerations + this.usageStats.failedGenerations;
  if (total === 0) return 100;
  return Math.round((this.usageStats.successfulGenerations / total) * 100);
});

// ============================================
// STATIC METHODS
// ============================================

// Get scripts by status for a user
scriptSchema.statics.getByStatus = function(userId, status) {
  return this.find({
    userId,
    status,
    isDeleted: false
  }).sort({ createdAt: -1 });
};

// Get subscription tier limits for script generation
scriptSchema.statics.getSubscriptionLimits = function(tier) {
  const limits = {
    starter: {
      maxScriptsPerMonth: 10,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      videoTranscription: false,
      abTesting: false,
      trendIntegration: false
    },
    pro: {
      maxScriptsPerMonth: 25,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      videoTranscription: true,
      maxVideoSize: 25 * 1024 * 1024, // 25MB
      maxVideosPerMonth: 10,
      abTesting: true,
      trendIntegration: true
    },
    elite: {
      maxScriptsPerMonth: -1, // unlimited
      maxFileSize: 25 * 1024 * 1024, // 25MB
      videoTranscription: true,
      maxVideoSize: 100 * 1024 * 1024, // 100MB
      maxVideosPerMonth: -1, // unlimited
      abTesting: true,
      trendIntegration: true,
      advancedFeatures: true
    },
    agency_starter: {
      maxScriptsPerMonth: -1,
      maxFileSize: 25 * 1024 * 1024,
      videoTranscription: true,
      maxVideoSize: 100 * 1024 * 1024,
      maxVideosPerMonth: -1,
      abTesting: true,
      trendIntegration: true,
      advancedFeatures: true
    },
    agency_pro: {
      maxScriptsPerMonth: -1,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      videoTranscription: true,
      maxVideoSize: 200 * 1024 * 1024, // 200MB
      maxVideosPerMonth: -1,
      abTesting: true,
      trendIntegration: true,
      advancedFeatures: true,
      bulkOperations: true
    }
  };
  
  return limits[tier] || limits.starter;
};

// Find scripts needing attention
scriptSchema.statics.findScriptsNeedingAttention = function(userId) {
  return this.find({
    userId,
    isDeleted: false,
    $or: [
      // Failed generations
      { 'aiGeneration.status': 'failed' },
      // Scripts in processing for too long
      { 
        'aiGeneration.status': 'processing',
        updatedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } // 10 minutes ago
      },
      // Scripts ready for review
      { status: 'generated' }
    ]
  }).sort({ updatedAt: -1 });
};

// ============================================
// EXPORT MODEL
// ============================================

const Script = mongoose.model('Script', scriptSchema);

module.exports = {
  Script,
  scriptSchema
};