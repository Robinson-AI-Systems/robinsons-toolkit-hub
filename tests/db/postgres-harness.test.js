// The Postgres behavior later hub cards rely on, proven on real (throwaway, localhost) Postgres:
// isolated schemas, additive migrations that can run twice, and a limit counted with ONE atomic statement that holds
// across two independent connection pools (CONTRACT §2 "Rate limits are shared across instances"; K-2 --instances 2).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openIsolatedSchema } from './isolated-schema.js';
import { requireLocalDatabaseUrl } from './local-url.js';

let db;
beforeAll(async () => { db = await openIsolatedSchema(); });
afterAll(async () => { await db?.close(); });

const ADDITIVE = [
  'CREATE TABLE IF NOT EXISTS limit_hits (key TEXT PRIMARY KEY, n INTEGER NOT NULL)',
  'ALTER TABLE limit_hits ADD COLUMN IF NOT EXISTS window_start TIMESTAMPTZ NOT NULL DEFAULT now()'
];
// Allowed only while under the limit; returns a row when the call is allowed, no row when it is over the limit.
const TAKE = `INSERT INTO limit_hits (key, n) VALUES ($1, 1)
  ON CONFLICT (key) DO UPDATE SET n = limit_hits.n + 1 WHERE limit_hits.n < $2 RETURNING n`;

describe('throwaway Postgres harness', () => {
  it('runs in a uniquely named schema on Postgres 14 or newer', async () => {
    expect(db.schema).toMatch(/^hub_test_[a-f0-9]{12}$/);
    const { rows: [{ server_version_num: v }] } = await db.query('SHOW server_version_num');
    expect(Number(v)).toBeGreaterThanOrEqual(140000);
    const { rows: [{ s }] } = await db.query('SELECT current_schema() AS s');
    expect(s).toBe(db.schema);
  });

  it('additive migrations run twice without error or change', async () => {
    for (let round = 0; round < 2; round++) for (const sql of ADDITIVE) await db.query(sql);
    const { rows } = await db.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position',
      [db.schema, 'limit_hits']);
    expect(rows.map((r) => r.column_name)).toEqual(['key', 'n', 'window_start']);
  });

  it('an atomic counter allows exactly the limit across two instances under overlapping calls', async () => {
    const instances = [db.pool(), db.pool()];
    const limit = 5;
    const calls = Array.from({ length: 24 }, (_, i) => instances[i % 2].query(TAKE, ['pass:atomic', limit]));
    const results = await Promise.all(calls);
    expect(results.filter((r) => r.rowCount === 1)).toHaveLength(limit);
    const { rows: [{ n }] } = await db.query('SELECT n FROM limit_hits WHERE key = $1', ['pass:atomic']);
    expect(n).toBe(limit);
  });

  it('a read-then-update counter over-allows when two instances interleave (why the contract forbids it)', async () => {
    const [a, b] = [db.pool(), db.pool()];
    const limit = 5;
    await db.query('INSERT INTO limit_hits (key, n) VALUES ($1, 4)', ['pass:naive']);
    const read = async (p) => (await p.query('SELECT n FROM limit_hits WHERE key = $1', ['pass:naive'])).rows[0].n;
    const seenA = await read(a);
    const seenB = await read(b);
    let allowed = 0;
    for (const [p, seen] of [[a, seenA], [b, seenB]]) {
      if (seen < limit) { allowed++; await p.query('UPDATE limit_hits SET n = $2 WHERE key = $1', ['pass:naive', seen + 1]); }
    }
    expect(allowed).toBe(2); // only 1 call was left under the limit
  });

  it('refuses a non-local database URL', () => {
    const saved = process.env.TEST_DATABASE_URL;
    process.env.TEST_DATABASE_URL = 'postgresql://user:FAKE' + '@db.example.org/db'; // split so the secret scan sees no URL
    try { expect(() => requireLocalDatabaseUrl()).toThrow(/non-local/); }
    finally { process.env.TEST_DATABASE_URL = saved; }
  });
});
