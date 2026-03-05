import axios from 'axios';
import AppError from '../utils/appError.js';
import logger from '../config/logger.js';

/**
 * Abstract base for broker providers.
 * Each provider must implement:
 * - getAuthUrl(state, userId)
 * - exchangeCodeForToken(code)
 * - refreshAccessToken(refreshToken)
 * - fetchOrders(accessToken, accountId, since)
 * - fetchPositions(accessToken, accountId)
 */
class BrokerProvider {
  constructor(name) {
    this.name = name;
  }
  
  getAuthUrl(state, userId) {
    throw new Error('getAuthUrl not implemented');
  }
  
  async exchangeCodeForToken(code) {
    throw new Error('exchangeCodeForToken not implemented');
  }
  
  async refreshAccessToken(refreshToken) {
    throw new Error('refreshAccessToken not implemented');
  }
  
  async fetchOrders(accessToken, accountId, since) {
    throw new Error('fetchOrders not implemented');
  }
  
  async fetchPositions(accessToken, accountId) {
    throw new Error('fetchPositions not implemented');
  }

  /**
   * Reconcile orders into complete trades (entry + exit pairs)
   * @param {Array} orders - Raw orders from broker
   * @returns {Array} - Reconciled trades with entry/exit
   */
  reconcileTrades(orders) {
    const positions = new Map(); // symbol -> {entries: [], exits: []}
    
    // Group orders by symbol
    for (const order of orders) {
      if (!positions.has(order.symbol)) {
        positions.set(order.symbol, { entries: [], exits: [] });
      }
      
      const pos = positions.get(order.symbol);
      if (order.orderType === 'entry') {
        pos.entries.push(order);
      } else if (order.orderType === 'exit') {
        pos.exits.push(order);
      }
    }
    
    const trades = [];
    
    // Match entries with exits using FIFO (First In First Out)
    for (const [symbol, { entries, exits }] of positions) {
      // Sort by execution time
      entries.sort((a, b) => a.executionTime - b.executionTime);
      exits.sort((a, b) => a.executionTime - b.executionTime);
      
      let exitIndex = 0;
      
      for (const entry of entries) {
        let remainingSize = entry.filledQuantity;
        
        // Match with exits
        while (remainingSize > 0 && exitIndex < exits.length) {
          const exit = exits[exitIndex];
          const matchedSize = Math.min(remainingSize, exit.filledQuantity);
          
          // Create closed trade
          trades.push({
            symbol: entry.symbol,
            side: entry.side,
            date: entry.executionTime,
            entryPrice: entry.averagePrice,
            exitPrice: exit.averagePrice,
            stopLoss: entry.stopPrice || null,
            targetPrice: entry.limitPrice || null,
            size: matchedSize,
            status: 'closed',
            notes: `Imported from ${this.name} | Order IDs: ${entry.orderId}-${exit.orderId}`,
            tags: ['broker', this.name, 'auto-import'],
          });
          
          remainingSize -= matchedSize;
          exit.filledQuantity -= matchedSize;
          
          if (exit.filledQuantity === 0) {
            exitIndex++;
          }
        }
        
        // If entry not fully matched, create open trade
        if (remainingSize > 0) {
          trades.push({
            symbol: entry.symbol,
            side: entry.side,
            date: entry.executionTime,
            entryPrice: entry.averagePrice,
            stopLoss: entry.stopPrice || null,
            targetPrice: entry.limitPrice || null,
            size: remainingSize,
            status: 'open',
            notes: `Imported from ${this.name} | Order ID: ${entry.orderId}`,
            tags: ['broker', this.name, 'auto-import', 'open-position'],
          });
        }
      }
    }
    
    return trades;
  }
}

/**
 * Alpaca provider (OAuth2)
 * Documentation: https://docs.alpaca.markets/
 */
class AlpacaProvider extends BrokerProvider {
  constructor() {
    super('alpaca');
    this.clientId = process.env.ALPACA_CLIENT_ID;
    this.clientSecret = process.env.ALPACA_CLIENT_SECRET;
    this.redirectUri = process.env.ALPACA_REDIRECT_URI;
    this.baseUrl = process.env.ALPACA_BASE_URL || 'https://api.alpaca.markets';
    this.authUrl = 'https://app.alpaca.markets/oauth/authorize';
    this.tokenUrl = 'https://api.alpaca.markets/oauth/token';
    
    this.validateConfig();
  }

  validateConfig() {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('Alpaca: Missing required environment variables (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)');
    }
  }

  getAuthUrl(state, userId) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state: `${state}:${userId}`, // Include userId for verification
      scope: 'account:read trading:read',
    });
    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    try {
      const body = {
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      };
      
      const { data } = await axios.post(this.tokenUrl, body, {
        headers: { 'Content-Type': 'application/json' },
      });
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      logger.error('Alpaca token exchange failed', { error: error.message });
      throw AppError.internal('Failed to authenticate with Alpaca', 'ALPACA_AUTH_FAILED');
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      const body = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      };
      
      const { data } = await axios.post(this.tokenUrl, body, {
        headers: { 'Content-Type': 'application/json' },
      });
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Some brokers don't return new refresh token
        expiresIn: data.expires_in,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      logger.error('Alpaca token refresh failed', { error: error.message });
      throw AppError.unauthorized('Failed to refresh Alpaca token', 'ALPACA_REFRESH_FAILED');
    }
  }

  async fetchOrders(accessToken, accountId, since) {
    try {
      // Fetch closed orders (filled)
      const url = `${this.baseUrl}/v2/orders`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          status: 'filled',
          after: since.toISOString(),
          limit: 500,
          direction: 'desc',
        },
      });
      
      // Transform to standardized format
      const orders = [];
      
      for (const order of data) {
        const orderData = {
          orderId: order.id,
          symbol: order.symbol,
          side: order.side === 'buy' ? 'long' : 'short',
          orderType: this.determineOrderType(order),
          filledQuantity: parseFloat(order.filled_qty),
          averagePrice: parseFloat(order.filled_avg_price),
          executionTime: new Date(order.filled_at || order.created_at),
          stopPrice: order.stop_price ? parseFloat(order.stop_price) : null,
          limitPrice: order.limit_price ? parseFloat(order.limit_price) : null,
        };
        
        orders.push(orderData);
      }
      
      return orders;
      
    } catch (error) {
      logger.error('Alpaca fetch orders failed', { error: error.message });
      throw AppError.internal('Failed to fetch orders from Alpaca', 'ALPACA_FETCH_FAILED');
    }
  }

  async fetchPositions(accessToken, accountId) {
    try {
      const url = `${this.baseUrl}/v2/positions`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      // Transform open positions to trades
      return data.map(pos => ({
        symbol: pos.symbol,
        side: parseFloat(pos.qty) > 0 ? 'long' : 'short',
        date: new Date(pos.created_at || Date.now()),
        entryPrice: parseFloat(pos.avg_entry_price),
        size: Math.abs(parseFloat(pos.qty)),
        status: 'open',
        notes: `Open position imported from Alpaca | Unrealized P&L: $${pos.unrealized_pl}`,
        tags: ['broker', 'alpaca', 'open-position'],
      }));
      
    } catch (error) {
      logger.error('Alpaca fetch positions failed', { error: error.message });
      return []; // Non-critical, return empty array
    }
  }

  determineOrderType(order) {
    // Determine if order is entry or exit based on order data
    // This is simplified - in production, track position state
    if (order.side === 'buy' && order.qty > 0) return 'entry';
    if (order.side === 'sell' && order.qty > 0) return 'exit';
    return 'entry'; // Default
  }
}

/**
 * TD Ameritrade provider (OAuth2)
 * Documentation: https://developer.tdameritrade.com/
 */
class TDAmeritradeProvider extends BrokerProvider {
  constructor() {
    super('tdameritrade');
    this.clientId = process.env.TD_CLIENT_ID;
    this.clientSecret = process.env.TD_CLIENT_SECRET;
    this.redirectUri = process.env.TD_REDIRECT_URI;
    this.baseUrl = 'https://api.tdameritrade.com';
    this.authUrl = 'https://auth.tdameritrade.com/oauth';
    this.tokenUrl = 'https://api.tdameritrade.com/v1/oauth2/token';
    
    this.validateConfig();
  }

  validateConfig() {
    if (!this.clientId || !this.redirectUri) {
      throw new Error('TD Ameritrade: Missing required environment variables (CLIENT_ID, REDIRECT_URI)');
    }
  }

  getAuthUrl(state, userId) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: `${this.clientId}@AMER.OAUTHAP`,
      redirect_uri: this.redirectUri,
      state: `${state}:${userId}`,
    });
    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        access_type: 'offline',
        code: decodeURIComponent(code),
        client_id: `${this.clientId}@AMER.OAUTHAP`,
        redirect_uri: this.redirectUri,
      });
      
      const { data } = await axios.post(this.tokenUrl, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      logger.error('TD Ameritrade token exchange failed', { error: error.message });
      throw AppError.internal('Failed to authenticate with TD Ameritrade', 'TD_AUTH_FAILED');
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: `${this.clientId}@AMER.OAUTHAP`,
      });
      
      const { data } = await axios.post(this.tokenUrl, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresIn: data.expires_in,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      logger.error('TD Ameritrade token refresh failed', { error: error.message });
      throw AppError.unauthorized('Failed to refresh TD Ameritrade token', 'TD_REFRESH_FAILED');
    }
  }

  async fetchOrders(accessToken, accountId, since) {
    try {
      const url = `${this.baseUrl}/v1/accounts/${accountId}/transactions`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          type: 'TRADE',
          startDate: since.toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
        },
      });
      
      const orders = [];
      
      for (const txn of data) {
        if (txn.type !== 'TRADE') continue;
        
        const item = txn.transactionItem;
        const orderData = {
          orderId: txn.transactionId,
          symbol: item.instrument.symbol,
          side: item.instruction === 'BUY' ? 'long' : 'short',
          orderType: item.positionEffect === 'OPENING' ? 'entry' : 'exit',
          filledQuantity: Math.abs(item.amount),
          averagePrice: item.price,
          executionTime: new Date(txn.transactionDate),
          stopPrice: null, // TD doesn't provide in transaction history
          limitPrice: null,
        };
        
        orders.push(orderData);
      }
      
      return orders;
      
    } catch (error) {
      logger.error('TD Ameritrade fetch orders failed', { error: error.message });
      throw AppError.internal('Failed to fetch orders from TD Ameritrade', 'TD_FETCH_FAILED');
    }
  }

  async fetchPositions(accessToken, accountId) {
    try {
      const url = `${this.baseUrl}/v1/accounts/${accountId}`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { fields: 'positions' },
      });
      
      const positions = data.securitiesAccount?.positions || [];
      
      return positions.map(pos => ({
        symbol: pos.instrument.symbol,
        side: pos.longQuantity > 0 ? 'long' : 'short',
        date: new Date(), // TD doesn't provide position open date
        entryPrice: pos.averagePrice,
        size: Math.abs(pos.longQuantity || pos.shortQuantity),
        status: 'open',
        notes: `Open position imported from TD Ameritrade`,
        tags: ['broker', 'tdameritrade', 'open-position'],
      }));
      
    } catch (error) {
      logger.error('TD Ameritrade fetch positions failed', { error: error.message });
      return [];
    }
  }
}

/**
 * Interactive Brokers provider (placeholder - requires IB Gateway/TWS)
 */
class InteractiveBrokersProvider extends BrokerProvider {
  constructor() {
    super('interactivebrokers');
    // IB requires different authentication approach (IB Gateway or TWS API)
    throw new Error('Interactive Brokers integration requires IB Gateway setup');
  }
}

/**
 * Registry of available providers
 */
const providers = {
  alpaca: null,
  tdameritrade: null,
  interactivebrokers: null,
};

// Lazy initialization to prevent errors if env vars not set
function initProvider(name) {
  if (!providers[name]) {
    switch (name) {
      case 'alpaca':
        providers[name] = new AlpacaProvider();
        break;
      case 'tdameritrade':
        providers[name] = new TDAmeritradeProvider();
        break;
      case 'interactivebrokers':
        providers[name] = new InteractiveBrokersProvider();
        break;
      default:
        throw AppError.badRequest('Unknown broker provider', 'UNKNOWN_PROVIDER');
    }
  }
  return providers[name];
}

export function getProvider(name) {
  try {
    return initProvider(name.toLowerCase());
  } catch (error) {
    logger.error('Failed to initialize provider', { provider: name, error: error.message });
    throw AppError.badRequest(
      `Broker provider "${name}" is not configured or unavailable`,
      'PROVIDER_UNAVAILABLE'
    );
  }
}

export function getAvailableProviders() {
  const available = [];
  
  for (const name of Object.keys(providers)) {
    try {
      initProvider(name);
      available.push(name);
    } catch (error) {
      // Skip unconfigured providers
      logger.debug(`Provider ${name} not available`, { error: error.message });
    }
  }
  
  return available;
}

export { BrokerProvider };