/**
 * Middleware to parse JSON fields in multipart form data
 * This handles the conversion of JSON strings back to objects/arrays
 */
const parseMultipartJson = (jsonFields = ['tags']) => {
    return (req, res, next) => {
      if (req.body && typeof req.body === 'object') {
        jsonFields.forEach(field => {
          if (req.body[field] && typeof req.body[field] === 'string') {
            try {
              req.body[field] = JSON.parse(req.body[field]);
            } catch (error) {
              // Log warning but don't fail - let validation handle invalid JSON
              console.warn(`Failed to parse multipart field '${field}' as JSON:`, req.body[field]);
            }
          }
        });
      }
      next();
    };
  };
  
  module.exports = { parseMultipartJson };