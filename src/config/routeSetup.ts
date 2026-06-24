/**
 * Route Setup
 * Registers application routes
 */

import { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { createNotifyCallbackRoutes } from '../routes/notifyCallback';
import { checkDatabaseConnectivity } from '../database/db';
import { HTTP_STATUS } from '../constants/notify.constants';
import getLogger from '../utils/loggerHelper';

const logger = getLogger(module);

/**
 * Register all application routes
 */
export function registerRoutes(app: Express, pool: Pool): void {
  logger.info('[Routes] Registering routes');

  // Notify callback routes
  app.use('/callbacks/notify', createNotifyCallbackRoutes(pool));

  // Global health check
  app.get('/health', async (_req: Request, res: Response) => {
    const health: any = {
      status: 'healthy',
      service: 'notify-callback-service',
      timestamp: new Date().toISOString(),
      checks: {},
    };

    try {
      const dbCheck = await checkDatabaseConnectivity();
      health.checks.database = {
        status: dbCheck.connected ? 'up' : 'down',
        latency_ms: dbCheck.latencyMs,
      };

      if (dbCheck.error) {
        health.checks.database.error = dbCheck.error;
      }

      if (!dbCheck.connected) {
        health.status = 'unhealthy';
        return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(health);
      }
    } catch (error) {
      health.status = 'unhealthy';
      health.checks.database = {
        status: 'down',
        error: error instanceof Error ? error.message : String(error),
      };

      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(health);
    }

    return res.status(HTTP_STATUS.OK).json(health);
  });

  logger.info('[Routes] Routes registered successfully');
}
