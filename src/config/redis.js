/**
 * Redis Configuration and Connection
 * @module config/redis
 * @description Redis client setup for caching and session management
 */

const Redis = require('ioredis');
const config = require('./environment');
const logger = require('./logger');
const { CACHE_KEYS, TIME } = require('./constants');

/**
 * Redis client options
 */
const redisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,
  
  // Retry strategy
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  
  // Connection options
  connectTimeout: 10000,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  
  // Keep alive
  keepAlive: 30000,
  
  // Reconnection
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      logger.error('Redis READONLY error, reconnecting...');
      return true;
    }
    return false;
  },
};

/**
 * Redis Cache Manager Class
 */
class RedisManager {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    this.isConnected = false;
  }

  /**
   * Initialize Redis connections
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      // Skip Redis in test environment if not configured
      if (config.isTest && !config.redis.host) {
        logger.info('⏭️  Skipping Redis connection in test environment');
        return;
      }

      logger.info('🔄 Connecting to Redis...');

      // Create main client
      this.client = new Redis(redisOptions);
      
      // Create subscriber client for pub/sub
      this.subscriber = new Redis(redisOptions);
      
      // Create publisher client for pub/sub
      this.publisher = new Redis(redisOptions);

      // Setup event listeners
      this.setupEventListeners();

      // Wait for connection
      await this.client.ping();
      
      this.isConnected = true;
      logger.info('✅ Redis connected successfully');
      
      // Test the connection
      await this.testConnection();
      
    } catch (error) {
      logger.error('❌ Redis connection error:', error);
      
      // Don't exit in development/test, just disable Redis features
      if (!config.isProduction) {
        logger.warn('⚠️  Running without Redis cache');
        this.isConnected = false;
      } else {
        throw error;
      }
    }
  }

  /**
   * Setup Redis event listeners
   */
  setupEventListeners() {
    // Client events
    this.client.on('connect', () => {
      logger.info('📱 Redis client connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      logger.info('✅ Redis client ready');
    });

    this.client.on('error', (error) => {
      logger.error('❌ Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('🔌 Redis client connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', (delay) => {
      logger.info(`🔄 Redis client reconnecting in ${delay}ms`);
    });

    // Subscriber events
    this.subscriber.on('error', (error) => {
      logger.error('❌ Redis subscriber error:', error);
    });

    // Publisher events
    this.publisher.on('error', (error) => {
      logger.error('❌ Redis publisher error:', error);
    });
  }

  /**
   * Test Redis connection
   * @returns {Promise<void>}
   */
  async testConnection() {
    try {
      const testKey = 'test:connection';
      const testValue = 'CreatorsMantra Redis Test';
      
      await this.client.set(testKey, testValue, 'EX', 10);
      const result = await this.client.get(testKey);
      
      if (result === testValue) {
        logger.debug('✅ Redis test successful');
        await this.client.del(testKey);
      } else {
        throw new Error('Redis test failed: value mismatch');
      }
    } catch (error) {
      logger.error('❌ Redis test failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (!this.isConnected) {
        return;
      }

      logger.info('🔌 Disconnecting from Redis...');
      
      if (this.client) await this.client.quit();
      if (this.subscriber) await this.subscriber.quit();
      if (this.publisher) await this.publisher.quit();
      
      this.isConnected = false;
      logger.info('✅ Redis disconnected successfully');
    } catch (error) {
      logger.error('❌ Error disconnecting from Redis:', error);
      throw error;
    }
  }

  /**
   * Cache Management Methods
   */

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    try {
      if (!this.isConnected) return null;
      
      const value = await this.client.get(key);
      
      if (value) {
        logger.debug(`Cache hit: ${key}`);
        return JSON.parse(value);
      }
      
      logger.debug(`Cache miss: ${key}`);
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = config.cache.ttl.default) {
    try {
      if (!this.isConnected) return false;
      
      const serialized = JSON.stringify(value);
      
      if (ttl) {
        await this.client.set(key, serialized, 'EX', ttl);
      } else {
        await this.client.set(key, serialized);
      }
      
      logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async delete(key) {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.client.del(key);
      logger.debug(`Cache delete: ${key}`);
      return result === 1;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   * @param {string} pattern - Key pattern
   * @returns {Promise<number>} Number of deleted keys
   */
  async deletePattern(pattern) {
    try {
      if (!this.isConnected) return 0;
      
      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) return 0;
      
      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();
      
      logger.debug(`Cache delete pattern: ${pattern} (${keys.length} keys)`);
      return keys.length;
    } catch (error) {
      logger.error('Cache delete pattern error:', error);
      return 0;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Existence status
   */
  async exists(key) {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Set key expiration
   * @param {string} key - Cache key
   * @param {number} seconds - Expiration in seconds
   * @returns {Promise<boolean>} Success status
   */
  async expire(key, seconds) {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      logger.error('Cache expire error:', error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds, -1 if no expiry, -2 if not exists
   */
  async ttl(key) {
    try {
      if (!this.isConnected) return -2;
      
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Cache TTL error:', error);
      return -2;
    }
  }

  /**
   * Increment counter
   * @param {string} key - Counter key
   * @param {number} increment - Increment value
   * @returns {Promise<number>} New counter value
   */
  async incr(key, increment = 1) {
    try {
      if (!this.isConnected) return 0;
      
      return await this.client.incrby(key, increment);
    } catch (error) {
      logger.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * Decrement counter
   * @param {string} key - Counter key
   * @param {number} decrement - Decrement value
   * @returns {Promise<number>} New counter value
   */
  async decr(key, decrement = 1) {
    try {
      if (!this.isConnected) return 0;
      
      return await this.client.decrby(key, decrement);
    } catch (error) {
      logger.error('Cache decrement error:', error);
      return 0;
    }
  }

  /**
   * Hash operations
   */

  /**
   * Set hash field
   * @param {string} key - Hash key
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @returns {Promise<boolean>} Success status
   */
  async hset(key, field, value) {
    try {
      if (!this.isConnected) return false;
      
      await this.client.hset(key, field, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache hset error:', error);
      return false;
    }
  }

  /**
   * Get hash field
   * @param {string} key - Hash key
   * @param {string} field - Field name
   * @returns {Promise<any>} Field value or null
   */
  async hget(key, field) {
    try {
      if (!this.isConnected) return null;
      
      const value = await this.client.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache hget error:', error);
      return null;
    }
  }

  /**
   * Get all hash fields
   * @param {string} key - Hash key
   * @returns {Promise<Object>} Hash object
   */
  async hgetall(key) {
    try {
      if (!this.isConnected) return {};
      
      const hash = await this.client.hgetall(key);
      const result = {};
      
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }
      
      return result;
    } catch (error) {
      logger.error('Cache hgetall error:', error);
      return {};
    }
  }

  /**
   * Delete hash field
   * @param {string} key - Hash key
   * @param {string} field - Field name
   * @returns {Promise<boolean>} Success status
   */
  async hdel(key, field) {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.client.hdel(key, field);
      return result === 1;
    } catch (error) {
      logger.error('Cache hdel error:', error);
      return false;
    }
  }

  /**
   * List operations
   */

  /**
   * Push to list
   * @param {string} key - List key
   * @param {any} value - Value to push
   * @returns {Promise<number>} List length
   */
  async lpush(key, value) {
    try {
      if (!this.isConnected) return 0;
      
      return await this.client.lpush(key, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache lpush error:', error);
      return 0;
    }
  }

  /**
   * Pop from list
   * @param {string} key - List key
   * @returns {Promise<any>} Popped value or null
   */
  async lpop(key) {
    try {
      if (!this.isConnected) return null;
      
      const value = await this.client.lpop(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache lpop error:', error);
      return null;
    }
  }

  /**
   * Get list range
   * @param {string} key - List key
   * @param {number} start - Start index
   * @param {number} stop - Stop index
   * @returns {Promise<Array>} List items
   */
  async lrange(key, start = 0, stop = -1) {
    try {
      if (!this.isConnected) return [];
      
      const values = await this.client.lrange(key, start, stop);
      return values.map(v => JSON.parse(v));
    } catch (error) {
      logger.error('Cache lrange error:', error);
      return [];
    }
  }

  /**
   * Set operations
   */

  /**
   * Add to set
   * @param {string} key - Set key
   * @param {any} member - Set member
   * @returns {Promise<boolean>} Success status
   */
  async sadd(key, member) {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.client.sadd(key, JSON.stringify(member));
      return result === 1;
    } catch (error) {
      logger.error('Cache sadd error:', error);
      return false;
    }
  }

  /**
   * Remove from set
   * @param {string} key - Set key
   * @param {any} member - Set member
   * @returns {Promise<boolean>} Success status
   */
  async srem(key, member) {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.client.srem(key, JSON.stringify(member));
      return result === 1;
    } catch (error) {
      logger.error('Cache srem error:', error);
      return false;
    }
  }

  /**
   * Get set members
   * @param {string} key - Set key
   * @returns {Promise<Array>} Set members
   */
  async smembers(key) {
    try {
      if (!this.isConnected) return [];
      
      const members = await this.client.smembers(key);
      return members.map(m => JSON.parse(m));
    } catch (error) {
      logger.error('Cache smembers error:', error);
      return [];
    }
  }

  /**
   * Check set membership
   * @param {string} key - Set key
   * @param {any} member - Set member
   * @returns {Promise<boolean>} Membership status
   */
  async sismember(key, member) {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.client.sismember(key, JSON.stringify(member));
      return result === 1;
    } catch (error) {
      logger.error('Cache sismember error:', error);
      return false;
    }
  }

  /**
   * Pub/Sub operations
   */

  /**
   * Publish message
   * @param {string} channel - Channel name
   * @param {any} message - Message to publish
   * @returns {Promise<number>} Number of subscribers
   */
  async publish(channel, message) {
    try {
      if (!this.isConnected) return 0;
      
      return await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      logger.error('Redis publish error:', error);
      return 0;
    }
  }

  /**
   * Subscribe to channel
   * @param {string} channel - Channel name
   * @param {Function} handler - Message handler
   * @returns {Promise<void>}
   */
  async subscribe(channel, handler) {
    try {
      if (!this.isConnected) return;
      
      await this.subscriber.subscribe(channel);
      
      this.subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const parsed = JSON.parse(message);
            handler(parsed);
          } catch (error) {
            logger.error('Redis message parse error:', error);
          }
        }
      });
      
      logger.debug(`Subscribed to channel: ${channel}`);
    } catch (error) {
      logger.error('Redis subscribe error:', error);
    }
  }

  /**
   * Unsubscribe from channel
   * @param {string} channel - Channel name
   * @returns {Promise<void>}
   */
  async unsubscribe(channel) {
    try {
      if (!this.isConnected) return;
      
      await this.subscriber.unsubscribe(channel);
      logger.debug(`Unsubscribed from channel: ${channel}`);
    } catch (error) {
      logger.error('Redis unsubscribe error:', error);
    }
  }

  /**
   * Advanced operations
   */

  /**
   * Execute Redis transaction
   * @param {Function} callback - Transaction callback
   * @returns {Promise<Array>} Transaction results
   */
  async transaction(callback) {
    try {
      if (!this.isConnected) return [];
      
      const pipeline = this.client.pipeline();
      await callback(pipeline);
      return await pipeline.exec();
    } catch (error) {
      logger.error('Redis transaction error:', error);
      return [];
    }
  }

  /**
   * Acquire lock
   * @param {string} resource - Resource name
   * @param {number} ttl - Lock TTL in seconds
   * @returns {Promise<string|null>} Lock token or null
   */
  async acquireLock(resource, ttl = 30) {
    try {
      if (!this.isConnected) return null;
      
      const token = require('crypto').randomBytes(16).toString('hex');
      const key = `lock:${resource}`;
      
      const result = await this.client.set(key, token, 'NX', 'EX', ttl);
      
      if (result === 'OK') {
        logger.debug(`Lock acquired: ${resource}`);
        return token;
      }
      
      return null;
    } catch (error) {
      logger.error('Redis acquire lock error:', error);
      return null;
    }
  }

  /**
   * Release lock
   * @param {string} resource - Resource name
   * @param {string} token - Lock token
   * @returns {Promise<boolean>} Success status
   */
  async releaseLock(resource, token) {
    try {
      if (!this.isConnected) return false;
      
      const key = `lock:${resource}`;
      
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.client.eval(script, 1, key, token);
      
      if (result === 1) {
        logger.debug(`Lock released: ${resource}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Redis release lock error:', error);
      return false;
    }
  }

  /**
   * Clear all cache
   * @returns {Promise<void>}
   */
  async flushAll() {
    try {
      if (!this.isConnected) return;
      
      if (config.isProduction) {
        throw new Error('Cache flush not allowed in production');
      }
      
      await this.client.flushall();
      logger.warn('⚠️  All cache cleared');
    } catch (error) {
      logger.error('Redis flush error:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats() {
    try {
      if (!this.isConnected) {
        return { connected: false };
      }
      
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbsize();
      
      return {
        connected: true,
        dbSize,
        info,
      };
    } catch (error) {
      logger.error('Redis stats error:', error);
      return { connected: false, error: error.message };
    }
  }

  /**
   * Health check
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return {
          status: 'disconnected',
          message: 'Redis is not connected',
        };
      }
      
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        message: 'Redis is connected and responding',
        latency: `${latency}ms`,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Redis health check failed',
        error: error.message,
      };
    }
  }
}

// Create singleton instance
const redisManager = new RedisManager();

// Export manager instance
module.exports = redisManager;

// Export convenience methods
module.exports.cache = {
  get: (key) => redisManager.get(key),
  set: (key, value, ttl) => redisManager.set(key, value, ttl),
  delete: (key) => redisManager.delete(key),
  exists: (key) => redisManager.exists(key),
  expire: (key, seconds) => redisManager.expire(key, seconds),
  ttl: (key) => redisManager.ttl(key),
};

// Export pub/sub methods
module.exports.pubsub = {
  publish: (channel, message) => redisManager.publish(channel, message),
  subscribe: (channel, handler) => redisManager.subscribe(channel, handler),
  unsubscribe: (channel) => redisManager.unsubscribe(channel),
};

// Export lock methods
module.exports.lock = {
  acquire: (resource, ttl) => redisManager.acquireLock(resource, ttl),
  release: (resource, token) => redisManager.releaseLock(resource, token),
};