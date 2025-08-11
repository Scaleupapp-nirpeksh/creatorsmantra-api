/**
 * CreatorsMantra Backend - Contract Upload & AI Review Module
 * MongoDB schemas for contract storage, AI analysis, and negotiation tracking
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * 
 * File Path: src/modules/contracts/model.js
 */

const mongoose = require('mongoose');
const { logInfo, logError } = require('../../shared/utils');

// ================================
// CONTRACT SCHEMA (Main Document)
// ================================
const contractSchema = new mongoose.Schema({
  // Basic Contract Information
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    default: function() {
      return `${this.brandName || 'Brand'} Contract - ${new Date().toLocaleDateString('en-IN')}`;
    }
  },
  
  brandName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  
  brandEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  // Contract Document Details
  contractFile: {
    originalName: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true,
      max: 26214400 // 25MB limit
    },
    mimeType: {
      type: String,
      required: true,
      enum: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // Extracted Contract Text
  extractedText: {
    type: String,
    default: ''
  },
  
  // Contract Financial Details
  contractValue: {
    amount: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR']
    }
  },
  
  // Contract Status & Lifecycle
  status: {
    type: String,
    enum: ['uploaded', 'analyzing', 'analyzed', 'under_negotiation', 'finalized', 'signed', 'rejected'],
    default: 'uploaded',
    index: true
  },
  
  // AI Analysis Reference
  analysisId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractAnalysis'
  },
  
  // Deal Integration
  dealId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal'
  },
  
  // Contract Metadata
  contractType: {
    type: String,
    enum: ['collaboration', 'sponsorship', 'partnership', 'licensing', 'employment', 'other'],
    default: 'collaboration'
  },
  
  platforms: [{
    type: String,
    enum: ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'tiktok', 'snapchat', 'other']
  }],
  
  // Version Control
  version: {
    type: Number,
    default: 1
  },
  
  parentContractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract'
  },
  
  // Tags and Categories
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  // Privacy and Access
  isPrivate: {
    type: Boolean,
    default: true
  },
  
  sharedWith: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['view', 'edit', 'admin'],
      default: 'view'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Notes and Comments
  notes: {
    type: String,
    maxlength: 2000
  },
  
  // System Fields
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'contracts'
});

// ================================
// CONTRACT ANALYSIS SCHEMA (AI Results)
// ================================
const contractAnalysisSchema = new mongoose.Schema({
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: true,
    index: true
  },
  
  // Overall Risk Assessment
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  
  // Detailed Analysis Results
  clauseAnalysis: {
    paymentTerms: {
      detected: { type: Boolean, default: false },
      content: { type: String },
      riskLevel: { type: String, enum: ['safe', 'caution', 'risky'], default: 'safe' },
      recommendation: { type: String },
      paymentDays: { type: Number },
      paymentMethod: { type: String }
    },
    
    usageRights: {
      detected: { type: Boolean, default: false },
      content: { type: String },
      riskLevel: { type: String, enum: ['safe', 'caution', 'risky'], default: 'safe' },
      recommendation: { type: String },
      duration: { type: String },
      scope: [{ type: String }],
      exclusivity: { type: Boolean, default: false }
    },
    
    deliverables: {
      detected: { type: Boolean, default: false },
      content: { type: String },
      riskLevel: { type: String, enum: ['safe', 'caution', 'risky'], default: 'safe' },
      recommendation: { type: String },
      items: [{ 
        type: { type: String },
        quantity: { type: Number },
        deadline: { type: String }
      }]
    },
    
    exclusivityClause: {
      detected: { type: Boolean, default: false },
      content: { type: String },
      riskLevel: { type: String, enum: ['safe', 'caution', 'risky'], default: 'safe' },
      recommendation: { type: String },
      duration: { type: String },
      scope: [{ type: String }],
      competitors: [{ type: String }]
    },
    
    penaltyClauses: {
      detected: { type: Boolean, default: false },
      content: { type: String },
      riskLevel: { type: String, enum: ['safe', 'caution', 'risky'], default: 'safe' },
      recommendation: { type: String },
      penalties: [{ 
        condition: { type: String },
        penalty: { type: String },
        amount: { type: Number }
      }]
    },
    
    terminationClause: {
      detected: { type: Boolean, default: false },
      content: { type: String },
      riskLevel: { type: String, enum: ['safe', 'caution', 'risky'], default: 'safe' },
      recommendation: { type: String },
      noticePeriod: { type: String },
      conditions: [{ type: String }]
    },
    
    intellectualProperty: {
      detected: { type: Boolean, default: false },
      content: { type: String },
      riskLevel: { type: String, enum: ['safe', 'caution', 'risky'], default: 'safe' },
      recommendation: { type: String },
      ownership: { type: String },
      licenseType: { type: String }
    }
  },
  
  // Missing Important Clauses
  missingClauses: [{
    clauseType: {
      type: String,
      enum: ['payment_terms', 'usage_rights', 'deliverables', 'termination', 'liability', 'force_majeure']
    },
    importance: {
      type: String,
      enum: ['critical', 'important', 'recommended'],
      default: 'important'
    },
    suggestion: { type: String }
  }],
  
  // Red Flags Detected
  redFlags: [{
    type: {
      type: String,
      enum: ['unlimited_usage', 'long_exclusivity', 'harsh_penalties', 'vague_deliverables', 'late_payment', 'unfair_termination']
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    description: { type: String },
    recommendation: { type: String },
    location: { type: String } // Where in contract this was found
  }],
  
  // AI Generated Summary
  summary: {
    type: String,
    maxlength: 1000
  },
  
  // Recommendations
  overallRecommendation: {
    action: {
      type: String,
      enum: ['sign_as_is', 'negotiate_minor', 'negotiate_major', 'reject'],
      required: true
    },
    reasoning: { type: String },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
  },
  
  // Market Comparison
  marketComparison: {
    paymentTermsRank: { type: String, enum: ['above_average', 'average', 'below_average'] },
    usageRightsRank: { type: String, enum: ['creator_friendly', 'standard', 'brand_heavy'] },
    exclusivityRank: { type: String, enum: ['reasonable', 'standard', 'excessive'] },
    overallRank: { type: String, enum: ['excellent', 'good', 'fair', 'poor'] }
  },
  
  // Analysis Metadata
  aiModel: {
    type: String,
    default: 'gpt-4'
  },
  
  processingTime: {
    type: Number, // in milliseconds
    default: 0
  },
  
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 85
  },
  
  analyzedAt: {
    type: Date,
    default: Date.now
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'contract_analyses'
});

// ================================
// NEGOTIATION HISTORY SCHEMA
// ================================
const negotiationHistorySchema = new mongoose.Schema({
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: true,
    index: true
  },
  
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Negotiation Details
  negotiationRound: {
    type: Number,
    default: 1,
    min: 1
  },
  
  negotiationPoints: [{
    clauseType: {
      type: String,
      enum: ['payment_terms', 'usage_rights', 'deliverables', 'exclusivity', 'penalties', 'termination', 'other']
    },
    originalClause: { type: String },
    proposedChange: { type: String },
    reasoning: { type: String },
    priority: { type: String, enum: ['must_have', 'important', 'nice_to_have'], default: 'important' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'counter_offered'], default: 'pending' }
  }],
  
  // Communication
  emailTemplate: {
    subject: { type: String },
    body: { type: String },
    tone: { type: String, enum: ['professional', 'friendly', 'assertive'], default: 'professional' }
  },
  
  emailSent: {
    type: Boolean,
    default: false
  },
  
  sentAt: { type: Date },
  
  // Brand Response
  brandResponse: {
    received: { type: Boolean, default: false },
    responseDate: { type: Date },
    responseType: { type: String, enum: ['full_acceptance', 'partial_acceptance', 'counter_offer', 'rejection'] },
    responseNotes: { type: String },
    attachments: [{
      fileName: { type: String },
      fileUrl: { type: String }
    }]
  },
  
  // Outcome
  outcome: {
    status: { type: String, enum: ['in_progress', 'successful', 'failed', 'abandoned'], default: 'in_progress' },
    finalTerms: { type: String },
    valueImpact: { 
      type: Number, // Positive/negative impact on deal value
      default: 0
    },
    lessonLearned: { type: String }
  },
  
  // System Fields
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'negotiation_histories'
});

// ================================
// CONTRACT TEMPLATE SCHEMA
// ================================
const contractTemplateSchema = new mongoose.Schema({
  // Template Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  description: {
    type: String,
    maxlength: 500
  },
  
  category: {
    type: String,
    enum: ['collaboration', 'sponsorship', 'licensing', 'employment', 'general'],
    required: true
  },
  
  // Template Content
  clauses: [{
    clauseType: {
      type: String,
      enum: ['payment_terms', 'usage_rights', 'deliverables', 'exclusivity', 'termination', 'liability', 'other']
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    isCreatorFriendly: { type: Boolean, default: true },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    explanation: { type: String },
    alternatives: [{ type: String }]
  }],
  
  // Template Metadata
  isPublic: {
    type: Boolean,
    default: false
  },
  
  createdBy: {
    type: String,
    enum: ['system', 'legal_team', 'community'],
    default: 'system'
  },
  
  usageCount: {
    type: Number,
    default: 0
  },
  
  successRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Industry Specific
  targetIndustries: [{
    type: String,
    enum: ['fashion', 'beauty', 'tech', 'food', 'travel', 'fitness', 'gaming', 'lifestyle', 'education', 'other']
  }],
  
  targetPlatforms: [{
    type: String,
    enum: ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'tiktok', 'other']
  }],
  
  creatorSizeRange: {
    min: { type: Number, default: 1000 },
    max: { type: Number, default: 1000000 }
  },
  
  // System Fields
  isActive: {
    type: Boolean,
    default: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'contract_templates'
});

// ================================
// INDEXES FOR PERFORMANCE
// ================================

// Contract Indexes
contractSchema.index({ creatorId: 1, status: 1 });
contractSchema.index({ brandName: 1, creatorId: 1 });
contractSchema.index({ createdAt: -1 });
contractSchema.index({ status: 1, createdAt: -1 });
contractSchema.index({ tags: 1 });

// Analysis Indexes
contractAnalysisSchema.index({ contractId: 1 });
contractAnalysisSchema.index({ riskLevel: 1 });
contractAnalysisSchema.index({ analyzedAt: -1 });

// Negotiation Indexes
negotiationHistorySchema.index({ contractId: 1, negotiationRound: 1 });
negotiationHistorySchema.index({ creatorId: 1, createdAt: -1 });

// Template Indexes
contractTemplateSchema.index({ category: 1, isActive: 1 });
contractTemplateSchema.index({ targetIndustries: 1 });

// ================================
// SCHEMA METHODS
// ================================

// Contract Methods
contractSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  this.updatedAt = new Date();
  logInfo('Contract status updated', { 
    contractId: this._id, 
    oldStatus: this.status, 
    newStatus 
  });
  return this.save();
};

contractSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
    return this.save();
  }
  return this;
};

contractSchema.methods.getAnalysisSummary = function() {
  if (!this.analysisId) return null;
  return this.model('ContractAnalysis').findById(this.analysisId);
};

// Analysis Methods
contractAnalysisSchema.methods.calculateRiskScore = function() {
  let riskScore = 0;
  let totalClauses = 0;
  
  // Calculate based on clause risk levels
  Object.values(this.clauseAnalysis).forEach(clause => {
    if (clause.detected) {
      totalClauses++;
      switch(clause.riskLevel) {
        case 'risky': riskScore += 30; break;
        case 'caution': riskScore += 15; break;
        case 'safe': riskScore += 5; break;
      }
    }
  });
  
  // Add red flag penalties
  this.redFlags.forEach(flag => {
    switch(flag.severity) {
      case 'critical': riskScore += 25; break;
      case 'high': riskScore += 15; break;
      case 'medium': riskScore += 10; break;
      case 'low': riskScore += 5; break;
    }
  });
  
  // Normalize score
  this.riskScore = Math.min(100, Math.max(0, riskScore));
  
  // Set risk level
  if (this.riskScore <= 30) this.riskLevel = 'low';
  else if (this.riskScore <= 60) this.riskLevel = 'medium';
  else if (this.riskScore <= 80) this.riskLevel = 'high';
  else this.riskLevel = 'critical';
  
  return this.riskScore;
};

// ================================
// MIDDLEWARE
// ================================

// Pre-save middleware for contracts
contractSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Post-save middleware for logging
contractSchema.post('save', function(doc) {
  logInfo('Contract saved', { 
    contractId: doc._id, 
    creatorId: doc.creatorId,
    status: doc.status 
  });
});

// Pre-remove middleware
contractSchema.pre('remove', function(next) {
  logInfo('Contract being removed', { contractId: this._id });
  next();
});

// ================================
// STATIC METHODS
// ================================

contractSchema.statics.findByCreator = function(creatorId, options = {}) {
  const query = { creatorId, isActive: true };
  if (options.status) query.status = options.status;
  if (options.brandName) query.brandName = new RegExp(options.brandName, 'i');
  
  return this.find(query)
    .populate('analysisId')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

contractAnalysisSchema.statics.getAnalyticsSummary = function(creatorId) {
  return this.aggregate([
    {
      $lookup: {
        from: 'contracts',
        localField: 'contractId',
        foreignField: '_id',
        as: 'contract'
      }
    },
    {
      $unwind: '$contract'
    },
    {
      $match: {
        'contract.creatorId': mongoose.Types.ObjectId(creatorId),
        'contract.isActive': true
      }
    },
    {
      $group: {
        _id: '$riskLevel',
        count: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' }
      }
    }
  ]);
};

// ================================
// MODEL EXPORTS
// ================================

const Contract = mongoose.model('Contract', contractSchema);
const ContractAnalysis = mongoose.model('ContractAnalysis', contractAnalysisSchema);
const NegotiationHistory = mongoose.model('NegotiationHistory', negotiationHistorySchema);
const ContractTemplate = mongoose.model('ContractTemplate', contractTemplateSchema);

module.exports = {
  Contract,
  ContractAnalysis,
  NegotiationHistory,
  ContractTemplate
};

// ================================
// INITIALIZATION LOG
// ================================
logInfo('Contract module models initialized', { 
  models: ['Contract', 'ContractAnalysis', 'NegotiationHistory', 'ContractTemplate'],
  timestamp: new Date().toISOString()
});