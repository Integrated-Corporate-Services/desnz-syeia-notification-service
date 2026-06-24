// Logger utility with Winston and file transports (matching backend patterns)
import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import config from '../config/config';
import { getRequestContext } from '../middlewares/requestContext';

interface LogData {
  [key: string]: unknown;
}

interface Logger {
  info: (message: string, data?: LogData) => void;
  error: (message: string, data?: LogData) => void;
  warn: (message: string, data?: LogData) => void;
  debug: (message: string, data?: LogData) => void;
}

const isCloudEnv = ['prod', 'production', 'pre-prod', 'staging', 'dev', 'development'].includes(
  process.env.NODE_ENV || ''
);

const isProdEnv = ['prod', 'production'].includes(process.env.NODE_ENV || '');

const logLevel = config.logLevel || process.env.LOG_LEVEL || (isCloudEnv ? 'info' : 'debug');

// Create Winston logger instance
const winstonLogger: WinstonLogger = createLogger({
  level: logLevel,
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message, module, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
      return `${timestamp} [${level}] [${module || 'unknown'}] ${message}${metaStr}`;
    })
  ),
  transports: []
});

// Add file transports only for local/non-cloud environments
if (!isCloudEnv) {
  winstonLogger.add(new transports.File({ filename: 'logs/error.log', level: 'error' }));
  winstonLogger.add(new transports.File({ filename: 'logs/combined.log' }));
}

// Always add console transport
if (isCloudEnv) {
  winstonLogger.add(new transports.Console({
    format: format.combine(
      format.timestamp(),
      format.json()
    ),
  }));
} else {
  winstonLogger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.printf(({ timestamp, level, message, module, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `${timestamp} [${level}] [${module || 'unknown'}] ${message}${metaStr}`;
      })
    ),
  }));
}

/**
 * Filter sensitive fields based on environment
 * In production: Hide detailed technical info
 * In lower environments: Show everything for debugging
 */
function filterByEnvironment(data: Record<string, unknown>): Record<string, unknown> {
  if (!isProdEnv) {
    // Lower environments: show everything
    return data;
  }

  // Production: Remove potentially sensitive technical details
  const filtered = { ...data };
  delete filtered.stack;
  delete filtered.rawBody;
  return filtered;
}

/**
 * Get logger with module context
 */
function getLogger(module: NodeModule): Logger {
  const modulePath = module.filename || 'unknown';
  const moduleName = modulePath.split(/[\\/]/).pop() || 'unknown';

  return {
    info: (message: string, data?: LogData) => {
      const context = getRequestContext();
      winstonLogger.info(message, {
        module: moduleName,
        ...filterByEnvironment({ ...data, ...context } as Record<string, unknown>),
      });
    },
    error: (message: string, data?: LogData) => {
      const context = getRequestContext();
      winstonLogger.error(message, {
        module: moduleName,
        ...filterByEnvironment({ ...data, ...context } as Record<string, unknown>),
      });
    },
    warn: (message: string, data?: LogData) => {
      const context = getRequestContext();
      winstonLogger.warn(message, {
        module: moduleName,
        ...filterByEnvironment({ ...data, ...context } as Record<string, unknown>),
      });
    },
    debug: (message: string, data?: LogData) => {
      const context = getRequestContext();
      winstonLogger.debug(message, {
        module: moduleName,
        ...filterByEnvironment({ ...data, ...context } as Record<string, unknown>),
      });
    },
  };
}

export default getLogger;

// Export winston instance for direct use if needed
export { winstonLogger };
