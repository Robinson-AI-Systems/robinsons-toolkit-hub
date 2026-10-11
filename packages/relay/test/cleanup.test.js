import { it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { cleanupRelay, createCleanupFetch } from '../src/cleanup.js';
import { encodeRelayComment } from '../../cli/src/relay.js';
it('deletes only aged relay ciphertext, then prunes IDs', async () => {
  const now = Date.now(), deleted = []; let checked = false, pruned = false;
  const box = { v: 1, id: 'test', ciphertext: 'encrypted' };
  const body = encodeRelayComment('reply', box);
  const old = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const transport = { checkPrivate: async () => { checked = true; },
    list: async () => [ { id: 1, body, createdAt: old },
      { id: 2, body, createdAt: new Date(now).toISOString() },
      { id: 3, body: 'unrelated issue discussion', createdAt: old },
      { id: 4, body, createdAt: 'invalid' } ],
    delete: async id => { expect(checked).toBe(true); deleted.push(id); } };
  const result = await cleanupRelay({ now, bindings: { 1: {} }, transportFor: () => transport,
    store: { prune: async () => { pruned = true; return 3; } } });
  expect(deleted).toEqual([1]); expect(pruned).toBe(true);
  expect(result).toEqual({ deleted: 1, pruned: 3 });
});
it('fails closed on public repository or deletion/list failure', async () => {
  const handle = cleanupRelay({ bindings: { 1: {} },
    transportFor: () => ({ checkPrivate: async () => { throw new Error('public'); } }),
    store: { prune: async () => { throw new Error('must not get here'); } } });
  await expect(handle).rejects.toThrow('public');
});
it('authenticates cleanup independently and isolates missing settings', async () => {
  const secret = randomBytes(32).toString('hex'); let runtimes = 0;
  const env = { RELAY_CLEANUP_SECRET: secret };
  const handler = createCleanupFetch({ env, getRuntime: () => { runtimes++; throw new Error('unset'); } });
  const req = (method, authorization) => new Request('https://example.com/api/relay/cleanup',
    { method, headers: { authorization } });
  expect((await handler(req('GET', 'Bearer ' + secret))).status).toBe(405);
  expect((await handler(req('POST', 'wrong'))).status).toBe(401); expect(runtimes).toBe(0);
  expect((await handler(req('POST', 'Bearer ' + secret))).status).toBe(503); expect(runtimes).toBe(1);
});
