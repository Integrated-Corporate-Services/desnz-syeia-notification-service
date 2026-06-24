const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
  displayName: 'unit',
  coverageDirectory: '<rootDir>/coverage/unit',
};
