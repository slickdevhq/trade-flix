import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { getDashboardData } from '../services/dashboard.service.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const { startDate, endDate, tzOffsetMinutes, limitTrades } = req.query;

  const data = await getDashboardData(req.user._id, {
    startDate,
    endDate,
    tzOffsetMinutes: tzOffsetMinutes ? Number(tzOffsetMinutes) : 0,
    limitTrades: limitTrades ? Number(limitTrades) : 4,
  });

  // Personalize greeting using user's name when available
  if (req.user?.name) {
    data.greeting = data.greeting.replace('Trader', req.user.name);
  }

  return sendSuccess(res, 200, data, 'Dashboard data loaded');
});