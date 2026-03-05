import { getProvider, getAvailableProviders } from '../services/broker.service.js';
import BrokerConnection from '../models/BrokerConnection.model.js';
import Trade from '../models/Trade.model.js';
import { sendSuccess } from '../utils/response.js';
import AppError from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../config/logger.js';
import crypto from 'crypto';

/**
 * GET /api/v1/brokers
 * List available broker providers
 */
export const listProviders = asyncHandler(async (req, res) => {
  const available = getAvailableProviders();
  
  // Get user's connected brokers
  const connections = await BrokerConnection.find({
    user: req.user._id,
    status: 'active',
  }).select('provider lastSyncAt autoSync');
  
  const providers = available.map(name => {
    const connection = connections.find(c => c.provider === name);
    return {
      name,
      connected: !!connection,
      lastSync: connection?.lastSyncAt || null,
      autoSync: connection?.autoSync || false,
    };
  });
  
  return sendSuccess(res, 200, { providers });
});

/**
 * GET /api/v1/brokers/:provider/auth
 * Returns OAuth2 authorize URL for frontend redirect
 */
export const getBrokerAuthUrl = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  
  // Generate secure state token with user ID
  const stateToken = crypto.randomBytes(32).toString('hex');
  
  // Store state in user session or cache with expiration (5 minutes)
  // For production, use Redis or similar
  // await cache.set(`broker:state:${stateToken}`, req.user._id, 'EX', 300);
  
  const providerInstance = getProvider(provider);
  const url = providerInstance.getAuthUrl(stateToken, req.user._id.toString());
  
  return sendSuccess(res, 200, { 
    url,
    state: stateToken, // Return to frontend to verify in callback
  });
});

/**
 * POST /api/v1/brokers/:provider/callback
 * Exchange authorization code for tokens and fetch trades
 */
export const handleBrokerCallback = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { code, state, accountId } = req.body;

  if (!code) {
    throw AppError.badRequest('Missing authorization code', 'MISSING_CODE');
  }

  // Validate state to prevent CSRF attacks
  // In production, verify against stored state token
  // const cachedUserId = await cache.get(`broker:state:${state}`);
  // if (cachedUserId !== req.user._id.toString()) {
  //   throw AppError.unauthorized('Invalid state token', 'INVALID_STATE');
  // }

  const providerInstance = getProvider(provider);
  
  try {
    // Exchange code for tokens
    const tokens = await providerInstance.exchangeCodeForToken(code);
    
    // Store or update broker connection
    let connection = await BrokerConnection.findOne({
      user: req.user._id,
      provider,
    });
    
    if (!connection) {
      connection = new BrokerConnection({
        user: req.user._id,
        provider,
        accountId: accountId || null,
      });
    }
    
    connection.setTokens(
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresIn
    );
    
    await connection.save();
    
    // Optionally, trigger immediate sync
    // await syncBrokerTrades(req.user._id, provider);
    
    return sendSuccess(res, 200, {
      provider,
      connected: true,
      expiresAt: tokens.expiresAt,
    }, 'Broker connected successfully');
    
  } catch (error) {
    logger.error('Broker callback failed', {
      provider,
      userId: req.user._id,
      error: error.message,
    });
    
    throw AppError.internal(
      'Failed to connect broker. Please try again.',
      'BROKER_CONNECTION_FAILED'
    );
  }
});

/**
 * POST /api/v1/brokers/:provider/sync
 * Manually trigger trade sync from broker
 */
export const syncBrokerTrades = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { since } = req.body;
  
  // Find active connection
  const connection = await BrokerConnection.findActiveConnection(
    req.user._id,
    provider
  );
  
  if (!connection) {
    throw AppError.notFound(
      'No active connection found for this broker',
      'NO_CONNECTION'
    );
  }
  
  const providerInstance = getProvider(provider);
  
  try {
    let accessToken = connection.decryptedAccessToken;
    
    // Refresh token if needed
    if (connection.needsRefresh()) {
      logger.info('Refreshing expired broker token', { provider, userId: req.user._id });
      
      const refreshToken = connection.decryptedRefreshToken;
      const newTokens = await providerInstance.refreshAccessToken(refreshToken);
      
      connection.setTokens(
        newTokens.accessToken,
        newTokens.refreshToken,
        newTokens.expiresIn
      );
      
      await connection.save();
      accessToken = newTokens.accessToken;
    }
    
    // Determine sync period (default: last 30 days)
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Fetch orders and positions
    const [orders, positions] = await Promise.all([
      providerInstance.fetchOrders(accessToken, connection.accountId, sinceDate),
      providerInstance.fetchPositions(accessToken, connection.accountId),
    ]);
    
    // Reconcile orders into complete trades
    const reconciledTrades = providerInstance.reconcileTrades(orders);
    
    // Combine closed trades and open positions
    const allTrades = [...reconciledTrades, ...positions];
    
    // Filter out trades that already exist (by date + symbol)
    const newTrades = [];
    for (const trade of allTrades) {
      const exists = await Trade.findOne({
        user: req.user._id,
        symbol: trade.symbol,
        date: trade.date,
        entryPrice: trade.entryPrice,
      });
      
      if (!exists) {
        newTrades.push({
          ...trade,
          user: req.user._id,
        });
      }
    }
    
    // Insert new trades
    let imported = 0;
    if (newTrades.length > 0) {
      const result = await Trade.insertMany(newTrades, { ordered: false });
      imported = result.length;
    }
    
    // Update connection sync status
    connection.lastSyncAt = new Date();
    connection.lastSyncError = null;
    await connection.save();
    
    return sendSuccess(res, 200, {
      imported,
      total: allTrades.length,
      alreadyExists: allTrades.length - imported,
    }, `Synced ${imported} new trades from ${provider}`);
    
  } catch (error) {
    logger.error('Broker sync failed', {
      provider,
      userId: req.user._id,
      error: error.message,
    });
    
    // Update connection with error
    connection.lastSyncError = error.message;
    connection.status = 'error';
    await connection.save();
    
    throw AppError.internal(
      'Failed to sync trades from broker',
      'BROKER_SYNC_FAILED'
    );
  }
});

/**
 * DELETE /api/v1/brokers/:provider
 * Disconnect broker
 */
export const disconnectBroker = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  
  const connection = await BrokerConnection.findOne({
    user: req.user._id,
    provider,
  });
  
  if (!connection) {
    throw AppError.notFound('Broker connection not found', 'CONNECTION_NOT_FOUND');
  }
  
  connection.disconnect();
  await connection.save();
  
  return sendSuccess(res, 200, null, 'Broker disconnected successfully');
});

/**
 * PATCH /api/v1/brokers/:provider/settings
 * Update broker connection settings
 */
export const updateBrokerSettings = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { autoSync, syncFrequency } = req.body;
  
  const connection = await BrokerConnection.findOne({
    user: req.user._id,
    provider,
  });
  
  if (!connection) {
    throw AppError.notFound('Broker connection not found', 'CONNECTION_NOT_FOUND');
  }
  
  if (typeof autoSync === 'boolean') {
    connection.autoSync = autoSync;
  }
  
  if (syncFrequency && ['realtime', 'hourly', 'daily', 'manual'].includes(syncFrequency)) {
    connection.syncFrequency = syncFrequency;
  }
  
  await connection.save();
  
  return sendSuccess(res, 200, {
    provider,
    autoSync: connection.autoSync,
    syncFrequency: connection.syncFrequency,
  }, 'Settings updated');
});