// server.js
/**
 * CreatorsMantra Backend Server (Express)
 * Production-ready server with proper database initialization
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
💰 Ready to process creator deals!
📊 Database: Connected and ready
🔗 API Endpoints:
   • Health Check: http://${HOST}:${PORT}/health
   • API Status: http://${HOST}:${PORT}/api/v1/status
   • Auth Module: http://${HOST}:${PORT}/api/v1/auth
   • Deals Module: http://${HOST}:${PORT}/api/v1/deals
   • Subscriptions: http://${HOST}:${PORT}/api/v1/subscriptions
      `);
    });

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
2. Verify all required environment variables are set
3. Ensure MongoDB server is running
4. Check network connectivity

Stack trace:
${error.stack}
    `);
    
    process.exit(1);
  }
}

// ============================================
// ERROR HANDLING & SAFETY NETS
// ============================================

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise);
  console.error('Reason:', reason);
  
  // Log the error but don't exit immediately in development
  if (NODE_ENV === 'production') {
    console.error('🚨 Exiting due to unhandled promise rejection in production');
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  
  // Always exit on uncaught exceptions
  console.error('🚨 Exiting due to uncaught exception');
  process.exit(1);
});

// Handle warning events
process.on('warning', (warning) => {
  if (NODE_ENV === 'development') {
    console.warn('⚠️  Warning:', warning.name, warning.message);
  }
});

// Log memory usage in development
if (NODE_ENV === 'development') {
  setInterval(() => {
    const usage = process.memoryUsage();
    if (usage.heapUsed > 100 * 1024 * 1024) { // Over 100MB
      console.log(`📊 Memory usage: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
    }
  }, 60000); // Check every minute
}

// ============================================
// STARTUP
// ============================================

// Start the server
startServer().catch((error) => {
  console.error('❌ Fatal error during server startup:', error);
  process.exit(1);
});

// Export for testing purposes
module.exports = startServer;