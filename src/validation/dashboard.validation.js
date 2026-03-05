import Joi from 'joi';

export const dashboardQuerySchema = Joi.object({
  // Explicit date range (takes precedence over preset ranges)
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  
  // Preset ranges (aligned with UI buttons and dateHelpers.js)
  range: Joi.string()
    .valid('all', 'month', '30days', '60days', '90days', 'year', 'ytd', 'lastmonth', 'lastyear')
    .optional()
    .messages({
      'any.only': 'range must be one of: all, month, 30days, 60days, 90days, year, ytd, lastmonth, lastyear'
    }),
  
  // Timezone offset in minutes (e.g., -300 for EST, 60 for CET)
  tzOffsetMinutes: Joi.number()
    .integer()
    .min(-720)  // UTC-12
    .max(840)   // UTC+14
    .default(0)
    .messages({
      'number.min': 'tzOffsetMinutes must be between -720 and 840',
      'number.max': 'tzOffsetMinutes must be between -720 and 840'
    }),
  
  // Number of recent trades to return
  limitTrades: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(4)
    .messages({
      'number.min': 'limitTrades must be between 1 and 10',
      'number.max': 'limitTrades must be between 1 and 10'
    }),
})
.custom((value, helpers) => {
  // Validation: Cannot use both explicit dates and preset range
  if ((value.startDate || value.endDate) && value.range) {
    return helpers.error('object.conflict', {
      message: 'Cannot use both explicit date range (startDate/endDate) and preset range simultaneously'
    });
  }
  
  // Validation: If using explicit dates, both must be provided
  if ((value.startDate && !value.endDate) || (!value.startDate && value.endDate)) {
    return helpers.error('object.incomplete', {
      message: 'Both startDate and endDate must be provided when using explicit date range'
    });
  }
  
  // Validation: endDate must be after or equal to startDate
  if (value.startDate && value.endDate) {
    const start = new Date(value.startDate);
    const end = new Date(value.endDate);
    
    if (end < start) {
      return helpers.error('object.invalidRange', {
        message: 'endDate must be after or equal to startDate'
      });
    }
  }
  
  return value;
}, 'Dashboard query validation');