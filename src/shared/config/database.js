// src/shared/config/database.js
/**
 * CreatorsMantra Backend - Database Configuration
 * MongoDB connection and configuration
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const mongoose = require('mongoose');
const { log } = require('../utils');

// ============================================
// DATABASE CONNECTION OPTIONS
// ============================================

const connectionOptions = {
  // Connection settings
  useNewUrlParser: true,
  useUnifiedTopology: true,
  
  // Performance settings
  maxPoolSize: 10, // Maximum number of connections
  serverSelectionTimeoutMS: 5000, // Server selection timeout
  socketTimeoutMS: 45000, // Socket timeout
  family: 4, // Use IPv4, skip trying IPv6
  
  // Buffer settings
  bufferMaxEntries: 0, // Disable mongoose buffering
  bufferCommands: false, // Disable mongoose buffering
  
  // Retry settings
  retryWrites: true,
  retryReads: true
};

// ============================================
// DATABASE CONNECTION FUNCTION
// ============================================

/**
 * Connect to MongoDB database
 * @returns {Promise} Database connection promise
 */
const connectDatabase = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/creatorsmantra';
    
    log('info', 'Attempting to connect to MongoDB', { 
      uri: mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') // Hide credentials in logs
    });
    
    const connection = await mongoose.connect(mongoURI, connectionOptions);
    
    log('info', 'MongoDB connected successfully', {
      host: connection.connection.host,
      port: connection.connection.port,
      database: connection.connection.name
    });
    
    return connection;
  } catch (error) {
    log('error', 'MongoDB connection failed', { 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
};

// ============================================
// DATABASE EVENT HANDLERS
// ============================================

/**
 * Set up database event listeners
 */
const setupDatabaseEvents = () => {
  // Connection events
  mongoose.connection.on('connected', () => {
    log('info', 'Mongoose connected to MongoDB');
  });
  
  mongoose.connection.on('error', (error) => {
    log('error', 'Mongoose connection error', { error: error.message });
  });
  
  mongoose.connection.on('disconnected', () => {
    log('warn', 'Mongoose disconnected from MongoDB');
  });
  
  // Application termination events
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      log('info', 'Mongoose connection closed due to application termination');
      process.exit(0);
    } catch (error) {
      log('error', 'Error closing Mongoose connection', { error: error.message });
      process.exit(1);
    }
  });
  
  process.on('SIGTERM', async () => {
    try {
      await mongoose.connection.close();
      log('info', 'Mongoose connection closed due to application termination');
      process.exit(0);
    } catch (error) {
      log('error', 'Error closing Mongoose connection', { error: error.message });
      process.exit(1);
    }
  });
};

// ============================================
// DATABASE HEALTH CHECK
// ============================================

/**
 * Check database connection health
 * @returns {Object} Health check result
 */
const getDatabaseHealth = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  return {
    status: states[state] || 'unknown',
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    database: mongoose.connection.name,
    collections: Object.keys(mongoose.connection.collections).length
  };
};

// ============================================
// DATABASE INITIALIZATION
// ============================================

/**
 * Initialize database connection
 * @returns {Promise} Initialization promise
 */
const initializeDatabase = async () => {
  try {
    // Set up event listeners
    setupDatabaseEvents();
    
    // Connect to database
    await connectDatabase();
    
    // Create indexes for better performance
    await createIndexes();
    
    log('info', 'Database initialization completed');
    return true;
  } catch (error) {
    log('error', 'Database initialization failed', { error: error.message });
    throw error;
  }
};

// ============================================
// INDEX CREATION
// ============================================

/**
 * Create database indexes for better performance
 */
const createIndexes = async () => {
  try {
    log('info', 'Creating database indexes...');
    
    // User collection indexes
    await mongoose.connection.collection('users').createIndex({ email: 1 }, { unique: true });
    await mongoose.connection.collection('users').createIndex({ createdAt: -1 });
    
    // Deal collection indexes
    await mongoose.connection.collection('deals').createIndex({ creatorId: 1, status: 1 });
    await mongoose.connection.collection('deals').createIndex({ createdAt: -1 });
    await mongoose.connection.collection('deals').createIndex({ dueDate: 1 });
    
    // Invoice collection indexes
    await mongoose.connection.collection('invoices').createIndex({ invoiceNumber: 1 }, { unique: true });
    await mongoose.connection.collection('invoices').createIndex({ creatorId: 1, status: 1 });
    await mongoose.connection.collection('invoices').createIndex({ dueDate: 1 });
    
    // Subscription collection indexes
    await mongoose.connection.collection('subscriptions').createIndex({ userId: 1 });
    await mongoose.connection.collection('subscriptions').createIndex({ status: 1, endDate: 1 });
    
    log('info', 'Database indexes created successfully');
  } catch (error) {
    // Don't throw error for index creation failures
    log('warn', 'Some database indexes could not be created', { error: error.message });
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  connectDatabase,
  setupDatabaseEvents,
  getDatabaseHealth,
  initializeDatabase,
  createIndexes
};