import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import {
  WEBHOOK_RATE_LIMIT,
  HEALTH_CHECK_RATE_LIMIT,
  toExpressRateLimitOptions,
} from '../config/rateLimitConfig';
import getLogger from '../utils/loggerHelper';

const logger = getLogger(module);

export const webhookRateLimiter: RateLimitRequestHandler = rateLimit({
  ...toExpressRateLimitOptions(WEBHOOK_RATE_LIMIT),
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for webhook endpoint', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: WEBHOOK_RATE_LIMIT.message,
      retryAfter: Math.ceil(WEBHOOK_RATE_LIMIT.windowMs / 1000),
    });
  },
});

export const healthCheckRateLimiter: RateLimitRequestHandler = rateLimit({
  ...toExpressRateLimitOptions(HEALTH_CHECK_RATE_LIMIT),
  handler: (req, res) => {
    logger.warn('Rate limit exceeded for health check endpoint', {
      ip: req.ip,
      path: req.path,
    });
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: HEALTH_CHECK_RATE_LIMIT.message,
      retryAfter: Math.ceil(HEALTH_CHECK_RATE_LIMIT.windowMs / 1000),
    });
  },
});


export function createCustomRateLimiter(
  windowMs: number,
  maxRequests: number,
  customMessage?: string,
): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: customMessage || 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: customMessage || 'Too many requests, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
}
