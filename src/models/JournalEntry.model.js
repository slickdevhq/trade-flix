import mongoose from 'mongoose';

const JournalEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dateKey: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    content: { type: String, required: true, trim: true },
    mood: { type: String, enum: ['Confident', 'Neutral', 'Fearful', 'Reflective', 'Frustrated'], default: 'Neutral', index: true },
    tags: { type: [String], default: [], index: true },
    images: { type: [String], default: [] }, // ADDED: Missing images field
  },
  { timestamps: true }
);

JournalEntrySchema.pre('save', function (next) {
  if (Array.isArray(this.tags)) {
    this.tags = this.tags
      .filter(Boolean)
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t.length > 0);
  }
  next();
});

// One entry per day per user keyed by YYYY-MM-DD
JournalEntrySchema.index({ user: 1, dateKey: 1 }, { unique: true });

const JournalEntry = mongoose.models.JournalEntry || mongoose.model('JournalEntry', JournalEntrySchema);
export default JournalEntry;