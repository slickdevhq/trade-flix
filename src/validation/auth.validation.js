import Joi from 'joi';

const passwordSchema = Joi.string()
  .min(8)
  .max(100)
  .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base':
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  .required();

export const registerSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: passwordSchema,
  name: Joi.string().max(50).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
});

export const resetPasswordSchema = Joi.object({
  password: passwordSchema,
});