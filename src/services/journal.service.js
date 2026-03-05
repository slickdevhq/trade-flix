import JournalEntry from '../models/JournalEntry.model.js';
import JournalInsight from '../models/JournalInsight.model.js';
import Trade from '../models/Trade.model.js';
import Habit from '../models/Habit.model.js';
import { resolveDateRange } from '../utils/resolveDateRange.js';

function formatDateKey(input) {
  if (!input) {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

function normalizeToUTCDate(date) {
  const d = date ? new Date(date) : new Date();
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return utc;
}

function baseMatch(userId, startDate, endDate) {
  const match = { user: userId };
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = normalizeToUTCDate(startDate);
    if (endDate) {
      // End date should include the entire day
      const endUTC = normalizeToUTCDate(endDate);
      endUTC.setUTCHours(23, 59, 59, 999);
      match.date.$lte = endUTC;
    }
  }
  return match;
}

export async function upsertJournalEntry(userId, { date, content, mood, tags, images }, { append = true, replace = false } = {}) {
  const dateKey = formatDateKey(date);
  const day = normalizeToUTCDate(date);
  const existing = await JournalEntry.findOne({ user: userId, dateKey });
  const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 16); // YYYY-MM-DD HH:MM

  // Parse incoming tags/images
  const newTags = (tags || []).map((t) => String(t).trim().toLowerCase()).filter(t => t.length > 0);
  const newImages = images || [];

  if (existing) {
    const next = { ...existing.toObject() };
    next.dateKey = dateKey;
    next.date = day;

    if (replace) {
      // FULL OVERWRITE MODE (e.g., User editing via form)
      next.content = content;
      next.mood = mood || existing.mood;
      next.tags = newTags; // Overwrite tags (allows deletion)
      next.images = newImages; // Overwrite images
    } else {
      // APPEND MODE (e.g., Quick note from dashboard)
      const separator = existing.content ? '\n\n' : '';
      next.content = `${existing.content || ''}${separator}[${nowIso}] ${content}`;
      
      // Preserve existing mood if new one isn't provided
      next.mood = mood || existing.mood;

      // Merge tags (Add new ones, keep old ones)
      const setTags = new Set([...(existing.tags || []), ...newTags]);
      next.tags = Array.from(setTags);

      // Merge images
      const setImages = new Set([...(existing.images || []), ...newImages]);
      next.images = Array.from(setImages);
    }

    const updated = await JournalEntry.findOneAndUpdate({ _id: existing._id }, next, { new: true, runValidators: true });
    return updated;
  }

  // CREATE NEW
  const payload = {
    user: userId,
    dateKey,
    date: day,
    content: `[${nowIso}] ${content}`,
    mood: mood || 'Neutral',
    tags: newTags,
    images: newImages,
  };
  return JournalEntry.create(payload);
}

export async function deleteJournalEntry(userId, entryId) {
  return JournalEntry.findOneAndDelete({ _id: entryId, user: userId });
}

export async function listJournalEntries(userId, query) {
  const { page = 1, limit = 20, sort = '-date', mood, tags, q, startDate, endDate } = query;
  const filter = { user: userId };

  if (mood) filter.mood = mood;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = normalizeToUTCDate(startDate);
    if (endDate) {
      const endUTC = normalizeToUTCDate(endDate);
      endUTC.setUTCHours(23, 59, 59, 999);
      filter.date.$lte = endUTC;
    }
  }
  if (tags) {
    const tagList = String(tags).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (tagList.length) filter.tags = { $all: tagList };
  }
  if (q) {
    filter.$or = [
      { content: new RegExp(q, 'i') },
      { tags: new RegExp(q, 'i') },
    ];
  }

  const [items, total] = await Promise.all([
    JournalEntry.find(filter).sort(sort).skip((page - 1) * limit).limit(Number(limit)).lean(),
    JournalEntry.countDocuments(filter),
  ]);

  // Add formatted date
  const itemsWithDisplay = items.map(item => ({
  ...item,
  displayDate: new Date(item.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}));

return {
  items: itemsWithDisplay,
  page: Number(page),
  limit: Number(limit),
  total,
  pages: Math.ceil(total / limit),
};
  return {
    items,
    page: Number(page),
    limit: Number(limit),
    total,
    pages: Math.ceil(total / limit),
  };
}

export async function getJournalStats(userId, startDate, endDate) {
  const match = baseMatch(userId, startDate, endDate);
  
  // Pattern detection via tags
  const pipeline = [
    { $match: match },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 } 
  ];
  const rows = await JournalEntry.aggregate(pipeline);
  const patterns = rows.map((r) => ({ name: r._id, count: r.count, multiplier: r.count }));

  // Mood stats
  const moodRows = await JournalEntry.aggregate([
    { $match: match },
    { $group: { _id: '$mood', count: { $sum: 1 } } },
  ]);
  const moods = moodRows.map((m) => ({ mood: m._id, count: m.count }));

  return { patterns, moods };
}

function toKeyFromDate(d) {
  const dd = new Date(d);
  return new Date(Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth(), dd.getUTCDate())).toISOString().slice(0, 10);
}

export async function getMoodPerformanceCorrelation(userId, startDate, endDate) {
  const jMatch = { user: userId };
  if (startDate || endDate) {
    jMatch.date = {};
    if (startDate) jMatch.date.$gte = normalizeToUTCDate(startDate);
    if (endDate) {
      const endUTC = normalizeToUTCDate(endDate);
      endUTC.setUTCHours(23, 59, 59, 999);
      jMatch.date.$lte = endUTC;
    }
  }
  const journals = await JournalEntry.find(jMatch).select('date dateKey mood');
  const moodByDate = new Map(journals.map((j) => [j.dateKey, j.mood]));

  const tMatch = baseMatch(userId, startDate, endDate);
  const trades = await Trade.find(tMatch).select('date pnl status');
  
  const dayAgg = new Map();
  for (const t of trades) {
    // Only include CLOSED trades in performance correlation
    if (t.status !== 'closed') continue;
    
    const k = toKeyFromDate(t.date);
    const agg = dayAgg.get(k) || { total: 0, wins: 0, pnl: 0 };
    agg.total += 1;
    agg.wins += t.pnl > 0 ? 1 : 0;
    agg.pnl += t.pnl || 0;
    dayAgg.set(k, agg);
  }

  const moodAgg = new Map();
  for (const [k, agg] of dayAgg.entries()) {
    const mood = moodByDate.get(k) || 'Unknown';
    const m = moodAgg.get(mood) || { total: 0, wins: 0, pnl: 0 };
    m.total += agg.total;
    m.wins += agg.wins;
    m.pnl += agg.pnl;
    moodAgg.set(mood, m);
  }

  const results = [];
  for (const [mood, v] of moodAgg.entries()) {
    const winRate = v.total > 0 ? Number(((v.wins / v.total) * 100).toFixed(2)) : 0;
    results.push({ mood, winRate, netPnl: Number(v.pnl.toFixed(2)), trades: v.total });
  }
  return results.sort((a, b) => b.winRate - a.winRate);
}

export async function getTagPnLCorrelation(userId, startDate, endDate) {
  const jMatch = { user: userId };
  if (startDate || endDate) {
    jMatch.date = {};
    if (startDate) jMatch.date.$gte = normalizeToUTCDate(startDate);
    if (endDate) {
      const endUTC = normalizeToUTCDate(endDate);
      endUTC.setUTCHours(23, 59, 59, 999);
      jMatch.date.$lte = endUTC;
    }
  }
  const journals = await JournalEntry.find(jMatch).select('date dateKey tags');
  const tagsByDate = new Map(journals.map((j) => [j.dateKey, j.tags || []]));

  const tMatch = baseMatch(userId, startDate, endDate);
  const trades = await Trade.find(tMatch).select('date pnl status');
  const tradesByDate = new Map();
  for (const t of trades) {
    // Only include CLOSED trades
    if (t.status !== 'closed') continue;
    
    const k = toKeyFromDate(t.date);
    const arr = tradesByDate.get(k) || [];
    arr.push(t);
    tradesByDate.set(k, arr);
  }

  const tagAgg = new Map(); 
  for (const [dateKey, tags] of tagsByDate.entries()) {
    const dayTrades = tradesByDate.get(dateKey) || [];
    if (!tags || !tags.length || !dayTrades.length) continue;

    const wins = dayTrades.filter((t) => t.pnl > 0);
    const losses = dayTrades.filter((t) => t.pnl <= 0);
    const netPnl = dayTrades.reduce((s, t) => s + (t.pnl || 0), 0);

    for (const tag of tags) {
      const a = tagAgg.get(tag) || { wins: 0, total: 0, netPnl: 0, days: 0 };
      a.wins += wins.length;
      a.total += dayTrades.length;
      a.netPnl += netPnl;
      a.days += 1;
      tagAgg.set(tag, a);
    }
  }

  const results = [];
  for (const [tag, a] of tagAgg.entries()) {
    const winRate = a.total > 0 ? Number(((a.wins / a.total) * 100).toFixed(2)) : 0;
    const avgPnlPerDay = a.days > 0 ? Number((a.netPnl / a.days).toFixed(2)) : 0;
    results.push({ 
      tag, 
      winRate, 
      avgPnlPerDay,
      netPnl: Number(a.netPnl.toFixed(2)),
      trades: a.total,
      days: a.days
    });
  }

  results.sort((a, b) => b.winRate - a.winRate);
  
  const topByWinRate = results[0];
  const topByPnl = [...results].sort((a, b) => b.netPnl - a.netPnl)[0];
  const worstByPnl = [...results].sort((a, b) => a.netPnl - b.netPnl)[0];

  return { 
    perTag: results, 
    topByWinRate, 
    topByPnl,
    worstByPnl
  };
}

export async function getHabitProfitCorrelation(userId, startDate, endDate) {
  const habits = await Habit.find({ user: userId }).select('name history');

  const tMatch = baseMatch(userId, startDate, endDate);
  const trades = await Trade.find(tMatch).select('date pnl status');
  const pnlByDate = new Map();
  
  for (const t of trades) {
    // Only include CLOSED trades
    if (t.status !== 'closed') continue;
    
    const k = toKeyFromDate(t.date);
    pnlByDate.set(k, (pnlByDate.get(k) || 0) + (t.pnl || 0));
  }

  const habitAgg = [];
  for (const h of habits) {
    const historyKeys = (h.history || []).map((d) => toKeyFromDate(d));
    const relevantPnls = historyKeys.map((k) => pnlByDate.get(k)).filter(v => v !== undefined);
    const avg = relevantPnls.length ? relevantPnls.reduce((s, v) => s + v, 0) / relevantPnls.length : 0;
    const total = relevantPnls.reduce((s, v) => s + v, 0);
    
    habitAgg.push({ 
      habit: h.name, 
      avgPnlOnCheckinDays: Number(avg.toFixed(2)),
      totalPnl: Number(total.toFixed(2)),
      checkinDays: relevantPnls.length
    });
  }
  habitAgg.sort((a, b) => b.avgPnlOnCheckinDays - a.avgPnlOnCheckinDays);
  return habitAgg;
}

export async function getJournalInsights(userId, query) {
  const { range, startDate, endDate } = query;
  const { startDate: resolvedStart, endDate: resolvedEnd } = resolveDateRange({
    range,
    startDate,
    endDate
  });
  const normalizedStart = normalizeToUTCDate(resolvedStart);
  const normalizedEnd = normalizeToUTCDate(resolvedEnd);
  normalizedEnd.setUTCHours(23, 59, 59, 999);

  const { patterns } = await getJournalStats(userId, resolvedStart, resolvedEnd);
  const moodCorr = await getMoodPerformanceCorrelation(userId, resolvedStart, resolvedEnd);
  const tagCorr = await getTagPnLCorrelation(userId, resolvedStart, resolvedEnd);
  const habitCorr = await getHabitProfitCorrelation(userId, resolvedStart, resolvedEnd);

  // ADDED: Check for minimum data requirement
  const totalTrades = moodCorr.reduce((sum, m) => sum + m.trades, 0);
  const totalJournalDays = patterns.reduce((sum, p) => sum + p.count, 0);
  
  if (totalTrades < 5 || totalJournalDays < 3) {
    return {
      summaryText: 'Not enough data yet. Journal consistently and log more trades to unlock insights.',
      patterns: [],
      recommendations: [{
        type: 'suggestion',
        title: 'Build Your Data Foundation',
        message: 'Complete at least 5 trades and 3 journal entries to generate meaningful insights.',
        metric: `Current: ${totalTrades} trades, ${totalJournalDays} journal days`,
      }],
    };
  }

  const topPattern = patterns[0];
  const topMood = moodCorr[0];
  
  const summaryText = [
    topPattern ? `Frequent theme: "${topPattern.name}" (${topPattern.count}x).` : null,
    topMood ? `Best mood by win rate: ${topMood.mood} (${topMood.winRate}%).` : null,
  ].filter(Boolean).join(' ');

  const recommendations = [];
  
  // 1. Warning (Red Card) - Tag with worst net PnL
  if (tagCorr.worstByPnl && tagCorr.worstByPnl.netPnl < 0 && tagCorr.worstByPnl.days >= 2) {
    recommendations.push({
      type: 'warning',
      title: 'Recurring Pattern on Losses',
      message: `Tag "${tagCorr.worstByPnl.tag}" correlates with net losses. Review your strategy when this theme appears.`,
      metric: `Net PnL: ${tagCorr.worstByPnl.netPnl} (${tagCorr.worstByPnl.days} days)`,
    });
  }
  
  // 2. Strength (Yellow/Green Card) - Best mood or best tag
  if (topMood && topMood.trades >= 5) {
    recommendations.push({
      type: 'strength',
      title: 'Strength: Mood Correlation',
      message: `Trading in "${topMood.mood}" mood correlates with your highest win rate (${topMood.winRate}%).`,
      metric: `Net PnL: ${topMood.netPnl} (${topMood.trades} trades)`,
    });
  } else if (tagCorr.topByWinRate && tagCorr.topByWinRate.trades >= 3) {
    recommendations.push({
      type: 'strength',
      title: 'Strength: Setup Tag',
      message: `Tag "${tagCorr.topByWinRate.tag}" has your highest win rate (${tagCorr.topByWinRate.winRate}%).`,
      metric: `Net PnL: ${tagCorr.topByWinRate.netPnl} (${tagCorr.topByWinRate.trades} trades)`,
    });
  }
  
  // 3. Suggestion (Green Card) - Best habit
  if (habitCorr.length && habitCorr[0].checkinDays >= 3 && habitCorr[0].avgPnlOnCheckinDays > 0) {
    const bestHabit = habitCorr[0];
    recommendations.push({
      type: 'suggestion',
      title: 'Habit to Reinforce',
      message: `Maintain "${bestHabit.habit}"; it aligns with your most profitable days.`,
      metric: `Avg PnL: ${bestHabit.avgPnlOnCheckinDays} (${bestHabit.checkinDays} days)`,
    });
  }

  // ADDED: If no strong recommendations, provide general guidance
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'suggestion',
      title: 'Keep Building Patterns',
      message: 'Continue journaling consistently to identify stronger correlations between your habits and trading performance.',
      metric: `${totalTrades} trades analyzed across ${totalJournalDays} journal days`,
    });
  }

  const insight = await JournalInsight.findOneAndUpdate(
    { user: userId, startDate: normalizedStart, endDate: normalizedEnd },
    {
      summaryText,
      patterns,
      recommendations,
    },
    { new: true, upsert: true }
  );

  return insight;
}