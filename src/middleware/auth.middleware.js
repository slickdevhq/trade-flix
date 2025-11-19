import { tokenService } from '../services/token.service.js';
import User from '../models/User.model.js';
import logger from '../config/logger.js';

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
        return res.status(401).json({ message: 'Not authorized, token invalid' });
      }

      // Get user from token
      req.user = await User.findById(payload.sub).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      // Check if user email is verified
      if (!req.user.isVerified) {
        return res.status(403).json({
          message: 'Not authorized, email not verified',
          code: 'EMAIL_NOT_VERIFIED',
        });
      }

      next();
    } catch (err) {
      logger.warn('Token verification failed:', err.message);
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          message: 'Not authorized, token expired',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({ message: 'Not authorized, token invalid' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};