/**
 * Sanitize Utility
 * @module utils/sanitize
 * @description Input sanitization and XSS prevention for security
 * 
 * File Path: src/utils/sanitize.util.js
 * 
 * Features:
 * - XSS prevention through HTML sanitization
 * - NoSQL injection prevention
 * - File name sanitization
 * - URL validation and cleaning
 * - Content sanitization for briefs and contracts
 * - Email normalization
 * - Safe regex escaping
 */

const validator = require('validator');
const xss = require('xss');
const DOMPurify = require('isomorphic-dompurify');
const logger = require('../config/logger');
const { ALLOWED_EXTENSIONS, MIME_TYPES } = require('../config/constants');

/**
 * Sanitization Configuration
 */
const SANITIZE_CONFIG = {
  // XSS filter options
  xss: {
    whiteList: {
      a: ['href', 'title', 'target'],
      b: [],
      i: [],
      em: [],
      strong: [],
      p: [],
      br: [],
      ul: [],
      ol: [],
      li: [],
      blockquote: [],
      h1: [],
      h2: [],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      span: ['style'],
      div: ['style'],
      pre: [],
      code: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
    css: false,
  },

  // DOMPurify configuration
  domPurify: {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'i', 'b', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    USE_PROFILES: { html: true },
  },

  // File name restrictions
  fileName: {
    maxLength: 255,
    allowedChars: /[^a-zA-Z0-9._-]/g,
    reservedNames: ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'],
  },

  // URL sanitization
  url: {
    protocols: ['http', 'https'],
    defaultProtocol: 'https',
  },

  // MongoDB operators that should be removed
  mongoOperators: [
    '$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin',
    '$and', '$or', '$not', '$nor', '$exists', '$type',
    '$regex', '$where', '$expr', '$jsonSchema',
    '$mod', '$text', '$search', '$all', '$elemMatch', '$size',
    '$slice', '$comment', '$meta', '$geoWithin', '$geoIntersects',
    '$near', '$nearSphere', '$maxDistance', '$minDistance',
    '$box', '$center', '$centerSphere', '$geometry', '$polygon'
  ],
};

/**
 * Sanitize Utility Class
 * Provides methods for sanitizing various types of input
 */
class SanitizeUtil {
  /**
   * General input sanitization
   * @param {string} input - Input to sanitize
   * @param {Object} options - Sanitization options
   * @returns {string} Sanitized input
   */
  sanitizeInput(input, options = {}) {
    try {
      if (!input) return '';
      
      // Convert to string if not already
      let sanitized = String(input);

      // Trim whitespace
      if (options.trim !== false) {
        sanitized = sanitized.trim();
      }

      // Remove null bytes
      sanitized = sanitized.replace(/\0/g, '');

      // Escape HTML by default
      if (options.escapeHtml !== false) {
        sanitized = validator.escape(sanitized);
      }

      // Remove control characters
      if (options.removeControlChars !== false) {
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
      }

      // Limit length
      if (options.maxLength) {
        sanitized = sanitized.substring(0, options.maxLength);
      }

      // Remove extra whitespace
      if (options.normalizeWhitespace) {
        sanitized = this.normalizeWhitespace(sanitized);
      }

      // Convert to lowercase
      if (options.toLowerCase) {
        sanitized = sanitized.toLowerCase();
      }

      // Convert to uppercase
      if (options.toUpperCase) {
        sanitized = sanitized.toUpperCase();
      }

      return sanitized;
    } catch (error) {
      logger.error('Input sanitization error', { error: error.message });
      return '';
    }
  }

  /**
   * Sanitize HTML content
   * @param {string} html - HTML content
   * @param {Object} options - Sanitization options
   * @returns {string} Sanitized HTML
   */
  sanitizeHTML(html, options = {}) {
    try {
      if (!html) return '';

      // Use DOMPurify for thorough sanitization
      let clean = DOMPurify.sanitize(html, {
        ...SANITIZE_CONFIG.domPurify,
        ...options,
      });

      // Additional XSS filtering
      if (options.doubleFilter) {
        clean = xss(clean, SANITIZE_CONFIG.xss);
      }

      // Remove any remaining scripts
      clean = this.removeScripts(clean);

      // Remove event handlers
      clean = clean.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
      clean = clean.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

      // Remove javascript: protocol
      clean = clean.replace(/javascript:/gi, '');

      // Remove data URIs if not allowed
      if (!options.allowDataUri) {
        clean = clean.replace(/data:.*?;base64,/gi, '');
      }

      return clean;
    } catch (error) {
      logger.error('HTML sanitization error', { error: error.message });
      return '';
    }
  }

  /**
   * Sanitize file name
   * @param {string} fileName - Original file name
   * @param {Object} options - Sanitization options
   * @returns {string} Sanitized file name
   */
  sanitizeFileName(fileName, options = {}) {
    try {
      if (!fileName) return 'unnamed';

      // Get file extension
      const lastDotIndex = fileName.lastIndexOf('.');
      let name = fileName;
      let extension = '';

      if (lastDotIndex > 0) {
        name = fileName.substring(0, lastDotIndex);
        extension = fileName.substring(lastDotIndex);
      }

      // Sanitize name part
      name = name.replace(SANITIZE_CONFIG.fileName.allowedChars, '_');

      // Remove consecutive underscores
      name = name.replace(/_+/g, '_');

      // Remove leading/trailing underscores
      name = name.replace(/^_+|_+$/g, '');

      // Check for reserved names (Windows)
      const lowerName = name.toLowerCase();
      if (SANITIZE_CONFIG.fileName.reservedNames.includes(lowerName)) {
        name = `file_${name}`;
      }

      // Limit length
      const maxNameLength = SANITIZE_CONFIG.fileName.maxLength - extension.length;
      if (name.length > maxNameLength) {
        name = name.substring(0, maxNameLength);
      }

      // Default name if empty
      if (!name) {
        name = 'file';
      }

      // Add timestamp if requested
      if (options.addTimestamp) {
        name = `${name}_${Date.now()}`;
      }

      // Validate extension
      if (extension && options.validateExtension) {
        const isValidExtension = Object.values(ALLOWED_EXTENSIONS)
          .flat()
          .includes(extension.toLowerCase());
        
        if (!isValidExtension) {
          extension = '.txt'; // Default safe extension
        }
      }

      return `${name}${extension}`;
    } catch (error) {
      logger.error('File name sanitization error', { error: error.message });
      return 'file_' + Date.now();
    }
  }

  /**
   * Sanitize and normalize email
   * @param {string} email - Email address
   * @returns {string} Sanitized email
   */
  sanitizeEmail(email) {
    try {
      if (!email) return '';

      // Normalize email using validator
      let normalized = validator.normalizeEmail(email, {
        all_lowercase: true,
        gmail_remove_dots: true,
        gmail_remove_subaddress: false,
        gmail_convert_googlemaildotcom: true,
        outlookdotcom_remove_subaddress: false,
        yahoo_remove_subaddress: false,
        icloud_remove_subaddress: false,
      });

      if (!normalized) {
        // Basic fallback sanitization
        normalized = email.toLowerCase().trim();
        normalized = normalized.replace(/\s/g, '');
      }

      // Validate the result
      if (!validator.isEmail(normalized)) {
        logger.warn('Invalid email after sanitization', { original: email });
        return '';
      }

      return normalized;
    } catch (error) {
      logger.error('Email sanitization error', { error: error.message });
      return '';
    }
  }

  /**
   * Sanitize MongoDB query to prevent NoSQL injection
   * @param {any} query - Query object or value
   * @returns {any} Sanitized query
   */
  sanitizeMongoQuery(query) {
    try {
      // Handle null/undefined
      if (query === null || query === undefined) {
        return query;
      }

      // Handle primitives
      if (typeof query !== 'object') {
        return query;
      }

      // Handle arrays
      if (Array.isArray(query)) {
        return query.map(item => this.sanitizeMongoQuery(item));
      }

      // Handle objects
      const sanitized = {};
      
      for (const [key, value] of Object.entries(query)) {
        // Remove MongoDB operators
        if (SANITIZE_CONFIG.mongoOperators.includes(key)) {
          logger.warn('MongoDB operator removed from query', { operator: key });
          continue;
        }

        // Remove keys starting with $
        if (key.startsWith('$')) {
          logger.warn('$ prefixed key removed from query', { key });
          continue;
        }

        // Recursively sanitize nested objects
        if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeMongoQuery(value);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    } catch (error) {
      logger.error('MongoDB query sanitization error', { error: error.message });
      return {};
    }
  }

  /**
   * Sanitize URL
   * @param {string} url - URL to sanitize
   * @param {Object} options - Sanitization options
   * @returns {string} Sanitized URL
   */
  sanitizeURL(url, options = {}) {
    try {
      if (!url) return '';

      // Trim whitespace
      let sanitized = url.trim();

      // Remove zero-width characters
      sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');

      // Add protocol if missing
      if (!/^https?:\/\//i.test(sanitized)) {
        if (options.defaultProtocol !== false) {
          sanitized = `${SANITIZE_CONFIG.url.defaultProtocol}://${sanitized}`;
        }
      }

      // Parse URL
      let parsed;
      try {
        parsed = new URL(sanitized);
      } catch {
        logger.warn('Invalid URL format', { url });
        return '';
      }

      // Check protocol
      if (!SANITIZE_CONFIG.url.protocols.includes(parsed.protocol.replace(':', ''))) {
        logger.warn('Invalid URL protocol', { protocol: parsed.protocol });
        return '';
      }

      // Remove auth info
      if (options.removeAuth !== false) {
        parsed.username = '';
        parsed.password = '';
      }

      // Remove tracking parameters
      if (options.removeTracking) {
        const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
        trackingParams.forEach(param => {
          parsed.searchParams.delete(param);
        });
      }

      // Limit URL length
      const finalUrl = parsed.toString();
      if (options.maxLength && finalUrl.length > options.maxLength) {
        logger.warn('URL exceeds maximum length', { length: finalUrl.length });
        return '';
      }

      return finalUrl;
    } catch (error) {
      logger.error('URL sanitization error', { error: error.message });
      return '';
    }
  }

  /**
   * Sanitize brief content
   * @param {string} content - Brief content
   * @returns {string} Sanitized content
   */
  sanitizeBriefContent(content) {
    try {
      if (!content) return '';

      // Remove HTML tags but keep line breaks
      let sanitized = content.replace(/<br\s*\/?>/gi, '\n');
      sanitized = sanitized.replace(/<\/p>/gi, '\n\n');
      sanitized = sanitized.replace(/<[^>]*>/g, '');

      // Decode HTML entities
      sanitized = validator.unescape(sanitized);

      // Remove excessive line breaks
      sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

      // Remove control characters except newlines and tabs
      sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

      // Normalize whitespace
      sanitized = this.normalizeWhitespace(sanitized);

      // Trim
      sanitized = sanitized.trim();

      // Limit length for briefs (10000 characters max)
      if (sanitized.length > 10000) {
        sanitized = sanitized.substring(0, 10000) + '...';
      }

      return sanitized;
    } catch (error) {
      logger.error('Brief content sanitization error', { error: error.message });
      return '';
    }
  }

  /**
   * Sanitize contract text
   * @param {string} text - Contract text
   * @returns {string} Sanitized text
   */
  sanitizeContractText(text) {
    try {
      if (!text) return '';

      // Preserve formatting but remove dangerous content
      let sanitized = text;

      // Remove script tags and content
      sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

      // Remove style tags and content
      sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

      // Remove event handlers
      sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

      // Remove javascript: protocol
      sanitized = sanitized.replace(/javascript:/gi, '');

      // Preserve paragraph structure
      sanitized = sanitized.replace(/<p>/gi, '\n\n');
      sanitized = sanitized.replace(/<\/p>/gi, '');
      sanitized = sanitized.replace(/<br\s*\/?>/gi, '\n');

      // Remove remaining HTML tags
      sanitized = sanitized.replace(/<[^>]*>/g, '');

      // Decode HTML entities
      sanitized = validator.unescape(sanitized);

      // Preserve numbered lists and bullet points
      sanitized = sanitized.replace(/^\s*(\d+\.|\*|-)\s+/gm, '$1 ');

      // Remove excessive whitespace while preserving structure
      sanitized = sanitized.replace(/[ \t]+/g, ' ');
      sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

      // Trim
      sanitized = sanitized.trim();

      return sanitized;
    } catch (error) {
      logger.error('Contract text sanitization error', { error: error.message });
      return '';
    }
  }

  /**
   * Escape regex special characters for safe search
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(string) {
    try {
      if (!string) return '';
      
      // Escape all regex special characters
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } catch (error) {
      logger.error('Regex escape error', { error: error.message });
      return '';
    }
  }

  /**
   * Remove script tags and their content
   * @param {string} input - Input string
   * @returns {string} String without scripts
   */
  removeScripts(input) {
    try {
      if (!input) return '';

      // Remove script tags and content
      let cleaned = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

      // Remove noscript tags and content
      cleaned = cleaned.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

      // Remove iframe tags
      cleaned = cleaned.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

      // Remove object tags
      cleaned = cleaned.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');

      // Remove embed tags
      cleaned = cleaned.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');

      // Remove applet tags
      cleaned = cleaned.replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '');

      return cleaned;
    } catch (error) {
      logger.error('Script removal error', { error: error.message });
      return input;
    }
  }

  /**
   * Normalize whitespace
   * @param {string} input - Input string
   * @returns {string} Normalized string
   */
  normalizeWhitespace(input) {
    try {
      if (!input) return '';

      // Replace multiple spaces with single space
      let normalized = input.replace(/[ \t]+/g, ' ');

      // Replace multiple newlines with double newline
      normalized = normalized.replace(/\n{3,}/g, '\n\n');

      // Remove leading/trailing whitespace from each line
      normalized = normalized.split('\n').map(line => line.trim()).join('\n');

      // Remove zero-width spaces
      normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');

      // Remove other invisible characters
      normalized = normalized.replace(/[\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, ' ');

      return normalized;
    } catch (error) {
      logger.error('Whitespace normalization error', { error: error.message });
      return input;
    }
  }

  /**
   * Sanitize JSON string
   * @param {string} jsonString - JSON string
   * @returns {Object|null} Parsed and sanitized object
   */
  sanitizeJSON(jsonString) {
    try {
      if (!jsonString) return null;

      // Remove BOM
      let cleaned = jsonString.replace(/^\uFEFF/, '');

      // Remove comments (non-standard but sometimes present)
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

      // Parse JSON
      const parsed = JSON.parse(cleaned);

      // Sanitize the parsed object
      return this.sanitizeObject(parsed);
    } catch (error) {
      logger.error('JSON sanitization error', { error: error.message });
      return null;
    }
  }

  /**
   * Sanitize object recursively
   * @param {any} obj - Object to sanitize
   * @param {number} maxDepth - Maximum recursion depth
   * @returns {any} Sanitized object
   */
  sanitizeObject(obj, maxDepth = 10) {
    try {
      // Prevent infinite recursion
      if (maxDepth <= 0) {
        logger.warn('Maximum recursion depth reached in object sanitization');
        return null;
      }

      // Handle primitives
      if (obj === null || obj === undefined) {
        return obj;
      }

      if (typeof obj !== 'object') {
        if (typeof obj === 'string') {
          return this.sanitizeInput(obj, { escapeHtml: true });
        }
        return obj;
      }

      // Handle arrays
      if (Array.isArray(obj)) {
        return obj.map(item => this.sanitizeObject(item, maxDepth - 1));
      }

      // Handle objects
      const sanitized = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize key
        const sanitizedKey = this.sanitizeInput(key, { 
          escapeHtml: true, 
          maxLength: 100 
        });

        // Skip if key contains $
        if (sanitizedKey.includes('$')) {
          logger.warn('Key with $ removed during object sanitization', { key });
          continue;
        }

        // Recursively sanitize value
        sanitized[sanitizedKey] = this.sanitizeObject(value, maxDepth - 1);
      }

      return sanitized;
    } catch (error) {
      logger.error('Object sanitization error', { error: error.message });
      return null;
    }
  }

  /**
   * Sanitize phone number
   * @param {string} phone - Phone number
   * @returns {string} Sanitized phone number
   */
  sanitizePhone(phone) {
    try {
      if (!phone) return '';

      // Remove all non-numeric characters except +
      let sanitized = phone.replace(/[^\d+]/g, '');

      // Limit length (international format max)
      if (sanitized.length > 15) {
        sanitized = sanitized.substring(0, 15);
      }

      return sanitized;
    } catch (error) {
      logger.error('Phone sanitization error', { error: error.message });
      return '';
    }
  }

  /**
   * Sanitize username
   * @param {string} username - Username
   * @returns {string} Sanitized username
   */
  sanitizeUsername(username) {
    try {
      if (!username) return '';

      // Allow only alphanumeric, underscore, and hyphen
      let sanitized = username.replace(/[^a-zA-Z0-9_-]/g, '');

      // Limit length
      if (sanitized.length > 30) {
        sanitized = sanitized.substring(0, 30);
      }

      // Ensure minimum length
      if (sanitized.length < 3) {
        return '';
      }

      return sanitized.toLowerCase();
    } catch (error) {
      logger.error('Username sanitization error', { error: error.message });
      return '';
    }
  }

  /**
   * Sanitize search query
   * @param {string} query - Search query
   * @returns {string} Sanitized query
   */
  sanitizeSearchQuery(query) {
    try {
      if (!query) return '';

      // Remove special characters but keep spaces
      let sanitized = query.replace(/[^\w\s-]/g, '');

      // Normalize whitespace
      sanitized = this.normalizeWhitespace(sanitized);

      // Limit length
      if (sanitized.length > 100) {
        sanitized = sanitized.substring(0, 100);
      }

      // Trim
      sanitized = sanitized.trim();

      return sanitized;
    } catch (error) {
      logger.error('Search query sanitization error', { error: error.message });
      return '';
    }
  }

  /**
   * Sanitize CSV content
   * @param {string} csv - CSV content
   * @returns {string} Sanitized CSV
   */
  sanitizeCSV(csv) {
    try {
      if (!csv) return '';

      // Remove potential formula injection
      let sanitized = csv.replace(/^[=+\-@]/gm, "'$&");

      // Remove null bytes
      sanitized = sanitized.replace(/\0/g, '');

      // Normalize line endings
      sanitized = sanitized.replace(/\r\n/g, '\n');
      sanitized = sanitized.replace(/\r/g, '\n');

      return sanitized;
    } catch (error) {
      logger.error('CSV sanitization error', { error: error.message });
      return '';
    }
  }

  /**
   * Batch sanitize multiple inputs
   * @param {Object} inputs - Object with inputs to sanitize
   * @param {Object} rules - Sanitization rules for each input
   * @returns {Object} Sanitized inputs
   */
  sanitizeBatch(inputs, rules) {
    const sanitized = {};

    for (const [key, value] of Object.entries(inputs)) {
      const rule = rules[key] || { type: 'input' };
      
      switch (rule.type) {
        case 'html':
          sanitized[key] = this.sanitizeHTML(value, rule.options);
          break;
        case 'email':
          sanitized[key] = this.sanitizeEmail(value);
          break;
        case 'url':
          sanitized[key] = this.sanitizeURL(value, rule.options);
          break;
        case 'phone':
          sanitized[key] = this.sanitizePhone(value);
          break;
        case 'username':
          sanitized[key] = this.sanitizeUsername(value);
          break;
        case 'fileName':
          sanitized[key] = this.sanitizeFileName(value, rule.options);
          break;
        case 'mongo':
          sanitized[key] = this.sanitizeMongoQuery(value);
          break;
        case 'search':
          sanitized[key] = this.sanitizeSearchQuery(value);
          break;
        case 'brief':
          sanitized[key] = this.sanitizeBriefContent(value);
          break;
        case 'contract':
          sanitized[key] = this.sanitizeContractText(value);
          break;
        default:
          sanitized[key] = this.sanitizeInput(value, rule.options);
      }
    }

    return sanitized;
  }
}

// Create singleton instance
const sanitizeUtil = new SanitizeUtil();

// Export utility instance and methods
module.exports = sanitizeUtil;

// Export convenience methods
module.exports.sanitize = {
  input: (input, options) => sanitizeUtil.sanitizeInput(input, options),
  html: (html, options) => sanitizeUtil.sanitizeHTML(html, options),
  fileName: (fileName, options) => sanitizeUtil.sanitizeFileName(fileName, options),
  email: (email) => sanitizeUtil.sanitizeEmail(email),
  mongo: (query) => sanitizeUtil.sanitizeMongoQuery(query),
  url: (url, options) => sanitizeUtil.sanitizeURL(url, options),
  brief: (content) => sanitizeUtil.sanitizeBriefContent(content),
  contract: (text) => sanitizeUtil.sanitizeContractText(text),
  regex: (string) => sanitizeUtil.escapeRegex(string),
  scripts: (input) => sanitizeUtil.removeScripts(input),
  whitespace: (input) => sanitizeUtil.normalizeWhitespace(input),
  json: (jsonString) => sanitizeUtil.sanitizeJSON(jsonString),
  object: (obj, maxDepth) => sanitizeUtil.sanitizeObject(obj, maxDepth),
  phone: (phone) => sanitizeUtil.sanitizePhone(phone),
  username: (username) => sanitizeUtil.sanitizeUsername(username),
  search: (query) => sanitizeUtil.sanitizeSearchQuery(query),
  csv: (csv) => sanitizeUtil.sanitizeCSV(csv),
  batch: (inputs, rules) => sanitizeUtil.sanitizeBatch(inputs, rules),
};