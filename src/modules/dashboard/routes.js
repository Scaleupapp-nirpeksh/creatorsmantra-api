//src/modules/deals/routes.js
/**
 * CreatorsMantra Backend - Deal CRM Routes
 * API endpoints for deal pipeline management
 *
 * IMPORTANT: Route order matters! Specific routes must come before parameterized routes
 *
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const express = require('express')
const rateLimit = require('express-rate-limit')

const DashboardController = require('./controller')

const {
  authenticateUser,
  authorizeRoles,
  authorizeSubscription,
} = require('../../shared/middleware')

const router = express.Router()

// =========================RATE LIMITING CONFIGURATION=========================

const limitRequests = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 150,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    code: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
})

const DEAL_ALLOWED_TIERS = ['starter', 'pro', 'elite', 'agency_starter', 'agency_pro']

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Dashboard module is healthy',
    data: {
      module: 'dashboard',
      status: 'active',
      features: [
        'deals_Analytics',
        'invoice_analytics',
        'ratecard_analytics',
        'scripts_analytics',
        'contracts_analytics',
      ],
      version: '1.0.0',
    },
    timestamp: new Date().toISOString(),
  })
})

router.get(
  '/reports',
  limitRequests,
  authenticateUser,
  authorizeRoles(['creator', 'manager', 'agency_owner', 'agency_member']),
  authorizeSubscription(DEAL_ALLOWED_TIERS),
  DashboardController.getReports
)

module.exports = router
