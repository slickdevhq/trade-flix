import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import tradeRoutes from './trade.routes.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', protect, userRoutes); // All user routes are protected
router.use('/trades', protect, tradeRoutes); // All trade routes are protected

export default router;