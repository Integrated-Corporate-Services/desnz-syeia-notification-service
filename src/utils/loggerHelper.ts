/**
 * Logger Helper
 * Winston logger configuration for structured logging
 */

import winston from 'winston';
import path from 'path';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_DIR = process.env.LOG_DIR || './logs';

// Color scheme for log levels
const LEVEL_COLOURS = {
  error: '\x1b[31m', // red
  warn: '\x1b[33m',  // yellow
  info: '\x1b[36m',  // cyan
  debug: '\x1b[35m', // magenta
};

// Console format with colors (development)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const color = LEVEL_COLOURS[level as keyof typeof LEVEL_COLOURS] || '';
    const reset = '\x1b[0m';
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${color}[${level.toUpperCase()}]${reset} ${message} ${metaStr}`;
  }),
);

// JSON format (production)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

// Create transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Add file transports in production
if (NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: fileFormat,
    }),
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
  exitOnError: false,
});

/**
 * Get logger with module context
 */
export default function getLogger(module: NodeModule): winston.Logger {
  const modulePath = module.filename || 'unknown';
  const moduleName = path.basename(modulePath);

  return logger.child({ module: moduleName });
}

// Export logger instance for direct use
export { logger };
