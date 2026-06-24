/**
 * Notify Callback Constants
 * Constants used across the notify callback system
 */

// Minimum bearer token length (security requirement)
export const MIN_TOKEN_LENGTH = 32;

// Relay batch size for Lambda polling
export const RELAY_BATCH_SIZE = parseInt(process.env.NOTIFY_RELAY_BATCH_SIZE || '50', 10);

// Worker batch size for SQS processing
export const WORKER_BATCH_SIZE = 10;

// GOV.UK Notify delivery statuses
export const NOTIFY_STATUSES = {
  DELIVERED: 'delivered',
  PERMANENT_FAILURE: 'permanent-failure',
  TEMPORARY_FAILURE: 'temporary-failure',
  TECHNICAL_FAILURE: 'technical-failure',
} as const;

// Notification types
export const NOTIFICATION_TYPES = {
  EMAIL: 'email',
  SMS: 'sms',
  LETTER: 'letter',
} as const;

// Processing statuses (8-state pipeline)
export const PROCESSING_STATUSES = {
  RECEIVED: 'RECEIVED',
  ENQUEUING: 'ENQUEUING',
  ENQUEUED: 'ENQUEUED',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  FAILED_RETRYABLE: 'FAILED_RETRYABLE',
  POISONED: 'POISONED',
} as const;

// Terminal processing statuses (no further processing)
export const TERMINAL_STATUSES = ['PROCESSED', 'POISONED'] as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error codes
export const ERROR_CODES = {
  MISSING_AUTH_HEADER: 'MISSING_AUTH_HEADER',
  INVALID_BEARER_TOKEN: 'INVALID_BEARER_TOKEN',
  INVALID_TOKEN_FORMAT: 'INVALID_TOKEN_FORMAT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Header names
export const HEADER_AUTHORIZATION = 'authorization';
export const HEADER_CORRELATION_ID = 'x-correlation-id';
export const HEADER_CONTENT_TYPE = 'content-type';

// Response messages
export const RESPONSE_MESSAGES = {
  RECEIVED: 'Callback received successfully',
  MISSING_AUTH: 'Missing Authorization header',
  INVALID_TOKEN: 'Invalid bearer token',
  VALIDATION_FAILED: 'Payload validation failed',
  DATABASE_ERROR: 'Database error occurred',
  INTERNAL_ERROR: 'Internal server error',
} as const;
