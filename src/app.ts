// Express Application Setup
import express, { Express } from 'express';
import { registerMiddleware } from './config/middlewareSetup';
import { registerRoutes } from './config/routeSetup';
import { registerErrorHandler } from './config/errorHandler';

/**
 * Create and configure Express application
 * Follows modular architecture pattern for better maintainability
 */
export function createApp(): Express {
  const app = express();

  // Register middleware (CORS, security headers, body parsing, logging, request context)
  registerMiddleware(app);

  // Register application routes (notify callbacks, health checks)
  registerRoutes(app);

  // Register error handlers (404 and 500 handlers)
  registerErrorHandler(app);

  return app;
}

export default createApp;
