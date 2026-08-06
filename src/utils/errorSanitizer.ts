/**
 * Error Sanitization Utility
 * Removes sensitive information from error messages before logging/responding
 *
 * Addresses: OWASP A04:2021, CWE-209
 */

const SENSITIVE_PATTERNS = [
  { pattern: /table\s+"([^"]+)"/gi, replacement: 'table "[REDACTED]"' },
  { pattern: /column\s+"([^"]+)"/gi, replacement: 'column "[REDACTED]"' },
  { pattern: /relation\s+"([^"]+)"/gi, replacement: 'relation "[REDACTED]"' },
  { pattern: /constraint\s+"([^"]+)"/gi, replacement: 'constraint "[REDACTED]"' },
  { pattern: /index\s+"([^"]+)"/gi, replacement: 'index "[REDACTED]"' },
  { pattern: /schema\s+"([^"]+)"/gi, replacement: 'schema "[REDACTED]"' },
  { pattern: /host=([^\s,;)]+)/gi, replacement: 'host=[REDACTED]' },
  { pattern: /port=([^\s,;)]+)/gi, replacement: 'port=[REDACTED]' },
  { pattern: /database=([^\s,;)]+)/gi, replacement: 'database=[REDACTED]' },
  { pattern: /user=([^\s,;)]+)/gi, replacement: 'user=[REDACTED]' },
  { pattern: /password=([^\s,;)]+)/gi, replacement: 'password=[REDACTED]' },
  { pattern: /postgres:\/\/[^\s]+/gi, replacement: 'postgres://[REDACTED]' },
  { pattern: /postgresql:\/\/[^\s]+/gi, replacement: 'postgresql://[REDACTED]' },
  { pattern: /\/home\/[^\s]+/gi, replacement: '/[REDACTED]' },
  { pattern: /\/var\/[^\s]+/gi, replacement: '/[REDACTED]' },
  { pattern: /\/usr\/[^\s]+/gi, replacement: '/[REDACTED]' },
  { pattern: /\/etc\/[^\s]+/gi, replacement: '/[REDACTED]' },
  { pattern: /\/\.\.\/[^\s]*/gi, replacement: '/[REDACTED]' },
  { pattern: /C:\\[^\s]+/gi, replacement: 'C:\\[REDACTED]' },
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[IP_REDACTED]' },
  { pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replacement: '[UUID_REDACTED]' },
] as const;

const DATABASE_ERROR_INDICATORS = [
  'duplicate key',
  'foreign key',
  'check constraint',
  'unique constraint',
  'not-null constraint',
  'constraint violation',
  'relation does not exist',
  'column does not exist',
  'table does not exist',
  'relation "',
  'column "',
  'table "',
  'syntax error',
  'permission denied',
  'connection refused',
  'timeout expired',
] as const;

export function sanitizeErrorMessage(
  error: unknown,
  options: { preserveType?: boolean; maxLength?: number } = {}
): string {
  const { preserveType = true, maxLength = 500 } = options;

  let errorMessage: string;

  if (error instanceof Error) {
    errorMessage = preserveType ? `${error.name}: ${error.message}` : error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String((error as { message: unknown }).message);
  } else {
    errorMessage = String(error);
  }

  let sanitized = errorMessage;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...[TRUNC]';
  }

  return sanitized;
}

export function isDatabaseError(error: unknown): boolean {
  const errorStr = String(error).toLowerCase();
  return DATABASE_ERROR_INDICATORS.some(indicator => errorStr.includes(indicator));
}

export function createSanitizedErrorLog(error: unknown): {
  sanitized_message: string;
  error_type: string;
  is_database_error: boolean;
  safe_for_client: boolean;
} {
  const errorType = error instanceof Error ? error.constructor.name : typeof error;
  const isDatabaseErr = isDatabaseError(error);

  return {
    sanitized_message: sanitizeErrorMessage(error),
    error_type: errorType,
    is_database_error: isDatabaseErr,
    safe_for_client: false,
  };
}
