// Notify Callback Routes
import express from 'express';
import { handleDeliveryCallback, healthCheck } from '../controllers/notifyCallbackController';
import { validateNotifyBearerTokenMiddleware } from '../middlewares/validateNotifyBearerToken';
import { validateNotifyCallbackPayloadMiddleware } from '../validators/notifyCallbackPayloadValidator';
import { webhookRateLimiter, healthCheckRateLimiter } from '../middlewares/rateLimiter';

const router = express.Router();

// Health check endpoint
router.get('/health', healthCheckRateLimiter, healthCheck);

// Delivery callback endpoint for GOV.UK Notify
router.post(
  '/delivery',
  webhookRateLimiter,
  validateNotifyBearerTokenMiddleware,
  validateNotifyCallbackPayloadMiddleware,
  handleDeliveryCallback
);

export default router;
