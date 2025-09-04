// server.js
/**
 * CreatorsMantra Backend Server (Express)
 * Production-ready server with proper database initialization
 * Enhanced with Scripts Module, Analytics Module, Performance Module, and all integrated features
 */

require('dotenv').config();
const app = require('./src/app');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// START SERVER WITH PROPER INITIALIZATION
// ============================================

async function startServer() {
  try {
    console.log('🔧 Initializing CreatorsMantra Backend...');
    
    // CRITICAL: Initialize database and services BEFORE starting server
    await app.initializeApp();
    
    // Start the HTTP server only after successful initialization
    const server = app.listen(PORT, HOST, () => {
      console.log(`
🚀 CreatorsMantra API Server Started Successfully!

📍 Environment: ${NODE_ENV}
🌐 Server URL: http://${HOST}:${PORT}
📅 Started at: ${new Date().toISOString()}
💰 Ready to process creator deals and generate content!

📊 Database: Connected and ready
🤖 AI Services: ${process.env.OPENAI_API_KEY ? 'Enabled (OpenAI GPT-4 + Whisper)' : 'Disabled'}

🔗 Core API Endpoints:
   • Health Check: http://${HOST}:${PORT}/health
   • Detailed Health: http://${HOST}:${PORT}/health/detailed
   • API Status: http://${HOST}:${PORT}/api/v1/status
   • API Documentation: http://${HOST}:${PORT}/api/v1/docs
   • Feature Flags: http://${HOST}:${PORT}/api/v1/features

📦 Available Modules:
   • Auth & Users: http://${HOST}:${PORT}/api/v1/auth
   • Subscriptions: http://${HOST}:${PORT}/api/v1/subscriptions
   • Deal Pipeline: http://${HOST}:${PORT}/api/v1/deals
   • Invoice System: http://${HOST}:${PORT}/api/v1/invoices
   • Rate Cards: http://${HOST}:${PORT}/api/v1/ratecards
   • Brief Analyzer: http://${HOST}:${PORT}/api/v1/briefs
   • Performance Vault: http://${HOST}:${PORT}/api/v1/performance
   • Contracts: http://${HOST}:${PORT}/api/v1/contracts
   • Agency Tools: http://${HOST}:${PORT}/api/v1/agency
   • Analytics Intelligence: http://${HOST}:${PORT}/api/v1/analytics
   • Scripts Generator: http://${HOST}:${PORT}/api/v1/scripts

🎬 Scripts Module Features:
   • AI Script Generation (GPT-4)
   • Video Transcription (Whisper AI)
   • Multi-Platform Optimization (10+ platforms)
   • A/B Testing & Variations
   • Deal Connection & Analytics
   • File Upload (Documents + Videos)
   • Trend Integration
   • Export & Bulk Operations

📊 Analytics Module Features:
   • Business Intelligence Dashboard
   • Revenue Analytics & Forecasting
   • Deal Performance Metrics
   • AI-Powered Insights
   • Cross-Module Data Correlation
   • Risk Analytics & Trends

🏆 Performance Vault Features:
   • Campaign Performance Tracking
   • AI-Powered Analysis & Insights
   • Evidence Collection & Management
   • Professional Report Generation
   • Client Communication & Delivery
   • Business Intelligence Metrics
   • Rate Card Optimization
   • Multi-Platform Performance Analytics
   • Branded & White-Label Reports
   • Portfolio Management & Analytics

📄 Invoice Module Features:
   • Individual & Consolidated Billing
   • Tax Control & Compliance
   • Agency Payout Management
   • PDF Generation & Export
   • Payment Tracking & Reminders

📋 Brief Analyzer Features:
   • AI-Powered Content Extraction
   • File Upload & Processing
   • Risk Assessment & Pricing
   • Deal Conversion & Analytics

🔥 Key Capabilities:
   ✅ Multi-tier subscription system
   ✅ AI-powered content generation
   ✅ Video transcription & analysis  
   ✅ Cross-platform optimization
   ✅ Advanced analytics & insights
   ✅ Performance tracking & reporting
   ✅ Automated billing & invoicing
   ✅ Deal pipeline management
   ✅ Brand collaboration tools
   ✅ Client delivery management
   ✅ Indian tax compliance (GST/TDS)

🛡️ Security & Performance:
   ✅ JWT authentication
   ✅ Rate limiting by subscription tier
   ✅ Input validation & sanitization
   ✅ Error handling & logging
   ✅ Graceful shutdown handling
   ✅ File upload protection
   ✅ CORS configuration
   ✅ Production optimizations

📱 Supported Platforms:
   • Instagram (Reels, Posts, Stories, IGTV)
   • YouTube (Videos, Shorts, Community Posts)
   • LinkedIn (Videos, Posts, Articles)
   • TikTok, Facebook, Twitter
   • Platform-specific optimizations
   • Performance correlation analysis

🔧 Background Services:
   ✅ Payment reminders (Daily 9 AM IST)
   ✅ PDF cleanup (Weekly)
   ✅ AI processing queue management
   ✅ Analytics cache optimization
   ✅ Script file management
   ✅ Video transcription queue
   ✅ Trend analysis updates
   ✅ Performance evidence cleanup
   ✅ Report generation optimization
   ✅ Client communication tracking

Ready to serve ${NODE_ENV} traffic! 🎉
      `);
    });

    // Log service-specific status
    logServiceStatus();

    // ============================================
    // GRACEFUL SHUTDOWN HANDLING
    // ============================================

    function shutdown(signal) {
      console.log(`🛑 ${signal} received. Starting graceful shutdown...`);
      
      // Close HTTP server first
      server.close((err) => {
        if (err) {
          console.error('❌ Error closing HTTP server:', err);
        } else {
          console.log('✅ HTTP server closed successfully');
        }
        
        // Use app's graceful shutdown to close database connections
        if (app.gracefulShutdown) {
          app.gracefulShutdown(signal);
        } else {
          console.log('👋 Shutdown complete. Bye!');
          process.exit(0);
        }
      });
    }

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
    
  } catch (error) {
    console.error(`❌ Failed to start CreatorsMantra server:
    
Error: ${error.message}

Common solutions:
1. Check MongoDB connection (MONGODB_URI in .env)
2. Verify all required environment variables are set:
   • MONGODB_URI (required)
   • JWT_SECRET (required)
   • OPENAI_API_KEY (for AI features)
   • AWS credentials (for file storage)
   • Email configuration (for notifications)
3. Ensure MongoDB server is running
4. Check network connectivity
5. Verify Node.js version compatibility
6. Check port availability (PORT=${PORT})

Environment Variables Status:
• MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Missing'}
• JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Missing'}
• OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set (AI Enabled)' : '⚠️ Missing (AI Disabled)'}
• NODE_ENV: ${NODE_ENV}
• PORT: ${PORT}
• HOST: ${HOST}

Stack trace:
${error.stack}
    `);
    
    process.exit(1);
  }
}

// ============================================
// SERVICE STATUS LOGGING
// ============================================

function logServiceStatus() {
  const services = [];
  
  // Check core services
  if (process.env.MONGODB_URI) services.push('✅ MongoDB');
  if (process.env.OPENAI_API_KEY) services.push('✅ OpenAI (GPT-4 + Whisper)');
  if (process.env.AWS_ACCESS_KEY_ID) services.push('✅ AWS S3');
  if (process.env.RAZORPAY_KEY_ID) services.push('✅ Razorpay Payments');
  if (process.env.SMTP_HOST) services.push('✅ Email Service');
  if (process.env.TWILIO_ACCOUNT_SID) services.push('✅ Twilio SMS');
  
  // Check AI features
  const aiFeatures = [];
  if (process.env.OPENAI_API_KEY) {
    aiFeatures.push('Script Generation', 'Video Transcription', 'Brief Analysis', 'Business Insights', 'Trend Analysis', 'Performance Analysis');
  }
  
  // Check file processing
  const fileFeatures = [];
  try {
    require('pdf-parse');
    require('mammoth');
    fileFeatures.push('PDF Processing', 'Document Analysis');
  } catch (error) {
    // File processing not available
  }
  
  try {
    require('pdfkit');
    fileFeatures.push('PDF Generation', 'Performance Reports');
  } catch (error) {
    // PDF generation not available
  }

  console.log(`
🔧 Service Status:
${services.join(', ') || '⚠️ No external services configured'}

🤖 AI Features:
${aiFeatures.length > 0 ? aiFeatures.join(', ') : '❌ AI features disabled (OPENAI_API_KEY missing)'}

📁 File Processing:
${fileFeatures.length > 0 ? fileFeatures.join(', ') : '⚠️ Limited file processing available'}

💾 Storage:
${process.env.AWS_ACCESS_KEY_ID ? '☁️ AWS S3' : '💽 Local Storage'}

🔔 Notifications:
${process.env.SMTP_HOST ? '📧 Email' : '❌ Email disabled'} | ${process.env.TWILIO_ACCOUNT_SID ? '📱 SMS' : '❌ SMS disabled'}

💳 Payments:
${process.env.RAZORPAY_KEY_ID ? '💰 Razorpay Integration' : '📝 Manual Verification Only'}
  `);

  // Log subscription tier capabilities with Performance Module
  console.log(`
📊 Subscription Tier Capabilities:

🥉 Starter Tier:
   • 10 scripts/month • Basic analytics • Manual payments
   • 5MB file limit • No video transcription
   • Basic performance tracking • Evidence collection only

🥈 Pro Tier:  
   • 25 scripts/month • AI analytics • Video transcription
   • 10MB files, 25MB videos • A/B testing • Trends
   • AI performance analysis • Professional reports

🥇 Elite Tier:
   • Unlimited scripts • Advanced forecasting • Large files
   • 25MB docs, 100MB videos • All AI features
   • Branded performance reports • Advanced analytics

👑 Agency Tiers:
   • Team management • Bulk operations • Portfolio analytics
   • 50MB docs, 200MB videos • Priority support
   • White-label performance reports • Multi-creator dashboard
  `);

  // Performance monitoring in development
  if (NODE_ENV === 'development') {
    console.log(`
🔍 Development Mode Active:
   • Request logging enabled
   • Memory monitoring active  
   • Detailed error messages
   • Hot reload ready
   • Debug endpoints available
   • Performance tracking debug mode
    `);
  }
}

// ============================================
// ERROR HANDLING & SAFETY NETS
// ============================================

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise);
  console.error('Reason:', reason);
  
  // Enhanced error context
  if (reason && reason.message) {
    if (reason.message.includes('ECONNREFUSED')) {
      console.error('💡 Hint: Check if MongoDB is running and accessible');
    } else if (reason.message.includes('authentication')) {
      console.error('💡 Hint: Check database credentials in MONGODB_URI');
    } else if (reason.message.includes('timeout')) {
      console.error('💡 Hint: Check network connectivity or increase timeout values');
    } else if (reason.message.includes('AI analysis') || reason.message.includes('OpenAI')) {
      console.error('💡 Hint: Check OpenAI API key and service availability');
    } else if (reason.message.includes('Performance') || reason.message.includes('evidence')) {
      console.error('💡 Hint: Check performance module configuration and file upload limits');
    }
  }
  
  // Log the error but don't exit immediately in development
  if (NODE_ENV === 'production') {
    console.error('🚨 Exiting due to unhandled promise rejection in production');
    process.exit(1);
  } else {
    console.error('⚠️ Continuing in development mode - fix this error!');
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  
  // Enhanced error context
  if (error.message.includes('EADDRINUSE')) {
    console.error(`💡 Hint: Port ${PORT} is already in use. Try a different port or kill the existing process.`);
  } else if (error.message.includes('MODULE_NOT_FOUND')) {
    console.error('💡 Hint: Run "npm install" to install missing dependencies');
  } else if (error.message.includes('performance') || error.message.includes('Performance')) {
    console.error('💡 Hint: Check performance module dependencies and file permissions');
  }
  
  // Always exit on uncaught exceptions
  console.error('🚨 Exiting due to uncaught exception');
  process.exit(1);
});

// Handle warning events
process.on('warning', (warning) => {
  if (NODE_ENV === 'development') {
    console.warn('⚠️ Warning:', warning.name, warning.message);
    
    // Special handling for common warnings
    if (warning.name === 'MaxListenersExceededWarning') {
      console.warn('💡 Hint: You may have too many event listeners. Check for memory leaks in performance tracking.');
    } else if (warning.name === 'DeprecationWarning') {
      console.warn('💡 Hint: Update deprecated code or dependencies.');
    } else if (warning.message.includes('performance') || warning.message.includes('multer')) {
      console.warn('💡 Hint: Performance module file upload warning - check multer configuration.');
    }
  }
});

// Enhanced memory monitoring for development with performance module awareness
if (NODE_ENV === 'development') {
  let memoryWarningThreshold = 150 * 1024 * 1024; // 150MB
  
  setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    
    if (usage.heapUsed > memoryWarningThreshold) {
      console.log(`📊 Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (RSS: ${Math.round(usage.rss / 1024 / 1024)}MB)`);
      
      if (usage.heapUsed > 300 * 1024 * 1024) { // Over 300MB
        console.warn('⚠️ High memory usage detected! Consider investigating potential memory leaks in AI processing or performance analysis.');
      }
    }
    
    // Log active handles in development
    const activeHandles = process._getActiveHandles().length;
    const activeRequests = process._getActiveRequests().length;
    
    if (activeHandles > 50 || activeRequests > 10) {
      console.log(`🔍 Active handles: ${activeHandles}, Active requests: ${activeRequests}`);
      
      if (activeHandles > 100) {
        console.warn('⚠️ High number of active handles - check for file handle leaks in performance evidence uploads');
      }
    }
    
  }, 60000); // Check every minute
}

// ============================================
// STARTUP VALIDATION & WARNINGS
// ============================================

function validateEnvironment() {
  const warnings = [];
  const errors = [];
  
  // Required environment variables
  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is required');
  }
  
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is required for authentication');
  }
  
  // Optional but important
  if (!process.env.OPENAI_API_KEY) {
    warnings.push('OPENAI_API_KEY missing - AI features (script generation, video transcription, performance analysis) will be disabled');
  }
  
  if (!process.env.SMTP_HOST) {
    warnings.push('Email configuration missing - notifications, reminders, and client communication will be disabled');
  }
  
  if (!process.env.AWS_ACCESS_KEY_ID && NODE_ENV === 'production') {
    warnings.push('AWS S3 not configured - using local file storage for performance evidence and reports in production');
  }
  
  // Performance module specific warnings
  const fs = require('fs');
  const path = require('path');
  
  // Check performance uploads directory
  const performanceUploadsDir = path.join(__dirname, 'src', 'uploads', 'performance');
  try {
    if (!fs.existsSync(performanceUploadsDir)) {
      warnings.push('Performance uploads directory missing - will be created automatically but check file permissions');
    }
  } catch (error) {
    warnings.push('Cannot check performance uploads directory - file upload may fail');
  }
  
  // Check performance reports directory
  const performanceReportsDir = path.join(__dirname, 'src', 'uploads', 'performance', 'reports');
  try {
    if (!fs.existsSync(performanceReportsDir)) {
      warnings.push('Performance reports directory missing - will be created automatically');
    }
  } catch (error) {
    warnings.push('Cannot check performance reports directory - report generation may fail');
  }
  
  // Check PDF generation dependencies
  try {
    require('pdfkit');
    require('qrcode');
  } catch (error) {
    warnings.push('PDF generation libraries missing - performance reports will not work properly');
  }
  
  // Security warnings
  if (NODE_ENV === 'production') {
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters for production security');
    }
    
    if (HOST === '0.0.0.0') {
      warnings.push('Binding to 0.0.0.0 in production - ensure proper firewall configuration');
    }
    
    // Performance module production warnings
    if (!process.env.OPENAI_API_KEY) {
      warnings.push('AI-powered performance analysis disabled in production - consider enabling for better insights');
    }
    
    if (!process.env.AWS_ACCESS_KEY_ID) {
      warnings.push('Local file storage in production for performance evidence - consider AWS S3 for scalability');
    }
  }
  
  // Log results
  if (errors.length > 0) {
    console.error('❌ Environment Validation Errors:');
    errors.forEach(error => console.error(`   • ${error}`));
    throw new Error('Environment validation failed');
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️ Environment Validation Warnings:');
    warnings.forEach(warning => console.warn(`   • ${warning}`));
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Environment validation passed');
  }
}

// ============================================
// PERFORMANCE MODULE SPECIFIC VALIDATION
// ============================================

function validatePerformanceModuleDependencies() {
  console.log('🏆 Validating Performance Module dependencies...');
  
  const warnings = [];
  const errors = [];
  
  // Check required Node.js modules for performance tracking
  try {
    require('multer');
    console.log('✅ Multer available for performance evidence uploads');
  } catch (error) {
    errors.push('Multer not installed - performance evidence upload will fail');
  }
  
  try {
    require('pdfkit');
    console.log('✅ PDFKit available for performance report generation');
  } catch (error) {
    errors.push('PDFKit not installed - performance report generation will fail');
  }
  
  try {
    require('qrcode');
    console.log('✅ QRCode library available for report sharing');
  } catch (error) {
    warnings.push('QRCode library not installed - report sharing QR codes will not work');
  }
  
  try {
    require('joi');
    console.log('✅ Joi available for performance data validation');
  } catch (error) {
    errors.push('Joi not installed - performance data validation will fail');
  }
  
  try {
    require('axios');
    console.log('✅ Axios available for AI analysis API calls');
  } catch (error) {
    warnings.push('Axios not installed - AI performance analysis may not work');
  }
  
  try {
    require('express-rate-limit');
    console.log('✅ Rate limiting available for performance API protection');
  } catch (error) {
    errors.push('Express-rate-limit not installed - API protection will fail');
  }
  
  try {
    require('isomorphic-dompurify');
    console.log('✅ DOMPurify available for input sanitization');
  } catch (error) {
    warnings.push('DOMPurify not installed - input sanitization will be limited');
  }
  
  // Check file system permissions for performance uploads
  const fs = require('fs');
  const path = require('path');
  
  const performanceDir = path.join(__dirname, 'src', 'uploads', 'performance');
  try {
    if (!fs.existsSync(performanceDir)) {
      fs.mkdirSync(performanceDir, { recursive: true });
      console.log('✅ Performance uploads directory created');
    } else {
      console.log('✅ Performance uploads directory exists');
    }
    
    // Test write permissions
    const testFile = path.join(performanceDir, '.test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('✅ Performance directory write permissions OK');
  } catch (error) {
    warnings.push('Cannot create or write to performance uploads directory');
  }
  
  // Check memory requirements for AI analysis
  const totalMemory = process.memoryUsage().heapTotal;
  const totalMemoryMB = Math.round(totalMemory / 1024 / 1024);
  
  if (totalMemoryMB < 512) {
    warnings.push('Low memory available - AI performance analysis may fail for large datasets');
  } else {
    console.log(`✅ Sufficient memory available for performance processing (${totalMemoryMB}MB)`);
  }
  
  // Check AI service availability
  if (process.env.OPENAI_API_KEY) {
    console.log('✅ OpenAI API key configured for AI performance analysis');
  } else {
    warnings.push('OpenAI API key missing - AI performance analysis will be disabled');
  }
  
  if (errors.length > 0) {
    console.error('❌ Performance Module Validation Errors:');
    errors.forEach(error => console.error(`   • ${error}`));
    return false;
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️ Performance Module Validation Warnings:');
    warnings.forEach(warning => console.warn(`   • ${warning}`));
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Performance Module validation passed completely');
  } else if (errors.length === 0) {
    console.log('✅ Performance Module validation passed with warnings');
  }
  
  return errors.length === 0;
}

// ============================================
// STARTUP
// ============================================

// Validate environment before starting
try {
  validateEnvironment();
  
  // Additional validation for performance module
  const performanceModuleOK = validatePerformanceModuleDependencies();
  if (!performanceModuleOK) {
    console.warn('⚠️ Performance Module validation failed - some features may be limited');
  }
  
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  process.exit(1);
}

// Start the server
startServer().catch((error) => {
  console.error('❌ Fatal error during server startup:', error);
  
  // Additional context for common startup errors
  if (error.code === 'EADDRINUSE') {
    console.error(`\n💡 Port ${PORT} is already in use. Solutions:
    1. Kill the existing process: lsof -ti:${PORT} | xargs kill -9
    2. Use a different port: PORT=3001 npm start
    3. Check if another instance is running`);
  } else if (error.message.includes('ECONNREFUSED')) {
    console.error('\n💡 Database connection failed. Solutions:');
    console.error('    1. Start MongoDB: mongod or systemctl start mongod');
    console.error('    2. Check MONGODB_URI in .env file');
    console.error('    3. Verify network connectivity to database');
  } else if (error.message.includes('performance') || error.message.includes('Performance')) {
    console.error('\n💡 Performance module error. Solutions:');
    console.error('    1. Check file upload permissions');
    console.error('    2. Verify OpenAI API key for AI analysis');
    console.error('    3. Ensure sufficient memory for processing');
    console.error('    4. Check PDFKit and other dependencies');
  }
  
  process.exit(1);
});

// Export for testing purposes
module.exports = startServer;