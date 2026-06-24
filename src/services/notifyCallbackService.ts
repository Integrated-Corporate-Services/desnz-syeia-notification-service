/**
 * Notify Callback Service
 * Bearer token authentication and token management
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import crypto from 'crypto';
import config from '../config/config';
import getLogger from '../utils/loggerHelper';
import type { AuthResult } from '../types/notifyCallback.types';
import { MIN_TOKEN_LENGTH, ERROR_CODES, RESPONSE_MESSAGES } from '../constants/notify.constants';

const logger = getLogger(module);

// Token cache interface
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;
let secretsManagerClient: SecretsManagerClient | null = null;

/**
 * Get Secrets Manager client (singleton)
 */
function getSecretsManagerClient(): SecretsManagerClient {
  if (!secretsManagerClient) {
    secretsManagerClient = new SecretsManagerClient({
      region: config.aws.region,
      endpoint: config.aws.endpoint,
    });
  }
  return secretsManagerClient;
}

/**
 * Get notify callback bearer token from AWS Secrets Manager (with 5-min cache)
 */
export async function getNotifyCallbackToken(): Promise<string> {
  // Check cache first
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    logger.debug('[NotifyService] Using cached bearer token');
    return tokenCache.token;
  }

  // Try Secrets Manager first
  if (config.notify.secretName) {
    try {
      logger.debug('[NotifyService] Fetching bearer token from Secrets Manager', {
        secretName: config.notify.secretName,
      });

      const command = new GetSecretValueCommand({
        SecretId: config.notify.secretName,
      });

      const response = await getSecretsManagerClient().send(command);
      const token = response.SecretString?.trim();

      if (!token || token.length < MIN_TOKEN_LENGTH) {
        throw new Error(`Token too short (minimum ${MIN_TOKEN_LENGTH} characters)`);
      }

      // Cache for 5 minutes
      tokenCache = {
        token,
        expiresAt: Date.now() + config.notify.secretTtlMs,
      };

      logger.info('[NotifyService] Bearer token loaded from Secrets Manager');
      return token;
    } catch (error) {
      logger.error('[NotifyService] Failed to fetch from Secrets Manager', {
        error: error instanceof Error ? error.message : String(error),
      });

      // In production, fail hard
      if (config.nodeEnv === 'production') {
        throw new Error('Cannot retrieve Notify callback token from Secrets Manager in production');
      }
    }
  }

  // Development fallback: environment variable
  if (config.notify.fallbackToken) {
    logger.warn('[NotifyService] Using fallback bearer token from environment (DEVELOPMENT ONLY)');

    if (config.notify.fallbackToken.length < MIN_TOKEN_LENGTH) {
      throw new Error(`Fallback token too short (minimum ${MIN_TOKEN_LENGTH} characters)`);
    }

    return config.notify.fallbackToken;
  }

  throw new Error('No bearer token configured (neither Secrets Manager nor fallback)');
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
    expectedToken = await getNotifyCallbackToken();
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
