/**
 * CreatorsMantra Backend - Main Application
 * Express.js application setup with middleware and routes
 * Enhanced with Invoice Module Support & Production Features
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const express = require('express');
const path = require('path');
const cron = require('node-cron');
const multer = require('multer');
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
        taxControlEnabled: true
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
      },
      services: {
        cronJobs: checkCronJobsStatus(),
        pdfGeneration: checkPDFGenerationService(),
        fileUpload: checkFileUploadService(),
        paymentReminders: checkPaymentReminderService()
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
 * Enhanced module check function with invoice-specific features
 */
function checkModuleExists(moduleName) {
  try {
    const routes = require(`./modules/${moduleName}/routes`);
    
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
      pdfCleanup: config.featureFlags?.pdfGeneration !== false
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
    storage: config.aws?.accessKeyId ? 'AWS S3' : 'Local'
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

// ============================================
// API ROUTES SETUP
// ============================================

/**
 * API version prefix
 */
const API_PREFIX = `/api/${config.server.apiVersion || 'v1'}`;

/**
 * Welcome endpoint with enhanced feature information
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
        tdsHandling: true,
        // Enhanced invoice features
        invoiceGeneration: true,
        consolidatedBilling: true,
        taxControl: true,
        agencyPayout: true,
        pdfGeneration: config.featureFlags?.pdfGeneration !== false,
        paymentTracking: true,
        automatedReminders: config.featureFlags?.paymentReminders !== false
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
      timestamp: new Date().toISOString(),
      invoiceModule: {
        status: checkModuleExists('invoices').status,
        features: checkModuleExists('invoices').features || {}
      }
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
        'communication_tracking',
        // Enhanced invoice features
        'invoice_generation',
        'consolidated_billing',
        'tax_control',
        'agency_payout',
        'pdf_generation',
        'payment_tracking',
        'automated_reminders'
      ]
    })
  );
});

// ============================================
// ENHANCED API DOCUMENTATION
// ============================================

/**
 * API documentation endpoint with invoice module details
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
        }
      },
      rate_limits: {
        general: '50 requests per 15 minutes',
        authentication: '10 requests per 15 minutes',
        payment_verification: '5 requests per 15 minutes',
        pdf_generation: '10 requests per 15 minutes',
        file_upload: '20 requests per 15 minutes'
      },
      file_upload: {
        max_size: '10MB',
        allowed_types: ['PDF', 'JPEG', 'PNG', 'JPG', 'WEBP'],
        endpoints: [
          'POST /invoices/:id/upload-payment-screenshot',
          'POST /invoices/:id/generate-pdf'
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
        'File upload examples'
      ]
    })
  );
});

// ============================================
// ENHANCED FEATURE FLAGS ENDPOINT
// ============================================

/**
 * Get current feature flags with invoice-specific flags
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
        file_upload_invoices: true
      },
      environment: config.server.environment,
      invoice_features: {
        consolidation_types: ['monthly', 'brand_wise', 'agency_payout', 'date_range', 'custom_selection'],
        supported_file_types: ['PDF', 'JPEG', 'PNG', 'JPG', 'WEBP'],
        max_file_size: '10MB',
        payment_reminder_schedule: 'Daily at 9 AM IST',
        tax_compliance: ['GST', 'TDS', 'PAN', 'IFSC']
      }
    })
  );
});

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

// ============================================
// ENHANCED APPLICATION INITIALIZATION
// ============================================

/**
 * Initialize the application with enhanced invoice support
 */
const initializeApp = async () => {
  try {
    logInfo('🚀 Initializing CreatorsMantra Backend Application');
    
    // Initialize database connection
    logInfo('📊 Connecting to MongoDB database...');
    await initializeDatabase();
    logInfo('✅ Database connection established');
    
    // Validate invoice environment
    logInfo('📄 Validating invoice module environment...');
    const invoiceEnvOk = validateInvoiceEnvironment();
    if (!invoiceEnvOk) {
      throw new Error('Invoice module environment validation failed');
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
    
    // Log module status
    logInfo(`📦 Loaded ${loadedModules}/${totalModules} modules (${Math.round((loadedModules/totalModules)*100)}% complete)`);
    
    // Log invoice module status
    const invoiceStatus = checkModuleExists('invoices');
    if (invoiceStatus.available) {
      logInfo('📄 Invoice module status:', {
        status: invoiceStatus.status,
        features: invoiceStatus.features
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
module.exports.validateInvoiceEnvironment = validateInvoiceEnvironment;