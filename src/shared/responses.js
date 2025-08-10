/**
 * CreatorsMantra Backend - Response Utilities
 * Standardized response formatters
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

/**
 * Success response formatter
 */
const successResponse = (message, data = null, code = 200) => {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      code
    };
  };
  
  /**
   * Error response formatter
   */
  const errorResponse = (message, error = null, code = 400) => {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
      code
    };
  
    if (error) {
      response.error = {
        code: error.code || 'ERROR',
        details: error.details || {}
      };
    }
  
    return response;
  };
  
  /**
   * Pagination response formatter
   */
  const paginatedResponse = (message, data, pagination, code = 200) => {
    return {
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        pages: pagination.pages || 1
      },
      timestamp: new Date().toISOString(),
      code
    };
  };
  
  module.exports = {
    successResponse,
    errorResponse,
    paginatedResponse
  };