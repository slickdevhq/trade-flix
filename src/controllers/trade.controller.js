import Trade from '../models/Trade.model.js';
import AppError from '../utils/appError.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Helper to build filters from query params
const buildFilters = (userId, query) => {
  const {
    q,
    side,
    tags,
    sentiment,
    impact,
    from,
    to,
    minPnl,
    maxPnl,
    rrMin,
    rrMax,
    symbol,
    status,
  } = query;

  const filter = { user: userId };

  if (symbol) filter.symbol = symbol.toUpperCase();
  if (side) filter.side = side;
  if (sentiment) filter.sentiment = sentiment;
  if (impact) filter.newsImpact = impact;
  if (status) filter.status = status;

  if (typeof minPnl !== 'undefined' || typeof maxPnl !== 'undefined') {
    filter.pnl = {};
    if (typeof minPnl !== 'undefined') filter.pnl.$gte = Number(minPnl);
    if (typeof maxPnl !== 'undefined') filter.pnl.$lte = Number(maxPnl);
  }

  if (typeof rrMin !== 'undefined' || typeof rrMax !== 'undefined') {
    filter.rr = {};
    if (typeof rrMin !== 'undefined') filter.rr.$gte = Number(rrMin);
    if (typeof rrMax !== 'undefined') filter.rr.$lte = Number(rrMax);
  }

  // Date range filtering with proper end-of-day handling
  if (from || to) {
    filter.date = {};
    if (from) {
      const fromDate = new Date(from);
      fromDate.setHours(0, 0, 0, 0);
      filter.date.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      filter.date.$lte = toDate;
    }
  }

  if (tags) {
    const tagList = String(tags)
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (tagList.length) filter.tags = { $all: tagList };
  }

  if (q) {
    filter.$or = [
      { symbol: new RegExp(q, 'i') },
      { notes: new RegExp(q, 'i') },
      { tags: new RegExp(q, 'i') },
    ];
  }

  return filter;
};

export const listTrades = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, sort = '-date' } = req.query;
  const filter = buildFilters(req.user._id, req.query);

  const [items, total] = await Promise.all([
    Trade.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Trade.countDocuments(filter),
  ]);

  return sendSuccess(res, 200, {
    items,
    page: Number(page),
    limit: Number(limit),
    total,
    pages: Math.ceil(total / limit),
  });
});

export const getTrade = asyncHandler(async (req, res, next) => {
  const trade = await Trade.findOne({ _id: req.params.id, user: req.user._id });
  if (!trade) throw AppError.notFound('Trade not found', 'TRADE_NOT_FOUND');

  return sendSuccess(res, 200, trade);
});

export const createTrade = asyncHandler(async (req, res) => {
  let tags = req.body.tags;
  if (typeof tags === 'string') {
    tags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const payload = { ...req.body, user: req.user._id, tags };
  const trade = await Trade.create(payload);

  return sendSuccess(res, 201, trade, 'Trade created');
});

export const updateTrade = asyncHandler(async (req, res, next) => {
  let update = { ...req.body };
  if (typeof update.tags === 'string') {
    update.tags = update.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const trade = await Trade.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    update,
    { new: true, runValidators: true }
  );

  if (!trade) throw AppError.notFound('Trade not found', 'TRADE_NOT_FOUND');

  return sendSuccess(res, 200, trade, 'Trade updated');
});

export const deleteTrade = asyncHandler(async (req, res) => {
  const trade = await Trade.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!trade) throw AppError.notFound('Trade not found', 'TRADE_NOT_FOUND');

  return sendSuccess(res, 200, null, 'Trade deleted');
});

export const getStats = asyncHandler(async (req, res) => {
  const match = buildFilters(req.user._id, req.query);
  
  // Only include closed trades in statistics
  match.status = 'closed';

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        winningTrades: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, 1, 0] } },
        losingTrades: { $sum: { $cond: [{ $lt: ['$pnl', 0] }, 1, 0] } },
        breakEvenTrades: { $sum: { $cond: [{ $eq: ['$pnl', 0] }, 1, 0] } },
        netPnl: { $sum: '$pnl' },
        totalWinAmount: { 
          $sum: { $cond: [{ $gt: ['$pnl', 0] }, '$pnl', 0] } 
        },
        totalLossAmount: { 
          $sum: { $cond: [{ $lt: ['$pnl', 0] }, '$pnl', 0] } 
        },
        largestWin: { $max: '$pnl' },
        largestLoss: { $min: '$pnl' },
        avgRR: { $avg: '$rr' },
      },
    },
  ];

  const [stats] = await Trade.aggregate(pipeline);
  console.log(stats);
  // Calculate additional metrics
  const totalTrades = stats?.totalTrades || 0;
  const winningTrades = stats?.winningTrades || 0;
  const losingTrades = stats?.losingTrades || 0;
  const totalWinAmount = stats?.totalWinAmount || 0;
  const totalLossAmount = stats?.totalLossAmount || 0;

  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100) : 0;
  const avgWin = winningTrades > 0 ? (totalWinAmount / winningTrades) : 0;
  const avgLoss = losingTrades > 0 ? (totalLossAmount / losingTrades) : 0;
  
  // Profit Factor = Total Wins / Abs(Total Losses)
  const profitFactor = totalLossAmount !== 0 ? (totalWinAmount / Math.abs(totalLossAmount)) : 0;

  // Expectancy = (Win Rate × Avg Win) - (Loss Rate × Abs(Avg Loss))
  const lossRate = totalTrades > 0 ? ((losingTrades / totalTrades) * 100) : 0;
  const expectancy = (winRate / 100 * avgWin) + (lossRate / 100 * avgLoss);

  return sendSuccess(res, 200, {
    totalTrades,
    winningTrades,
    losingTrades,
    breakEvenTrades: stats?.breakEvenTrades || 0,
    netPnl: Number((stats?.netPnl || 0).toFixed(2)),
    winRate: Number(winRate.toFixed(2)),
    avgWin: Number(avgWin.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    largestWin: Number((stats?.largestWin || 0).toFixed(2)),
    largestLoss: Number((stats?.largestLoss || 0).toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    expectancy: Number(expectancy.toFixed(2)),
    avgRR: Number((stats?.avgRR || 0).toFixed(2)),
  });
});

export const getTags = asyncHandler(async (req, res) => {
  const match = { user: req.user._id };
  const { format } = req.query;
  
  const pipeline = [
    { $match: match },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ];

  const tags = await Trade.aggregate(pipeline);
  if (format === 'simple') {
    return sendSuccess(res, 200, tags.map(t => t._id));
  }

  return sendSuccess(res, 200, tags);
});