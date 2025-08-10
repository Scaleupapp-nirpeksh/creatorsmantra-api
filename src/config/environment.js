/**
 * Environment Configuration and Validation
 * @module config/environment
 * @description Validates and exports all environment variables with type checking and defaults
 */

const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Environment schema validation using Joi
 * Ensures all required environment variables are present and valid
 */
const envVarsSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().positive().default(5000),
  APP_NAME: Joi.string().default('CreatorsMantra'),
  APP_URL: Joi.string().uri().required(),
  CLIENT_URL: Joi.string().uri().required(),
  API_VERSION: Joi.string().default('v1'),

  // Database
  MONGODB_URI: Joi.string().required().description('MongoDB connection string'),
  MONGODB_URI_TEST: Joi.string().optional(),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().default(0),

  // JWT
  JWT_SECRET: Joi.string().min(32).required().description('JWT secret key'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRE: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRE: Joi.string().default('7d'),
  JWT_COOKIE_EXPIRE: Joi.number().default(7),

  // Encryption
  ENCRYPTION_KEY: Joi.string().length(32).required(),
  ENCRYPTION_IV: Joi.string().length(16).required(),

  // AWS S3
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_REGION: Joi.string().default('ap-south-1'),
  AWS_S3_BUCKET: Joi.string().required(),
  AWS_S3_ENDPOINT: Joi.string().uri().optional(),

  // OpenAI
  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_MODEL: Joi.string().default('gpt-4-turbo-preview'),
  OPENAI_MAX_TOKENS: Joi.number().default(2000),
  OPENAI_TEMPERATURE: Joi.number().min(0).max(2).default(0.7),

  // Razorpay
  RAZORPAY_KEY_ID: Joi.string().required(),
  RAZORPAY_KEY_SECRET: Joi.string().required(),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().required(),

  // Email
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().email().required(),
  SMTP_PASS: Joi.string().required(),
  EMAIL_FROM: Joi.string().required(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // Security
  CORS_ORIGIN: Joi.string().required(),
  BCRYPT_ROUNDS: Joi.number().min(10).default(12),
  SESSION_SECRET: Joi.string().min(32).required(),

  // 2FA
  TWO_FACTOR_APP_NAME: Joi.string().default('CreatorsMantra'),
  TWO_FACTOR_ENABLED: Joi.boolean().default(false),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('debug'),
  LOG_MAX_FILES: Joi.string().default('14d'),
  LOG_MAX_SIZE: Joi.string().default('20m'),

  // Pagination
  DEFAULT_PAGE: Joi.number().positive().default(1),
  DEFAULT_LIMIT: Joi.number().positive().default(20),
  MAX_LIMIT: Joi.number().positive().default(100),

  // File Upload
  MAX_FILE_SIZE: Joi.number().default(10485760), // 10MB
  ALLOWED_FILE_TYPES: Joi.string().default(
    'image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ),

  // Cache TTL
  CACHE_TTL_DEFAULT: Joi.number().default(3600),
  CACHE_TTL_USER: Joi.number().default(1800),
  CACHE_TTL_DEAL: Joi.number().default(300),

  // Feature Flags
  FEATURE_AI_ENABLED: Joi.boolean().default(true),
  FEATURE_PAYMENT_ENABLED: Joi.boolean().default(true),
  FEATURE_EMAIL_ENABLED: Joi.boolean().default(true),
  FEATURE_2FA_ENABLED: Joi.boolean().default(false),

  // Monitoring (optional)
  SENTRY_DSN: Joi.string().uri().optional().allow(''),
  NEW_RELIC_LICENSE_KEY: Joi.string().optional().allow(''),
})
  .unknown() // Allow unknown keys for flexibility
  .required();

/**
 * Validate environment variables
 */
const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

/**
 * Exported configuration object
 * Organized by feature/service for better maintainability
 */
const config = {
  env: envVars.NODE_ENV,
  isProduction: envVars.NODE_ENV === 'production',
  isDevelopment: envVars.NODE_ENV === 'development',
  isTest: envVars.NODE_ENV === 'test',

  app: {
    name: envVars.APP_NAME,
    port: envVars.PORT,
    url: envVars.APP_URL,
    clientUrl: envVars.CLIENT_URL,
    apiVersion: envVars.API_VERSION,
  },

  database: {
    uri: envVars.NODE_ENV === 'test' ? envVars.MONGODB_URI_TEST : envVars.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    },
  },

  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
    db: envVars.REDIS_DB,
  },

  jwt: {
    secret: envVars.JWT_SECRET,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    expiresIn: envVars.JWT_EXPIRE,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRE,
    cookieExpire: envVars.JWT_COOKIE_EXPIRE,
  },

  encryption: {
    key: envVars.ENCRYPTION_KEY,
    iv: envVars.ENCRYPTION_IV,
  },

  aws: {
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
    region: envVars.AWS_REGION,
    s3: {
      bucket: envVars.AWS_S3_BUCKET,
      endpoint: envVars.AWS_S3_ENDPOINT,
    },
  },

  openai: {
    apiKey: envVars.OPENAI_API_KEY,
    model: envVars.OPENAI_MODEL,
    maxTokens: envVars.OPENAI_MAX_TOKENS,
    temperature: envVars.OPENAI_TEMPERATURE,
  },

  razorpay: {
    keyId: envVars.RAZORPAY_KEY_ID,
    keySecret: envVars.RAZORPAY_KEY_SECRET,
    webhookSecret: envVars.RAZORPAY_WEBHOOK_SECRET,
  },

  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      secure: envVars.SMTP_SECURE,
      auth: {
        user: envVars.SMTP_USER,
        pass: envVars.SMTP_PASS,
      },
    },
    from: envVars.EMAIL_FROM,
  },

  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    max: envVars.RATE_LIMIT_MAX_REQUESTS,
  },

  security: {
    corsOrigin: envVars.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    bcryptRounds: envVars.BCRYPT_ROUNDS,
    sessionSecret: envVars.SESSION_SECRET,
  },

  twoFactor: {
    appName: envVars.TWO_FACTOR_APP_NAME,
    enabled: envVars.TWO_FACTOR_ENABLED,
  },

  logging: {
    level: envVars.LOG_LEVEL,
    maxFiles: envVars.LOG_MAX_FILES,
    maxSize: envVars.LOG_MAX_SIZE,
  },

  pagination: {
    defaultPage: envVars.DEFAULT_PAGE,
    defaultLimit: envVars.DEFAULT_LIMIT,
    maxLimit: envVars.MAX_LIMIT,
  },

  upload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    allowedMimeTypes: envVars.ALLOWED_FILE_TYPES.split(',').map((type) => type.trim()),
  },

  cache: {
    ttl: {
      default: envVars.CACHE_TTL_DEFAULT,
      user: envVars.CACHE_TTL_USER,
      deal: envVars.CACHE_TTL_DEAL,
    },
  },

  features: {
    ai: envVars.FEATURE_AI_ENABLED,
    payment: envVars.FEATURE_PAYMENT_ENABLED,
    email: envVars.FEATURE_EMAIL_ENABLED,
    twoFactor: envVars.FEATURE_2FA_ENABLED,
  },

  monitoring: {
    sentryDsn: envVars.SENTRY_DSN,
    newRelicKey: envVars.NEW_RELIC_LICENSE_KEY,
  },
};

/**
 * Validate configuration on startup
 */
if (config.isProduction) {
  // Additional production-only validations
  if (!config.monitoring.sentryDsn) {
    console.warn('⚠️  Warning: Sentry DSN not configured for production');
  }
  if (config.jwt.secret === 'your-super-secret-jwt-key-change-this-in-production') {
    throw new Error('Please change the default JWT secret in production');
  }
}

/**
 * Log configuration status (only in development)
 */
if (config.isDevelopment) {
  console.log('✅ Environment configuration loaded successfully');
  console.log(`📊 Environment: ${config.env}`);
  console.log(`🚀 Server will run on port: ${config.app.port}`);
}

module.exports = config;