/**
 * Notify Callback Routes
 * Route definitions for GOV.UK Notify callbacks
 */

import express, { Router } from 'express';
import type { Pool } from 'pg';
import { validateNotifyBearerTokenMiddleware } from '../middlewares/validateNotifyBearerToken';
import { validateNotifyCallbackPayloadMiddleware } from '../validators/notifyCallbackPayloadValidator';
import { handleDeliveryCallback, healthCheck } from '../controllers/notifyCallbackController';

export function createNotifyCallbackRoutes(pool: Pool): Router {
  const router = express.Router();

  // Health check endpoint (no authentication)
  router.get('/health', healthCheck);

  // Delivery callback endpoint
  // Middleware chain:
  // 1. Bearer token validation
  // 2. Payload schema validation
  // 3. Controller handler
  router.post(
    '/delivery',
    validateNotifyBearerTokenMiddleware,
    validateNotifyCallbackPayloadMiddleware,
    (req, res) => handleDeliveryCallback(req, res, pool),
  );

  return router;
}
