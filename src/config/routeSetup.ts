import { Express, Request, Response } from 'express';
import notifyCallbackRoutes from '../routes/notifyCallback';
import { HTTP_STATUS } from '../constants/notify.constants';
import { checkDatabaseConnectivity } from '../database/db';

export function registerRoutes(app: Express): void {
  app.use('/notify-callback', notifyCallbackRoutes);

  app.get('/health', async (req: Request, res: Response) => {
    const health: {
      status: string;
      service: string;
      timestamp: string;
      checks: {
        database?: {
          status: string;
          latency_ms?: number;
          error?: string;
        };
      };
    } = {
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
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(health);
    }

    res.json(health);
  });
}
