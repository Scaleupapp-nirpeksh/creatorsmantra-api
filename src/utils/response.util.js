/**
 * Response Utility
 * @module utils/response
 * @description Standardized API response formatting for consistent client communication
 * 
 * File Path: src/utils/response.util.js
 * 
 * Features:
 * - Consistent response structure across all endpoints
 * - Automatic error sanitization in production
 * - Request ID tracking for debugging
 * - Pagination support
 * - Multiple response helpers for common scenarios
 */

const { HTTP_STATUS, SUCCESS_MESSAGES, ERROR_CODES } = require('../config/constants');
const config = require('../config/environment');
const logger = require('../config/logger');

/**
 * Response Utility Class
 * Provides standardized response formatting methods
 */
class ResponseUtil {
  /**
   * Success Response
   * @param {Object} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Success message
   * @param {any} data - Response data
   * @param {Object} meta - Additional metadata
   * @returns {Object} Express response
   */
  static success(res, statusCode = HTTP_STATUS.OK, message = SUCCESS_MESSAGES.OPERATION_SUCCESS, data = null, meta = {}) {
    const response = {
      success: true,
      statusCode,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: config.app.apiVersion,
        ...meta,
      },
    };

    // Add request ID if available
    if (res.locals?.requestId) {
      response.meta.requestId = res.locals.requestId;
    }

    // Log successful response
    logger.debug('API Response Success', {
      statusCode,
      message,
      requestId: res.locals?.requestId,
      userId: res.locals?.user?.id,
    });

    return res.status(statusCode).json(response);
  }

  /**
   * Error Response
   * @param {Object} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {string} errorCode - Application error code
   * @param {Object} details - Error details (sanitized in production)
   * @returns {Object} Express response
   */
  static error(res, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, message = 'An error occurred', errorCode = null, details = null) {
    // Sanitize error details in production
    const sanitizedDetails = config.isProduction ? null : details;
    const sanitizedMessage = config.isProduction && statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR 
      ? 'An internal error occurred. Please try again later.' 
      : message;

    const response = {
      success: false,
      statusCode,
      message: sanitizedMessage,
      error: {
        code: errorCode || ERROR_CODES.INTERNAL_ERROR,
        timestamp: new Date().toISOString(),
      },
    };

    // Add details only in non-production or for client errors
    if (sanitizedDetails || (statusCode >= 400 && statusCode < 500)) {
      response.error.details = sanitizedDetails;
    }

    // Add request ID for tracking
    if (res.locals?.requestId) {
      response.error.requestId = res.locals.requestId;
    }

    // Add support contact for server errors
    if (statusCode >= 500) {
      response.error.supportMessage = 'If this problem persists, please contact support with the request ID.';
    }

    // Log error response
    logger.error('API Response Error', {
      statusCode,
      message,
      errorCode,
      details,
      requestId: res.locals?.requestId,
      userId: res.locals?.user?.id,
      stack: details?.stack,
    });

    return res.status(statusCode).json(response);
  }

  /**
   * Paginated Response
   * @param {Object} res - Express response object
   * @param {Array} data - Array of items
   * @param {number} page - Current page number
   * @param {number} limit - Items per page
   * @param {number} total - Total items count
   * @param {string} message - Success message
   * @returns {Object} Express response
   */
  static paginated(res, data = [], page = 1, limit = 20, total = 0, message = SUCCESS_MESSAGES.FETCHED) {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const response = {
      success: true,
      statusCode: HTTP_STATUS.OK,
      message,
      data,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: total,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: config.app.apiVersion,
      },
    };

    // Add request ID
    if (res.locals?.requestId) {
      response.meta.requestId = res.locals.requestId;
    }

    // Log paginated response
    logger.debug('API Response Paginated', {
      page,
      limit,
      total,
      requestId: res.locals?.requestId,
    });

    return res.status(HTTP_STATUS.OK).json(response);
  }

  /**
   * Created Response (201)
   * @param {Object} res - Express response object
   * @param {string} message - Success message
   * @param {any} data - Created resource data
   * @returns {Object} Express response
   */
  static created(res, message = SUCCESS_MESSAGES.CREATED, data = null) {
    return this.success(res, HTTP_STATUS.CREATED, message, data);
  }

  /**
   * Updated Response
   * @param {Object} res - Express response object
   * @param {string} message - Success message
   * @param {any} data - Updated resource data
   * @returns {Object} Express response
   */
  static updated(res, message = SUCCESS_MESSAGES.UPDATED, data = null) {
    return this.success(res, HTTP_STATUS.OK, message, data);
  }

  /**
   * Deleted Response
   * @param {Object} res - Express response object
   * @param {string} message - Success message
   * @returns {Object} Express response
   */
  static deleted(res, message = SUCCESS_MESSAGES.DELETED) {
    return this.success(res, HTTP_STATUS.OK, message, null);
  }

  /**
   * No Content Response (204)
   * @param {Object} res - Express response object
   * @returns {Object} Express response
   */
  static noContent(res) {
    logger.debug('API Response No Content', {
      requestId: res.locals?.requestId,
    });
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  /**
   * Bad Request Response (400)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {Object} details - Error details
   * @returns {Object} Express response
   */
  static badRequest(res, message = 'Bad request', details = null) {
    return this.error(res, HTTP_STATUS.BAD_REQUEST, message, ERROR_CODES.INVALID_INPUT, details);
  }

  /**
   * Validation Error Response (422)
   * @param {Object} res - Express response object
   * @param {Object} errors - Validation errors object
   * @param {string} message - Error message
   * @returns {Object} Express response
   */
  static validationError(res, errors = {}, message = 'Validation failed') {
    const formattedErrors = this.formatValidationErrors(errors);
    return this.error(res, HTTP_STATUS.UNPROCESSABLE_ENTITY, message, ERROR_CODES.VALIDATION_ERROR, formattedErrors);
  }

  /**
   * Unauthorized Response (401)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @returns {Object} Express response
   */
  static unauthorized(res, message = 'Unauthorized access') {
    return this.error(res, HTTP_STATUS.UNAUTHORIZED, message, ERROR_CODES.UNAUTHORIZED);
  }

  /**
   * Forbidden Response (403)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @returns {Object} Express response
   */
  static forbidden(res, message = 'Access forbidden') {
    return this.error(res, HTTP_STATUS.FORBIDDEN, message, ERROR_CODES.PERMISSION_DENIED);
  }

  /**
   * Not Found Response (404)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {string} resource - Resource type that was not found
   * @returns {Object} Express response
   */
  static notFound(res, message = 'Resource not found', resource = null) {
    const details = resource ? { resource } : null;
    return this.error(res, HTTP_STATUS.NOT_FOUND, message, ERROR_CODES.RESOURCE_NOT_FOUND, details);
  }

  /**
   * Conflict Response (409)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {Object} details - Conflict details
   * @returns {Object} Express response
   */
  static conflict(res, message = 'Resource conflict', details = null) {
    return this.error(res, HTTP_STATUS.CONFLICT, message, ERROR_CODES.RESOURCE_CONFLICT, details);
  }

  /**
   * Too Many Requests Response (429)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} retryAfter - Seconds until retry
   * @returns {Object} Express response
   */
  static tooManyRequests(res, message = 'Too many requests', retryAfter = 60) {
    res.set('Retry-After', retryAfter);
    return this.error(res, HTTP_STATUS.TOO_MANY_REQUESTS, message, ERROR_CODES.RATE_LIMIT_EXCEEDED, { retryAfter });
  }

  /**
   * Server Error Response (500)
   * @param {Object} res - Express response object
   * @param {Error} error - Error object
   * @param {string} message - Error message
   * @returns {Object} Express response
   */
  static serverError(res, error = null, message = 'Internal server error') {
    // Log the full error internally
    if (error) {
      logger.error('Server Error', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        requestId: res.locals?.requestId,
        userId: res.locals?.user?.id,
      });
    }

    // Send sanitized response
    return this.error(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message, ERROR_CODES.INTERNAL_ERROR);
  }

  /**
   * Service Unavailable Response (503)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} retryAfter - Seconds until service is available
   * @returns {Object} Express response
   */
  static serviceUnavailable(res, message = 'Service temporarily unavailable', retryAfter = 300) {
    res.set('Retry-After', retryAfter);
    return this.error(res, HTTP_STATUS.SERVICE_UNAVAILABLE, message, ERROR_CODES.INTERNAL_ERROR, { retryAfter });
  }

  /**
   * Custom Response
   * @param {Object} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {Object} body - Response body
   * @returns {Object} Express response
   */
  static custom(res, statusCode, body) {
    logger.debug('API Response Custom', {
      statusCode,
      requestId: res.locals?.requestId,
    });
    return res.status(statusCode).json(body);
  }

  /**
   * File Response
   * @param {Object} res - Express response object
   * @param {Buffer|Stream} file - File buffer or stream
   * @param {string} filename - File name
   * @param {string} contentType - MIME type
   * @returns {Object} Express response
   */
  static file(res, file, filename, contentType = 'application/octet-stream') {
    logger.debug('API Response File', {
      filename,
      contentType,
      requestId: res.locals?.requestId,
    });

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    if (Buffer.isBuffer(file)) {
      return res.send(file);
    } else {
      return file.pipe(res);
    }
  }

  /**
   * Redirect Response
   * @param {Object} res - Express response object
   * @param {string} url - Redirect URL
   * @param {boolean} permanent - Permanent redirect flag
   * @returns {Object} Express response
   */
  static redirect(res, url, permanent = false) {
    const statusCode = permanent ? HTTP_STATUS.MOVED_PERMANENTLY : HTTP_STATUS.FOUND;
    
    logger.debug('API Response Redirect', {
      url,
      statusCode,
      requestId: res.locals?.requestId,
    });

    return res.redirect(statusCode, url);
  }

  /**
   * Format Validation Errors
   * @param {Object|Array} errors - Validation errors
   * @returns {Object} Formatted errors
   */
  static formatValidationErrors(errors) {
    if (Array.isArray(errors)) {
      return errors.reduce((acc, error) => {
        const field = error.path?.join('.') || error.field || 'unknown';
        acc[field] = error.message || 'Invalid value';
        return acc;
      }, {});
    }

    if (typeof errors === 'object' && errors !== null) {
      return Object.keys(errors).reduce((acc, key) => {
        acc[key] = errors[key].message || errors[key] || 'Invalid value';
        return acc;
      }, {});
    }

    return { general: 'Validation failed' };
  }

  /**
   * Payment Required Response (402)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {Object} details - Payment details
   * @returns {Object} Express response
   */
  static paymentRequired(res, message = 'Payment required', details = null) {
    return this.error(res, 402, message, ERROR_CODES.SUBSCRIPTION_EXPIRED, details);
  }

  /**
   * Method Not Allowed Response (405)
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {Array} allowedMethods - Allowed HTTP methods
   * @returns {Object} Express response
   */
  static methodNotAllowed(res, message = 'Method not allowed', allowedMethods = []) {
    if (allowedMethods.length > 0) {
      res.set('Allow', allowedMethods.join(', '));
    }
    return this.error(res, HTTP_STATUS.METHOD_NOT_ALLOWED, message, ERROR_CODES.INVALID_OPERATION, { allowedMethods });
  }
}

// Export the utility class and convenience methods
module.exports = ResponseUtil;

// Export convenience methods for direct use
module.exports.respond = {
  success: ResponseUtil.success,
  error: ResponseUtil.error,
  paginated: ResponseUtil.paginated,
  created: ResponseUtil.created,
  updated: ResponseUtil.updated,
  deleted: ResponseUtil.deleted,
  noContent: ResponseUtil.noContent,
  badRequest: ResponseUtil.badRequest,
  validationError: ResponseUtil.validationError,
  unauthorized: ResponseUtil.unauthorized,
  forbidden: ResponseUtil.forbidden,
  notFound: ResponseUtil.notFound,
  conflict: ResponseUtil.conflict,
  tooManyRequests: ResponseUtil.tooManyRequests,
  serverError: ResponseUtil.serverError,
  serviceUnavailable: ResponseUtil.serviceUnavailable,
  custom: ResponseUtil.custom,
  file: ResponseUtil.file,
  redirect: ResponseUtil.redirect,
  paymentRequired: ResponseUtil.paymentRequired,
  methodNotAllowed: ResponseUtil.methodNotAllowed,
};