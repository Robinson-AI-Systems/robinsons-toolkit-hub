import { it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { generateRelayKeys } from '../src/crypto.js';
import { relaySettings, createRelayRuntime } from '../src/runtime.js';
import { createWebhookHandler } from '../src/handler.js';
function settings() {
  const fakeSecret = randomBytes(32).toString('hex');
  const fakePrivateKey = generateRelayKeys().privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  return { RELAY_REPOSITORY: 'test/relay', RELAY_WEBHOOK_SECRET: fakeSecret,
    RELAY_GITHUB_TOKEN: randomBytes(32).toString('hex'),
    RELAY_PRIVATE_KEY: fakePrivateKey,
    RELAY_SERVERS: JSON.stringify({ fake: 'https://example.com' }),
    RELAY_BINDINGS: JSON.stringify({ 1: { actorId: 99, server: 'fake' } }),
    RELAY_DATABASE_URL: 'postgresql://fake@example.com/relay?sslmode=require' };
}
it('requires every owner setting and refuses unsafe scope', () => {
  const env = settings();
  expect(relaySettings(env).repo).toBe('test/relay');
  for (const key of Object.keys(env)) expect(() => relaySettings({ ...env, [key]: '' })).toThrow();
  for (const patch of [ { RELAY_SERVERS: '{"fake":"http://example.com"}' },
    { RELAY_BINDINGS: '{"1":{"actorId":99,"server":"unknown"}}' },
    { RELAY_DATABASE_URL: 'postgresql://fake@example.com/relay' } ])
    expect(() => relaySettings({ ...env, ...patch })).toThrow();
});
it('is lazy, reuses one pool and isolates missing configuration', async () => {
  let pools = 0;
  const runtime = createRelayRuntime({ env: settings(), poolFactory: () => {
    pools++; return { query: async () => ({ rowCount: 1 }), end: async () => {} };
  } });
  expect(pools).toBe(0); expect(runtime()).toBe(runtime()); expect(pools).toBe(1);
  await runtime().close();
  const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(v) { this.body = v; } };
  await createWebhookHandler(createRelayRuntime({ env: {} }))({ method: 'POST' }, response);
  expect(response.statusCode).toBe(503); expect(response.body).toContain('relay_not_configured');
  await createWebhookHandler(runtime)({ method: 'GET' }, response);
  expect(response.statusCode).toBe(405);
});
it('Web signature passes original JSON bytes without platform parsing', async () => {
  const { createWebhookFetch } = await import('../src/handler.js');
  let observed;
  const handler = createWebhookFetch(() => ({ handle: async (body, headers) => {
    observed = [body, headers]; return { status: 200, body: { code: 'checked' } };
  } }));
  const source = '{ "spacing":  1 }';
  const response = await handler(new Request('https://example.com/api/relay/github', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'signature' },
    body: source }));
  expect(observed[0].toString()).toBe(source);
  expect(observed[1]['x-hub-signature-256']).toBe('signature');
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
});
