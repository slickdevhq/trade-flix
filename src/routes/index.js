import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import tradeRoutes from './trade.routes.js';
import brokerRoutes from './broker.routes.js';
import analyticsRoutes from './analytics.routes.js';
import goalRoutes from './goal.routes.js';
import habitRoutes from './habit.routes.js';
import journalRoutes from './journal.routes.js';
import settingsRoutes from './settings.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', protect, userRoutes); // All user routes are protected
router.use('/trades', protect, tradeRoutes); // All trade routes are protected
router.use('/brokers', protect, brokerRoutes); // All broker routes are protected
router.use('/analytics', protect, analyticsRoutes); // All analytics routes are protected
router.use('/goals', protect, goalRoutes); // Goals
router.use('/habits', protect, habitRoutes); // Habits
router.use('/journal', protect, journalRoutes); // Journal
router.use('/settings', protect, settingsRoutes); // Settings
router.use('/dashboard', protect, dashboardRoutes); // Dashboard

export default router;