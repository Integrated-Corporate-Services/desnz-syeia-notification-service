/**
 * Database Connection Management with Automatic Password Rotation
 * Uses DatabasePoolManager for connection pool with credential refresh capability
 */

import { Pool } from 'pg';
import poolManager from './dbPoolManager';
import getLogger from '../utils/loggerHelper';

const logger = getLogger(module);

/**
 * Create PostgreSQL connection pool
 * Now delegates to the DatabasePoolManager which handles credential rotation
 */
export async function createPool(): Promise<Pool> {
  logger.info('[Database] Initializing connection pool via DatabasePoolManager');
  return await poolManager.getPool();
}

/**
 * Get existing pool instance
 */
export async function getPool(): Promise<Pool> {
  return await poolManager.getPool();
}

/**
 * Close database pool (graceful shutdown)
 */
export async function closePool(): Promise<void> {
  logger.info('[Database] Closing connection pool');
  await poolManager.closePool();
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
    const currentPool = await getPool();
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
