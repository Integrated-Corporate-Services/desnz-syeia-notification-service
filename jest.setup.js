// Jest Setup - Runs before all tests
// Sets up test environment variables

process.env.NODE_ENV = 'test';
process.env.PORT = '3002';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5435/syeia_db_test';

// AWS Configuration (LocalStack)
process.env.AWS_REGION = 'eu-west-2';
process.env.AWS_ENDPOINT = 'http://localhost:4567';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

// Notify Configuration
process.env.NOTIFY_CALLBACK_SECRET_NAME = 'notify/callback-bearer-token';
process.env.NOTIFY_SECRET_TTL_MS = '300000';
// codeql[js/hardcoded-credentials] - Intentional test credentials
process.env.NOTIFY_CALLBACK_BEARER_TOKEN = 'test-notify-bearer-token-for-tests-min-32-characters-long';

process.env.LOG_LEVEL = 'error'; // Reduce noise during tests
