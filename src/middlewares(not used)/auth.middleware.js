/**
 * Authentication Middleware
 * @module middlewares/auth
 * @description JWT authentication, session management, and API key validation
 * 
 * File Path: src/middlewares/auth.middleware.js
 * 
 * Features:
 * - JWT Bearer token authentication
 * - API key authentication for integrations
 * - Refresh token rotation
 * - Session management with Redis
 * - User data caching
 * - Optional authentication for public routes
 * - Request fingerprinting
 * - Multi-device session tracking
 */

const { promisify } = require('util');
const config = require('../config/environment');
const logger = require('../config/logger');
const { token } = require('../utils/token.util');
const ResponseUtil = require('../utils/response.util');
const redisClient = require('../config/redis');
const { ERROR_CODES, USER_ROLES, ACCOUNT_TYPES } = require('../config/constants');

// Import models (to be created later)
// const User = require('../models/User.model');
// const Agency = require('../models/Agency.model');

/**
 * Authentication Configuration
 */
const AUTH_CONFIG = {
  // Token sources
  headerName: 'Authorization',
  apiKeyHeader: 'X-API-Key',
  bearerPrefix: 'Bearer ',
  
  // Session configuration
  sessionPrefix: 'session:',
  userCachePrefix: 'user:cache:',
  sessionTTL: 900, // 15 minutes for access token
  userCacheTTL: 300, // 5 minutes for user data cache
  
  // Security
  maxDevicesPerUser: 5,
  fingerprintHeader: 'X-Device-ID',
  
  // Rate limiting for auth
  maxAuthAttempts: 5,
  authAttemptWindow: 900, // 15 minutes
  
  // Bypass paths (public routes)
  publicPaths: [
    '/api/v1/auth/register',
    '/api/v1/auth/login',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
    '/api/v1/auth/verify-email',
    '/api/v1/health',
    '/api/v1/status',
  ],
  
  // Optional auth paths
  optionalAuthPaths: [
    '/api/v1/creators/public',
    '/api/v1/rate-cards/public',
  ],
};

/**
 * Main Authentication Middleware
 * Validates JWT tokens and attaches user to request
 */
async function authenticate(req, res, next) {
  try {
    // Check if path is public
    if (isPublicPath(req.path)) {
      return next();
    }
    
    // Extract token from request
    const extractedToken = extractToken(req);
    
    if (!extractedToken) {
      // Check if authentication is optional for this path
      if (isOptionalAuthPath(req.path)) {
        return next();
      }
      
      logger.warn('No authentication token provided', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      
      return ResponseUtil.unauthorized(res, 'Authentication required');
    }
    
    // Determine authentication type
    const { type, value } = extractedToken;
    
    let user;
    
    switch (type) {
      case 'bearer':
        user = await authenticateWithJWT(value, req);
        break;
        
      case 'apikey':
        user = await authenticateWithAPIKey(value, req);
        break;
        
      default:
        return ResponseUtil.unauthorized(res, 'Invalid authentication type');
    }
    
    if (!user) {
      return ResponseUtil.unauthorized(res, 'Authentication failed');
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      logger.warn('Inactive user attempted access', {
        userId: user.id,
        status: user.status,
        path: req.path,
      });
      
      return ResponseUtil.forbidden(res, 'Account is not active');
    }
    
    // Attach user to request
    req.user = user;
    req.userId = user.id || user._id;
    req.authType = type;
    
    // Add auth metadata
    req.auth = {
      userId: user.id || user._id,
      email: user.email,
      role: user.role,
      accountType: user.accountType,
      agencyId: user.agencyId,
      timestamp: new Date().toISOString(),
    };
    
    // Track last activity
    await updateLastActivity(user.id || user._id);
    
    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
    });
    
    // Check for specific JWT errors
    if (error.message === 'Token has expired') {
      return ResponseUtil.unauthorized(res, 'Token has expired');
    } else if (error.message === 'Invalid token') {
      return ResponseUtil.unauthorized(res, 'Invalid authentication token');
    }
    
    return ResponseUtil.serverError(res, error);
  }
}

/**
 * Optional Authentication Middleware
 * Attempts authentication but continues even if it fails
 */
async function optionalAuth(req, res, next) {
  try {
    const extractedToken = extractToken(req);
    
    if (!extractedToken) {
      return next();
    }
    
    const { type, value } = extractedToken;
    
    let user;
    
    switch (type) {
      case 'bearer':
        user = await authenticateWithJWT(value, req, true); // Silent mode
        break;
        
      case 'apikey':
        user = await authenticateWithAPIKey(value, req, true); // Silent mode
        break;
    }
    
    if (user && user.status === 'active') {
      req.user = user;
      req.userId = user.id || user._id;
      req.authType = type;
      req.isAuthenticated = true;
    } else {
      req.isAuthenticated = false;
    }
    
    next();
  } catch (error) {
    logger.debug('Optional authentication failed', {
      error: error.message,
      path: req.path,
    });
    
    req.isAuthenticated = false;
    next();
  }
}

/**
 * Refresh Token Middleware
 * Handles refresh token rotation
 */
async function refreshTokenMiddleware(req, res, next) {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return ResponseUtil.badRequest(res, 'Refresh token is required');
    }
    
    // Verify refresh token
    const decoded = await token.verifyRefresh(refreshToken);
    
    if (!decoded) {
      return ResponseUtil.unauthorized(res, 'Invalid refresh token');
    }
    
    // Get user from cache or database
    const user = await getUserById(decoded.userId);
    
    if (!user) {
      return ResponseUtil.unauthorized(res, 'User not found');
    }
    
    if (user.status !== 'active') {
      return ResponseUtil.forbidden(res, 'Account is not active');
    }
    
    // Check device fingerprint if provided
    const deviceId = req.headers[AUTH_CONFIG.fingerprintHeader];
    if (deviceId && decoded.deviceId && deviceId !== decoded.deviceId) {
      logger.warn('Device fingerprint mismatch during refresh', {
        userId: user.id,
        providedDevice: deviceId,
        tokenDevice: decoded.deviceId,
      });
      
      // Optional: You can make this stricter
      // return ResponseUtil.unauthorized(res, 'Device mismatch');
    }
    
    // Generate new token pair
    const newTokens = await token.generatePair({
      userId: user.id || user._id,
      email: user.email,
      role: user.role,
      accountType: user.accountType,
      agencyId: user.agencyId,
    }, {
      deviceId,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    
    // Revoke old refresh token
    await token.revoke(refreshToken, 'Token rotation');
    
    // Create session
    await createSession(user.id || user._id, newTokens.accessToken, {
      deviceId,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    
    logger.info('Token refreshed successfully', {
      userId: user.id,
      deviceId,
    });
    
    // Send new tokens
    return ResponseUtil.success(res, 200, 'Token refreshed successfully', {
      ...newTokens,
      user: {
        id: user.id || user._id,
        email: user.email,
        role: user.role,
        accountType: user.accountType,
      },
    });
  } catch (error) {
    logger.error('Refresh token error', {
      error: error.message,
      ip: req.ip,
    });
    
    return ResponseUtil.unauthorized(res, 'Failed to refresh token');
  }
}

/**
 * Extract Token from Request
 * @param {Object} req - Express request object
 * @returns {Object|null} Token type and value
 */
function extractToken(req) {
  // Check for Bearer token in Authorization header
  const authHeader = req.headers[AUTH_CONFIG.headerName.toLowerCase()];
  
  if (authHeader && authHeader.startsWith(AUTH_CONFIG.bearerPrefix)) {
    const token = authHeader.slice(AUTH_CONFIG.bearerPrefix.length);
    return { type: 'bearer', value: token };
  }
  
  // Check for API key
  const apiKey = req.headers[AUTH_CONFIG.apiKeyHeader.toLowerCase()];
  
  if (apiKey) {
    return { type: 'apikey', value: apiKey };
  }
  
  // Check for token in query params (for download links, etc.)
  if (req.query.token) {
    return { type: 'bearer', value: req.query.token };
  }
  
  return null;
}

/**
 * Authenticate with JWT Token
 * @param {string} tokenValue - JWT token
 * @param {Object} req - Express request object
 * @param {boolean} silent - Silent mode (don't log warnings)
 * @returns {Promise<Object|null>} User object or null
 */
async function authenticateWithJWT(tokenValue, req, silent = false) {
  try {
    // Verify token
    const decoded = await token.verifyAccess(tokenValue);
    
    if (!decoded) {
      if (!silent) {
        logger.warn('Invalid JWT token', {
          path: req.path,
          ip: req.ip,
        });
      }
      return null;
    }
    
    // Check session in Redis
    const sessionKey = `${AUTH_CONFIG.sessionPrefix}${decoded.userId}:${decoded.jti}`;
    const sessionExists = await redisClient.exists(sessionKey);
    
    if (!sessionExists) {
      if (!silent) {
        logger.warn('Session not found for valid token', {
          userId: decoded.userId,
          jti: decoded.jti,
        });
      }
      // Session expired or was revoked
      return null;
    }
    
    // Get user from cache or database
    const user = await getUserById(decoded.userId);
    
    if (!user) {
      if (!silent) {
        logger.warn('User not found for valid token', {
          userId: decoded.userId,
        });
      }
      return null;
    }
    
    // Extend session TTL
    await redisClient.expire(sessionKey, AUTH_CONFIG.sessionTTL);
    
    return user;
  } catch (error) {
    if (!silent) {
      logger.error('JWT authentication error', {
        error: error.message,
        path: req.path,
      });
    }
    return null;
  }
}

/**
 * Authenticate with API Key
 * @param {string} apiKey - API key
 * @param {Object} req - Express request object
 * @param {boolean} silent - Silent mode
 * @returns {Promise<Object|null>} User object or null
 */
async function authenticateWithAPIKey(apiKey, req, silent = false) {
  try {
    // Verify API key
    const keyData = await token.verifyAPIKey(apiKey);
    
    if (!keyData) {
      if (!silent) {
        logger.warn('Invalid API key', {
          path: req.path,
          ip: req.ip,
        });
      }
      return null;
    }
    
    // Get user
    const user = await getUserById(keyData.userId);
    
    if (!user) {
      if (!silent) {
        logger.warn('User not found for API key', {
          userId: keyData.userId,
        });
      }
      return null;
    }
    
    // Add API key permissions to user object
    user.apiKeyPermissions = keyData.permissions;
    user.apiKeyName = keyData.name;
    
    // Log API key usage
    logger.info('API key authenticated', {
      userId: user.id,
      keyName: keyData.name,
      path: req.path,
    });
    
    return user;
  } catch (error) {
    if (!silent) {
      logger.error('API key authentication error', {
        error: error.message,
        path: req.path,
      });
    }
    return null;
  }
}

/**
 * Get User by ID
 * Fetches user from cache or database
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User object
 */
async function getUserById(userId) {
  try {
    // Check cache first
    const cacheKey = `${AUTH_CONFIG.userCachePrefix}${userId}`;
    const cachedUser = await redisClient.get(cacheKey);
    
    if (cachedUser) {
      return cachedUser;
    }
    
    // Fetch from database (mock implementation)
    // const user = await User.findById(userId)
    //   .select('-password')
    //   .lean();
    
    // Mock user data for now
    const user = {
      id: userId,
      _id: userId,
      email: 'user@example.com',
      role: USER_ROLES.CREATOR,
      accountType: ACCOUNT_TYPES.CREATOR,
      status: 'active',
      agencyId: null,
    };
    
    if (user) {
      // Cache user data
      await redisClient.set(cacheKey, user, AUTH_CONFIG.userCacheTTL);
    }
    
    return user;
  } catch (error) {
    logger.error('Error fetching user', {
      error: error.message,
      userId,
    });
    return null;
  }
}

/**
 * Create Session
 * Creates a new session in Redis
 * @param {string} userId - User ID
 * @param {string} accessToken - Access token
 * @param {Object} metadata - Session metadata
 */
async function createSession(userId, accessToken, metadata = {}) {
  try {
    // Decode token to get JTI
    const decoded = token.decode(accessToken);
    
    if (!decoded) {
      throw new Error('Failed to decode token for session creation');
    }
    
    const sessionKey = `${AUTH_CONFIG.sessionPrefix}${userId}:${decoded.payload.jti}`;
    
    const sessionData = {
      userId,
      jti: decoded.payload.jti,
      createdAt: new Date().toISOString(),
      ...metadata,
    };
    
    await redisClient.set(sessionKey, sessionData, AUTH_CONFIG.sessionTTL);
    
    // Track active sessions
    const activeSessionsKey = `${AUTH_CONFIG.sessionPrefix}${userId}:active`;
    await redisClient.sadd(activeSessionsKey, decoded.payload.jti);
    
    // Limit number of active sessions
    const activeSessions = await redisClient.smembers(activeSessionsKey);
    
    if (activeSessions.length > AUTH_CONFIG.maxDevicesPerUser) {
      // Remove oldest session
      const sessionsWithTime = [];
      
      for (const jti of activeSessions) {
        const sessionData = await redisClient.get(`${AUTH_CONFIG.sessionPrefix}${userId}:${jti}`);
        if (sessionData) {
          sessionsWithTime.push({
            jti,
            createdAt: new Date(sessionData.createdAt).getTime(),
          });
        }
      }
      
      // Sort by creation time and remove oldest
      sessionsWithTime.sort((a, b) => a.createdAt - b.createdAt);
      const toRemove = sessionsWithTime.slice(0, activeSessions.length - AUTH_CONFIG.maxDevicesPerUser);
      
      for (const session of toRemove) {
        await revokeSession(userId, session.jti);
      }
    }
    
    logger.info('Session created', {
      userId,
      jti: decoded.payload.jti,
      deviceId: metadata.deviceId,
    });
  } catch (error) {
    logger.error('Session creation error', {
      error: error.message,
      userId,
    });
  }
}

/**
 * Revoke Session
 * Removes a session from Redis
 * @param {string} userId - User ID
 * @param {string} jti - JWT ID
 */
async function revokeSession(userId, jti) {
  try {
    const sessionKey = `${AUTH_CONFIG.sessionPrefix}${userId}:${jti}`;
    await redisClient.delete(sessionKey);
    
    const activeSessionsKey = `${AUTH_CONFIG.sessionPrefix}${userId}:active`;
    await redisClient.srem(activeSessionsKey, jti);
    
    logger.info('Session revoked', {
      userId,
      jti,
    });
  } catch (error) {
    logger.error('Session revocation error', {
      error: error.message,
      userId,
      jti,
    });
  }
}

/**
 * Update Last Activity
 * Updates user's last activity timestamp
 * @param {string} userId - User ID
 */
async function updateLastActivity(userId) {
  try {
    const key = `user:activity:${userId}`;
    await redisClient.set(key, {
      lastActivity: new Date().toISOString(),
    }, 3600); // 1 hour TTL
  } catch (error) {
    logger.debug('Failed to update last activity', {
      error: error.message,
      userId,
    });
  }
}

/**
 * Logout Middleware
 * Handles user logout and session cleanup
 */
async function logout(req, res, next) {
  try {
    if (!req.user) {
      return ResponseUtil.badRequest(res, 'No active session');
    }
    
    const userId = req.user.id || req.user._id;
    
    // Get token from request
    const extractedToken = extractToken(req);
    
    if (extractedToken && extractedToken.type === 'bearer') {
      // Decode to get JTI
      const decoded = token.decode(extractedToken.value);
      
      if (decoded) {
        // Revoke the session
        await revokeSession(userId, decoded.payload.jti);
        
        // Blacklist the token
        await token.revoke(extractedToken.value, 'User logout');
      }
    }
    
    // Clear user cache
    const cacheKey = `${AUTH_CONFIG.userCachePrefix}${userId}`;
    await redisClient.delete(cacheKey);
    
    logger.info('User logged out', {
      userId,
      ip: req.ip,
    });
    
    return ResponseUtil.success(res, 200, 'Logged out successfully');
  } catch (error) {
    logger.error('Logout error', {
      error: error.message,
      userId: req.user?.id,
    });
    
    return ResponseUtil.serverError(res, error);
  }
}

/**
 * Logout All Devices Middleware
 * Logs out user from all devices
 */
async function logoutAllDevices(req, res, next) {
  try {
    if (!req.user) {
      return ResponseUtil.badRequest(res, 'No active session');
    }
    
    const userId = req.user.id || req.user._id;
    
    // Get all active sessions
    const activeSessionsKey = `${AUTH_CONFIG.sessionPrefix}${userId}:active`;
    const activeSessions = await redisClient.smembers(activeSessionsKey);
    
    // Revoke all sessions
    for (const jti of activeSessions) {
      await revokeSession(userId, jti);
    }
    
    // Clear the active sessions set
    await redisClient.delete(activeSessionsKey);
    
    // Clear user cache
    const cacheKey = `${AUTH_CONFIG.userCachePrefix}${userId}`;
    await redisClient.delete(cacheKey);
    
    // Revoke all refresh tokens
    await token.revokeAll(userId);
    
    logger.info('User logged out from all devices', {
      userId,
      sessionsRevoked: activeSessions.length,
    });
    
    return ResponseUtil.success(res, 200, 'Logged out from all devices successfully');
  } catch (error) {
    logger.error('Logout all devices error', {
      error: error.message,
      userId: req.user?.id,
    });
    
    return ResponseUtil.serverError(res, error);
  }
}

/**
 * Session Info Middleware
 * Returns information about active sessions
 */
async function getSessionInfo(req, res, next) {
  try {
    if (!req.user) {
      return ResponseUtil.unauthorized(res, 'Authentication required');
    }
    
    const userId = req.user.id || req.user._id;
    
    // Get all active sessions
    const activeSessionsKey = `${AUTH_CONFIG.sessionPrefix}${userId}:active`;
    const activeSessionJTIs = await redisClient.smembers(activeSessionsKey);
    
    const sessions = [];
    
    for (const jti of activeSessionJTIs) {
      const sessionKey = `${AUTH_CONFIG.sessionPrefix}${userId}:${jti}`;
      const sessionData = await redisClient.get(sessionKey);
      
      if (sessionData) {
        sessions.push({
          id: jti,
          createdAt: sessionData.createdAt,
          deviceId: sessionData.deviceId,
          userAgent: sessionData.userAgent,
          ipAddress: sessionData.ipAddress,
          isCurrent: req.auth?.jti === jti,
        });
      }
    }
    
    // Sort by creation time (newest first)
    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return ResponseUtil.success(res, 200, 'Active sessions retrieved', {
      sessions,
      count: sessions.length,
      maxDevices: AUTH_CONFIG.maxDevicesPerUser,
    });
  } catch (error) {
    logger.error('Get session info error', {
      error: error.message,
      userId: req.user?.id,
    });
    
    return ResponseUtil.serverError(res, error);
  }
}

/**
 * Check if path is public
 * @param {string} path - Request path
 * @returns {boolean} Is public
 */
function isPublicPath(path) {
  return AUTH_CONFIG.publicPaths.some(publicPath => 
    path.startsWith(publicPath) || path === publicPath
  );
}

/**
 * Check if path has optional authentication
 * @param {string} path - Request path
 * @returns {boolean} Is optional auth
 */
function isOptionalAuthPath(path) {
  return AUTH_CONFIG.optionalAuthPaths.some(optionalPath => 
    path.startsWith(optionalPath) || path === optionalPath
  );
}

/**
 * Export authentication middlewares
 */
module.exports = {
  authenticate,
  optionalAuth,
  refreshToken: refreshTokenMiddleware,
  logout,
  logoutAllDevices,
  getSessionInfo,
  
  // Utility functions for other middlewares
  extractToken,
  getUserById,
  createSession,
  revokeSession,
  
  // Configuration
  AUTH_CONFIG,
};

// Convenience exports
module.exports.auth = authenticate;
module.exports.requireAuth = authenticate;
module.exports.optional = optionalAuth;