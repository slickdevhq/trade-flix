import { Router } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import { dashboardQuerySchema } from '../validation/dashboard.validation.js';
import { getDashboard } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/', validate(dashboardQuerySchema, 'query'), getDashboard);

export default router;