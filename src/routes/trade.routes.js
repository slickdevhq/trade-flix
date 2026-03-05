import { Router } from 'express';
import multer from 'multer';
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
import { importFromFile } from '../controllers/import.controller.js';
import { enforceTradeLimit } from '../middleware/subscription.middleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// List trades with filters
router.get('/', listTrades);

// Stats for dashboard cards
router.get('/stats', getStats);

// Tags aggregation for filter dropdown
router.get('/tags', getTags);

// Import trades from file
router.post('/import/file', upload.single('file'), importFromFile);

// Create trade
router.post('/', enforceTradeLimit, validate(createTradeSchema), createTrade);

// Single trade CRUD
router.get('/:id', getTrade);
router.patch('/:id', validate(updateTradeSchema), updateTrade);
router.delete('/:id', deleteTrade);

export default router;