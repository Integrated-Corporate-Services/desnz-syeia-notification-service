/**
 * Error Handler
 * Global error handling middleware
 */

import { Express, Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '../constants/notify.constants';
import getLogger from '../utils/loggerHelper';

const logger = getLogger(module);

/**
 * Register error handlers
 */
export function registerErrorHandler(app: Express): void {
  logger.info('[ErrorHandler] Registering error handlers');

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found',
    });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    const correlationId = (req as any).correlationId || 'unknown';

    logger.error('[ErrorHandler] Unhandled error', {
      correlationId,
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  });

  logger.info('[ErrorHandler] Error handlers registered successfully');
}
