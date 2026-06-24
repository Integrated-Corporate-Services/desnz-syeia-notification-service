/**
 * Application Configuration
 * Centralized configuration management
 */

import dotenv from 'dotenv';
import path from 'path';

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

/**
 * Application configuration object
 */
const config = {
  // Server
  port: parseInt(getEnv('PORT', '3002'), 10),
  host: getEnv('HOST', 'localhost'),
  nodeEnv: getEnv('NODE_ENV', 'development'),

  // Database
  database: {
    connectionString: requireEnv('DATABASE_URL'),
    max: parseInt(getEnv('DB_POOL_MAX', '10'), 10),
    idleTimeoutMillis: parseInt(getEnv('DB_IDLE_TIMEOUT_MS', '30000'), 10),
    connectionTimeoutMillis: parseInt(getEnv('DB_CONNECTION_TIMEOUT_MS', '5000'), 10),
  },

  // Notify Configuration
  notify: {
    secretName: getEnv('NOTIFY_CALLBACK_SECRET_NAME', 'notify/callback-bearer-token'),
    secretTtlMs: parseInt(getEnv('NOTIFY_SECRET_TTL_MS', '300000'), 10), // 5 minutes
    fallbackToken: process.env.NOTIFY_CALLBACK_BEARER_TOKEN, // Development fallback only
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
