import Habit from '../models/Habit.model.js';
import { createHabit, checkInHabit, getHabitStreaks, getDailyMotivation, getGrowthInsights } from '../services/habit.service.js';
import { sendSuccess } from '../utils/response.js';
import AppError from '../utils/appError.js';

export const createHabitController = async (req, res, next) => {
  try {
    const habit = await createHabit(req.user._id, req.body);
    return sendSuccess(res, 201, habit, 'Habit created');
  } catch (err) {
    next(err);
  }
};

export const checkinHabitController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.body;
    const habit = await checkInHabit(req.user._id, id, date ? new Date(date) : new Date());
    if (!habit) return next(AppError.notFound('Habit not found', 'HABIT_NOT_FOUND'));
    
    // Return minimal response
    return sendSuccess(res, 200, {
      habitId: habit._id,
      name: habit.name,
      currentStreak: habit.currentStreak,
      lastCheckin: habit.history[habit.history.length - 1]
    }, 'Habit checked in');
  } catch (err) {
    next(err);
  }
};

export const getHabitStreaksController = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await getHabitStreaks(req.user._id, startDate, endDate);
    return sendSuccess(res, 200, data);
  } catch (err) {
    next(err);
  }
};

export const getDailyMotivationController = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const motivation = await getDailyMotivation(req.user._id, startDate, endDate);
    return sendSuccess(res, 200, motivation);
  } catch (err) {
    next(err);
  }
};

export const getGrowthInsightsController = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const insights = await getGrowthInsights(req.user._id, startDate, endDate);
    return sendSuccess(res, 200, insights);
  } catch (err) {
    next(err);
  }
};