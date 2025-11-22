import crypto from 'crypto';
import User from '../models/User.model.js';
import RefreshToken from '../models/RefreshToken.model.js';
import { tokenService } from '../services/token.service.js';
import { emailService } from '../services/email.service.js';
import logger from '../config/logger.js';
import { sendSuccess } from '../utils/response.js';
import AppError from '../utils/appError.js';

// --- Helper Functions ---

/**
 * Generates auth tokens, saves the refresh token, and sets the cookie.
 * @param {import('express').Response} res - Express response object
 * @param {Object} user - Mongoose user document
 * @param {string} userAgent - User agent string
 */
const sendAuthTokens = async (res, user, userAgent) => {
  const { accessToken, refreshToken, refreshTokenExpiresAt } =
    tokenService.generateAuthTokens(user);

  // Hash the refresh token before saving
  const refreshTokenHash = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');

  await RefreshToken.create({
    user: user._id,
    tokenHash: refreshTokenHash,
    expiresAt: refreshTokenExpiresAt,
    userAgent,
  });

  // Set the refresh token in a secure, HttpOnly cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: refreshTokenExpiresAt,
  });

  // Send the access token and user info in the response body
  return sendSuccess(res, 200, {
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
};

/**
 * Invalidates all refresh tokens for a user.
 * @param {string} userId - The user's ID
 */
const invalidateAllRefreshTokens = async (userId) => {
  await RefreshToken.updateMany({ user: userId, isValid: true }, { isValid: false });
  logger.info(`Invalidated all refresh tokens for user ${userId}`);
};

/**
 * Clears the refresh token cookie.
 * @param {import('express').Response} res - Express response object
 */
const clearRefreshTokenCookie = (res) => {
  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(0), // Expire immediately
  });
};

// --- Controller Methods ---

export const authController = {
  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  register: async (req, res, next) => {
    try {
      const { email, password, name } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return next(AppError.conflict('Email already in use', 'EMAIL_IN_USE'));
      }
        
     let emailStatus = 'UNKNOWN';
    try {
      const response = await axios.get('https://api.mailbite.io/verify', {
        params: { key: process.env.MAILBITE_API_KEY, email },
      });
      emailStatus = response.data.email_status;
    } catch (error) {
      console.log('Mailbite API failed', { error: error.message });
      // Optionally allow registration to proceed without email verification
      // or return a specific error
    }
    if (emailStatus !== 'VALID' && emailStatus !== 'UNKNOWN') {
       return next(AppError.badRequest('Email is invalid or does not exist', 'INVALID_EMAIL'));
    }
      const user = new User({ email, password, name });
      await user.save();

      // Send verification email
      const verificationToken = tokenService.generateVerificationToken(user);
      await emailService.sendVerificationEmail(
        user.email,
        user.name,
        verificationToken
      );

      return sendSuccess(
        res,
        201,
        null,
        'Registration successful. Please check your email to verify your account.'
      );
    } catch (err) {
      next(err);
    }
  },

  /**
   * Verify user's email address
   * GET /api/v1/auth/verify-email?token=<token>
   */
  verifyEmail: async (req, res, next) => {
    try {
      const { token } = req.query;
      if (!token) {
        return res.status(400).json({ message: 'Missing verification token' });
      }

      const payload = tokenService.verifyVerificationToken(token);
      if (!payload) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }

      const user = await User.findById(payload.sub);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (user.isVerified) {
        return res  
          .status(200)
          .redirect(`${process.env.CLIENT_URL}/login?verified=true`);
      }

      user.isVerified = true;
      await user.save();

      logger.info(`Email verified for user: ${user.email}`);

      // Redirect to login page on success
      res.redirect(`${process.env.CLIENT_URL}/login?verified=true`);
    } catch (err) {
      console.log(err)
      // Handle expired token error specifically
      if (err.name === 'TokenExpiredError') {
        return res.redirect(
          `${process.env.CLIENT_URL}/email-verification?error=expired`
        );
      }
      logger.error('Email verification error:', err);
      res.redirect(
        `${process.env.CLIENT_URL}/email-verification?error=invalid`
      );
    }
  },

  /**
   * Log in a user
   * POST /api/v1/auth/login
   */
  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const userAgent = req.headers['user-agent'] || 'unknown';

      const user = await User.findOne({ email }).select('+password');

      if (!user || !(await user.comparePassword(password))) {
        return next(AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS'));
      }

      if (!user.isVerified) {
        return next(AppError.forbidden('Please verify your email address to log in.', 'EMAIL_NOT_VERIFIED'));
      }

      // User is authenticated and verified, send tokens
      await sendAuthTokens(res, user, userAgent);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Refresh the access token
   * POST /api/v1/auth/refresh-token
   */
  refreshToken: async (req, res, next) => {
    try {
      const { refreshToken } = req.cookies;
      const userAgent = req.headers['user-agent'] || 'unknown';

      if (!refreshToken) {
        return next(AppError.unauthorized('Access denied. No refresh token.', 'NO_REFRESH_TOKEN'));
      }

      // Hash the incoming token to find it in the DB
      const refreshTokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      const tokenDoc = await RefreshToken.findOne({
        tokenHash: refreshTokenHash,
      }).populate('user');

      // Check if token is valid (exists, not expired, not invalidated)
      if (
        !tokenDoc ||
        !tokenDoc.isValid ||
        tokenDoc.expiresAt < new Date() ||
        !tokenDoc.user
      ) {
        // Clear the bad cookie
        clearRefreshTokenCookie(res);
        logger.warn('Invalid or expired refresh token used.');
        return next(AppError.forbidden('Invalid or expired refresh token.', 'INVALID_REFRESH_TOKEN'));
      }

      // --- Token Rotation ---
      // Invalidate the old token
      tokenDoc.isValid = false;
      await tokenDoc.save();

      // Issue new tokens
      await sendAuthTokens(res, tokenDoc.user, userAgent);
      logger.info(`Refreshed token for user: ${tokenDoc.user.email}`);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Log out a user
   * POST /api/v1/auth/logout
   */
  logout: async (req, res, next) => {
    try {
      const { refreshToken } = req.cookies;

      if (refreshToken) {
        const refreshTokenHash = crypto
          .createHash('sha256')
          .update(refreshToken)
          .digest('hex');

        // Invalidate the token in the database
        await RefreshToken.findOneAndUpdate(
          { tokenHash: refreshTokenHash },
          { isValid: false }
        );
      }

      // Clear the cookie
      clearRefreshTokenCookie(res);

      return sendSuccess(res, 200, null, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Forgot password
   * POST /api/v1/auth/forgot-password
   */
  forgotPassword: async (req, res, next) => {
    try {
      console.log('😂😂', req.body)
      const { email } = req.body;
      const user = await User.findOne({ email });

      // Important: Always send a success-like response to prevent email enumeration
      if (!user) {
        logger.warn(`Password reset attempt for non-existent user: ${email}`);
        return sendSuccess(
          res,
          200,
          null,
          'If an account with that email exists, a reset link has been sent.'
        );
      }

      const resetToken = tokenService.generatePasswordResetToken(user);
      await emailService.sendPasswordResetEmail(user.email, user.name, resetToken);

      return sendSuccess(
        res,
        200,
        null,
        'If an account with that email exists, a reset link has been sent.'
      );
    } catch (err) {
      next(err);
    }
  },

  /**
   * Reset password
   * POST /api/v1/auth/reset-password?token=<token>
   */
  resetPassword: async (req, res, next) => {
    try {
      const { token } = req.query;
      const { password } = req.body;

      if (!token) {
        return next(AppError.badRequest('Missing password reset token', 'MISSING_TOKEN'));
      }

      const payload = tokenService.verifyPasswordResetToken(token);
      if (!payload) {
        return next(AppError.badRequest('Invalid or expired token', 'INVALID_TOKEN'));
      }

      const user = await User.findById(payload.sub);
      if (!user) {
        return next(AppError.notFound('User not found', 'USER_NOT_FOUND'));
      }

      // Set new password
      user.password = password;
      await user.save();

      // Invalidate all existing sessions
      await invalidateAllRefreshTokens(user._id);

      logger.info(`Password reset for user: ${user.email}`);
      return sendSuccess(res, 200, null, 'Password reset successful. Please log in.');
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(AppError.badRequest('Password reset token has expired.', 'TOKEN_EXPIRED'));
      }
      next(err);
    }
  },

  /**
   * Google OAuth Callback
   * GET /api/v1/auth/google/callback
   */
  googleCallback: async (req, res, next) => {
    // This controller is hit after passport middleware runs successfully
    try {
      const userAgent = req.headers['user-agent'] || 'unknown';
      // req.user is populated by passport
      const user = req.user;

      if (!user) {
        return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
      }

      // We need to set the cookie on the response *before* redirecting
      // So we can't use the standard sendAuthTokens helper
      const { accessToken, refreshToken, refreshTokenExpiresAt } =
        tokenService.generateAuthTokens(user);

      const refreshTokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      await RefreshToken.create({
        user: user._id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
        userAgent,
      });

      // Set cookie and redirect to the client, which will handle the token
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: refreshTokenExpiresAt,
      });

      // We redirect to a special client-side page that will
      // grab the access token from the URL (or storage) and save it.
      // A cleaner way is to redirect to a page that *knows* it's
      // an oauth callback and makes a request to a /me endpoint
      // to get user data, using the cookie that was just set.

      // Let's redirect to a callback page with the access token in a query param
      // This is less secure. Let's not.
      // The cookie is set. The client just needs to be redirected to a page
      // that knows to store the access token.

      // Better flow:
      // 1. Cookie is set.
      // 2. Redirect to a client page: /google-callback
      // 3. This page's entire job is to:
      //    a) Make a *single* POST request to a new endpoint `/api/v1/auth/oauth-token`
      //    b) This endpoint is just like `/refresh-token` but doesn't require an old token,
      //       it just reads the cookie set by *this* callback, and returns an access token.
      //    c) This is overly complex.

      // Simple flow:
      // 1. Cookie is set.
      // 2. Redirect to client.
      // 3. Client's main app component will try to fetch `/me`.
      // 4. It will fail (no access token).
      // 5. It will then *immediately* call `/refresh-token`.
      // 6. This will use the cookie we just set, and return a new access token.
      // 7. Client is now logged in.

      // Let's redirect to a simple callback handler page.
      res.redirect(`${process.env.CLIENT_URL}/google-callback`);
    } catch (err) {
      logger.error('Error in Google OAuth callback controller:', err);
      res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }
  },
};