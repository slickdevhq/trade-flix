import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import AppError from '../utils/appError.js';
import User from '../models/User.model.js';
import Trade from '../models/Trade.model.js';
import JournalEntry from '../models/JournalEntry.model.js';
import Goal from '../models/Goal.model.js';
import Habit from '../models/Habit.model.js';
import RefreshToken from '../models/RefreshToken.model.js';
import { emailService } from '../services/email.service.js';
import { tokenService } from '../services/token.service.js';
import logger from '../config/logger.js';

// ──────────────────────────────────────────────────────────────────
// Profile Management
// ──────────────────────────────────────────────────────────────────

export const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw AppError.notFound('User not found');
  }

  return sendSuccess(res, 200, { user }, 'Profile retrieved');
});

export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { name, initialBalance } = req.body;

  const update = {};
  if (typeof name === 'string' && name.trim()) {
    update.name = name.trim();
  }
  if (typeof initialBalance === 'number' && initialBalance >= 0) {
    update.initialBalance = initialBalance;
  }

  if (Object.keys(update).length === 0) {
    throw AppError.badRequest('No valid fields provided to update');
  }

  const user = await User.findByIdAndUpdate(userId, update, {
    new: true,
    runValidators: true,
  }).select('-password');

  if (!user) {
    throw AppError.notFound('User not found');
  }

  return sendSuccess(res, 200, { user }, 'Profile updated successfully');
});

export const requestEmailChange = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { email } = req.body;

  if (!email) {
    throw AppError.badRequest('Email is required');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if email already in use
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser && !existingUser._id.equals(userId)) {
    throw AppError.conflict('Email already in use', 'EMAIL_IN_USE');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found');
  }

  if (user.email === normalizedEmail) {
    throw AppError.badRequest('New email must be different from current email');
  }

  // Generate verification token with new email
  const verificationToken = tokenService.generateEmailChangeToken(user, normalizedEmail);
  await emailService.sendEmailChangeVerification(normalizedEmail, user.name, verificationToken);

  return sendSuccess(
    res,
    200,
    null,
    'Verification email sent. Please check your new email to confirm the change.'
  );
});

export const confirmEmailChange = asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    throw AppError.badRequest('Missing verification token', 'MISSING_TOKEN');
  }

  const payload = tokenService.verifyEmailChangeToken(token);
  if (!payload || !payload.newEmail) {
    throw AppError.badRequest('Invalid or expired token', 'INVALID_TOKEN');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw AppError.notFound('User not found');
  }

  // Check if new email is still available
  const existingUser = await User.findOne({ email: payload.newEmail });
  if (existingUser && !existingUser._id.equals(user._id)) {
    throw AppError.conflict('Email already in use', 'EMAIL_IN_USE');
  }

  const oldEmail = user.email;
  user.email = payload.newEmail;
  await user.save();

  // Notify old email
  await emailService.sendEmailChangedNotification(oldEmail, payload.newEmail, user.name);

  logger.info(`Email changed for user ${user._id}: ${oldEmail} -> ${payload.newEmail}`);

  return sendSuccess(res, 200, { email: user.email }, 'Email updated successfully');
});

// ──────────────────────────────────────────────────────────────────
// Password Management (Security Section)
// ──────────────────────────────────────────────────────────────────

export const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw AppError.badRequest('Current and new password are required');
  }

  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw AppError.notFound('User not found');
  }

  // Google users don't have passwords
  if (!user.password) {
    throw AppError.badRequest(
      'Cannot change password for Google-authenticated accounts',
      'OAUTH_ACCOUNT'
    );
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw AppError.badRequest('Current password is incorrect', 'INVALID_PASSWORD');
  }

  if (currentPassword === newPassword) {
    throw AppError.badRequest('New password must be different from current password');
  }

  // CRITICAL FIX: Use model's pre-save hook for proper hashing
  user.password = newPassword;
  await user.save();

  // Invalidate all refresh tokens for security
  await RefreshToken.updateMany({ user: userId, isValid: true }, { isValid: false });

  // Send notification email
  await emailService.sendPasswordChangedNotification(user.email, user.name);

  logger.info(`Password changed for user ${userId}`);

  return sendSuccess(res, 200, null, 'Password updated successfully. Please log in again.');
});

// ──────────────────────────────────────────────────────────────────
// Preferences Management
// ──────────────────────────────────────────────────────────────────

export const updatePreferences = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { darkMode, pushNotifications, emailDigest, aiInsights } = req.body;

  const update = {};
  if (typeof darkMode === 'boolean') update['preferences.darkMode'] = darkMode;
  if (typeof pushNotifications === 'boolean') {
    update['preferences.pushNotifications'] = pushNotifications;
  }
  if (typeof emailDigest === 'boolean') update['preferences.emailDigest'] = emailDigest;
  if (typeof aiInsights === 'boolean') update['preferences.aiInsights'] = aiInsights;

  if (Object.keys(update).length === 0) {
    throw AppError.badRequest('No valid preferences provided to update');
  }

  const user = await User.findByIdAndUpdate(userId, update, { new: true });

  return sendSuccess(res, 200, { preferences: user.preferences }, 'Preferences updated');
});

// ──────────────────────────────────────────────────────────────────
// Subscription Management
// ──────────────────────────────────────────────────────────────────

export const getSubscription = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select('subscription');
  if (!user) {
    throw AppError.notFound('User not found');
  }

  // Calculate current month trade count
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const currentMonthTrades = await Trade.countDocuments({
    user: userId,
    date: { $gte: monthStart, $lt: monthEnd },
  });

  const subscriptionDetails = {
    tier: user.subscription.tier,
    tradeLimit: user.subscription.tradeLimit,
    aiAccess: user.subscription.aiAccess,
    currentMonthTrades,
    remainingTrades:
      user.subscription.tier === 'free'
        ? Math.max(0, user.subscription.tradeLimit - currentMonthTrades)
        : 'unlimited',
  };

  return sendSuccess(res, 200, { subscription: subscriptionDetails }, 'Subscription retrieved');
});

export const upgradeSubscription = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { tier } = req.body;

  if (!['free', 'pro'].includes(tier)) {
    throw AppError.badRequest('Invalid subscription tier');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found');
  }

  if (user.subscription.tier === tier) {
    throw AppError.badRequest(`Already subscribed to ${tier} tier`);
  }

  // Update subscription
  user.subscription.tier = tier;
  user.subscription.tradeLimit = tier === 'pro' ? -1 : 50; // -1 = unlimited
  user.subscription.aiAccess = tier === 'pro' ? 'unlimited' : 'limited';

  await user.save();

  logger.info(`User ${userId} ${tier === 'pro' ? 'upgraded' : 'downgraded'} to ${tier} tier`);

  return sendSuccess(
    res,
    200,
    { subscription: user.subscription },
    `Successfully ${tier === 'pro' ? 'upgraded' : 'changed'} to ${tier} tier`
  );
});

// ──────────────────────────────────────────────────────────────────
// Session Management (Security Section - implicit from UI)
// ──────────────────────────────────────────────────────────────────

export const getActiveSessions = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const sessions = await RefreshToken.find({
    user: userId,
    isValid: true,
    expiresAt: { $gt: new Date() },
  })
    .select('userAgent createdAt expiresAt')
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, 200, { sessions }, 'Active sessions retrieved');
});

export const revokeSession = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { sessionId } = req.params;

  const session = await RefreshToken.findOneAndUpdate(
    { _id: sessionId, user: userId, isValid: true },
    { isValid: false },
    { new: true }
  );

  if (!session) {
    throw AppError.notFound('Session not found or already revoked');
  }

  logger.info(`Session ${sessionId} revoked for user ${userId}`);

  return sendSuccess(res, 200, null, 'Session revoked successfully');
});

export const revokeAllSessions = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await RefreshToken.updateMany(
    { user: userId, isValid: true },
    { isValid: false }
  );

  logger.info(`All sessions revoked for user ${userId} (${result.modifiedCount} sessions)`);

  return sendSuccess(
    res,
    200,
    { revokedCount: result.modifiedCount },
    'All sessions revoked successfully'
  );
});

// ──────────────────────────────────────────────────────────────────
// Data Export (Danger Zone)
// ──────────────────────────────────────────────────────────────────

function toCsv(rows) {
  if (!rows || !rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(',')].concat(
    rows.map((r) => headers.map((h) => escape(r[h])).join(','))
  );
  return lines.join('\n');
}

export const exportUserData = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { format = 'json', startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lt = new Date(endDate);

  const query = { user: userId };
  if (Object.keys(dateFilter).length > 0) {
    query.date = dateFilter;
  }

  const [trades, journals, goals, habits] = await Promise.all([
    Trade.find(query).lean(),
    JournalEntry.find(query).lean(),
    Goal.find({ user: userId }).lean(),
    Habit.find({ user: userId }).lean(),
  ]);

  if (format === 'csv') {
    const cleanTrades = trades.map(({ _id, user, createdAt, updatedAt, __v, ...rest }) => ({
      ...rest,
      date: rest.date ? new Date(rest.date).toISOString() : '',
      tags: Array.isArray(rest.tags) ? rest.tags.join(';') : '',
      mistakes: Array.isArray(rest.mistakes) ? rest.mistakes.join(';') : '',
    }));

    const cleanJournals = journals.map(({ _id, user, createdAt, updatedAt, __v, ...rest }) => ({
      ...rest,
      date: rest.date ? new Date(rest.date).toISOString() : '',
      tags: Array.isArray(rest.tags) ? rest.tags.join(';') : '',
      images: Array.isArray(rest.images) ? rest.images.join(';') : '',
    }));

    const cleanGoals = goals.map(({ _id, user, createdAt, updatedAt, __v, ...rest }) => ({
      ...rest,
      startDate: rest.startDate ? new Date(rest.startDate).toISOString() : '',
      endDate: rest.endDate ? new Date(rest.endDate).toISOString() : '',
    }));

    const cleanHabits = habits.map(({ _id, user, createdAt, updatedAt, __v, ...rest }) => ({
      ...rest,
      history: Array.isArray(rest.history)
        ? rest.history.map((d) => new Date(d).toISOString()).join(';')
        : '',
    }));

    const tradesCsv = toCsv(cleanTrades);
    const journalsCsv = toCsv(cleanJournals);
    const goalsCsv = toCsv(cleanGoals);
    const habitsCsv = toCsv(cleanHabits);

    const bundle = `# TRADES
${tradesCsv}

# JOURNAL_ENTRIES
${journalsCsv}

# GOALS
${goalsCsv}

# HABITS
${habitsCsv}`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="trading-journal-export.csv"');
    return res.send(bundle);
  }

  // Default: JSON
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="trading-journal-export.json"');

  return sendSuccess(
    res,
    200,
    { trades, journals, goals, habits },
    'Data export successful'
  );
});

// ──────────────────────────────────────────────────────────────────
// Account Deletion (Danger Zone)
// ──────────────────────────────────────────────────────────────────

export const requestAccountDeletion = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { password } = req.body;

  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw AppError.notFound('User not found');
  }

  // Verify password for non-OAuth users
  if (user.password) {
    if (!password) {
      throw AppError.badRequest('Password required to delete account');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw AppError.badRequest('Incorrect password', 'INVALID_PASSWORD');
    }
  }

  // Generate deletion token
  const deletionToken = tokenService.generateAccountDeletionToken(user);
  await emailService.sendAccountDeletionConfirmation(user.email, user.name, deletionToken);

  return sendSuccess(
    res,
    200,
    null,
    'Confirmation email sent. Please check your email to complete account deletion.'
  );
});

export const confirmAccountDeletion = asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    throw AppError.badRequest('Missing deletion token', 'MISSING_TOKEN');
  }

  const payload = tokenService.verifyAccountDeletionToken(token);
  if (!payload) {
    throw AppError.badRequest('Invalid or expired token', 'INVALID_TOKEN');
  }

  const userId = payload.sub;

  // Delete all user data atomically
  await Promise.all([
    Trade.deleteMany({ user: userId }),
    JournalEntry.deleteMany({ user: userId }),
    Goal.deleteMany({ user: userId }),
    Habit.deleteMany({ user: userId }),
    RefreshToken.deleteMany({ user: userId }),
    User.findByIdAndDelete(userId),
  ]);

  logger.info(`Account ${userId} and all associated data permanently deleted`);

  return sendSuccess(
    res,
    200,
    null,
    'Account and all associated data have been permanently deleted'
  );
});