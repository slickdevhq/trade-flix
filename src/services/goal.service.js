import Trade from '../models/Trade.model.js';
import Goal from '../models/Goal.model.js';

function buildDateMatch(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }
  return match;
}

async function calcPnl(userId, startDate, endDate) {
  const match = { user: userId, status: 'closed', ...buildDateMatch(startDate, endDate) };
  const [row] = await Trade.aggregate([
    { $match: match },
    { $group: { _id: null, pnl: { $sum: '$pnl' } } },
  ]);
  return Number((row?.pnl || 0).toFixed(2));
}

async function calcWinRate(userId, startDate, endDate) {
  const match = { user: userId, status: 'closed', ...buildDateMatch(startDate, endDate) };
  const [row] = await Trade.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        wins: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, 1, 0] } },
      },
    },
  ]);
  const total = row?.total || 0;
  const wins = row?.wins || 0;
  return total > 0 ? Number(((wins / total) * 100).toFixed(2)) : 0;
}

async function calcTradingDays(userId, startDate, endDate) {
  const match = { user: userId, ...buildDateMatch(startDate, endDate) };
  const rows = await Trade.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } } },
  ]);
  return rows.length;
}

async function calcMaxDrawdown(userId, startDate, endDate) {
  const match = { user: userId, status: 'closed', ...buildDateMatch(startDate, endDate) };
  const trades = await Trade.find(match).sort({ date: 1 }).select('pnl');
  
  let cum = 0;
  let peak = 0;
  let maxDd = 0;
  for (const t of trades) {
    cum += t.pnl;
    if (cum > peak) peak = cum;
    const drawdown = peak - cum;
    if (drawdown > maxDd) maxDd = drawdown;
  }
  return Number(maxDd.toFixed(2));
}

async function calcRiskCompliance(userId, startDate, endDate) {
  const matchBase = { user: userId, status: 'closed', ...buildDateMatch(startDate, endDate) };
  const losingMatch = { ...matchBase, pnl: { $lt: 0 } };
  const totalLosing = await Trade.countDocuments(losingMatch);
  if (totalLosing === 0) return 100;

  const compliantRows = await Trade.aggregate([
    { $match: losingMatch },
    { $match: { tags: { $in: ['stop loss', 'sl'] } } },
    { $count: 'count' },
  ]);
  const compliant = compliantRows?.[0]?.count || 0;
  return Number(((compliant / totalLosing) * 100).toFixed(2));
}

export async function calculateGoalProgress(userId, goal, overrideStart, overrideEnd) {
  const startDate = overrideStart || goal.startDate;
  const endDate = overrideEnd || goal.endDate;

  let current = 0;
  switch (goal.type) {
    case 'PNL': current = await calcPnl(userId, startDate, endDate); break;
    case 'WIN_RATE': current = await calcWinRate(userId, startDate, endDate); break;
    case 'TRADING_DAYS': current = await calcTradingDays(userId, startDate, endDate); break;
    case 'MAX_DRAWDOWN': current = await calcMaxDrawdown(userId, startDate, endDate); break;
    case 'RISK_COMPLIANCE': current = await calcRiskCompliance(userId, startDate, endDate); break;
  }

  // For MAX_DRAWDOWN, lower is better - invert the percentage
  let percentage;
  if (goal.type === 'MAX_DRAWDOWN') {
    // If target is 1000 and current is 200, that's 80% compliance (good)
    percentage = goal.targetValue !== 0 ? Math.max(0, Math.round(((goal.targetValue - current) / goal.targetValue) * 100)) : 0;
  } else {
    percentage = goal.targetValue !== 0 ? Math.round((current / goal.targetValue) * 100) : 0;
  }
  
  let progressLabel = `${current} / ${goal.targetValue}`;
  let displayLabel = progressLabel;
  
  if (goal.type === 'PNL') {
    progressLabel = `${current} / ${goal.targetValue}`;
    displayLabel = `$${current} / $${goal.targetValue}`;
  } else if (goal.type === 'WIN_RATE') {
    progressLabel = `${current}% / ${goal.targetValue}%`;
    displayLabel = `${current}% / ${goal.targetValue}%`;
  } else if (goal.type === 'TRADING_DAYS') {
    progressLabel = `${current} days / ${goal.targetValue} days`;
    displayLabel = `${current} days / ${goal.targetValue} days`;
  } else if (goal.type === 'MAX_DRAWDOWN') {
    progressLabel = `${current} / ${goal.targetValue}`;
    displayLabel = `$${current} / $${goal.targetValue}`;
  } else if (goal.type === 'RISK_COMPLIANCE') {
    progressLabel = `${current}% / ${goal.targetValue}%`;
    displayLabel = `${current}% / ${goal.targetValue}%`;
  }

  return {
    id: goal._id,
    name: goal.name || goal.type.replace(/_/g, ' '),
    type: goal.type,
    target: goal.targetValue,
    current,
    percentage,
    progressLabel,
    displayLabel,
    status: goal.status,
    direction: goal.type === 'MAX_DRAWDOWN' ? 'lower_is_better' : 'higher_is_better'
  };
}

export async function listActiveGoalsWithProgress(userId, startDate, endDate) {
  const goals = await Goal.find({ user: userId, status: 'active' });
  return Promise.all(goals.map(g => calculateGoalProgress(userId, g, startDate, endDate)));
}

export async function listCompletedGoals(userId) {
  const goals = await Goal.find({ user: userId, status: 'completed' }).sort({ endDate: -1 }).limit(3);
  return Promise.all(goals.map(g => calculateGoalProgress(userId, g)));
}