/**
 * Notify Callback Controller
 * Handles incoming GOV.UK Notify delivery callbacks
 */

import { Request, Response } from 'express';
import type { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { insertNotifyCallbackEvent } from '../repositories/notifyCallbackRepository';
import { hashRecipient } from '../services/notifyCallbackService';
import getLogger from '../utils/loggerHelper';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../constants/notify.constants';
import type { NotifyCallbackPayload } from '../types/notifyCallback.types';

const logger = getLogger(module);

/**
 * Handle delivery callback from GOV.UK Notify
 * POST /callbacks/notify/delivery
 */
export async function handleDeliveryCallback(
  req: Request,
  res: Response,
  pool: Pool,
): Promise<Response> {
  const correlationId = (req as any).correlationId || uuidv4();
  const payload: NotifyCallbackPayload = (req as any).notifyPayload;

  if (!payload) {
    logger.error('[NotifyController] Missing validated payload', { correlationId });
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Invalid request: missing payload',
    });
  }

  const recipientHash = hashRecipient(payload.to);

  logger.info('[NotifyController] Callback received', {
    correlationId,
    notifyNotificationId: payload.id,
    reference: payload.reference,
    status: payload.status,
    notificationType: payload.notification_type,
    recipientHash, // PII-safe logging
  });

  try {
    // Insert into database (idempotent)
    const result = await insertNotifyCallbackEvent(pool, payload, correlationId);

    if (!result.inserted) {
      logger.info('[NotifyController] Duplicate callback suppressed', {
        correlationId,
        notifyNotificationId: payload.id,
      });

      // Still return 202 for idempotency
      return res.status(HTTP_STATUS.ACCEPTED).json({
        received: true,
      });
    }

    logger.info('[NotifyController] Callback stored', {
      correlationId,
      eventId: result.id,
      notifyNotificationId: payload.id,
    });

    return res.status(HTTP_STATUS.ACCEPTED).json({
      received: true,
    });
  } catch (error) {
    logger.error('[NotifyController] Database error', {
      correlationId,
      notifyNotificationId: payload.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: RESPONSE_MESSAGES.DATABASE_ERROR,
    });
  }
}

/**
 * Health check endpoint
 * GET /health
 */
export async function healthCheck(_req: Request, res: Response): Promise<Response> {
  const health = {
    status: 'ok',
    service: 'notify-callback-service',
    timestamp: new Date().toISOString(),
  };

  logger.debug('[Health] Health check requested');

  return res.status(HTTP_STATUS.OK).json(health);
}
