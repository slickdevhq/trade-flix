import User from '../models/User.model.js';
import Trade from '../models/Trade.model.js';

function getMonthRange(date = new Date()) {
  const d = new Date(date);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start, end: nextMonth };
}

export async function enforceTradeLimit(req, res, next) {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const tier = user.subscription?.tier || 'free';
    const limit = user.subscription?.tradeLimit ?? 50;

    if (tier !== 'free') return next();

    const { start, end } = getMonthRange();
    const count = await Trade.countDocuments({ user: userId, date: { $gte: start, $lt: end } });

    if (count >= limit) {
      return res.status(403).json({
        message: `Monthly trade limit reached (${count}/${limit}). Upgrade to Pro to continue logging trades.`,
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}