import { it, expect } from 'vitest';
import { relayHttpRoute } from '../src/routes.js';
import { startFakeServer } from '../../conformance/fake-server/server.js';
import { createForwarder } from '../src/forward.js';
it('accepts exact RTC paths and refuses cross-origin/path/query escapes', () => {
  for (const path of ['/api/contract', '/api/whoami', '/api/tools?q=record&limit=20',
    '/api/tools/fake_read_record', '/api/results/abc?page=1'])
    expect(relayHttpRoute({ path, method: 'GET' }).path).toBe(path);
  for (const path of ['https://evil.test/api/tools', '//evil.test/api/tools', '/api/oauth/token',
    '/api/tools/../contract', '/api/tools/%2e%2e', '/api/tools?pass=secret',
    '/api/tools?q=a&q=b', '/api/contract#fragment'])
    expect(() => relayHttpRoute({ path, method: 'GET' })).toThrow();
  expect(() => relayHttpRoute({ path: '/api/whoami', method: 'POST', body: {} })).toThrow();
});
it('relays real manifest, catalog, guarded batch and results doors', async () => {
  const fake = await startFakeServer();
  try {
    const forward = createForwarder({ servers: { fake: fake.url }, allowLoopback: true });
    const call = args => forward({ server: 'fake', tool: 'rtc.http', args, pass: fake.passes.full });
    expect((await call({ path: '/api/contract', method: 'GET' })).result.rtc).toBe(1);
    expect((await call({ path: '/api/tools?q=record', method: 'GET' })).ok).toBe(true);
    expect((await call({ path: '/api/tools/_batch', method: 'POST',
      body: { calls: [{ name: 'fake_read_record', args: {} }] } })).ok).toBe(true);
    const large = await call({ path: '/api/tools/fake_read_record', method: 'POST', body: { detail: 'full' } });
    expect(large.handle).toBeTruthy();
    expect((await call({ path: '/api/results/' + large.handle, method: 'GET' })).ok).toBe(true);
  } finally { await fake.close(); }
});
