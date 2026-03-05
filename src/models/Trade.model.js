import mongoose from 'mongoose';

const TradeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },

    symbol: { type: String, required: true, trim: true, uppercase: true, index: true },
    side: { type: String, required: true, enum: ['long', 'short'], index: true },

    entryPrice: { type: Number, required: true, min: 0 },
    exitPrice: { type: Number, min: 0 },
    stopLoss: { type: Number, min: 0 },
    targetPrice: { type: Number, min: 0 },
    
    size: { type: Number, required: true, min: 0 },

    notes: { type: String, trim: true },
    tags: { type: [String], default: [], index: true },

    sentiment: { type: String, enum: ['bullish', 'bearish', 'neutral'], default: undefined },
    newsImpact: { type: String, enum: ['high', 'medium', 'low', 'none'], default: undefined },

    mistakes: { 
      type: [String], 
      enum: ['late_exit', 'early_entry', 'position_sizing', 'stop_loss', 'fomo', 'revenge_trading', 'overtrading', 'ignored_plan', 'emotional'], 
      default: [],
      index: true 
    },

    rr: { type: Number, min: 0 },
    pnl: { type: Number, default: 0, index: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  },
  { timestamps: true }
);

TradeSchema.pre('save', function (next) {
  if (Array.isArray(this.tags)) {
    this.tags = this.tags
      .filter(Boolean)
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t.length > 0);
  }

  this.status = (typeof this.exitPrice === 'number' && this.exitPrice > 0) ? 'closed' : 'open';

  if (this.status === 'closed') {
    const diff = this.side === 'long'
      ? (this.exitPrice - this.entryPrice)
      : (this.entryPrice - this.exitPrice);

    this.pnl = Math.round(diff * this.size * 100) / 100;
  } else {
    this.pnl = 0;
  }

  if (
    typeof this.stopLoss === 'number' &&
    typeof this.targetPrice === 'number' &&
    typeof this.entryPrice === 'number' &&
    this.stopLoss > 0 &&
    this.targetPrice > 0 &&
    typeof this.rr !== 'number'
  ) {
    const risk = Math.abs(this.entryPrice - this.stopLoss);
    const reward = Math.abs(this.targetPrice - this.entryPrice);
    
    if (risk > 0) {
      this.rr = Math.round((reward / risk) * 100) / 100;
    }
  }

  next();
});

TradeSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  
  if (Array.isArray(update.tags)) {
    update.tags = update.tags
      .filter(Boolean)
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t.length > 0);
  }

  if ('exitPrice' in update) {
    update.status = (typeof update.exitPrice === 'number' && update.exitPrice > 0) ? 'closed' : 'open';
  }
  
  this.setUpdate(update);
  next();
});

// CRITICAL FIX: Use updateOne to prevent infinite recursion
TradeSchema.post('findOneAndUpdate', async function(doc) {
  if (!doc) return;
  
  const needsRecalc = doc.entryPrice && doc.size;
  
  if (needsRecalc) {
    let needsSave = false;
    const updates = {};
    
    const newStatus = (typeof doc.exitPrice === 'number' && doc.exitPrice > 0) ? 'closed' : 'open';
    if (doc.status !== newStatus) {
      updates.status = newStatus;
      needsSave = true;
    }
    
    let newPnl = 0;
    if (newStatus === 'closed') {
      const diff = doc.side === 'long'
        ? (doc.exitPrice - doc.entryPrice)
        : (doc.entryPrice - doc.exitPrice);
      newPnl = Math.round(diff * doc.size * 100) / 100;
    }
    
    if (doc.pnl !== newPnl) {
      updates.pnl = newPnl;
      needsSave = true;
    }
    
    if (
      typeof doc.stopLoss === 'number' &&
      typeof doc.targetPrice === 'number' &&
      doc.stopLoss > 0 &&
      doc.targetPrice > 0
    ) {
      const risk = Math.abs(doc.entryPrice - doc.stopLoss);
      const reward = Math.abs(doc.targetPrice - doc.entryPrice);
      
      if (risk > 0) {
        const newRR = Math.round((reward / risk) * 100) / 100;
        if (doc.rr !== newRR) {
          updates.rr = newRR;
          needsSave = true;
        }
      }
    }
    
    // Use updateOne to avoid triggering hooks again
    if (needsSave) {
      await mongoose.model('Trade').updateOne(
        { _id: doc._id },
        { $set: updates }
      );
    }
  }
});

TradeSchema.index({ user: 1, date: 1 });
TradeSchema.index({ user: 1, status: 1 });
TradeSchema.index({ user: 1, pnl: 1 });
TradeSchema.index({ user: 1, mistakes: 1 });

const Trade = mongoose.model('Trade', TradeSchema);
export default Trade;