import { Router } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import { createHabitSchema, checkinParamsSchema, checkinBodySchema, habitQuerySchema } from '../validation/habit.validation.js';
import { 
  createHabitController, 
  checkinHabitController, 
  getHabitStreaksController,
  getDailyMotivationController,
  getGrowthInsightsController 
} from '../controllers/habit.controller.js';

const router = Router();

router.post('/', validate(createHabitSchema), createHabitController);
router.post('/:id/checkin', validate(checkinParamsSchema, 'params'), validate(checkinBodySchema), checkinHabitController);
router.get('/streaks', validate(habitQuerySchema, 'query'), getHabitStreaksController);
router.get('/motivation', validate(habitQuerySchema, 'query'), getDailyMotivationController);
router.get('/insights', validate(habitQuerySchema, 'query'), getGrowthInsightsController);

export default router;