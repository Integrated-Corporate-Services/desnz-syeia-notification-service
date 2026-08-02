/**
 * Database Connection Management
 * PostgreSQL connection pool
 */

import { Pool } from 'pg';
import config from '../config/config';
import getLogger from '../utils/loggerHelper';

const logger = getLogger(module);

let pool: Pool | null = null;

/**
 * Create PostgreSQL connection pool
 */
export function createPool(): Pool {
  if (pool) {
    return pool;
  }

  logger.info('[Database] Creating connection pool', {
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    max: config.database.max,
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
  });

  // Connection event handlers
  pool.on('connect', () => {
    logger.debug('[Database] Pool connection established');
  });

  pool.on('error', (err) => {
    logger.error('[Database] Pool error', {
      error: err.message,
      stack: err.stack,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Database] Connectivity check failed', { error: errorMessage });

    return { connected: false, error: errorMessage };
  }
}
