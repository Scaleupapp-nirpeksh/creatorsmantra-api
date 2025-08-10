/**
 * Application Constants
 * @module config/constants
 * @description Central location for all application constants to ensure consistency
 */

/**
 * User Roles and Permissions
 */
const USER_ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    AGENCY: 'agency',
    CREATOR: 'creator',
    MANAGER: 'manager',
    VIEWER: 'viewer',
  };
  
  /**
   * Account Types
   */
  const ACCOUNT_TYPES = {
    INDIVIDUAL: 'individual',
    AGENCY: 'agency',
    ENTERPRISE: 'enterprise',
  };
  
  /**
   * Subscription Plans
   */
  const SUBSCRIPTION_PLANS = {
    FREE: 'free',
    CREATOR: 'creator',
    AGENCY: 'agency',
    ENTERPRISE: 'enterprise',
  };
  
  /**
   * Deal Pipeline Stages
   * Module 1: Deal CRM Pipeline
   */
  const DEAL_STAGES = {
    PITCHED: 'pitched',
    IN_TALKS: 'in_talks',
    NEGOTIATION: 'negotiation',
    CONTRACT: 'contract',
    LIVE: 'live',
    DELIVERED: 'delivered',
    PAID: 'paid',
    CANCELLED: 'cancelled',
    ON_HOLD: 'on_hold',
  };
  
  /**
   * Deal Priority Levels
   */
  const DEAL_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent',
  };
  
  /**
   * Platform Types for Creators
   */
  const PLATFORMS = {
    INSTAGRAM: 'instagram',
    YOUTUBE: 'youtube',
    LINKEDIN: 'linkedin',
    TWITTER: 'twitter',
    FACEBOOK: 'facebook',
    TIKTOK: 'tiktok',
    SNAPCHAT: 'snapchat',
    PINTEREST: 'pinterest',
    THREADS: 'threads',
    OTHER: 'other',
  };
  
  /**
   * Content Deliverable Types
   */
  const DELIVERABLE_TYPES = {
    // Instagram
    INSTAGRAM_REEL: 'instagram_reel',
    INSTAGRAM_POST: 'instagram_post',
    INSTAGRAM_STORY: 'instagram_story',
    INSTAGRAM_CAROUSEL: 'instagram_carousel',
    INSTAGRAM_IGTV: 'instagram_igtv',
    INSTAGRAM_LIVE: 'instagram_live',
  
    // YouTube
    YOUTUBE_VIDEO: 'youtube_video',
    YOUTUBE_SHORT: 'youtube_short',
    YOUTUBE_LIVE: 'youtube_live',
    YOUTUBE_COMMUNITY: 'youtube_community',
  
    // LinkedIn
    LINKEDIN_POST: 'linkedin_post',
    LINKEDIN_ARTICLE: 'linkedin_article',
    LINKEDIN_VIDEO: 'linkedin_video',
    LINKEDIN_NEWSLETTER: 'linkedin_newsletter',
  
    // Twitter
    TWITTER_TWEET: 'twitter_tweet',
    TWITTER_THREAD: 'twitter_thread',
    TWITTER_SPACE: 'twitter_space',
  
    // Generic
    BLOG_POST: 'blog_post',
    PODCAST: 'podcast',
    WEBINAR: 'webinar',
    OTHER: 'other',
  };
  
  /**
   * Invoice Status
   * Module 3: Invoice Generator
   */
  const INVOICE_STATUS = {
    DRAFT: 'draft',
    SENT: 'sent',
    VIEWED: 'viewed',
    PARTIALLY_PAID: 'partially_paid',
    PAID: 'paid',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
  };
  
  /**
   * Payment Status
   * Module 3: Payment Tracker
   */
  const PAYMENT_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    SUCCESS: 'success',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
    EXPIRED: 'expired',
  };
  
  /**
   * Payment Methods
   */
  const PAYMENT_METHODS = {
    BANK_TRANSFER: 'bank_transfer',
    UPI: 'upi',
    RAZORPAY: 'razorpay',
    CREDIT_CARD: 'credit_card',
    DEBIT_CARD: 'debit_card',
    NET_BANKING: 'net_banking',
    WALLET: 'wallet',
    CASH: 'cash',
    CHEQUE: 'cheque',
    OTHER: 'other',
  };
  
  /**
   * Payment Terms
   */
  const PAYMENT_TERMS = {
    IMMEDIATE: 0,
    NET_7: 7,
    NET_15: 15,
    NET_30: 30,
    NET_45: 45,
    NET_60: 60,
    NET_90: 90,
    CUSTOM: -1,
  };
  
  /**
   * Currency Codes
   */
  const CURRENCIES = {
    INR: 'INR',
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    AED: 'AED',
    SGD: 'SGD',
  };
  
  /**
   * Tax Types (India specific)
   */
  const TAX_TYPES = {
    GST: 'gst',
    TDS: 'tds',
    IGST: 'igst',
    CGST: 'cgst',
    SGST: 'sgst',
    NONE: 'none',
  };
  
  /**
   * Default Tax Rates (in percentage)
   */
  const TAX_RATES = {
    GST: 18,
    TDS_INDIVIDUAL: 10,
    TDS_COMPANY: 2,
    IGST: 18,
    CGST: 9,
    SGST: 9,
  };
  
  /**
   * Brief Status
   * Module 4: Brief Analyzer
   */
  const BRIEF_STATUS = {
    RECEIVED: 'received',
    ANALYZING: 'analyzing',
    ANALYZED: 'analyzed',
    CLARIFICATION_NEEDED: 'clarification_needed',
    APPROVED: 'approved',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
  };
  
  /**
   * Contract Status
   * Module 6: Contract Upload
   */
  const CONTRACT_STATUS = {
    DRAFT: 'draft',
    UNDER_REVIEW: 'under_review',
    NEGOTIATION: 'negotiation',
    APPROVED: 'approved',
    SIGNED: 'signed',
    ACTIVE: 'active',
    EXPIRED: 'expired',
    TERMINATED: 'terminated',
  };
  
  /**
   * Contract Risk Levels
   */
  const CONTRACT_RISK_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  };
  
  /**
   * Performance Report Status
   * Module 5: Performance Vault
   */
  const REPORT_STATUS = {
    DRAFT: 'draft',
    PROCESSING: 'processing',
    READY: 'ready',
    SENT: 'sent',
    VIEWED: 'viewed',
  };
  
  /**
   * Notification Types
   */
  const NOTIFICATION_TYPES = {
    // System
    SYSTEM: 'system',
    ANNOUNCEMENT: 'announcement',
    UPDATE: 'update',
  
    // Deals
    DEAL_CREATED: 'deal_created',
    DEAL_UPDATED: 'deal_updated',
    DEAL_STAGE_CHANGED: 'deal_stage_changed',
    DEAL_ASSIGNED: 'deal_assigned',
  
    // Payments
    PAYMENT_RECEIVED: 'payment_received',
    PAYMENT_PENDING: 'payment_pending',
    PAYMENT_OVERDUE: 'payment_overdue',
    INVOICE_SENT: 'invoice_sent',
  
    // Contracts
    CONTRACT_UPLOADED: 'contract_uploaded',
    CONTRACT_REVIEW: 'contract_review',
    CONTRACT_EXPIRING: 'contract_expiring',
  
    // Performance
    REPORT_READY: 'report_ready',
    METRICS_UPDATE: 'metrics_update',
  
    // Approvals (Agency)
    APPROVAL_REQUIRED: 'approval_required',
    APPROVAL_RECEIVED: 'approval_received',
    APPROVAL_REJECTED: 'approval_rejected',
  };
  
  /**
   * Notification Priority
   */
  const NOTIFICATION_PRIORITY = {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    URGENT: 'urgent',
  };
  
  /**
   * File Types
   */
  const FILE_TYPES = {
    IMAGE: 'image',
    VIDEO: 'video',
    DOCUMENT: 'document',
    SPREADSHEET: 'spreadsheet',
    PRESENTATION: 'presentation',
    PDF: 'pdf',
    ARCHIVE: 'archive',
    OTHER: 'other',
  };
  
  /**
   * Allowed File Extensions
   */
  const ALLOWED_EXTENSIONS = {
    IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    VIDEO: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv'],
    DOCUMENT: ['.doc', '.docx', '.txt', '.rtf', '.odt'],
    SPREADSHEET: ['.xls', '.xlsx', '.csv', '.ods'],
    PRESENTATION: ['.ppt', '.pptx', '.odp'],
    PDF: ['.pdf'],
    ARCHIVE: ['.zip', '.rar', '.7z', '.tar', '.gz'],
  };
  
  /**
   * MIME Types
   */
  const MIME_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/csv': 'csv',
    'application/zip': 'zip',
    'video/mp4': 'mp4',
  };
  
  /**
   * Rate Card Templates
   * Module 2: Pitch & Rate Card Builder
   */
  const RATE_CARD_TEMPLATES = {
    MINIMAL_CLEAN: 'minimal_clean',
    BOLD_GRADIENT: 'bold_gradient',
    CORPORATE_PROFESSIONAL: 'corporate_professional',
    CREATIVE_PLAYFUL: 'creative_playful',
    LUXURY_PREMIUM: 'luxury_premium',
  };
  
  /**
   * Approval Status (Agency)
   * Module 8: Approvals & SLAs
   */
  const APPROVAL_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    REVISION_REQUESTED: 'revision_requested',
  };
  
  /**
   * SLA Metrics
   */
  const SLA_METRICS = {
    RESPONSE_TIME: 'response_time',
    DELIVERY_TIME: 'delivery_time',
    APPROVAL_TIME: 'approval_time',
    PAYMENT_COLLECTION: 'payment_collection',
  };
  
  /**
   * Error Codes
   */
  const ERROR_CODES = {
    // Authentication (1xxx)
    INVALID_CREDENTIALS: 1001,
    TOKEN_EXPIRED: 1002,
    TOKEN_INVALID: 1003,
    UNAUTHORIZED: 1004,
    SESSION_EXPIRED: 1005,
    TWO_FACTOR_REQUIRED: 1006,
    TWO_FACTOR_INVALID: 1007,
  
    // Validation (2xxx)
    VALIDATION_ERROR: 2001,
    INVALID_INPUT: 2002,
    MISSING_FIELDS: 2003,
    INVALID_FILE_TYPE: 2004,
    FILE_TOO_LARGE: 2005,
  
    // Resource (3xxx)
    RESOURCE_NOT_FOUND: 3001,
    RESOURCE_ALREADY_EXISTS: 3002,
    RESOURCE_CONFLICT: 3003,
    RESOURCE_DELETED: 3004,
  
    // Permission (4xxx)
    PERMISSION_DENIED: 4001,
    INSUFFICIENT_PRIVILEGES: 4002,
    ACCOUNT_SUSPENDED: 4003,
    SUBSCRIPTION_EXPIRED: 4004,
  
    // Business Logic (5xxx)
    INVALID_OPERATION: 5001,
    LIMIT_EXCEEDED: 5002,
    INSUFFICIENT_BALANCE: 5003,
    INVALID_STATE_TRANSITION: 5004,
  
    // External Services (6xxx)
    PAYMENT_FAILED: 6001,
    EMAIL_FAILED: 6002,
    SMS_FAILED: 6003,
    AI_SERVICE_ERROR: 6004,
    STORAGE_ERROR: 6005,
  
    // Server (9xxx)
    INTERNAL_ERROR: 9001,
    DATABASE_ERROR: 9002,
    CACHE_ERROR: 9003,
    RATE_LIMIT_EXCEEDED: 9004,
  };
  
  /**
   * Success Messages
   */
  const SUCCESS_MESSAGES = {
    // General
    CREATED: 'Resource created successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully',
    FETCHED: 'Resource fetched successfully',
  
    // Auth
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    REGISTER_SUCCESS: 'Registration successful',
    PASSWORD_RESET: 'Password reset successful',
    EMAIL_VERIFIED: 'Email verified successfully',
  
    // Operations
    OPERATION_SUCCESS: 'Operation completed successfully',
    FILE_UPLOADED: 'File uploaded successfully',
    EMAIL_SENT: 'Email sent successfully',
    PAYMENT_SUCCESS: 'Payment completed successfully',
  };
  
  /**
   * Regex Patterns
   */
  const REGEX_PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_INDIA: /^[6-9]\d{9}$/,
    GST: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,
    URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
    STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    USERNAME: /^[a-zA-Z0-9_]{3,30}$/,
    SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  };
  
  /**
   * Pagination Defaults
   */
  const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MIN_LIMIT: 1,
  };
  
  /**
   * Cache Keys Prefix
   */
  const CACHE_KEYS = {
    USER: 'user:',
    DEAL: 'deal:',
    INVOICE: 'invoice:',
    RATE_CARD: 'rate_card:',
    PERFORMANCE: 'performance:',
    CONTRACT: 'contract:',
    ANALYTICS: 'analytics:',
    SESSION: 'session:',
    OTP: 'otp:',
    RATE_LIMIT: 'rate_limit:',
  };
  
  /**
   * Queue Names (for Bull/Agenda)
   */
  const QUEUE_NAMES = {
    EMAIL: 'email-queue',
    SMS: 'sms-queue',
    NOTIFICATION: 'notification-queue',
    PAYMENT_REMINDER: 'payment-reminder-queue',
    REPORT_GENERATION: 'report-generation-queue',
    FILE_PROCESSING: 'file-processing-queue',
    AI_PROCESSING: 'ai-processing-queue',
    WEBHOOK: 'webhook-queue',
  };
  
  /**
   * Time Constants (in milliseconds)
   */
  const TIME = {
    ONE_SECOND: 1000,
    ONE_MINUTE: 60 * 1000,
    FIVE_MINUTES: 5 * 60 * 1000,
    TEN_MINUTES: 10 * 60 * 1000,
    THIRTY_MINUTES: 30 * 60 * 1000,
    ONE_HOUR: 60 * 60 * 1000,
    ONE_DAY: 24 * 60 * 60 * 1000,
    ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
    ONE_MONTH: 30 * 24 * 60 * 60 * 1000,
  };
  
  /**
   * HTTP Status Codes
   */
  const HTTP_STATUS = {
    // Success
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
  
    // Redirection
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    NOT_MODIFIED: 304,
  
    // Client Error
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
  
    // Server Error
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
  };
  
  /**
   * Export all constants
   */
  module.exports = {
    USER_ROLES,
    ACCOUNT_TYPES,
    SUBSCRIPTION_PLANS,
    DEAL_STAGES,
    DEAL_PRIORITY,
    PLATFORMS,
    DELIVERABLE_TYPES,
    INVOICE_STATUS,
    PAYMENT_STATUS,
    PAYMENT_METHODS,
    PAYMENT_TERMS,
    CURRENCIES,
    TAX_TYPES,
    TAX_RATES,
    BRIEF_STATUS,
    CONTRACT_STATUS,
    CONTRACT_RISK_LEVELS,
    REPORT_STATUS,
    NOTIFICATION_TYPES,
    NOTIFICATION_PRIORITY,
    FILE_TYPES,
    ALLOWED_EXTENSIONS,
    MIME_TYPES,
    RATE_CARD_TEMPLATES,
    APPROVAL_STATUS,
    SLA_METRICS,
    ERROR_CODES,
    SUCCESS_MESSAGES,
    REGEX_PATTERNS,
    PAGINATION,
    CACHE_KEYS,
    QUEUE_NAMES,
    TIME,
    HTTP_STATUS,
  };