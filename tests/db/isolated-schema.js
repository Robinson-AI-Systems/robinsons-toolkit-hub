// Throwaway schema per test file on the throwaway localhost Postgres, so files never see each other's tables.
// Later cards (D-3 relay_seen, H-2 hub_servers, K-2 two-instance rate-limit check) build their db tests on this.
import crypto from 'node:crypto';
import pg from 'pg';
import { requireLocalDatabaseUrl } from './local-url.js';

/**
 * Creates a uniquely named schema and returns { url, schema, pool(), query(), close() }.
 * `pool()` opens an extra, independent connection pool already pointed at the schema — the stand-in for a second
 * serverless instance sharing one database.
 */
export async function openIsolatedSchema() {
  const url = requireLocalDatabaseUrl();
  const schema = `hub_test_${crypto.randomBytes(6).toString('hex')}`;
  const pools = [];
  const pool = () => {
    const p = new pg.Pool({ connectionString: url, max: 10, options: `-c search_path=${schema}` });
    pools.push(p);
    return p;
  };
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const main = pool();
  return {
    url,
    schema,
    pool,
    query: (text, params) => main.query(text, params),
    async close() {
      await Promise.all(pools.map((p) => p.end()));
      try { await admin.query(`DROP SCHEMA "${schema}" CASCADE`); } finally { await admin.end(); }
    }
  };
}
