import { Router } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import { createGoalSchema, goalQuerySchema } from '../validation/goal.validation.js';
import { createGoal, getGoalsHabitsDashboard, listActiveGoals, listCompletedGoalsController } from '../controllers/goal.controller.js';

const router = Router();

router.post('/', validate(createGoalSchema), createGoal);
router.get('/active', validate(goalQuerySchema, 'query'), listActiveGoals);
router.get('/completed', listCompletedGoalsController);
router.get('/dashboard', validate(goalQuerySchema, 'query'), getGoalsHabitsDashboard);

export default router;