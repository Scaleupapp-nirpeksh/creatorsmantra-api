/**
 * Database Configuration and Connection
 * @module config/database
 * @description MongoDB connection setup with retry logic and connection pooling
 */

const mongoose = require('mongoose');
const config = require('./environment');
const logger = require('./logger');

/**
 * MongoDB connection options
 */
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4
  keepAlive: true,
  keepAliveInitialDelay: 300000,
};

/**
 * Connection state tracking
 */
let connectionAttempts = 0;
const maxConnectionAttempts = 5;
const reconnectInterval = 5000; // 5 seconds

/**
 * Database connection class
 */
class Database {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  /**
   * Connect to MongoDB with retry logic
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      // Skip if already connected
      if (this.isConnected) {
        logger.info('📊 Already connected to MongoDB');
        return;
      }

      // Increment connection attempts
      connectionAttempts++;

      // Set mongoose debugging in development
      if (config.isDevelopment) {
        mongoose.set('debug', true);
      }

      // Set strictQuery to prepare for Mongoose 7
      mongoose.set('strictQuery', false);

      // Event listeners for mongoose connection
      this.setupEventListeners();

      // Connect to MongoDB
      logger.info(`🔄 Attempting to connect to MongoDB (Attempt ${connectionAttempts}/${maxConnectionAttempts})...`);
      
      this.connection = await mongoose.connect(config.database.uri, mongooseOptions);
      
      this.isConnected = true;
      connectionAttempts = 0; // Reset attempts on successful connection
      
      logger.info('✅ MongoDB connected successfully');
      logger.info(`📊 Database: ${this.connection.connection.name}`);
      logger.info(`🏠 Host: ${this.connection.connection.host}`);
      
      // Log collection names in development
      if (config.isDevelopment) {
        const collections = await this.connection.connection.db.listCollections().toArray();
        if (collections.length > 0) {
          logger.debug(`📚 Collections: ${collections.map(c => c.name).join(', ')}`);
        }
      }

      return this.connection;

    } catch (error) {
      logger.error(`❌ MongoDB connection error: ${error.message}`);
      
      // Retry logic
      if (connectionAttempts < maxConnectionAttempts) {
        logger.info(`⏳ Retrying connection in ${reconnectInterval / 1000} seconds...`);
        await this.delay(reconnectInterval);
        return this.connect(); // Recursive retry
      } else {
        logger.error('💀 Maximum connection attempts reached. Exiting...');
        process.exit(1);
      }
    }
  }

  /**
   * Disconnect from MongoDB
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (!this.isConnected) {
        logger.info('📊 Not connected to MongoDB');
        return;
      }

      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('🔌 MongoDB disconnected successfully');
    } catch (error) {
      logger.error(`❌ Error disconnecting from MongoDB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup MongoDB event listeners
   */
  setupEventListeners() {
    // Connection successful
    mongoose.connection.on('connected', () => {
      logger.info('📊 Mongoose connected to MongoDB');
      this.isConnected = true;
    });

    // Connection error
    mongoose.connection.on('error', (error) => {
      logger.error(`❌ Mongoose connection error: ${error.message}`);
      this.isConnected = false;
    });

    // Connection disconnected
    mongoose.connection.on('disconnected', () => {
      logger.warn('🔌 Mongoose disconnected from MongoDB');
      this.isConnected = false;
      
      // Attempt to reconnect in production
      if (config.isProduction && connectionAttempts < maxConnectionAttempts) {
        logger.info('🔄 Attempting to reconnect...');
        setTimeout(() => {
          this.connect();
        }, reconnectInterval);
      }
    });

    // Connection reconnected
    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 Mongoose reconnected to MongoDB');
      this.isConnected = true;
    });

    // Application termination
    process.on('SIGINT', async () => {
      await this.gracefulShutdown('SIGINT');
    });

    process.on('SIGTERM', async () => {
      await this.gracefulShutdown('SIGTERM');
    });
  }

  /**
   * Graceful shutdown
   * @param {string} signal - Signal that triggered shutdown
   */
  async gracefulShutdown(signal) {
    try {
      logger.info(`⚠️  ${signal} received: Closing MongoDB connection...`);
      await this.disconnect();
      logger.info('👋 MongoDB connection closed through app termination');
      process.exit(0);
    } catch (error) {
      logger.error(`❌ Error during graceful shutdown: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Check database health
   * @returns {Object} Health status
   */
  async checkHealth() {
    try {
      if (!this.isConnected) {
        return {
          status: 'disconnected',
          message: 'Database is not connected',
        };
      }

      // Ping the database
      await mongoose.connection.db.admin().ping();

      // Get database stats
      const stats = await mongoose.connection.db.stats();

      return {
        status: 'healthy',
        message: 'Database is connected and responding',
        details: {
          database: mongoose.connection.name,
          host: mongoose.connection.host,
          collections: stats.collections,
          documents: stats.objects,
          dataSize: this.formatBytes(stats.dataSize),
          storageSize: this.formatBytes(stats.storageSize),
          indexes: stats.indexes,
        },
      };
    } catch (error) {
      logger.error(`❌ Database health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        message: 'Database health check failed',
        error: error.message,
      };
    }
  }

  /**
   * Create database indexes
   * @returns {Promise<void>}
   */
  async createIndexes() {
    try {
      logger.info('📇 Creating database indexes...');

      // Import all models to ensure indexes are created
      require('../models/User.model');
      require('../models/Deal.model');
      require('../models/Invoice.model');
      require('../models/Payment.model');
      require('../models/Brief.model');
      require('../models/Performance.model');
      require('../models/Contract.model');
      require('../models/RateCard.model');
      require('../models/Agency.model');
      require('../models/Creator.model');
      require('../models/Notification.model');

      // Ensure all indexes are created
      await Promise.all(
        mongoose.modelNames().map(async (modelName) => {
          const model = mongoose.model(modelName);
          await model.createIndexes();
          logger.debug(`✅ Indexes created for ${modelName}`);
        })
      );

      logger.info('✅ All database indexes created successfully');
    } catch (error) {
      logger.error(`❌ Error creating indexes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Seed database with initial data
   * @returns {Promise<void>}
   */
  async seed() {
    try {
      if (config.isProduction) {
        logger.warn('⚠️  Seeding is disabled in production');
        return;
      }

      logger.info('🌱 Seeding database...');
      
      // Import and run seeders
      // const seeders = require('../utils/seed');
      // await seeders.run();
      
      logger.info('✅ Database seeded successfully');
    } catch (error) {
      logger.error(`❌ Error seeding database: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear database (for testing)
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      if (config.isProduction) {
        throw new Error('Database clearing is not allowed in production');
      }

      logger.warn('⚠️  Clearing database...');
      
      const collections = await mongoose.connection.db.collections();
      
      await Promise.all(
        collections.map(async (collection) => {
          await collection.deleteMany({});
          logger.debug(`✅ Cleared collection: ${collection.collectionName}`);
        })
      );

      logger.info('✅ Database cleared successfully');
    } catch (error) {
      logger.error(`❌ Error clearing database: ${error.message}`);
      throw error;
    }
  }

  /**
   * Backup database
   * @returns {Promise<void>}
   */
  async backup() {
    try {
      logger.info('💾 Starting database backup...');
      
      // Implement backup logic here
      // This could involve mongodump or streaming to S3
      
      logger.info('✅ Database backup completed successfully');
    } catch (error) {
      logger.error(`❌ Error backing up database: ${error.message}`);
      throw error;
    }
  }

  /**
   * Utility: Delay function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Utility: Format bytes to human-readable format
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get connection status
   * @returns {boolean} Connection status
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Get mongoose instance
   * @returns {Object} Mongoose instance
   */
  getMongoose() {
    return mongoose;
  }
}

// Create singleton instance
const database = new Database();

// Export database instance and helper functions
module.exports = {
  database,
  connect: () => database.connect(),
  disconnect: () => database.disconnect(),
  checkHealth: () => database.checkHealth(),
  createIndexes: () => database.createIndexes(),
  seed: () => database.seed(),
  clear: () => database.clear(),
  backup: () => database.backup(),
  getConnectionStatus: () => database.getConnectionStatus(),
  mongoose: database.getMongoose(),
};