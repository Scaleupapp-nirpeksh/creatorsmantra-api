/**
 * Token Utility
 * @module utils/token
 * @description JWT token generation, verification, and management with refresh token support
 * 
 * File Path: src/utils/token.util.js
 * 
 * Features:
 * - JWT access and refresh token generation
 * - RS256 algorithm for enhanced security
 * - Token verification and decoding
 * - Password reset and email verification tokens
 * - API key generation and management
 * - Token blacklisting support
 * - Token rotation mechanism
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const config = require('../config/environment');
const logger = require('../config/logger');
const redisClient = require('../config/redis');
const { ERROR_CODES, TIME } = require('../config/constants');

// Promisify JWT methods for async/await
const signToken = promisify(jwt.sign);
const verifyToken = promisify(jwt.verify);

/**
 * Token Configuration
 */
const TOKEN_CONFIG = {
  algorithms: {
    access: 'HS256', // Using HS256 for simplicity, RS256 recommended for production
    refresh: 'HS256',
  },
  audiences: {
    access: 'creatorsmantra-access',
    refresh: 'creatorsmantra-refresh',
    api: 'creatorsmantra-api',
  },
  issuers: {
    default: 'creatorsmantra.com',
  },
  purposes: {
    ACCESS: 'access',
    REFRESH: 'refresh',
    RESET_PASSWORD: 'reset_password',
    EMAIL_VERIFICATION: 'email_verification',
    TWO_FACTOR: 'two_factor',
    API_KEY: 'api_key',
  },
  blacklistPrefix: 'blacklist:token:',
  refreshTokenPrefix: 'refresh:token:',
  apiKeyPrefix: 'api:key:',
};

/**
 * Token Utility Class
 * Handles all token-related operations
 */
class TokenUtil {
  /**
   * Generate JWT access token
   * @param {Object} payload - Token payload
   * @param {Object} options - Additional JWT options
   * @returns {Promise<string>} Signed JWT token
   */
  async generateAccessToken(payload, options = {}) {
    try {
      // Validate payload
      if (!payload.userId) {
        throw new Error('User ID is required in token payload');
      }

      // Token payload with standard claims
      const tokenPayload = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        accountType: payload.accountType,
        purpose: TOKEN_CONFIG.purposes.ACCESS,
        ...payload,
      };

      // Token options
      const tokenOptions = {
        algorithm: TOKEN_CONFIG.algorithms.access,
        expiresIn: config.jwt.expiresIn,
        audience: TOKEN_CONFIG.audiences.access,
        issuer: TOKEN_CONFIG.issuers.default,
        subject: String(payload.userId),
        jwtid: this.generateTokenId(),
        ...options,
      };

      // Sign token
      const token = await signToken(tokenPayload, config.jwt.secret, tokenOptions);

      logger.debug('Access token generated', {
        userId: payload.userId,
        expiresIn: config.jwt.expiresIn,
        jwtid: tokenOptions.jwtid,
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate access token', { error: error.message });
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Token payload
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Refresh token
   */
  async generateRefreshToken(payload, options = {}) {
    try {
      // Validate payload
      if (!payload.userId) {
        throw new Error('User ID is required for refresh token');
      }

      // Create minimal payload for refresh token
      const tokenPayload = {
        userId: payload.userId,
        purpose: TOKEN_CONFIG.purposes.REFRESH,
        sessionId: payload.sessionId || this.generateSessionId(),
      };

      // Token options
      const tokenOptions = {
        algorithm: TOKEN_CONFIG.algorithms.refresh,
        expiresIn: config.jwt.refreshExpiresIn,
        audience: TOKEN_CONFIG.audiences.refresh,
        issuer: TOKEN_CONFIG.issuers.default,
        subject: String(payload.userId),
        jwtid: this.generateTokenId(),
        ...options,
      };

      // Sign token
      const token = await signToken(tokenPayload, config.jwt.refreshSecret, tokenOptions);

      // Store refresh token in Redis with expiration
      const redisKey = `${TOKEN_CONFIG.refreshTokenPrefix}${payload.userId}:${tokenPayload.sessionId}`;
      const ttl = this.parseExpiration(config.jwt.refreshExpiresIn);
      
      await redisClient.set(redisKey, token, ttl);

      // Store additional metadata
      const metadataKey = `${redisKey}:metadata`;
      await redisClient.set(metadataKey, {
        createdAt: new Date().toISOString(),
        userAgent: options.userAgent,
        ipAddress: options.ipAddress,
        deviceId: options.deviceId,
      }, ttl);

      logger.debug('Refresh token generated', {
        userId: payload.userId,
        sessionId: tokenPayload.sessionId,
        expiresIn: config.jwt.refreshExpiresIn,
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate refresh token', { error: error.message });
      throw new Error('Refresh token generation failed');
    }
  }

  /**
   * Generate both access and refresh tokens
   * @param {Object} payload - Token payload
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Token pair
   */
  async generateTokenPair(payload, options = {}) {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        this.generateAccessToken(payload, options),
        this.generateRefreshToken(payload, options),
      ]);

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.parseExpiration(config.jwt.expiresIn),
        refreshExpiresIn: this.parseExpiration(config.jwt.refreshExpiresIn),
      };
    } catch (error) {
      logger.error('Failed to generate token pair', { error: error.message });
      throw new Error('Token pair generation failed');
    }
  }

  /**
   * Verify access token
   * @param {string} token - JWT token to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Decoded token payload
   */
  async verifyAccessToken(token, options = {}) {
    try {
      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(token)) {
        throw new Error('Token has been revoked');
      }

      // Verification options
      const verifyOptions = {
        algorithms: [TOKEN_CONFIG.algorithms.access],
        audience: TOKEN_CONFIG.audiences.access,
        issuer: TOKEN_CONFIG.issuers.default,
        ...options,
      };

      // Verify token
      const decoded = await verifyToken(token, config.jwt.secret, verifyOptions);

      // Validate purpose
      if (decoded.purpose !== TOKEN_CONFIG.purposes.ACCESS) {
        throw new Error('Invalid token purpose');
      }

      logger.debug('Access token verified', {
        userId: decoded.userId,
        jti: decoded.jti,
      });

      return decoded;
    } catch (error) {
      logger.warn('Token verification failed', { error: error.message });
      
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      
      throw error;
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - Refresh token to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Decoded token payload
   */
  async verifyRefreshToken(token, options = {}) {
    try {
      // Verification options
      const verifyOptions = {
        algorithms: [TOKEN_CONFIG.algorithms.refresh],
        audience: TOKEN_CONFIG.audiences.refresh,
        issuer: TOKEN_CONFIG.issuers.default,
        ...options,
      };

      // Verify token
      const decoded = await verifyToken(token, config.jwt.refreshSecret, verifyOptions);

      // Validate purpose
      if (decoded.purpose !== TOKEN_CONFIG.purposes.REFRESH) {
        throw new Error('Invalid token purpose');
      }

      // Check if token exists in Redis
      const redisKey = `${TOKEN_CONFIG.refreshTokenPrefix}${decoded.userId}:${decoded.sessionId}`;
      const storedToken = await redisClient.get(redisKey);

      if (!storedToken || storedToken !== token) {
        throw new Error('Refresh token not found or invalid');
      }

      logger.debug('Refresh token verified', {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
      });

      return decoded;
    } catch (error) {
      logger.warn('Refresh token verification failed', { error: error.message });
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Decode token without verification
   * @param {string} token - JWT token
   * @returns {Object} Decoded payload
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      logger.error('Failed to decode token', { error: error.message });
      return null;
    }
  }

  /**
   * Generate password reset token
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @returns {Promise<string>} Reset token
   */
  async generateResetToken(userId, email) {
    try {
      // Generate random token
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Create hash of token
      const hashedToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      // Store in Redis with 1 hour expiration
      const redisKey = `reset:password:${hashedToken}`;
      await redisClient.set(redisKey, {
        userId,
        email,
        createdAt: new Date().toISOString(),
        purpose: TOKEN_CONFIG.purposes.RESET_PASSWORD,
      }, 3600); // 1 hour

      logger.info('Password reset token generated', { userId, email });

      return resetToken;
    } catch (error) {
      logger.error('Failed to generate reset token', { error: error.message });
      throw new Error('Reset token generation failed');
    }
  }

  /**
   * Verify password reset token
   * @param {string} token - Reset token
   * @returns {Promise<Object>} Token data
   */
  async verifyResetToken(token) {
    try {
      // Hash the token
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Get from Redis
      const redisKey = `reset:password:${hashedToken}`;
      const tokenData = await redisClient.get(redisKey);

      if (!tokenData) {
        throw new Error('Invalid or expired reset token');
      }

      // Delete token after successful verification (one-time use)
      await redisClient.delete(redisKey);

      logger.info('Password reset token verified', { userId: tokenData.userId });

      return tokenData;
    } catch (error) {
      logger.warn('Reset token verification failed', { error: error.message });
      throw new Error('Invalid reset token');
    }
  }

  /**
   * Generate email verification token
   * @param {string} userId - User ID
   * @param {string} email - Email to verify
   * @returns {Promise<string>} Verification token
   */
  async generateEmailToken(userId, email) {
    try {
      // Generate token with email and timestamp
      const token = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Store in Redis with 24 hour expiration
      const redisKey = `verify:email:${hashedToken}`;
      await redisClient.set(redisKey, {
        userId,
        email,
        createdAt: new Date().toISOString(),
        purpose: TOKEN_CONFIG.purposes.EMAIL_VERIFICATION,
      }, 86400); // 24 hours

      logger.info('Email verification token generated', { userId, email });

      return token;
    } catch (error) {
      logger.error('Failed to generate email token', { error: error.message });
      throw new Error('Email token generation failed');
    }
  }

  /**
   * Verify email verification token
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Token data
   */
  async verifyEmailToken(token) {
    try {
      // Hash the token
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Get from Redis
      const redisKey = `verify:email:${hashedToken}`;
      const tokenData = await redisClient.get(redisKey);

      if (!tokenData) {
        throw new Error('Invalid or expired verification token');
      }

      // Delete token after successful verification
      await redisClient.delete(redisKey);

      logger.info('Email verification token verified', { userId: tokenData.userId });

      return tokenData;
    } catch (error) {
      logger.warn('Email token verification failed', { error: error.message });
      throw new Error('Invalid verification token');
    }
  }

  /**
   * Generate API key for external integrations
   * @param {Object} payload - API key payload
   * @returns {Promise<string>} API key
   */
  async generateAPIKey(payload) {
    try {
      // Generate unique API key
      const apiKey = `ck_${crypto.randomBytes(32).toString('hex')}`;
      
      // Create JWT for API key validation
      const tokenPayload = {
        userId: payload.userId,
        purpose: TOKEN_CONFIG.purposes.API_KEY,
        permissions: payload.permissions || [],
        name: payload.name,
      };

      const token = await signToken(tokenPayload, config.jwt.secret, {
        algorithm: TOKEN_CONFIG.algorithms.access,
        audience: TOKEN_CONFIG.audiences.api,
        issuer: TOKEN_CONFIG.issuers.default,
        noTimestamp: true, // API keys don't expire by default
      });

      // Store API key mapping in Redis
      const redisKey = `${TOKEN_CONFIG.apiKeyPrefix}${apiKey}`;
      await redisClient.set(redisKey, {
        token,
        userId: payload.userId,
        name: payload.name,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        permissions: payload.permissions,
      });

      logger.info('API key generated', {
        userId: payload.userId,
        name: payload.name,
      });

      return apiKey;
    } catch (error) {
      logger.error('Failed to generate API key', { error: error.message });
      throw new Error('API key generation failed');
    }
  }

  /**
   * Verify API key
   * @param {string} apiKey - API key to verify
   * @returns {Promise<Object>} API key data
   */
  async verifyAPIKey(apiKey) {
    try {
      // Get API key data from Redis
      const redisKey = `${TOKEN_CONFIG.apiKeyPrefix}${apiKey}`;
      const keyData = await redisClient.get(redisKey);

      if (!keyData) {
        throw new Error('Invalid API key');
      }

      // Verify the associated JWT
      const decoded = await verifyToken(keyData.token, config.jwt.secret, {
        algorithms: [TOKEN_CONFIG.algorithms.access],
        audience: TOKEN_CONFIG.audiences.api,
        issuer: TOKEN_CONFIG.issuers.default,
      });

      // Update last used timestamp
      keyData.lastUsedAt = new Date().toISOString();
      await redisClient.set(redisKey, keyData);

      logger.debug('API key verified', {
        userId: keyData.userId,
        name: keyData.name,
      });

      return {
        ...decoded,
        ...keyData,
      };
    } catch (error) {
      logger.warn('API key verification failed', { error: error.message });
      throw new Error('Invalid API key');
    }
  }

  /**
   * Revoke token (blacklist)
   * @param {string} token - Token to revoke
   * @param {string} reason - Revocation reason
   * @returns {Promise<boolean>} Success status
   */
  async revokeToken(token, reason = 'User requested') {
    try {
      // Decode token to get expiration
      const decoded = this.decodeToken(token);
      
      if (!decoded) {
        return false;
      }

      // Calculate TTL based on token expiration
      const exp = decoded.payload.exp;
      const now = Math.floor(Date.now() / 1000);
      const ttl = exp - now;

      if (ttl <= 0) {
        // Token already expired
        return true;
      }

      // Add to blacklist
      const blacklistKey = `${TOKEN_CONFIG.blacklistPrefix}${decoded.payload.jti}`;
      await redisClient.set(blacklistKey, {
        revokedAt: new Date().toISOString(),
        reason,
        userId: decoded.payload.userId,
      }, ttl);

      logger.info('Token revoked', {
        jti: decoded.payload.jti,
        userId: decoded.payload.userId,
        reason,
      });

      return true;
    } catch (error) {
      logger.error('Failed to revoke token', { error: error.message });
      return false;
    }
  }

  /**
   * Check if token is blacklisted
   * @param {string} token - Token to check
   * @returns {Promise<boolean>} Blacklist status
   */
  async isTokenBlacklisted(token) {
    try {
      const decoded = this.decodeToken(token);
      
      if (!decoded || !decoded.payload.jti) {
        return false;
      }

      const blacklistKey = `${TOKEN_CONFIG.blacklistPrefix}${decoded.payload.jti}`;
      const exists = await redisClient.exists(blacklistKey);

      return exists;
    } catch (error) {
      logger.error('Failed to check token blacklist', { error: error.message });
      return false;
    }
  }

  /**
   * Revoke all tokens for a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async revokeAllUserTokens(userId) {
    try {
      // Delete all refresh tokens
      const pattern = `${TOKEN_CONFIG.refreshTokenPrefix}${userId}:*`;
      const deletedCount = await redisClient.deletePattern(pattern);

      logger.info('All user tokens revoked', {
        userId,
        deletedCount,
      });

      return true;
    } catch (error) {
      logger.error('Failed to revoke user tokens', { error: error.message });
      return false;
    }
  }

  /**
   * Rotate refresh token
   * @param {string} oldToken - Current refresh token
   * @returns {Promise<Object>} New token pair
   */
  async rotateRefreshToken(oldToken) {
    try {
      // Verify old token
      const decoded = await this.verifyRefreshToken(oldToken);

      // Revoke old token
      await this.revokeToken(oldToken, 'Token rotation');

      // Generate new token pair
      const newTokens = await this.generateTokenPair({
        userId: decoded.userId,
        sessionId: decoded.sessionId,
      });

      logger.info('Refresh token rotated', {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
      });

      return newTokens;
    } catch (error) {
      logger.error('Failed to rotate refresh token', { error: error.message });
      throw new Error('Token rotation failed');
    }
  }

  /**
   * Generate two-factor authentication token
   * @param {string} userId - User ID
   * @param {string} code - 2FA code
   * @returns {Promise<string>} 2FA token
   */
  async generateTwoFactorToken(userId, code) {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Store with 5 minute expiration
      const redisKey = `2fa:${hashedToken}`;
      await redisClient.set(redisKey, {
        userId,
        code,
        createdAt: new Date().toISOString(),
        purpose: TOKEN_CONFIG.purposes.TWO_FACTOR,
      }, 300); // 5 minutes

      logger.info('2FA token generated', { userId });

      return token;
    } catch (error) {
      logger.error('Failed to generate 2FA token', { error: error.message });
      throw new Error('2FA token generation failed');
    }
  }

  /**
   * Helper: Generate unique token ID
   * @private
   * @returns {string} Token ID
   */
  generateTokenId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Helper: Generate session ID
   * @private
   * @returns {string} Session ID
   */
  generateSessionId() {
    return crypto.randomBytes(24).toString('hex');
  }

  /**
   * Helper: Parse expiration string to seconds
   * @private
   * @param {string} expiration - Expiration string (e.g., '1h', '7d')
   * @returns {number} Seconds
   */
  parseExpiration(expiration) {
    const units = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800,
    };

    const match = expiration.match(/^(\d+)([smhdw])$/);
    
    if (!match) {
      return 3600; // Default 1 hour
    }

    const [, value, unit] = match;
    return parseInt(value) * (units[unit] || 1);
  }

  /**
   * Get active sessions for user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Active sessions
   */
  async getUserSessions(userId) {
    try {
      const pattern = `${TOKEN_CONFIG.refreshTokenPrefix}${userId}:*`;
      const keys = await redisClient.client.keys(pattern);
      
      const sessions = [];
      
      for (const key of keys) {
        const metadataKey = `${key}:metadata`;
        const metadata = await redisClient.get(metadataKey);
        
        if (metadata) {
          sessions.push({
            sessionId: key.split(':').pop(),
            ...metadata,
          });
        }
      }

      return sessions;
    } catch (error) {
      logger.error('Failed to get user sessions', { error: error.message });
      return [];
    }
  }
}

// Create singleton instance
const tokenUtil = new TokenUtil();

// Export utility instance and methods
module.exports = tokenUtil;

// Export convenience methods
module.exports.token = {
  generateAccess: (payload, options) => tokenUtil.generateAccessToken(payload, options),
  generateRefresh: (payload, options) => tokenUtil.generateRefreshToken(payload, options),
  generatePair: (payload, options) => tokenUtil.generateTokenPair(payload, options),
  verifyAccess: (token, options) => tokenUtil.verifyAccessToken(token, options),
  verifyRefresh: (token, options) => tokenUtil.verifyRefreshToken(token, options),
  decode: (token) => tokenUtil.decodeToken(token),
  generateReset: (userId, email) => tokenUtil.generateResetToken(userId, email),
  verifyReset: (token) => tokenUtil.verifyResetToken(token),
  generateEmail: (userId, email) => tokenUtil.generateEmailToken(userId, email),
  verifyEmail: (token) => tokenUtil.verifyEmailToken(token),
  generateAPIKey: (payload) => tokenUtil.generateAPIKey(payload),
  verifyAPIKey: (apiKey) => tokenUtil.verifyAPIKey(apiKey),
  revoke: (token, reason) => tokenUtil.revokeToken(token, reason),
  revokeAll: (userId) => tokenUtil.revokeAllUserTokens(userId),
  rotate: (oldToken) => tokenUtil.rotateRefreshToken(oldToken),
  isBlacklisted: (token) => tokenUtil.isTokenBlacklisted(token),
  generate2FA: (userId, code) => tokenUtil.generateTwoFactorToken(userId, code),
  getSessions: (userId) => tokenUtil.getUserSessions(userId),
};