/**
 * Notify Callback Service
 * Bearer token authentication and token management
 */

import crypto from 'crypto';
import config from '../config/config';
import getLogger from '../utils/loggerHelper';
import type { AuthResult } from '../types/notifyCallback.types';
import { MIN_TOKEN_LENGTH, ERROR_CODES, RESPONSE_MESSAGES } from '../constants/notify.constants';

const logger = getLogger(module);

let validatedToken: string | null = null;

export function getNotifyCallbackToken(): string {
  if (validatedToken) {
    return validatedToken;
  }

  const token = config.notify.bearerToken?.trim();

  if (!token) {
    throw new Error('No bearer token configured');
  }

  if (token.length < MIN_TOKEN_LENGTH) {
    throw new Error(`Bearer token too short (minimum ${MIN_TOKEN_LENGTH} characters)`);
  }

  validatedToken = token;
  logger.info('[NotifyService] Bearer token loaded from environment');
  return validatedToken;
}

/**
 * Verify notify bearer token using timing-safe comparison
 */
export async function verifyNotifyBearerToken(authHeader: string | undefined): Promise<AuthResult> {
  // Check Authorization header exists
  if (!authHeader) {
    return {
      authenticated: false,
      errorCode: ERROR_CODES.MISSING_AUTH_HEADER,
      errorMessage: RESPONSE_MESSAGES.MISSING_AUTH,
    };
  }

  // Check Bearer scheme
  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return {
      authenticated: false,
      errorCode: ERROR_CODES.INVALID_TOKEN_FORMAT,
      errorMessage: RESPONSE_MESSAGES.INVALID_TOKEN,
    };
  }

  const providedToken = parts[1];

  // Get expected token
  let expectedToken: string;
  try {
    expectedToken = getNotifyCallbackToken();
  } catch (error) {
    logger.error('[NotifyService] Failed to get expected token', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  // Timing-safe comparison (prevents timing attacks)
  const providedBuffer = Buffer.from(providedToken, 'utf8');
  const expectedBuffer = Buffer.from(expectedToken, 'utf8');

  // Must be same length for timingSafeEqual
  if (providedBuffer.length !== expectedBuffer.length) {
    return {
      authenticated: false,
      errorCode: ERROR_CODES.INVALID_BEARER_TOKEN,
      errorMessage: RESPONSE_MESSAGES.INVALID_TOKEN,
    };
  }

  const isValid = crypto.timingSafeEqual(providedBuffer, expectedBuffer);

  if (!isValid) {
    return {
      authenticated: false,
      errorCode: ERROR_CODES.INVALID_BEARER_TOKEN,
      errorMessage: RESPONSE_MESSAGES.INVALID_TOKEN,
    };
  }

  return { authenticated: true };
}

/**
 * Hash recipient for PII-safe logging (SHA-256, first 8 hex chars)
 */
export function hashRecipient(recipient: string): string {
  return crypto.createHash('sha256').update(recipient).digest('hex').substring(0, 8);
}
