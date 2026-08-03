/**
 * Application Configuration
 * Centralized configuration management
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Get required environment variable (throws if missing)
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getDbCredentials() {
  const dbCredentials = process.env.DB_CREDENTIALS;
  
  if (!dbCredentials) {
    throw new Error(
      'Missing required environment variable: DB_CREDENTIALS'
    );
  }

  try {
    const creds = JSON.parse(dbCredentials);
    if (!creds.username || !creds.password) {
      throw new Error(
        'DB_CREDENTIALS secret must contain both "username" and "password" fields. '
      );
    }

    return {
      user: creds.username,
      password: creds.password,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        'DB_CREDENTIALS is not valid JSON. '
      );
    }
    throw error;
  }
}

/**
 * Application configuration object
 */
const config = {
  // Server — HOST must be set by the environment (use 0.0.0.0 for ECS/ALB).
  port: parseInt(getEnv('PORT', '3002'), 10),
  host: requireEnv('HOST'),
  nodeEnv: getEnv('NODE_ENV', 'development'),

  // Database
  database: {
    host: requireEnv('DB_HOST'),
    port: parseInt(getEnv('DB_PORT', '5432'), 10),
    database: requireEnv('DB_NAME'),
    ...getDbCredentials(),
    max: parseInt(getEnv('DB_POOL_MAX', '10'), 10),
    idleTimeoutMillis: parseInt(getEnv('DB_IDLE_TIMEOUT_MS', '30000'), 10),
    connectionTimeoutMillis: parseInt(getEnv('DB_CONNECTION_TIMEOUT_MS', '5000'), 10),
  },

  // Notify Configuration
  // Provide one of:
  //   - NOTIFY_CALLBACK_BEARER_TOKEN (direct token), or
  //   - NOTIFY_CALLBACK_SECRET_NAME (Secrets Manager name/ARN, or raw token if ECS injects the value)
  notify: {
    secretName: process.env.NOTIFY_CALLBACK_SECRET_NAME,
    secretTtlMs: parseInt(getEnv('NOTIFY_SECRET_TTL_MS', '300000'), 10), // 5 minutes
    fallbackToken: process.env.NOTIFY_CALLBACK_BEARER_TOKEN,
  },

  // AWS Configuration
  aws: {
    region: getEnv('AWS_REGION', 'eu-west-2'),
    endpoint: process.env.AWS_ENDPOINT, // LocalStack
  },

  // Logging
  logDir: getEnv('LOG_DIR', './logs'),
  logLevel: getEnv('LOG_LEVEL', 'info'),
};

export default config;
