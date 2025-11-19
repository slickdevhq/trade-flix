import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const tokenService = {
  /**
   * Generates a new Access Token.
   */
  generateAccessToken: (user) => {
    const payload = {
      sub: user._id, // subject
      email: user.email,
    };
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRATION,
    });
  },

  /**
   * Generates a new Refresh Token (a random string).
   */
  generateRefreshToken: () => {
    return crypto.randomBytes(64).toString('hex');
  },

  /**
   * Generates both access and refresh tokens.
   */
  generateAuthTokens: (user) => {
    const accessToken = tokenService.generateAccessToken(user);
    const refreshToken = tokenService.generateRefreshToken();
    const refreshTokenExpiresAt = new Date(
      Date.now() + parseInt(process.env.JWT_REFRESH_EXPIRATION_DAYS) * 24 * 60 * 60 * 1000
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
    };
  },

  /**
   * Verifies an Access Token.
   */
  verifyAccessToken: (token) => {
    try {
      return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      return null;
    }
  },

  /**
   * Generates an Email Verification Token.
   */
  generateVerificationToken: (user) => {
    const payload = { sub: user._id };
    return jwt.sign(payload, process.env.JWT_VERIFY_EMAIL_SECRET, {
      expiresIn: process.env.JWT_VERIFY_EMAIL_EXPIRATION,
    });
  },

  /**
   * Verifies an Email Verification Token.
   */
  verifyVerificationToken: (token) => {
    try {
      return jwt.verify(token, process.env.JWT_VERIFY_EMAIL_SECRET);
    } catch (err) {
      // Re-throw JWT-specific errors to be handled by controller
      if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
        throw err;
      }
      return null;
    }
  },

  /**
   * Generates a Password Reset Token.
   */
  generatePasswordResetToken: (user) => {
    const payload = { sub: user._id };
    return jwt.sign(payload, process.env.JWT_RESET_PASSWORD_SECRET, {
      expiresIn: process.env.JWT_RESET_PASSWORD_EXPIRATION,
    });
  },

  /**
   * Verifies a Password Reset Token.
   */
  verifyPasswordResetToken: (token) => {
    try {
      return jwt.verify(token, process.env.JWT_RESET_PASSWORD_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
        throw err;
      }
      return null;
    }
  },
};