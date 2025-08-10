/**
 * Encryption Utility
 * @module utils/encryption
 * @description AES-256-GCM encryption for sensitive data with authentication tags
 * 
 * File Path: src/utils/encryption.util.js
 * 
 * Features:
 * - AES-256-GCM encryption with authentication
 * - File encryption for contracts and documents
 * - Bank details and API key encryption
 * - Key rotation support
 * - HMAC for data integrity
 * - Secure random generation
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/environment');
const logger = require('../config/logger');
const { ERROR_CODES } = require('../config/constants');

/**
 * Encryption Configuration
 */
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16, // 128 bits
  tagLength: 16, // 128 bits
  saltLength: 64, // 512 bits
  iterations: 100000, // PBKDF2 iterations
  digest: 'sha256',
  encoding: 'base64',
};

/**
 * Encryption Utility Class
 * Provides methods for encrypting and decrypting sensitive data
 */
class EncryptionUtil {
  constructor() {
    this.key = Buffer.from(config.encryption.key, 'hex');
    this.iv = Buffer.from(config.encryption.iv, 'hex');
    this.validateKeyAndIv();
  }

  /**
   * Validate encryption key and IV
   * @private
   * @throws {Error} If key or IV is invalid
   */
  validateKeyAndIv() {
    if (this.key.length !== ENCRYPTION_CONFIG.keyLength) {
      throw new Error(`Encryption key must be ${ENCRYPTION_CONFIG.keyLength} bytes`);
    }
    if (this.iv.length !== ENCRYPTION_CONFIG.ivLength) {
      throw new Error(`Encryption IV must be ${ENCRYPTION_CONFIG.ivLength} bytes`);
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {string|Object} data - Data to encrypt
   * @param {Object} options - Encryption options
   * @returns {Object} Encrypted data with metadata
   */
  encrypt(data, options = {}) {
    try {
      // Convert object to string if necessary
      const plaintext = typeof data === 'object' ? JSON.stringify(data) : String(data);
      
      // Generate random IV for this encryption
      const iv = options.iv || crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, this.key, iv);
      
      // Add additional authenticated data if provided
      if (options.aad) {
        cipher.setAAD(Buffer.from(options.aad), { plaintextLength: Buffer.byteLength(plaintext) });
      }
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine encrypted data with metadata
      const result = {
        encrypted: encrypted.toString(ENCRYPTION_CONFIG.encoding),
        iv: iv.toString(ENCRYPTION_CONFIG.encoding),
        authTag: authTag.toString(ENCRYPTION_CONFIG.encoding),
        algorithm: ENCRYPTION_CONFIG.algorithm,
        timestamp: new Date().toISOString(),
      };
      
      // Add AAD if used
      if (options.aad) {
        result.aad = options.aad;
      }
      
      logger.debug('Data encrypted successfully', {
        algorithm: ENCRYPTION_CONFIG.algorithm,
        dataLength: plaintext.length,
      });
      
      return result;
    } catch (error) {
      logger.error('Encryption failed', { error: error.message });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {Object} encryptedData - Encrypted data object
   * @returns {string|Object} Decrypted data
   */
  decrypt(encryptedData) {
    try {
      // Validate encrypted data structure
      if (!encryptedData.encrypted || !encryptedData.iv || !encryptedData.authTag) {
        throw new Error('Invalid encrypted data structure');
      }
      
      // Convert from base64
      const encrypted = Buffer.from(encryptedData.encrypted, ENCRYPTION_CONFIG.encoding);
      const iv = Buffer.from(encryptedData.iv, ENCRYPTION_CONFIG.encoding);
      const authTag = Buffer.from(encryptedData.authTag, ENCRYPTION_CONFIG.encoding);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, this.key, iv);
      
      // Set authentication tag
      decipher.setAuthTag(authTag);
      
      // Add AAD if it was used during encryption
      if (encryptedData.aad) {
        decipher.setAAD(Buffer.from(encryptedData.aad));
      }
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      
      const plaintext = decrypted.toString('utf8');
      
      // Try to parse as JSON if possible
      try {
        return JSON.parse(plaintext);
      } catch {
        return plaintext;
      }
    } catch (error) {
      logger.error('Decryption failed', { error: error.message });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt file
   * @param {string} inputPath - Input file path
   * @param {string} outputPath - Output file path
   * @returns {Promise<Object>} Encryption metadata
   */
  async encryptFile(inputPath, outputPath) {
    try {
      // Read file
      const fileData = await fs.readFile(inputPath);
      
      // Generate random IV for file encryption
      const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, this.key, iv);
      
      // Encrypt file data
      const encrypted = Buffer.concat([
        cipher.update(fileData),
        cipher.final(),
      ]);
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Create metadata
      const metadata = {
        iv: iv.toString(ENCRYPTION_CONFIG.encoding),
        authTag: authTag.toString(ENCRYPTION_CONFIG.encoding),
        algorithm: ENCRYPTION_CONFIG.algorithm,
        originalName: path.basename(inputPath),
        encryptedAt: new Date().toISOString(),
        fileSize: fileData.length,
      };
      
      // Write encrypted file with metadata header
      const fileContent = {
        metadata,
        data: encrypted.toString(ENCRYPTION_CONFIG.encoding),
      };
      
      await fs.writeFile(outputPath, JSON.stringify(fileContent));
      
      logger.info('File encrypted successfully', {
        inputPath,
        outputPath,
        fileSize: fileData.length,
      });
      
      return metadata;
    } catch (error) {
      logger.error('File encryption failed', { error: error.message, inputPath });
      throw new Error('Failed to encrypt file');
    }
  }

  /**
   * Decrypt file
   * @param {string} inputPath - Encrypted file path
   * @param {string} outputPath - Output file path
   * @returns {Promise<Object>} File metadata
   */
  async decryptFile(inputPath, outputPath) {
    try {
      // Read encrypted file
      const fileContent = JSON.parse(await fs.readFile(inputPath, 'utf8'));
      
      // Extract metadata and data
      const { metadata, data } = fileContent;
      
      // Convert from base64
      const encrypted = Buffer.from(data, ENCRYPTION_CONFIG.encoding);
      const iv = Buffer.from(metadata.iv, ENCRYPTION_CONFIG.encoding);
      const authTag = Buffer.from(metadata.authTag, ENCRYPTION_CONFIG.encoding);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt file data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      
      // Write decrypted file
      await fs.writeFile(outputPath, decrypted);
      
      logger.info('File decrypted successfully', {
        inputPath,
        outputPath,
        originalName: metadata.originalName,
      });
      
      return metadata;
    } catch (error) {
      logger.error('File decryption failed', { error: error.message, inputPath });
      throw new Error('Failed to decrypt file');
    }
  }

  /**
   * Hash data using SHA-256
   * @param {string} data - Data to hash
   * @param {string} salt - Optional salt
   * @returns {string} Hashed data
   */
  hashData(data, salt = '') {
    const hash = crypto.createHash(ENCRYPTION_CONFIG.digest);
    hash.update(data + salt);
    return hash.digest(ENCRYPTION_CONFIG.encoding);
  }

  /**
   * Generate HMAC for data integrity
   * @param {string} data - Data to sign
   * @param {string} key - HMAC key
   * @returns {string} HMAC signature
   */
  generateHMAC(data, key = config.encryption.key) {
    const hmac = crypto.createHmac(ENCRYPTION_CONFIG.digest, key);
    hmac.update(data);
    return hmac.digest(ENCRYPTION_CONFIG.encoding);
  }

  /**
   * Verify HMAC signature
   * @param {string} data - Original data
   * @param {string} signature - HMAC signature to verify
   * @param {string} key - HMAC key
   * @returns {boolean} Verification result
   */
  verifyHMAC(data, signature, key = config.encryption.key) {
    const computedSignature = this.generateHMAC(data, key);
    return crypto.timingSafeEqual(
      Buffer.from(signature, ENCRYPTION_CONFIG.encoding),
      Buffer.from(computedSignature, ENCRYPTION_CONFIG.encoding)
    );
  }

  /**
   * Generate encryption key from password
   * @param {string} password - Password
   * @param {string} salt - Salt for key derivation
   * @returns {Buffer} Derived key
   */
  deriveKey(password, salt) {
    return crypto.pbkdf2Sync(
      password,
      salt,
      ENCRYPTION_CONFIG.iterations,
      ENCRYPTION_CONFIG.keyLength,
      ENCRYPTION_CONFIG.digest
    );
  }

  /**
   * Generate random encryption key
   * @returns {Object} Key and IV
   */
  generateKey() {
    return {
      key: crypto.randomBytes(ENCRYPTION_CONFIG.keyLength).toString('hex'),
      iv: crypto.randomBytes(ENCRYPTION_CONFIG.ivLength).toString('hex'),
    };
  }

  /**
   * Generate secure random token
   * @param {number} length - Token length in bytes
   * @returns {string} Random token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt bank details with extra security
   * @param {Object} bankDetails - Bank account details
   * @returns {Object} Encrypted bank details
   */
  encryptBankDetails(bankDetails) {
    try {
      // Validate required fields
      const requiredFields = ['accountNumber', 'ifsc'];
      for (const field of requiredFields) {
        if (!bankDetails[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      // Add timestamp for replay protection
      const dataWithTimestamp = {
        ...bankDetails,
        encryptedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      };
      
      // Encrypt with AAD for extra security
      const encrypted = this.encrypt(dataWithTimestamp, {
        aad: 'BANK_DETAILS_V1',
      });
      
      // Add integrity check
      encrypted.checksum = this.hashData(JSON.stringify(bankDetails));
      encrypted.type = 'BANK_DETAILS';
      
      logger.info('Bank details encrypted', {
        bankName: bankDetails.bankName,
        maskedAccount: this.maskAccountNumber(bankDetails.accountNumber),
      });
      
      return encrypted;
    } catch (error) {
      logger.error('Failed to encrypt bank details', { error: error.message });
      throw new Error('Failed to encrypt bank details');
    }
  }

  /**
   * Decrypt bank details
   * @param {Object} encryptedData - Encrypted bank details
   * @returns {Object} Decrypted bank details
   */
  decryptBankDetails(encryptedData) {
    try {
      // Verify type
      if (encryptedData.type !== 'BANK_DETAILS') {
        throw new Error('Invalid encrypted data type');
      }
      
      // Decrypt data
      const decrypted = this.decrypt(encryptedData);
      
      // Check expiration
      if (decrypted.expiresAt && new Date(decrypted.expiresAt) < new Date()) {
        throw new Error('Encrypted bank details have expired');
      }
      
      // Remove metadata
      delete decrypted.encryptedAt;
      delete decrypted.expiresAt;
      
      logger.info('Bank details decrypted', {
        maskedAccount: this.maskAccountNumber(decrypted.accountNumber),
      });
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt bank details', { error: error.message });
      throw new Error('Failed to decrypt bank details');
    }
  }

  /**
   * Encrypt API keys with rotation support
   * @param {Object} apiKeys - API keys object
   * @param {string} keyVersion - Key version identifier
   * @returns {Object} Encrypted API keys
   */
  encryptAPIKeys(apiKeys, keyVersion = 'v1') {
    try {
      // Add metadata for key rotation
      const dataWithMetadata = {
        keys: apiKeys,
        keyVersion,
        rotateAfter: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        encryptedAt: new Date().toISOString(),
      };
      
      // Encrypt with AAD
      const encrypted = this.encrypt(dataWithMetadata, {
        aad: `API_KEYS_${keyVersion}`,
      });
      
      encrypted.type = 'API_KEYS';
      encrypted.keyVersion = keyVersion;
      
      logger.info('API keys encrypted', {
        keyVersion,
        keyCount: Object.keys(apiKeys).length,
      });
      
      return encrypted;
    } catch (error) {
      logger.error('Failed to encrypt API keys', { error: error.message });
      throw new Error('Failed to encrypt API keys');
    }
  }

  /**
   * Decrypt API keys
   * @param {Object} encryptedData - Encrypted API keys
   * @returns {Object} Decrypted API keys
   */
  decryptAPIKeys(encryptedData) {
    try {
      // Verify type
      if (encryptedData.type !== 'API_KEYS') {
        throw new Error('Invalid encrypted data type');
      }
      
      // Decrypt data
      const decrypted = this.decrypt(encryptedData);
      
      // Check if rotation is needed
      if (decrypted.rotateAfter && new Date(decrypted.rotateAfter) < new Date()) {
        logger.warn('API keys need rotation', {
          keyVersion: decrypted.keyVersion,
          rotateAfter: decrypted.rotateAfter,
        });
      }
      
      return decrypted.keys;
    } catch (error) {
      logger.error('Failed to decrypt API keys', { error: error.message });
      throw new Error('Failed to decrypt API keys');
    }
  }

  /**
   * Encrypt sensitive contract data
   * @param {Object} contractData - Contract data
   * @returns {Object} Encrypted contract
   */
  encryptContract(contractData) {
    try {
      // Separate sensitive and non-sensitive data
      const { sensitiveTerms, ...publicData } = contractData;
      
      // Encrypt only sensitive terms
      const encryptedTerms = this.encrypt(sensitiveTerms, {
        aad: `CONTRACT_${contractData.contractId || 'NEW'}`,
      });
      
      return {
        ...publicData,
        encryptedTerms,
        encryptedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to encrypt contract', { error: error.message });
      throw new Error('Failed to encrypt contract');
    }
  }

  /**
   * Mask account number for logging
   * @private
   * @param {string} accountNumber - Bank account number
   * @returns {string} Masked account number
   */
  maskAccountNumber(accountNumber) {
    if (!accountNumber || accountNumber.length < 4) {
      return '****';
    }
    return `****${accountNumber.slice(-4)}`;
  }

  /**
   * Compare encrypted values without decrypting
   * @param {Object} encrypted1 - First encrypted value
   * @param {Object} encrypted2 - Second encrypted value
   * @returns {boolean} Whether values are equal
   */
  compareEncrypted(encrypted1, encrypted2) {
    return encrypted1.encrypted === encrypted2.encrypted &&
           encrypted1.authTag === encrypted2.authTag;
  }

  /**
   * Rotate encryption key
   * @param {Object} encryptedData - Data encrypted with old key
   * @param {Buffer} newKey - New encryption key
   * @returns {Object} Data encrypted with new key
   */
  rotateKey(encryptedData, newKey) {
    try {
      // Decrypt with current key
      const decrypted = this.decrypt(encryptedData);
      
      // Temporarily update key
      const oldKey = this.key;
      this.key = newKey;
      
      // Encrypt with new key
      const reencrypted = this.encrypt(decrypted);
      
      // Restore old key
      this.key = oldKey;
      
      // Add rotation metadata
      reencrypted.rotatedAt = new Date().toISOString();
      reencrypted.previousKeyHash = this.hashData(oldKey.toString('hex'));
      
      logger.info('Encryption key rotated successfully');
      
      return reencrypted;
    } catch (error) {
      logger.error('Key rotation failed', { error: error.message });
      throw new Error('Failed to rotate encryption key');
    }
  }
}

// Create singleton instance
const encryptionUtil = new EncryptionUtil();

// Export utility instance and methods
module.exports = encryptionUtil;

// Export static methods for convenience
module.exports.crypto = {
  encrypt: (data, options) => encryptionUtil.encrypt(data, options),
  decrypt: (encryptedData) => encryptionUtil.decrypt(encryptedData),
  encryptFile: (inputPath, outputPath) => encryptionUtil.encryptFile(inputPath, outputPath),
  decryptFile: (inputPath, outputPath) => encryptionUtil.decryptFile(inputPath, outputPath),
  hashData: (data, salt) => encryptionUtil.hashData(data, salt),
  generateHMAC: (data, key) => encryptionUtil.generateHMAC(data, key),
  verifyHMAC: (data, signature, key) => encryptionUtil.verifyHMAC(data, signature, key),
  generateKey: () => encryptionUtil.generateKey(),
  generateSecureToken: (length) => encryptionUtil.generateSecureToken(length),
  encryptBankDetails: (bankDetails) => encryptionUtil.encryptBankDetails(bankDetails),
  decryptBankDetails: (encryptedData) => encryptionUtil.decryptBankDetails(encryptedData),
  encryptAPIKeys: (apiKeys, keyVersion) => encryptionUtil.encryptAPIKeys(apiKeys, keyVersion),
  decryptAPIKeys: (encryptedData) => encryptionUtil.decryptAPIKeys(encryptedData),
  encryptContract: (contractData) => encryptionUtil.encryptContract(contractData),
  deriveKey: (password, salt) => encryptionUtil.deriveKey(password, salt),
  compareEncrypted: (encrypted1, encrypted2) => encryptionUtil.compareEncrypted(encrypted1, encrypted2),
  rotateKey: (encryptedData, newKey) => encryptionUtil.rotateKey(encryptedData, newKey),
};