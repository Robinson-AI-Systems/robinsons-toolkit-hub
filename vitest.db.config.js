import { defineConfig } from 'vitest/config';
// Database suite: throwaway localhost Postgres only (scripts/local-postgres-test.sh sets TEST_DATABASE_URL).
// Copied from Robinson-AI-Systems/neon-mcp vitest.db.config.js @ d396fb4; packages add `packages/<pkg>/test/db/`.
export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.js', 'packages/*/test/db/**/*.test.js'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false
  }
});
