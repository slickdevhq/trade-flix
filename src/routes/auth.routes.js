import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { validate } from '../middleware/validate.middleware.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  register,
  login,
  logout,
  refreshToken,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  googleCallback,
} from '../controllers/auth.controller.js';

import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
} from '../validation/auth.validation.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ───────────────────────────────────────────────
// Public: Email/Password Authentication
// ───────────────────────────────────────────────

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);

// ───────────────────────────────────────────────
// Public: Email Verification & Password Reset
// ───────────────────────────────────────────────

router.get('/verify-email', verifyEmail);

router.post(
  '/verify-email/resend',
  authLimiter,
  validate(resendVerificationSchema),
  resendVerificationEmail
);

router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// ───────────────────────────────────────────────
// Protected: Current User
// ───────────────────────────────────────────────

router.get('/me', protect, getCurrentUser);

// ───────────────────────────────────────────────
// OAuth: Google Authentication
// ───────────────────────────────────────────────

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed`,
    session: false,
  }),
  googleCallback
);

export default router;