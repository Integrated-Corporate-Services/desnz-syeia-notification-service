// Notify Callback Routes
import express from 'express';
const router = express.Router();
const { handleDeliveryCallback, healthCheck } = require('../controllers/notifyCallbackController');
const { validateNotifyBearerTokenMiddleware } = require('../middlewares/validateNotifyBearerToken');
const {
  validateNotifyCallbackPayloadMiddleware,
} = require('../validators/notifyCallbackPayloadValidator');

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
