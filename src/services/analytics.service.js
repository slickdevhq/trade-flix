import Trade from '../models/Trade.model.js';
import User from '../models/User.model.js';
import { getPreviousPeriod } from '../utils/resolveDateRange.js';

/**
 * Build base MongoDB match query
 * Handles both all-time (null dates) and specific ranges
 */
function baseMatch(userId, startDate, endDate) {
  const match = { user: userId };
  
  // If dates are null (all-time mode), don't add date filter
  if (startDate && endDate) {
    match.date = {
      $gte: startDate,
      $lte: endDate
    };
  }
  
  return match;
}

/**
 * KPI Cards with proper period-over-period comparison
 */
export async function getKpiCards(userId, startDate, endDate) {
  const currMatch = baseMatch(userId, startDate, endDate);
  
  // Get previous period for comparison (handles null dates gracefully)
  const { startDate: prevStart, endDate: prevEnd } = getPreviousPeriod(startDate, endDate);
  const prevMatch = baseMatch(userId, prevStart, prevEnd);

  const currPipeline = [
    { $match: currMatch },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        winningTrades: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, 1, 0] } },
        losingTrades: { $sum: { $cond: [{ $lt: ['$pnl', 0] }, 1, 0] } },
        grossProfit: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, '$pnl', 0] } },
        grossLoss: { $sum: { $cond: [{ $lt: ['$pnl', 0] }, '$pnl', 0] } },
        avgWin: { $avg: { $cond: [{ $gt: ['$pnl', 0] }, '$pnl', '$$REMOVE'] } },
        avgLoss: { $avg: { $cond: [{ $lt: ['$pnl', 0] }, '$pnl', '$$REMOVE'] } },
      },
    },
  ];

  const prevPipeline = [
    { $match: prevMatch },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        winningTrades: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, 1, 0] } },
        grossProfit: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, '$pnl', 0] } },
        grossLoss: { $sum: { $cond: [{ $lt: ['$pnl', 0] }, '$pnl', 0] } },
      },
    },
  ];

  const [[curr], [prev]] = await Promise.all([
    Trade.aggregate(currPipeline),
    Trade.aggregate(prevPipeline),
  ]);

  const calcWinRate = (w, t) => (t && t > 0 ? (w / t) * 100 : 0);
  const calcProfitFactor = (gp, gl) => {
    const absGl = Math.abs(gl || 0);
    if (absGl === 0) return gp > 0 ? 999 : 0;
    return (gp || 0) / absGl;
  };

  const winRate = calcWinRate(curr?.winningTrades || 0, curr?.totalTrades || 0);
  const profitFactor = calcProfitFactor(curr?.grossProfit || 0, curr?.grossLoss || 0);

  const prevWinRate = prev ? calcWinRate(prev.winningTrades || 0, prev.totalTrades || 0) : null;
  const prevProfitFactor = prev ? calcProfitFactor(prev.grossProfit || 0, prev.grossLoss || 0) : null

  const avgWinValue = Number((curr?.avgWin || 0).toFixed(2));
  const avgLossValue = Number((curr?.avgLoss || 0).toFixed(2)); // Keep negative

  return {
    winRate: {
      value: Number(winRate.toFixed(1)),
      deltaVsPrev: prevWinRate !== null ? Number((winRate - prevWinRate).toFixed(1)) : null
    },
    profitFactor: {
      value: Number(profitFactor.toFixed(1)),
      deltaVsPrev: prevProfitFactor !== null ? Number((profitFactor - prevProfitFactor).toFixed(1)) : null,
    },
    averageWin: {
      value: avgWinValue,
      label: 'Avg Win',
    },
    averageLoss: {
      value: Math.abs(avgLossValue), // UI displays positive
      label: 'Avg Loss',
      warning: Math.abs(avgLossValue) > avgWinValue, // Alert if avg loss > avg win
    },
  };
}

/**
 * Equity curve with proper initial balance handling
 */
export async function getEquityCurve(userId, startDate, endDate) {
  const match = baseMatch(userId, startDate, endDate);
  
  const user = await User.findById(userId).select('initialBalance').lean();
  const initialBalance = user?.initialBalance || 0;
  
  const pipeline = [
    { $match: match },
    { $sort: { date: 1 } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        pnl: { $sum: '$pnl' },
      },
    },
    { $sort: { _id: 1 } },
  ];
  
  const rows = await Trade.aggregate(pipeline);
  
  // FIX: Add initial data point if we have a defined start date
  const result = [];
  if (startDate && rows.length > 0) {
    const firstTradeDate = rows[0]._id;
    const periodStart = startDate.toISOString().split('T')[0];
    
    // Only add initial point if first trade is AFTER period start
    if (firstTradeDate > periodStart) {
      result.push({
        date: periodStart,
        balance: Number(initialBalance.toFixed(2))
      });
    }
  }
  
  let cumulativePnl = initialBalance;
  
  rows.forEach((r) => {
    cumulativePnl += r.pnl;
    result.push({ 
      date: r._id, 
      balance: Number(cumulativePnl.toFixed(2)) 
    });
  });
  
  return result;
}

/**
 * Monthly P&L aggregation
 */
export async function getMonthlyPnl(userId, startDate, endDate) {
  const match = baseMatch(userId, startDate, endDate);
  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: { 
          year: { $year: '$date' }, 
          month: { $month: '$date' } 
        },
        pnl: { $sum: '$pnl' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ];
  
  const rows = await Trade.aggregate(pipeline);
  
  return rows.map((r) => {
    const monthName = new Date(r._id.year, r._id.month - 1, 1)
      .toLocaleString('en-US', { month: 'long' });
    
    return {
      month: monthName,
      value: Number(r.pnl.toFixed(2)),
    };
  });
}

/**
 * Common Mistakes - Professional implementation
 * Uses explicit mistake fields, not tags
 */
export async function getMistakeFrequency(userId, startDate, endDate) {
  const match = baseMatch(userId, startDate, endDate);
  
  // Only losing trades with mistakes recorded
  match.pnl = { $lt: 0 };
  match.mistakes = { $exists: true, $ne: [] };
  
  const pipeline = [
    { $match: match },
    { $unwind: '$mistakes' },
    { 
      $group: { 
        _id: '$mistakes', 
        count: { $sum: 1 } 
      } 
    },
    { $sort: { count: -1 } },
  ];
  
  const rows = await Trade.aggregate(pipeline);
  
  // Get total losing trades for percentage calculation
  const totalLosingTrades = await Trade.countDocuments({
    ...baseMatch(userId, startDate, endDate),
    pnl: { $lt: 0 }
  });
  
  // Map internal mistake codes to display labels
  const mistakeLabels = {
    late_exit: 'Late Exit',
    early_entry: 'Early Entry',
    position_sizing: 'Position Sizing',
    stop_loss: 'Stop Loss',
    fomo: 'FOMO',
    revenge_trading: 'Revenge Trading',
    overtrading: 'Overtrading',
    ignored_plan: 'Ignored Plan',
    emotional: 'Emotional Trading',
  };
  
  return rows.map((r) => ({
    mistake: mistakeLabels[r._id] || r._id,
    count: r.count,
    percentage: totalLosingTrades > 0 
      ? Number(((r.count / totalLosingTrades) * 100).toFixed(0)) 
      : 0,
  }));
}

/**
 * Performance summary for the period
 */
export async function getPerformanceSummary(userId, startDate, endDate) {
  const match = baseMatch(userId, startDate, endDate);
  
  // Get previous period for comparison
  const { startDate: prevStart, endDate: prevEnd } = getPreviousPeriod(startDate, endDate);
  const prevMatch = baseMatch(userId, prevStart, prevEnd);

  const [[curr], [prev]] = await Promise.all([
    Trade.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          totalPnl: { $sum: '$pnl' },
          winningTrades: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, 1, 0] } },
        },
      },
    ]),
    Trade.aggregate([
      { $match: prevMatch },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          totalPnl: { $sum: '$pnl' },
        },
      },
    ]),
  ]);

  const winRate = (curr?.totalTrades || 0) > 0 
    ? ((curr?.winningTrades || 0) / curr.totalTrades) * 100 
    : 0;

  const prevTotalTrades = prev?.totalTrades || 0;
  const prevTotalPnl = prev?.totalPnl || 0;

  return {
    totalTrades: {
      value: curr?.totalTrades || 0,
      deltaVsPrev: (curr?.totalTrades || 0) - prevTotalTrades,
    },
    totalPnl: {
      value: Number((curr?.totalPnl || 0).toFixed(2)),
      deltaVsPrevPercent: prevTotalPnl !== 0
        ? Number((((curr?.totalPnl || 0) - prevTotalPnl) / Math.abs(prevTotalPnl) * 100).toFixed(1))
        : 0,
    },
    winningTrades: {
      value: curr?.winningTrades || 0,
      winRate: Number(winRate.toFixed(1)),
    },
  };
}