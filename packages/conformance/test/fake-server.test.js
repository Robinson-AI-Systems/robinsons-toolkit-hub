import { describe, expect, it } from 'vitest';
import { startFakeServer } from '../fake-server/server.js';

const query = async (url, pass, path, args) => {
  const response = await fetch(url + path, { method: args ? 'POST' : 'GET',
    headers: { authorization: 'Bearer ' + pass, 'content-type': 'application/json' },
    body: args ? JSON.stringify(args) : undefined });
  return { status: response.status, body: await response.json() };
};
describe('RTC reference fake server', () => {
  it('advertises a manifest with four prefixed tools and refuses missing passes', async () => {
    const fake = await startFakeServer();
    try {
      const manifest = await (await fetch(fake.url + '/api/contract')).json();
      expect(manifest).toMatchObject({ rtc: 1, prefix: 'fake', counts: { tools: 4 } });
      const catalog = await query(fake.url, fake.passes.full, '/api/tools');
      expect(catalog.body.result.tools).toHaveLength(4);
      expect((await fetch(fake.url + '/api/whoami')).status).toBe(401);
      expect(fake.passes.full).toMatch(/^rtc_pass_[A-Za-z0-9_-]{43}$/);
    } finally { await fake.close(); }
  });
  it('enforces read-only and confirmation, preserves state on previews, logs writes', async () => {
    const f = await startFakeServer();
    try {
      const write = '/api/tools/fake_delete_record';
      expect((await query(f.url, f.passes.readOnly, write, { confirm: true })).status).toBe(403);
      expect((await query(f.url, f.passes.full, write, { dryRun: true, confirm: true })).body.result.done).toBe(false);
      expect(f.state.value).toBe('original');
      expect((await query(f.url, f.passes.full, write, {})).body.result.needsConfirmation).toBe(true);
      expect(f.state.value).toBe('original');
      const done = await query(f.url, f.passes.full, write, { confirm: true });
      expect(done.body.result).toMatchObject({ confirmed: true, logged: { id: 'fake-3' } });
      expect(f.state.value).toBe('deleted');
    } finally { await f.close(); }
  });
  it('refuses expired and revoked passes, and gives large results an owned handle', async () => {
    const f = await startFakeServer();
    try {
      const path = '/api/tools/fake_read_record';
      expect((await query(f.url, f.passes.expired, path, { detail: 'full' })).body.error.code).toBe('pass_expired');
      expect((await query(f.url, f.passes.revoked, path, { detail: 'full' })).body.error.code).toBe('pass_revoked');
      const big = await query(f.url, f.passes.full, path, { detail: 'full' });
      expect(big.body.handle).toBeTypeOf('string');
      expect((await query(f.url, f.passes.readOnly, '/api/results/' + big.body.handle)).status).toBe(404);
      expect((await query(f.url, f.passes.full, '/api/results/' + big.body.handle)).body.result.payload.length).toBe(9000);
    } finally { await f.close(); }
  });
});
