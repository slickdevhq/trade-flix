import mongoose from 'mongoose';

const TradeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },

    symbol: { type: String, required: true, trim: true, uppercase: true, index: true },
    side: { type: String, required: true, enum: ['long', 'short'], index: true },

    entryPrice: { type: Number, required: true, min: 0 },
    exitPrice: { type: Number, min: 0 }, // may be empty if trade is open
    size: { type: Number, required: true, min: 0 }, // number of shares/contracts

    notes: { type: String, trim: true },
    tags: { type: [String], default: [], index: true },

    sentiment: { type: String, enum: ['bullish', 'bearish', 'neutral'], default: undefined },
    newsImpact: { type: String, enum: ['high', 'medium', 'low', 'none'], default: undefined },

    rr: { type: Number, min: 0 }, // optional risk/reward ratio if provided manually

    // Stored PnL for fast queries; recalculated in hooks on create/update
    pnl: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

// Normalize tags to lowercase and trimmed
TradeSchema.pre('save', function (next) {
  if (Array.isArray(this.tags)) {
    this.tags = this.tags
      .filter(Boolean)
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t.length > 0);
  }

  // Recalculate PnL if we have exitPrice
  if (typeof this.exitPrice === 'number' && typeof this.entryPrice === 'number' && typeof this.size === 'number') {
    const diff = this.side === 'long' ? (this.exitPrice - this.entryPrice) : (this.entryPrice - this.exitPrice);
    this.pnl = Number((diff * this.size).toFixed(2));
  }

  next();
});

// Also recalc pnl on updates via findOneAndUpdate
TradeSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};

  const entryPrice = update.entryPrice ?? this._conditions.entryPrice;
  const exitPrice = update.exitPrice ?? this._conditions.exitPrice;
  const size = update.size ?? this._conditions.size;
  const side = update.side ?? this._conditions.side;

  if (
    typeof entryPrice === 'number' &&
    typeof exitPrice === 'number' &&
    typeof size === 'number' &&
    typeof side === 'string'
  ) {
    const diff = side === 'long' ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
    update.pnl = Number((diff * size).toFixed(2));
    this.setUpdate(update);
  }

  // Normalize tags if provided
  if (Array.isArray(update.tags)) {
    update.tags = update.tags
      .filter(Boolean)
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t.length > 0);
    this.setUpdate(update);
  }

  next();
});

const Trade = mongoose.model('Trade', TradeSchema);
export default Trade;  