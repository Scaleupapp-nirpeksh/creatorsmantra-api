/**
 * Logger Configuration
 * @module config/logger
 * @description Winston logger setup with multiple transports and log rotation
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const config = require('./environment');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Custom log format
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  winston.format.json()
);

/**
 * Console log format (colorized for development)
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, metadata, stack } = info;
    
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (metadata && Object.keys(metadata).length > 0) {
      log += ` ${JSON.stringify(metadata)}`;
    }
    
    // Add stack trace if present
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

/**
 * Log levels configuration
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

/**
 * Log colors for console output
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray',
};

// Add colors to winston
winston.addColors(colors);

/**
 * Transport configurations
 */
const transports = [];

// Console transport (always enabled in development)
if (!config.isProduction || config.logging.level === 'debug') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true,
    })
  );
}

// File transport for all logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: config.logging.maxSize || '20m',
    maxFiles: config.logging.maxFiles || '14d',
    format: customFormat,
    handleExceptions: true,
    handleRejections: true,
  })
);

// File transport for error logs only
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: config.logging.maxSize || '20m',
    maxFiles: config.logging.maxFiles || '14d',
    level: 'error',
    format: customFormat,
    handleExceptions: true,
    handleRejections: true,
  })
);

// HTTP request logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'http-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '10m',
    maxFiles: '7d',
    level: 'http',
    format: customFormat,
  })
);

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: config.logging.level || 'info',
  levels,
  format: customFormat,
  transports,
  exitOnError: false,
});

/**
 * Logger class wrapper for additional functionality
 */
class Logger {
  constructor() {
    this.logger = logger;
    this.requestId = null;
    this.userId = null;
    this.metadata = {};
  }

  /**
   * Set request context
   * @param {string} requestId - Request ID
   * @param {string} userId - User ID
   */
  setContext(requestId, userId = null) {
    this.requestId = requestId;
    this.userId = userId;
    this.metadata = {
      requestId,
      userId,
    };
  }

  /**
   * Clear context
   */
  clearContext() {
    this.requestId = null;
    this.userId = null;
    this.metadata = {};
  }

  /**
   * Add metadata to logs
   * @param {Object} metadata - Additional metadata
   */
  addMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
  }

  /**
   * Log error
   * @param {string} message - Error message
   * @param {Error|Object} error - Error object or metadata
   */
  error(message, error = {}) {
    const metadata = this.buildMetadata(error);
    
    if (error instanceof Error) {
      this.logger.error(message, {
        ...metadata,
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code,
          name: error.name,
        },
      });
    } else {
      this.logger.error(message, metadata);
    }
  }

  /**
   * Log warning
   * @param {string} message - Warning message
   * @param {Object} metadata - Additional metadata
   */
  warn(message, metadata = {}) {
    this.logger.warn(message, this.buildMetadata(metadata));
  }

  /**
   * Log info
   * @param {string} message - Info message
   * @param {Object} metadata - Additional metadata
   */
  info(message, metadata = {}) {
    this.logger.info(message, this.buildMetadata(metadata));
  }

  /**
   * Log HTTP request
   * @param {string} message - HTTP message
   * @param {Object} metadata - Request metadata
   */
  http(message, metadata = {}) {
    this.logger.http(message, this.buildMetadata(metadata));
  }

  /**
   * Log verbose
   * @param {string} message - Verbose message
   * @param {Object} metadata - Additional metadata
   */
  verbose(message, metadata = {}) {
    this.logger.verbose(message, this.buildMetadata(metadata));
  }

  /**
   * Log debug
   * @param {string} message - Debug message
   * @param {Object} metadata - Additional metadata
   */
  debug(message, metadata = {}) {
    this.logger.debug(message, this.buildMetadata(metadata));
  }

  /**
   * Log silly
   * @param {string} message - Silly message
   * @param {Object} metadata - Additional metadata
   */
  silly(message, metadata = {}) {
    this.logger.silly(message, this.buildMetadata(metadata));
  }

  /**
   * Build metadata object
   * @param {Object} additionalMetadata - Additional metadata
   * @returns {Object} Combined metadata
   */
  buildMetadata(additionalMetadata = {}) {
    return {
      ...this.metadata,
      ...additionalMetadata,
      timestamp: new Date().toISOString(),
      environment: config.env,
    };
  }

  /**
   * Log API request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} responseTime - Response time in ms
   */
  logRequest(req, res, responseTime) {
    const metadata = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      requestId: req.id,
      userId: req.user?.id,
    };

    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime}ms`;

    if (res.statusCode >= 500) {
      this.error(message, metadata);
    } else if (res.statusCode >= 400) {
      this.warn(message, metadata);
    } else {
      this.http(message, metadata);
    }
  }

  /**
   * Log database query
   * @param {string} operation - Database operation
   * @param {string} collection - Collection name
   * @param {Object} query - Query object
   * @param {number} duration - Query duration in ms
   */
  logDatabaseQuery(operation, collection, query, duration) {
    const metadata = {
      operation,
      collection,
      query: JSON.stringify(query),
      duration: `${duration}ms`,
    };

    if (duration > 1000) {
      this.warn(`Slow database query: ${operation} on ${collection}`, metadata);
    } else {
      this.debug(`Database query: ${operation} on ${collection}`, metadata);
    }
  }

  /**
   * Log external API call
   * @param {string} service - Service name
   * @param {string} endpoint - API endpoint
   * @param {number} statusCode - Response status code
   * @param {number} duration - Call duration in ms
   */
  logExternalAPI(service, endpoint, statusCode, duration) {
    const metadata = {
      service,
      endpoint,
      statusCode,
      duration: `${duration}ms`,
    };

    const message = `External API call to ${service}: ${endpoint}`;

    if (statusCode >= 500 || duration > 5000) {
      this.error(message, metadata);
    } else if (statusCode >= 400 || duration > 2000) {
      this.warn(message, metadata);
    } else {
      this.info(message, metadata);
    }
  }

  /**
   * Log job execution
   * @param {string} jobName - Job name
   * @param {string} status - Job status
   * @param {Object} metadata - Job metadata
   */
  logJob(jobName, status, metadata = {}) {
    const message = `Job ${jobName}: ${status}`;
    
    if (status === 'failed') {
      this.error(message, metadata);
    } else if (status === 'completed') {
      this.info(message, metadata);
    } else {
      this.debug(message, metadata);
    }
  }

  /**
   * Log security event
   * @param {string} event - Security event type
   * @param {Object} metadata - Event metadata
   */
  logSecurity(event, metadata = {}) {
    this.warn(`Security event: ${event}`, {
      ...metadata,
      securityEvent: true,
    });
  }

  /**
   * Log payment event
   * @param {string} event - Payment event type
   * @param {Object} metadata - Payment metadata
   */
  logPayment(event, metadata = {}) {
    this.info(`Payment event: ${event}`, {
      ...metadata,
      paymentEvent: true,
    });
  }

  /**
   * Log AI service event
   * @param {string} service - AI service name
   * @param {string} operation - Operation type
   * @param {Object} metadata - Service metadata
   */
  logAI(service, operation, metadata = {}) {
    this.info(`AI service ${service}: ${operation}`, {
      ...metadata,
      aiService: service,
      aiOperation: operation,
    });
  }

  /**
   * Create child logger with additional context
   * @param {Object} metadata - Child logger metadata
   * @returns {Logger} Child logger instance
   */
  child(metadata) {
    const childLogger = new Logger();
    childLogger.metadata = { ...this.metadata, ...metadata };
    return childLogger;
  }

  /**
   * Stream for Morgan HTTP logger
   */
  get stream() {
    return {
      write: (message) => {
        this.http(message.trim());
      },
    };
  }

  /**
   * Check if log level is enabled
   * @param {string} level - Log level to check
   * @returns {boolean} Whether level is enabled
   */
  isLevelEnabled(level) {
    const currentLevel = levels[this.logger.level];
    const checkLevel = levels[level];
    return checkLevel <= currentLevel;
  }

  /**
   * Performance monitoring
   * @param {string} label - Performance label
   * @returns {Function} End function to call when operation completes
   */
  startTimer(label) {
    const start = Date.now();
    return (metadata = {}) => {
      const duration = Date.now() - start;
      this.debug(`Performance: ${label}`, {
        ...metadata,
        duration: `${duration}ms`,
        performance: true,
      });
      return duration;
    };
  }

  /**
   * Audit log
   * @param {string} action - Audit action
   * @param {Object} metadata - Audit metadata
   */
  audit(action, metadata = {}) {
    this.info(`Audit: ${action}`, {
      ...metadata,
      audit: true,
      action,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get log statistics
   * @returns {Object} Log statistics
   */
  getStats() {
    // This would typically query the log files or a log aggregation service
    return {
      levels: Object.keys(levels),
      currentLevel: this.logger.level,
      transports: this.logger.transports.map(t => t.constructor.name),
      logDirectory: logDir,
    };
  }

  /**
   * Flush logs (for graceful shutdown)
   * @returns {Promise<void>}
   */
  async flush() {
    return new Promise((resolve) => {
      logger.on('finish', resolve);
      logger.end();
    });
  }
}

// Create singleton instance
const loggerInstance = new Logger();

// Export logger instance and methods
module.exports = loggerInstance;

// Also export the raw Winston logger if needed
module.exports.winston = logger;

// Export utility functions
module.exports.createChildLogger = (metadata) => loggerInstance.child(metadata);
module.exports.setLogLevel = (level) => {
  logger.level = level;
  loggerInstance.info(`Log level changed to: ${level}`);
};