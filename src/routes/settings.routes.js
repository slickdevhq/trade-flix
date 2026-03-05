  import { Router } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import {
  updateProfileSchema,
  requestEmailChangeSchema,
  changePasswordSchema,
  updatePreferencesSchema,
  upgradeSubscriptionSchema,
  exportQuerySchema,
  accountDeletionSchema,
} from '../validation/settings.validation.js';
import {
  getProfile,
  updateProfile,
  requestEmailChange,
  confirmEmailChange,
  changePassword,
  updatePreferences,
  getSubscription,
  upgradeSubscription,
  getActiveSessions,
  revokeSession,
  revokeAllSessions,
  exportUserData,
  requestAccountDeletion,
  confirmAccountDeletion,
} from '../controllers/settings.controller.js';

const router = Router();

// ── Profile Information Section ────────────────────────────────────
router.get('/profile', getProfile);
router.patch('/profile', validate(updateProfileSchema), updateProfile);

// ── Email Change (with verification) ───────────────────────────────
router.post('/email/change', validate(requestEmailChangeSchema), requestEmailChange);
router.get('/email/confirm', confirmEmailChange);

// ── Security Section ───────────────────────────────────────────────
router.post('/password/change', validate(changePasswordSchema), changePassword);

// ── Session Management (implicit in Security section) ──────────────
router.get('/sessions', getActiveSessions);
router.delete('/sessions/:sessionId', revokeSession);
router.delete('/sessions', revokeAllSessions);

// ── Preferences Section ────────────────────────────────────────────
router.patch('/preferences', validate(updatePreferencesSchema), updatePreferences);

// ── Subscription Section ───────────────────────────────────────────
router.get('/subscription', getSubscription);
router.post('/subscription/upgrade', validate(upgradeSubscriptionSchema), upgradeSubscription);

// ── Danger Zone Section ────────────────────────────────────────────
router.get('/export', validate(exportQuerySchema, 'query'), exportUserData);
router.post('/account/delete', validate(accountDeletionSchema), requestAccountDeletion);
router.get('/account/confirm-delete', confirmAccountDeletion);

export default router;