import { Router } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import {
  createTradeSchema,
  updateTradeSchema,
  listTradesQuerySchema,
} from '../validation/trade.validation.js';
import {
  listTrades,
  getTrade,
  createTrade,
  updateTrade,
  deleteTrade,
  getStats,
  getTags,
} from '../controllers/trade.controller.js';

const router = Router();

// List trades with filters
router.get('/', listTrades);

// Stats for dashboard cards
router.get('/stats', getStats);

// Tags aggregation for filter dropdown
router.get('/tags', getTags);

// Create trade
router.post('/', validate(createTradeSchema), createTrade);

// Single trade CRUD
router.get('/:id', getTrade);
router.patch('/:id', validate(updateTradeSchema), updateTrade);
router.delete('/:id', deleteTrade);

export default router;