/**
 * Notify Callback Repository
 * Database operations for notify_callback_event table
 */

import type { Pool, QueryResult } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type {
  NotifyCallbackPayload,
  NotifyCallbackEventRow,
  InsertResult,
} from '../types/notifyCallback.types';
import getLogger from '../utils/loggerHelper';
import { createSanitizedErrorLog } from '../utils/errorSanitizer';

const logger = getLogger(module);

/**
 * Insert a new notify callback event
 * Returns {inserted: false} if duplicate (idempotency)
 */
export async function insertNotifyCallbackEvent(
  pool: Pool,
  payload: NotifyCallbackPayload,
  correlationId: string | null,
): Promise<InsertResult> {
  const id = uuidv4();

  try {
    await pool.query(
      `INSERT INTO notify_callback_event (
        id, notify_notification_id, reference, notification_type,
        status, payload_json, processing_status, correlation_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        payload.id,
        payload.reference,
        payload.notification_type,
        payload.status,
        JSON.stringify(payload),
        'RECEIVED',
        correlationId,
      ],
    );

    logger.info('[NotifyRepository] Event inserted', { eventId: id, notifyId: payload.id });
    return { inserted: true, id };
  } catch (error: unknown) {
    // PostgreSQL unique constraint violation (23505)
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      logger.info('[NotifyRepository] Duplicate event suppressed', { notifyId: payload.id });
      return { inserted: false, id: null };
    }

    const sanitizedError = createSanitizedErrorLog(error);
    logger.error('[NotifyRepository] Insert failed', {
      error_message: sanitizedError.sanitized_message,
      error_type: sanitizedError.error_type,
      notifyId: payload.id,
    });
    throw error;
  }
}

/**
 * Find event by ID
 */
export async function findEventById(pool: Pool, id: string): Promise<NotifyCallbackEventRow | null> {
  const result: QueryResult<NotifyCallbackEventRow> = await pool.query(
    `SELECT id, notify_notification_id, reference, notification_type, status,
            payload_json, processing_status, failure_reason, correlation_id,
            received_at, enqueued_at, processed_at, updated_at, created_at
     FROM notify_callback_event
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] || null;
}

/**
 * Mark event as PROCESSING
 */
export async function markProcessing(pool: Pool, id: string): Promise<void> {
  await pool.query(
    `UPDATE notify_callback_event
     SET processing_status = 'PROCESSING', updated_at = NOW()
     WHERE id = $1`,
    [id],
  );
}

/**
 * Mark event as PROCESSED (terminal state)
 */
export async function markProcessed(pool: Pool, id: string): Promise<void> {
  await pool.query(
    `UPDATE notify_callback_event
     SET processing_status = 'PROCESSED',
         processed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [id],
  );
}

/**
 * Mark event as FAILED_RETRYABLE (can be retried)
 */
export async function markRetryableFailure(pool: Pool, id: string, reason: string): Promise<void> {
  await pool.query(
    `UPDATE notify_callback_event
     SET processing_status = 'FAILED_RETRYABLE',
         failure_reason = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [id, reason],
  );
}

/**
 * Mark event as POISONED (terminal state, non-retryable)
 */
export async function markPoisoned(pool: Pool, id: string, reason: string): Promise<void> {
  await pool.query(
    `UPDATE notify_callback_event
     SET processing_status = 'POISONED',
         failure_reason = $2,
         processed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [id, reason],
  );
}

/**
 * Mark event as ENQUEUING (relay starting to process)
 */
export async function markEnqueuing(pool: Pool, ids: string[]): Promise<void> {
  await pool.query(
    `UPDATE notify_callback_event
     SET processing_status = 'ENQUEUING', updated_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    [ids],
  );
}

/**
 * Mark event as ENQUEUED (successfully sent to SQS)
 */
export async function markEnqueued(pool: Pool, id: string): Promise<void> {
  await pool.query(
    `UPDATE notify_callback_event
     SET processing_status = 'ENQUEUED',
         enqueued_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [id],
  );
}

/**
 * Revert events back to RECEIVED (relay failed to send to SQS)
 */
export async function revertToReceived(pool: Pool, ids: string[]): Promise<void> {
  await pool.query(
    `UPDATE notify_callback_event
     SET processing_status = 'RECEIVED', updated_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    [ids],
  );
}
