/**
 * CreatorsMantra Backend - Authentication Service
 * Complete authentication business logic with OTP, manager invitations, and subscription management
 * 
 * @author CreatorsMantra Team
 * @version 1.0.0
 */

const { User, CreatorProfile, SubscriptionHistory } = require('./model');
const { 
  generateToken, 
  generateRefreshToken, 
  generateRandomString,
  createError,
  log,
  formatToIST,
  hashPassword,
  successResponse,
  errorResponse
} = require('../../shared/utils');

class AuthService {
  constructor() {
    this.otpExpiry = 5 * 60 * 1000; // 5 minutes
    this.maxOtpAttempts = 3;
    this.maxLoginAttempts = 5;
    this.lockDuration = 2 * 60 * 60 * 1000; // 2 hours
    this.trialDuration = 14 * 24 * 60 * 60 * 1000; // 14 days
  }

  /**
   * Check if phone number exists in database
   * @param {string} phone - Phone number to check
   * @returns {Promise<Object>} Check result with user info if exists
   */
  async checkPhoneExists(phone) {
    try {
      // Validate phone format
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        throw createError('Invalid phone number format', 400, 'INVALID_PHONE');
      }

      const user = await User.findOne({ phone }).select('_id fullName email userType accountStatus isPhoneVerified subscriptionStatus');
      
      if (user) {
        log('info', 'Phone number check - exists', { phone, userId: user._id });
        return {
          exists: true,
          user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            userType: user.userType,
            accountStatus: user.accountStatus,
            isPhoneVerified: user.isPhoneVerified,
            subscriptionStatus: user.subscriptionStatus
          }
        };
      }

      log('info', 'Phone number check - new user', { phone });
      return { exists: false };

    } catch (error) {
      log('error', 'Phone check failed', { phone, error: error.message });
      throw error;
    }
  }

  /**
   * Generate and send OTP for phone verification
   * @param {string} phone - Phone number
   * @param {string} purpose - OTP purpose (registration, login, password_reset)
   * @returns {Promise<Object>} OTP generation result
   */
  async generateOTP(phone, purpose = 'registration') {
    try {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
      const otpExpires = new Date(Date.now() + this.otpExpiry);

      // Check if user exists for login/password reset
      if (purpose !== 'registration') {
        const user = await User.findOne({ phone });
        if (!user) {
          throw createError('Phone number not registered', 404, 'PHONE_NOT_FOUND');
        }

        // Check OTP attempts
        if (user.otpAttempts >= this.maxOtpAttempts) {
          throw createError('Too many OTP attempts. Please try again after some time.', 429, 'OTP_LIMIT_EXCEEDED');
        }

        // Update user with new OTP
        await User.updateOne(
          { phone },
          {
            $set: {
              otpCode,
              otpExpires,
              otpAttempts: 0
            }
          }
        );
      }

      // Send OTP via SMS using Twilio
      await this.sendOTPSMS(phone, otpCode, purpose);

      log('info', 'OTP generated successfully', { 
        phone, 
        purpose,
        expiresAt: formatToIST(otpExpires)
      });

      return {
        success: true,
        message: 'OTP sent successfully',
        expiresIn: this.otpExpiry / 1000, // seconds
        // Include OTP in development for testing
        ...(process.env.NODE_ENV === 'development' && { otp: otpCode })
      };

    } catch (error) {
      log('error', 'OTP generation failed', { phone, purpose, error: error.message });
      throw error;
    }
  }

  /**
   * Send OTP via SMS using Twilio
   * @param {string} phone - Phone number
   * @param {string} otpCode - OTP code
   * @param {string} purpose - OTP purpose
   */
  async sendOTPSMS(phone, otpCode, purpose) {
    try {
      // Skip SMS in development/test environment
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        log('info', 'SMS sending skipped in development', { phone, otpCode });
        return;
      }

      const twilioClient = require('twilio')(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      const messageTemplates = {
        registration: `Welcome to CreatorsMantra! Your verification code is: ${otpCode}. Valid for 5 minutes. Don't share this code with anyone.`,
        login: `Your CreatorsMantra login code is: ${otpCode}. Valid for 5 minutes. Don't share this code with anyone.`,
        password_reset: `Your CreatorsMantra password reset code is: ${otpCode}. Valid for 5 minutes. Don't share this code with anyone.`
      };

      await twilioClient.messages.create({
        body: messageTemplates[purpose] || messageTemplates.registration,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${phone}`
      });

      log('info', 'OTP SMS sent successfully', { phone, purpose });

    } catch (error) {
      log('error', 'SMS sending failed', { phone, error: error.message });
      throw createError('Failed to send OTP. Please try again.', 500, 'SMS_SEND_FAILED');
    }
  }

  /**
   * Verify OTP code
   * @param {string} phone - Phone number
   * @param {string} otpCode - OTP code to verify
   * @param {string} purpose - OTP purpose
   * @returns {Promise<Object>} Verification result
   */
  async verifyOTP(phone, otpCode, purpose = 'registration') {
    try {
      let user;

      if (purpose === 'registration') {
        // For registration, OTP might be temporary stored or we create user after verification
        // We'll handle this in the registration flow
        return {
          success: true,
          message: 'OTP verified successfully',
          phone
        };
      } else {
        // For login/password reset, find existing user
        user = await User.findOne({ phone });
        if (!user) {
          throw createError('Phone number not registered', 404, 'PHONE_NOT_FOUND');
        }
      }

      // Check if OTP exists and is valid
      if (!user.otpCode || !user.otpExpires) {
        throw createError('No OTP found. Please request a new OTP.', 400, 'NO_OTP_FOUND');
      }

      // Check if OTP has expired
      if (user.otpExpires < new Date()) {
        throw createError('OTP has expired. Please request a new OTP.', 400, 'OTP_EXPIRED');
      }

      // Check if OTP matches
      if (user.otpCode !== otpCode) {
        // Increment OTP attempts
        await User.updateOne(
          { phone },
          { $inc: { otpAttempts: 1 } }
        );

        throw createError('Invalid OTP. Please try again.', 400, 'INVALID_OTP');
      }

      // OTP verified successfully - clear OTP data
      await User.updateOne(
        { phone },
        {
          $unset: {
            otpCode: 1,
            otpExpires: 1,
            otpAttempts: 1
          },
          $set: {
            isPhoneVerified: true,
            lastLogin: new Date()
          }
        }
      );

      log('info', 'OTP verified successfully', { phone, purpose, userId: user._id });

      return {
        success: true,
        message: 'OTP verified successfully',
        user: {
          id: user._id,
          phone: user.phone,
          isPhoneVerified: true
        }
      };

    } catch (error) {
      log('error', 'OTP verification failed', { phone, purpose, error: error.message });
      throw error;
    }
  }

  /**
   * Register new creator
   * @param {Object} registrationData - User registration data
   * @returns {Promise<Object>} Registration result with tokens
   */
  async registerCreator(registrationData) {
    try {
      const {
        fullName,
        email,
        phone,
        password,
        userType = 'creator',
        creatorType,
        socialProfiles = {}
      } = registrationData;

      // Validate required fields
      if (!fullName || !email || !phone || !password) {
        throw createError('Missing required fields', 400, 'MISSING_FIELDS');
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { phone }]
      });

      if (existingUser) {
        throw createError('User already exists with this email or phone', 409, 'USER_EXISTS');
      }

      // Create new user
      const user = new User({
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone,
        password,
        userType,
        accountStatus: 'active',
        isPhoneVerified: true, // Assuming OTP was verified before registration
        subscriptionStatus: 'trial',
        subscriptionStartDate: new Date(),
        subscriptionEndDate: new Date(Date.now() + this.trialDuration)
      });

      await user.save();

      // Create creator profile
      const creatorProfile = new CreatorProfile({
        userId: user._id,
        creatorType: creatorType || 'lifestyle',
        socialProfiles: {
          instagram: {
            username: socialProfiles.instagram?.username || '',
            followersCount: socialProfiles.instagram?.followersCount || 0,
            avgLikes: socialProfiles.instagram?.avgLikes || 0,
            avgComments: socialProfiles.instagram?.avgComments || 0
          },
          youtube: {
            channelName: socialProfiles.youtube?.channelName || '',
            subscribersCount: socialProfiles.youtube?.subscribersCount || 0,
            avgViews: socialProfiles.youtube?.avgViews || 0
          }
        }
      });

      await creatorProfile.save();

      // Calculate suggested rates based on social media data
      const suggestedRates = creatorProfile.getSuggestedRates();
      creatorProfile.rateCard = suggestedRates;
      await creatorProfile.save();

      // Create subscription history entry
      const subscriptionHistory = new SubscriptionHistory({
        userId: user._id,
        tier: user.subscriptionTier,
        status: 'trial',
        startDate: user.subscriptionStartDate,
        endDate: user.subscriptionEndDate,
        paymentAmount: 0,
        paymentStatus: 'verified' // Trial doesn't require payment
      });

      await subscriptionHistory.save();

      // Generate tokens
      const tokenPayload = {
        id: user._id,
        email: user.email,
        role: user.role,
        subscriptionTier: user.subscriptionTier
      };

      const accessToken = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Send welcome email
      await this.sendWelcomeEmail(user, creatorProfile);

      log('info', 'User registered successfully', {
        userId: user._id,
        email: user.email,
        phone: user.phone,
        userType: user.userType
      });

      return {
        success: true,
        message: 'Registration successful',
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          userType: user.userType,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus,
          trialEndsAt: user.subscriptionEndDate,
          profileCompletion: user.profileCompletion
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };

    } catch (error) {
      log('error', 'User registration failed', { 
        email: registrationData.email,
        phone: registrationData.phone,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Login user with password
   * @param {string} identifier - Email or phone
   * @param {string} password - User password
   * @returns {Promise<Object>} Login result with tokens
   */
  async loginWithPassword(identifier, password) {
    try {
      // Find user by email or phone
      const user = await User.findByEmailOrPhone(identifier).select('+password');
      
      if (!user) {
        throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Check if account is locked
      if (user.isLocked()) {
        throw createError('Account is temporarily locked. Please try again later.', 423, 'ACCOUNT_LOCKED');
      }

      // Check if account is active
      if (user.accountStatus !== 'active') {
        throw createError('Account is not active. Please contact support.', 403, 'ACCOUNT_INACTIVE');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        // Increment login attempts
        await user.incLoginAttempts();
        throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const tokenPayload = {
        id: user._id,
        email: user.email,
        role: user.role,
        subscriptionTier: user.subscriptionTier
      };

      const accessToken = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      log('info', 'User logged in successfully', {
        userId: user._id,
        email: user.email,
        loginMethod: 'password'
      });

      return {
        success: true,
        message: 'Login successful',
        user: await this.getUserProfile(user._id),
        tokens: {
          accessToken,
          refreshToken
        }
      };

    } catch (error) {
      log('error', 'Password login failed', { identifier, error: error.message });
      throw error;
    }
  }

  /**
   * Login user with OTP
   * @param {string} phone - Phone number
   * @param {string} otpCode - OTP code
   * @returns {Promise<Object>} Login result with tokens
   */
  async loginWithOTP(phone, otpCode) {
    try {
      // Verify OTP
      const verificationResult = await this.verifyOTP(phone, otpCode, 'login');
      
      if (!verificationResult.success) {
        throw createError('OTP verification failed', 400, 'OTP_VERIFICATION_FAILED');
      }

      // Find user
      const user = await User.findOne({ phone });
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Check if account is active
      if (user.accountStatus !== 'active') {
        throw createError('Account is not active. Please contact support.', 403, 'ACCOUNT_INACTIVE');
      }

      // Generate tokens
      const tokenPayload = {
        id: user._id,
        email: user.email,
        role: user.role,
        subscriptionTier: user.subscriptionTier
      };

      const accessToken = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      log('info', 'User logged in successfully', {
        userId: user._id,
        phone: user.phone,
        loginMethod: 'otp'
      });

      return {
        success: true,
        message: 'Login successful',
        user: await this.getUserProfile(user._id),
        tokens: {
          accessToken,
          refreshToken
        }
      };

    } catch (error) {
      log('error', 'OTP login failed', { phone, error: error.message });
      throw error;
    }
  }

  /**
   * Reset password with OTP
   * @param {string} phone - Phone number
   * @param {string} otpCode - OTP code
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Password reset result
   */
  async resetPassword(phone, otpCode, newPassword) {
    try {
      // Verify OTP
      const verificationResult = await this.verifyOTP(phone, otpCode, 'password_reset');
      
      if (!verificationResult.success) {
        throw createError('OTP verification failed', 400, 'OTP_VERIFICATION_FAILED');
      }

      // Find user and update password
      const user = await User.findOne({ phone });
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      user.password = newPassword;
      await user.save();

      // Send password reset confirmation email
      await this.sendPasswordResetConfirmationEmail(user);

      log('info', 'Password reset successfully', {
        userId: user._id,
        phone: user.phone
      });

      return {
        success: true,
        message: 'Password reset successful. You can now login with your new password.'
      };

    } catch (error) {
      log('error', 'Password reset failed', { phone, error: error.message });
      throw error;
    }
  }

  /**
   * Get complete user profile with creator data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Complete user profile
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      const creatorProfile = await CreatorProfile.findOne({ userId }).populate('managers.managerId', 'fullName email phone');

      const profile = {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        profilePicture: user.profilePicture,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        address: user.address,
        userType: user.userType,
        role: user.role,
        accountStatus: user.accountStatus,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
        profileCompletion: user.profileCompletion,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        preferences: user.preferences
      };

      if (creatorProfile) {
        profile.creatorProfile = {
          creatorType: creatorProfile.creatorType,
          bio: creatorProfile.bio,
          experienceLevel: creatorProfile.experienceLevel,
          socialProfiles: creatorProfile.socialProfiles,
          contentCategories: creatorProfile.contentCategories,
          languages: creatorProfile.languages,
          targetAudience: creatorProfile.targetAudience,
          rateCard: creatorProfile.rateCard,
          bankDetails: creatorProfile.bankDetails,
          upiDetails: creatorProfile.upiDetails,
          gstDetails: creatorProfile.gstDetails,
          panDetails: creatorProfile.panDetails,
          managers: creatorProfile.managers,
          stats: creatorProfile.stats,
          workPreferences: creatorProfile.workPreferences,
          socialPresenceScore: creatorProfile.socialPresenceScore
        };
      }

      return profile;

    } catch (error) {
      log('error', 'Get user profile failed', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated profile
   */
  async updateUserProfile(userId, updateData) {
    try {
      const { creatorProfile, ...userData } = updateData;

      // Update user data
      if (Object.keys(userData).length > 0) {
        await User.findByIdAndUpdate(userId, userData, { new: true, runValidators: true });
      }

      // Update creator profile data
      if (creatorProfile && Object.keys(creatorProfile).length > 0) {
        await CreatorProfile.findOneAndUpdate(
          { userId },
          creatorProfile,
          { new: true, runValidators: true, upsert: true }
        );
      }

      log('info', 'User profile updated successfully', { userId });

      return await this.getUserProfile(userId);

    } catch (error) {
      log('error', 'Profile update failed', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Invite manager to creator account
   * @param {string} creatorId - Creator user ID
   * @param {Object} managerData - Manager invitation data
   * @returns {Promise<Object>} Invitation result
   */
  async inviteManager(creatorId, managerData) {
    try {
      const {
        managerName,
        managerEmail,
        managerPhone,
        relationship = 'professional_manager',
        permissions = {},
        revenueShare = 0
      } = managerData;

      // Find creator profile
      const creatorProfile = await CreatorProfile.findOne({ userId: creatorId });
      if (!creatorProfile) {
        throw createError('Creator profile not found', 404, 'CREATOR_NOT_FOUND');
      }

      // Check if manager already exists
      const existingManager = creatorProfile.managers.find(
        manager => manager.managerEmail === managerEmail && manager.status !== 'removed'
      );

      if (existingManager) {
        throw createError('Manager already invited or active', 409, 'MANAGER_EXISTS');
      }

      // Add manager to creator's manager list
      const defaultPermissions = {
        profile: {
          viewProfile: true,
          editBasicInfo: true,
          editSocialMedia: false,
          editBankDetails: false,
          editPersonalInfo: false
        },
        deals: {
          viewDeals: true,
          createDeals: true,
          editDeals: true,
          deleteDeals: false,
          negotiateRates: true
        },
        invoices: {
          viewInvoices: true,
          createInvoices: true,
          sendInvoices: true,
          receivePayments: false
        },
        communication: {
          emailNotifications: true,
          brandCommunication: true,
          contractNegotiation: true
        }
      };

      const managerEntry = {
        managerName,
        managerEmail: managerEmail.toLowerCase(),
        managerPhone,
        relationship,
        permissions: { ...defaultPermissions, ...permissions },
        revenueShare: Math.min(Math.max(revenueShare, 0), 50), // 0-50%
        status: 'pending',
        invitedAt: new Date()
      };

      creatorProfile.managers.push(managerEntry);
      await creatorProfile.save();

      // Send manager invitation email
      await this.sendManagerInvitationEmail(managerData, creatorProfile);

      log('info', 'Manager invited successfully', {
        creatorId,
        managerEmail,
        relationship
      });

      return {
        success: true,
        message: 'Manager invitation sent successfully',
        invitation: {
          managerEmail,
          status: 'pending',
          invitedAt: managerEntry.invitedAt
        }
      };

    } catch (error) {
      log('error', 'Manager invitation failed', { creatorId, error: error.message });
      throw error;
    }
  }

  /**
   * Accept manager invitation
   * @param {string} invitationToken - Invitation token
   * @param {Object} managerData - Manager registration data
   * @returns {Promise<Object>} Acceptance result
   */
  async acceptManagerInvitation(invitationToken, managerData) {
    try {
      // This would require implementing invitation token system
      // For now, we'll implement a simple email-based acceptance
      
      const { email, password, fullName } = managerData;

      // Find creator profile with pending manager invitation
      const creatorProfile = await CreatorProfile.findOne({
        'managers.managerEmail': email.toLowerCase(),
        'managers.status': 'pending'
      });

      if (!creatorProfile) {
        throw createError('Manager invitation not found or expired', 404, 'INVITATION_NOT_FOUND');
      }

      // Create manager user account
      const managerUser = new User({
        fullName,
        email: email.toLowerCase(),
        phone: managerData.phone,
        password,
        role: 'manager',
        userType: 'creator_with_manager',
        accountStatus: 'active',
        isEmailVerified: true
      });

      await managerUser.save();

      // Update manager entry in creator profile
      const managerIndex = creatorProfile.managers.findIndex(
        manager => manager.managerEmail === email.toLowerCase() && manager.status === 'pending'
      );

      if (managerIndex !== -1) {
        creatorProfile.managers[managerIndex].managerId = managerUser._id;
        creatorProfile.managers[managerIndex].status = 'active';
        creatorProfile.managers[managerIndex].acceptedAt = new Date();
        creatorProfile.managers[managerIndex].lastActive = new Date();

        await creatorProfile.save();
      }

      log('info', 'Manager invitation accepted', {
        managerId: managerUser._id,
        creatorId: creatorProfile.userId,
        managerEmail: email
      });

      return {
        success: true,
        message: 'Manager invitation accepted successfully',
        manager: {
          id: managerUser._id,
          fullName: managerUser.fullName,
          email: managerUser.email,
          role: managerUser.role
        }
      };

    } catch (error) {
      log('error', 'Manager invitation acceptance failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   * @param {Object} user - User object
   * @param {Object} creatorProfile - Creator profile object
   */
  async sendWelcomeEmail(user, creatorProfile) {
    try {
      // Skip email in development/test environment
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        log('info', 'Welcome email skipped in development', { userId: user._id });
        return;
      }

      const emailService = require('../../shared/services/email/emailService');
      
      await emailService.sendEmail({
        to: user.email,
        subject: 'Welcome to CreatorsMantra! 🚀',
        template: 'welcome',
        data: {
          fullName: user.fullName,
          subscriptionTier: user.subscriptionTier,
          trialEndsAt: formatToIST(user.subscriptionEndDate),
          loginUrl: `${process.env.FRONTEND_URL}/login`
        }
      });

      log('info', 'Welcome email sent successfully', { userId: user._id });

    } catch (error) {
      log('error', 'Welcome email failed', { userId: user._id, error: error.message });
      // Don't throw error for email failures
    }
  }

  /**
   * Send password reset confirmation email
   * @param {Object} user - User object
   */
  async sendPasswordResetConfirmationEmail(user) {
    try {
      // Skip email in development/test environment
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        log('info', 'Password reset email skipped in development', { userId: user._id });
        return;
      }

      const emailService = require('../../shared/services/email/emailService');
      
      await emailService.sendEmail({
        to: user.email,
        subject: 'Password Reset Successful - CreatorsMantra',
        template: 'password_reset_confirmation',
        data: {
          fullName: user.fullName,
          resetTime: formatToIST(new Date()),
          loginUrl: `${process.env.FRONTEND_URL}/login`
        }
      });

      log('info', 'Password reset confirmation email sent', { userId: user._id });

    } catch (error) {
      log('error', 'Password reset confirmation email failed', { userId: user._id, error: error.message });
      // Don't throw error for email failures
    }
  }

  /**
   * Send manager invitation email
   * @param {Object} managerData - Manager data
   * @param {Object} creatorProfile - Creator profile
   */
  async sendManagerInvitationEmail(managerData, creatorProfile) {
    try {
      // Skip email in development/test environment
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        log('info', 'Manager invitation email skipped in development', { 
          managerEmail: managerData.managerEmail 
        });
        return;
      }

      const emailService = require('../../shared/services/email/emailService');
      const creator = await User.findById(creatorProfile.userId);
      
      await emailService.sendEmail({
        to: managerData.managerEmail,
        subject: `${creator.fullName} invited you to manage their CreatorsMantra account`,
        template: 'manager_invitation',
        data: {
          managerName: managerData.managerName,
          creatorName: creator.fullName,
          relationship: managerData.relationship,
          acceptUrl: `${process.env.FRONTEND_URL}/manager/accept-invitation?email=${managerData.managerEmail}`
        }
      });

      log('info', 'Manager invitation email sent', { 
        managerEmail: managerData.managerEmail,
        creatorId: creatorProfile.userId 
      });

    } catch (error) {
      log('error', 'Manager invitation email failed', { 
        managerEmail: managerData.managerEmail,
        error: error.message 
      });
      // Don't throw error for email failures
    }
  }

  /**
   * Refresh JWT tokens
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New tokens
   */
  async refreshTokens(refreshToken) {
    try {
      const decoded = verifyToken(refreshToken);
      
      // Find user to ensure they still exist and are active
      const user = await User.findById(decoded.id);
      if (!user || user.accountStatus !== 'active') {
        throw createError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      // Generate new tokens
      const tokenPayload = {
        id: user._id,
        email: user.email,
        role: user.role,
        subscriptionTier: user.subscriptionTier
      };

      const newAccessToken = generateToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      log('info', 'Tokens refreshed successfully', { userId: user._id });

      return {
        success: true,
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      };

    } catch (error) {
      log('error', 'Token refresh failed', { error: error.message });
      throw createError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }
  }

  /**
   * Logout user (invalidate tokens)
   * @param {string} userId - User ID
   * @param {string} deviceId - Device ID (optional)
   * @returns {Promise<Object>} Logout result
   */
  async logout(userId, deviceId = null) {
    try {
      // In a real implementation, you would maintain a token blacklist
      // For now, we'll just log the logout event
      
      if (deviceId) {
        // Remove specific device
        await User.updateOne(
          { _id: userId },
          { $pull: { activeDevices: { deviceId } } }
        );
      }

      log('info', 'User logged out successfully', { userId, deviceId });

      return {
        success: true,
        message: 'Logged out successfully'
      };

    } catch (error) {
      log('error', 'Logout failed', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = new AuthService();