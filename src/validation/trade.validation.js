import Joi from 'joi';

export const createTradeSchema = Joi.object({
  date: Joi.date().required(),
  symbol: Joi.string().uppercase().trim().required(),
  side: Joi.string().valid('long', 'short').required(),
  entryPrice: Joi.number().min(0).required(),
  exitPrice: Joi.number().min(0).optional().allow(null),
  stopLoss: Joi.number().min(0).optional().allow(null),
  targetPrice: Joi.number().min(0).optional().allow(null), // Added for proper R:R calculation
  size: Joi.number().min(0).required(),
  notes: Joi.string().max(5000).optional().allow('', null),
  tags: Joi.alternatives()
    .try(Joi.array().items(Joi.string().trim()).default([]), Joi.string().trim())
    .optional(),
  sentiment: Joi.string().valid('bullish', 'bearish', 'neutral').optional(),
  newsImpact: Joi.string().valid('high', 'medium', 'low', 'none').optional(),
  rr: Joi.number().min(0).optional(), // Manual override allowed
  pnl: Joi.number().optional(), // Allowed for manual override (e.g., from imports)
  status: Joi.string().valid('open', 'closed').optional(), // Auto-calculated but can be set
});

export const updateTradeSchema = Joi.object({
  date: Joi.date().optional(),
  symbol: Joi.string().uppercase().trim().optional(),
  side: Joi.string().valid('long', 'short').optional(),
  entryPrice: Joi.number().min(0).optional(),
  exitPrice: Joi.number().min(0).optional().allow(null),
  stopLoss: Joi.number().min(0).optional().allow(null),
  targetPrice: Joi.number().min(0).optional().allow(null), // Added
  size: Joi.number().min(0).optional(),
  notes: Joi.string().max(5000).optional().allow('', null),
  tags: Joi.alternatives()
    .try(Joi.array().items(Joi.string().trim()), Joi.string().trim())
    .optional(),
  sentiment: Joi.string().valid('bullish', 'bearish', 'neutral').optional(),
  newsImpact: Joi.string().valid('high', 'medium', 'low', 'none').optional(),
  rr: Joi.number().min(0).optional(),
  pnl: Joi.number().optional(),
  status: Joi.string().valid('open', 'closed').optional(),
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
  symbol: Joi.string().optional(),
  status: Joi.string().valid('open', 'closed').optional(), // Added for filtering open/closed trades
  format: Joi.string().valid('simple', 'detailed').optional(),
});

export const importTextSchema = Joi.object({
  // Placeholder for future; file handled by multer
});