import { 
  getKpiCards, 
  getEquityCurve as getEquityCurveService, 
  getMonthlyPnl, 
  getMistakeFrequency, 
  getPerformanceSummary 
} from '../services/analytics.service.js';
import { sendSuccess } from '../utils/response.js';
import { resolveDateRange, formatDateRange } from '../utils/resolveDateRange.js';

/**
 * GET /api/v1/analytics/overview
 * Returns all analytics data in one call (dashboard initial load)
 * Query: ?startDate=2024-01-01&endDate=2024-01-31
 * Query: ?range=month
 * Query: (no params - defaults to current month)
 */
export const getAnalyticsOverview = async (req, res, next) => {
  try {
    // ✅ Use your existing date helper - now enhanced!
    const { startDate, endDate } = resolveDateRange(req.query);
    
    const [kpi, performance, equity, monthly, mistakes] = await Promise.all([
      getKpiCards(req.user._id, startDate, endDate),
      getPerformanceSummary(req.user._id, startDate, endDate),
      getEquityCurveService(req.user._id, startDate, endDate),
      getMonthlyPnl(req.user._id, startDate, endDate),
      getMistakeFrequency(req.user._id, startDate, endDate),
    ]);

    return sendSuccess(res, 200, {
      period: { 
        startDate, 
        endDate,
        label: formatDateRange(startDate, endDate) // Human-readable label for UI
      },
      kpi,
      performance,
      equity,
      monthly,
      mistakes
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/analytics/kpi
 * Returns only KPI cards and performance summary
 */
export const getKpiMetrics = async (req, res, next) => {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    
    const [kpi, performance] = await Promise.all([
      getKpiCards(req.user._id, startDate, endDate),
      getPerformanceSummary(req.user._id, startDate, endDate),
    ]);

    return sendSuccess(res, 200, {
      period: { 
        startDate, 
        endDate,
        label: formatDateRange(startDate, endDate)
      },
      kpi,
      performance
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/analytics/equity
 * Returns only equity curve data
 */
export const getEquityCurve = async (req, res, next) => {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    const equity = await getEquityCurveService(req.user._id, startDate, endDate);

    return sendSuccess(res, 200, {
      period: { 
        startDate, 
        endDate,
        label: formatDateRange(startDate, endDate)
      },
      equity
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/analytics/monthly
 * Returns only monthly P&L breakdown
 */
export const getMonthlyBreakdown = async (req, res, next) => {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    const monthly = await getMonthlyPnl(req.user._id, startDate, endDate);

    return sendSuccess(res, 200, {
      period: { 
        startDate, 
        endDate,
        label: formatDateRange(startDate, endDate)
      },
      monthly
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/analytics/mistakes
 * Returns only common mistakes analysis
 */
export const getMistakeAnalysis = async (req, res, next) => {
  try {
    const { startDate, endDate } = resolveDateRange(req.query);
    const mistakes = await getMistakeFrequency(req.user._id, startDate, endDate);

    return sendSuccess(res, 200, {
      period: { 
        startDate, 
        endDate,
        label: formatDateRange(startDate, endDate)
      },
      mistakes
    });
  } catch (err) {
    next(err);
  }
};