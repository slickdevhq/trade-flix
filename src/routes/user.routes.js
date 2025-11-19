import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';

const router = Router();

router.get('/me', userController.getMe);
router.get('/sessions', userController.getSessions);
router.post('/sessions/:id/revoke', userController.revokeSession);

export default router;