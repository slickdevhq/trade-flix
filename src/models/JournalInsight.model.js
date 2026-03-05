import mongoose from 'mongoose';

const PatternSchema = new mongoose.Schema({
  name: { type: String, required: true },
  count: { type: Number, required: true },
  multiplier: { type: Number, default: 1 },
}, { _id: false });

const RecommendationSchema = new mongoose.Schema({
  type: { type: String, enum: ['warning', 'strength', 'suggestion'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  metric: { type: String },
}, { _id: false });

const JournalInsightSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    summaryText: { type: String, default: '' },
    patterns: { type: [PatternSchema], default: [] },
    recommendations: { type: [RecommendationSchema], default: [] },
  },
  { timestamps: true }
);

JournalInsightSchema.index({ user: 1, startDate: 1, endDate: 1 }, { unique: true });

const JournalInsight = mongoose.model('JournalInsight', JournalInsightSchema);
export default JournalInsight;