/**
 * CreatorsMantra Backend - Invoice Module Models (FIXED)
 * Enhanced Invoice System with Consolidated Billing & Tax Control
 * 
 * @author CreatorsMantra Team
 * @version 1.0.1
 * @description Complete invoice management with Indian tax compliance
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

// ============================================
// ENCRYPTION/DECRYPTION FUNCTIONS
// ============================================

// Define encryption key (should be in environment variables)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key-here!!';
const IV_LENGTH = 16;

/**
 * Encrypt sensitive data
 * @param {String} text - Text to encrypt
 * @returns {String} Encrypted text
 */
function encrypt(text) {
  if (!text) return text;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
      iv
    );
    
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption error:', error);
    return text; // Return original if encryption fails
  }
}

/**
 * Decrypt sensitive data
 * @param {String} text - Text to decrypt
 * @returns {String} Decrypted text
 */
function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
      iv
    );
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error);
    return text; // Return original if decryption fails
  }
}

/**
 * Generate random string
 * @param {Number} length - String length
 * @param {String} type - Type of characters
 * @returns {String} Random string
 */
function generateRandomString(length = 6, type = 'ALPHANUMERIC') {
  let charset = '';
  
  switch (type) {
    case 'NUMBERS':
      charset = '0123456789';
      break;
    case 'LETTERS':
      charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      break;
    case 'ALPHANUMERIC':
    default:
      charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      break;
  }
  
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return result;
}

/**
 * Format currency
 * @param {Number} amount - Amount to format
 * @param {String} currency - Currency code
 * @returns {String} Formatted currency
 */
function formatCurrency(amount, currency = 'INR') {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return formatter.format(amount);
}

/**
 * Calculate GST
 * @param {Number} amount - Base amount
 * @param {Number} rate - GST rate
 * @returns {Object} GST calculation
 */
function calculateGST(amount, rate = 18) {
  const gstAmount = amount * (rate / 100);
  return {
    baseAmount: amount,
    gstRate: rate,
    gstAmount: gstAmount,
    totalAmount: amount + gstAmount
  };
}

/**
 * Calculate TDS
 * @param {Number} amount - Base amount
 * @param {Number} rate - TDS rate
 * @returns {Object} TDS calculation
 */
function calculateTDS(amount, rate = 10) {
  const tdsAmount = amount * (rate / 100);
  return {
    baseAmount: amount,
    tdsRate: rate,
    tdsAmount: tdsAmount,
    netAmount: amount - tdsAmount
  };
}

// ============================================
// INVOICE SCHEMA - MAIN INVOICE MODEL
// ============================================

const invoiceSchema = new mongoose.Schema({
  // ========== BASIC INVOICE INFO ==========
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return /^[A-Z0-9\-\/]+$/.test(v);
      },
      message: 'Invoice number can only contain letters, numbers, hyphens, and forward slashes'
    }
  },

  // Invoice type - KEY ENHANCEMENT for your requirement
  invoiceType: {
    type: String,
    required: true,
    enum: ['individual', 'consolidated', 'agency_payout', 'monthly_summary'],
    default: 'individual',
    index: true
  },

  // Creator who owns this invoice
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Deal references - ENHANCED for consolidated billing
  dealReferences: {
    // Single deal for individual invoices
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      index: true
    },
    
    // Multiple deals for consolidated invoices - YOUR REQUIREMENT
    dealIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal'
    }],
    
    // Consolidation metadata
    consolidationCriteria: {
      type: String,
      enum: ['monthly', 'brand_wise', 'custom_selection', 'agency_payout', 'date_range'],
      default: 'custom_selection'
    },
    
    // Date range for consolidation
    consolidationPeriod: {
      startDate: {
        type: Date,
        index: true
      },
      endDate: {
        type: Date,
        index: true
      }
    },
    
    // Summary for consolidated invoices
    dealsSummary: {
      totalDeals: { type: Number, default: 0 },
      totalBrands: { type: Number, default: 0 },
      totalDeliverables: { type: Number, default: 0 },
      platforms: [String] // Instagram, YouTube, etc.
    }
  },

  // ========== CLIENT DETAILS ==========
  clientDetails: {
    // Basic client info
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // Optional field
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email format'
      }
    },
    
    phone: {
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true; // Optional field
          return /^[6-9]\d{9}$/.test(v);
        },
        message: 'Invalid Indian mobile number'
      }
    },
    
    // Address details
    address: {
      street: { type: String, maxlength: 200 },
      city: { type: String, maxlength: 100 },
      state: { type: String, maxlength: 100 },
      pincode: { 
        type: String,
        validate: {
          validator: function(v) {
            if (!v) return true;
            return /^\d{6}$/.test(v);
          },
          message: 'Invalid pincode format'
        }
      },
      country: { type: String, default: 'India', maxlength: 100 }
    },
    
    // Tax registration details
    taxInfo: {
      gstNumber: {
        type: String,
        uppercase: true,
        validate: {
          validator: function(v) {
            if (!v) return true;
            return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/.test(v);
          },
          message: 'Invalid GST number format'
        }
      },
      panNumber: {
        type: String,
        uppercase: true,
        validate: {
          validator: function(v) {
            if (!v) return true;
            return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
          },
          message: 'Invalid PAN number format'
        }
      },
      isInterstate: { type: Boolean, default: false }
    },
    
    // Client type for agencies
    clientType: {
      type: String,
      enum: ['brand', 'agency', 'individual', 'company'],
      default: 'brand'
    }
  },

  // ========== LINE ITEMS ==========
  lineItems: [{
    // Basic item details
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    
    // Deal reference for this line item
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal'
    },
    
    // Item classification
    itemType: {
      type: String,
      enum: ['content_creation', 'sponsorship', 'brand_integration', 'performance_bonus', 'misc'],
      default: 'content_creation'
    },
    
    // Platform and deliverable details
    platform: {
      type: String,
      enum: ['instagram', 'youtube', 'linkedin', 'twitter', 'facebook', 'multiple', 'other']
    },
    
    deliverableType: {
      type: String,
      enum: ['reel', 'post', 'story', 'video', 'short', 'carousel', 'igtv', 'live', 'other']
    },
    
    // Quantity and pricing
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 1
    },
    
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    
    // Auto-calculated amount
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    
    // HSN/SAC code for GST
    hsnCode: {
      type: String,
      default: '998314', // Services by content creators
      maxlength: 10
    },
    
    // Item-specific discount
    discount: {
      percentage: { type: Number, min: 0, max: 100, default: 0 },
      amount: { type: Number, min: 0, default: 0 }
    }
  }],

  // ========== TAX SETTINGS - YOUR KEY REQUIREMENT ==========
  taxSettings: {
    // GST Application Control - Creator's Choice
    gstSettings: {
      applyGST: {
        type: Boolean,
        default: true, // Can be toggled by creator
        index: true
      },
      
      gstRate: {
        type: Number,
        default: 18,
        min: 0,
        max: 100
      },
      
      gstType: {
        type: String,
        enum: ['cgst_sgst', 'igst'],
        default: 'cgst_sgst'
      },
      
      // Reason if GST not applied
      exemptionReason: {
        type: String,
        maxlength: 200
      }
    },
    
    // TDS Application Control - Creator's Choice
    tdsSettings: {
      applyTDS: {
        type: Boolean,
        default: false, // Creator can choose
        index: true
      },
      
      tdsRate: {
        type: Number,
        default: 10, // 10% for individuals, 2% for companies
        min: 0,
        max: 30
      },
      
      entityType: {
        type: String,
        enum: ['individual', 'company'],
        default: 'individual'
      },
      
      // TDS exemption certificate
      exemptionCertificate: {
        hasExemption: { type: Boolean, default: false },
        certificateNumber: { type: String },
        validUpto: { type: Date }
      }
    },
    
    // Overall tax calculation
    taxCalculation: {
      subtotal: { type: Number, default: 0 },
      totalDiscount: { type: Number, default: 0 },
      taxableAmount: { type: Number, default: 0 },
      
      // GST breakdown
      gstAmount: { type: Number, default: 0 },
      cgstAmount: { type: Number, default: 0 },
      sgstAmount: { type: Number, default: 0 },
      igstAmount: { type: Number, default: 0 },
      
      // TDS calculation
      tdsAmount: { type: Number, default: 0 },
      
      // Final amounts
      totalWithGST: { type: Number, default: 0 },
      finalAmount: { type: Number, default: 0 }
    }
  },

  // ========== INVOICE SETTINGS ==========
  invoiceSettings: {
    // Currency
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP']
    },
    
    // Dates
    invoiceDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    
    dueDate: {
      type: Date,
      required: true,
      index: true
    },
    
    // Payment terms
    paymentTerms: {
      type: Number,
      default: 30, // 30 days
      min: 0,
      max: 365
    },
    
    // Discount settings
    overallDiscount: {
      type: { type: String, enum: ['percentage', 'amount'], default: 'percentage' },
      value: { type: Number, min: 0, default: 0 }
    },
    
    // Invoice notes
    notes: {
      type: String,
      maxlength: 1000
    },
    
    termsAndConditions: {
      type: String,
      maxlength: 5000
    }
  },

  // ========== PAYMENT INFORMATION ==========
  bankDetails: {
    // Account details (encrypted)
    accountName: {
      type: String,
      required: true,
      maxlength: 100
    },
    
    accountNumber: {
      type: String,
      required: true,
      set: function(value) {
        return encrypt(value);
      },
      get: function(value) {
        return decrypt(value);
      }
    },
    
    bankName: {
      type: String,
      required: true,
      maxlength: 100
    },
    
    ifscCode: {
      type: String,
      required: true,
      uppercase: true,
      validate: {
        validator: function(v) {
          return /^[A-Z]{4}[0][A-Z0-9]{6}$/.test(v);
        },
        message: 'Invalid IFSC code format'
      }
    },
    
    branchName: {
      type: String,
      maxlength: 100
    },
    
    // UPI details
    upiId: {
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(v);
        },
        message: 'Invalid UPI ID format'
      }
    },
    
    // QR code for payments
    qrCodeUrl: {
      type: String
    }
  },

  // ========== INVOICE STATUS ==========
  status: {
    type: String,
    required: true,
    enum: ['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled'],
    default: 'draft',
    index: true
  },

  // ========== METADATA ==========
  metadata: {
    // Template used
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InvoiceTemplate'
    },
    
    // Generated files
    pdfUrl: {
      type: String
    },
    
    pdfGeneratedAt: {
      type: Date
    },
    
    // Email tracking
    emailSent: {
      sentAt: { type: Date },
      sentTo: { type: String },
      viewedAt: { type: Date },
      clickedAt: { type: Date }
    },
    
    // Version control
    version: {
      type: Number,
      default: 1
    },
    
    // Revision history
    revisions: [{
      version: Number,
      changes: String,
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      changedAt: { type: Date, default: Date.now }
    }],
    
    // Analytics
    analytics: {
      viewCount: { type: Number, default: 0 },
      downloadCount: { type: Number, default: 0 },
      lastViewed: { type: Date },
      lastDownloaded: { type: Date }
    }
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// ============================================
// PAYMENT TRACKING SCHEMA
// ============================================

const paymentTrackingSchema = new mongoose.Schema({
  // Invoice reference
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true,
    index: true
  },
  
  // Payment details
  paymentId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  // Amount details
  amountDetails: {
    paidAmount: {
      type: Number,
      required: true,
      min: 0
    },
    
    remainingAmount: {
      type: Number,
      required: true,
      min: 0
    },
    
    totalInvoiceAmount: {
      type: Number,
      required: true,
      min: 0
    },
    
    // Payment type
    paymentType: {
      type: String,
      enum: ['advance', 'milestone', 'final', 'partial'],
      required: true
    },
    
    // Milestone information
    milestoneInfo: {
      milestoneNumber: { type: Number },
      totalMilestones: { type: Number },
      milestonePercentage: { type: Number }
    }
  },
  
  // Payment method
  paymentMethod: {
    type: String,
    required: true,
    enum: ['bank_transfer', 'upi', 'cheque', 'cash', 'online', 'wallet', 'other']
  },
  
  // Payment dates
  paymentDate: {
    type: Date,
    required: true,
    index: true
  },
  
  receivedDate: {
    type: Date,
    default: Date.now
  },
  
  // Transaction details
  transactionDetails: {
    transactionId: {
      type: String,
      trim: true
    },
    
    referenceNumber: {
      type: String,
      trim: true
    },
    
    payerName: {
      type: String,
      trim: true
    },
    
    payerAccount: {
      type: String,
      trim: true
    },
    
    bankReference: {
      type: String,
      trim: true
    }
  },
  
  // Verification
  verification: {
    isVerified: {
      type: Boolean,
      default: false
    },
    
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    verifiedAt: {
      type: Date
    },
    
    verificationNotes: {
      type: String,
      maxlength: 500
    }
  },
  
  // Receipt details
  receipt: {
    receiptNumber: {
      type: String,
      uppercase: true
    },
    
    receiptUrl: {
      type: String
    },
    
    receiptGeneratedAt: {
      type: Date
    }
  },
  
  // Status
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  
  // Notes
  notes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// ============================================
// INVOICE TEMPLATE SCHEMA
// ============================================

const invoiceTemplateSchema = new mongoose.Schema({
  // Template basic info
  templateName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  templateType: {
    type: String,
    enum: ['professional', 'minimal', 'creative', 'corporate', 'custom'],
    default: 'professional'
  },
  
  // Creator who owns this template
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Template design
  design: {
    // Colors
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
    
    // Typography
    fontFamily: {
      type: String,
      enum: ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'],
      default: 'Inter'
    },
    
    fontSize: {
      heading: { type: Number, default: 24 },
      subheading: { type: Number, default: 18 },
      body: { type: Number, default: 14 },
      small: { type: Number, default: 12 }
    }
  },
  
  // Branding
  branding: {
    logoUrl: {
      type: String
    },
    
    companyName: {
      type: String,
      maxlength: 200
    },
    
    tagline: {
      type: String,
      maxlength: 200
    },
    
    socialHandles: {
      instagram: String,
      youtube: String,
      linkedin: String,
      twitter: String,
      website: String
    }
  },
  
  // Layout configuration
  layout: {
    headerStyle: {
      type: String,
      enum: ['minimal', 'bold', 'centered', 'left_aligned'],
      default: 'minimal'
    },
    
    itemTableStyle: {
      type: String,
      enum: ['simple', 'striped', 'bordered', 'modern'],
      default: 'simple'
    },
    
    footerStyle: {
      type: String,
      enum: ['minimal', 'detailed', 'branded'],
      default: 'minimal'
    }
  },
  
  // Default content
  defaultContent: {
    termsAndConditions: {
      type: String,
      maxlength: 5000
    },
    
    paymentInstructions: {
      type: String,
      maxlength: 1000
    },
    
    thankYouMessage: {
      type: String,
      maxlength: 500
    }
  },
  
  // Usage tracking
  usage: {
    timesUsed: {
      type: Number,
      default: 0
    },
    
    lastUsed: {
      type: Date
    }
  },
  
  // Template status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// ============================================
// PAYMENT REMINDER SCHEMA
// ============================================

const paymentReminderSchema = new mongoose.Schema({
  // Invoice reference
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true,
    index: true
  },
  
  // Reminder configuration
  reminderType: {
    type: String,
    required: true,
    enum: ['gentle', 'standard', 'urgent', 'final_notice', 'legal_notice']
  },
  
  // Reminder schedule
  scheduledDate: {
    type: Date,
    required: true,
    index: true
  },
  
  daysPastDue: {
    type: Number,
    required: true
  },
  
  // Reminder content
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  message: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  // Delivery status
  status: {
    type: String,
    required: true,
    enum: ['scheduled', 'sent', 'delivered', 'failed', 'cancelled'],
    default: 'scheduled',
    index: true
  },
  
  // Delivery details
  delivery: {
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    openedAt: { type: Date },
    clickedAt: { type: Date },
    
    deliveryMethod: {
      type: String,
      enum: ['email', 'sms', 'whatsapp', 'phone'],
      default: 'email'
    },
    
    recipientEmail: { type: String },
    recipientPhone: { type: String }
  },
  
  // Response tracking
  response: {
    hasResponse: { type: Boolean, default: false },
    responseAt: { type: Date },
    responseType: {
      type: String,
      enum: ['payment_made', 'dispute_raised', 'extension_requested', 'other']
    },
    responseNotes: { type: String, maxlength: 500 }
  }
}, {
  timestamps: true
});

// ============================================
// MONGOOSE INDEXES
// ============================================

// Invoice Indexes
invoiceSchema.index({ creatorId: 1, status: 1 });
invoiceSchema.index({ 'clientDetails.name': 1 });
invoiceSchema.index({ 'invoiceSettings.invoiceDate': -1 });
invoiceSchema.index({ 'invoiceSettings.dueDate': 1, status: 1 });
invoiceSchema.index({ invoiceType: 1, creatorId: 1 });
invoiceSchema.index({ 'dealReferences.dealIds': 1 });

// Payment Tracking Indexes
paymentTrackingSchema.index({ invoiceId: 1, status: 1 });
paymentTrackingSchema.index({ paymentDate: -1 });
paymentTrackingSchema.index({ 'verification.isVerified': 1 });

// Template Indexes
invoiceTemplateSchema.index({ creatorId: 1, isActive: 1 });
invoiceTemplateSchema.index({ templateType: 1 });

// Reminder Indexes
paymentReminderSchema.index({ scheduledDate: 1, status: 1 });
paymentReminderSchema.index({ invoiceId: 1, reminderType: 1 });

// ============================================
// INVOICE METHODS
// ============================================

// Auto-calculate line item amounts
invoiceSchema.pre('save', function(next) {
  // Calculate line item amounts
  this.lineItems.forEach(item => {
    item.amount = item.quantity * item.rate;
    
    // Apply line item discount
    if (item.discount.percentage > 0) {
      item.amount = item.amount * (1 - item.discount.percentage / 100);
    } else if (item.discount.amount > 0) {
      item.amount = Math.max(0, item.amount - item.discount.amount);
    }
  });
  
  // Calculate tax amounts
  this.calculateTaxAmounts();
  
  next();
});

// Method to calculate tax amounts
invoiceSchema.methods.calculateTaxAmounts = function() {
  const subtotal = this.lineItems.reduce((sum, item) => sum + item.amount, 0);
  let taxableAmount = subtotal;
  
  // Apply overall discount
  if (this.invoiceSettings.overallDiscount.value > 0) {
    if (this.invoiceSettings.overallDiscount.type === 'percentage') {
      taxableAmount = subtotal * (1 - this.invoiceSettings.overallDiscount.value / 100);
    } else {
      taxableAmount = Math.max(0, subtotal - this.invoiceSettings.overallDiscount.value);
    }
  }
  
  this.taxSettings.taxCalculation.subtotal = subtotal;
  this.taxSettings.taxCalculation.totalDiscount = subtotal - taxableAmount;
  this.taxSettings.taxCalculation.taxableAmount = taxableAmount;
  
  let finalAmount = taxableAmount;
  
  // Calculate GST if applicable
  if (this.taxSettings.gstSettings.applyGST) {
    const gstRate = this.taxSettings.gstSettings.gstRate / 100;
    const gstAmount = taxableAmount * gstRate;
    
    this.taxSettings.taxCalculation.gstAmount = gstAmount;
    
    if (this.taxSettings.gstSettings.gstType === 'igst') {
      this.taxSettings.taxCalculation.igstAmount = gstAmount;
      this.taxSettings.taxCalculation.cgstAmount = 0;
      this.taxSettings.taxCalculation.sgstAmount = 0;
    } else {
      this.taxSettings.taxCalculation.cgstAmount = gstAmount / 2;
      this.taxSettings.taxCalculation.sgstAmount = gstAmount / 2;
      this.taxSettings.taxCalculation.igstAmount = 0;
    }
    
    finalAmount += gstAmount;
  }
  
  this.taxSettings.taxCalculation.totalWithGST = finalAmount;
  
  // Calculate TDS if applicable
  if (this.taxSettings.tdsSettings.applyTDS) {
    const tdsRate = this.taxSettings.tdsSettings.tdsRate / 100;
    const tdsAmount = finalAmount * tdsRate;
    
    this.taxSettings.taxCalculation.tdsAmount = tdsAmount;
    finalAmount -= tdsAmount;
  }
  
  this.taxSettings.taxCalculation.finalAmount = finalAmount;
};

// Generate invoice number
invoiceSchema.methods.generateInvoiceNumber = function() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const random = generateRandomString(4, 'NUMBERS');
  
  // Format: INV/2024/01/1234
  this.invoiceNumber = `INV/${year}/${month}/${random}`;
};

// Get payment status
invoiceSchema.methods.getPaymentStatus = function() {
  const totalAmount = this.taxSettings.taxCalculation.finalAmount;
  
  if (this.status === 'paid') {
    return { status: 'paid', percentage: 100 };
  }
  
  // This would typically involve checking PaymentTracking records
  return { status: this.status, percentage: 0 };
};

// ============================================
// EXPORT MODELS
// ============================================

const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
const PaymentTracking = mongoose.models.PaymentTracking || mongoose.model('PaymentTracking', paymentTrackingSchema);
const InvoiceTemplate = mongoose.models.InvoiceTemplate || mongoose.model('InvoiceTemplate', invoiceTemplateSchema);
const PaymentReminder = mongoose.models.PaymentReminder || mongoose.model('PaymentReminder', paymentReminderSchema);

module.exports = {
  Invoice,
  PaymentTracking,
  InvoiceTemplate,
  PaymentReminder
};