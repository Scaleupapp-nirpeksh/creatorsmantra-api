/**
 * Role-Based Access Control (RBAC) Middleware
 * @module middlewares/rbac
 * @description Permission-based access control for agencies, creators, and managers
 * 
 * File Path: src/middlewares/rbac.middleware.js
 * 
 * Features:
 * - Permission-based authorization (not hierarchical)
 * - Agency-Creator relationship validation
 * - Creator-Manager relationship validation
 * - Resource ownership verification
 * - Dynamic permission loading
 * - Context-aware access control
 * - Audit logging for access decisions
 */

const logger = require('../config/logger');
const ResponseUtil = require('../utils/response.util');
const redisClient = require('../config/redis');
const { USER_ROLES, ACCOUNT_TYPES, ERROR_CODES } = require('../config/constants');

/**
 * RBAC Configuration
 */
const RBAC_CONFIG = {
  // Cache settings
  permissionCachePrefix: 'rbac:permissions:',
  relationshipCachePrefix: 'rbac:relationship:',
  cacheTTL: 300, // 5 minutes
  
  // Audit settings
  auditAccessDenied: true,
  auditAccessGranted: false, // Set to true for debugging
  
  // Resource types
  resourceTypes: {
    DEAL: 'deal',
    INVOICE: 'invoice',
    PAYMENT: 'payment',
    BRIEF: 'brief',
    CONTRACT: 'contract',
    PERFORMANCE: 'performance',
    RATE_CARD: 'rate_card',
    CREATOR: 'creator',
    AGENCY: 'agency',
    USER: 'user',
  },
};

/**
 * Permission Matrix
 * Defines what each role can do with each resource
 */
const PERMISSIONS = {
  // Platform Admin - Full access
  [USER_ROLES.ADMIN]: {
    '*': ['*'], // All resources, all actions
  },
  
  // Agency Owner - Full agency access
  [USER_ROLES.AGENCY_OWNER]: {
    deal: ['create', 'read', 'update', 'delete', 'approve'],
    invoice: ['create', 'read', 'update', 'delete', 'send'],
    payment: ['create', 'read', 'update', 'track'],
    brief: ['create', 'read', 'update', 'delete', 'analyze'],
    contract: ['create', 'read', 'update', 'delete', 'review'],
    performance: ['create', 'read', 'update', 'delete', 'generate'],
    rate_card: ['create', 'read', 'update', 'delete', 'publish'],
    creator: ['create', 'read', 'update', 'delete', 'assign'],
    agency: ['read', 'update', 'manage_team', 'billing', 'settings'],
    user: ['invite', 'remove', 'update_role'],
  },
  
  // Agency Member - Operational access
  [USER_ROLES.AGENCY_MEMBER]: {
    deal: ['create', 'read', 'update'],
    invoice: ['create', 'read', 'update', 'send'],
    payment: ['read', 'track'],
    brief: ['create', 'read', 'update', 'analyze'],
    contract: ['read', 'review'],
    performance: ['create', 'read', 'update', 'generate'],
    rate_card: ['create', 'read', 'update'],
    creator: ['read', 'update'], // Only assigned creators
    agency: ['read'],
    user: [],
  },
  
  // Creator - Self management
  [USER_ROLES.CREATOR]: {
    deal: ['create', 'read', 'update', 'delete'],
    invoice: ['create', 'read', 'update', 'delete', 'send'],
    payment: ['create', 'read', 'update', 'track'],
    brief: ['create', 'read', 'update', 'delete', 'analyze'],
    contract: ['create', 'read', 'update', 'delete', 'review'],
    performance: ['create', 'read', 'update', 'delete', 'generate'],
    rate_card: ['create', 'read', 'update', 'delete', 'publish'],
    creator: ['read', 'update'], // Own profile only
    agency: [], // No agency access
    user: ['update'], // Own profile only
  },
  
  // Manager - Manages specific creator(s)
  [USER_ROLES.MANAGER]: {
    deal: ['create', 'read', 'update', 'delete'],
    invoice: ['create', 'read', 'update', 'send'],
    payment: ['create', 'read', 'update', 'track'],
    brief: ['create', 'read', 'update', 'analyze'],
    contract: ['read', 'review'],
    performance: ['create', 'read', 'update', 'generate'],
    rate_card: ['create', 'read', 'update', 'publish'],
    creator: ['read', 'update'], // Only managed creator
    agency: [],
    user: [],
  },
};

/**
 * Special Permissions
 * Context-specific permissions that override the matrix
 */
const SPECIAL_PERMISSIONS = {
  // Creators can always access their own resources
  ownResource: {
    deal: ['read', 'update', 'delete'],
    invoice: ['read', 'update', 'delete'],
    payment: ['read'],
    brief: ['read', 'update', 'delete'],
    contract: ['read', 'update'],
    performance: ['read', 'update', 'delete'],
    rate_card: ['read', 'update', 'delete'],
  },
  
  // Agency members can access assigned creators' resources
  assignedCreator: {
    deal: ['create', 'read', 'update'],
    invoice: ['create', 'read', 'update'],
    brief: ['create', 'read', 'update'],
    performance: ['create', 'read', 'update'],
    rate_card: ['read', 'update'],
  },
};

/**
 * Main RBAC Middleware Factory
 * Creates a middleware that checks permissions for a resource and action
 * 
 * @param {string} resource - Resource type
 * @param {string} action - Action to perform
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
function requirePermission(resource, action, options = {}) {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        logger.warn('RBAC check without authentication', {
          resource,
          action,
          path: req.path,
        });
        return ResponseUtil.unauthorized(res, 'Authentication required');
      }
      
      const user = req.user;
      const userId = user.id || user._id;
      const userRole = user.role;
      
      // Check for platform admin (bypass all checks)
      if (userRole === USER_ROLES.ADMIN) {
        logger.debug('Admin access granted', {
          userId,
          resource,
          action,
        });
        return next();
      }
      
      // Get resource ID from request
      const resourceId = extractResourceId(req, options);
      
      // Check permission
      const hasPermission = await checkPermission({
        userId,
        userRole,
        resource,
        action,
        resourceId,
        user,
        req,
        options,
      });
      
      if (!hasPermission) {
        // Audit denied access
        if (RBAC_CONFIG.auditAccessDenied) {
          await auditAccess({
            userId,
            userRole,
            resource,
            action,
            resourceId,
            granted: false,
            reason: 'Permission denied',
            path: req.path,
            method: req.method,
          });
        }
        
        logger.warn('Access denied', {
          userId,
          userRole,
          resource,
          action,
          resourceId,
          path: req.path,
        });
        
        return ResponseUtil.forbidden(res, 'You do not have permission to perform this action');
      }
      
      // Audit granted access (optional)
      if (RBAC_CONFIG.auditAccessGranted) {
        await auditAccess({
          userId,
          userRole,
          resource,
          action,
          resourceId,
          granted: true,
          path: req.path,
          method: req.method,
        });
      }
      
      // Add permission context to request
      req.rbac = {
        resource,
        action,
        resourceId,
        userRole,
        granted: true,
        timestamp: new Date().toISOString(),
      };
      
      next();
    } catch (error) {
      logger.error('RBAC middleware error', {
        error: error.message,
        resource,
        action,
        userId: req.user?.id,
      });
      
      return ResponseUtil.serverError(res, error);
    }
  };
}

/**
 * Check Permission
 * Core permission checking logic
 * 
 * @param {Object} params - Permission check parameters
 * @returns {Promise<boolean>} Has permission
 */
async function checkPermission(params) {
  const { userId, userRole, resource, action, resourceId, user, req, options } = params;
  
  try {
    // 1. Check role-based permissions
    const rolePermissions = PERMISSIONS[userRole];
    
    if (!rolePermissions) {
      logger.warn('Unknown role', { userRole, userId });
      return false;
    }
    
    // Check wildcard permissions
    if (rolePermissions['*'] && rolePermissions['*'].includes('*')) {
      return true;
    }
    
    // Check resource permissions
    const resourcePermissions = rolePermissions[resource];
    
    if (resourcePermissions && 
        (resourcePermissions.includes(action) || resourcePermissions.includes('*'))) {
      
      // For agency members, check if they have access to the specific creator
      if (userRole === USER_ROLES.AGENCY_MEMBER && resourceId) {
        return await checkAgencyMemberAccess(userId, resourceId, resource, user);
      }
      
      // For new resource creation (no resourceId), permission granted based on role
      if (!resourceId) {
        return true;
      }
      
      // For existing resources, check ownership or relationship
      return await checkResourceAccess(userId, userRole, resource, resourceId, user);
    }
    
    // 2. Check ownership for special permissions
    if (resourceId && options.checkOwnership !== false) {
      const isOwner = await checkResourceOwnership(userId, resource, resourceId);
      
      if (isOwner) {
        const ownPermissions = SPECIAL_PERMISSIONS.ownResource[resource];
        if (ownPermissions && ownPermissions.includes(action)) {
          return true;
        }
      }
    }
    
    // 3. Check relationships
    if (user.accountType === ACCOUNT_TYPES.AGENCY) {
      return await checkAgencyAccess(user, resource, resourceId, action);
    }
    
    // 4. Check manager relationships
    if (userRole === USER_ROLES.MANAGER) {
      return await checkManagerAccess(userId, resource, resourceId, action);
    }
    
    // 5. Check creator self-access
    if (userRole === USER_ROLES.CREATOR) {
      return await checkCreatorSelfAccess(userId, resource, resourceId, action);
    }
    
    return false;
  } catch (error) {
    logger.error('Permission check error', {
      error: error.message,
      userId,
      resource,
      action,
    });
    return false;
  }
}

/**
 * Check Resource Ownership
 * Verifies if user owns the resource
 * 
 * @param {string} userId - User ID
 * @param {string} resource - Resource type
 * @param {string} resourceId - Resource ID
 * @returns {Promise<boolean>} Is owner
 */
async function checkResourceOwnership(userId, resource, resourceId) {
  try {
    // Check cache first
    const cacheKey = `${RBAC_CONFIG.relationshipCachePrefix}owner:${userId}:${resource}:${resourceId}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached !== null) {
      return cached === true || cached === 'true';
    }
    
    let isOwner = false;
    
    // Import models dynamically when needed
    try {
      switch (resource) {
        case RBAC_CONFIG.resourceTypes.DEAL: {
          const Deal = require('../models/Deal.model');
          const deal = await Deal.findById(resourceId).select('createdBy userId').lean();
          isOwner = deal && (
            deal.createdBy?.toString() === userId || 
            deal.userId?.toString() === userId
          );
          break;
        }
        
        case RBAC_CONFIG.resourceTypes.INVOICE: {
          const Invoice = require('../models/Invoice.model');
          const invoice = await Invoice.findById(resourceId).select('createdBy userId').lean();
          isOwner = invoice && (
            invoice.createdBy?.toString() === userId ||
            invoice.userId?.toString() === userId
          );
          break;
        }
        
        case RBAC_CONFIG.resourceTypes.PAYMENT: {
          const Payment = require('../models/Payment.model');
          const payment = await Payment.findById(resourceId).select('userId invoiceId').lean();
          if (payment) {
            if (payment.userId?.toString() === userId) {
              isOwner = true;
            } else if (payment.invoiceId) {
              // Check if user owns the related invoice
              const Invoice = require('../models/Invoice.model');
              const invoice = await Invoice.findById(payment.invoiceId).select('userId').lean();
              isOwner = invoice && invoice.userId?.toString() === userId;
            }
          }
          break;
        }
        
        case RBAC_CONFIG.resourceTypes.RATE_CARD: {
          const RateCard = require('../models/RateCard.model');
          const rateCard = await RateCard.findById(resourceId).select('creatorId userId').lean();
          isOwner = rateCard && (
            rateCard.creatorId?.toString() === userId ||
            rateCard.userId?.toString() === userId
          );
          break;
        }
        
        case RBAC_CONFIG.resourceTypes.BRIEF: {
          const Brief = require('../models/Brief.model');
          const brief = await Brief.findById(resourceId).select('userId dealId').lean();
          if (brief) {
            if (brief.userId?.toString() === userId) {
              isOwner = true;
            } else if (brief.dealId) {
              // Check if user owns the related deal
              const Deal = require('../models/Deal.model');
              const deal = await Deal.findById(brief.dealId).select('userId').lean();
              isOwner = deal && deal.userId?.toString() === userId;
            }
          }
          break;
        }
        
        case RBAC_CONFIG.resourceTypes.CONTRACT: {
          const Contract = require('../models/Contract.model');
          const contract = await Contract.findById(resourceId).select('userId dealId').lean();
          if (contract) {
            if (contract.userId?.toString() === userId) {
              isOwner = true;
            } else if (contract.dealId) {
              const Deal = require('../models/Deal.model');
              const deal = await Deal.findById(contract.dealId).select('userId').lean();
              isOwner = deal && deal.userId?.toString() === userId;
            }
          }
          break;
        }
        
        case RBAC_CONFIG.resourceTypes.PERFORMANCE: {
          const Performance = require('../models/Performance.model');
          const performance = await Performance.findById(resourceId).select('userId dealId').lean();
          if (performance) {
            if (performance.userId?.toString() === userId) {
              isOwner = true;
            } else if (performance.dealId) {
              const Deal = require('../models/Deal.model');
              const deal = await Deal.findById(performance.dealId).select('userId').lean();
              isOwner = deal && deal.userId?.toString() === userId;
            }
          }
          break;
        }
        
        default:
          isOwner = false;
      }
    } catch (modelError) {
      // Model not yet implemented
      logger.debug('Model not implemented for ownership check', {
        resource,
        error: modelError.message,
      });
      isOwner = false;
    }
    
    // Cache the result
    await redisClient.set(cacheKey, isOwner, RBAC_CONFIG.cacheTTL);
    
    return isOwner;
  } catch (error) {
    logger.error('Ownership check error', {
      error: error.message,
      userId,
      resource,
      resourceId,
    });
    return false;
  }
}

/**
 * Check Resource Access
 * Generic resource access check
 * 
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @param {string} resource - Resource type
 * @param {string} resourceId - Resource ID
 * @param {Object} user - User object
 * @returns {Promise<boolean>} Has access
 */
async function checkResourceAccess(userId, userRole, resource, resourceId, user) {
  try {
    // For agency members/owners with agencyId
    if (user.agencyId && (userRole === USER_ROLES.AGENCY_OWNER || userRole === USER_ROLES.AGENCY_MEMBER)) {
      const Agency = require('../models/Agency.model');
      const Creator = require('../models/Creator.model');
      
      // Get the resource to check its ownership
      const resourceModel = getResourceModel(resource);
      if (!resourceModel) return false;
      
      const resourceDoc = await resourceModel.findById(resourceId).select('userId creatorId').lean();
      if (!resourceDoc) return false;
      
      const resourceUserId = resourceDoc.userId || resourceDoc.creatorId;
      if (!resourceUserId) return false;
      
      // Check if the resource owner is a creator under this agency
      const creator = await Creator.findOne({
        userId: resourceUserId,
        agencyId: user.agencyId,
      }).lean();
      
      if (creator) {
        // For agency members, check if they're assigned to this creator
        if (userRole === USER_ROLES.AGENCY_MEMBER) {
          const agency = await Agency.findById(user.agencyId)
            .select('memberAssignments')
            .lean();
          
          if (agency?.memberAssignments) {
            const assignment = agency.memberAssignments.find(
              a => a.memberId?.toString() === userId && 
                   a.creatorIds?.includes(creator._id.toString())
            );
            return !!assignment;
          }
        }
        // Agency owner has access to all agency creators
        return userRole === USER_ROLES.AGENCY_OWNER;
      }
    }
    
    return false;
  } catch (error) {
    logger.error('Resource access check error', {
      error: error.message,
      userId,
      resource,
      resourceId,
    });
    return false;
  }
}

/**
 * Get Resource Model
 * Returns the appropriate Mongoose model for a resource type
 * 
 * @param {string} resource - Resource type
 * @returns {Object|null} Mongoose model
 */
function getResourceModel(resource) {
  try {
    switch (resource) {
      case RBAC_CONFIG.resourceTypes.DEAL:
        return require('../models/Deal.model');
      case RBAC_CONFIG.resourceTypes.INVOICE:
        return require('../models/Invoice.model');
      case RBAC_CONFIG.resourceTypes.PAYMENT:
        return require('../models/Payment.model');
      case RBAC_CONFIG.resourceTypes.BRIEF:
        return require('../models/Brief.model');
      case RBAC_CONFIG.resourceTypes.CONTRACT:
        return require('../models/Contract.model');
      case RBAC_CONFIG.resourceTypes.PERFORMANCE:
        return require('../models/Performance.model');
      case RBAC_CONFIG.resourceTypes.RATE_CARD:
        return require('../models/RateCard.model');
      default:
        return null;
    }
  } catch (error) {
    logger.debug('Model not found for resource', { resource });
    return null;
  }
}

/**
 * Check Agency Access
 * Verifies agency's access to resources
 * 
 * @param {Object} user - User object
 * @param {string} resource - Resource type
 * @param {string} resourceId - Resource ID
 * @param {string} action - Action to perform
 * @returns {Promise<boolean>} Has access
 */
async function checkAgencyAccess(user, resource, resourceId, action) {
  try {
    if (!user.agencyId) {
      return false;
    }
    
    // Agency owner has full access to agency resources
    if (user.role === USER_ROLES.AGENCY_OWNER) {
      // Verify the resource belongs to a creator under this agency
      return await checkResourceBelongsToAgency(user.agencyId, resource, resourceId);
    }
    
    // Agency member - check if resource belongs to assigned creator
    if (user.role === USER_ROLES.AGENCY_MEMBER && resourceId) {
      const cacheKey = `${RBAC_CONFIG.relationshipCachePrefix}agency:${user.agencyId}:${resource}:${resourceId}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached !== null) {
        return cached === true || cached === 'true';
      }
      
      const belongsToAgency = await checkResourceBelongsToAgency(user.agencyId, resource, resourceId);
      
      // Cache the result
      await redisClient.set(cacheKey, belongsToAgency, RBAC_CONFIG.cacheTTL);
      
      return belongsToAgency;
    }
    
    return false;
  } catch (error) {
    logger.error('Agency access check error', {
      error: error.message,
      agencyId: user.agencyId,
      resource,
      resourceId,
    });
    return false;
  }
}

/**
 * Check if Resource Belongs to Agency
 * 
 * @param {string} agencyId - Agency ID
 * @param {string} resource - Resource type
 * @param {string} resourceId - Resource ID
 * @returns {Promise<boolean>} Belongs to agency
 */
async function checkResourceBelongsToAgency(agencyId, resource, resourceId) {
  try {
    const Creator = require('../models/Creator.model');
    const resourceModel = getResourceModel(resource);
    
    if (!resourceModel) return false;
    
    const resourceDoc = await resourceModel.findById(resourceId).select('userId creatorId').lean();
    if (!resourceDoc) return false;
    
    const resourceUserId = resourceDoc.userId || resourceDoc.creatorId;
    if (!resourceUserId) return false;
    
    // Check if the user is a creator under this agency
    const creator = await Creator.findOne({
      userId: resourceUserId,
      agencyId: agencyId,
    }).lean();
    
    return !!creator;
  } catch (error) {
    logger.error('Agency resource check error', {
      error: error.message,
      agencyId,
      resource,
      resourceId,
    });
    return false;
  }
}

/**
 * Check Agency Member Access
 * Verifies if agency member has access to specific creator's resources
 * 
 * @param {string} memberId - Agency member ID
 * @param {string} resourceId - Resource ID
 * @param {string} resource - Resource type
 * @param {Object} user - User object
 * @returns {Promise<boolean>} Has access
 */
async function checkAgencyMemberAccess(memberId, resourceId, resource, user) {
  try {
    if (!user.agencyId) return false;
    
    // Check if member is assigned to the creator who owns this resource
    const cacheKey = `${RBAC_CONFIG.relationshipCachePrefix}member:${memberId}:resource:${resourceId}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached !== null) {
      return cached === true || cached === 'true';
    }
    
    const Agency = require('../models/Agency.model');
    const agency = await Agency.findById(user.agencyId)
      .select('memberAssignments')
      .lean();
    
    if (!agency?.memberAssignments) return false;
    
    // Find member's assignment
    const assignment = agency.memberAssignments.find(
      a => a.memberId?.toString() === memberId
    );
    
    if (!assignment?.creatorIds?.length) return false;
    
    // Check if resource belongs to one of assigned creators
    const resourceModel = getResourceModel(resource);
    if (!resourceModel) return false;
    
    const resourceDoc = await resourceModel.findById(resourceId).select('userId creatorId').lean();
    if (!resourceDoc) return false;
    
    const resourceUserId = resourceDoc.userId || resourceDoc.creatorId;
    
    const Creator = require('../models/Creator.model');
    const creator = await Creator.findOne({
      userId: resourceUserId,
      _id: { $in: assignment.creatorIds },
    }).lean();
    
    const isAssigned = !!creator;
    
    // Cache the result
    await redisClient.set(cacheKey, isAssigned, RBAC_CONFIG.cacheTTL);
    
    return isAssigned;
  } catch (error) {
    logger.error('Agency member access check error', {
      error: error.message,
      memberId,
      resourceId,
    });
    return false;
  }
}

/**
 * Check Manager Access
 * Verifies manager's access to creator resources
 * 
 * @param {string} managerId - Manager ID
 * @param {string} resource - Resource type
 * @param {string} resourceId - Resource ID
 * @param {string} action - Action to perform
 * @returns {Promise<boolean>} Has access
 */
async function checkManagerAccess(managerId, resource, resourceId, action) {
  try {
    // Check if manager manages the creator who owns this resource
    const cacheKey = `${RBAC_CONFIG.relationshipCachePrefix}manager:${managerId}:${resource}:${resourceId}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached !== null) {
      return cached === true || cached === 'true';
    }
    
    const Creator = require('../models/Creator.model');
    const resourceModel = getResourceModel(resource);
    
    if (!resourceModel) return false;
    
    const resourceDoc = await resourceModel.findById(resourceId).select('userId creatorId').lean();
    if (!resourceDoc) return false;
    
    const resourceUserId = resourceDoc.userId || resourceDoc.creatorId;
    
    // Check if manager manages this creator
    const creator = await Creator.findOne({
      userId: resourceUserId,
      managerId: managerId,
    }).lean();
    
    const manages = !!creator;
    
    // Cache the result
    await redisClient.set(cacheKey, manages, RBAC_CONFIG.cacheTTL);
    
    return manages;
  } catch (error) {
    logger.error('Manager access check error', {
      error: error.message,
      managerId,
      resource,
      resourceId,
    });
    return false;
  }
}

/**
 * Check Creator Self Access
 * Verifies creator's access to their own resources
 * 
 * @param {string} creatorId - Creator ID
 * @param {string} resource - Resource type
 * @param {string} resourceId - Resource ID
 * @param {string} action - Action to perform
 * @returns {Promise<boolean>} Has access
 */
async function checkCreatorSelfAccess(creatorId, resource, resourceId, action) {
  try {
    // Creators can always create new resources
    if (!resourceId) {
      return true;
    }
    
    // For existing resources, check ownership
    return await checkResourceOwnership(creatorId, resource, resourceId);
  } catch (error) {
    logger.error('Creator self access check error', {
      error: error.message,
      creatorId,
      resource,
      resourceId,
    });
    return false;
  }
}

/**
 * Extract Resource ID from Request
 * Gets the resource ID from various request locations
 * 
 * @param {Object} req - Express request object
 * @param {Object} options - Options
 * @returns {string|null} Resource ID
 */
function extractResourceId(req, options = {}) {
  // Priority order: options > params > body > query
  return options.resourceId || 
         req.params.id || 
         req.params.resourceId ||
         req.params[`${options.resourceName}Id`] ||
         req.body.resourceId ||
         req.body.id ||
         req.query.resourceId ||
         req.query.id ||
         null;
}

/**
 * Audit Access
 * Logs access decisions for compliance and debugging
 * 
 * @param {Object} auditData - Audit data
 */
async function auditAccess(auditData) {
  try {
    const auditEntry = {
      ...auditData,
      timestamp: new Date().toISOString(),
    };
    
    // Log to file/database
    if (auditData.granted) {
      logger.info('Access granted', auditEntry);
    } else {
      logger.warn('Access denied', auditEntry);
    }
    
    // Store in Redis for recent access history
    const auditKey = `rbac:audit:${auditData.userId}:${Date.now()}`;
    await redisClient.set(auditKey, auditEntry, 86400); // 24 hours
  } catch (error) {
    logger.error('Audit logging error', {
      error: error.message,
      auditData,
    });
  }
}

/**
 * Require Any Permission
 * Checks if user has at least one of the specified permissions
 * 
 * @param {Array} permissions - Array of {resource, action} objects
 * @returns {Function} Express middleware
 */
function requireAnyPermission(permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return ResponseUtil.unauthorized(res, 'Authentication required');
      }
      
      for (const { resource, action } of permissions) {
        const hasPermission = await checkPermission({
          userId: req.user.id || req.user._id,
          userRole: req.user.role,
          resource,
          action,
          resourceId: extractResourceId(req),
          user: req.user,
          req,
        });
        
        if (hasPermission) {
          req.rbac = { resource, action, granted: true };
          return next();
        }
      }
      
      logger.warn('No permission matched', {
        userId: req.user.id,
        permissions,
        path: req.path,
      });
      
      return ResponseUtil.forbidden(res, 'Insufficient permissions');
    } catch (error) {
      logger.error('Require any permission error', {
        error: error.message,
      });
      return ResponseUtil.serverError(res, error);
    }
  };
}

/**
 * Require All Permissions
 * Checks if user has all specified permissions
 * 
 * @param {Array} permissions - Array of {resource, action} objects
 * @returns {Function} Express middleware
 */
function requireAllPermissions(permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return ResponseUtil.unauthorized(res, 'Authentication required');
      }
      
      const results = [];
      
      for (const { resource, action } of permissions) {
        const hasPermission = await checkPermission({
          userId: req.user.id || req.user._id,
          userRole: req.user.role,
          resource,
          action,
          resourceId: extractResourceId(req),
          user: req.user,
          req,
        });
        
        results.push({ resource, action, granted: hasPermission });
        
        if (!hasPermission) {
          logger.warn('Permission check failed', {
            userId: req.user.id,
            resource,
            action,
            path: req.path,
          });
          
          return ResponseUtil.forbidden(res, `No permission for ${action} on ${resource}`);
        }
      }
      
      req.rbac = { permissions: results, granted: true };
      next();
    } catch (error) {
      logger.error('Require all permissions error', {
        error: error.message,
      });
      return ResponseUtil.serverError(res, error);
    }
  };
}

/**
 * Check Ownership Middleware
 * Ensures user owns the resource
 * 
 * @param {string} resource - Resource type
 * @returns {Function} Express middleware
 */
function requireOwnership(resource) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return ResponseUtil.unauthorized(res, 'Authentication required');
      }
      
      const resourceId = extractResourceId(req);
      
      if (!resourceId) {
        return ResponseUtil.badRequest(res, 'Resource ID required');
      }
      
      const isOwner = await checkResourceOwnership(
        req.user.id || req.user._id,
        resource,
        resourceId
      );
      
      if (!isOwner) {
        logger.warn('Ownership check failed', {
          userId: req.user.id,
          resource,
          resourceId,
          path: req.path,
        });
        
        return ResponseUtil.forbidden(res, 'You do not own this resource');
      }
      
      req.rbac = { resource, resourceId, isOwner: true };
      next();
    } catch (error) {
      logger.error('Ownership check error', {
        error: error.message,
      });
      return ResponseUtil.serverError(res, error);
    }
  };
}

/**
 * Export RBAC middlewares and utilities
 */
module.exports = {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireOwnership,
  
  // Utility functions
  checkPermission,
  checkResourceOwnership,
  extractResourceId,
  
  // Configuration
  PERMISSIONS,
  RBAC_CONFIG,
  
  // Convenience methods for common permissions
  canCreate: (resource) => requirePermission(resource, 'create'),
  canRead: (resource) => requirePermission(resource, 'read'),
  canUpdate: (resource) => requirePermission(resource, 'update'),
  canDelete: (resource) => requirePermission(resource, 'delete'),
  
  // Role checks
  isAgencyOwner: (req, res, next) => {
    if (req.user?.role === USER_ROLES.AGENCY_OWNER) {
      return next();
    }
    return ResponseUtil.forbidden(res, 'Agency owner access required');
  },
  
  isAgencyMember: (req, res, next) => {
    if ([USER_ROLES.AGENCY_OWNER, USER_ROLES.AGENCY_MEMBER].includes(req.user?.role)) {
      return next();
    }
    return ResponseUtil.forbidden(res, 'Agency member access required');
  },
  
  isCreator: (req, res, next) => {
    if (req.user?.role === USER_ROLES.CREATOR) {
      return next();
    }
    return ResponseUtil.forbidden(res, 'Creator access required');
  },
};