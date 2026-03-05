import { 
  upsertJournalEntry, 
  listJournalEntries, 
  getJournalStats, 
  getJournalInsights,
  deleteJournalEntry
} from '../services/journal.service.js';

import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import AppError from '../utils/appError.js';

export const createOrUpdateJournalEntry = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { date, content, mood, tags, images, append } = req.body;

  const entry = await upsertJournalEntry(
    userId, 
    { date, content, mood, tags, images }, 
    { append }
  );

  return sendSuccess(res, 200, entry, 'Journal entry saved');
});

export const listJournalController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const result = await listJournalEntries(userId, req.query);

  return sendSuccess(res, 200, result);
});

export const deleteJournalController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  const deleted = await deleteJournalEntry(userId, id);
  if (!deleted) {
    throw new AppError('Journal entry not found or not authorized', 404);
  }

  return sendSuccess(res, 200, null, 'Journal entry deleted');
});

export const getJournalStatsController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { startDate, endDate } = req.query;

  const stats = await getJournalStats(userId, startDate, endDate);

  return sendSuccess(res, 200, stats, 'Journal statistics retrieved');
});

export const getJournalInsightsController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { startDate, endDate } = req.query;

  const insights = await getJournalInsights(userId, startDate, endDate);

  return sendSuccess(res, 200, insights, 'Journal insights generated');
});