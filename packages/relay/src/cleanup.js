import { timingSafeEqual } from 'node:crypto';
import { decodeRelayComment } from '../../cli/src/relay.js';
import { createRelayRuntime } from './runtime.js';
export async function cleanupRelay({ bindings, transportFor, store, now = Date.now() }) {
  let deleted = 0;
  for (const issue of Object.keys(bindings)) {
    const transport = transportFor(Number(issue));
    await transport.checkPrivate();
    const comments = await transport.list();
    for (const comment of comments) {
      const created = Date.parse(comment.createdAt);
      if (!Number.isFinite(created) || created > now - 60 * 60 * 1000) continue;
      const box = decodeRelayComment('request', comment.body) || decodeRelayComment('reply', comment.body);
      if (!box) continue;
      await transport.delete(comment.id);
      deleted++;
    }
  }
  const pruned = await store.prune();
  return { deleted, pruned };
}
function authorized(request, secret) {
  if (typeof secret !== 'string' || secret.length < 32) return false;
  const received = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from('Bearer ' + secret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
export function createCleanupFetch({ env = process.env, getRuntime = createRelayRuntime({ env }) } = {}) {
  return async request => {
    const reply = (status, code, result) => Response.json({ code, ...(result ? { result } : {}) },
      { status, headers: { 'cache-control': 'no-store' } });
    if (request.method !== 'POST') return reply(405, 'method_not_allowed');
    if (!authorized(request, env.RELAY_CLEANUP_SECRET)) return reply(401, 'unauthorized');
    try {
      const runtime = getRuntime();
      const result = await cleanupRelay({ bindings: runtime.settings.bindings,
        transportFor: runtime.transportFor, store: runtime.store });
      return reply(200, 'cleanup_complete', result);
    } catch { return reply(503, 'cleanup_incomplete'); }
  };
}
