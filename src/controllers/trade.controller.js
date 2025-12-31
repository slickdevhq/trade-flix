import Trade from '../models/Trade.model.js';
import AppError from '../utils/appError.js';
import { sendSuccess } from '../utils/response.js';

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
  } = query;

  const filter = { user: userId };

  if (symbol) filter.symbol = symbol.toUpperCase();
  if (side) filter.side = side;
  if (sentiment) filter.sentiment = sentiment;
  if (impact) filter.newsImpact = impact;

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

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
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

export const listTrades = async (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
};

export const getTrade = async (req, res, next) => {
  try {
    const trade = await Trade.findOne({ _id: req.params.id, user: req.user._id });
    if (!trade) return next(AppError.notFound('Trade not found', 'TRADE_NOT_FOUND'));
    return sendSuccess(res, 200, trade);
  } catch (err) {
    next(err);
  }
};

export const createTrade = async (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
};

export const updateTrade = async (req, res, next) => {
  try {
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

    if (!trade) return next(AppError.notFound('Trade not found', 'TRADE_NOT_FOUND'));
    return sendSuccess(res, 200, trade, 'Trade updated');
  } catch (err) {
    next(err);
  }
};

export const deleteTrade = async (req, res, next) => {
  try {
    const trade = await Trade.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!trade) return next(AppError.notFound('Trade not found', 'TRADE_NOT_FOUND'));
    return sendSuccess(res, 200, null, 'Trade deleted');
  } catch (err) {
    next(err);
  }
};

export const getStats = async (req, res, next) => {
  try {
    const match = buildFilters(req.user._id, req.query);

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          winningTrades: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, 1, 0] } },
          losingTrades: { $sum: { $cond: [{ $lt: ['$pnl', 0] }, 1, 0] } },
          netPnl: { $sum: '$pnl' },
        },
      },
    ];

    const [stats] = await Trade.aggregate(pipeline);

    return sendSuccess(res, 200, {
      totalTrades: stats?.totalTrades || 0,
      winningTrades: stats?.winningTrades || 0,
      losingTrades: stats?.losingTrades || 0,
      netPnl: Number((stats?.netPnl || 0).toFixed(2)),
    });
  } catch (err) {
    next(err);
  }
};

export const getTags = async (req, res, next) => {
  try {
    const match = { user: req.user._id };
    const pipeline = [
      { $match: match },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];

    const tags = await Trade.aggregate(pipeline);
    return sendSuccess(res, 200, tags);
  } catch (err) {
    next(err);
  }
};  