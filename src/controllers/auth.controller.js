import crypto from 'crypto';
import User from '../models/User.model.js';
import RefreshToken from '../models/RefreshToken.model.js';
import { tokenService } from '../services/token.service.js';
import { emailService } from '../services/email.service.js';
import logger from '../config/logger.js';
import { sendSuccess } from '../utils/response.js';
import AppError from '../utils/appError.js';
import axios from 'axios';
import { asyncHandler } from '../utils/asyncHandler.js';

const isDevelopment = process.env.NODE_ENV === 'development';

// ── Helper Functions ────────────────────────────────────────────────────────

/**
 * Build cookie options based on environment.
 * - In production: secure=true, sameSite='none' (required for cross-origin cookies
 *   between Vercel frontend and hosted backend).
 * - In development: secure=false, sameSite='lax' (works fine on localhost).
 */
const getRefreshCookieOptions = (expiresAt) => ({
  httpOnly: true,
  secure: true, // MUST be true for cross-domain cookies (Vercel to Render)
  sameSite: 'none', // MUST be 'none' for cross-domain
  expires: expiresAt,
  path: '/',
});

const sendAuthTokens = async (res, user, userAgent) => {
  const { accessToken, refreshToken, refreshTokenExpiresAt } =
    tokenService.generateAuthTokens(user);

  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await RefreshToken.create({
    user: user._id,
    tokenHash: refreshTokenHash,
    expiresAt: refreshTokenExpiresAt,
    userAgent,
  });

  res.cookie('refreshToken', refreshToken, getRefreshCookieOptions(refreshTokenExpiresAt));

  return sendSuccess(
    res,
    200,
    {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        subscription: user.subscription,
        preferences: user.preferences,
      },
    },
    'Authentication successful'
  );
};

const invalidateAllRefreshTokens = async (userId) => {
  await RefreshToken.updateMany({ user: userId, isValid: true }, { isValid: false });
  logger.info(`Invalidated all refresh tokens for user ${userId}`);
};

const clearRefreshTokenCookie = (res) => {
  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: isDevelopment ? 'lax' : 'none',
    expires: new Date(0),
    path: '/',
  });
};

// ── Controllers ─────────────────────────────────────────────────────────────

export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw AppError.conflict('Email already in use', 'EMAIL_IN_USE');
  }

  // Mailbite email validation (non-blocking — if API fails we still allow registration)
  let emailStatus = 'UNKNOWN';
  try {
    const response = await axios.get('https://api.mailbite.io/verify', {
      params: { key: process.env.MAILBITE_API_KEY, email: normalizedEmail },
      timeout: 5000,
    });
    emailStatus = response.data.email_status;
  } catch (error) {
    logger.warn('Mailbite API check failed — skipping validation', { error: error.message });
  }

  if (emailStatus !== 'VALID' && emailStatus !== 'UNKNOWN') {
    throw AppError.badRequest('Email appears invalid or does not exist', 'INVALID_EMAIL');
  }

  const user = new User({ email: normalizedEmail, password, name });
  await user.save();

  const verificationToken = tokenService.generateVerificationToken(user);
  await emailService.sendVerificationEmail(user.email, user.name, verificationToken);

  return sendSuccess(
    res,
    201,
    null,
    'Registration successful. Please check your email to verify your account.'
  );
});

export const verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.redirect(`${process.env.CLIENT_URL}/email-verification?error=missing_token`);
  }

  try {
    const payload = tokenService.verifyVerificationToken(token);
    if (!payload) throw new Error('Invalid token');

    const user = await User.findById(payload.sub);
    if (!user) throw new Error('User not found');

    if (user.isVerified) {
      return res.redirect(`${process.env.CLIENT_URL}/login?verified=true`);
    }

    user.isVerified = true;
    await user.save();

    logger.info(`Email verified for user: ${user.email}`);
    return res.redirect(`${process.env.CLIENT_URL}/login?verified=true`);
  } catch (err) {
    logger.error('Email verification failed:', err);
    const errorType = err.name === 'TokenExpiredError' ? 'expired' : 'invalid';
    return res.redirect(`${process.env.CLIENT_URL}/email-verification?error=${errorType}`);
  }
};

export const resendVerificationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw AppError.badRequest('Email is required');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  // Security: Don't reveal if user exists
  if (!user) {
    return sendSuccess(res, 200, null, 'If an account exists, a verification email has been sent.');
  }

  if (user.isVerified) {
    throw AppError.badRequest('Email is already verified', 'ALREADY_VERIFIED');
  }

  const verificationToken = tokenService.generateVerificationToken(user);
  await emailService.sendVerificationEmail(user.email, user.name, verificationToken);

  logger.info(`Verification email resent to: ${user.email}`);

  return sendSuccess(res, 200, null, 'Verification email sent. Please check your inbox.');
});

// NOTE: verifyEmailTest removed — it was an unguarded endpoint that bypassed email
// verification for any valid access token. Use Postman/DB to manually verify in dev.

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const userAgent = req.headers['user-agent'] || 'unknown';

  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (!isDevelopment && !user.isVerified) {
    throw AppError.forbidden('Please verify your email first', 'EMAIL_NOT_VERIFIED');
  }

  await sendAuthTokens(res, user, userAgent);
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw AppError.notFound('User not found');
  }

  return sendSuccess(res, 200, { user }, 'User retrieved');
});

export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;
  const userAgent = req.headers['user-agent'] || 'unknown';

  if (!refreshToken) {
    throw AppError.unauthorized('No refresh token provided', 'NO_REFRESH_TOKEN');
  }

  // 1. Verify the JWT signature & expiry first (fast check before hitting DB)
  let jwtPayload;
  try {
    jwtPayload = tokenService.verifyRefreshToken(refreshToken);
  } catch (err) {
    clearRefreshTokenCookie(res);
    throw AppError.forbidden('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  if (!jwtPayload) {
    clearRefreshTokenCookie(res);
    throw AppError.forbidden('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // 2. Look up the hashed token in DB
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const tokenDoc = await RefreshToken.findOne({ tokenHash: refreshTokenHash }).populate('user');

  if (!tokenDoc || !tokenDoc.isValid || tokenDoc.expiresAt < new Date() || !tokenDoc.user) {
    clearRefreshTokenCookie(res);
    throw AppError.forbidden('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // 3. Validate user is still active and verified
  if (!isDevelopment && !tokenDoc.user.isVerified) {
    clearRefreshTokenCookie(res);
    throw AppError.forbidden('Email not verified', 'EMAIL_NOT_VERIFIED');
  }

  // 4. Token rotation — invalidate used token
  tokenDoc.isValid = false;
  tokenDoc.lastUsedAt = new Date();
  await tokenDoc.save();

  // 5. Issue new token pair
  await sendAuthTokens(res, tokenDoc.user, userAgent);
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await RefreshToken.findOneAndUpdate({ tokenHash: refreshTokenHash }, { isValid: false });
  }

  clearRefreshTokenCookie(res);

  return sendSuccess(res, 200, null, 'Logged out successfully');
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    logger.warn(`Password reset attempt for non-existent email: ${normalizedEmail}`);
  } else {
    if (user.googleId && !user.password) {
      logger.info(`Password reset attempted for OAuth-only user: ${normalizedEmail}`);
    } else {
      const resetToken = tokenService.generatePasswordResetToken(user);
      await emailService.sendPasswordResetEmail(user.email, user.name, resetToken);
    }
  }

  // Security: always return same message regardless of whether user exists
  return sendSuccess(res, 200, null, 'If an account exists, a password reset link has been sent.');
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const { password } = req.body;

  if (!token) {
    throw AppError.badRequest('Missing reset token', 'MISSING_TOKEN');
  }

  let payload;
  try {
    payload = tokenService.verifyPasswordResetToken(token);
  } catch (err) {
    throw AppError.badRequest('Invalid or expired reset token', 'INVALID_TOKEN');
  }

  if (!payload) {
    throw AppError.badRequest('Invalid or expired reset token', 'INVALID_TOKEN');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  }

  // Use model's pre-save hook for hashing
  user.password = password;
  await user.save();

  await invalidateAllRefreshTokens(user._id);

  logger.info(`Password reset successful for user: ${user.email}`);

  return sendSuccess(res, 200, null, 'Password reset successful. Please log in.');
});

export const googleCallback = async (req, res) => {
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    const user = req.user;

    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }

    const { accessToken, refreshToken, refreshTokenExpiresAt } =
      tokenService.generateAuthTokens(user);

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await RefreshToken.create({
      user: user._id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshTokenExpiresAt,
      userAgent,
    });

    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions(refreshTokenExpiresAt));

    // Pass accessToken to client via URL so the SPA can store it in memory
    console.log('Google OAuth successful for user:', user.email);
    return res.redirect(`${process.env.CLIENT_URL}/google-callback?token=${accessToken}`);
  } catch (err) {
    logger.error('Google OAuth callback error:', err);
    return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
  }
};