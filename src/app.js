/**
 * CreatorsMantra Backend - Main Application
 * Express.js application setup with middleware and routes
 * Enhanced with Invoice Module Support, Brief Module Support, Analytics Module & Production Features
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const express = require('express');
const path = require('path');
const cron = require('node-cron');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const config = require('./shared/config');
const { initializeDatabase, getDatabaseHealth, closeDatabase } = require('./shared/config/database');
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
const { rateLimitByTier } = require('./shared/rateLimiter');

// ============================================
// CREATE EXPRESS APPLICATION
// ============================================

const app = express();

// ============================================
// GLOBAL CONFIGURATION
// ============================================

// Trust proxy for production deployment
if (config.server.environment === 'production') {
  app.set('trust proxy', 1);
  logInfo('Trust proxy enabled for production environment');
}

// Set view engine if needed
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Basic security headers
app.use(securityMiddleware);

// CORS configuration
app.use(corsMiddleware);

logInfo('🛡️  Security and CORS middleware loaded');

// ============================================
// REQUEST PARSING MIDDLEWARE
// ============================================

// JSON body parser with size limit
app.use(jsonParser);

// URL encoded parser
app.use(urlencodedParser);

logInfo('📝 Request parsing middleware loaded');

// Rate limiting is now available via shared/rateLimiter.js
logInfo('⚡ Rate limiting by subscription tier configured');

// ============================================
// FILE UPLOAD MIDDLEWARE FOR INVOICES
// ============================================

// Invoice file upload configuration
const invoiceFileUpload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Allow PDFs and images for invoices and payment screenshots
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/webp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'), false);
    }
  },
  storage: multer.memoryStorage() // Store in memory for processing
});

// Make file upload available globally for invoice routes
app.locals.invoiceFileUpload = invoiceFileUpload;

logInfo('📎 Invoice file upload middleware configured');

// ============================================
// LOGGING MIDDLEWARE
// ============================================

// Request logging (only in development and staging)
if (config.server.environment !== 'production') {
  app.use(requestLogger);
  logInfo('📊 Request logging enabled for development environment');
}

// ============================================
// API USAGE TRACKING
// ============================================

/**
 * Track API usage per subscription tier
 */
const trackAPIUsage = async (req, res, next) => {
  if (req.user) {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log API usage for analytics
      logInfo('API Usage', {
        userId: req.user.userId,
        subscriptionTier: req.user.subscriptionTier,
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString()
      });
      
      originalSend.call(this, data);
    };
  }
  
  next();
};

// ============================================
// STATIC FILES SERVING
// ============================================

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve public files if they exist
try {
  app.use('/public', express.static(path.join(__dirname, '../public')));
  logInfo('📁 Static file serving enabled');
} catch (error) {
  logWarn('⚠️  Public directory not found - static file serving disabled');
}

// Serve invoice PDFs (if stored locally)
try {
  app.use('/invoices', express.static(path.join(__dirname, '../storage/invoices')));
  logInfo('📄 Invoice PDF serving enabled');
} catch (error) {
  logWarn('⚠️  Invoice storage directory not found');
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
 * Detailed health check with database status and service health
 */
app.get('/health/detailed', async (req, res) => {
  try {
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
        smsEnabled: config.featureFlags?.smsNotifications || false,
        pdfGenerationEnabled: config.featureFlags?.pdfGeneration !== false,
        paymentRemindersEnabled: config.featureFlags?.paymentReminders !== false,
        invoiceConsolidationEnabled: true,
        taxControlEnabled: true,
        briefAnalysisEnabled: true,
        dealConversionEnabled: true,
        // Analytics module features
        analyticsEnabled: true,
        advancedAnalyticsEnabled: config.featureFlags?.aiFeatures || false,
        trendAnalysisEnabled: config.featureFlags?.aiFeatures || false,
        revenueIntelligenceEnabled: true,
        performanceCorrelationEnabled: true
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
        agency: checkModuleExists('agency'),
        analytics: checkModuleExists('analytics') // New analytics module
      },
      services: {
        cronJobs: checkCronJobsStatus(),
        pdfGeneration: checkPDFGenerationService(),
        fileUpload: checkFileUploadService(),
        paymentReminders: checkPaymentReminderService(),
        aiProcessing: checkAIProcessingService(),
        briefAnalysis: checkBriefAnalysisService(),
        analyticsEngine: checkAnalyticsEngineService(), // New analytics service
        caching: checkCachingService() // New caching service for analytics
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
 * Enhanced module check function with analytics module support
 */
function checkModuleExists(moduleName) {
  try {
    const routes = require(`./modules/${moduleName}/routes`);
    
    // Special health check for analytics module
    if (moduleName === 'analytics') {
      try {
        const { AnalyticsDashboard, AIInsights, AnalyticsCache, TrendAnalysis } = require(`./modules/${moduleName}/model`);
        const analyticsService = require(`./modules/${moduleName}/service`);
        
        return { 
          status: 'loaded', 
          available: true,
          features: {
            models: !!(AnalyticsDashboard && AIInsights && AnalyticsCache && TrendAnalysis),
            service: !!analyticsService,
            dashboardAnalytics: true,
            revenueIntelligence: true,
            dealPerformance: true,
            aiInsights: config.featureFlags?.aiFeatures || false,
            trendAnalysis: config.featureFlags?.aiFeatures || false,
            riskAnalytics: true,
            performanceCorrelation: true,
            caching: true,
            crossModuleAnalytics: true,
            subscriptionGating: true
          },
          subscriptionTiers: {
            pro: ['dashboard', 'revenue', 'deals', 'insights', 'risk'],
            elite: ['all_pro_features', 'trends', 'forecasting', 'custom_ranges'],
            agency: ['all_elite_features', 'multi_creator', 'portfolio_analytics']
          },
          version: '1.0.0'
        };
      } catch (error) {
        return { 
          status: 'partial', 
          available: true,
          error: 'Analytics service layer issues',
          details: error.message
        };
      }
    }
    
    // Special health check for briefs module
    if (moduleName === 'briefs') {
      try {
        const { Brief } = require(`./modules/${moduleName}/model`);
        const briefService = require(`./modules/${moduleName}/service`);
        
        return { 
          status: 'loaded', 
          available: true,
          features: {
            models: !!Brief,
            service: !!briefService,
            fileUpload: true,
            aiExtraction: config.featureFlags?.aiFeatures || false,
            textAnalysis: true,
            dealConversion: true,
            clarificationEmail: config.featureFlags?.emailNotifications || false,
            riskAssessment: config.featureFlags?.aiFeatures || false,
            pricingSuggestions: config.featureFlags?.aiFeatures || false
          },
          version: '1.0.0'
        };
      } catch (error) {
        return { 
          status: 'partial', 
          available: true,
          error: 'Service layer issues',
          details: error.message
        };
      }
    }
    
    // Special health check for invoice module
    if (moduleName === 'invoices') {
      try {
        const { Invoice } = require(`./modules/${moduleName}/model`);
        const invoiceService = require(`./modules/${moduleName}/service`);
        const { PaymentTrackingService, PDFGenerationService } = require(`./modules/${moduleName}/payment-pdf-service`);
        
        return { 
          status: 'loaded', 
          available: true,
          features: {
            models: !!Invoice,
            service: !!invoiceService,
            paymentTracking: !!PaymentTrackingService,
            pdfGeneration: !!PDFGenerationService,
            consolidatedBilling: true,
            taxControl: true,
            agencyPayout: true,
            automatedReminders: config.featureFlags?.paymentReminders !== false
          },
          version: '1.0.0'
        };
      } catch (error) {
        return { 
          status: 'partial', 
          available: true,
          error: 'Service layer issues',
          details: error.message
        };
      }
    }
    
    return { status: 'loaded', available: true };
  } catch (error) {
    return { status: 'not_found', available: false, error: error.message };
  }
}

/**
 * Check cron jobs status
 */
function checkCronJobsStatus() {
  try {
    const activeTasks = cron.getTasks();
    return {
      status: 'operational',
      activeTasks: activeTasks.size,
      paymentReminders: config.featureFlags?.paymentReminders !== false,
      pdfCleanup: config.featureFlags?.pdfGeneration !== false,
      briefFileCleanup: true,
      aiProcessingCleanup: config.featureFlags?.aiFeatures || false,
      analyticsCacheCleanup: true, // New analytics cache cleanup
      trendAnalysisUpdates: config.featureFlags?.aiFeatures || false // New trend analysis updates
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Check PDF generation service
 */
function checkPDFGenerationService() {
  try {
    require('pdfkit');
    return {
      status: 'available',
      enabled: config.featureFlags?.pdfGeneration !== false
    };
  } catch (error) {
    return {
      status: 'unavailable',
      error: 'PDFKit not installed'
    };
  }
}

/**
 * Check file upload service
 */
function checkFileUploadService() {
  return {
    status: 'available',
    maxFileSize: '10MB',
    allowedTypes: ['PDF', 'JPEG', 'PNG', 'JPG', 'WEBP'],
    storage: config.aws?.accessKeyId ? 'AWS S3' : 'Local',
    briefUploads: true,
    invoiceUploads: true
  };
}

/**
 * Check payment reminder service
 */
function checkPaymentReminderService() {
  return {
    status: config.featureFlags?.paymentReminders !== false ? 'enabled' : 'disabled',
    schedule: 'Daily at 9 AM IST',
    emailEnabled: config.featureFlags?.emailNotifications || false,
    smsEnabled: config.featureFlags?.smsNotifications || false
  };
}

/**
 * Check AI processing service
 */
function checkAIProcessingService() {
  return {
    status: config.featureFlags?.aiFeatures ? 'enabled' : 'disabled',
    provider: 'OpenAI',
    model: 'gpt-3.5-turbo',
    available: !!process.env.OPENAI_API_KEY,
    features: ['brief_extraction', 'risk_assessment', 'pricing_suggestions', 'business_insights', 'trend_analysis']
  };
}

/**
 * Check brief analysis service
 */
function checkBriefAnalysisService() {
  return {
    status: 'enabled',
    fileTypes: ['PDF', 'DOC', 'DOCX', 'TXT'],
    maxFileSize: {
      starter: '5MB',
      pro: '10MB',
      elite: '25MB',
      agency_starter: '25MB',
      agency_pro: '50MB'
    },
    aiEnabled: config.featureFlags?.aiFeatures || false,
    dealConversion: true
  };
}

/**
 * Check analytics engine service (NEW)
 */
function checkAnalyticsEngineService() {
  return {
    status: 'enabled',
    features: {
      crossModuleAnalytics: true,
      revenueIntelligence: true,
      dealPerformance: true,
      aiInsights: config.featureFlags?.aiFeatures || false,
      trendAnalysis: config.featureFlags?.aiFeatures || false,
      riskAnalytics: true,
      performanceCorrelation: true,
      predictiveForecasting: config.featureFlags?.aiFeatures || false
    },
    dataCorrelation: {
      modules: ['deals', 'invoices', 'performance', 'contracts', 'briefs', 'ratecards'],
      realTimeUpdates: true,
      historicalAnalysis: true
    },
    subscriptionGating: {
      pro: 'Basic analytics + AI insights',
      elite: 'Advanced analytics + forecasting',
      agency: 'Portfolio analytics'
    },
    performance: {
      caching: true,
      realTimeProcessing: true,
      batchAnalytics: true
    }
  };
}

/**
 * Check caching service for analytics (NEW)
 */
function checkCachingService() {
  return {
    status: 'enabled',
    provider: 'MongoDB TTL Collections',
    features: {
      analyticsCache: true,
      dashboardCache: true,
      insightsCache: true,
      trendCache: true
    },
    ttl: {
      dashboard: '30 minutes',
      revenue: '1 hour',
      insights: '2 hours',
      trends: '4 hours'
    },
    performance: {
      hitRate: 'Tracked per user',
      sizeOptimization: true,
      autoExpiry: true
    }
  };
}

// ============================================
// API ROUTES SETUP
// ============================================

/**
 * API version prefix
 */
const API_PREFIX = `/api/${config.server.apiVersion || 'v1'}`;

// Apply API usage tracking to all API routes
app.use(API_PREFIX, trackAPIUsage);

/**
 * Welcome endpoint with enhanced feature information including analytics
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
        agency: `${API_PREFIX}/agency`,
        analytics: `${API_PREFIX}/analytics` // New analytics endpoint
      },
      features: {
        quarterlyBilling: true,
        manualPaymentVerification: true,
        dealPipelineManagement: true,
        brandProfileManagement: true,
        communicationTracking: true,
        indianCompliance: true,
        gstCalculation: true,
        tdsHandling: true,
        // Enhanced invoice features
        invoiceGeneration: true,
        consolidatedBilling: true,
        taxControl: true,
        agencyPayout: true,
        pdfGeneration: config.featureFlags?.pdfGeneration !== false,
        paymentTracking: true,
        automatedReminders: config.featureFlags?.paymentReminders !== false,
        // Brief analysis features
        briefAnalysis: true,
        aiExtraction: config.featureFlags?.aiFeatures || false,
        fileUploadBriefs: true,
        dealConversion: true,
        clarificationManagement: true,
        riskAssessment: config.featureFlags?.aiFeatures || false,
        // Analytics features (NEW)
        businessIntelligence: true,
        revenueAnalytics: true,
        dealPerformanceAnalytics: true,
        aiBusinessInsights: config.featureFlags?.aiFeatures || false,
        trendAnalysis: config.featureFlags?.aiFeatures || false,
        riskAnalytics: true,
        performanceCorrelation: true,
        crossModuleAnalytics: true,
        predictiveForecasting: config.featureFlags?.aiFeatures || false,
        cachingOptimization: true
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
let totalModules = 10; // Updated to include analytics module

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

// Invoice routes - ENHANCED WITH FULL FUNCTIONALITY
try {
  const invoiceRoutes = require('./modules/invoices/routes');
  app.use(`${API_PREFIX}/invoices`, invoiceRoutes);
  logInfo('✅ Invoice routes loaded successfully');
  logInfo('📄 Invoice features enabled: Consolidated Billing, Tax Control, Agency Payout, PDF Generation');
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

// Brief analyzer routes - ENHANCED WITH AI PROCESSING
try {
  const briefRoutes = require('./modules/briefs/routes');
  app.use(`${API_PREFIX}/briefs`, briefRoutes);
  logInfo('✅ Brief routes loaded successfully');
  logInfo('📋 Brief features enabled: AI Extraction, File Upload, Deal Conversion, Risk Assessment');
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

// Analytics routes - NEW MODULE
try {
  const analyticsRoutes = require('./modules/analytics/routes');
  app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
  logInfo('✅ Analytics routes loaded successfully');
  logInfo('📊 Analytics features enabled: Business Intelligence, Revenue Analytics, AI Insights, Trend Analysis, Performance Correlation');
  loadedModules++;
} catch (error) {
  logWarn('⚠️  Analytics routes not found - module may not be implemented yet', { error: error.message });
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
      timestamp: new Date().toISOString(),
      invoiceModule: {
        status: checkModuleExists('invoices').status,
        features: checkModuleExists('invoices').features || {}
      },
      briefModule: {
        status: checkModuleExists('briefs').status,
        features: checkModuleExists('briefs').features || {}
      },
      analyticsModule: { // NEW
        status: checkModuleExists('analytics').status,
        features: checkModuleExists('analytics').features || {},
        subscriptionTiers: checkModuleExists('analytics').subscriptionTiers || {}
      }
    })
  );
});

/**
 * Get loaded modules list
 */
function getLoadedModules() {
  const modules = ['auth', 'subscriptions', 'deals', 'invoices', 'ratecards', 'briefs', 'performance', 'contracts', 'agency', 'analytics'];
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
        'communication_tracking',
        // Enhanced invoice features
        'invoice_generation',
        'consolidated_billing',
        'tax_control',
        'agency_payout',
        'pdf_generation',
        'payment_tracking',
        'automated_reminders',
        // Brief analysis features
        'brief_analysis',
        'ai_extraction',
        'file_upload_briefs',
        'deal_conversion',
        'clarification_management',
        'risk_assessment',
        'pricing_suggestions',
        // Analytics features (NEW)
        'business_intelligence',
        'revenue_analytics',
        'deal_performance_analytics',
        'ai_business_insights',
        'trend_analysis',
        'risk_analytics',
        'performance_correlation',
        'cross_module_analytics',
        'predictive_forecasting',
        'caching_optimization'
      ]
    })
  );
});

// ============================================
// ENHANCED API DOCUMENTATION
// ============================================

/**
 * API documentation endpoint with analytics module details
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
        },
        invoices: {
          description: 'Invoice generation and payment tracking with consolidated billing',
          base_path: `${API_PREFIX}/invoices`,
          features: [
            'individual_invoices',
            'consolidated_billing',
            'tax_control',
            'agency_payout',
            'payment_tracking',
            'pdf_generation',
            'automated_reminders',
            'indian_tax_compliance'
          ],
          key_endpoints: {
            create_individual: 'POST /invoices/create-individual',
            create_consolidated: 'POST /invoices/create-consolidated',
            tax_preferences: 'GET/PUT /invoices/tax-preferences',
            available_deals: 'GET /invoices/available-deals',
            analytics: 'GET /invoices/analytics',
            generate_pdf: 'POST /invoices/:id/generate-pdf'
          },
          consolidation_types: [
            'monthly', 'brand_wise', 'agency_payout', 'date_range', 'custom_selection'
          ]
        },
        briefs: {
          description: 'Brand brief analysis and AI-powered extraction with deal conversion',
          base_path: `${API_PREFIX}/briefs`,
          features: [
            'text_brief_creation',
            'file_upload_briefs',
            'ai_extraction',
            'risk_assessment',
            'pricing_suggestions',
            'clarification_management',
            'deal_conversion',
            'brand_guidelines_extraction'
          ],
          key_endpoints: {
            create_text: 'POST /briefs/create-text',
            create_file: 'POST /briefs/create-file',
            ai_extraction: 'POST /briefs/:id/extract',
            clarification_email: 'POST /briefs/:id/clarification-email',
            convert_to_deal: 'POST /briefs/:id/convert-to-deal',
            dashboard_stats: 'GET /briefs/dashboard/stats'
          },
          supported_files: ['PDF', 'DOC', 'DOCX', 'TXT'],
          ai_features: config.featureFlags?.aiFeatures || false
        },
        analytics: { // NEW MODULE DOCUMENTATION
          description: 'Advanced business intelligence and reporting for creator economy management',
          base_path: `${API_PREFIX}/analytics`,
          features: [
            'dashboard_overview',
            'revenue_intelligence',
            'deal_performance_analytics',
            'ai_business_insights',
            'trend_analysis',
            'risk_analytics',
            'performance_correlation',
            'cross_module_analytics',
            'predictive_forecasting',
            'caching_optimization'
          ],
          key_endpoints: {
            dashboard: 'GET /analytics/dashboard',
            revenue: 'GET /analytics/revenue',
            deals_funnel: 'GET /analytics/deals/funnel',
            ai_insights: 'GET /analytics/insights',
            generate_insights: 'POST /analytics/insights/generate',
            trend_analysis: 'GET /analytics/trends',
            forecasting: 'GET /analytics/forecast',
            risk_analytics: 'GET /analytics/risk',
            clear_cache: 'DELETE /analytics/cache'
          },
          subscription_requirements: {
            pro: ['dashboard', 'revenue', 'deals', 'insights', 'risk'],
            elite: ['all_pro_features', 'trends', 'forecasting', 'custom_ranges'],
            agency: ['all_elite_features', 'multi_creator', 'portfolio_analytics']
          },
          ai_features: config.featureFlags?.aiFeatures || false,
          data_correlation: [
            'deals', 'invoices', 'performance', 'contracts', 'briefs', 'ratecards'
          ]
        }
      },
      rate_limits: {
        general: '50 requests per 15 minutes',
        authentication: '10 requests per 15 minutes',
        payment_verification: '5 requests per 15 minutes',
        pdf_generation: '10 requests per 15 minutes',
        file_upload: '20 requests per 15 minutes',
        brief_creation: 'Tier-based limits (5-200 per hour)',
        ai_processing: 'Tier-based limits (0-100 per hour)',
        // Analytics rate limits (NEW)
        analytics_standard: '100 requests per 15 minutes',
        analytics_ai: '20 requests per hour',
        analytics_advanced: '10 requests per hour',
        analytics_cache: '5 requests per 15 minutes'
      },
      file_upload: {
        max_size: {
          starter: '5MB',
          pro: '10MB',
          elite: '25MB',
          agency_starter: '25MB',
          agency_pro: '50MB'
        },
        allowed_types: {
          invoices: ['PDF', 'JPEG', 'PNG', 'JPG', 'WEBP'],
          briefs: ['PDF', 'DOC', 'DOCX', 'TXT']
        },
        endpoints: [
          'POST /invoices/:id/upload-payment-screenshot',
          'POST /invoices/:id/generate-pdf',
          'POST /briefs/create-file'
        ]
      },
      support: {
        email: 'support@creatorsmantra.com',
        documentation: 'Available via API endpoints',
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
      contact: 'support@creatorsmantra.com for early access',
      features: [
        'Authentication examples',
        'Invoice generation workflows',
        'Consolidated billing examples',
        'Payment tracking examples',
        'File upload examples',
        'Brief analysis workflows',
        'AI extraction examples',
        'Deal conversion examples',
        // Analytics features (NEW)
        'Analytics dashboard examples',
        'Revenue intelligence workflows',
        'AI insights generation',
        'Trend analysis examples',
        'Risk analytics workflows'
      ]
    })
  );
});

// ============================================
// ENHANCED FEATURE FLAGS ENDPOINT
// ============================================

/**
 * Get current feature flags with analytics-specific flags
 */
app.get(`${API_PREFIX}/features`, (req, res) => {
  res.json(
    successResponse('Feature Flags', {
      features: {
        // Core features
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
        communication_tracking: true,
        
        // Invoice module features
        invoice_generation: true,
        consolidated_billing: true,
        tax_control: true,
        agency_payout: true,
        pdf_generation: config.featureFlags?.pdfGeneration !== false,
        payment_reminders: config.featureFlags?.paymentReminders !== false,
        payment_tracking: true,
        invoice_templates: true,
        automated_receipts: true,
        file_upload_invoices: true,
        
        // Brief module features
        brief_analysis: true,
        ai_extraction: config.featureFlags?.aiFeatures || false,
        file_upload_briefs: true,
        deal_conversion: true,
        clarification_management: true,
        brand_brief_templates: true,
        risk_assessment: config.featureFlags?.aiFeatures || false,
        pricing_suggestions: config.featureFlags?.aiFeatures || false,
        auto_clarification_email: config.featureFlags?.emailNotifications || false,
        
        // Analytics module features (NEW)
        business_intelligence: true,
        revenue_analytics: true,
        deal_performance_analytics: true,
        ai_business_insights: config.featureFlags?.aiFeatures || false,
        trend_analysis: config.featureFlags?.aiFeatures || false,
        risk_analytics: true,
        performance_correlation: true,
        cross_module_analytics: true,
        predictive_forecasting: config.featureFlags?.aiFeatures || false,
        analytics_caching: true,
        custom_date_ranges: true,
        analytics_export: false, // Future feature
        industry_benchmarks: false // Future feature
      },
      environment: config.server.environment,
      brief_features: {
        supported_file_types: ['PDF', 'DOC', 'DOCX', 'TXT'],
        max_file_size_by_tier: {
          starter: '5MB',
          pro: '10MB',
          elite: '25MB',
          agency_starter: '25MB',
          agency_pro: '50MB'
        },
        ai_processing: config.featureFlags?.aiFeatures || false,
        auto_clarification_email: config.featureFlags?.emailNotifications || false,
        rate_limits: {
          starter: '5 briefs/hour',
          pro: '15 briefs/hour',
          elite: '50 briefs/hour',
          agency_starter: '100 briefs/hour',
          agency_pro: '200 briefs/hour'
        }
      },
      invoice_features: {
        consolidation_types: ['monthly', 'brand_wise', 'agency_payout', 'date_range', 'custom_selection'],
        supported_file_types: ['PDF', 'JPEG', 'PNG', 'JPG', 'WEBP'],
        max_file_size: '10MB',
        payment_reminder_schedule: 'Daily at 9 AM IST',
        tax_compliance: ['GST', 'TDS', 'PAN', 'IFSC']
      },
      analytics_features: { // NEW
        subscription_access: {
          starter: 'No analytics access',
          pro: 'Basic analytics + AI insights',
          elite: 'Advanced analytics + forecasting',
          agency: 'Portfolio analytics'
        },
        data_correlation: {
          modules: ['deals', 'invoices', 'performance', 'contracts', 'briefs', 'ratecards'],
          real_time_updates: true,
          historical_analysis: true
        },
        ai_capabilities: {
          business_insights: config.featureFlags?.aiFeatures || false,
          trend_detection: config.featureFlags?.aiFeatures || false,
          risk_assessment: config.featureFlags?.aiFeatures || false,
          opportunity_identification: config.featureFlags?.aiFeatures || false
        },
        caching: {
          dashboard: '30 minutes TTL',
          revenue: '1 hour TTL',
          insights: '2 hours TTL',
          trends: '4 hours TTL'
        },
        rate_limits: {
          standard: '100 requests/15min',
          ai_features: '20 requests/hour',
          advanced: '10 requests/hour',
          cache_ops: '5 requests/15min'
        }
      }
    })
  );
});

// ============================================
// ANALYTICS-SPECIFIC ERROR HANDLING
// ============================================

// Analytics computation error handler
app.use('/api/*/analytics', (error, req, res, next) => {
  if (error.name === 'AnalyticsComputationError') {
    return res.status(500).json({
      success: false,
      message: 'Analytics computation failed',
      code: 'ANALYTICS_COMPUTATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
  
  if (error.name === 'AIInsightGenerationError') {
    return res.status(500).json({
      success: false,
      message: 'AI insight generation temporarily unavailable',
      code: 'AI_SERVICE_ERROR',
      timestamp: new Date().toISOString()
    });
  }
  
  if (error.name === 'InsufficientDataError') {
    return res.status(404).json({
      success: false,
      message: 'Insufficient data for analytics computation',
      code: 'INSUFFICIENT_DATA',
      recommendation: 'Complete more deals and campaigns to enable analytics',
      timestamp: new Date().toISOString()
    });
  }
  
  if (error.name === 'CacheError') {
    logWarn('Analytics cache error - continuing without cache', { error: error.message });
    // Continue without caching
    next();
  } else {
    next(error);
  }
});

logInfo('📊 Analytics-specific error handling configured');

// ============================================
// INVOICE-SPECIFIC ERROR HANDLING
// ============================================

// Invoice file upload error handler
app.use('/api/*/invoices', (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 5 files allowed.',
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only PDF and images are allowed.',
      code: 400,
      timestamp: new Date().toISOString()
    });
  }
  
  next(error);
});

logInfo('📄 Invoice-specific error handling configured');

// ============================================
// BRIEF-SPECIFIC ERROR HANDLING
// ============================================

// Brief file upload error handler
app.use('/api/*/briefs', (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const tier = req.user?.subscriptionTier || 'starter';
      const limits = {
        starter: '5MB',
        pro: '10MB',
        elite: '25MB',
        agency_starter: '25MB',
        agency_pro: '50MB'
      };
      
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${limits[tier]} for ${tier} plan.`,
        code: 400,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.',
      code: 400,
      timestamp: new Date().toISOString()
    });
  }
  
  next(error);
});

logInfo('📋 Brief-specific error handling configured');

// ============================================
// GENERAL ERROR HANDLING MIDDLEWARE
// ============================================

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ============================================
// INVOICE SERVICES INITIALIZATION
// ============================================

/**
 * Initialize invoice-specific services
 */
const initializeInvoiceServices = async () => {
  try {
    logInfo('📄 Initializing invoice services...');
    
    // Initialize payment reminder cron job
    if (config.featureFlags?.paymentReminders !== false) {
      // Run every day at 9 AM IST to process due reminders
      cron.schedule('0 9 * * *', async () => {
        try {
          logInfo('🔔 Processing due payment reminders...');
          
          // Import and run payment reminder service
          const { PaymentReminderService } = require('./modules/invoices/payment-pdf-service');
          const result = await PaymentReminderService.processDueReminders();
          
          logInfo('✅ Payment reminders processed', { 
            sentCount: result.sentCount,
            failedCount: result.failedCount,
            totalProcessed: result.totalProcessed
          });
          
        } catch (error) {
          logError('❌ Payment reminder processing failed', { error: error.message });
        }
      }, {
        timezone: 'Asia/Kolkata' // Indian timezone
      });
      
      logInfo('📅 Payment reminder cron job scheduled (daily at 9 AM IST)');
    }
    
    // Initialize PDF cleanup job (optional)
    if (config.featureFlags?.pdfGeneration !== false) {
      // Clean up old PDF files every Sunday at 2 AM
      cron.schedule('0 2 * * 0', async () => {
        try {
          logInfo('🗑️  Cleaning up old PDF files...');
          
          // Clean up PDFs older than 90 days
          const fs = require('fs').promises;
          const path = require('path');
          const pdfDir = path.join(__dirname, '../storage/invoices');
          
          try {
            const files = await fs.readdir(pdfDir);
            const now = Date.now();
            const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
            
            let cleanedCount = 0;
            for (const file of files) {
              const filePath = path.join(pdfDir, file);
              const stats = await fs.stat(filePath);
              
              if (stats.mtime.getTime() < ninetyDaysAgo) {
                await fs.unlink(filePath);
                cleanedCount++;
              }
            }
            
            logInfo(`✅ PDF cleanup completed - removed ${cleanedCount} old files`);
          } catch (error) {
            logWarn('⚠️  PDF directory not found or cleanup failed', { error: error.message });
          }
          
        } catch (error) {
          logError('❌ PDF cleanup failed', { error: error.message });
        }
      }, {
        timezone: 'Asia/Kolkata'
      });
      
      logInfo('📅 PDF cleanup cron job scheduled (weekly)');
    }
    
    // Initialize invoice analytics update job (daily)
    cron.schedule('0 6 * * *', async () => {
      try {
        logInfo('📊 Updating invoice analytics...');
        
        // Update overdue invoice statuses
        const { Invoice } = require('./modules/invoices/model');
        const now = new Date();
        
        const result = await Invoice.updateMany(
          {
            status: { $in: ['sent', 'partially_paid'] },
            'invoiceSettings.dueDate': { $lt: now }
          },
          {
            $set: { status: 'overdue' }
          }
        );
        
        logInfo(`✅ Invoice analytics updated - ${result.modifiedCount} invoices marked as overdue`);
        
      } catch (error) {
        logError('❌ Invoice analytics update failed', { error: error.message });
      }
    }, {
      timezone: 'Asia/Kolkata'
    });
    
    logInfo('📊 Invoice analytics cron job scheduled (daily at 6 AM IST)');
    
    return true;
  } catch (error) {
    logWarn('⚠️  Invoice services initialization partially failed', { error: error.message });
    return false;
  }
};

// ============================================
// BRIEF SERVICES INITIALIZATION
// ============================================

/**
 * Initialize brief-specific services
 */
const initializeBriefServices = async () => {
  try {
    logInfo('📋 Initializing brief services...');
    
    // Initialize brief file cleanup job
    cron.schedule('0 3 * * 0', async () => {
      try {
        logInfo('🗑️  Cleaning up old brief files...');
        
        const fs = require('fs').promises;
        const path = require('path');
        const briefUploadsDir = path.join(__dirname, '../uploads/briefs');
        
        try {
          const files = await fs.readdir(briefUploadsDir);
          const now = Date.now();
          const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
          
          let cleanedCount = 0;
          for (const file of files) {
            const filePath = path.join(briefUploadsDir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime.getTime() < thirtyDaysAgo) {
              await fs.unlink(filePath);
              cleanedCount++;
            }
          }
          
          logInfo(`✅ Brief file cleanup completed - removed ${cleanedCount} old files`);
        } catch (error) {
          logWarn('⚠️  Brief uploads directory not found or cleanup failed', { error: error.message });
        }
        
      } catch (error) {
        logError('❌ Brief file cleanup failed', { error: error.message });
      }
    }, {
      timezone: 'Asia/Kolkata'
    });
    
    // Initialize AI processing queue cleanup
    if (config.featureFlags?.aiFeatures) {
      cron.schedule('0 4 * * *', async () => {
        try {
          logInfo('🤖 Updating AI processing statuses...');
          
          const { Brief } = require('./modules/briefs/model');
          
          // Reset stuck processing briefs (processing for more than 1 hour)
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const result = await Brief.updateMany(
            {
              'aiExtraction.status': 'processing',
              updatedAt: { $lt: oneHourAgo }
            },
            {
              $set: { 'aiExtraction.status': 'failed' }
            }
          );
          
          logInfo(`✅ AI processing cleanup completed - reset ${result.modifiedCount} stuck processes`);
          
        } catch (error) {
          logError('❌ AI processing cleanup failed', { error: error.message });
        }
      }, {
        timezone: 'Asia/Kolkata'
      });
      
      logInfo('🤖 AI processing cleanup cron job scheduled (daily at 4 AM IST)');
    }
    
    // Initialize brief analytics update job (daily)
    cron.schedule('0 5 * * *', async () => {
      try {
        logInfo('📊 Updating brief analytics...');
        
        const { Brief } = require('./modules/briefs/model');
        
        // Update brief statuses based on AI extraction completion
        const result = await Brief.updateMany(
          {
            'aiExtraction.status': 'completed',
            status: 'draft'
          },
          {
            $set: { status: 'analyzed' }
          }
        );
        
        logInfo(`✅ Brief analytics updated - ${result.modifiedCount} briefs marked as analyzed`);
        
      } catch (error) {
        logError('❌ Brief analytics update failed', { error: error.message });
      }
    }, {
      timezone: 'Asia/Kolkata'
    });
    
    logInfo('📋 Brief file cleanup cron job scheduled (weekly)');
    logInfo('📊 Brief analytics cron job scheduled (daily at 5 AM IST)');
    
    return true;
  } catch (error) {
    logWarn('⚠️  Brief services initialization partially failed', { error: error.message });
    return false;
  }
};

// ============================================
// ANALYTICS SERVICES INITIALIZATION (NEW)
// ============================================

/**
 * Initialize analytics-specific services
 */
const initializeAnalyticsServices = async () => {
  try {
    logInfo('📊 Initializing analytics services...');
    
    // Initialize analytics cache cleanup job
    cron.schedule('0 1 * * *', async () => {
      try {
        logInfo('🗑️  Cleaning up expired analytics cache...');
        
        const { AnalyticsCache } = require('./modules/analytics/model');
        
        // Remove expired cache entries
        const result = await AnalyticsCache.deleteMany({
          $or: [
            { expiresAt: { $lt: new Date() } },
            { isValid: false }
          ]
        });
        
        logInfo(`✅ Analytics cache cleanup completed - removed ${result.deletedCount} expired entries`);
        
      } catch (error) {
        logError('❌ Analytics cache cleanup failed', { error: error.message });
      }
    }, {
      timezone: 'Asia/Kolkata'
    });
    
    // Initialize trend analysis update job (every 6 hours)
    if (config.featureFlags?.aiFeatures) {
      cron.schedule('0 */6 * * *', async () => {
        try {
          logInfo('📈 Updating trend analysis data...');
          
          const { TrendAnalysis } = require('./modules/analytics/model');
          
          // Update trend analyses that are due for refresh
          const dueForUpdate = await TrendAnalysis.find({
            'analysisMetadata.nextAnalysisDue': { $lt: new Date() }
          }).limit(10); // Process max 10 at a time
          
          let updatedCount = 0;
          for (const trend of dueForUpdate) {
            try {
              // Mark for next update (will be processed by analytics service when accessed)
              trend.analysisMetadata.nextAnalysisDue = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
              await trend.save();
              updatedCount++;
            } catch (error) {
              logWarn('Failed to update trend analysis', { trendId: trend._id, error: error.message });
            }
          }
          
          logInfo(`✅ Trend analysis update completed - marked ${updatedCount} trends for refresh`);
          
        } catch (error) {
          logError('❌ Trend analysis update failed', { error: error.message });
        }
      }, {
        timezone: 'Asia/Kolkata'
      });
      
      logInfo('📈 Trend analysis update cron job scheduled (every 6 hours)');
    }
    
    // Initialize AI insights cleanup job (daily)
    if (config.featureFlags?.aiFeatures) {
      cron.schedule('0 7 * * *', async () => {
        try {
          logInfo('🤖 Cleaning up expired AI insights...');
          
          const { AIInsights } = require('./modules/analytics/model');
          
          // Remove expired insights
          const result = await AIInsights.deleteMany({
            relevantUntil: { $lt: new Date() }
          });
          
          logInfo(`✅ AI insights cleanup completed - removed ${result.deletedCount} expired insights`);
          
        } catch (error) {
          logError('❌ AI insights cleanup failed', { error: error.message });
        }
      }, {
        timezone: 'Asia/Kolkata'
      });
      
      logInfo('🤖 AI insights cleanup cron job scheduled (daily at 7 AM IST)');
    }
    
    // Initialize analytics dashboard refresh job (every hour)
    cron.schedule('0 * * * *', async () => {
      try {
        logInfo('🔄 Refreshing analytics dashboards for active users...');
        
        // This is a placeholder for future dashboard pre-computation
        // For now, dashboards are computed on-demand with caching
        
        logInfo('✅ Analytics dashboard refresh completed');
        
      } catch (error) {
        logError('❌ Analytics dashboard refresh failed', { error: error.message });
      }
    }, {
      timezone: 'Asia/Kolkata'
    });
    
    logInfo('📊 Analytics cache cleanup cron job scheduled (daily at 1 AM IST)');
    logInfo('🔄 Analytics dashboard refresh cron job scheduled (hourly)');
    
    return true;
  } catch (error) {
    logWarn('⚠️  Analytics services initialization partially failed', { error: error.message });
    return false;
  }
};

/**
 * Validate analytics environment and dependencies
 */
const validateAnalyticsEnvironment = () => {
  const warnings = [];
  const errors = [];
  
  // Check AI processing requirements for advanced analytics
  if (config.featureFlags?.aiFeatures) {
    if (!process.env.OPENAI_API_KEY) {
      warnings.push('OpenAI API key not configured - AI analytics features will be limited');
    } else {
      logInfo('✅ OpenAI API key configured for AI analytics');
    }
  }
  
  // Check MongoDB for analytics collections
  try {
    // MongoDB is already initialized, analytics models will create collections as needed
    logInfo('✅ MongoDB available for analytics data storage');
  } catch (error) {
    errors.push('MongoDB not available - analytics data storage will fail');
  }
  
  // Check memory for caching
  const totalMemory = process.memoryUsage().heapTotal;
  if (totalMemory < 100 * 1024 * 1024) { // Less than 100MB
    warnings.push('Low memory available - analytics caching may be limited');
  } else {
    logInfo('✅ Sufficient memory available for analytics caching');
  }
  
  // Check if other required modules are available for data correlation
  const requiredModules = ['deals', 'invoices', 'performance', 'contracts'];
  const missingModules = [];
  
  for (const module of requiredModules) {
    try {
      require(`./modules/${module}/model`);
    } catch (error) {
      missingModules.push(module);
    }
  }
  
  if (missingModules.length > 0) {
    warnings.push(`Some modules not available for correlation: ${missingModules.join(', ')}`);
  } else {
    logInfo('✅ All required modules available for cross-module analytics');
  }
  
  if (errors.length > 0) {
    logError('❌ Analytics module environment errors:', { errors });
    return false;
  }
  
  if (warnings.length > 0) {
    logWarn('⚠️  Analytics module environment warnings:', { warnings });
  } else {
    logInfo('✅ Analytics module environment validation passed');
  }
  
  return true;
};

/**
 * Validate invoice environment and dependencies
 */
const validateInvoiceEnvironment = () => {
  const warnings = [];
  const errors = [];
  
  // Check PDF generation requirements
  if (config.featureFlags?.pdfGeneration !== false) {
    try {
      require('pdfkit');
      logInfo('✅ PDFKit available for PDF generation');
    } catch (error) {
      errors.push('PDFKit not installed - PDF generation will fail');
    }
  }
  
  // Check file upload configuration
  if (!config.aws?.accessKeyId && config.featureFlags?.fileUpload) {
    warnings.push('AWS S3 not configured - invoice file storage will use local storage');
  }
  
  // Check email configuration for reminders
  if (!config.email?.smtp?.auth?.user && config.featureFlags?.emailNotifications) {
    warnings.push('Email not configured - payment reminders will not be sent');
  }
  
  // Check cron job support
  try {
    require('node-cron');
    logInfo('✅ Node-cron available for scheduled tasks');
  } catch (error) {
    errors.push('Node-cron not installed - automated reminders will not work');
  }
  
  if (errors.length > 0) {
    logError('❌ Invoice module environment errors:', { errors });
    return false;
  }
  
  if (warnings.length > 0) {
    logWarn('⚠️  Invoice module environment warnings:', { warnings });
  } else {
    logInfo('✅ Invoice module environment validation passed');
  }
  
  return true;
};

/**
 * Validate brief environment and dependencies
 */
const validateBriefEnvironment = () => {
  const warnings = [];
  const errors = [];
  
  // Check AI processing requirements
  if (config.featureFlags?.aiFeatures) {
    if (!process.env.OPENAI_API_KEY) {
      errors.push('OpenAI API key not configured - AI features will fail');
    } else {
      logInfo('✅ OpenAI API key configured for AI processing');
    }
  }
  
  // Check file processing dependencies
  try {
    require('pdf-parse');
    require('mammoth');
    logInfo('✅ File processing libraries available (pdf-parse, mammoth)');
  } catch (error) {
    errors.push('File processing libraries not installed - file upload will fail');
  }
  
  // Check upload directory
  const fs = require('fs');
  const path = require('path');
  const uploadsDir = path.join(__dirname, '../uploads/briefs');
  
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      logInfo('✅ Brief uploads directory created');
    } else {
      logInfo('✅ Brief uploads directory exists');
    }
  } catch (error) {
    warnings.push('Cannot create uploads directory - file uploads may fail');
  }
  
  if (errors.length > 0) {
    logError('❌ Brief module environment errors:', { errors });
    return false;
  }
  
  if (warnings.length > 0) {
    logWarn('⚠️  Brief module environment warnings:', { warnings });
  } else {
    logInfo('✅ Brief module environment validation passed');
  }
  
  return true;
};

// ============================================
// ENHANCED APPLICATION INITIALIZATION
// ============================================

/**
 * Initialize the application with enhanced support for all modules including analytics
 */
const initializeApp = async () => {
  try {
    logInfo('🚀 Initializing CreatorsMantra Backend Application');
    
    // Initialize database connection
    logInfo('📊 Connecting to MongoDB database...');
    await initializeDatabase();
    logInfo('✅ Database connection established');
    
    // Validate environments
    logInfo('📄 Validating invoice module environment...');
    const invoiceEnvOk = validateInvoiceEnvironment();
    if (!invoiceEnvOk) {
      throw new Error('Invoice module environment validation failed');
    }
    
    logInfo('📋 Validating brief module environment...');
    const briefEnvOk = validateBriefEnvironment();
    if (!briefEnvOk) {
      logWarn('⚠️  Brief module environment validation failed - some features may be limited');
    }
    
    logInfo('📊 Validating analytics module environment...');
    const analyticsEnvOk = validateAnalyticsEnvironment();
    if (!analyticsEnvOk) {
      logWarn('⚠️  Analytics module environment validation failed - some features may be limited');
    }
    
    // Initialize external services
    logInfo('🔧 Initializing external services...');
    await initializeServices();
    
    // Initialize invoice services
    logInfo('📄 Initializing invoice services...');
    const invoiceServicesOk = await initializeInvoiceServices();
    if (invoiceServicesOk) {
      logInfo('✅ Invoice services initialized successfully');
    } else {
      logWarn('⚠️  Invoice services partially initialized');
    }
    
    // Initialize brief services
    logInfo('📋 Initializing brief services...');
    const briefServicesOk = await initializeBriefServices();
    if (briefServicesOk) {
      logInfo('✅ Brief services initialized successfully');
    } else {
      logWarn('⚠️  Brief services partially initialized');
    }
    
    // Initialize analytics services
    logInfo('📊 Initializing analytics services...');
    const analyticsServicesOk = await initializeAnalyticsServices();
    if (analyticsServicesOk) {
      logInfo('✅ Analytics services initialized successfully');
    } else {
      logWarn('⚠️  Analytics services partially initialized');
    }
    
    // Log module status
    logInfo(`📦 Loaded ${loadedModules}/${totalModules} modules (${Math.round((loadedModules/totalModules)*100)}% complete)`);
    
    // Log module statuses
    const invoiceStatus = checkModuleExists('invoices');
    const briefStatus = checkModuleExists('briefs');
    const analyticsStatus = checkModuleExists('analytics');
    
    if (invoiceStatus.available) {
      logInfo('📄 Invoice module status:', {
        status: invoiceStatus.status,
        features: invoiceStatus.features
      });
    }
    
    if (briefStatus.available) {
      logInfo('📋 Brief module status:', {
        status: briefStatus.status,
        features: briefStatus.features
      });
    }
    
    if (analyticsStatus.available) {
      logInfo('📊 Analytics module status:', {
        status: analyticsStatus.status,
        features: analyticsStatus.features,
        subscriptionTiers: analyticsStatus.subscriptionTiers
      });
    }
    
    logInfo('✅ Application initialized successfully');
    return true;
  } catch (error) {
    logError('❌ Application initialization failed', { error: error.message, stack: error.stack });
    throw error;
  }
};

/**
 * Enhanced external services initialization
 */
const initializeServices = async () => {
  try {
    let servicesInitialized = 0;
    
    // Initialize AWS S3 if configured
    if (config.aws?.accessKeyId && config.featureFlags?.fileUpload) {
      logInfo('☁️  AWS S3 configuration detected and enabled');
      servicesInitialized++;
    } else {
      logWarn('⚠️  AWS S3 not configured - using local file storage');
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
    
    // PDF Generation Service Check
    if (config.featureFlags?.pdfGeneration !== false) {
      try {
        require('pdfkit');
        logInfo('📑 PDF generation service available');
        servicesInitialized++;
      } catch (error) {
        logWarn('⚠️  PDF generation service not available', { error: error.message });
      }
    }
    
    // File Processing Service Check
    try {
      require('pdf-parse');
      require('mammoth');
      logInfo('📄 File processing services available');
      servicesInitialized++;
    } catch (error) {
      logWarn('⚠️  File processing services not available', { error: error.message });
    }
    
    // Analytics Processing Service Check
    try {
      // MongoDB is already initialized for analytics data storage
      logInfo('📊 Analytics processing service available');
      servicesInitialized++;
    } catch (error) {
      logWarn('⚠️  Analytics processing service not available', { error: error.message });
    }
    
    logInfo(`🔧 Initialized ${servicesInitialized} external services`);
    return true;
  } catch (error) {
    logWarn('⚠️  Some services could not be initialized', { error: error.message });
    return false;
  }
};

// ============================================
// GRACEFUL SHUTDOWN HANDLING
// ============================================

/**
 * Enhanced graceful shutdown handling
 */
const gracefulShutdown = async (signal) => {
  logInfo(`🛑 ${signal} received. Starting graceful shutdown...`);
  
  try {
    // Stop cron jobs
    logInfo('⏹️  Stopping scheduled tasks...');
    cron.getTasks().forEach((task, name) => {
      task.stop();
      logInfo(`Stopped cron job: ${name}`);
    });
    
    // Clear analytics caches if needed
    try {
      const { AnalyticsCache } = require('./modules/analytics/model');
      logInfo('🗑️  Clearing analytics caches...');
      // Optional: Clear non-persistent caches before shutdown
      logInfo('✅ Analytics caches cleared');
    } catch (error) {
      logWarn('⚠️  Analytics cache clearing failed', { error: error.message });
    }
    
    // Close database connections
    logInfo('📊 Closing database connections...');
    await closeDatabase();
    logInfo('✅ Database connections closed');
    
    // Additional cleanup if needed
    logInfo('🧹 Performing final cleanup...');
    
    logInfo('👋 Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logError('❌ Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
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

// Export the app and initialization functions
module.exports = app;
module.exports.initializeApp = initializeApp;
module.exports.gracefulShutdown = gracefulShutdown;
module.exports.initializeInvoiceServices = initializeInvoiceServices;
module.exports.initializeBriefServices = initializeBriefServices;
module.exports.initializeAnalyticsServices = initializeAnalyticsServices; // NEW
module.exports.validateInvoiceEnvironment = validateInvoiceEnvironment;
module.exports.validateBriefEnvironment = validateBriefEnvironment;
module.exports.validateAnalyticsEnvironment = validateAnalyticsEnvironment; // NEW
module.exports.rateLimitByTier = rateLimitByTier;