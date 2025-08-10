/**
 * CreatorsMantra Backend Server (Express)
 */

require('dotenv').config();
const app = require('./src/app');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, HOST, () => {
  console.log(`
🚀 CreatorsMantra API Server Started
📍 Environment: ${NODE_ENV}
🌐 Listening on: http://${HOST}:${PORT}
📅 Started at: ${new Date().toISOString()}
💰 Ready to process creator deals!
  `);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`🛑 ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('✅ HTTP server closed. Bye!');
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Safety nets
process.on('unhandledRejection', (r) => {
  console.error('❌ Unhandled Promise Rejection:', r);
});
process.on('uncaughtException', (e) => {
  console.error('❌ Uncaught Exception:', e);
  shutdown('UNCAUGHT_EXCEPTION');
});

module.exports = server;
