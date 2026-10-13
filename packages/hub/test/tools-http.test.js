import { it, expect, vi } from 'vitest';
import { handleHubTools } from '../src/tools-http.js';
const actor = { id: 'synthetic', mode: 'test', profile: 'read_only',
  areas: ['gateway'], allowWrites: false };
function response() {
  return { headers: {}, code: 0, body: null,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; } };
}
const withDb = async fn => fn({}, {});
const authorize = vi.fn(async () => ({ actor }));
async function send(route, method, query = {}, body, auth = authorize) {
  const res = response();
  await handleHubTools({ method, query, body, headers: { authorization: 'synthetic' } },
    res, { withDb, authorize: auth }, route);
  return res;
}
it('keeps a fixed and bounded Hub-only search and describe catalog', async () => {
  const found = await send('list', 'GET', { q: 'health', limit: '1' });
  expect(found.code).toBe(200);
  expect(found.body.result.tools.map(x => x.name)).toEqual(['hub_health']);
  expect(found.body.result.next).toBeNull();
  expect((await send('item', 'GET', { name: 'hub_whoami' })).body.result.writes).toBe(false);
  expect((await send('item', 'GET', { name: 'stripe_send_money' })).code).toBe(400);
  expect((await send('item', 'GET', { name: 'hub_unknown' })).code).toBe(404);
  expect((await send('list', 'GET', { limit: '1000' })).code).toBe(400);
});
it('runs only harmless scoped Hub tools and bounded read-only batches', async () => {
  const call = await send('item', 'POST', { name: 'hub_whoami' }, {});
  expect(call.body.result.profile).toBe('read_only');
  const batch = await send('batch', 'POST', {}, { calls: [
    { name: 'hub_whoami', args: {} }, { name: 'hub_health', args: {} }
  ] });
  expect(batch.code).toBe(200);
  expect(batch.body.result.results).toHaveLength(2);
  expect((await send('batch', 'POST', {}, { calls: [
    { name: 'hub_health', args: {} }, { name: 'stripe_send_money' }
  ] })).code).toBe(400);
  expect((await send('batch', 'POST', {}, { calls: Array(11).fill({ name: 'hub_health' }) })).code).toBe(400);
  expect((await send('item', 'POST', { name: 'hub_health' }, { x: 'x'.repeat(9000) })).code).toBe(400);
});
it('denies missing, live, out-of-area and writing actors before any tool result', async () => {
  for (const state of [null, { actor: { ...actor, mode: 'live' } },
    { actor: { ...actor, areas: ['other'] } }, { actor: { ...actor, allowWrites: true } }]) {
    const auth = vi.fn(async () => state);
    expect((await send('list', 'GET', {}, undefined, auth)).code).toBe(state ? 403 : 401);
    expect(auth).toHaveBeenCalledTimes(1);
  }
  const throttled = await send('list', 'GET', {}, undefined,
    vi.fn(async () => ({ retryAfter: 12 })));
  expect(throttled.code).toBe(429);
  expect(throttled.headers['Retry-After']).toBe('12');
});
