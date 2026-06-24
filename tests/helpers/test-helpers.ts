/**
 * Test Helper Functions
 * Utility functions for setting up and tearing down tests
 */

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a test bearer token
 */
export function generateTestBearerToken(): string {
  return 'test-notify-bearer-token-for-tests-min-32-characters-long';
}

/**
 * Create Authorization header for tests
 */
export function createAuthHeader(token?: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${token || generateTestBearerToken()}`,
  };
}

/**
 * Create a test correlation ID
 */
export function generateCorrelationId(): string {
  return `test-correlation-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
