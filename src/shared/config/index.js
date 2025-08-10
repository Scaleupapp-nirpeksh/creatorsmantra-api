
// src/shared/config/index.js
/**
 * CreatorsMantra Backend - Main Configuration
 * Central configuration file for all application settings
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

require('dotenv').config();

// ============================================
// SERVER CONFIGURATION
// ============================================

const server = {
  port: parseInt(process.env.PORT) || 3000,
  environment: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || 'v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
};

// ============================================
// DATABASE CONFIGURATION
// ============================================

const database = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/creatorsmantra',
  name: process.env.DB_NAME || 'creatorsmantra',
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferMaxEntries: 0,
    bufferCommands: false
  }
};

// ============================================
// JWT CONFIGURATION
// ============================================

const jwt = {
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  issuer: 'creatorsmantra.com',
  audience: 'creatorsmantra-users'
};

// ============================================
// AWS CONFIGURATION
// ============================================

const aws = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1',
  s3: {
    bucket: process.env.AWS_S3_BUCKET || 'creatorsmantra-files',
    signedUrlExpiry: 3600, // 1 hour
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif'
    ]
  }
};

// ============================================
// OPENAI CONFIGURATION
// ============================================

const openai = {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  maxTokens: 2000,
  temperature: 0.7,
  organization: process.env.OPENAI_ORG_ID || null
};

// ============================================
// PAYMENT CONFIGURATION (RAZORPAY)
// ============================================

const payment = {
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
  },
  currency: 'INR',
  gstRate: 0.18, // 18%
  tdsRate: 0.10  // 10%
};

// ============================================
// EMAIL CONFIGURATION
// ============================================

const email = {
  smtp: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  },
  from: process.env.EMAIL_FROM || 'noreply@creatorsmantra.com',
  templates: {
    welcomeEmail: 'welcome',
    resetPassword: 'reset-password',
    invoiceCreated: 'invoice-created',
    paymentReminder: 'payment-reminder',
    subscriptionExpiry: 'subscription-expiry'
  }
};

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================

const rateLimiting = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
};

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

const fileUpload = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,jpg,jpeg,png').split(','),
  tempDir: './temp',
  uploadDir: './uploads'
};

// ============================================
// SUBSCRIPTION CONFIGURATION
// ============================================

const subscriptions = {
  tiers: {
    'starter': {
      name: 'Creator Starter',
      price: 299,
      limits: {
        maxActiveDeals: 10,
        maxInvoicesPerMonth: 20,
        maxUsers: 1,
        features: ['basic_crm', 'basic_invoicing', 'basic_performance']
      }
    },
    'pro': {
      name: 'Creator Pro',
      price: 699,
      limits: {
        maxActiveDeals: 25,
        maxInvoicesPerMonth: -1, // unlimited
        maxUsers: 1,
        features: ['basic_crm', 'basic_invoicing', 'basic_performance', 'ai_pricing', 'ai_brief_analyzer']
      }
    },
    'elite': {
      name: 'Creator Elite',
      price: 1299,
      limits: {
        maxActiveDeals: 50,
        maxInvoicesPerMonth: -1,
        maxUsers: 2,
        features: ['basic_crm', 'basic_invoicing', 'basic_performance', 'ai_pricing', 'ai_brief_analyzer', 'ai_contract_review', 'advanced_analytics']
      }
    },
    'agency_starter': {
      name: 'Agency Starter',
      price: 2999,
      limits: {
        maxActiveDeals: -1,
        maxInvoicesPerMonth: -1,
        maxUsers: 2,
        maxCreators: 8,
        features: ['all_creator_features', 'multi_creator_dashboard', 'consolidated_billing', 'creator_assignment']
      }
    },
    'agency_pro': {
      name: 'Agency Pro',
      price: 6999,
      limits: {
        maxActiveDeals: -1,
        maxInvoicesPerMonth: -1,
        maxUsers: 5,
        maxCreators: 25,
        features: ['all_features', 'advanced_workflows', 'white_label_reporting', 'api_access']
      }
    }
  }
};

// ============================================
// LOGGING CONFIGURATION
// ============================================

const logging = {
  level: process.env.LOG_LEVEL || 'info',
  file: {
    enabled: process.env.LOG_TO_FILE === 'true',
    filename: process.env.LOG_FILE || 'logs/app.log',
    maxSize: '10m',
    maxFiles: 5
  },
  console: {
    enabled: true,
    colorize: server.environment === 'development'
  }
};

// ============================================
// CACHE CONFIGURATION
// ============================================

const cache = {
  // For future Redis implementation if needed
  ttl: {
    default: 3600, // 1 hour
    userSession: 86400, // 24 hours
    pricing: 1800, // 30 minutes
    analytics: 900 // 15 minutes
  }
};

// ============================================
// SECURITY CONFIGURATION
// ============================================

const security = {
  bcrypt: {
    saltRounds: 12
  },
  encryption: {
    algorithm: 'aes-256-cbc',
    keyLength: 32
  },
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"]
      }
    }
  }
};

// ============================================
// VALIDATION CONFIGURATION
// ============================================

const validation = {
  joi: {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: false
  },
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  }
};

// ============================================
// FEATURE FLAGS
// ============================================

const featureFlags = {
  aiFeatures: process.env.ENABLE_AI_FEATURES !== 'false',
  paymentIntegration: process.env.ENABLE_PAYMENTS !== 'false',
  emailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false',
  fileUpload: process.env.ENABLE_FILE_UPLOAD !== 'false',
  analytics: process.env.ENABLE_ANALYTICS !== 'false'
};

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

/**
 * Validate required environment variables
 * @throws {Error} If required variables are missing
 */
const validateEnvironment = () => {
  const required = [
    'JWT_SECRET',
    'MONGODB_URI'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Warn about optional but recommended variables
  const recommended = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'OPENAI_API_KEY',
    'EMAIL_USER',
    'EMAIL_PASS'
  ];
  
  const missingRecommended = recommended.filter(key => !process.env[key]);
  
  if (missingRecommended.length > 0 && server.environment === 'production') {
    console.warn(`Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  }
};

// ============================================
// CONFIGURATION EXPORT
// ============================================

const config = {
  server,
  database,
  jwt,
  aws,
  openai,
  payment,
  email,
  rateLimiting,
  fileUpload,
  subscriptions,
  logging,
  cache,
  security,
  validation,
  featureFlags,
  validateEnvironment
};

// Validate environment on import
if (process.env.NODE_ENV !== 'test') {
  validateEnvironment();
}

module.exports = config;