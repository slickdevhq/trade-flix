import Goal from '../models/Goal.model.js';
import { listActiveGoalsWithProgress, listCompletedGoals } from '../services/goal.service.js';
import { resolveDateRange } from '../utils/resolveDateRange.js';

import { sendSuccess } from '../utils/response.js';
import AppError from '../utils/appError.js';

export const createGoal = async (req, res, next) => {
  try {
    const payload = { ...req.body, user: req.user._id };
    const goal = await Goal.create(payload);
    return sendSuccess(res, 201, goal, 'Goal created');
  } catch (err) {
    next(err);
  }
};

export const listActiveGoals = async (req, res, next) => {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    const goals = await listActiveGoalsWithProgress(req.user._id, startDate, endDate);
    return sendSuccess(res, 200, goals);
  } catch (err) {
    next(err);
  }
};

export const listCompletedGoalsController = async (req, res, next) => {
  try {
    const goals = await listCompletedGoals(req.user._id);
    return sendSuccess(res, 200, goals);
  } catch (err) {
    next(err);
  }
};

// goal.controller.js
export const getGoalsHabitsDashboard = async (req, res, next) => {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    
    const [activeGoals, completedGoals, habitData] = await Promise.all([
      listActiveGoalsWithProgress(req.user._id, startDate, endDate),
      listCompletedGoals(req.user._id),
      getHabitStreaks(req.user._id, startDate, endDate)
    ]);
    
    return sendSuccess(res, 200, {
      activeGoals,
      completedGoals,
      habits: habitData.habits,
      motivation: habitData.motivation,
      insight: habitData.insight
    });
  } catch (err) {
    next(err);
  }
};