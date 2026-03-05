import Joi from 'joi';

/**
 * Analytics Query Validation Schema
 * 
 * Supports three query modes:
 * 1. Explicit range: ?startDate=2024-01-01&endDate=2024-01-31
 * 2. Preset range: ?range=month | ?range=all | ?range=30days
 * 3. Default (no params): Uses current month
 * 
 * Rules:
 * - Cannot provide both explicit dates AND preset range
 * - If startDate is provided, endDate is required
 * - endDate must be after or equal to startDate
 */
export const analyticsQuerySchema = Joi.object({
  startDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'startDate must be a valid ISO date (YYYY-MM-DD)',
    }),
  
  endDate: Joi.date()
    .iso()
    .when('startDate', {
      is: Joi.exist(),
      then: Joi.date().iso().min(Joi.ref('startDate')).required(),
      otherwise: Joi.optional()
    })
    .messages({
      'date.format': 'endDate must be a valid ISO date (YYYY-MM-DD)',
      'date.min': 'endDate must be after or equal to startDate',
      'any.required': 'endDate is required when startDate is provided',
    }),
  
  range: Joi.string()
    .valid('month', 'all', '30days', '90days', 'year', 'ytd', 'lastyear', 'lastmonth')
    .optional()
    .messages({
      'any.only': 'range must be one of: month, all, 30days, 90days, year, ytd, lastyear, lastmonth',
    }),
})
  .xor('startDate', 'range') // Cannot provide both
  .messages({
    'object.xor': 'Provide either startDate/endDate OR range parameter, not both',
    'object.missing': 'At least one of startDate or range must be provided (or neither for default)',
  });

/**
 * Validation for date range in other contexts (e.g., exports, reports)
 * This is stricter and REQUIRES explicit dates
 */
export const requiredDateRangeSchema = Joi.object({
  startDate: Joi.date()
    .iso()
    .required()
    .messages({
      'date.format': 'startDate must be a valid ISO date (YYYY-MM-DD)',
      'any.required': 'startDate is required',
    }),
  
  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .required()
    .messages({
      'date.format': 'endDate must be a valid ISO date (YYYY-MM-DD)',
      'date.min': 'endDate must be after or equal to startDate',
      'any.required': 'endDate is required',
    }),
});