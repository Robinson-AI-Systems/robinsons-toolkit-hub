import { defineConfig } from 'vitest/config';
// Unit suite: no network, no database. Root tests (repository checks) now; each package's own tests
// (`packages/<pkg>/test`) join automatically as K-2 and later cards add packages.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js', 'packages/*/test/**/*.test.js'],
    exclude: ['**/node_modules/**', 'packages/*/test/db/**'],
    environment: 'node',
    testTimeout: 15000
  }
});
