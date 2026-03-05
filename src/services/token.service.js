import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;
const VERIFICATION_TOKEN_SECRET = process.env.JWT_VERIFY_EMAIL_SECRET;
const PASSWORD_RESET_TOKEN_SECRET = process.env.JWT_RESET_PASSWORD_SECRET;
// Use dedicated secrets for email change and account deletion (fallback to verify secret if not set)
const EMAIL_CHANGE_TOKEN_SECRET = process.env.JWT_EMAIL_CHANGE_SECRET || process.env.JWT_VERIFY_EMAIL_SECRET;
const ACCOUNT_DELETION_TOKEN_SECRET = process.env.JWT_ACCOUNT_DELETION_SECRET || process.env.JWT_RESET_PASSWORD_SECRET;

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRATION || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRATION_DAYS || '7d';
const VERIFICATION_TOKEN_EXPIRY = process.env.JWT_VERIFY_EMAIL_EXPIRATION || '1d';
const PASSWORD_RESET_TOKEN_EXPIRY = process.env.JWT_RESET_PASSWORD_EXPIRATION || '1h';
const EMAIL_CHANGE_TOKEN_EXPIRY = process.env.JWT_EMAIL_CHANGE_EXPIRY || '1h';
const ACCOUNT_DELETION_TOKEN_EXPIRY = process.env.JWT_ACCOUNT_DELETION_EXPIRY || '1h';

class TokenService {
  calculateExpiryDate(expiryString) {
    const match = expiryString.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid expiry format: ${expiryString}`);

    const value = parseInt(match[1]);
    const unit = match[2];
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

    return new Date(Date.now() + value * multipliers[unit]);
  }

  // ──────────────────────────────────────────────────────────────────
  // Auth Tokens
  // ──────────────────────────────────────────────────────────────────

  generateAuthTokens(user) {
    const accessToken = jwt.sign({ sub: user._id }, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign({ sub: user._id }, REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    const refreshTokenExpiresAt = this.calculateExpiryDate(REFRESH_TOKEN_EXPIRY);

    return { accessToken, refreshToken, refreshTokenExpiresAt };
  }

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, ACCESS_TOKEN_SECRET);
    } catch (error) {
      logger.debug('Access token verification failed:', error.message);
      if (error.name === 'TokenExpiredError') {
        const err = new Error('Token expired');
        err.name = 'TokenExpiredError';
        throw err;
      }
      return null;
    }
  }

  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, REFRESH_TOKEN_SECRET);
    } catch (error) {
      logger.debug('Refresh token verification failed:', error.message);
      if (error.name === 'TokenExpiredError') {
        const err = new Error('Token expired');
        err.name = 'TokenExpiredError';
        throw err;
      }
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Email Verification
  // ──────────────────────────────────────────────────────────────────

  generateVerificationToken(user) {
    return jwt.sign({ sub: user._id, type: 'email_verify' }, VERIFICATION_TOKEN_SECRET, {
      expiresIn: VERIFICATION_TOKEN_EXPIRY,
    });
  }

  verifyVerificationToken(token) {
    try {
      return jwt.verify(token, VERIFICATION_TOKEN_SECRET);
    } catch (error) {
      logger.debug('Verification token invalid:', error.message);
      if (error.name === 'TokenExpiredError') {
        const err = new Error('Token expired');
        err.name = 'TokenExpiredError';
        throw err;
      }
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Email Change  (uses its own secret to prevent token confusion)
  // ──────────────────────────────────────────────────────────────────

  generateEmailChangeToken(user, newEmail) {
    return jwt.sign(
      { sub: user._id, newEmail, type: 'email_change' },
      EMAIL_CHANGE_TOKEN_SECRET,
      { expiresIn: EMAIL_CHANGE_TOKEN_EXPIRY }
    );
  }

  verifyEmailChangeToken(token) {
    try {
      return jwt.verify(token, EMAIL_CHANGE_TOKEN_SECRET);
    } catch (error) {
      logger.debug('Email change token invalid:', error.message);
      if (error.name === 'TokenExpiredError') {
        const err = new Error('Token expired');
        err.name = 'TokenExpiredError';
        throw err;
      }
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Password Reset
  // ──────────────────────────────────────────────────────────────────

  generatePasswordResetToken(user) {
    return jwt.sign({ sub: user._id, type: 'password_reset' }, PASSWORD_RESET_TOKEN_SECRET, {
      expiresIn: PASSWORD_RESET_TOKEN_EXPIRY,
    });
  }

  verifyPasswordResetToken(token) {
    try {
      return jwt.verify(token, PASSWORD_RESET_TOKEN_SECRET);
    } catch (error) {
      logger.debug('Password reset token invalid:', error.message);
      if (error.name === 'TokenExpiredError') {
        const err = new Error('Token expired');
        err.name = 'TokenExpiredError';
        throw err;
      }
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Account Deletion  (uses its own secret)
  // ──────────────────────────────────────────────────────────────────

  generateAccountDeletionToken(user) {
    return jwt.sign({ sub: user._id, type: 'account_delete' }, ACCOUNT_DELETION_TOKEN_SECRET, {
      expiresIn: ACCOUNT_DELETION_TOKEN_EXPIRY,
    });
  }

  verifyAccountDeletionToken(token) {
    try {
      return jwt.verify(token, ACCOUNT_DELETION_TOKEN_SECRET);
    } catch (error) {
      logger.debug('Account deletion token invalid:', error.message);
      if (error.name === 'TokenExpiredError') {
        const err = new Error('Token expired');
        err.name = 'TokenExpiredError';
        throw err;
      }
      return null;
    }
  }
}

export const tokenService = new TokenService();