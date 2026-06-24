const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  displayName: 'integration',
  coverageDirectory: '<rootDir>/coverage/integration',
  testTimeout: 30000, // Integration tests may take longer
};
