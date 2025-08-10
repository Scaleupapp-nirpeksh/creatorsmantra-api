//src/shared/utils.js
/**
 * CreatorsMantra Backend - Shared Utilities
 * Single utility file containing all helper functions
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Standardized API response format
 * @param {boolean} success - Success status
 * @param {string} message - Response message
 * @param {any} data - Response data
 * @param {any} error - Error details
 * @param {number} code - HTTP status code
 */
const apiResponse = (success, message, data = null, error = null, code = 200) => {
  return {
    success,
    message,
    data,
    error,
    timestamp: new Date().toISOString(),
    code
  };
};

/**
 * Success response helper
 */
const successResponse = (message, data = null, code = 200) => {
  return apiResponse(true, message, data, null, code);
};

/**
 * Error response helper
 */
const errorResponse = (message, error = null, code = 400) => {
  return apiResponse(false, message, null, error, code);
};

// ============================================
// AUTHENTICATION HELPERS
// ============================================

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} Match result
 */
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Generate JWT token
 * @param {object} payload - Token payload
 * @param {string} expiresIn - Token expiration
 * @returns {string} JWT token
 */
const generateToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {object} Decoded token payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Generate refresh token
 * @param {object} payload - Token payload
 * @returns {string} Refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { 
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' 
  });
};

// ============================================
// ENCRYPTION HELPERS
// ============================================

/**
 * Encrypt sensitive data
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted text
 */
const encryptData = (text) => {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text
 * @returns {string} Decrypted text
 */
const decryptData = (encryptedText) => {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
  
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedData = textParts.join(':');
  
  const decipher = crypto.createDecipher(algorithm, key);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Validation result
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Indian format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Validation result
 */
const isValidPhone = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Validation result with details
 */
const validatePassword = (password) => {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const isValid = minLength && hasUppercase && hasLowercase && hasNumbers && hasSpecialChar;
  
  return {
    isValid,
    requirements: {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumbers,
      hasSpecialChar
    }
  };
};

/**
 * Sanitize input string
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
};

// ============================================
// DATE HELPERS
// ============================================

/**
 * Format date to IST
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
const formatToIST = (date = new Date()) => {
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * Get start and end of day in IST
 * @param {Date} date - Date
 * @returns {object} Start and end of day
 */
const getISTDayBounds = (date = new Date()) => {
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const startOfDay = new Date(istDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(istDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  return { startOfDay, endOfDay };
};

/**
 * Add days to date
 * @param {Date} date - Base date
 * @param {number} days - Days to add
 * @returns {Date} New date
 */
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Calculate days between dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} Days difference
 */
const daysDifference = (date1, date2) => {
  const timeDiff = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

// ============================================
// STRING HELPERS
// ============================================

/**
 * Generate random string
 * @param {number} length - String length
 * @returns {string} Random string
 */
const generateRandomString = (length = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate invoice number
 * @param {string} prefix - Invoice prefix
 * @returns {string} Invoice number
 */
const generateInvoiceNumber = (prefix = 'INV') => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Slugify string
 * @param {string} text - Text to slugify
 * @returns {string} Slugified text
 */
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

/**
 * Capitalize first letter
 * @param {string} string - String to capitalize
 * @returns {string} Capitalized string
 */
const capitalize = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};

// ============================================
// NUMBER HELPERS
// ============================================

/**
 * Format currency to Indian Rupees
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount);
};

/**
 * Calculate percentage
 * @param {number} value - Value
 * @param {number} total - Total
 * @returns {number} Percentage
 */
const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 100) / 100;
};

/**
 * Calculate GST (18%)
 * @param {number} amount - Base amount
 * @returns {object} GST calculation
 */
const calculateGST = (amount) => {
  const gstRate = 0.18;
  const gstAmount = Math.round(amount * gstRate * 100) / 100;
  const totalAmount = amount + gstAmount;
  
  return {
    baseAmount: amount,
    gstAmount,
    gstRate: gstRate * 100,
    totalAmount
  };
};

/**
 * Calculate TDS (10%)
 * @param {number} amount - Amount for TDS calculation
 * @returns {object} TDS calculation
 */
const calculateTDS = (amount) => {
  const tdsRate = 0.10;
  const tdsAmount = Math.round(amount * tdsRate * 100) / 100;
  const amountAfterTDS = amount - tdsAmount;
  
  return {
    grossAmount: amount,
    tdsAmount,
    tdsRate: tdsRate * 100,
    netAmount: amountAfterTDS
  };
};

// ============================================
// ARRAY HELPERS
// ============================================

/**
 * Remove duplicates from array
 * @param {Array} array - Array with duplicates
 * @returns {Array} Array without duplicates
 */
const removeDuplicates = (array) => {
  return [...new Set(array)];
};

/**
 * Chunk array into smaller arrays
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array} Chunked array
 */
const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Shuffle array
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// ============================================
// OBJECT HELPERS
// ============================================

/**
 * Deep clone object
 * @param {object} obj - Object to clone
 * @returns {object} Cloned object
 */
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Remove null/undefined values from object
 * @param {object} obj - Object to clean
 * @returns {object} Cleaned object
 */
const removeNullish = (obj) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== null && value !== undefined)
  );
};

/**
 * Pick specific keys from object
 * @param {object} obj - Source object
 * @param {Array} keys - Keys to pick
 * @returns {object} Object with picked keys
 */
const pick = (obj, keys) => {
  return keys.reduce((result, key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
    return result;
  }, {});
};

/**
 * Omit specific keys from object
 * @param {object} obj - Source object
 * @param {Array} keys - Keys to omit
 * @returns {object} Object without omitted keys
 */
const omit = (obj, keys) => {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
};

// ============================================
// FILE HELPERS
// ============================================

/**
 * Get file extension
 * @param {string} filename - Filename
 * @returns {string} File extension
 */
const getFileExtension = (filename) => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
};

/**
 * Check if file type is allowed
 * @param {string} filename - Filename
 * @param {Array} allowedTypes - Allowed file types
 * @returns {boolean} Whether file type is allowed
 */
const isAllowedFileType = (filename, allowedTypes = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']) => {
  const extension = getFileExtension(filename).toLowerCase();
  return allowedTypes.includes(extension);
};

/**
 * Format file size
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ============================================
// ERROR HELPERS
// ============================================

/**
 * Create standardized error
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @returns {Error} Standardized error
 */
const createError = (message, statusCode = 500, code = 'INTERNAL_ERROR') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

/**
 * Handle async errors
 * @param {Function} fn - Async function
 * @returns {Function} Wrapped function with error handling
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ============================================
// LOGGER HELPER
// ============================================

/**
 * Simple console logger with timestamp
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
const log = (level, message, meta = {}) => {
  const timestamp = formatToIST();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...meta
  };
  
  console.log(JSON.stringify(logEntry, null, 2));
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Response helpers
  apiResponse,
  successResponse,
  errorResponse,
  
  // Authentication helpers
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateRefreshToken,
  
  // Encryption helpers
  encryptData,
  decryptData,
  
  // Validation helpers
  isValidEmail,
  isValidPhone,
  validatePassword,
  sanitizeInput,
  
  // Date helpers
  formatToIST,
  getISTDayBounds,
  addDays,
  daysDifference,
  
  // String helpers
  generateRandomString,
  generateInvoiceNumber,
  slugify,
  capitalize,
  
  // Number helpers
  formatCurrency,
  calculatePercentage,
  calculateGST,
  calculateTDS,
  
  // Array helpers
  removeDuplicates,
  chunkArray,
  shuffleArray,
  
  // Object helpers
  deepClone,
  removeNullish,
  pick,
  omit,
  
  // File helpers
  getFileExtension,
  isAllowedFileType,
  formatFileSize,
  
  // Error helpers
  createError,
  asyncHandler,
  
  // Logger
  log
};