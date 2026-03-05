import Joi from 'joi';

export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  initialBalance: Joi.number().min(0).optional(),
}).min(1);

export const requestEmailChangeSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(8).required(),
  newPassword: Joi.string()
    .min(8)
    .max(100)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
    .invalid(Joi.ref('currentPassword'))
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.invalid': 'New password must be different from current password',
    })
    .required(),
  confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Passwords do not match',
  }),
});

export const updatePreferencesSchema = Joi.object({
  darkMode: Joi.boolean().optional(),
  pushNotifications: Joi.boolean().optional(),
  emailDigest: Joi.boolean().optional(),
  aiInsights: Joi.boolean().optional(),
}).min(1);

export const upgradeSubscriptionSchema = Joi.object({
  tier: Joi.string().valid('free', 'pro').required(),
});

export const exportQuerySchema = Joi.object({
  format: Joi.string().valid('json', 'csv').default('json'),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
});

export const accountDeletionSchema = Joi.object({
  password: Joi.string().min(8).optional(), // Optional for OAuth users
});