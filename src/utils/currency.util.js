/**
 * Currency Utility
 * @module utils/currency
 * @description Currency calculations, GST/TDS handling, and financial computations
 * 
 * File Path: src/utils/currency.util.js
 * 
 * Features:
 * - Indian GST calculation (18% with CGST/SGST split)
 * - TDS calculation (10% individuals, 2% companies)
 * - IGST for interstate transactions
 * - Indian number system formatting (Lakhs, Crores)
 * - Agency commission calculations
 * - Revenue splitting
 * - Payment milestone calculations
 * - Multi-currency support
 */

const logger = require('../config/logger');
const { CURRENCIES, TAX_RATES, TAX_TYPES } = require('../config/constants');

/**
 * Currency Configuration
 */
const CURRENCY_CONFIG = {
  // Currency symbols
  symbols: {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AED: 'د.إ',
    SGD: 'S$',
  },

  // Exchange rates (to be updated from API in production)
  exchangeRates: {
    INR: 1,
    USD: 0.012, // 1 INR = 0.012 USD (approx 1 USD = 83 INR)
    EUR: 0.011,
    GBP: 0.0095,
    AED: 0.044,
    SGD: 0.016,
  },

  // Indian number system
  indianNumberSystem: {
    suffixes: ['', 'K', 'L', 'Cr'],
    thresholds: [1, 1000, 100000, 10000000],
  },

  // Tax configurations
  tax: {
    gst: {
      rate: TAX_RATES.GST / 100, // 18%
      cgst: TAX_RATES.CGST / 100, // 9%
      sgst: TAX_RATES.SGST / 100, // 9%
      igst: TAX_RATES.IGST / 100, // 18%
    },
    tds: {
      individual: TAX_RATES.TDS_INDIVIDUAL / 100, // 10%
      company: TAX_RATES.TDS_COMPANY / 100, // 2%
    },
  },

  // Commission rates (can be customized)
  defaultCommission: {
    agency: 0.15, // 15%
    platform: 0.05, // 5%
  },

  // Payment milestones
  defaultMilestones: {
    advance: 0.5, // 50%
    completion: 0.5, // 50%
  },

  // Rounding precision
  precision: 2,
};

/**
 * Currency Utility Class
 * Provides methods for currency and tax calculations
 */
class CurrencyUtil {
  /**
   * Calculate GST on amount
   * @param {number} amount - Base amount
   * @param {Object} options - Calculation options
   * @returns {Object} GST calculation details
   */
  calculateGST(amount, options = {}) {
    try {
      const baseAmount = this.roundToTwo(amount);
      const gstRate = options.rate || CURRENCY_CONFIG.tax.gst.rate;
      const gstAmount = this.roundToTwo(baseAmount * gstRate);
      const totalAmount = this.roundToTwo(baseAmount + gstAmount);

      // Determine if it's interstate (IGST) or intrastate (CGST/SGST)
      const isInterstate = options.isInterstate || false;
      
      let breakdown;
      if (isInterstate) {
        breakdown = {
          igst: gstAmount,
          cgst: 0,
          sgst: 0,
        };
      } else {
        const halfGst = this.roundToTwo(gstAmount / 2);
        breakdown = {
          igst: 0,
          cgst: halfGst,
          sgst: halfGst,
        };
      }

      return {
        baseAmount,
        gstRate: gstRate * 100,
        gstAmount,
        breakdown,
        totalAmount,
        isInterstate,
        formatted: {
          baseAmount: this.formatINR(baseAmount),
          gstAmount: this.formatINR(gstAmount),
          totalAmount: this.formatINR(totalAmount),
          cgst: this.formatINR(breakdown.cgst),
          sgst: this.formatINR(breakdown.sgst),
          igst: this.formatINR(breakdown.igst),
        },
      };
    } catch (error) {
      logger.error('GST calculation error', { error: error.message, amount });
      return null;
    }
  }

  /**
   * Calculate TDS on amount
   * @param {number} amount - Base amount
   * @param {Object} options - Calculation options
   * @returns {Object} TDS calculation details
   */
  calculateTDS(amount, options = {}) {
    try {
      const baseAmount = this.roundToTwo(amount);
      const isIndividual = options.isIndividual !== false; // Default to individual
      const tdsRate = isIndividual 
        ? CURRENCY_CONFIG.tax.tds.individual 
        : CURRENCY_CONFIG.tax.tds.company;
      
      const customRate = options.rate ? options.rate / 100 : tdsRate;
      const tdsAmount = this.roundToTwo(baseAmount * customRate);
      const netAmount = this.roundToTwo(baseAmount - tdsAmount);

      return {
        baseAmount,
        tdsRate: customRate * 100,
        tdsAmount,
        netAmount,
        entityType: isIndividual ? 'Individual' : 'Company',
        formatted: {
          baseAmount: this.formatINR(baseAmount),
          tdsAmount: this.formatINR(tdsAmount),
          netAmount: this.formatINR(netAmount),
        },
      };
    } catch (error) {
      logger.error('TDS calculation error', { error: error.message, amount });
      return null;
    }
  }

  /**
   * Calculate IGST (Interstate GST)
   * @param {number} amount - Base amount
   * @param {Object} options - Calculation options
   * @returns {Object} IGST calculation details
   */
  calculateIGST(amount, options = {}) {
    return this.calculateGST(amount, { ...options, isInterstate: true });
  }

  /**
   * Calculate CGST and SGST (Intrastate GST)
   * @param {number} amount - Base amount
   * @param {Object} options - Calculation options
   * @returns {Object} CGST/SGST calculation details
   */
  calculateCGSTSGST(amount, options = {}) {
    return this.calculateGST(amount, { ...options, isInterstate: false });
  }

  /**
   * Add GST to amount
   * @param {number} amount - Base amount
   * @param {number} gstRate - GST rate (percentage)
   * @returns {number} Amount with GST
   */
  addGST(amount, gstRate = TAX_RATES.GST) {
    try {
      const rate = gstRate / 100;
      return this.roundToTwo(amount * (1 + rate));
    } catch (error) {
      logger.error('Add GST error', { error: error.message, amount });
      return amount;
    }
  }

  /**
   * Remove GST from amount (get base amount from total)
   * @param {number} amountWithGST - Amount including GST
   * @param {number} gstRate - GST rate (percentage)
   * @returns {number} Base amount without GST
   */
  removeGST(amountWithGST, gstRate = TAX_RATES.GST) {
    try {
      const rate = gstRate / 100;
      return this.roundToTwo(amountWithGST / (1 + rate));
    } catch (error) {
      logger.error('Remove GST error', { error: error.message, amountWithGST });
      return amountWithGST;
    }
  }

  /**
   * Format amount to INR with Indian number system
   * @param {number} amount - Amount to format
   * @param {Object} options - Formatting options
   * @returns {string} Formatted amount
   */
  formatINR(amount, options = {}) {
    try {
      // Handle null/undefined
      if (amount == null) return '₹0';

      const value = parseFloat(amount);
      if (isNaN(value)) return '₹0';

      // Options
      const showSymbol = options.showSymbol !== false;
      const showPaise = options.showPaise || false;
      const compact = options.compact || false;

      // Compact format (K, L, Cr)
      if (compact) {
        return this.formatCompactINR(value, showSymbol);
      }

      // Format with Indian number system
      const formatter = new Intl.NumberFormat('en-IN', {
        style: showSymbol ? 'currency' : 'decimal',
        currency: 'INR',
        minimumFractionDigits: showPaise ? 2 : 0,
        maximumFractionDigits: 2,
      });

      return formatter.format(value);
    } catch (error) {
      logger.error('INR formatting error', { error: error.message, amount });
      return '₹0';
    }
  }

  /**
   * Format amount in compact Indian format (K, L, Cr)
   * @param {number} amount - Amount to format
   * @param {boolean} showSymbol - Show currency symbol
   * @returns {string} Compact formatted amount
   */
  formatCompactINR(amount, showSymbol = true) {
    try {
      const absAmount = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      const symbol = showSymbol ? '₹' : '';

      if (absAmount >= 10000000) { // Crores
        const crores = absAmount / 10000000;
        return `${sign}${symbol}${this.roundToTwo(crores)} Cr`;
      } else if (absAmount >= 100000) { // Lakhs
        const lakhs = absAmount / 100000;
        return `${sign}${symbol}${this.roundToTwo(lakhs)} L`;
      } else if (absAmount >= 1000) { // Thousands
        const thousands = absAmount / 1000;
        return `${sign}${symbol}${this.roundToTwo(thousands)} K`;
      } else {
        return `${sign}${symbol}${this.roundToTwo(absAmount)}`;
      }
    } catch (error) {
      logger.error('Compact INR formatting error', { error: error.message, amount });
      return '₹0';
    }
  }

  /**
   * Format currency with proper symbol and formatting
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code
   * @param {Object} options - Formatting options
   * @returns {string} Formatted amount
   */
  formatCurrency(amount, currency = CURRENCIES.INR, options = {}) {
    try {
      if (currency === CURRENCIES.INR) {
        return this.formatINR(amount, options);
      }

      // Format other currencies
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: options.minimumFractionDigits || 0,
        maximumFractionDigits: options.maximumFractionDigits || 2,
      });

      return formatter.format(amount);
    } catch (error) {
      logger.error('Currency formatting error', { error: error.message, amount, currency });
      return `${currency} ${amount}`;
    }
  }

  /**
   * Calculate agency commission
   * @param {number} dealValue - Total deal value
   * @param {number} commissionRate - Commission rate (percentage)
   * @returns {Object} Commission details
   */
  calculateCommission(dealValue, commissionRate = 15) {
    try {
      const baseAmount = this.roundToTwo(dealValue);
      const rate = commissionRate / 100;
      const commissionAmount = this.roundToTwo(baseAmount * rate);
      const netAmount = this.roundToTwo(baseAmount - commissionAmount);

      return {
        dealValue: baseAmount,
        commissionRate,
        commissionAmount,
        netAmount,
        formatted: {
          dealValue: this.formatINR(baseAmount),
          commissionAmount: this.formatINR(commissionAmount),
          netAmount: this.formatINR(netAmount),
        },
      };
    } catch (error) {
      logger.error('Commission calculation error', { error: error.message, dealValue });
      return null;
    }
  }

  /**
   * Calculate creator payout after agency commission
   * @param {number} dealValue - Total deal value
   * @param {Object} options - Payout options
   * @returns {Object} Payout details
   */
  calculatePayout(dealValue, options = {}) {
    try {
      const baseAmount = this.roundToTwo(dealValue);
      const agencyCommission = options.agencyCommission || 15;
      const platformFee = options.platformFee || 0;
      const tdsApplicable = options.applyTDS || false;
      const gstOnCommission = options.gstOnCommission || false;

      // Calculate agency commission
      const commission = this.calculateCommission(baseAmount, agencyCommission);
      
      // Calculate platform fee if applicable
      const platformFeeAmount = this.roundToTwo(baseAmount * (platformFee / 100));
      
      // Net after commission and platform fee
      let creatorAmount = commission.netAmount - platformFeeAmount;

      // Apply TDS if applicable
      let tdsAmount = 0;
      if (tdsApplicable) {
        const tds = this.calculateTDS(creatorAmount, { isIndividual: true });
        tdsAmount = tds.tdsAmount;
        creatorAmount = tds.netAmount;
      }

      // Add GST on commission if applicable
      let gstOnCommissionAmount = 0;
      if (gstOnCommission) {
        const gst = this.calculateGST(commission.commissionAmount);
        gstOnCommissionAmount = gst.gstAmount;
      }

      return {
        dealValue: baseAmount,
        agencyCommission: commission.commissionAmount,
        platformFee: platformFeeAmount,
        tdsAmount,
        gstOnCommission: gstOnCommissionAmount,
        creatorPayout: creatorAmount,
        breakdown: {
          dealValue: baseAmount,
          lessAgencyCommission: -commission.commissionAmount,
          lessPlatformFee: -platformFeeAmount,
          lessTDS: -tdsAmount,
          netPayout: creatorAmount,
        },
        formatted: {
          dealValue: this.formatINR(baseAmount),
          agencyCommission: this.formatINR(commission.commissionAmount),
          platformFee: this.formatINR(platformFeeAmount),
          tdsAmount: this.formatINR(tdsAmount),
          gstOnCommission: this.formatINR(gstOnCommissionAmount),
          creatorPayout: this.formatINR(creatorAmount),
        },
      };
    } catch (error) {
      logger.error('Payout calculation error', { error: error.message, dealValue });
      return null;
    }
  }

  /**
   * Round to two decimal places
   * @param {number} value - Value to round
   * @returns {number} Rounded value
   */
  roundToTwo(value) {
    return Math.round(value * 100) / 100;
  }

  /**
   * Calculate total from line items
   * @param {Array} lineItems - Array of line items
   * @returns {Object} Total calculation
   */
  calculateTotal(lineItems) {
    try {
      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        return {
          subtotal: 0,
          taxAmount: 0,
          total: 0,
          formatted: {
            subtotal: this.formatINR(0),
            taxAmount: this.formatINR(0),
            total: this.formatINR(0),
          },
        };
      }

      let subtotal = 0;
      let taxAmount = 0;

      lineItems.forEach(item => {
        const quantity = item.quantity || 1;
        const rate = item.rate || 0;
        const amount = quantity * rate;
        subtotal += amount;

        // Add item-level tax if present
        if (item.taxRate) {
          taxAmount += amount * (item.taxRate / 100);
        }
      });

      subtotal = this.roundToTwo(subtotal);
      taxAmount = this.roundToTwo(taxAmount);
      const total = this.roundToTwo(subtotal + taxAmount);

      return {
        subtotal,
        taxAmount,
        total,
        itemCount: lineItems.length,
        formatted: {
          subtotal: this.formatINR(subtotal),
          taxAmount: this.formatINR(taxAmount),
          total: this.formatINR(total),
        },
      };
    } catch (error) {
      logger.error('Total calculation error', { error: error.message });
      return null;
    }
  }

  /**
   * Convert currency
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @param {number} customRate - Custom exchange rate (optional)
   * @returns {Object} Conversion details
   */
  convertCurrency(amount, fromCurrency, toCurrency, customRate = null) {
    try {
      if (fromCurrency === toCurrency) {
        return {
          originalAmount: amount,
          convertedAmount: amount,
          fromCurrency,
          toCurrency,
          exchangeRate: 1,
          formatted: {
            original: this.formatCurrency(amount, fromCurrency),
            converted: this.formatCurrency(amount, toCurrency),
          },
        };
      }

      // Get exchange rates
      const fromRate = CURRENCY_CONFIG.exchangeRates[fromCurrency] || 1;
      const toRate = CURRENCY_CONFIG.exchangeRates[toCurrency] || 1;
      
      // Calculate exchange rate
      let exchangeRate = customRate || (toRate / fromRate);
      
      // Convert amount
      const convertedAmount = this.roundToTwo(amount * exchangeRate);

      return {
        originalAmount: amount,
        convertedAmount,
        fromCurrency,
        toCurrency,
        exchangeRate,
        formatted: {
          original: this.formatCurrency(amount, fromCurrency),
          converted: this.formatCurrency(convertedAmount, toCurrency),
        },
      };
    } catch (error) {
      logger.error('Currency conversion error', { error: error.message, amount, fromCurrency, toCurrency });
      return null;
    }
  }

  /**
   * Calculate payment milestones
   * @param {number} totalAmount - Total amount
   * @param {Object} milestones - Milestone percentages
   * @returns {Array} Milestone amounts
   */
  calculateMilestone(totalAmount, milestones = CURRENCY_CONFIG.defaultMilestones) {
    try {
      const results = [];
      let remainingAmount = totalAmount;

      Object.entries(milestones).forEach(([name, percentage]) => {
        const amount = this.roundToTwo(totalAmount * percentage);
        remainingAmount -= amount;
        
        results.push({
          name,
          percentage: percentage * 100,
          amount,
          formatted: this.formatINR(amount),
        });
      });

      // Add any remaining amount due to rounding
      if (remainingAmount > 0.01) {
        results[results.length - 1].amount += remainingAmount;
        results[results.length - 1].formatted = this.formatINR(results[results.length - 1].amount);
      }

      return results;
    } catch (error) {
      logger.error('Milestone calculation error', { error: error.message, totalAmount });
      return [];
    }
  }

  /**
   * Calculate platform fee
   * @param {number} amount - Base amount
   * @param {number} feePercentage - Fee percentage
   * @returns {Object} Platform fee details
   */
  calculatePlatformFee(amount, feePercentage = 5) {
    try {
      const baseAmount = this.roundToTwo(amount);
      const feeRate = feePercentage / 100;
      const feeAmount = this.roundToTwo(baseAmount * feeRate);
      const netAmount = this.roundToTwo(baseAmount - feeAmount);

      return {
        baseAmount,
        feePercentage,
        feeAmount,
        netAmount,
        formatted: {
          baseAmount: this.formatINR(baseAmount),
          feeAmount: this.formatINR(feeAmount),
          netAmount: this.formatINR(netAmount),
        },
      };
    } catch (error) {
      logger.error('Platform fee calculation error', { error: error.message, amount });
      return null;
    }
  }

  /**
   * Generate complete invoice breakdown with taxes
   * @param {Object} invoiceData - Invoice data
   * @returns {Object} Complete breakdown
   */
  generateInvoiceBreakdown(invoiceData) {
    try {
      const {
        lineItems = [],
        discountPercentage = 0,
        applyGST = true,
        isInterstate = false,
        applyTDS = false,
        isIndividual = true,
      } = invoiceData;

      // Calculate subtotal from line items
      const totals = this.calculateTotal(lineItems);
      let { subtotal } = totals;

      // Apply discount
      const discountAmount = this.roundToTwo(subtotal * (discountPercentage / 100));
      const afterDiscount = this.roundToTwo(subtotal - discountAmount);

      // Calculate GST
      let gstDetails = null;
      let totalWithGST = afterDiscount;
      if (applyGST) {
        gstDetails = this.calculateGST(afterDiscount, { isInterstate });
        totalWithGST = gstDetails.totalAmount;
      }

      // Calculate TDS
      let tdsDetails = null;
      let finalAmount = totalWithGST;
      if (applyTDS) {
        tdsDetails = this.calculateTDS(totalWithGST, { isIndividual });
        finalAmount = tdsDetails.netAmount;
      }

      // Create breakdown
      const breakdown = {
        lineItems: lineItems.map(item => ({
          ...item,
          amount: this.roundToTwo((item.quantity || 1) * (item.rate || 0)),
          formattedAmount: this.formatINR((item.quantity || 1) * (item.rate || 0)),
        })),
        subtotal,
        discount: {
          percentage: discountPercentage,
          amount: discountAmount,
        },
        afterDiscount,
        gst: gstDetails ? {
          rate: gstDetails.gstRate,
          amount: gstDetails.gstAmount,
          cgst: gstDetails.breakdown.cgst,
          sgst: gstDetails.breakdown.sgst,
          igst: gstDetails.breakdown.igst,
          isInterstate,
        } : null,
        totalWithGST,
        tds: tdsDetails ? {
          rate: tdsDetails.tdsRate,
          amount: tdsDetails.tdsAmount,
          entityType: tdsDetails.entityType,
        } : null,
        finalAmount,
        amountInWords: this.convertToWords(finalAmount),
        formatted: {
          subtotal: this.formatINR(subtotal),
          discount: this.formatINR(discountAmount),
          afterDiscount: this.formatINR(afterDiscount),
          gst: gstDetails ? {
            total: this.formatINR(gstDetails.gstAmount),
            cgst: this.formatINR(gstDetails.breakdown.cgst),
            sgst: this.formatINR(gstDetails.breakdown.sgst),
            igst: this.formatINR(gstDetails.breakdown.igst),
          } : null,
          totalWithGST: this.formatINR(totalWithGST),
          tds: tdsDetails ? this.formatINR(tdsDetails.tdsAmount) : null,
          finalAmount: this.formatINR(finalAmount),
        },
      };

      return breakdown;
    } catch (error) {
      logger.error('Invoice breakdown generation error', { error: error.message });
      return null;
    }
  }

  /**
   * Convert number to words (Indian system)
   * @param {number} amount - Amount to convert
   * @returns {string} Amount in words
   */
  convertToWords(amount) {
    try {
      const num = Math.floor(amount);
      if (num === 0) return 'Zero Rupees Only';

      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

      const convertHundreds = (n) => {
        let str = '';
        
        if (n > 99) {
          str += ones[Math.floor(n / 100)] + ' Hundred ';
          n %= 100;
        }
        
        if (n > 19) {
          str += tens[Math.floor(n / 10)] + ' ';
          n %= 10;
        } else if (n > 9) {
          str += teens[n - 10] + ' ';
          return str;
        }
        
        if (n > 0) {
          str += ones[n] + ' ';
        }
        
        return str;
      };

      let result = '';
      
      // Crores
      if (num >= 10000000) {
        result += convertHundreds(Math.floor(num / 10000000)) + 'Crore ';
        num %= 10000000;
      }
      
      // Lakhs
      if (num >= 100000) {
        result += convertHundreds(Math.floor(num / 100000)) + 'Lakh ';
        num %= 100000;
      }
      
      // Thousands
      if (num >= 1000) {
        result += convertHundreds(Math.floor(num / 1000)) + 'Thousand ';
        num %= 1000;
      }
      
      // Hundreds
      if (num > 0) {
        result += convertHundreds(num);
      }
      
      // Add paise if present
      const paise = Math.round((amount - Math.floor(amount)) * 100);
      if (paise > 0) {
        result += 'and ' + convertHundreds(paise) + 'Paise ';
      }
      
      return result.trim() + ' Only';
    } catch (error) {
      logger.error('Number to words conversion error', { error: error.message, amount });
      return 'Amount in words';
    }
  }

  /**
   * Validate amount
   * @param {number} amount - Amount to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateAmount(amount, options = {}) {
    try {
      const min = options.min || 0;
      const max = options.max || 100000000; // 10 Crores default max

      if (typeof amount !== 'number' || isNaN(amount)) {
        return { isValid: false, error: 'Amount must be a valid number' };
      }

      if (amount < min) {
        return { isValid: false, error: `Amount must be at least ${this.formatINR(min)}` };
      }

      if (amount > max) {
        return { isValid: false, error: `Amount cannot exceed ${this.formatINR(max)}` };
      }

      // Check decimal places
      const decimalPlaces = (amount.toString().split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        return { isValid: false, error: 'Amount can have maximum 2 decimal places' };
      }

      return {
        isValid: true,
        amount: this.roundToTwo(amount),
        formatted: this.formatINR(amount),
      };
    } catch (error) {
      logger.error('Amount validation error', { error: error.message, amount });
      return { isValid: false, error: 'Amount validation failed' };
    }
  }

  /**
   * Calculate percentage
   * @param {number} value - Value
   * @param {number} total - Total
   * @returns {number} Percentage
   */
  calculatePercentage(value, total) {
    try {
      if (total === 0) return 0;
      return this.roundToTwo((value / total) * 100);
    } catch (error) {
      logger.error('Percentage calculation error', { error: error.message });
      return 0;
    }
  }

  /**
   * Apply percentage to amount
   * @param {number} amount - Base amount
   * @param {number} percentage - Percentage to apply
   * @returns {number} Result amount
   */
  applyPercentage(amount, percentage) {
    try {
      return this.roundToTwo(amount * (percentage / 100));
    } catch (error) {
      logger.error('Apply percentage error', { error: error.message });
      return 0;
    }
  }
}

// Create singleton instance
const currencyUtil = new CurrencyUtil();

// Export utility instance and methods
module.exports = currencyUtil;

// Export convenience methods
module.exports.currency = {
  calculateGST: (amount, options) => currencyUtil.calculateGST(amount, options),
  calculateTDS: (amount, options) => currencyUtil.calculateTDS(amount, options),
  calculateIGST: (amount, options) => currencyUtil.calculateIGST(amount, options),
  calculateCGSTSGST: (amount, options) => currencyUtil.calculateCGSTSGST(amount, options),
  addGST: (amount, gstRate) => currencyUtil.addGST(amount, gstRate),
  removeGST: (amountWithGST, gstRate) => currencyUtil.removeGST(amountWithGST, gstRate),
  formatINR: (amount, options) => currencyUtil.formatINR(amount, options),
  formatCurrency: (amount, currency, options) => currencyUtil.formatCurrency(amount, currency, options),
  calculateCommission: (dealValue, commissionRate) => currencyUtil.calculateCommission(dealValue, commissionRate),
  calculatePayout: (dealValue, options) => currencyUtil.calculatePayout(dealValue, options),
  roundToTwo: (value) => currencyUtil.roundToTwo(value),
  calculateTotal: (lineItems) => currencyUtil.calculateTotal(lineItems),
  convertCurrency: (amount, fromCurrency, toCurrency, customRate) => currencyUtil.convertCurrency(amount, fromCurrency, toCurrency, customRate),
  calculateMilestone: (totalAmount, milestones) => currencyUtil.calculateMilestone(totalAmount, milestones),
  calculatePlatformFee: (amount, feePercentage) => currencyUtil.calculatePlatformFee(amount, feePercentage),
  generateInvoiceBreakdown: (invoiceData) => currencyUtil.generateInvoiceBreakdown(invoiceData),
  convertToWords: (amount) => currencyUtil.convertToWords(amount),
  validateAmount: (amount, options) => currencyUtil.validateAmount(amount, options),
  calculatePercentage: (value, total) => currencyUtil.calculatePercentage(value, total),
  applyPercentage: (amount, percentage) => currencyUtil.applyPercentage(amount, percentage),
};