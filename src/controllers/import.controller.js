import { parseAndImportTrades } from '../services/import.service.js';
import { sendSuccess } from '../utils/response.js';
import AppError from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const importFromFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw AppError.badRequest('No file uploaded', 'NO_FILE');
  }

  try {
    const count = await parseAndImportTrades(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      req.user._id
    );

    return sendSuccess(res, 201, { imported: count }, `Successfully imported ${count} trades`);
  } catch (error) {
    if (error.code === 'EMPTY_IMPORT') {
      throw AppError.badRequest(error.message, 'EMPTY_IMPORT');
    }
    throw error;
  }
});