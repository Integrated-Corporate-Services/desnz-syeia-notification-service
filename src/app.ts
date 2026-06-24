/**
 * Express Application Setup
 * Creates and configures the Express application
 */

import express, { Express } from 'express';
import type { Pool } from 'pg';
import { registerMiddleware } from './config/middlewareSetup';
import { registerRoutes } from './config/routeSetup';
import { registerErrorHandler } from './config/errorHandler';

/**
 * Create and configure Express application
 * Follows modular architecture pattern for better maintainability
 */
export function createApp(pool: Pool): Express {
  const app = express();

  // Register middleware (security, body parsing, logging)
  registerMiddleware(app);

  // Register application routes (notify callbacks, health checks)
  registerRoutes(app, pool);

  // Register error handlers (404 and 500 handlers)
  registerErrorHandler(app);

  return app;
}

export default createApp;
