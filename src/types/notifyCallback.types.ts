/**
 * Notify Callback Type Definitions
 * TypeScript types for GOV.UK Notify callback system
 */

// GOV.UK Notify delivery statuses
export type NotifyStatus = 'delivered' | 'permanent-failure' | 'temporary-failure' | 'technical-failure';

// Notification types
export type NotificationType = 'email' | 'sms' | 'letter';

// Processing statuses for internal state machine
export type NotifyProcessingStatus =
  | 'RECEIVED'
  | 'ENQUEUING'
  | 'ENQUEUED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED_RETRYABLE'
  | 'POISONED';

// GOV.UK Notify callback payload (incoming webhook)
export interface NotifyCallbackPayload {
  id: string;                          // Notify notification ID (UUID)
  reference: string | null;            // Application reference
  to: string;                          // Recipient email/phone
  status: NotifyStatus;                // Delivery status
  created_at: string;                  // ISO 8601 timestamp
  completed_at: string | null;         // ISO 8601 timestamp
  sent_at: string | null;              // ISO 8601 timestamp
  notification_type: NotificationType; // Email, SMS, or letter
  template_id: string;                 // Notify template UUID
  template_version: number;            // Template version number
}

// Database row structure
export interface NotifyCallbackEventRow {
  id: string;
  notify_notification_id: string;
  reference: string | null;
  notification_type: string;
  status: string;
  payload_json: Record<string, unknown>;
  processing_status: NotifyProcessingStatus;
  failure_reason: string | null;
  correlation_id: string | null;
  received_at: Date;
  enqueued_at: Date | null;
  processed_at: Date | null;
  updated_at: Date;
  created_at: Date;
}

// Repository insert result
export interface InsertResult {
  inserted: boolean;
  id: string | null;
}

// SQS message for relay → worker
export interface NotifySqsMessage {
  eventId: string;
  notifyNotificationId: string;
  status: string;
  correlationId: string | null;
}

// Poison queue message
export interface PoisonSqsMessage {
  eventId: string;
  notifyNotificationId: string;
  reason: string;
  originalPayload: unknown;
}

// Worker processing result
export interface WorkerResult {
  eventId: string;
  outcome: 'PROCESSED' | 'SKIPPED_TERMINAL' | 'POISONED' | 'RETRY';
}

// Authentication result
export interface AuthResult {
  authenticated: boolean;
  errorCode?: string;
  errorMessage?: string;
}

// Express request extensions
export interface NotifyCallbackRequest extends Request {
  correlationId?: string;
  notifyPayload?: NotifyCallbackPayload;
}
