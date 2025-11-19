import RefreshToken from '../models/RefreshToken.model.js';
import logger from '../config/logger.js';

export const userController = {
  /**
   * Get current user details
   * GET /api/v1/user/me
   */
  getMe: (req, res) => {
    // req.user is attached by the 'protect' middleware
    res.status(200).json({
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

      res.status(200).json(sessions);
    } catch (err) {
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
        return res.status(404).json({ message: 'Session not found' });
      }

      if (!session.isValid) {
        return res.status(400).json({ message: 'Session already revoked' });
      }

      session.isValid = false;
      await session.save();

      logger.info(`Session ${id} revoked for user ${userId}`);
      res.status(200).json({ message: 'Session revoked successfully' });
    } catch (err) {
      next(err);
    }
  },
};