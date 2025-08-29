// server.js
/**
 * CreatorsMantra Backend Server (Express)
 * Production-ready server with proper database initialization
 * Enhanced with Scripts Module, Analytics Module, and all integrated features
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
   ✅ Automated billing & invoicing
   ✅ Deal pipeline management
   ✅ Brand collaboration tools
   ✅ Performance tracking
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
   • Instagram (Reels, Posts, Stories)
   • YouTube (Videos, Shorts)
   • LinkedIn (Videos, Posts)
   • TikTok, Facebook, Twitter
   • Platform-specific optimizations

🔧 Background Services:
   ✅ Payment reminders (Daily 9 AM IST)
   ✅ PDF cleanup (Weekly)
   ✅ AI processing queue management
   ✅ Analytics cache optimization
   ✅ Script file management
   ✅ Video transcription queue
   ✅ Trend analysis updates

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
    aiFeatures.push('Script Generation', 'Video Transcription', 'Brief Analysis', 'Business Insights', 'Trend Analysis');
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
    fileFeatures.push('PDF Generation');
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

  // Log subscription tier capabilities
  console.log(`
📊 Subscription Tier Capabilities:

🥉 Starter Tier:
   • 10 scripts/month • Basic analytics • Manual payments
   • 5MB file limit • No video transcription

🥈 Pro Tier:  
   • 25 scripts/month • AI analytics • Video transcription
   • 10MB files, 25MB videos • A/B testing • Trends

🥇 Elite Tier:
   • Unlimited scripts • Advanced forecasting • Large files
   • 25MB docs, 100MB videos • All AI features

👑 Agency Tiers:
   • Team management • Bulk operations • Portfolio analytics
   • 50MB docs, 200MB videos • Priority support
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
      console.warn('💡 Hint: You may have too many event listeners. Check for memory leaks.');
    } else if (warning.name === 'DeprecationWarning') {
      console.warn('💡 Hint: Update deprecated code or dependencies.');
    }
  }
});

// Enhanced memory monitoring for development
if (NODE_ENV === 'development') {
  let memoryWarningThreshold = 150 * 1024 * 1024; // 150MB
  
  setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    
    if (usage.heapUsed > memoryWarningThreshold) {
      console.log(`📊 Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (RSS: ${Math.round(usage.rss / 1024 / 1024)}MB)`);
      
      if (usage.heapUsed > 300 * 1024 * 1024) { // Over 300MB
        console.warn('⚠️ High memory usage detected! Consider investigating potential memory leaks.');
      }
    }
    
    // Log active handles in development
    const activeHandles = process._getActiveHandles().length;
    const activeRequests = process._getActiveRequests().length;
    
    if (activeHandles > 50 || activeRequests > 10) {
      console.log(`🔍 Active handles: ${activeHandles}, Active requests: ${activeRequests}`);
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
    warnings.push('OPENAI_API_KEY missing - AI features (script generation, video transcription) will be disabled');
  }
  
  if (!process.env.SMTP_HOST) {
    warnings.push('Email configuration missing - notifications and reminders will be disabled');
  }
  
  if (!process.env.AWS_ACCESS_KEY_ID && NODE_ENV === 'production') {
    warnings.push('AWS S3 not configured - using local file storage in production');
  }
  
  // Security warnings
  if (NODE_ENV === 'production') {
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters for production security');
    }
    
    if (HOST === '0.0.0.0') {
      warnings.push('Binding to 0.0.0.0 in production - ensure proper firewall configuration');
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
// STARTUP
// ============================================

// Validate environment before starting
try {
  validateEnvironment();
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
  }
  
  process.exit(1);
});

// Export for testing purposes
module.exports = startServer;