/**
 * Notify Callback Payload Validator
 * Validates incoming GOV.UK Notify delivery callbacks
 */

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import getLogger from '../utils/loggerHelper';
import { HTTP_STATUS, NOTIFY_STATUSES, NOTIFICATION_TYPES } from '../constants/notify.constants';
import type { NotifyCallbackPayload } from '../types/notifyCallback.types';

const logger = getLogger(module);

// Zod schema for Notify callback validation
const notifyCallbackSchema = z
  .object({
    id: z.string().uuid('id must be a valid UUID'),
    reference: z.string().nullable(),
    to: z.string().min(1, 'to must not be empty'),
    status: z.enum([
      NOTIFY_STATUSES.DELIVERED,
      NOTIFY_STATUSES.PERMANENT_FAILURE,
      NOTIFY_STATUSES.TEMPORARY_FAILURE,
      NOTIFY_STATUSES.TECHNICAL_FAILURE,
    ] as [string, ...string[]]),
    created_at: z.string().datetime('created_at must be ISO 8601 datetime'),
    completed_at: z.string().datetime('completed_at must be ISO 8601 datetime').nullable(),
    sent_at: z.string().datetime('sent_at must be ISO 8601 datetime').nullable(),
    notification_type: z.enum([
      NOTIFICATION_TYPES.EMAIL,
      NOTIFICATION_TYPES.SMS,
      NOTIFICATION_TYPES.LETTER,
    ] as [string, ...string[]]),
    template_id: z.string().uuid('template_id must be a valid UUID'),
    template_version: z.number().int().positive('template_version must be positive integer'),
  })
  .passthrough(); // Allow extra fields from Notify (future-proofing)

/**
 * Validate notify callback payload
 */
export function validateNotifyCallbackPayload(payload: unknown): {
  valid: boolean;
  data?: NotifyCallbackPayload;
  errors?: z.ZodError;
} {
  try {
    const data = notifyCallbackSchema.parse(payload) as NotifyCallbackPayload;
    return { valid: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, errors: error };
    }
    throw error;
  }
}

/**
 * Express middleware for validating Notify callback payload
 */
export function validateNotifyCallbackPayloadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const correlationId = req.headers['x-correlation-id'] as string;

  const result = validateNotifyCallbackPayload(req.body);

  if (!result.valid) {
    logger.warn('[NotifyValidator] Payload validation failed', {
      correlationId,
      errors: result.errors?.errors,
    });

    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Invalid callback payload',
      details: result.errors?.errors,
    });
    return;
  }

  logger.debug('[NotifyValidator] Payload validation passed', {
    correlationId,
    notifyId: result.data?.id,
    status: result.data?.status,
  });

  // Attach validated payload to request
  (req as Request & { notifyPayload?: typeof result.data }).notifyPayload = result.data;

  next();
}
