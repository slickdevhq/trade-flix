
import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { connectDB } from './src/config/db.js';
import logger from './src/config/logger.js';

const PORT = process.env.PORT || 5001;

// Create HTTP server
const server = http.createServer(app);

// Graceful Shutdown
const shutdown = (signal) => {
  logger.info(`[${signal}] Received. Shutting down...`);
  server.close(() => {
    logger.info('Server closed.');
    // Close DB connection, etc.
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.warn('Forcing shutdown...');
    process.exit(1);
  }, 10000); // 10 seconds
};

// Handle termination signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', { err });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...', { err });
  server.close(() => {
    process.exit(1);
  });
});

// Start the server
const startServer = async () => {
  try {
    await connectDB();
    logger.info('MongoDB connected.');
    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();