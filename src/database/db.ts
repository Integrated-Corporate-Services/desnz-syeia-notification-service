/**
 * Database Connection Management
 * PostgreSQL connection pool
 */

import { Pool } from 'pg';
import config from '../config/config';
import getLogger from '../utils/loggerHelper';
import { createSanitizedErrorLog } from '../utils/errorSanitizer';

const logger = getLogger(module);

let pool: Pool | null = null;

/**
 * RDS requires SSL. Disable only for local/dev when SSLMODE=disable or NODE_ENV=local.
 */
function buildSslConfig(): false | { rejectUnauthorized: boolean } {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  const sslMode = (process.env.SSLMODE || '').toLowerCase();

  if (nodeEnv === 'local' || sslMode === 'disable') {
    return false;
  }

  return { rejectUnauthorized: false };
}

/**
 * Create PostgreSQL connection pool
 */
export function createPool(): Pool {
  if (pool) {
    return pool;
  }

  const ssl = buildSslConfig();

  logger.info('[Database] Creating connection pool', {
    max: config.database.max,
    ssl: Boolean(ssl),
  });

  pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    max: config.database.max,
    idleTimeoutMillis: config.database.idleTimeoutMillis,
    connectionTimeoutMillis: config.database.connectionTimeoutMillis,
    ssl,
  });

  // Connection event handlers
  pool.on('connect', () => {
    logger.debug('[Database] Pool connection established');
  });

  pool.on('error', (err) => {
    const sanitizedError = createSanitizedErrorLog(err);
    logger.error('[Database] Pool error', {
      error_message: sanitizedError.sanitized_message,
      error_type: sanitizedError.error_type,
    });
  });

  return pool;
}

/**
 * Get existing pool instance
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call createPool() first.');
  }
  return pool;
}

/**
 * Close database pool (graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    logger.info('[Database] Closing connection pool');
    await pool.end();
    pool = null;
    logger.info('[Database] Connection pool closed');
  }
}

/**
 * Check database connectivity
 */
export async function checkDatabaseConnectivity(): Promise<{
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    const currentPool = getPool();
    await currentPool.query('SELECT 1');
    const latencyMs = Date.now() - start;

    logger.debug('[Database] Connectivity check passed', { latencyMs });

    return { connected: true, latencyMs };
  } catch (error) {
    const sanitizedError = createSanitizedErrorLog(error);
    logger.error('[Database] Connectivity check failed', {
      error_message: sanitizedError.sanitized_message,
      error_type: sanitizedError.error_type,
    });

    // Return sanitized message — health endpoints may expose this field
    return { connected: false, error: sanitizedError.sanitized_message };
  }
}
