import { it, expect } from 'vitest';
import { createHmac, randomBytes } from 'node:crypto';
import { startFakeServer } from '../../conformance/fake-server/server.js';
import { generateRelayKeys, sealRequest, openReply } from '../src/crypto.js';
import { createRelayServer } from '../src/server.js';
import { createForwarder } from '../src/forward.js';
import { encodeRelayComment, decodeRelayComment } from '../../cli/src/relay.js';
const secret = randomBytes(32).toString('hex');
function webhook(envelope) {
  const body = Buffer.from(JSON.stringify({ action: 'created',
    repository: { full_name: 'test/relay', private: true }, issue: { number: 1 },
    sender: { id: 99 }, comment: { id: 10, user: { id: 99 },
      body: encodeRelayComment('request', envelope) } }));
  return [body, { 'x-github-event': 'issue_comment', 'x-hub-signature-256':
    'sha256=' + createHmac('sha256', secret).update(body).digest('hex') }];
}
it('encrypted server round trip preserves guards, rejects replay and never posts pass', async () => {
  const fake = await startFakeServer(); const keys = generateRelayKeys();
  const ids = new Set(); let forwards = 0; let posted;
  const forward = createForwarder({ servers: { fake: fake.url }, allowLoopback: true });
  const settings = { secret, repo: 'test/relay', bindings: { 1: { actorId: 99, server: 'fake' } },
    privateKey: keys.privateKey, store: { async claim(id) {
      if (ids.has(id)) return false; ids.add(id); return true;
    } }, forward: async request => { forwards++; return forward(request); },
    transportFor: () => ({ async post(kind, envelope) { posted = encodeRelayComment(kind, envelope); } }) };
  const handle = createRelayServer(settings);
  try {
    for (const [tool, pass, expected] of [
      ['fake_read_record', fake.passes.full, true],
      ['fake_delete_record', fake.passes.full, 'confirmation'],
      ['fake_read_record', fake.passes.revoked, 'pass_revoked']]) {
      const sealed = sealRequest({ publicKey: keys.publicKey, server: 'fake', tool, args: {}, pass });
      expect((await handle(...webhook(sealed.request))).status).toBe(200);
      expect(posted).not.toContain(pass);
      const result = openReply(decodeRelayComment('reply', posted), sealed.id, sealed.replyKey);
      if (expected === true) expect(result.ok).toBe(true);
      else if (expected === 'confirmation') expect(result.result.needsConfirmation).toBe(true);
      else expect(result.error.code).toBe(expected);
      const before = forwards;
      expect((await handle(...webhook(sealed.request))).status).toBe(409);
      expect(forwards).toBe(before);
    }
    const sealed = sealRequest({ publicKey: keys.publicKey, server: 'other',
      tool: 'fake_read_record', pass: fake.passes.full });
    expect((await handle(...webhook(sealed.request))).status).toBe(403);
    const failing = createRelayServer({ ...settings, store: { claim: async () => { throw new Error('db'); } } });
    const valid = sealRequest({ publicKey: keys.publicKey, server: 'fake',
      tool: 'fake_read_record', pass: fake.passes.full });
    expect((await failing(...webhook(valid.request))).status).toBe(503);
    expect(forwards).toBe(3);
    valid.request.tag = randomBytes(16).toString('base64url');
    expect((await handle(...webhook(valid.request))).status).toBe(400);
  } finally { await fake.close(); }
});
it('retains claim after a posting failure instead of repeating the write', async () => {
  const keys = generateRelayKeys(); let claimed = false; let calls = 0;
  const handler = createRelayServer({ secret, repo: 'test/relay',
    bindings: { 1: { actorId: 99, server: 'fake' } }, privateKey: keys.privateKey,
    store: { claim: async () => { if (claimed) return false; claimed = true; return true; } },
    forward: async () => { calls++; return { ok: true }; },
    transportFor: () => ({ post: async () => { throw new Error('github'); } }) });
  const sealed = sealRequest({ publicKey: keys.publicKey, server: 'fake', tool: 'fake_write',
    pass: 'rtc_pass_' + randomBytes(32).toString('base64url'), args: { confirm: true } });
  expect((await handler(...webhook(sealed.request))).status).toBe(503);
  expect((await handler(...webhook(sealed.request))).status).toBe(409);
  expect(calls).toBe(1);
});
