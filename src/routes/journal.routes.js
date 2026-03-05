import express from 'express';
import { validate } from '../middleware/validate.middleware.js';
import { 
  upsertJournalSchema, 
  listJournalQuerySchema, 
  statsQuerySchema, 
  insightsQuerySchema,
  deleteJournalSchema
} from '../validation/journal.validation.js';
import { 
  createOrUpdateJournalEntry, 
  listJournalController, 
  getJournalStatsController, 
  getJournalInsightsController,
  deleteJournalController
} from '../controllers/journal.controller.js';

const router = express.Router();

router.post('/', validate(upsertJournalSchema), createOrUpdateJournalEntry);
router.get('/', validate(listJournalQuerySchema), listJournalController);
router.delete('/:id', validate(deleteJournalSchema), deleteJournalController);
router.get('/stats', validate(statsQuerySchema), getJournalStatsController);
router.get('/ai-insights', validate(insightsQuerySchema), getJournalInsightsController);

export default router;