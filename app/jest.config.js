/** Jest configuration for the ViroVision app (jest-expo preset). */
module.exports = {
  preset: 'jest-expo',
  // Mirror the TS path alias from tsconfig.json so tests can import via `@/…`.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
