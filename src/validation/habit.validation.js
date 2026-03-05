import Joi from 'joi';

export const createHabitSchema = Joi.object({
  name: Joi.string().trim().required(),
  targetStreak: Joi.number().integer().min(1).required(),
  mode: Joi.string().valid('manual', 'auto').optional(),
  autoEvent: Joi.string().valid('trade_created', 'journal_entry').optional(),
});

export const checkinParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export const checkinBodySchema = Joi.object({
  date: Joi.date().iso().max('now').optional(),
});

export const habitQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});