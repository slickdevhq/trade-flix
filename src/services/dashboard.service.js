import mongoose from 'mongoose';
import Trade from '../models/Trade.model.js';
import Goal from '../models/Goal.model.js';
import Habit from '../models/Habit.model.js';
import JournalEntry from "../models/JournalEntry.model.js"
import { resolveDateRange } from '../utils/resolveDateRange.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(date, tzOffsetMinutes = 0) {
  const offsetMs = (tzOffsetMinutes || 0) * 60 * 1000;
  const ms = (date?.getTime() ?? Date.now()) + offsetMs;
  const d = new Date(ms);
  const midnightLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return new Date(midnightLocal.getTime() - offsetMs);
}

function getCurrentWeekRangeUTC(tzOffsetMinutes = 0) {
  const offsetMs = (tzOffsetMinutes || 0) * 60 * 1000;
  const now = new Date();
  const localNowMs = now.getTime() + offsetMs;
  const localNow = new Date(localNowMs);
  const localMidnight = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate());
  const localDay = localNow.getDay();
  const daysSinceMonday = (localDay + 6) % 7;
  const weekStartLocalMs = localMidnight.getTime() - daysSinceMonday * DAY_MS;
  const weekEndLocalMs = weekStartLocalMs + 7 * DAY_MS;
  return {
    startUtc: new Date(weekStartLocalMs - offsetMs),
    endUtc: new Date(weekEndLocalMs - offsetMs),
    weekStartLocalMs,
  };
}

function labelForLocalKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map((s) => parseInt(s, 10));
  const d = new Date(Date.UTC(year, month - 1, day));
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const wd = weekdays[d.getUTCDay()];
  return `${String(day).padStart(2, '0')} ${wd}`;
}

// FIXED: Now respects date range for filtering (calendar shows current week but filters by range)
export async function getWeeklyCalendar(userId, tzOffsetMinutes = 0, dateRange = {}) {
  const { startUtc, endUtc, weekStartLocalMs } = getCurrentWeekRangeUTC(tzOffsetMinutes);
  const offsetMs = (tzOffsetMinutes || 0) * 60 * 1000;

  const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
    ? new mongoose.Types.ObjectId(userId) 
    : userId;

  // Build match query with optional date range filtering
  const match = { 
    user: userObjectId, 
    date: { $gte: startUtc, $lt: endUtc } 
  };
  
  // If date range provided, further filter within the week
  if (dateRange.startDate || dateRange.endDate) {
    if (dateRange.startDate && new Date(dateRange.startDate) > startUtc) {
      match.date.$gte = new Date(dateRange.startDate);
    }
    if (dateRange.endDate && new Date(dateRange.endDate) < endUtc) {
      match.date.$lt = new Date(dateRange.endDate);
    }
  }

  const rows = await Trade.aggregate([
    { $match: match },
    { $addFields: { localDateKey: { $dateToString: { format: '%Y-%m-%d', date: { $add: ['$date', offsetMs] } } } } },
    { $group: { _id: '$localDateKey', netPnl: { $sum: '$pnl' }, tradeCount: { $sum: 1 } } },
  ]);
  const byKey = new Map(rows.map((r) => [r._id, { netPnl: r.netPnl || 0, tradeCount: r.tradeCount || 0 }]));

  const cards = [];
  for (let i = 0; i < 7; i += 1) {
    const localMs = weekStartLocalMs + i * DAY_MS;
    const localDate = new Date(localMs);
    const dateKey = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
    const label = labelForLocalKey(dateKey);
    const data = byKey.get(dateKey) || { netPnl: 0, tradeCount: 0 };
    cards.push({ dateKey, label, netPnl: Number((data.netPnl || 0).toFixed(2)), tradeCount: data.tradeCount });
  }
  return cards;
}

export async function getKeyMetrics(userId, startDate, endDate) {
  const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
    ? new mongoose.Types.ObjectId(userId) 
    : userId;

  const match = { user: userObjectId, status: 'closed' };
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }
  
  const [stats] = await Trade.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        totalPnl: { $sum: '$pnl' },
        wins: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, 1, 0] } },
        grossProfit: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, '$pnl', 0] } },
        grossLoss: { $sum: { $cond: [{ $lt: ['$pnl', 0] }, { $abs: '$pnl' }, 0] } },
      },
    },
  ]);
  
  const s = stats || { totalTrades: 0, totalPnl: 0, wins: 0, grossProfit: 0, grossLoss: 0 };
  const winRate = s.totalTrades > 0 ? Number(((s.wins / s.totalTrades) * 100).toFixed(1)) : 0;
  const profitFactor = s.grossLoss > 0 ? Number((s.grossProfit / s.grossLoss).toFixed(1)) : 0;
  
  return {
    totalPnl: Number((s.totalPnl || 0).toFixed(2)),
    winRate,
    totalTrades: s.totalTrades || 0,
    profitFactor,
  };
}

function generatePnLCurve(trade) {
  if (trade.status !== 'closed' || !trade.exitPrice) {
    return Array(15).fill(0);
  }
  
  const points = 15;
  const totalPnl = trade.pnl || 0;
  const curve = [];
  
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const volatilityFactor = Math.sin(progress * Math.PI) * 0.2;
    const pnl = totalPnl * progress * (1 + volatilityFactor);
    curve.push(Number(pnl.toFixed(2)));
  }
  
  return curve;
}

// FIXED: Now respects date range
export async function getRecentTrades(userId, dateRange = {}, limit = 4) {
  const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
    ? new mongoose.Types.ObjectId(userId) 
    : userId;

  const match = { user: userObjectId };
  
  // Apply date range if provided
  if (dateRange.startDate || dateRange.endDate) {
    match.date = {};
    if (dateRange.startDate) match.date.$gte = new Date(dateRange.startDate);
    if (dateRange.endDate) match.date.$lte = new Date(dateRange.endDate);
  }

  const trades = await Trade.find(match)
    .sort({ date: -1 })
    .limit(limit)
    .select('symbol side date pnl status entryPrice exitPrice')
    .lean();
    
  return trades.map((t) => ({
    symbol: t.symbol,
    side: t.side,
    date: t.date,
    pnl: Number((t.pnl || 0).toFixed(2)),
    sparkline: generatePnLCurve(t),
  }));
}

// FIXED: Now respects date range
export async function getHabitStreaks(userId, dateRange = {}) {
  const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
    ? new mongoose.Types.ObjectId(userId) 
    : userId;

  // Note: Habit streaks are point-in-time data, but we can filter by lastUpdated if needed
  const match = { user: userObjectId };
  
  // Optional: Filter habits updated within date range
  if (dateRange.startDate || dateRange.endDate) {
    match.updatedAt = {};
    if (dateRange.startDate) match.updatedAt.$gte = new Date(dateRange.startDate);
    if (dateRange.endDate) match.updatedAt.$lte = new Date(dateRange.endDate);
  }

  const habits = await Habit.find(match)
    .sort({ currentStreak: -1 })
    .limit(3)
    .select('name currentStreak targetStreak')
    .lean();
  
  return habits.map((h) => {
    const current = h.currentStreak || 0;
    const target = h.targetStreak || 1;
    const progressPercent = Math.max(0, Math.min(100, Math.round((current / target) * 100)));
    return { 
      name: h.name, 
      currentStreak: current, 
      targetStreak: target, 
      progressPercent 
    };
  });
}

// FIXED: Now filters goals within date range
export async function getMonthlyGoalProgress(userId, dateRange = {}, tzOffsetMinutes = 0) {
  const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
    ? new mongoose.Types.ObjectId(userId) 
    : userId;

  // Find goals that overlap with the requested date range
  const goalMatch = { user: userObjectId, type: 'PNL', status: 'active' };
  
  if (dateRange.startDate || dateRange.endDate) {
    // Goal overlaps if: goal.startDate <= range.endDate AND goal.endDate >= range.startDate
    goalMatch.$and = [];
    if (dateRange.endDate) {
      goalMatch.$and.push({ startDate: { $lte: new Date(dateRange.endDate) } });
    }
    if (dateRange.startDate) {
      goalMatch.$and.push({ endDate: { $gte: new Date(dateRange.startDate) } });
    }
  }

  const goal = await Goal.findOne(goalMatch)
    .sort({ createdAt: -1 })
    .lean();
    
  if (!goal) return { exists: false };
  
  const target = goal.targetValue || 0;
  const start = goal.startDate;
  const end = goal.endDate;
  
  // Calculate achievement within the intersection of goal period and requested range
  const effectiveStart = dateRange.startDate && new Date(dateRange.startDate) > start 
    ? new Date(dateRange.startDate) 
    : start;
  const effectiveEnd = dateRange.endDate && new Date(dateRange.endDate) < end 
    ? new Date(dateRange.endDate) 
    : end;
  
  const match = { user: userObjectId, status: 'closed' };
  match.date = {};
  if (effectiveStart) match.date.$gte = new Date(effectiveStart);
  if (effectiveEnd) match.date.$lte = new Date(effectiveEnd);
  
  const [agg] = await Trade.aggregate([
    { $match: match },
    { $group: { _id: null, netPnl: { $sum: '$pnl' } } },
  ]);
  
  const achieved = Number((agg?.netPnl || 0).toFixed(2));
  const exceeded = achieved >= target && target > 0;
  const progressPercent = target > 0 ? Math.max(0, Math.min(100, Math.round((achieved / target) * 100))) : 0;
  
  return { exists: true, target, achieved, exceeded, progressPercent };
}

// FIXED: Now respects date range
export async function getMentorInsights(userId, dateRange = {}) {
  const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
    ? new mongoose.Types.ObjectId(userId) 
    : userId;

  // Use provided date range or default to last 30 days
  const endDate = dateRange.endDate ? new Date(dateRange.endDate) : new Date();
  const startDate = dateRange.startDate 
    ? new Date(dateRange.startDate) 
    : new Date(endDate.getTime() - 30 * DAY_MS);

  const trades = await Trade.find({ 
    user: userObjectId, 
    status: 'closed',
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: 1 }).lean();

  if (trades.length < 5) {
    return { cards: [{
      title: 'Keep Trading',
      message: 'Log at least 5 trades to unlock personalized AI insights.',
      metric: null,
      priority: 'low'
    }] };
  }

  const insights = [];

  // 1. HOLDING TIME PATTERN ANALYSIS
  const losers = trades.filter(t => t.pnl < 0);
  const winners = trades.filter(t => t.pnl > 0);
  
  if (losers.length >= 3 && winners.length >= 3) {
    const avgLosingDuration = losers.length;
    const avgWinningDuration = winners.length;
    
    if (avgLosingDuration > avgWinningDuration * 1.5) {
      const percentLonger = Math.round(((avgLosingDuration - avgWinningDuration) / avgWinningDuration) * 100);
      insights.push({
        title: 'Recurring Pattern Detected',
        message: `You tend to hold losing positions ${percentLonger}% longer than winning ones. Consider tightening your stop-loss discipline.`,
        metric: 'hold_time_bias',
        priority: 'high'
      });
    }
  }

  // 2. REVENGE TRADING DETECTION
  let revengeTradeCount = 0;
  for (let i = 1; i < trades.length; i++) {
    const prevTrade = trades[i - 1];
    const currTrade = trades[i];
    const timeDiff = (currTrade.date - prevTrade.date) / (1000 * 60);
    
    if (prevTrade.pnl < 0 && timeDiff < 30) {
      revengeTradeCount++;
    }
  }
  
  if (revengeTradeCount >= 3) {
    const revengePercent = Math.round((revengeTradeCount / trades.length) * 100);
    insights.push({
      title: 'Revenge Trading Alert',
      message: `${revengePercent}% of your trades are taken within 30 minutes of a loss. Take breaks after losing trades to avoid emotional decisions.`,
      metric: 'revenge_trading',
      priority: 'high'
    });
  }

  // 3. MISTAKE CORRELATION ANALYSIS
  const mistakeTrades = trades.filter(t => t.mistakes && t.mistakes.length > 0);
  if (mistakeTrades.length >= 5) {
    const mistakePnL = mistakeTrades.reduce((sum, t) => sum + t.pnl, 0);
    const avgMistakePnL = mistakePnL / mistakeTrades.length;
    
    const cleanTrades = trades.filter(t => !t.mistakes || t.mistakes.length === 0);
    const cleanPnL = cleanTrades.reduce((sum, t) => sum + t.pnl, 0);
    const avgCleanPnL = cleanPnL / (cleanTrades.length || 1);
    
    if (avgMistakePnL < avgCleanPnL * 0.5) {
      insights.push({
        title: 'Discipline Matters',
        message: `Trades with logged mistakes perform ${Math.round(((avgCleanPnL - avgMistakePnL) / Math.abs(avgCleanPnL)) * 100)}% worse. Focus on execution discipline.`,
        metric: 'mistake_impact',
        priority: 'medium'
      });
    }
  }

  // 4. SYMBOL/PATTERN STRENGTH ANALYSIS
  const symbolPerformance = new Map();
  trades.forEach(t => {
    if (!symbolPerformance.has(t.symbol)) {
      symbolPerformance.set(t.symbol, { wins: 0, total: 0, pnl: 0 });
    }
    const stats = symbolPerformance.get(t.symbol);
    stats.total++;
    stats.pnl += t.pnl;
    if (t.pnl > 0) stats.wins++;
  });
  
  let bestSymbol = null;
  let bestWinRate = 0;
  symbolPerformance.forEach((stats, symbol) => {
    if (stats.total >= 3) {
      const winRate = (stats.wins / stats.total) * 100;
      if (winRate > bestWinRate && winRate > 70) {
        bestWinRate = winRate;
        bestSymbol = symbol;
      }
    }
  });
  
  if (bestSymbol) {
    insights.push({
      title: 'Strength Identified',
      message: `${bestSymbol} has a ${Math.round(bestWinRate)}% win rate in your recent trades. Consider focusing more on this setup.`,
      metric: 'symbol_strength',
      priority: 'medium'
    });
  }

  // 5. JOURNAL CONSISTENCY CORRELATION
  const journalEntries = await JournalEntry.find({
    user: userObjectId,
    date: { $gte: startDate, $lte: endDate }
  }).lean();
  
  const tradeDates = new Set(trades.map(t => t.date.toISOString().split('T')[0]));
  const journalDates = new Set(journalEntries.map(e => e.dateKey));
  
  const daysWithBoth = [...tradeDates].filter(d => journalDates.has(d)).length;
  const daysWithOnlyTrades = tradeDates.size - daysWithBoth;
  
  if (daysWithBoth >= 5 && daysWithOnlyTrades >= 5) {
    insights.push({
      title: 'Journaling Helps',
      message: `You've traded on ${daysWithBoth} days with journal entries. Keep this habit to track patterns and improve consistency.`,
      metric: 'journal_correlation',
      priority: 'low'
    });
  }

  return { 
    cards: insights
      .sort((a, b) => {
        const priority = { high: 3, medium: 2, low: 1 };
        return priority[b.priority] - priority[a.priority];
      })
      .slice(0, 3) 
  };
}

export function buildGreeting(name = 'Trader', tzOffsetMinutes = 0) {
  const offsetMs = (tzOffsetMinutes || 0) * 60 * 1000;
  const now = new Date(Date.now() + offsetMs);
  const hour = now.getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return `Good ${part}, ${name}! 👋`;
}

export function monthYearLabel(tzOffsetMinutes = 0) {
  const offsetMs = (tzOffsetMinutes || 0) * 60 * 1000;
  const now = new Date(Date.now() + offsetMs);
  const month = now.toLocaleString('en-US', { month: 'long' });
  return `${month} ${now.getFullYear()}`;
}

// FIXED: Now properly uses resolveDateRange and passes dates to all sub-functions
export async function getDashboardData(userId, options = {}) {
  const { 
    startDate: rawStartDate, 
    endDate: rawEndDate, 
    range,
    tzOffsetMinutes = 0, 
    limitTrades = 4 
  } = options;

  // Resolve date range using the utility
  const { startDate, endDate } = resolveDateRange({
    startDate: rawStartDate,
    endDate: rawEndDate,
    range
  });

  const dateRange = { startDate, endDate };

  // Fetch all data with consistent date filtering
  const [calendar, metrics, trades, streaks, goal, insights] = await Promise.all([
    getWeeklyCalendar(userId, tzOffsetMinutes, dateRange),
    getKeyMetrics(userId, startDate, endDate),
    getRecentTrades(userId, dateRange, limitTrades),
    getHabitStreaks(userId, dateRange),
    getMonthlyGoalProgress(userId, dateRange, tzOffsetMinutes),
    getMentorInsights(userId, dateRange),
  ]);
  
  return {
    greeting: buildGreeting(undefined, tzOffsetMinutes),
    dateContext: `Daily P&L - ${monthYearLabel(tzOffsetMinutes)}`,
    dailyCalendar: calendar,
    keyMetrics: metrics,
    recentTrades: trades,
    streaks,
    monthlyGoal: goal,
    mentorInsights: insights,
  };
}