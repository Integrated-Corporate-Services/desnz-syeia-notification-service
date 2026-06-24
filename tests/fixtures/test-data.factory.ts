/**
 * Test Data Factory for Notify Callback Tests
 * Generates realistic test data for GOV.UK Notify delivery callbacks
 */

import { v4 as uuidv4 } from 'uuid';

export type NotifyStatus = 'delivered' | 'permanent-failure' | 'temporary-failure' | 'technical-failure';
export type NotificationType = 'email' | 'sms' | 'letter';

export interface NotifyCallbackPayload {
  id: string;
  reference: string | null;
  to: string;
  status: NotifyStatus;
  created_at: string;
  completed_at: string | null;
  sent_at: string | null;
  notification_type: NotificationType;
  template_id: string;
  template_version: number;
}

export class TestDataFactory {
  private static counter = 0;

  /**
   * Generate a complete notify callback payload
   */
  static notifyCallback(overrides: Partial<NotifyCallbackPayload> = {}): NotifyCallbackPayload {
    TestDataFactory.counter++;
    const now = new Date();
    const sentAt = new Date(now.getTime() + 1000);
    const completedAt = new Date(sentAt.getTime() + 4000);

    return {
      id: uuidv4(),
      reference: `TEST-REF-${TestDataFactory.counter}`,
      to: `test${TestDataFactory.counter}@example.com`,
      status: 'delivered',
      created_at: now.toISOString(),
      completed_at: completedAt.toISOString(),
      sent_at: sentAt.toISOString(),
      notification_type: 'email',
      template_id: uuidv4(),
      template_version: 1,
      ...overrides,
    };
  }

  /**
   * Generate delivered email callback
   */
  static deliveredEmail(notifyId?: string): NotifyCallbackPayload {
    return TestDataFactory.notifyCallback({
      id: notifyId || uuidv4(),
      status: 'delivered',
      notification_type: 'email',
    });
  }

  /**
   * Generate delivered SMS callback
   */
  static deliveredSms(notifyId?: string): NotifyCallbackPayload {
    const counter = TestDataFactory.counter + 1;
    return TestDataFactory.notifyCallback({
      id: notifyId || uuidv4(),
      status: 'delivered',
      notification_type: 'sms',
      to: `+447700900${String(counter).padStart(3, '0')}`,
    });
  }

  /**
   * Generate permanent failure callback
   */
  static permanentFailure(notifyId?: string): NotifyCallbackPayload {
    return TestDataFactory.notifyCallback({
      id: notifyId || uuidv4(),
      status: 'permanent-failure',
    });
  }

  /**
   * Generate temporary failure callback
   */
  static temporaryFailure(notifyId?: string): NotifyCallbackPayload {
    return TestDataFactory.notifyCallback({
      id: notifyId || uuidv4(),
      status: 'temporary-failure',
    });
  }

  /**
   * Generate technical failure callback
   */
  static technicalFailure(notifyId?: string): NotifyCallbackPayload {
    return TestDataFactory.notifyCallback({
      id: notifyId || uuidv4(),
      status: 'technical-failure',
    });
  }

  /**
   * Reset counter for predictable test data
   */
  static reset(): void {
    TestDataFactory.counter = 0;
  }
}
