import Habit from '../models/Habit.model.js';
import Trade from '../models/Trade.model.js';
import JournalEntry from '../models/JournalEntry.model.js';

function toDateStr(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function computeStreakFromDates(dates) {
  if (!dates || dates.length === 0) return 0;
  const set = new Set(dates.map(toDateStr));
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  
  while (set.has(toDateStr(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function createHabit(userId, payload) {
  return Habit.create({ ...payload, user: userId });
}

export async function checkInHabit(userId, habitId, date = new Date()) {
  const habit = await Habit.findOne({ _id: habitId, user: userId });
  if (!habit) return null;

  const dateStr = toDateStr(date);
  const has = habit.history.some((d) => toDateStr(d) === dateStr);
  if (!has) {
    habit.history.push(new Date(dateStr));
  }
  habit.currentStreak = computeStreakFromDates(habit.history);
  await habit.save();
  return habit;
}

async function autoCheckinsFromTrades(userId, startDate, endDate) {
  const match = { user: userId };
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }
  const rows = await Trade.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } } },
  ]);
  return rows.map((r) => new Date(r._id));
}

async function autoCheckinsFromJournalEntries(userId, startDate, endDate) {
  const match = { user: userId };
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }
  const entries = await JournalEntry.find(match).select('date');
  return entries.map(e => e.date);
}

async function getHabitStreakData(userId, startDate, endDate) {
  const habits = await Habit.find({ user: userId }).sort({ createdAt: 1 });
  const results = [];
  
  for (const h of habits) {
    let history = h.history;
    if (h.mode === 'auto') {
      if (h.autoEvent === 'trade_created') {
        history = await autoCheckinsFromTrades(userId, startDate, endDate);
      } else if (h.autoEvent === 'journal_entry') {
        history = await autoCheckinsFromJournalEntries(userId, startDate, endDate);
      }
    }
    
    const streak = computeStreakFromDates(history);
    const percentage = h.targetStreak > 0 ? Math.min(100, Number(((streak / h.targetStreak) * 100).toFixed(2))) : 0;
    
    results.push({
      habitId: h._id,
      name: h.name,
      targetStreak: h.targetStreak,
      currentStreak: streak,
      percentage,
      mode: h.mode,
    });
  }
  
  return results;
}

export async function getHabitStreaks(userId, startDate, endDate) {
  const habits = await getHabitStreakData(userId, startDate, endDate);
  const motivation = await getDailyMotivation(userId, startDate, endDate);
  const insight = await getGrowthInsights(userId, startDate, endDate);
  
  return { habits, motivation: motivation.message, insight };
}

export async function getDailyMotivation(userId, startDate, endDate) {
  const habits = await getHabitStreakData(userId, startDate, endDate);
  const highest = habits.reduce((a, b) => (b.currentStreak > (a?.currentStreak || 0) ? b : a), null);
  
  const message = highest && highest.currentStreak > 0
    ? `Consistency pays off — ${highest.currentStreak} days in a row!`
    : 'Start your next streak today!';
  
  const subtitle = highest && highest.currentStreak > 0
    ? 'Keep building those winning habits. Small daily actions lead to big results.'
    : 'Every great trader started with day one. Take action today.';
  
  return { message, subtitle };
}

export async function getGrowthInsights(userId, startDate, endDate) {
  const match = { user: userId, status: 'closed' };
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }
  
  const [wrRow] = await Trade.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: 1 }, wins: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, 1, 0] } } } },
  ]);
  const total = wrRow?.total || 0;
  const wins = wrRow?.wins || 0;
  const winRate = total > 0 ? Number(((wins / total) * 100).toFixed(2)) : 0;
  
  const habits = await getHabitStreakData(userId, startDate, endDate);
  const highest = habits.reduce((a, b) => (b.currentStreak > (a?.currentStreak || 0) ? b : a), null);

  let title = 'Your Biggest Strength';
  let content = 'Keep building consistent habits.';
  let subtitle = 'AI-powered insight based on your trading patterns';
  
  if (winRate >= 60) {
    title = 'High Probability Selection';
    content = `You've maintained a strong ${winRate}% win rate this period.`;
  } else if (highest && highest.currentStreak >= 7) {
    title = 'Discipline';
    content = `Consistency — you've built a ${highest.currentStreak}-day streak.`;
  }
  
  return { title, content, subtitle };
}