import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const PreferencesSchema = new mongoose.Schema(
  {
    darkMode: { type: Boolean, default: false },
    pushNotifications: { type: Boolean, default: false },
    emailDigest: { type: Boolean, default: false },
    aiInsights: { type: Boolean, default: true },
  },
  { _id: false }
);

const SubscriptionSchema = new mongoose.Schema(
  {
    tier: { type: String, enum: ['free', 'pro'], default: 'free' },
    monthlyTradeCount: { type: Number, default: 0 },
    resetDate: { type: Date, default: null },
    tradeLimit: { type: Number, default: 50 },
    aiAccess: { type: String, enum: ['limited', 'unlimited'], default: 'limited' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Please use a valid email address'],
    },
    password: {
      type: String,
      // Required only if googleId is not present
      required: function () {
        return !this.googleId;
      },
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Do not return password by default
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows null/undefined values to be unique
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
      initialBalance: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
    preferences: { type: PreferencesSchema, default: () => ({}) },
    subscription: { type: SubscriptionSchema, default: () => ({}) },
  },
  
  {
    timestamps: true,
  }
);

// --- Middleware ---

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  // and is not a Google-based user (who won't have a password)
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// --- Methods ---

// Compare entered password with hashed password in database
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;