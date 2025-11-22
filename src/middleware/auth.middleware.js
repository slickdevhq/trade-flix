import { tokenService } from '../services/token.service.js';
import User from '../models/User.model.js';
import logger from '../config/logger.js';
import AppError from '../utils/appError.js';

/**
 * Middleware to protect routes.
 * Verifies JWT access token.
 */
export const protect = async (req, res, next) => {
  let token;

  // Check for Bearer token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const payload = tokenService.verifyAccessToken(token);
      if (!payload) {
        return next(AppError.unauthorized('Not authorized, token invalid', 'INVALID_TOKEN'));
      }

      // Get user from token
      req.user = await User.findById(payload.sub).select('-password');
      if (!req.user) {
        return next(AppError.unauthorized('Not authorized, user not found', 'USER_NOT_FOUND'));
      }

      // Check if user email is verified
      if (!req.user.isVerified) {
        return next(AppError.forbidden('Not authorized, email not verified', 'EMAIL_NOT_VERIFIED'));
      }

      next();
    } catch (err) {
      logger.warn('Token verification failed:', err.message);
      if (err.name === 'TokenExpiredError') {
        return next(AppError.unauthorized('Not authorized, token expired', 'TOKEN_EXPIRED'));
      }
      return next(AppError.unauthorized('Not authorized, token invalid', 'INVALID_TOKEN'));
    }
  }

  if (!token) {
    return next(AppError.unauthorized('Not authorized, no token', 'NO_TOKEN'));
  }
};