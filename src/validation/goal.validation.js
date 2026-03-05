import Joi from 'joi';

export const createGoalSchema = Joi.object({
  name: Joi.string().trim().optional(),
  type: Joi.string().valid('PNL', 'WIN_RATE', 'TRADING_DAYS', 'MAX_DRAWDOWN', 'RISK_COMPLIANCE').required(),
  targetValue: Joi.number().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
  status: Joi.string().valid('active', 'completed', 'archived').optional(),
});

export const goalQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  range: Joi.string().valid('all', 'month', '30days', '60days', '90days', 'year', 'ytd', 'lastmonth', 'lastyear').optional(),
});