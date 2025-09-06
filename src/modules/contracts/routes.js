/**
 * CreatorsMantra Backend - Contract Upload & AI Review Module
 * Express.js routes for contract management and AI analysis
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 * 
 * File Path: src/modules/contracts/routes.js
 */

const express = require('express');
const contractController = require('./controller');
const { authenticateUser, authorizeSubscription } = require('../../shared/middleware');
const { logInfo, logError } = require('../../shared/utils');

const router = express.Router();

// ================================
// MIDDLEWARE SETUP
// ================================

// All contract routes require authentication
router.use(authenticateUser);

// Log all contract API calls
router.use((req, res, next) => {
  logInfo('Contract API call', {
    method: req.method,
    path: req.path,
    userId: req.user?.userId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// ================================
// SPECIFIC ROUTES (MUST COME FIRST!)
// ================================

/**
 * Get contract templates by category and platform
 * GET /api/contracts/templates
 * 
 * Access: All subscription tiers
 * 
 * Query Params:
 * - category (required): Template category (collaboration, sponsorship, licensing, etc.)
 * - platforms (optional): Comma-separated list of target platforms
 * 
 * Response: Creator-friendly contract templates with success rates
 * Database: Curated library of proven contract clauses
 */
router.get('/templates',
  contractController.getTemplates
);

/**
 * Get creator-friendly alternatives for specific clause types
 * GET /api/contracts/clause-alternatives/:clauseType
 * 
 * Access: Pro, Elite, Agency plans only
 * 
 * Path Params:
 * - clauseType: payment_terms, usage_rights, deliverables, exclusivity, etc.
 * 
 * Query Params:
 * - context (optional): JSON context for personalized suggestions
 * 
 * Response: Top 5 creator-friendly alternatives ranked by success rate
 * AI Logic: Context-aware clause recommendations
 */
router.get('/clause-alternatives/:clauseType',
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']),
  contractController.getClauseAlternatives
);

/**
 * Get comprehensive contract analytics for creator
 * GET /api/contracts/analytics
 * 
 * Access: All subscription tiers
 * 
 * Response: Contract risk trends, negotiation success rates, red flag patterns
 * Metrics: 
 * - Total contracts by status and risk level
 * - Average risk scores and negotiation outcomes
 * - Top red flags and successful negotiation patterns
 * - 30/90-day contract trends
 */
router.get('/analytics',
  contractController.getAnalytics
);

/**
 * Get contract module API documentation
 * GET /api/contracts/docs
 * 
 * Access: All authenticated users
 * Response: Complete API documentation for contract endpoints
 */
router.get('/docs', (req, res) => {
  const documentation = {
    module: 'Contract Upload & AI Review',
    version: '1.0.0',
    description: 'Comprehensive contract management with AI-powered analysis and negotiation support',
    
    endpoints: {
      upload: {
        method: 'POST',
        path: '/upload',
        access: 'All tiers',
        description: 'Upload contract file with metadata',
        fileSupport: ['PDF', 'DOC', 'DOCX', 'JPG', 'PNG'],
        maxFileSize: '25MB'
      },
      
      analyze: {
        method: 'POST', 
        path: '/:contractId/analyze',
        access: 'Pro+ only',
        description: 'AI-powered contract analysis with risk assessment'
      },
      
      retrieve: {
        method: 'GET',
        path: '/:contractId',
        access: 'All tiers',
        description: 'Get contract with full analysis details'
      },
      
      list: {
        method: 'GET',
        path: '/',
        access: 'All tiers', 
        description: 'List contracts with filtering and pagination'
      },
      
      negotiationPoints: {
        method: 'GET',
        path: '/:contractId/negotiation-points',
        access: 'Pro+ only',
        description: 'AI-generated negotiation recommendations'
      },
      
      negotiationEmail: {
        method: 'POST',
        path: '/:contractId/negotiation-email', 
        access: 'Pro+ only',
        description: 'Generate professional negotiation email templates'
      },
      
      saveNegotiation: {
        method: 'POST',
        path: '/:contractId/negotiations',
        access: 'All tiers',
        description: 'Save negotiation history and outcomes'
      },
      
      negotiationHistory: {
        method: 'GET',
        path: '/:contractId/negotiations',
        access: 'All tiers',
        description: 'Get complete negotiation timeline'
      },
      
      templates: {
        method: 'GET',
        path: '/templates',
        access: 'All tiers',
        description: 'Creator-friendly contract templates'
      },
      
      clauseAlternatives: {
        method: 'GET',
        path: '/clause-alternatives/:clauseType',
        access: 'Pro+ only', 
        description: 'Get creator-friendly clause alternatives'
      },
      
      analytics: {
        method: 'GET',
        path: '/analytics',
        access: 'All tiers',
        description: 'Contract risk and negotiation analytics'
      },
      
      convertToDeal: {
        method: 'POST',
        path: '/:contractId/convert-to-deal',
        access: 'All tiers',
        description: 'Convert contract to deal in CRM pipeline'
      },
      
      updateStatus: {
        method: 'PATCH',
        path: '/:contractId/status',
        access: 'All tiers',
        description: 'Update contract status manually'
      },
      
      delete: {
        method: 'DELETE',
        path: '/:contractId', 
        access: 'All tiers',
        description: 'Soft delete contract with recovery option'
      }
    },
    
    subscriptionFeatures: {
      starter: ['Upload contracts', 'Basic status tracking', 'Manual status updates'],
      pro: ['All Starter features', 'AI contract analysis', 'Negotiation assistance', 'Email templates'],
      elite: ['All Pro features', 'Advanced analytics', 'Unlimited contracts'],
      agency: ['All Elite features', 'Multi-creator support', 'Team management']
    },
    
    aiFeatures: {
      contractAnalysis: 'Comprehensive 7-point clause analysis with risk scoring',
      riskAssessment: '0-100 risk score based on creator-unfriendly terms',
      negotiationPoints: 'AI identifies and prioritizes negotiable clauses',
      emailGeneration: 'Professional email templates with tone customization',
      clauseAlternatives: 'Creator-friendly alternative clauses with success rates'
    }
  };

  res.json({
    success: true,
    message: 'Contract module documentation retrieved',
    data: { documentation },
    timestamp: new Date().toISOString(),
    code: 200
  });
});

// ================================
// LIST CONTRACTS (BEFORE PARAMETERIZED ROUTES)
// ================================

/**
 * List creator's contracts with filtering and pagination
 * GET /api/contracts
 * 
 * Access: All subscription tiers
 * 
 * Query Params:
 * - status (optional): Filter by contract status
 * - brandName (optional): Filter by brand name (partial match)
 * - riskLevel (optional): Filter by AI risk level
 * - limit (optional): Results per page (default: 50, max: 100)
 * - page (optional): Page number (default: 1)
 * - sortBy (optional): Sort field (default: createdAt)
 * - sortOrder (optional): asc/desc (default: desc)
 * 
 * Response: Paginated contract list with summary data
 */
router.get('/',
  contractController.listContracts
);

// ================================
// CONTRACT UPLOAD & CREATION ROUTES
// ================================

/**
 * Upload new contract file with metadata
 * POST /api/contracts/upload
 * 
 * Access: All subscription tiers
 * File: Single contract file (PDF, DOC, DOCX, JPG, PNG)
 * Size Limit: 25MB
 * 
 * Body Fields:
 * - brandName (required): Brand/company name
 * - brandEmail (optional): Brand contact email
 * - contractValue (optional): Contract value in INR
 * - platforms (optional): Array or comma-separated platforms
 * - tags (optional): Array or comma-separated tags
 * - notes (optional): Additional notes
 * 
 * Response: Contract object with upload confirmation
 * Background: AI analysis starts automatically for Pro+ users
 */
router.post('/upload',
  contractController.upload, // Multer file upload middleware
  contractController.uploadContract
);

// ================================
// PARAMETERIZED ROUTES (MUST COME AFTER SPECIFIC ROUTES!)
// ================================

/**
 * Trigger manual AI analysis for uploaded contract
 * POST /api/contracts/:contractId/analyze
 * 
 * Access: Pro, Elite, Agency plans only
 * 
 * Path Params:
 * - contractId: MongoDB ObjectId of the contract
 * 
 * Response: AI analysis results with risk assessment
 * Processing: Full OpenAI GPT-4 contract analysis
 */
router.post('/:contractId/analyze',
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']),
  contractController.analyzeContract
);

/**
 * Generate AI-powered negotiation points for contract
 * GET /api/contracts/:contractId/negotiation-points
 * 
 * Access: Pro, Elite, Agency plans only
 * Prerequisite: Contract must be analyzed first
 * 
 * Path Params:
 * - contractId: MongoDB ObjectId of the contract
 * 
 * Response: Prioritized list of negotiation points with recommendations
 * AI Logic: Identifies risky clauses and suggests creator-friendly alternatives
 */
router.get('/:contractId/negotiation-points',
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']),
  contractController.getNegotiationPoints
);

/**
 * Generate professional negotiation email template
 * POST /api/contracts/:contractId/negotiation-email
 * 
 * Access: Pro, Elite, Agency plans only
 * 
 * Path Params:
 * - contractId: MongoDB ObjectId of the contract
 * 
 * Body Fields:
 * - negotiationPoints (required): Array of points to negotiate
 * - tone (optional): 'professional', 'friendly', or 'assertive' (default: professional)
 * 
 * Response: Ready-to-send email template with subject and body
 * AI Logic: Crafts persuasive, professional negotiation emails
 */
router.post('/:contractId/negotiation-email',
  authorizeSubscription(['pro', 'elite', 'agency_starter', 'agency_pro']),
  contractController.generateNegotiationEmail
);

/**
 * Save negotiation attempt and email template
 * POST /api/contracts/:contractId/negotiations
 * 
 * Access: All subscription tiers
 * 
 * Path Params:
 * - contractId: MongoDB ObjectId of the contract
 * 
 * Body Fields:
 * - negotiationPoints (required): Points being negotiated
 * - emailTemplate (required): Generated email template
 * - emailSent (optional): Whether email was sent (default: false)
 * 
 * Response: Saved negotiation record with round number
 * Tracking: Maintains complete negotiation history
 */
router.post('/:contractId/negotiations',
  contractController.saveNegotiation
);

/**
 * Get complete negotiation history for contract
 * GET /api/contracts/:contractId/negotiations
 * 
 * Access: All subscription tiers (own contracts only)
 * 
 * Path Params:
 * - contractId: MongoDB ObjectId of the contract
 * 
 * Response: Chronological list of all negotiation rounds
 * Data: Email templates, brand responses, outcomes
 */
router.get('/:contractId/negotiations',
  contractController.getNegotiationHistory
);

/**
 * Convert analyzed contract to deal in CRM pipeline
 * POST /api/contracts/:contractId/convert-to-deal
 * 
 * Access: All subscription tiers
 * Prerequisite: Contract should be analyzed for best results
 * 
 * Path Params:
 * - contractId: MongoDB ObjectId of the contract
 * 
 * Body Fields:
 * - Additional deal data (optional): Override extracted deal information
 * 
 * Response: Created deal object with contract linkage
 * Integration: Seamless workflow from contract analysis to deal management
 */
router.post('/:contractId/convert-to-deal',
  contractController.convertToDeal
);

/**
 * Update contract status and add notes
 * PATCH /api/contracts/:contractId/status
 * 
 * Access: All subscription tiers (own contracts only)
 * 
 * Path Params:
 * - contractId: MongoDB ObjectId of the contract
 * 
 * Body Fields:
 * - status (required): New status (uploaded, analyzing, analyzed, under_negotiation, finalized, signed, rejected)
 * - notes (optional): Status update notes
 * 
 * Response: Updated contract with new status
 * Workflow: Manual status management for contract lifecycle
 */
router.patch('/:contractId/status',
  contractController.updateContractStatus
);

/**
 * Delete contract (soft delete with recovery option)
 * DELETE /api/contracts/:contractId
 * 
 * Access: All subscription tiers (own contracts only)
 * 
 * Path Params:
 * - contractId: MongoDB ObjectId of the contract
 * 
 * Response: Deletion confirmation with timestamp
 * Behavior: Soft delete preserves data for potential recovery
 * Cascade: Also soft-deletes related analysis and negotiation history
 */
router.delete('/:contractId',
  contractController.deleteContract
);

/**
 * Get single contract with full analysis details
 * GET /api/contracts/:contractId
 * 
 * Access: All subscription tiers (own contracts only)
 * 
 * Path Params:
 * - contractId: MongoDB ObjectId of the contract
 * 
 * Response: Complete contract data with AI analysis if available
 * Authorization: Creator ownership verification
 * 
 * NOTE: This route MUST be last among parameterized routes to avoid conflicts!
 */
router.get('/:contractId',
  contractController.getContract
);

// ================================
// ERROR HANDLING MIDDLEWARE
// ================================

/**
 * Contract-specific error handler
 * Catches and formats errors from contract operations
 */
router.use((error, req, res, next) => {
  logError('Contract route error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    contractId: req.params?.contractId
  });

  // Handle specific contract errors
  if (error.message.includes('File size exceeds')) {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum size allowed is 25MB.',
      code: 413,
      timestamp: new Date().toISOString()
    });
  }

  if (error.message.includes('Unsupported file type')) {
    return res.status(415).json({
      success: false,
      message: 'Unsupported file format. Please upload PDF, DOC, DOCX, JPG, or PNG files only.',
      code: 415,
      timestamp: new Date().toISOString()
    });
  }

  if (error.message.includes('Contract not found')) {
    return res.status(404).json({
      success: false,
      message: 'Contract not found or access denied.',
      code: 404,
      timestamp: new Date().toISOString()
    });
  }

  if (error.message.includes('AI analysis')) {
    return res.status(503).json({
      success: false,
      message: 'AI analysis service temporarily unavailable. Please try again later.',
      code: 503,
      timestamp: new Date().toISOString()
    });
  }

  if (error.message.includes('subscription') || error.message.includes('tier')) {
    return res.status(403).json({
      success: false,
      message: 'This feature requires a higher subscription tier. Please upgrade your plan.',
      code: 403,
      timestamp: new Date().toISOString()
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred while processing your contract.',
    code: 500,
    timestamp: new Date().toISOString()
  });
});

// ================================
// MODULE EXPORTS
// ================================
module.exports = router;

// ================================
// ROUTE REGISTRATION LOG
// ================================
logInfo('Contract routes initialized', {
  totalRoutes: 14,
  publicRoutes: 1, // docs endpoint
  authRoutes: 13,
  proOnlyRoutes: 4, // analyze, negotiation-points, negotiation-email, clause-alternatives
  fileUploadRoutes: 1, // upload
  integrationRoutes: 1, // convert-to-deal
  analyticsRoutes: 1, // analytics
  
  routesByMethod: {
    GET: 6, // get contract, list, negotiation-points, negotiations, templates, clause-alternatives, analytics, docs
    POST: 5, // upload, analyze, negotiation-email, save-negotiation, convert-to-deal  
    PATCH: 1, // update status
    DELETE: 1 // delete contract
  },
  
  subscriptionGating: {
    allTiers: 10,
    proPlus: 4
  },
  
  timestamp: new Date().toISOString()
});