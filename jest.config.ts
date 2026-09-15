export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  // Les clients @mairie360/*-api-openapi sont publiés en TypeScript ESM (orval) : ts-jest doit les compiler
  // pour que les tests d'intégration passent par le vrai client HTTP. Leurs déclarations ne sont pas vérifiées, ni
  // src/clients/coreClient.ts : sous ts-jest, axios y est typé à la fois via index.d.ts et index.d.cts (TS2345 sur
  // getCoreApi) alors que `npm run build` (tsc) le vérifie sans erreur.
  transform: { '^.+\\.ts$': ['ts-jest', { diagnostics: { exclude: ['**/node_modules/**', '**/src/clients/coreClient.ts'] } }] },
  transformIgnorePatterns: ['/node_modules/(?!@mairie360/)'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageReporters: ['text-summary', 'lcov'],
  coverageThreshold: {
    global: { branches: 60, functions: 60, lines: 60, statements: 60 },
  },
};
