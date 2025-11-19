import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    userAgent: {
      type: String,
    },
    isValid: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt
  }
);

// Create index for faster lookup of tokens
refreshTokenSchema.index({ tokenHash: 1 });
// Create index for user sessions cleanup
refreshTokenSchema.index({ user: 1, isValid: 1 });
// TTL index to automatically delete expired tokens (after they've expired + 1 day)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;