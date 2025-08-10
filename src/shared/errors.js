/**
 * CreatorsMantra Backend - Custom Error Classes
 * Application-specific error handling
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

class AppError extends Error {
    constructor(message, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = true;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  class ValidationError extends AppError {
    constructor(message) {
      super(message, 400);
      this.code = 'VALIDATION_ERROR';
    }
  }
  
  class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
      super(message, 401);
      this.code = 'AUTHENTICATION_ERROR';
    }
  }
  
  class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
      super(message, 403);
      this.code = 'AUTHORIZATION_ERROR';
    }
  }
  
  class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
      super(message, 404);
      this.code = 'NOT_FOUND';
    }
  }
  
  module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError
  };