import { Router } from 'express';
import {
  listProviders,
  getBrokerAuthUrl,
  handleBrokerCallback,
  syncBrokerTrades,
  disconnectBroker,
  updateBrokerSettings,
} from '../controllers/broker.controller.js';

const router = Router();

// List available providers and connection status
router.get('/', listProviders);

// Get OAuth authorization URL
router.get('/:provider/auth', getBrokerAuthUrl);

// Handle OAuth callback (exchange code for token)
router.post('/:provider/callback', handleBrokerCallback);

// Manually trigger trade sync
router.post('/:provider/sync', syncBrokerTrades);

// Update broker settings (auto-sync, frequency)
router.patch('/:provider/settings', updateBrokerSettings);

// Disconnect broker
router.delete('/:provider', disconnectBroker);

export default router;