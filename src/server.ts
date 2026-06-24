/**
 * HTTP Server Entry Point
 * Starts the Express server and handles graceful shutdown
 */

import { createApp } from './app';
import { createPool, closePool } from './database/db';
import config from './config/config';
import getLogger from './utils/loggerHelper';

const logger = getLogger(module);

// Create database pool
const pool = createPool();

// Create Express app
const app = createApp(pool);

// Start HTTP server
const server = app.listen(config.port, () => {
  logger.info('[Server] Server started', {
    port: config.port,
    host: config.host,
    env: config.nodeEnv,
  });
});

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`[Server] ${signal} received, starting graceful shutdown`);

  // Close HTTP server
  server.close(() => {
    logger.info('[Server] HTTP server closed');
  });

  // Wait for server to close with timeout
  const shutdownTimeout = setTimeout(() => {
    logger.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000); // 10 seconds

  try {
    // Close database pool
    await closePool();

    clearTimeout(shutdownTimeout);
    logger.info('[Server] Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('[Server] Error during shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('[Server] Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('[Server] Unhandled rejection', { reason });
  shutdown('unhandledRejection');
});
