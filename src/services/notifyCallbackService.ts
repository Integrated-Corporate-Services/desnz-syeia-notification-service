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
 * True when the value looks like a Secrets Manager secret id (name or ARN),
 * not a raw bearer token injected into the env var by ECS.
 */
function isSecretsManagerSecretId(value: string): boolean {
  if (value.startsWith('arn:aws:secretsmanager:')) {
    return true;
  }

  // Typical secret names / paths (e.g. notify/callback-bearer-token)
  // Raw injected tokens are usually long opaque strings without a path shape.
  if (value.includes('/') && value.length <= 256) {
    return true;
  }

  return false;
}

function cacheAndReturnToken(token: string, source: string): string {
  if (token.length < MIN_TOKEN_LENGTH) {
    throw new Error(`Token too short (minimum ${MIN_TOKEN_LENGTH} characters)`);
  }

  tokenCache = {
    token,
    expiresAt: Date.now() + config.notify.secretTtlMs,
  };

  logger.info('[NotifyService] Bearer token loaded', { source });
  return token;
}

/**
 * Get notify callback bearer token (with short-lived cache).
 * Resolution order:
 *  1. NOTIFY_CALLBACK_BEARER_TOKEN (direct token)
 *  2. Secrets Manager via NOTIFY_CALLBACK_SECRET_NAME (when it looks like a secret id)
 *  3. NOTIFY_CALLBACK_SECRET_NAME as a raw token (ECS/SSM value injection)
 */
export async function getNotifyCallbackToken(): Promise<string> {
  // Check cache first
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    logger.debug('[NotifyService] Using cached bearer token');
    return tokenCache.token;
  }

  // Preferred: direct token from env (local or ECS secret injection into this var)
  if (config.notify.fallbackToken) {
    return cacheAndReturnToken(
      config.notify.fallbackToken.trim(),
      'NOTIFY_CALLBACK_BEARER_TOKEN',
    );
  }

  const secretName = config.notify.secretName?.trim();

  // Secrets Manager lookup when the env value is a secret name/ARN
  if (secretName && isSecretsManagerSecretId(secretName)) {
    try {
      logger.debug('[NotifyService] Fetching bearer token from Secrets Manager', {
        secretName,
      });

      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response = await getSecretsManagerClient().send(command);
      const token = response.SecretString?.trim();

      if (!token) {
        throw new Error('Secrets Manager returned empty SecretString');
      }

      return cacheAndReturnToken(token, 'SecretsManager');
    } catch (error) {
      logger.error('[NotifyService] Failed to fetch from Secrets Manager', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (config.nodeEnv === 'production') {
        throw new Error('Cannot retrieve Notify callback token from Secrets Manager in production');
      }
    }
  }

  // ECS often injects the SSM/Secrets Manager *value* into NOTIFY_CALLBACK_SECRET_NAME.
  // Treat that as the bearer token when it does not look like a secret id.
  if (secretName && !isSecretsManagerSecretId(secretName)) {
    logger.warn(
      '[NotifyService] Using NOTIFY_CALLBACK_SECRET_NAME as direct bearer token (injected value)',
    );
    return cacheAndReturnToken(secretName, 'NOTIFY_CALLBACK_SECRET_NAME');
  }

  throw new Error(
    'No bearer token configured. Set NOTIFY_CALLBACK_BEARER_TOKEN, or NOTIFY_CALLBACK_SECRET_NAME as a Secrets Manager id or injected token value.',
  );
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
