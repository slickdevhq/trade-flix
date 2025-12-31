import RefreshToken from '../models/RefreshToken.model.js';
import logger from '../config/logger.js';
import { sendSuccess } from '../utils/response.js';
import AppError from '../utils/appError.js';
import { emailService } from '../services/email.service.js';

export const userController = {
  /**
   * Get current user details
   * GET /api/v1/user/me
   */
  getMe: (req, res) => {
    // req.user is attached by the 'protect' middleware
    return sendSuccess(res, 200, {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      isVerified: req.user.isVerified,
    });
  },

  /**
   * Get all active sessions for the user
   * GET /api/v1/user/sessions
   */
  getSessions: async (req, res, next) => {
    try {
      const sessions = await RefreshToken.find({
        user: req.user._id,
        isValid: true,
      })
        .select('userAgent createdAt expiresAt')
        .sort({ createdAt: -1 });

      return sendSuccess(res, 200, sessions);
    } catch (err) {
      next(err);
    }
  },


  testEmail: async (req, res, next) => {
    try {
      const {email} = req.user;
      const {name} = req.user;
      if(!email || !name){
         return next(AppError.badRequest('name and email has to present', 'NAME_AND_EMAIL_NOT_COMPLETE'));
      }
      await emailService.sendTestEmail(email, name);

      return sendSuccess(res, 200, null, `email sent to ${name}`);
    } catch (err) {
      console.error(err);
      next(err);
    }
  },

  /**
   * Revoke a specific session
   * POST /api/v1/user/sessions/:id/revoke
   */
  revokeSession: async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const session = await RefreshToken.findOne({
        _id: id,
        user: userId,
      });

      if (!session) {
        return next(AppError.notFound('Session not found', 'SESSION_NOT_FOUND'));
      }

      if (!session.isValid) {
        return next(AppError.badRequest('Session already revoked', 'SESSION_ALREADY_REVOKED'));
      }

      session.isValid = false;
      await session.save();

      logger.info(`Session ${id} revoked for user ${userId}`);
      return sendSuccess(res, 200, null, 'Session revoked successfully');
    } catch (err) {
      next(err);
    }
  },
};