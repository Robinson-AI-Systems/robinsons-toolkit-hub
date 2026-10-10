// Database tests run only against throwaway localhost Postgres (scripts/local-postgres-test.sh) — never a hosted database.
// Copied from Robinson-AI-Systems/neon-mcp tests/db/local-url.js @ d396fb4.
export function requireLocalDatabaseUrl() {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) throw new Error('TEST_DATABASE_URL must point to disposable localhost Postgres (run npm run test:db)');
  const { hostname } = new URL(raw);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) throw new Error('Refusing non-local Postgres in tests');
  return raw;
}
