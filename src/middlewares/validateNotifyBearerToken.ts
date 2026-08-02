/**
 * Validate Notify Bearer Token Middleware
 * Authenticates incoming callbacks from GOV.UK Notify
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { verifyNotifyBearerToken } from '../services/notifyCallbackService';
import getLogger from '../utils/loggerHelper';
import { HTTP_STATUS, HEADER_AUTHORIZATION, HEADER_CORRELATION_ID } from '../constants/notify.constants';

const logger = getLogger(module);

/**
 * Express middleware for bearer token validation
 */
export async function validateNotifyBearerTokenMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Extract or generate correlation ID
  const correlationId = (req.headers[HEADER_CORRELATION_ID] as string) || uuidv4();
  (req as Request & { correlationId?: string }).correlationId = correlationId;

  const authHeader = req.headers[HEADER_AUTHORIZATION] as string | undefined;

  try {
    const authResult = await verifyNotifyBearerToken(authHeader);

    if (!authResult.authenticated) {
      const statusCode =
        authResult.errorCode === 'MISSING_AUTH_HEADER'
          ? HTTP_STATUS.UNAUTHORIZED
          : HTTP_STATUS.FORBIDDEN;

      logger.warn('[NotifyAuth] Authentication failed', {
        correlationId,
        errorCode: authResult.errorCode,
        statusCode,
      });

      res.status(statusCode).json({
        error: authResult.errorMessage,
        code: authResult.errorCode,
      });
      return;
    }

    logger.debug('[NotifyAuth] Authentication successful', { correlationId });
    next();
  } catch (error) {
    logger.error('[NotifyAuth] Authentication error', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error during authentication',
    });
  }
}
