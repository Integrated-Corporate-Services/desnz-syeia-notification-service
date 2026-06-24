/**
 * Mock Builders for Notify Callback Tests
 * In-memory implementations for testing without external dependencies
 */

import type { Pool } from 'pg';
import type { NotifyCallbackEventRow } from '../../src/notify/notifyCallback.types';

/**
 * In-memory repository for testing
 */
export class InMemoryNotifyRepository {
  private events: Map<string, NotifyCallbackEventRow> = new Map();
  private notifyIdIndex: Map<string, string> = new Map();

  async insert(event: Partial<NotifyCallbackEventRow>): Promise<{ inserted: boolean; id: string | null }> {
    const id = event.id!;

    // Check for duplicate notify_notification_id
    if (this.notifyIdIndex.has(event.notify_notification_id!)) {
      return { inserted: false, id: null };
    }

    const row: NotifyCallbackEventRow = {
      id,
      notify_notification_id: event.notify_notification_id!,
      reference: event.reference || null,
      notification_type: event.notification_type!,
      status: event.status!,
      payload_json: event.payload_json!,
      processing_status: event.processing_status || 'RECEIVED',
      failure_reason: null,
      correlation_id: event.correlation_id || null,
      received_at: new Date(),
      enqueued_at: null,
      processed_at: null,
      updated_at: new Date(),
      created_at: new Date(),
    };

    this.events.set(id, row);
    this.notifyIdIndex.set(row.notify_notification_id, id);

    return { inserted: true, id };
  }

  async findById(id: string): Promise<NotifyCallbackEventRow | null> {
    return this.events.get(id) || null;
  }

  async findByNotifyId(notifyId: string): Promise<NotifyCallbackEventRow | null> {
    const id = this.notifyIdIndex.get(notifyId);
    return id ? this.events.get(id) || null : null;
  }

  async updateProcessingStatus(
    id: string,
    status: string,
    failureReason?: string,
  ): Promise<void> {
    const event = this.events.get(id);
    if (event) {
      event.processing_status = status;
      event.failure_reason = failureReason || null;
      event.updated_at = new Date();

      if (status === 'ENQUEUED') {
        event.enqueued_at = new Date();
      } else if (status === 'PROCESSED' || status === 'POISONED') {
        event.processed_at = new Date();
      }
    }
  }

  getAll(): NotifyCallbackEventRow[] {
    return Array.from(this.events.values());
  }

  clear(): void {
    this.events.clear();
    this.notifyIdIndex.clear();
  }

  size(): number {
    return this.events.size;
  }
}

/**
 * Factory for creating mock instances
 */
export class MockBuilderFactory {
  static repository(): InMemoryNotifyRepository {
    return new InMemoryNotifyRepository();
  }
}
