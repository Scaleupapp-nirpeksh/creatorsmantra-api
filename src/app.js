// src/app.js
/**
 * CreatorsMantra Backend - Main Application
 * Express.js application setup with middleware and routes
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const express = require('express');
const path = require('path');
const config = require('./shared/config');
const { initializeDatabase } = require('./shared/config/database');
const { 
  corsMiddleware,
  securityMiddleware,
  jsonParser,
  urlencodedParser,
  requestLogger,
  errorHandler,
  notFoundHandler
} = require('./shared/middleware');
const { logInfo, logWarn, logError, successResponse } = require('./shared/utils');

// ============================================
// CREATE EXPRESS APPLICATION
// ============================================

const app = express();

// ============================================
// TRUST PROXY (FOR DEPLOYMENT)
// ============================================

if (config.server.environment === 'production') {
  app.set('trust proxy', 1);
  logInfo('Trust proxy enabled for production environment');
}

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Basic security headers
app.use(securityMiddleware);

// CORS configuration
app.use(corsMiddleware);

logInfo('Security and CORS middleware loaded');

// ============================================
// REQUEST PARSING MIDDLEWARE
// ============================================

// JSON body parser with size limit
app.use(jsonParser);

// URL encoded parser
app.use(urlencodedParser);

logInfo('Request parsing middleware loaded');

// ============================================
// LOGGING MIDDLEWARE
// ============================================

// Request logging (only in development and staging)
if (config.server.environment !== 'production') {
  app.use(requestLogger);
  logInfo('Request logging enabled for development environment');
}

// ============================================
// STATIC FILES (IF NEEDED)
// ============================================

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve public files if they exist
try {
  app.use('/public', express.static(path.join(__dirname, '../public')));
  logInfo('Static file serving enabled');
} catch (error) {
  logWarn('Public directory not found - static file serving disabled');
}

// ============================================
// HEALTH CHECK ROUTES
// ============================================

/**
 * Basic health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json(
    successResponse('Server is healthy', {
      timestamp: new Date().toISOString(),
      environment: config.server.environment,
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor(process.uptime()),
      node_version: process.version,
      platform: process.platform,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      }
    })
  );
});

/**
 * Detailed health check with database status
 */
app.get('/health/detailed', async (req, res) => {
  try {
    const { getDatabaseHealth } = require('./shared/config/database');
    const dbHealth = getDatabaseHealth();
    
    const healthStatus = {
      server: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.server.environment,
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor(process.uptime()),
        node_version: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      database: dbHealth,
      features: {
        aiEnabled: config.featureFlags?.aiFeatures || false,
        paymentsEnabled: config.featureFlags?.paymentIntegration || false,
        emailEnabled: config.featureFlags?.emailNotifications || false,
        fileUploadEnabled: config.featureFlags?.fileUpload || false,
        smsEnabled: config.featureFlags?.smsNotifications || false
      },
      modules: {
        auth: checkModuleExists('auth'),
        subscriptions: checkModuleExists('subscriptions'),
        deals: checkModuleExists('deals'),
        invoices: checkModuleExists('invoices'),
        ratecards: checkModuleExists('ratecards'),
        briefs: checkModuleExists('briefs'),
        performance: checkModuleExists('performance'),
        contracts: checkModuleExists('contracts'),
        agency: checkModuleExists('agency')
      }
    };
    
    const statusCode = dbHealth.status === 'connected' ? 200 : 503;
    
    res.status(statusCode).json(
      successResponse('Detailed health check', healthStatus, statusCode)
    );
  } catch (error) {
    logError('Health check failed', { error: error.message });
    res.status(503).json({
      success: false,
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString(),
      code: 503
    });
  }
});

/**
 * Check if a module exists
 */
function checkModuleExists(moduleName) {
  try {
    require(`./modules/${moduleName}/routes`);
    return { status: 'loaded', available: true };
  } catch (error) {
    return { status: 'not_found', available: false };
  }
}

// ============================================
// API ROUTES SETUP
// ============================================

/**
 * API version prefix
 */
const API_PREFIX = `/api/${config.server.apiVersion || 'v1'}`;

/**
 * Welcome endpoint
 */
app.get(API_PREFIX, (req, res) => {
  res.json(
    successResponse('Welcome to CreatorsMantra API', {
      version: config.server.apiVersion || 'v1',
      environment: config.server.environment,
      timestamp: new Date().toISOString(),
      documentation: `${req.protocol}://${req.get('host')}${API_PREFIX}/docs`,
      health: `${req.protocol}://${req.get('host')}/health`,
      endpoints: {
        auth: `${API_PREFIX}/auth`,
        deals: `${API_PREFIX}/deals`,
        invoices: `${API_PREFIX}/invoices`,
        ratecards: `${API_PREFIX}/ratecards`,
        briefs: `${API_PREFIX}/briefs`,
        performance: `${API_PREFIX}/performance`,
        contracts: `${API_PREFIX}/contracts`,
        subscriptions: `${API_PREFIX}/subscriptions`,
        agency: `${API_PREFIX}/agency`
      },
      features: {
        quarterlyBilling: true,
        manualPaymentVerification: true,
        dealPipelineManagement: true,
        brandProfileManagement: true,
        communicationTracking: true,
        indianCompliance: true,
        gstCalculation: true,
        tdsHandling: true
      }
    })
  );
});

// ============================================
// MODULE ROUTES REGISTRATION
// ============================================

/**
 * Load and register all module routes
 * Each module exports its routes which will be mounted at the appropriate path
 */

let loadedModules = 0;
let totalModules = 9;

// Authentication routes
try {
  const authRoutes = require('./modules/auth/routes');
  app.use(`${API_PREFIX}/auth`, authRoutes);
  logInfo('✅ Auth routes loaded successfully');
  loadedModules++;
} catch (error) {
  logWarn('⚠️  Auth routes not found - module may not be implemented yet', { error: error.message });
}

// Subscription routes
try {
  const subscriptionRoutes = require('./modules/subscriptions/routes');
  app.use(`${API_PREFIX}/subscriptions`, subscriptionRoutes);
  logInfo('✅ Subscription routes loaded successfully');
  loadedModules++;
} catch (error) {
  logWarn('⚠️  Subscription routes not found - module may not be implemented yet', { error: error.message });
}

// Deal CRM routes
try {
  const dealRoutes = require('./modules/deals/routes');
  app.use(`${API_PREFIX}/deals`, dealRoutes);
  logInfo('✅ Deal routes loaded successfully');
  loadedModules++;
} catch (error) {
  logWarn('⚠️  Deal routes not found - module may not be implemented yet', { error: error.message });
}

// Invoice routes
try {
  const invoiceRoutes = require('./modules/invoices/routes');
  app.use(`${API_PREFIX}/invoices`, invoiceRoutes);
  logInfo('✅ Invoice routes loaded successfully');
  loadedModules++;
} catch (error) {
  logWarn('⚠️  Invoice routes not found - module may not be implemented yet', { error: error.message });
}

// Rate card routes
try {
  const rateCardRoutes = require('./modules/ratecards/routes');
  app.use(`${API_PREFIX}/ratecards`, rateCardRoutes);
  logInfo('✅ Rate card routes loaded successfully');
  loadedModules++;
} catch (error) {
  logWarn('⚠️  Rate card routes not found - module may not be implemented yet', { error: error.message });
}

// Brief analyzer routes
try {
  const briefRoutes = require('./modules/briefs/routes');
  app.use(`${API_PREFIX}/briefs`, briefRoutes);
  logInfo('✅ Brief routes loaded successfully');
  loadedModules++;
} catch (error) {
  logWarn('⚠️  Brief routes not found - module may not be implemented yet', { error: error.message });
}

// Performance vault routes
try {
  const performanceRoutes = require('./modules/performance/routes');
  app.use(`${API_PREFIX}/performance`, performanceRoutes);
  logInfo('✅ Performance routes loaded successfully');
  loadedModules++;
} catch (error) {
  logWarn('⚠️  Performance routes not found - module may not be implemented yet', { error: error.message });
}

// Contract routes
try {
  const contractRoutes = require('./modules/contracts/routes');
  app.use(`${API_PREFIX}/contracts`, contractRoutes);
  logInfo('✅ Contract routes loaded successfully');
  loadedModules++;
} catch (error) {
  logWarn('⚠️  Contract routes not found - module may not be implemented yet', { error: error.message });
}

// Agency routes
try {
  const agencyRoutes = require('./modules/agency/routes');
  app.use(`${API_PREFIX}/agency`, agencyRoutes);
  logInfo('✅ Agency routes loaded successfully');
  loadedModules++;
} catch (error) {
  logWarn('⚠️  Agency routes not found - module may not be implemented yet', { error: error.message });
}

// ============================================
// UTILITY ROUTES
// ============================================

/**
 * Get API status and loaded modules
 */
app.get(`${API_PREFIX}/status`, (req, res) => {
  res.json(
    successResponse('API Status', {
      status: 'operational',
      modulesLoaded: loadedModules,
      totalModules: totalModules,
      completionPercentage: Math.round((loadedModules / totalModules) * 100),
      loadedModulesList: getLoadedModules(),
      environment: config.server.environment,
      timestamp: new Date().toISOString()
    })
  );
});

/**
 * Get loaded modules list
 */
function getLoadedModules() {
  const modules = ['auth', 'subscriptions', 'deals', 'invoices', 'ratecards', 'briefs', 'performance', 'contracts', 'agency'];
  return modules.filter(module => {
    try {
      require(`./modules/${module}/routes`);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * API version information
 */
app.get(`${API_PREFIX}/version`, (req, res) => {
  res.json(
    successResponse('API Version Information', {
      api_version: config.server.apiVersion || 'v1',
      app_version: process.env.npm_package_version || '1.0.0',
      node_version: process.version,
      environment: config.server.environment,
      build_date: new Date().toISOString(),
      supported_features: [
        'user_authentication',
        'subscription_management',
        'deal_pipeline',
        'brand_profiles',
        'payment_verification',
        'quarterly_billing',
        'indian_compliance',
        'gst_calculation',
        'communication_tracking'
      ]
    })
  );
});

// ============================================
// API DOCUMENTATION
// ============================================

/**
 * API documentation endpoint
 */
app.get(`${API_PREFIX}/docs`, (req, res) => {
  res.json(
    successResponse('API Documentation', {
      message: 'CreatorsMantra API Documentation',
      version: config.server.apiVersion || 'v1',
      base_url: `${req.protocol}://${req.get('host')}${API_PREFIX}`,
      authentication: {
        type: 'Bearer Token (JWT)',
        header: 'Authorization: Bearer <token>',
        endpoints: {
          register: `${API_PREFIX}/auth/register`,
          login: `${API_PREFIX}/auth/login`,
          verify_otp: `${API_PREFIX}/auth/verify-otp`
        }
      },
      modules: {
        auth: {
          description: 'User authentication and profile management',
          base_path: `${API_PREFIX}/auth`,
          features: ['registration', 'login', 'otp_verification', 'profile_management']
        },
        subscriptions: {
          description: 'Subscription and billing management',
          base_path: `${API_PREFIX}/subscriptions`,
          features: ['payment_verification', 'billing_cycles', 'upgrades', 'quarterly_billing']
        },
        deals: {
          description: 'Deal pipeline and CRM management',
          base_path: `${API_PREFIX}/deals`,
          features: ['deal_creation', 'pipeline_management', 'brand_profiles', 'communications']
        }
      },
      rate_limits: {
        general: '100 requests per 15 minutes',
        authentication: '10 requests per 15 minutes',
        payment_verification: '5 requests per 15 minutes'
      },
      support: {
        email: 'support@creatorsmantra.com',
        documentation: 'Coming soon',
        postman_collection: 'Available on request'
      }
    })
  );
});

/**
 * Postman collection endpoint
 */
app.get(`${API_PREFIX}/postman`, (req, res) => {
  res.json(
    successResponse('Postman Collection', {
      message: 'Postman collection for CreatorsMantra API',
      download_url: 'Coming soon',
      description: 'Complete API collection with examples and tests',
      contact: 'support@creatorsmantra.com for early access'
    })
  );
});

// ============================================
// FEATURE FLAGS ENDPOINT
// ============================================

/**
 * Get current feature flags
 */
app.get(`${API_PREFIX}/features`, (req, res) => {
  res.json(
    successResponse('Feature Flags', {
      features: {
        ai_features: config.featureFlags?.aiFeatures || false,
        payment_integration: config.featureFlags?.paymentIntegration || false,
        email_notifications: config.featureFlags?.emailNotifications || false,
        sms_notifications: config.featureFlags?.smsNotifications || false,
        file_upload: config.featureFlags?.fileUpload || false,
        quarterly_billing: true,
        manual_payment_verification: true,
        indian_compliance: true,
        gst_calculation: true,
        tds_handling: true,
        brand_profiles: true,
        deal_templates: true,
        communication_tracking: true
      },
      environment: config.server.environment
    })
  );
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ============================================
// APPLICATION INITIALIZATION
// ============================================

/**
 * Initialize the application
 * Sets up database connection and other required services
 */
const initializeApp = async () => {
  try {
    logInfo('🚀 Initializing CreatorsMantra Backend Application');
    
    // Initialize database connection
    logInfo('📊 Connecting to MongoDB database...');
    await initializeDatabase();
    logInfo('✅ Database connection established');
    
    // Initialize external services if needed
    logInfo('🔧 Initializing external services...');
    await initializeServices();
    
    // Log module status
    logInfo(`📦 Loaded ${loadedModules}/${totalModules} modules (${Math.round((loadedModules/totalModules)*100)}% complete)`);
    
    logInfo('✅ Application initialized successfully');
    return true;
  } catch (error) {
    logError('❌ Application initialization failed', { error: error.message, stack: error.stack });
    throw error;
  }
};

/**
 * Initialize external services
 */
const initializeServices = async () => {
  try {
    let servicesInitialized = 0;
    
    // Initialize AWS S3 if configured
    if (config.aws?.accessKeyId && config.featureFlags?.fileUpload) {
      logInfo('☁️  AWS S3 configuration detected and enabled');
      servicesInitialized++;
    } else {
      logWarn('⚠️  AWS S3 not configured - file upload disabled');
    }
    
    // Initialize OpenAI if configured
    if (config.openai?.apiKey && config.featureFlags?.aiFeatures) {
      logInfo('🤖 OpenAI API configuration detected and enabled');
      servicesInitialized++;
    } else {
      logWarn('⚠️  OpenAI API not configured - AI features disabled');
    }
    
    // Initialize Razorpay if configured
    if (config.payment?.razorpay?.keyId && config.featureFlags?.paymentIntegration) {
      logInfo('💳 Razorpay payment configuration detected and enabled');
      servicesInitialized++;
    } else {
      logWarn('⚠️  Razorpay not configured - using manual payment verification');
    }
    
    // Initialize email service if configured
    if (config.email?.smtp?.auth?.user && config.featureFlags?.emailNotifications) {
      logInfo('📧 Email service configuration detected and enabled');
      servicesInitialized++;
    } else {
      logWarn('⚠️  Email service not configured - email notifications disabled');
    }
    
    // Initialize Twilio if configured
    if (config.twilio?.accountSid && config.featureFlags?.smsNotifications) {
      logInfo('📱 Twilio SMS configuration detected and enabled');
      servicesInitialized++;
    } else {
      logWarn('⚠️  Twilio not configured - SMS notifications disabled');
    }
    
    logInfo(`🔧 Initialized ${servicesInitialized} external services`);
    return true;
  } catch (error) {
    logWarn('⚠️  Some services could not be initialized', { error: error.message });
    // Don't throw error for service initialization failures
    return false;
  }
};

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

/**
 * Graceful shutdown handling
 */
const gracefulShutdown = (signal) => {
  logInfo(`🛑 ${signal} received. Starting graceful shutdown...`);
  
  // Close database connections
  const { closeDatabase } = require('./shared/config/database');
  closeDatabase()
    .then(() => {
      logInfo('✅ Database connections closed');
    })
    .catch((error) => {
      logError('❌ Error closing database connections', { error: error.message });
    })
    .finally(() => {
      logInfo('👋 Graceful shutdown completed');
      process.exit(0);
    });
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logError('❌ Uncaught Exception', { error: error.message, stack: error.stack });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError('❌ Unhandled Promise Rejection', { reason, promise });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// ============================================
// EXPORTS
// ============================================

// Export the app and initialization function
module.exports = app;
module.exports.initializeApp = initializeApp;
module.exports.gracefulShutdown = gracefulShutdown;