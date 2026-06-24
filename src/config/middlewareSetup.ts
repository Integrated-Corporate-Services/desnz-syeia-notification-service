/**
 * Middleware Setup
 * Registers Express middleware
 */

import express, { Express } from 'express';
import helmet from 'helmet';
import getLogger from '../utils/loggerHelper';

const logger = getLogger(module);

/**
 * Register all middleware
 */
export function registerMiddleware(app: Express): void {
  logger.info('[Middleware] Registering middleware');

  // Security headers
  app.use(helmet());

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request logging (simple)
  app.use((req, _res, next) => {
    logger.debug('[Request] Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    next();
  });

  logger.info('[Middleware] Middleware registered successfully');
}
