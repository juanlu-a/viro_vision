/** Jest configuration for the ViroVision app (jest-expo preset). */
module.exports = {
  preset: 'jest-expo',
  // Mirror the TS path alias from tsconfig.json so tests can import via `@/…`.
  moduleNameMapper: {
    // El CSS va primero: `@/global.css` matchearía también la regla de alias de abajo.
    '\\.css$': '<rootDir>/jest/styleMock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
