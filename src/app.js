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
const { log, successResponse } = require('./shared/utils');

// ============================================
// CREATE EXPRESS APPLICATION
// ============================================

const app = express();

// ============================================
// TRUST PROXY (FOR DEPLOYMENT)
// ============================================

if (config.server.environment === 'production') {
  app.set('trust proxy', 1);
}

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Basic security headers
app.use(securityMiddleware);

// CORS configuration
app.use(corsMiddleware);

// ============================================
// REQUEST PARSING MIDDLEWARE
// ============================================

// JSON body parser
app.use(jsonParser);

// URL encoded parser
app.use(urlencodedParser);

// ============================================
// LOGGING MIDDLEWARE
// ============================================

// Request logging (only in development and staging)
if (config.server.environment !== 'production') {
  app.use(requestLogger);
}

// ============================================
// STATIC FILES (IF NEEDED)
// ============================================

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
      uptime: process.uptime()
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
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      database: dbHealth,
      features: {
        aiEnabled: config.featureFlags.aiFeatures,
        paymentsEnabled: config.featureFlags.paymentIntegration,
        emailEnabled: config.featureFlags.emailNotifications,
        fileUploadEnabled: config.featureFlags.fileUpload
      }
    };
    
    const statusCode = dbHealth.status === 'connected' ? 200 : 503;
    
    res.status(statusCode).json(
      successResponse('Detailed health check', healthStatus, statusCode)
    );
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// API ROUTES SETUP
// ============================================

/**
 * API version prefix
 */
const API_PREFIX = `/api/${config.server.apiVersion}`;

/**
 * Welcome endpoint
 */
app.get(API_PREFIX, (req, res) => {
  res.json(
    successResponse('Welcome to CreatorsMantra API', {
      version: config.server.apiVersion,
      documentation: `${req.protocol}://${req.get('host')}${API_PREFIX}/docs`,
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

// Authentication routes
try {
  const authRoutes = require('./modules/auth/routes');
  app.use(`${API_PREFIX}/auth`, authRoutes);
  log('info', 'Auth routes loaded successfully');
} catch (error) {
  log('warn', 'Auth routes not found - module may not be implemented yet');
}

// Deal CRM routes
try {
  const dealRoutes = require('./modules/deals/routes');
  app.use(`${API_PREFIX}/deals`, dealRoutes);
  log('info', 'Deal routes loaded successfully');
} catch (error) {
  log('warn', 'Deal routes not found - module may not be implemented yet');
}

// Invoice routes
try {
  const invoiceRoutes = require('./modules/invoices/routes');
  app.use(`${API_PREFIX}/invoices`, invoiceRoutes);
  log('info', 'Invoice routes loaded successfully');
} catch (error) {
  log('warn', 'Invoice routes not found - module may not be implemented yet');
}

// Rate card routes
try {
  const rateCardRoutes = require('./modules/ratecards/routes');
  app.use(`${API_PREFIX}/ratecards`, rateCardRoutes);
  log('info', 'Rate card routes loaded successfully');
} catch (error) {
  log('warn', 'Rate card routes not found - module may not be implemented yet');
}

// Brief analyzer routes
try {
  const briefRoutes = require('./modules/briefs/routes');
  app.use(`${API_PREFIX}/briefs`, briefRoutes);
  log('info', 'Brief routes loaded successfully');
} catch (error) {
  log('warn', 'Brief routes not found - module may not be implemented yet');
}

// Performance vault routes
try {
  const performanceRoutes = require('./modules/performance/routes');
  app.use(`${API_PREFIX}/performance`, performanceRoutes);
  log('info', 'Performance routes loaded successfully');
} catch (error) {
  log('warn', 'Performance routes not found - module may not be implemented yet');
}

// Contract routes
try {
  const contractRoutes = require('./modules/contracts/routes');
  app.use(`${API_PREFIX}/contracts`, contractRoutes);
  log('info', 'Contract routes loaded successfully');
} catch (error) {
  log('warn', 'Contract routes not found - module may not be implemented yet');
}

// Subscription routes
try {
  const subscriptionRoutes = require('./modules/subscriptions/routes');
  app.use(`${API_PREFIX}/subscriptions`, subscriptionRoutes);
  log('info', 'Subscription routes loaded successfully');
} catch (error) {
  log('warn', 'Subscription routes not found - module may not be implemented yet');
}

// Agency routes
try {
  const agencyRoutes = require('./modules/agency/routes');
  app.use(`${API_PREFIX}/agency`, agencyRoutes);
  log('info', 'Agency routes loaded successfully');
} catch (error) {
  log('warn', 'Agency routes not found - module may not be implemented yet');
}

// ============================================
// API DOCUMENTATION (PLACEHOLDER)
// ============================================

/**
 * API documentation endpoint
 * TODO: Implement Swagger/OpenAPI documentation
 */
app.get(`${API_PREFIX}/docs`, (req, res) => {
  res.json(
    successResponse('API Documentation', {
      message: 'API documentation will be available here',
      swagger: 'Coming soon',
      postman: 'Collection available on request',
      contact: 'support@creatorsmantra.com'
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
    log('info', 'Initializing CreatorsMantra Backend Application');
    
    // Initialize database connection
    await initializeDatabase();
    
    // Initialize external services if needed
    await initializeServices();
    
    log('info', 'Application initialized successfully');
    return true;
  } catch (error) {
    log('error', 'Application initialization failed', { error: error.message });
    throw error;
  }
};

/**
 * Initialize external services
 */
const initializeServices = async () => {
  try {
    // Initialize AWS S3 if configured
    if (config.aws.accessKeyId && config.featureFlags.fileUpload) {
      log('info', 'AWS S3 configuration detected');
    }
    
    // Initialize OpenAI if configured
    if (config.openai.apiKey && config.featureFlags.aiFeatures) {
      log('info', 'OpenAI API configuration detected');
    }
    
    // Initialize Razorpay if configured
    if (config.payment.razorpay.keyId && config.featureFlags.paymentIntegration) {
      log('info', 'Razorpay payment configuration detected');
    }
    
    // Initialize email service if configured
    if (config.email.smtp.auth.user && config.featureFlags.emailNotifications) {
      log('info', 'Email service configuration detected');
    }
    
    return true;
  } catch (error) {
    log('warn', 'Some services could not be initialized', { error: error.message });
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
  log('info', `${signal} received. Starting graceful shutdown...`);
  
  // Close server and database connections
  // This will be handled by the server.js file
  process.exit(0);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// EXPORTS
// ============================================

// Export the app and initialization function
module.exports = app;
module.exports.initializeApp = initializeApp;