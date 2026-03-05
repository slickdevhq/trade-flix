import mongoose from 'mongoose';
import crypto from 'crypto';

// Encryption setup for storing tokens securely
const ENCRYPTION_KEY = process.env.BROKER_TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

function decrypt(encryptedData) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

const BrokerConnectionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    provider: {
      type: String,
      required: true,
      enum: ['alpaca', 'tdameritrade', 'interactivebrokers'],
      index: true,
    },
    
    accountId: {
      type: String,
      required: false, // Some brokers don't require explicit account ID
    },
    
    // Encrypted OAuth tokens
    accessToken: {
      encrypted: String,
      iv: String,
      authTag: String,
    },
    
    refreshToken: {
      encrypted: String,
      iv: String,
      authTag: String,
    },
    
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    
    // Connection status
    status: {
      type: String,
      enum: ['active', 'expired', 'disconnected', 'error'],
      default: 'active',
      index: true,
    },
    
    lastSyncAt: {
      type: Date,
      default: null,
    },
    
    lastSyncError: {
      type: String,
      default: null,
    },
    
    // Auto-sync settings
    autoSync: {
      type: Boolean,
      default: true,
    },
    
    syncFrequency: {
      type: String,
      enum: ['realtime', 'hourly', 'daily', 'manual'],
      default: 'daily',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user + provider uniqueness
BrokerConnectionSchema.index({ user: 1, provider: 1 }, { unique: true });

// Virtual getter for decrypted access token
BrokerConnectionSchema.virtual('decryptedAccessToken').get(function () {
  if (!this.accessToken?.encrypted) return null;
  try {
    return decrypt(this.accessToken);
  } catch (error) {
    return null;
  }
});

// Virtual getter for decrypted refresh token
BrokerConnectionSchema.virtual('decryptedRefreshToken').get(function () {
  if (!this.refreshToken?.encrypted) return null;
  try {
    return decrypt(this.refreshToken);
  } catch (error) {
    return null;
  }
});

// Method to check if token is expired
BrokerConnectionSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

// Method to check if token needs refresh (expires within 5 minutes)
BrokerConnectionSchema.methods.needsRefresh = function () {
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return this.expiresAt < fiveMinutesFromNow;
};

// Method to set encrypted tokens
BrokerConnectionSchema.methods.setTokens = function (accessToken, refreshToken, expiresIn) {
  if (accessToken) {
    this.accessToken = encrypt(accessToken);
  }
  
  if (refreshToken) {
    this.refreshToken = encrypt(refreshToken);
  }
  
  if (expiresIn) {
    this.expiresAt = new Date(Date.now() + expiresIn * 1000);
  }
  
  this.status = 'active';
};

// Method to mark as disconnected
BrokerConnectionSchema.methods.disconnect = function () {
  this.status = 'disconnected';
  this.accessToken = null;
  this.refreshToken = null;
};

// Static method to find active connection
BrokerConnectionSchema.statics.findActiveConnection = async function (userId, provider) {
  return this.findOne({
    user: userId,
    provider,
    status: 'active',
  });
};

const BrokerConnection = mongoose.model('BrokerConnection', BrokerConnectionSchema);
export default BrokerConnection;