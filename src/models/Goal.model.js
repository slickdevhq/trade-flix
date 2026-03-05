import mongoose from 'mongoose';

const GoalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['PNL', 'WIN_RATE', 'TRADING_DAYS', 'MAX_DRAWDOWN', 'RISK_COMPLIANCE'],
      index: true,
    },
    targetValue: { type: Number, required: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active', index: true },
    name: { type: String, trim: true },
  },
  { timestamps: true }
);

GoalSchema.index({ user: 1, type: 1, startDate: 1, endDate: 1 });

const Goal = mongoose.model('Goal', GoalSchema);
export default Goal;