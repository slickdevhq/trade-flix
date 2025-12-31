import Joi from 'joi';

export const createTradeSchema = Joi.object({
  date: Joi.date().required(),
  symbol: Joi.string().uppercase().trim().required(),
  side: Joi.string().valid('long', 'short').required(),
  entryPrice: Joi.number().min(0).required(),
  exitPrice: Joi.number().min(0).optional().allow(null),
  size: Joi.number().min(0).required(),
  notes: Joi.string().max(5000).optional().allow('', null),
  tags: Joi.alternatives()
    .try(Joi.array().items(Joi.string().trim()).default([]), Joi.string().trim())
    .optional(),
  sentiment: Joi.string().valid('bullish', 'bearish', 'neutral').optional(),
  newsImpact: Joi.string().valid('high', 'medium', 'low', 'none').optional(),
  rr: Joi.number().min(0).optional(),
});

export const updateTradeSchema = Joi.object({
  date: Joi.date().optional(),
  symbol: Joi.string().uppercase().trim().optional(),
  side: Joi.string().valid('long', 'short').optional(),
  entryPrice: Joi.number().min(0).optional(),
  exitPrice: Joi.number().min(0).optional().allow(null),
  size: Joi.number().min(0).optional(),
  notes: Joi.string().max(5000).optional().allow('', null),
  tags: Joi.alternatives()
    .try(Joi.array().items(Joi.string().trim()), Joi.string().trim())
    .optional(),
  sentiment: Joi.string().valid('bullish', 'bearish', 'neutral').optional(),
  newsImpact: Joi.string().valid('high', 'medium', 'low', 'none').optional(),
  rr: Joi.number().min(0).optional(),
}).min(1);

export const listTradesQuerySchema = Joi.object({
  page: Joi.number().min(1).default(1),           
  limit: Joi.number().min(1).max(100).default(20),
  sort: Joi.string().default('-date'),
  q: Joi.string().optional(),
  side: Joi.string().valid('long', 'short').optional(),
  tags: Joi.string().optional(), // comma-separated list
  sentiment: Joi.string().valid('bullish', 'bearish', 'neutral').optional(),
  impact: Joi.string().valid('high', 'medium', 'low', 'none').optional(),
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  minPnl: Joi.number().optional(),
  maxPnl: Joi.number().optional(),
  rrMin: Joi.number().optional(),
  rrMax: Joi.number().optional(),
});

export const importTextSchema = Joi.object({
  // Placeholder for future; file handled by multer
});