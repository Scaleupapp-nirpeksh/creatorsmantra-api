/**
 * Validation Utility
 * @module utils/validation
 * @description Custom validation functions for business logic and Indian compliance
 * 
 * File Path: src/utils/validation.util.js
 * 
 * Features:
 * - Indian tax and banking validation (GST, PAN, IFSC)
 * - Social media handle validation
 * - Deal and invoice validation
 * - Rate card structure validation
 * - Deliverable format checking
 * - Financial validation rules
 */

const { REGEX_PATTERNS, PLATFORMS, DELIVERABLE_TYPES, CURRENCIES, TAX_TYPES } = require('../config/constants');
const logger = require('../config/logger');

/**
 * Validation Utility Class
 * Provides custom validation methods for business rules
 */
class ValidationUtil {
  /**
   * Validate Indian GST Number
   * Format: 22AAAAA0000A1Z5
   * @param {string} gst - GST number
   * @returns {Object} Validation result
   */
  validateGST(gst) {
    try {
      if (!gst) {
        return { isValid: false, error: 'GST number is required' };
      }

      // Remove spaces and convert to uppercase
      const cleanGST = gst.replace(/\s/g, '').toUpperCase();

      // Check format
      if (!REGEX_PATTERNS.GST.test(cleanGST)) {
        return { isValid: false, error: 'Invalid GST format' };
      }

      // Validate state code (first 2 digits)
      const stateCode = parseInt(cleanGST.substring(0, 2));
      const validStateCodes = [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 97, 99
      ];

      if (!validStateCodes.includes(stateCode)) {
        return { isValid: false, error: 'Invalid state code in GST' };
      }

      // Validate PAN (characters 3-12)
      const panPortion = cleanGST.substring(2, 12);
      if (!REGEX_PATTERNS.PAN.test(panPortion)) {
        return { isValid: false, error: 'Invalid PAN in GST number' };
      }

      // Validate checksum (last character)
      const checksum = this.calculateGSTChecksum(cleanGST.substring(0, 14));
      if (checksum !== cleanGST[14]) {
        return { isValid: false, error: 'Invalid GST checksum' };
      }

      return {
        isValid: true,
        formatted: cleanGST,
        stateCode,
        pan: panPortion,
        entityNumber: cleanGST[12],
        checksum: cleanGST[14]
      };
    } catch (error) {
      logger.error('GST validation error', { error: error.message });
      return { isValid: false, error: 'GST validation failed' };
    }
  }

  /**
   * Calculate GST checksum digit
   * @private
   * @param {string} gstWithoutChecksum - GST without last digit
   * @returns {string} Checksum character
   */
  calculateGSTChecksum(gstWithoutChecksum) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let factor = 2;
    let sum = 0;

    for (let i = gstWithoutChecksum.length - 1; i >= 0; i--) {
      const codePoint = chars.indexOf(gstWithoutChecksum[i]);
      let digit = factor * codePoint;
      factor = factor === 2 ? 1 : 2;
      digit = Math.floor(digit / chars.length) + (digit % chars.length);
      sum += digit;
    }

    const checkCodePoint = (chars.length - (sum % chars.length)) % chars.length;
    return chars[checkCodePoint];
  }

  /**
   * Validate Indian PAN Card
   * Format: AAAAA0000A
   * @param {string} pan - PAN number
   * @returns {Object} Validation result
   */
  validatePAN(pan) {
    try {
      if (!pan) {
        return { isValid: false, error: 'PAN number is required' };
      }

      // Remove spaces and convert to uppercase
      const cleanPAN = pan.replace(/\s/g, '').toUpperCase();

      // Check format
      if (!REGEX_PATTERNS.PAN.test(cleanPAN)) {
        return { isValid: false, error: 'Invalid PAN format (Expected: AAAAA0000A)' };
      }

      // Get entity type from 4th character
      const entityTypes = {
        'P': 'Individual',
        'C': 'Company',
        'H': 'HUF',
        'F': 'Firm',
        'A': 'AOP',
        'T': 'Trust',
        'B': 'BOI',
        'L': 'Local Authority',
        'J': 'Artificial Juridical Person',
        'G': 'Government'
      };

      const entityType = entityTypes[cleanPAN[3]] || 'Unknown';

      return {
        isValid: true,
        formatted: cleanPAN,
        entityType,
        isIndividual: cleanPAN[3] === 'P'
      };
    } catch (error) {
      logger.error('PAN validation error', { error: error.message });
      return { isValid: false, error: 'PAN validation failed' };
    }
  }

  /**
   * Validate Bank IFSC Code
   * Format: AAAA0000000
   * @param {string} ifsc - IFSC code
   * @returns {Object} Validation result
   */
  validateIFSC(ifsc) {
    try {
      if (!ifsc) {
        return { isValid: false, error: 'IFSC code is required' };
      }

      // Remove spaces and convert to uppercase
      const cleanIFSC = ifsc.replace(/\s/g, '').toUpperCase();

      // Check format
      if (!REGEX_PATTERNS.IFSC.test(cleanIFSC)) {
        return { isValid: false, error: 'Invalid IFSC format (Expected: AAAA0000000)' };
      }

      // Extract bank code (first 4 characters)
      const bankCode = cleanIFSC.substring(0, 4);

      // Fifth character should be 0
      if (cleanIFSC[4] !== '0') {
        return { isValid: false, error: 'Fifth character of IFSC must be 0' };
      }

      // Extract branch code (last 6 characters)
      const branchCode = cleanIFSC.substring(5);

      return {
        isValid: true,
        formatted: cleanIFSC,
        bankCode,
        branchCode
      };
    } catch (error) {
      logger.error('IFSC validation error', { error: error.message });
      return { isValid: false, error: 'IFSC validation failed' };
    }
  }

  /**
   * Validate Indian Mobile Number
   * @param {string} mobile - Mobile number
   * @returns {Object} Validation result
   */
  validateIndianMobile(mobile) {
    try {
      if (!mobile) {
        return { isValid: false, error: 'Mobile number is required' };
      }

      // Remove spaces, +91, and other characters
      let cleanMobile = mobile.replace(/[\s\-\(\)]/g, '');
      cleanMobile = cleanMobile.replace(/^\+91/, '');
      cleanMobile = cleanMobile.replace(/^91/, '');
      cleanMobile = cleanMobile.replace(/^0/, '');

      // Check if it's 10 digits and starts with 6-9
      if (!REGEX_PATTERNS.PHONE_INDIA.test(cleanMobile)) {
        return { isValid: false, error: 'Invalid Indian mobile number' };
      }

      return {
        isValid: true,
        formatted: cleanMobile,
        withCountryCode: `+91${cleanMobile}`,
        display: `+91 ${cleanMobile.substring(0, 5)} ${cleanMobile.substring(5)}`
      };
    } catch (error) {
      logger.error('Mobile validation error', { error: error.message });
      return { isValid: false, error: 'Mobile validation failed' };
    }
  }

  /**
   * Validate UPI ID
   * @param {string} upiId - UPI ID
   * @returns {Object} Validation result
   */
  validateUPI(upiId) {
    try {
      if (!upiId) {
        return { isValid: false, error: 'UPI ID is required' };
      }

      // Basic UPI format: username@bankname
      const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
      
      if (!upiRegex.test(upiId)) {
        return { isValid: false, error: 'Invalid UPI ID format' };
      }

      const [username, provider] = upiId.split('@');

      // Common UPI providers
      const validProviders = [
        'paytm', 'phonepe', 'googlepay', 'bhim', 'amazonpay',
        'ybl', 'okhdfcbank', 'okicici', 'oksbi', 'okaxis',
        'ibl', 'axl', 'sbi', 'hdfc', 'icici', 'upi', 'airtel',
        'jio', 'kotak', 'indus', 'barodampay', 'fbl', 'aubank'
      ];

      const isKnownProvider = validProviders.includes(provider.toLowerCase());

      return {
        isValid: true,
        formatted: upiId.toLowerCase(),
        username,
        provider,
        isKnownProvider
      };
    } catch (error) {
      logger.error('UPI validation error', { error: error.message });
      return { isValid: false, error: 'UPI validation failed' };
    }
  }

  /**
   * Validate Instagram Handle
   * @param {string} handle - Instagram username
   * @returns {Object} Validation result
   */
  validateInstagramHandle(handle) {
    try {
      if (!handle) {
        return { isValid: false, error: 'Instagram handle is required' };
      }

      // Remove @ if present and lowercase
      let cleanHandle = handle.replace('@', '').toLowerCase();
      
      // Instagram username rules:
      // - 1-30 characters
      // - Only letters, numbers, periods, and underscores
      // - No consecutive periods
      // - No period at the beginning or end
      const instagramRegex = /^(?!.*\.\.)(?!.*\.$)[a-z0-9_.]{1,30}$/;

      if (!instagramRegex.test(cleanHandle)) {
        return { isValid: false, error: 'Invalid Instagram handle format' };
      }

      return {
        isValid: true,
        formatted: cleanHandle,
        withAt: `@${cleanHandle}`,
        profileUrl: `https://instagram.com/${cleanHandle}`
      };
    } catch (error) {
      logger.error('Instagram handle validation error', { error: error.message });
      return { isValid: false, error: 'Instagram handle validation failed' };
    }
  }

  /**
   * Validate YouTube Channel URL
   * @param {string} url - YouTube channel URL
   * @returns {Object} Validation result
   */
  validateYouTubeChannel(url) {
    try {
      if (!url) {
        return { isValid: false, error: 'YouTube channel URL is required' };
      }

      // YouTube URL patterns
      const patterns = [
        /^https?:\/\/(www\.)?youtube\.com\/(c|channel|user)\/[\w-]+$/,
        /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+$/,
        /^https?:\/\/youtu\.be\/[\w-]+$/
      ];

      const isValid = patterns.some(pattern => pattern.test(url));

      if (!isValid) {
        return { isValid: false, error: 'Invalid YouTube channel URL' };
      }

      // Extract channel identifier
      let channelId = null;
      let channelType = null;

      if (url.includes('/channel/')) {
        channelType = 'channel';
        channelId = url.split('/channel/')[1].split('/')[0];
      } else if (url.includes('/c/')) {
        channelType = 'custom';
        channelId = url.split('/c/')[1].split('/')[0];
      } else if (url.includes('/user/')) {
        channelType = 'user';
        channelId = url.split('/user/')[1].split('/')[0];
      } else if (url.includes('/@')) {
        channelType = 'handle';
        channelId = url.split('/@')[1].split('/')[0];
      }

      return {
        isValid: true,
        formatted: url,
        channelId,
        channelType
      };
    } catch (error) {
      logger.error('YouTube channel validation error', { error: error.message });
      return { isValid: false, error: 'YouTube channel validation failed' };
    }
  }

  /**
   * Validate LinkedIn Profile URL
   * @param {string} url - LinkedIn profile URL
   * @returns {Object} Validation result
   */
  validateLinkedInProfile(url) {
    try {
      if (!url) {
        return { isValid: false, error: 'LinkedIn profile URL is required' };
      }

      // LinkedIn URL patterns
      const patterns = [
        /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/,
        /^https?:\/\/(www\.)?linkedin\.com\/company\/[\w-]+\/?$/
      ];

      const isValid = patterns.some(pattern => pattern.test(url));

      if (!isValid) {
        return { isValid: false, error: 'Invalid LinkedIn profile URL' };
      }

      const isCompany = url.includes('/company/');
      const profileId = url.match(/\/(in|company)\/([\w-]+)/)?.[2];

      return {
        isValid: true,
        formatted: url,
        profileId,
        profileType: isCompany ? 'company' : 'personal'
      };
    } catch (error) {
      logger.error('LinkedIn profile validation error', { error: error.message });
      return { isValid: false, error: 'LinkedIn profile validation failed' };
    }
  }

  /**
   * Validate Deliverable Format
   * @param {Object} deliverable - Deliverable object
   * @returns {Object} Validation result
   */
  validateDeliverable(deliverable) {
    try {
      const errors = [];

      // Check required fields
      if (!deliverable.type) {
        errors.push('Deliverable type is required');
      } else if (!Object.values(DELIVERABLE_TYPES).includes(deliverable.type)) {
        errors.push('Invalid deliverable type');
      }

      if (!deliverable.platform) {
        errors.push('Platform is required');
      } else if (!Object.values(PLATFORMS).includes(deliverable.platform)) {
        errors.push('Invalid platform');
      }

      // Platform-specific validation
      if (deliverable.platform && deliverable.type) {
        const platformSpecificTypes = {
          [PLATFORMS.INSTAGRAM]: ['instagram_reel', 'instagram_post', 'instagram_story', 'instagram_carousel', 'instagram_igtv', 'instagram_live'],
          [PLATFORMS.YOUTUBE]: ['youtube_video', 'youtube_short', 'youtube_live', 'youtube_community'],
          [PLATFORMS.LINKEDIN]: ['linkedin_post', 'linkedin_article', 'linkedin_video', 'linkedin_newsletter'],
          [PLATFORMS.TWITTER]: ['twitter_tweet', 'twitter_thread', 'twitter_space']
        };

        const allowedTypes = platformSpecificTypes[deliverable.platform];
        if (allowedTypes && !allowedTypes.includes(deliverable.type)) {
          errors.push(`Deliverable type ${deliverable.type} is not valid for platform ${deliverable.platform}`);
        }
      }

      // Validate quantity
      if (deliverable.quantity !== undefined) {
        if (!Number.isInteger(deliverable.quantity) || deliverable.quantity < 1) {
          errors.push('Quantity must be a positive integer');
        }
      }

      // Validate deadline
      if (deliverable.deadline) {
        const deadline = new Date(deliverable.deadline);
        if (isNaN(deadline.getTime())) {
          errors.push('Invalid deadline date');
        } else if (deadline < new Date()) {
          errors.push('Deadline cannot be in the past');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitized: errors.length === 0 ? {
          type: deliverable.type,
          platform: deliverable.platform,
          quantity: deliverable.quantity || 1,
          deadline: deliverable.deadline,
          description: deliverable.description || ''
        } : null
      };
    } catch (error) {
      logger.error('Deliverable validation error', { error: error.message });
      return { isValid: false, errors: ['Deliverable validation failed'] };
    }
  }

  /**
   * Validate Invoice Number Format
   * @param {string} invoiceNumber - Invoice number
   * @returns {Object} Validation result
   */
  validateInvoiceNumber(invoiceNumber) {
    try {
      if (!invoiceNumber) {
        return { isValid: false, error: 'Invoice number is required' };
      }

      // Format: CM/2024-25/INV/0001 or custom format
      const defaultFormat = /^CM\/\d{4}-\d{2}\/INV\/\d{4,}$/;
      const customFormat = /^[A-Z0-9\-\/]+$/;

      const isDefaultFormat = defaultFormat.test(invoiceNumber);
      const isValidFormat = isDefaultFormat || customFormat.test(invoiceNumber);

      if (!isValidFormat) {
        return { isValid: false, error: 'Invalid invoice number format' };
      }

      // Extract components if default format
      let fiscalYear = null;
      let sequenceNumber = null;

      if (isDefaultFormat) {
        const parts = invoiceNumber.split('/');
        fiscalYear = parts[1];
        sequenceNumber = parseInt(parts[3]);
      }

      return {
        isValid: true,
        formatted: invoiceNumber.toUpperCase(),
        isDefaultFormat,
        fiscalYear,
        sequenceNumber
      };
    } catch (error) {
      logger.error('Invoice number validation error', { error: error.message });
      return { isValid: false, error: 'Invoice number validation failed' };
    }
  }

  /**
   * Validate Deal Value
   * @param {number} value - Deal amount
   * @param {string} currency - Currency code
   * @returns {Object} Validation result
   */
  validateDealValue(value, currency = CURRENCIES.INR) {
    try {
      const errors = [];

      // Check if value is a number
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push('Deal value must be a valid number');
      }

      // Check minimum value
      if (value < 0) {
        errors.push('Deal value cannot be negative');
      }

      // Check maximum value (10 crores for safety)
      if (value > 100000000) {
        errors.push('Deal value exceeds maximum limit (10 Cr)');
      }

      // Validate currency
      if (!Object.values(CURRENCIES).includes(currency)) {
        errors.push('Invalid currency code');
      }

      // Check decimal places (max 2 for currency)
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        errors.push('Deal value can have maximum 2 decimal places');
      }

      return {
        isValid: errors.length === 0,
        errors,
        formatted: errors.length === 0 ? {
          value: Math.round(value * 100) / 100, // Round to 2 decimal places
          currency,
          display: this.formatCurrency(value, currency)
        } : null
      };
    } catch (error) {
      logger.error('Deal value validation error', { error: error.message });
      return { isValid: false, errors: ['Deal value validation failed'] };
    }
  }

  /**
   * Validate Rate Card Structure
   * @param {Object} rateCard - Rate card object
   * @returns {Object} Validation result
   */
  validateRateCard(rateCard) {
    try {
      const errors = [];

      // Check required fields
      if (!rateCard.platform) {
        errors.push('Platform is required');
      } else if (!Object.values(PLATFORMS).includes(rateCard.platform)) {
        errors.push('Invalid platform');
      }

      if (!rateCard.rates || typeof rateCard.rates !== 'object') {
        errors.push('Rates object is required');
      }

      // Validate each rate entry
      if (rateCard.rates) {
        for (const [deliverableType, rate] of Object.entries(rateCard.rates)) {
          // Check if deliverable type is valid
          if (!Object.values(DELIVERABLE_TYPES).includes(deliverableType)) {
            errors.push(`Invalid deliverable type: ${deliverableType}`);
          }

          // Check rate value
          if (typeof rate !== 'number' || rate < 0) {
            errors.push(`Invalid rate for ${deliverableType}`);
          }
        }
      }

      // Validate packages if present
      if (rateCard.packages) {
        if (!Array.isArray(rateCard.packages)) {
          errors.push('Packages must be an array');
        } else {
          rateCard.packages.forEach((pkg, index) => {
            if (!pkg.name) {
              errors.push(`Package ${index + 1}: Name is required`);
            }
            if (typeof pkg.price !== 'number' || pkg.price < 0) {
              errors.push(`Package ${index + 1}: Invalid price`);
            }
            if (!pkg.deliverables || !Array.isArray(pkg.deliverables)) {
              errors.push(`Package ${index + 1}: Deliverables array is required`);
            }
          });
        }
      }

      // Validate validity period
      if (rateCard.validFrom) {
        const validFrom = new Date(rateCard.validFrom);
        if (isNaN(validFrom.getTime())) {
          errors.push('Invalid validFrom date');
        }
      }

      if (rateCard.validTo) {
        const validTo = new Date(rateCard.validTo);
        if (isNaN(validTo.getTime())) {
          errors.push('Invalid validTo date');
        }

        if (rateCard.validFrom && validTo <= new Date(rateCard.validFrom)) {
          errors.push('validTo must be after validFrom');
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      logger.error('Rate card validation error', { error: error.message });
      return { isValid: false, errors: ['Rate card validation failed'] };
    }
  }

  /**
   * Validate Date
   * @param {string|Date} date - Date to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  isValidDate(date, options = {}) {
    try {
      const dateObj = new Date(date);
      
      if (isNaN(dateObj.getTime())) {
        return { isValid: false, error: 'Invalid date format' };
      }

      // Check if date is in the past
      if (options.notPast && dateObj < new Date()) {
        return { isValid: false, error: 'Date cannot be in the past' };
      }

      // Check if date is in the future
      if (options.notFuture && dateObj > new Date()) {
        return { isValid: false, error: 'Date cannot be in the future' };
      }

      // Check min date
      if (options.minDate && dateObj < new Date(options.minDate)) {
        return { isValid: false, error: `Date must be after ${options.minDate}` };
      }

      // Check max date
      if (options.maxDate && dateObj > new Date(options.maxDate)) {
        return { isValid: false, error: `Date must be before ${options.maxDate}` };
      }

      return {
        isValid: true,
        formatted: dateObj.toISOString(),
        date: dateObj
      };
    } catch (error) {
      logger.error('Date validation error', { error: error.message });
      return { isValid: false, error: 'Date validation failed' };
    }
  }

  /**
   * Validate Currency Code
   * @param {string} currency - Currency code
   * @returns {Object} Validation result
   */
  isValidCurrency(currency) {
    const isValid = Object.values(CURRENCIES).includes(currency);
    
    return {
      isValid,
      error: isValid ? null : 'Invalid currency code',
      formatted: isValid ? currency.toUpperCase() : null
    };
  }

  /**
   * Validate Email
   * @param {string} email - Email address
   * @returns {Object} Validation result
   */
  validateEmail(email) {
    try {
      if (!email) {
        return { isValid: false, error: 'Email is required' };
      }

      const cleanEmail = email.toLowerCase().trim();

      if (!REGEX_PATTERNS.EMAIL.test(cleanEmail)) {
        return { isValid: false, error: 'Invalid email format' };
      }

      // Check for common typos
      const domain = cleanEmail.split('@')[1];
      const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      const typos = {
        'gmial.com': 'gmail.com',
        'gmai.com': 'gmail.com',
        'yahooo.com': 'yahoo.com',
        'yaho.com': 'yahoo.com',
        'hotmial.com': 'hotmail.com'
      };

      const suggestion = typos[domain];

      return {
        isValid: true,
        formatted: cleanEmail,
        domain,
        suggestion: suggestion ? `Did you mean ${cleanEmail.split('@')[0]}@${suggestion}?` : null
      };
    } catch (error) {
      logger.error('Email validation error', { error: error.message });
      return { isValid: false, error: 'Email validation failed' };
    }
  }

  /**
   * Validate Bank Account Number
   * @param {string} accountNumber - Bank account number
   * @returns {Object} Validation result
   */
  validateBankAccount(accountNumber) {
    try {
      if (!accountNumber) {
        return { isValid: false, error: 'Account number is required' };
      }

      // Remove spaces and special characters
      const cleanAccount = accountNumber.replace(/[\s-]/g, '');

      // Indian bank account numbers are typically 9-18 digits
      if (!/^\d{9,18}$/.test(cleanAccount)) {
        return { isValid: false, error: 'Invalid account number (9-18 digits required)' };
      }

      return {
        isValid: true,
        formatted: cleanAccount,
        masked: this.maskAccountNumber(cleanAccount)
      };
    } catch (error) {
      logger.error('Bank account validation error', { error: error.message });
      return { isValid: false, error: 'Bank account validation failed' };
    }
  }

  /**
   * Validate Tax Type
   * @param {string} taxType - Tax type
   * @returns {Object} Validation result
   */
  validateTaxType(taxType) {
    const isValid = Object.values(TAX_TYPES).includes(taxType);
    
    return {
      isValid,
      error: isValid ? null : 'Invalid tax type',
      formatted: isValid ? taxType.toUpperCase() : null
    };
  }

  /**
   * Validate percentage value
   * @param {number} percentage - Percentage value
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validatePercentage(percentage, options = {}) {
    try {
      const min = options.min || 0;
      const max = options.max || 100;

      if (typeof percentage !== 'number' || isNaN(percentage)) {
        return { isValid: false, error: 'Percentage must be a number' };
      }

      if (percentage < min || percentage > max) {
        return { isValid: false, error: `Percentage must be between ${min} and ${max}` };
      }

      return {
        isValid: true,
        formatted: Math.round(percentage * 100) / 100,
        display: `${percentage}%`
      };
    } catch (error) {
      logger.error('Percentage validation error', { error: error.message });
      return { isValid: false, error: 'Percentage validation failed' };
    }
  }

  /**
   * Helper: Format currency for display
   * @private
   * @param {number} value - Amount
   * @param {string} currency - Currency code
   * @returns {string} Formatted currency
   */
  formatCurrency(value, currency) {
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });

    return formatter.format(value);
  }

  /**
   * Helper: Mask account number
   * @private
   * @param {string} accountNumber - Account number
   * @returns {string} Masked account
   */
  maskAccountNumber(accountNumber) {
    if (accountNumber.length <= 4) {
      return '****';
    }
    return `${'*'.repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`;
  }

  /**
   * Batch validate multiple fields
   * @param {Object} data - Data to validate
   * @param {Object} rules - Validation rules
   * @returns {Object} Validation results
   */
  validateBatch(data, rules) {
    const results = {};
    const errors = {};
    let isValid = true;

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      let result;

      // Apply validation based on rule type
      switch (rule.type) {
        case 'gst':
          result = this.validateGST(value);
          break;
        case 'pan':
          result = this.validatePAN(value);
          break;
        case 'ifsc':
          result = this.validateIFSC(value);
          break;
        case 'mobile':
          result = this.validateIndianMobile(value);
          break;
        case 'email':
          result = this.validateEmail(value);
          break;
        case 'upi':
          result = this.validateUPI(value);
          break;
        case 'required':
          result = { isValid: !!value, error: value ? null : `${field} is required` };
          break;
        default:
          result = { isValid: true };
      }

      results[field] = result;
      
      if (!result.isValid) {
        isValid = false;
        errors[field] = result.error || result.errors;
      }
    }

    return {
      isValid,
      results,
      errors: isValid ? null : errors
    };
  }
}

// Create singleton instance
const validationUtil = new ValidationUtil();

// Export utility instance and methods
module.exports = validationUtil;

// Export convenience methods
module.exports.validate = {
  gst: (gst) => validationUtil.validateGST(gst),
  pan: (pan) => validationUtil.validatePAN(pan),
  ifsc: (ifsc) => validationUtil.validateIFSC(ifsc),
  mobile: (mobile) => validationUtil.validateIndianMobile(mobile),
  upi: (upiId) => validationUtil.validateUPI(upiId),
  email: (email) => validationUtil.validateEmail(email),
  instagram: (handle) => validationUtil.validateInstagramHandle(handle),
  youtube: (url) => validationUtil.validateYouTubeChannel(url),
  linkedin: (url) => validationUtil.validateLinkedInProfile(url),
  deliverable: (deliverable) => validationUtil.validateDeliverable(deliverable),
  invoiceNumber: (invoiceNumber) => validationUtil.validateInvoiceNumber(invoiceNumber),
  dealValue: (value, currency) => validationUtil.validateDealValue(value, currency),
  rateCard: (rateCard) => validationUtil.validateRateCard(rateCard),
  date: (date, options) => validationUtil.isValidDate(date, options),
  currency: (currency) => validationUtil.isValidCurrency(currency),
  bankAccount: (accountNumber) => validationUtil.validateBankAccount(accountNumber),
  taxType: (taxType) => validationUtil.validateTaxType(taxType),
  percentage: (percentage, options) => validationUtil.validatePercentage(percentage, options),
  batch: (data, rules) => validationUtil.validateBatch(data, rules),
};