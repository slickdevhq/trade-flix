import Joi from 'joi';

export const upsertJournalSchema = {
  body: Joi.object({
    date: Joi.alternatives().try(Joi.date(), Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    content: Joi.string().min(1).max(10000).required(),
    mood: Joi.string().valid('Confident', 'Neutral', 'Fearful', 'Reflective', 'Frustrated').optional(),
    tags: Joi.array().items(Joi.string().min(1).max(64)).optional(),
    images: Joi.array().items(Joi.string().uri()).optional(), // Array of image URLs
    append: Joi.boolean().optional().default(true),
    replace: Joi.boolean().optional().default(false),
  }),
};

export const listJournalQuerySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().optional().default('-date'),
    mood: Joi.string().valid('Confident', 'Neutral', 'Fearful', 'Reflective', 'Frustrated').optional(),
    tags: Joi.string().optional(),
    q: Joi.string().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
  }),
};

export const statsQuerySchema = {
  query: Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
  }),
};

export const insightsQuerySchema = {
  query: Joi.object({
    range: Joi.string().valid('30days', '60days', '90days', 'all', 'custom').default('30days'),
    startDate: Joi.date().when('range', {
      is: 'custom',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    endDate: Joi.date().when('range', {
      is: 'custom',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
  }),
};

export const deleteJournalSchema = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
};