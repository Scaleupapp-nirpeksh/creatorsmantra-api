/**
 * Date Utility
 * @module utils/date
 * @description Date formatting, timezone handling, and business date calculations
 * 
 * File Path: src/utils/date.util.js
 * 
 * Features:
 * - Indian timezone (IST) handling
 * - Business day calculations
 * - Payment terms and due dates
 * - Indian financial year (April-March)
 * - Delivery timeline management
 * - Payment reminder scheduling
 * - Date range utilities
 */

const moment = require('moment-timezone');
const logger = require('../config/logger');
const { PAYMENT_TERMS } = require('../config/constants');

/**
 * Date Configuration
 */
const DATE_CONFIG = {
  timezone: 'Asia/Kolkata', // Indian Standard Time
  locale: 'en-IN',
  formats: {
    date: 'DD/MM/YYYY',
    dateTime: 'DD/MM/YYYY hh:mm A',
    dateTimeFull: 'DD MMM YYYY, hh:mm A',
    monthYear: 'MMM YYYY',
    dayMonth: 'DD MMM',
    time: 'hh:mm A',
    iso: 'YYYY-MM-DD',
    isoDateTime: 'YYYY-MM-DD HH:mm:ss',
    invoice: 'DD-MMM-YYYY',
    report: 'DD MMM YYYY',
  },
  fiscalYearStart: 4, // April (month number)
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday
  holidays: [], // Will be populated with Indian holidays
  reminderIntervals: [0, 7, 14, 30, 45, 60], // Days for payment reminders
};

/**
 * Indian National Holidays (2024-2025)
 * Can be updated annually or fetched from an API
 */
const INDIAN_HOLIDAYS = {
  '2024': [
    '2024-01-26', // Republic Day
    '2024-03-08', // Maha Shivaratri
    '2024-03-25', // Holi
    '2024-03-29', // Good Friday
    '2024-04-11', // Eid ul-Fitr
    '2024-04-17', // Ram Navami
    '2024-04-21', // Mahavir Jayanti
    '2024-05-23', // Buddha Purnima
    '2024-06-17', // Eid ul-Adha
    '2024-07-17', // Muharram
    '2024-08-15', // Independence Day
    '2024-08-26', // Janmashtami
    '2024-09-07', // Ganesh Chaturthi
    '2024-10-02', // Gandhi Jayanti
    '2024-10-12', // Dussehra
    '2024-10-31', // Diwali
    '2024-11-01', // Govardhan Puja
    '2024-11-02', // Bhai Dooj
    '2024-11-15', // Guru Nanak Jayanti
    '2024-12-25', // Christmas
  ],
  '2025': [
    '2025-01-26', // Republic Day
    '2025-02-26', // Maha Shivaratri
    '2025-03-14', // Holi
    '2025-03-31', // Eid ul-Fitr
    '2025-04-06', // Ram Navami
    '2025-04-10', // Mahavir Jayanti
    '2025-04-18', // Good Friday
    '2025-05-12', // Buddha Purnima
    '2025-06-07', // Eid ul-Adha
    '2025-07-06', // Muharram
    '2025-08-15', // Independence Day
    '2025-08-16', // Janmashtami
    '2025-08-27', // Ganesh Chaturthi
    '2025-10-02', // Gandhi Jayanti
    '2025-10-01', // Dussehra
    '2025-10-20', // Diwali
    '2025-10-21', // Govardhan Puja
    '2025-10-22', // Bhai Dooj
    '2025-11-05', // Guru Nanak Jayanti
    '2025-12-25', // Christmas
  ],
};

/**
 * Date Utility Class
 * Provides methods for date manipulation and formatting
 */
class DateUtil {
  constructor() {
    // Set default timezone
    moment.tz.setDefault(DATE_CONFIG.timezone);
    
    // Load holidays
    this.loadHolidays();
  }

  /**
   * Load holidays for current and next year
   * @private
   */
  loadHolidays() {
    const currentYear = moment().year();
    const nextYear = currentYear + 1;
    
    DATE_CONFIG.holidays = [
      ...(INDIAN_HOLIDAYS[currentYear] || []),
      ...(INDIAN_HOLIDAYS[nextYear] || []),
    ].map(date => moment(date).format('YYYY-MM-DD'));
  }

  /**
   * Format date to Indian standard format
   * @param {Date|string|moment} date - Date to format
   * @param {string} format - Format type from DATE_CONFIG.formats
   * @returns {string} Formatted date
   */
  formatDate(date, format = 'date') {
    try {
      if (!date) return '';
      
      const formatString = DATE_CONFIG.formats[format] || format;
      return moment(date).tz(DATE_CONFIG.timezone).format(formatString);
    } catch (error) {
      logger.error('Date formatting error', { error: error.message, date, format });
      return '';
    }
  }

  /**
   * Format date with time
   * @param {Date|string|moment} date - Date to format
   * @returns {string} Formatted date and time
   */
  formatDateTime(date) {
    return this.formatDate(date, 'dateTime');
  }

  /**
   * Convert to Indian Standard Time
   * @param {Date|string|moment} date - Date to convert
   * @returns {moment.Moment} Date in IST
   */
  toIST(date) {
    try {
      return moment(date).tz(DATE_CONFIG.timezone);
    } catch (error) {
      logger.error('IST conversion error', { error: error.message, date });
      return moment().tz(DATE_CONFIG.timezone);
    }
  }

  /**
   * Calculate due date based on payment terms
   * @param {Date|string} startDate - Start date (invoice date)
   * @param {number|string} terms - Payment terms (days or PAYMENT_TERMS key)
   * @returns {Date} Due date
   */
  calculateDueDate(startDate, terms = PAYMENT_TERMS.NET_30) {
    try {
      const start = moment(startDate);
      
      // Handle predefined payment terms
      if (typeof terms === 'string' && PAYMENT_TERMS[terms] !== undefined) {
        terms = PAYMENT_TERMS[terms];
      }

      // Convert to number
      const days = parseInt(terms) || 30;

      // Special case for immediate payment
      if (days === 0) {
        return start.toDate();
      }

      // Add days
      return start.add(days, 'days').toDate();
    } catch (error) {
      logger.error('Due date calculation error', { error: error.message, startDate, terms });
      return moment(startDate).add(30, 'days').toDate();
    }
  }

  /**
   * Get business days between two dates
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @param {boolean} excludeHolidays - Whether to exclude holidays
   * @returns {number} Number of business days
   */
  getBusinessDays(startDate, endDate, excludeHolidays = true) {
    try {
      const start = moment(startDate);
      const end = moment(endDate);
      
      if (end.isBefore(start)) {
        return 0;
      }

      let businessDays = 0;
      const current = start.clone();

      while (current.isSameOrBefore(end)) {
        // Check if it's a working day
        if (this.isBusinessDay(current, excludeHolidays)) {
          businessDays++;
        }
        current.add(1, 'day');
      }

      return businessDays;
    } catch (error) {
      logger.error('Business days calculation error', { error: error.message });
      return 0;
    }
  }

  /**
   * Add business days to a date
   * @param {Date|string} date - Start date
   * @param {number} days - Number of business days to add
   * @param {boolean} excludeHolidays - Whether to exclude holidays
   * @returns {Date} Result date
   */
  addBusinessDays(date, days, excludeHolidays = true) {
    try {
      const result = moment(date);
      let daysAdded = 0;

      while (daysAdded < days) {
        result.add(1, 'day');
        
        if (this.isBusinessDay(result, excludeHolidays)) {
          daysAdded++;
        }
      }

      return result.toDate();
    } catch (error) {
      logger.error('Add business days error', { error: error.message });
      return moment(date).add(days, 'days').toDate();
    }
  }

  /**
   * Check if a date is a business day
   * @param {Date|string|moment} date - Date to check
   * @param {boolean} excludeHolidays - Whether to exclude holidays
   * @returns {boolean} Is business day
   */
  isBusinessDay(date, excludeHolidays = true) {
    try {
      const momentDate = moment(date);
      
      // Check if it's a weekend
      const dayOfWeek = momentDate.isoWeekday();
      if (!DATE_CONFIG.workingDays.includes(dayOfWeek)) {
        return false;
      }

      // Check if it's a holiday
      if (excludeHolidays) {
        const dateString = momentDate.format('YYYY-MM-DD');
        if (DATE_CONFIG.holidays.includes(dateString)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Business day check error', { error: error.message });
      return false;
    }
  }

  /**
   * Get days between two dates
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {number} Number of days
   */
  getDaysBetween(startDate, endDate) {
    try {
      const start = moment(startDate).startOf('day');
      const end = moment(endDate).startOf('day');
      return end.diff(start, 'days');
    } catch (error) {
      logger.error('Days between calculation error', { error: error.message });
      return 0;
    }
  }

  /**
   * Check if a date is overdue
   * @param {Date|string} dueDate - Due date
   * @param {Date|string} compareDate - Date to compare (default: today)
   * @returns {boolean} Is overdue
   */
  isOverdue(dueDate, compareDate = null) {
    try {
      const due = moment(dueDate).endOf('day');
      const compare = compareDate ? moment(compareDate) : moment();
      return compare.isAfter(due);
    } catch (error) {
      logger.error('Overdue check error', { error: error.message });
      return false;
    }
  }

  /**
   * Get month date range
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @returns {Object} Start and end dates
   */
  getMonthDateRange(month, year) {
    try {
      const startDate = moment().year(year).month(month - 1).startOf('month');
      const endDate = startDate.clone().endOf('month');
      
      return {
        startDate: startDate.toDate(),
        endDate: endDate.toDate(),
        startDateISO: startDate.format('YYYY-MM-DD'),
        endDateISO: endDate.format('YYYY-MM-DD'),
        days: endDate.date(),
      };
    } catch (error) {
      logger.error('Month date range error', { error: error.message });
      return null;
    }
  }

  /**
   * Get quarter date range
   * @param {number} quarter - Quarter (1-4)
   * @param {number} year - Year
   * @returns {Object} Start and end dates
   */
  getQuarterDateRange(quarter, year) {
    try {
      const startMonth = (quarter - 1) * 3;
      const startDate = moment().year(year).month(startMonth).startOf('month');
      const endDate = startDate.clone().add(2, 'months').endOf('month');
      
      return {
        startDate: startDate.toDate(),
        endDate: endDate.toDate(),
        startDateISO: startDate.format('YYYY-MM-DD'),
        endDateISO: endDate.format('YYYY-MM-DD'),
        quarter,
        year,
      };
    } catch (error) {
      logger.error('Quarter date range error', { error: error.message });
      return null;
    }
  }

  /**
   * Get Indian financial year
   * @param {Date|string} date - Date to check
   * @returns {Object} Financial year details
   */
  getFinancialYear(date = null) {
    try {
      const momentDate = date ? moment(date) : moment();
      const month = momentDate.month() + 1; // moment months are 0-indexed
      const year = momentDate.year();
      
      let fyStartYear, fyEndYear;
      
      // Indian FY runs from April to March
      if (month >= DATE_CONFIG.fiscalYearStart) {
        fyStartYear = year;
        fyEndYear = year + 1;
      } else {
        fyStartYear = year - 1;
        fyEndYear = year;
      }
      
      const startDate = moment().year(fyStartYear).month(DATE_CONFIG.fiscalYearStart - 1).date(1).startOf('day');
      const endDate = moment().year(fyEndYear).month(DATE_CONFIG.fiscalYearStart - 1).date(1).subtract(1, 'day').endOf('day');
      
      // Determine quarter
      let quarter;
      if (month >= 4 && month <= 6) quarter = 1;
      else if (month >= 7 && month <= 9) quarter = 2;
      else if (month >= 10 && month <= 12) quarter = 3;
      else quarter = 4;
      
      return {
        year: `FY${fyStartYear}-${fyEndYear.toString().slice(2)}`,
        startYear: fyStartYear,
        endYear: fyEndYear,
        startDate: startDate.toDate(),
        endDate: endDate.toDate(),
        startDateISO: startDate.format('YYYY-MM-DD'),
        endDateISO: endDate.format('YYYY-MM-DD'),
        quarter: `Q${quarter}`,
        currentDate: momentDate.toDate(),
      };
    } catch (error) {
      logger.error('Financial year calculation error', { error: error.message });
      return null;
    }
  }

  /**
   * Format delivery date with buffer
   * @param {Date|string} date - Delivery date
   * @param {number} bufferDays - Buffer days
   * @returns {Object} Delivery date info
   */
  formatDeliveryDate(date, bufferDays = 2) {
    try {
      const deliveryDate = moment(date);
      const bufferDate = deliveryDate.clone().subtract(bufferDays, 'days');
      const today = moment();
      
      return {
        deliveryDate: deliveryDate.toDate(),
        bufferDate: bufferDate.toDate(),
        formatted: deliveryDate.format(DATE_CONFIG.formats.date),
        daysRemaining: deliveryDate.diff(today, 'days'),
        isToday: deliveryDate.isSame(today, 'day'),
        isTomorrow: deliveryDate.isSame(today.clone().add(1, 'day'), 'day'),
        isPast: deliveryDate.isBefore(today, 'day'),
        isWithinBuffer: today.isSameOrAfter(bufferDate, 'day'),
        status: this.getDeliveryStatus(deliveryDate, today),
      };
    } catch (error) {
      logger.error('Delivery date formatting error', { error: error.message });
      return null;
    }
  }

  /**
   * Get delivery status
   * @private
   * @param {moment.Moment} deliveryDate - Delivery date
   * @param {moment.Moment} today - Current date
   * @returns {string} Status
   */
  getDeliveryStatus(deliveryDate, today) {
    if (deliveryDate.isBefore(today, 'day')) return 'overdue';
    if (deliveryDate.isSame(today, 'day')) return 'due_today';
    if (deliveryDate.isSame(today.clone().add(1, 'day'), 'day')) return 'due_tomorrow';
    if (deliveryDate.diff(today, 'days') <= 3) return 'upcoming';
    return 'scheduled';
  }

  /**
   * Get payment reminder dates
   * @param {Date|string} invoiceDate - Invoice date
   * @param {Date|string} dueDate - Due date
   * @returns {Array} Reminder dates
   */
  getPaymentReminders(invoiceDate, dueDate) {
    try {
      const invoice = moment(invoiceDate);
      const due = moment(dueDate);
      const reminders = [];
      
      DATE_CONFIG.reminderIntervals.forEach(days => {
        const reminderDate = invoice.clone().add(days, 'days');
        
        // Don't add reminders after due date
        if (reminderDate.isAfter(due)) {
          return;
        }
        
        reminders.push({
          date: reminderDate.toDate(),
          formatted: reminderDate.format(DATE_CONFIG.formats.date),
          daysFromInvoice: days,
          daysToDue: due.diff(reminderDate, 'days'),
          type: this.getReminderType(days),
        });
      });
      
      // Add due date reminder
      reminders.push({
        date: due.toDate(),
        formatted: due.format(DATE_CONFIG.formats.date),
        daysFromInvoice: due.diff(invoice, 'days'),
        daysToDue: 0,
        type: 'due_date',
      });
      
      // Add overdue reminders
      [7, 14, 30].forEach(days => {
        const overdueDate = due.clone().add(days, 'days');
        reminders.push({
          date: overdueDate.toDate(),
          formatted: overdueDate.format(DATE_CONFIG.formats.date),
          daysFromInvoice: overdueDate.diff(invoice, 'days'),
          daysOverdue: days,
          type: 'overdue',
        });
      });
      
      return reminders.sort((a, b) => a.date - b.date);
    } catch (error) {
      logger.error('Payment reminders calculation error', { error: error.message });
      return [];
    }
  }

  /**
   * Get reminder type
   * @private
   * @param {number} days - Days from invoice
   * @returns {string} Reminder type
   */
  getReminderType(days) {
    if (days === 0) return 'invoice_sent';
    if (days <= 7) return 'gentle_reminder';
    if (days <= 14) return 'follow_up';
    if (days <= 30) return 'urgent';
    return 'escalation';
  }

  /**
   * Parse Indian date format (DD/MM/YYYY)
   * @param {string} dateString - Date string in DD/MM/YYYY format
   * @returns {Date|null} Parsed date
   */
  parseIndianDate(dateString) {
    try {
      if (!dateString) return null;
      
      // Handle different separators
      const normalized = dateString.replace(/[-./]/g, '/');
      
      // Parse DD/MM/YYYY format
      const parts = normalized.split('/');
      if (parts.length !== 3) {
        throw new Error('Invalid date format');
      }
      
      const [day, month, year] = parts.map(p => parseInt(p));
      
      // Validate parts
      if (isNaN(day) || isNaN(month) || isNaN(year)) {
        throw new Error('Invalid date parts');
      }
      
      // Create date (month is 0-indexed in JavaScript)
      const date = new Date(year, month - 1, day);
      
      // Validate the date
      if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
        throw new Error('Invalid date');
      }
      
      return date;
    } catch (error) {
      logger.error('Indian date parsing error', { error: error.message, dateString });
      return null;
    }
  }

  /**
   * Get relative time string
   * @param {Date|string} date - Date
   * @returns {string} Relative time
   */
  getRelativeTime(date) {
    try {
      return moment(date).fromNow();
    } catch (error) {
      logger.error('Relative time error', { error: error.message });
      return '';
    }
  }

  /**
   * Get week date range
   * @param {Date|string} date - Any date in the week
   * @returns {Object} Week start and end dates
   */
  getWeekDateRange(date = null) {
    try {
      const momentDate = date ? moment(date) : moment();
      const startDate = momentDate.clone().startOf('isoWeek'); // Monday
      const endDate = momentDate.clone().endOf('isoWeek'); // Sunday
      
      return {
        startDate: startDate.toDate(),
        endDate: endDate.toDate(),
        startDateISO: startDate.format('YYYY-MM-DD'),
        endDateISO: endDate.format('YYYY-MM-DD'),
        weekNumber: startDate.isoWeek(),
        year: startDate.year(),
      };
    } catch (error) {
      logger.error('Week date range error', { error: error.message });
      return null;
    }
  }

  /**
   * Get age from date
   * @param {Date|string} birthDate - Birth date
   * @returns {number} Age in years
   */
  getAge(birthDate) {
    try {
      return moment().diff(moment(birthDate), 'years');
    } catch (error) {
      logger.error('Age calculation error', { error: error.message });
      return 0;
    }
  }

  /**
   * Check if date is today
   * @param {Date|string} date - Date to check
   * @returns {boolean} Is today
   */
  isToday(date) {
    try {
      return moment(date).isSame(moment(), 'day');
    } catch (error) {
      logger.error('Today check error', { error: error.message });
      return false;
    }
  }

  /**
   * Check if date is in the past
   * @param {Date|string} date - Date to check
   * @returns {boolean} Is in past
   */
  isPast(date) {
    try {
      return moment(date).isBefore(moment(), 'day');
    } catch (error) {
      logger.error('Past check error', { error: error.message });
      return false;
    }
  }

  /**
   * Check if date is in the future
   * @param {Date|string} date - Date to check
   * @returns {boolean} Is in future
   */
  isFuture(date) {
    try {
      return moment(date).isAfter(moment(), 'day');
    } catch (error) {
      logger.error('Future check error', { error: error.message });
      return false;
    }
  }

  /**
   * Get current timestamp
   * @returns {string} ISO timestamp
   */
  now() {
    return moment().toISOString();
  }

  /**
   * Get start of day
   * @param {Date|string} date - Date
   * @returns {Date} Start of day
   */
  startOfDay(date = null) {
    const momentDate = date ? moment(date) : moment();
    return momentDate.startOf('day').toDate();
  }

  /**
   * Get end of day
   * @param {Date|string} date - Date
   * @returns {Date} End of day
   */
  endOfDay(date = null) {
    const momentDate = date ? moment(date) : moment();
    return momentDate.endOf('day').toDate();
  }

  /**
   * Format duration
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    try {
      const duration = moment.duration(seconds, 'seconds');
      
      if (duration.days() > 0) {
        return `${duration.days()}d ${duration.hours()}h`;
      } else if (duration.hours() > 0) {
        return `${duration.hours()}h ${duration.minutes()}m`;
      } else if (duration.minutes() > 0) {
        return `${duration.minutes()}m ${duration.seconds()}s`;
      } else {
        return `${duration.seconds()}s`;
      }
    } catch (error) {
      logger.error('Duration formatting error', { error: error.message });
      return '0s';
    }
  }

  /**
   * Get date for invoice number
   * @param {Date|string} date - Date
   * @returns {string} Date for invoice (YYYYMMDD)
   */
  getInvoiceDateString(date = null) {
    const momentDate = date ? moment(date) : moment();
    return momentDate.format('YYYYMMDD');
  }

  /**
   * Check if year is leap year
   * @param {number} year - Year
   * @returns {boolean} Is leap year
   */
  isLeapYear(year) {
    return moment([year]).isLeapYear();
  }

  /**
   * Get days in month
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @returns {number} Days in month
   */
  getDaysInMonth(month, year) {
    return moment().year(year).month(month - 1).daysInMonth();
  }
}

// Create singleton instance
const dateUtil = new DateUtil();

// Export utility instance and methods
module.exports = dateUtil;

// Export convenience methods
module.exports.date = {
  format: (date, format) => dateUtil.formatDate(date, format),
  formatDateTime: (date) => dateUtil.formatDateTime(date),
  toIST: (date) => dateUtil.toIST(date),
  calculateDueDate: (startDate, terms) => dateUtil.calculateDueDate(startDate, terms),
  getBusinessDays: (startDate, endDate, excludeHolidays) => dateUtil.getBusinessDays(startDate, endDate, excludeHolidays),
  addBusinessDays: (date, days, excludeHolidays) => dateUtil.addBusinessDays(date, days, excludeHolidays),
  getDaysBetween: (startDate, endDate) => dateUtil.getDaysBetween(startDate, endDate),
  isOverdue: (dueDate, compareDate) => dateUtil.isOverdue(dueDate, compareDate),
  getMonthDateRange: (month, year) => dateUtil.getMonthDateRange(month, year),
  getQuarterDateRange: (quarter, year) => dateUtil.getQuarterDateRange(quarter, year),
  getFinancialYear: (date) => dateUtil.getFinancialYear(date),
  formatDeliveryDate: (date, bufferDays) => dateUtil.formatDeliveryDate(date, bufferDays),
  getPaymentReminders: (invoiceDate, dueDate) => dateUtil.getPaymentReminders(invoiceDate, dueDate),
  parseIndianDate: (dateString) => dateUtil.parseIndianDate(dateString),
  getRelativeTime: (date) => dateUtil.getRelativeTime(date),
  getWeekDateRange: (date) => dateUtil.getWeekDateRange(date),
  isToday: (date) => dateUtil.isToday(date),
  isPast: (date) => dateUtil.isPast(date),
  isFuture: (date) => dateUtil.isFuture(date),
  now: () => dateUtil.now(),
  startOfDay: (date) => dateUtil.startOfDay(date),
  endOfDay: (date) => dateUtil.endOfDay(date),
  formatDuration: (seconds) => dateUtil.formatDuration(seconds),
  isBusinessDay: (date, excludeHolidays) => dateUtil.isBusinessDay(date, excludeHolidays),
};