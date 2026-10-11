import { it, expect, vi } from 'vitest';
import { safeToFallback } from '../src/relay-route.js';
import { httpRequest } from '../src/http.js';
it('retries only safe reads or proved pre-connect write failure', async () => {
  expect(safeToFallback({ cause: { code: 'ECONNREFUSED' } }, 'POST')).toBe(true);
  expect(safeToFallback({ cause: { code: 'ECONNRESET' } }, 'POST')).toBe(false);
  expect(safeToFallback(new Error('timeout'), 'POST')).toBe(false);
  const fallback = vi.fn(async () => ({ ok: true, result: 'relayed' }));
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw Object.assign(new Error('network'), { cause: { code: 'ECONNREFUSED' } }); };
    expect((await httpRequest('https://example.com', 'fake', '/api/tools/fake_read',
      { method: 'POST', args: {}, fallback })).result).toBe('relayed');
    globalThis.fetch = async () => { throw new Error('ambiguous'); };
    await expect(httpRequest('https://example.com', 'fake', '/api/tools/fake_write',
      { method: 'POST', args: {}, fallback })).rejects.toThrow('outcome may be unknown');
    expect(fallback).toHaveBeenCalledTimes(1);
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: { code: 'pass_revoked' } }), { status: 401 });
    await expect(httpRequest('https://example.com', 'fake', '/api/tools/fake_read', { fallback })).rejects.toMatchObject({ exitCode: 5 });
    expect(fallback).toHaveBeenCalledTimes(1);
  } finally { globalThis.fetch = original; }
});
it('CLI traverses fake GitHub and signed encrypted server to real guarded RTC', async () => {
  const { startFakeServer } = await import('../../conformance/fake-server/server.js');
  const { generateRelayKeys, exportRelayPublicKey } = await import('../../relay/src/crypto.js');
  const { createRelayServer } = await import('../../relay/src/server.js');
  const { createForwarder } = await import('../../relay/src/forward.js');
  const { encodeRelayComment } = await import('../src/relay.js');
  const { runCLI } = await import('../src/commands.js');
  const { createHmac, randomBytes } = await import('node:crypto');
  const fake = await startFakeServer(); const keys = generateRelayKeys();
  const secret = randomBytes(32).toString('hex'); const ids = new Set();
  const comments = []; const bodies = []; let next = 1;
  const original = globalThis.fetch;
  const handler = createRelayServer({ secret, repo: 'test/relay',
    bindings: { 1: { actorId: 99, server: 'fake' } }, privateKey: keys.privateKey,
    store: { claim: async id => { if (ids.has(id)) return false; ids.add(id); return true; } },
    forward: createForwarder({ servers: { fake: fake.url }, allowLoopback: true, fetchImpl: original }),
    transportFor: () => ({ post: async (kind, envelope) => {
      const body = encodeRelayComment(kind, envelope); bodies.push(body);
      comments.push({ id: next++, body });
    } }) });
  globalThis.fetch = async (url, options = {}) => {
    const target = new URL(url);
    if (target.hostname !== 'api.github.com')
      throw Object.assign(new Error('blocked'), { cause: { code: 'ENOTFOUND' } });
    if (options.method === 'POST') {
      const data = JSON.parse(options.body); bodies.push(data.body);
      const comment = { id: next++, body: data.body, user: { id: 99 } }; comments.push(comment);
      const raw = Buffer.from(JSON.stringify({ action: 'created', repository: { full_name: 'test/relay', private: true },
        issue: { number: 1 }, sender: { id: 99 }, comment }));
      const result = await handler(raw, { 'x-github-event': 'issue_comment', 'x-hub-signature-256':
        'sha256=' + createHmac('sha256', secret).update(raw).digest('hex') });
      expect(result.status).toBe(200);
      return Response.json(comment);
    }
    if (options.method === 'DELETE') {
      const id = Number(target.pathname.split('/').at(-1));
      comments.splice(comments.findIndex(c => c.id === id), 1);
      return new Response(null, { status: 204 });
    }
    return Response.json(comments);
  };
  try {
    const env = { RTOOL_SERVERS: 'fake=https://blocked.example', RTOOL_PASS_FAKE: fake.passes.full,
      RTOOL_RELAY_TOKEN: randomBytes(32).toString('hex'), RTOOL_RELAY: JSON.stringify({
        repo: 'test/relay', publicKey: exportRelayPublicKey(keys.publicKey), servers: { fake: { issue: 1 } } }) };
    for (const [argv, pass, code] of [
      [['call', 'fake.fake_read_record'], fake.passes.full, 0],
      [['call', 'fake.fake_delete_record'], fake.passes.full, 2],
      [['call', 'fake.fake_write_record', '--confirm'], fake.passes.readOnly, 3],
      [['call', 'fake.fake_read_record'], fake.passes.revoked, 5],
      [['tools', 'fake'], fake.passes.full, 0]]) {
      let out = '', err = '';
      expect(await runCLI(argv, { env: { ...env, RTOOL_PASS_FAKE: pass },
        out: { write: s => { out += s; } }, err: { write: s => { err += s; } },
        keychain: { get: async () => null } })).toBe(code);
      expect(comments).toHaveLength(0);
      expect(out + err).not.toContain(pass);
      expect(err.match(/Using encrypted GitHub relay/g)).toHaveLength(1);
    }
    const { generateSdk } = await import('../src/sdk.js');
    const { mkdtemp, rm, readFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const dir = await mkdtemp(join(tmpdir(), 'relay-sdk-'));
    const saved = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
    try {
      const dest = join(dir, 'sdk');
      await generateSdk({ servers: new Map([['fake', 'https://blocked.example']]), env, name: 'fake', dest });
      Object.assign(process.env, env);
      const sdk = await import(pathToFileURL(join(dest, 'testing.js')).href);
      expect((await sdk.fake_read_record()).ok).toBe(true);
      expect((await readFile(join(dest, '_runtime/relay.js'), 'utf8'))).not.toContain(env.RTOOL_RELAY_TOKEN);
      expect(comments).toHaveLength(0);
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
      await rm(dir, { recursive: true, force: true });
    }
    expect(bodies.every(body => body.startsWith('rtc:v1:'))).toBe(true);
    expect(bodies.join('')).not.toContain(fake.passes.full);
    expect(bodies.join('')).not.toContain('fake_read_record');
  } finally { globalThis.fetch = original; await fake.close(); }
});
