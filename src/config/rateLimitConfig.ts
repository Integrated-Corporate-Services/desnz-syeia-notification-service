import { Options } from 'express-rate-limit';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

export const WEBHOOK_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60 * 1000, 
  maxRequests: 200, 
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false, 
};


export const HEALTH_CHECK_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'Too many health check requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
};

export function toExpressRateLimitOptions(
  config: RateLimitOptions,
): Partial<Options> {
  return {
    windowMs: config.windowMs,
    max: config.maxRequests,
    message: config.message,
    standardHeaders: config.standardHeaders,
    legacyHeaders: config.legacyHeaders,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
  };
}
