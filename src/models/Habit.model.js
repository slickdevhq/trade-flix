import mongoose from 'mongoose';

const HabitSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    targetStreak: { type: Number, required: true, min: 1 },
    mode: { type: String, enum: ['manual', 'auto'], default: 'manual' },
    autoEvent: { type: String, enum: ['trade_created', 'journal_entry'], default: undefined },
    currentStreak: { type: Number, default: 0 },
    history: { type: [Date], default: [] },
  },
  { timestamps: true }
);

HabitSchema.index({ user: 1, name: 1 }, { unique: false });

const Habit = mongoose.model('Habit', HabitSchema);
export default Habit;