// Notify Callback Routes
import express from 'express';
import { handleDeliveryCallback, healthCheck } from '../controllers/notifyCallbackController';
import { validateNotifyBearerTokenMiddleware } from '../middlewares/validateNotifyBearerToken';
import { validateNotifyCallbackPayloadMiddleware } from '../validators/notifyCallbackPayloadValidator';

const router = express.Router();

// Health check endpoint
router.get('/health', healthCheck);

// Delivery callback endpoint for GOV.UK Notify
// Middleware chain:
// 1. Bearer token verification
// 2. Payload structure validation
// 3. Callback processing
router.post(
  '/delivery',
  validateNotifyBearerTokenMiddleware,
  validateNotifyCallbackPayloadMiddleware,
  handleDeliveryCallback
);

export default router;
