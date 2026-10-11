import { beforeAll, afterAll, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { openIsolatedSchema } from './isolated-schema.js';
import { createReplayStore } from '../../packages/relay/src/store.js';
let db, first, second;
beforeAll(async () => {
  db = await openIsolatedSchema();
  const sql = await readFile(new URL('../../packages/relay/migrations/001-relay-seen.sql', import.meta.url), 'utf8');
  await db.query(sql);
  first = createReplayStore(db.pool()); second = createReplayStore(db.pool());
});
afterAll(async () => { await db?.close(); });
it('atomically claims a replay ID across independent server pools', async () => {
  const id = randomUUID();
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? first : second).claim(id)));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(await first.claim(randomUUID())).toBe(true);
  expect(await second.claim(id)).toBe(false);
  const rows = await db.query('SELECT * FROM relay_seen');
  expect(rows.rows).toHaveLength(2);
  expect(Object.keys(rows.rows[0]).sort()).toEqual(['request_id', 'seen_at']);
});
it('prunes only IDs well outside request lifetime', async () => {
  const id = randomUUID(); await first.claim(id);
  await db.query("UPDATE relay_seen SET seen_at = now() - interval '2 days' WHERE request_id = $1", [id]);
  expect(await second.prune()).toBe(1);
  expect(await second.claim(id)).toBe(true);
});
it('fails closed when replay storage is unavailable', async () => {
  const broken = createReplayStore({ query: async () => { throw new Error('unavailable'); } });
  await expect(broken.claim(randomUUID())).rejects.toThrow('unavailable');
});
