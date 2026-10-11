import { describe, it, expect } from 'vitest';
import { randomBytes, createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { verifyWebhook, parseWebhook, readRawBody, MAX_WEBHOOK_BYTES } from '../src/webhook.js';
import { encodeRelayComment } from '../../cli/src/relay.js';
const secret = randomBytes(32).toString('hex');
const settings = { secret, repo: 'test/relay', bindings: { 1: { actorId: 99, server: 'fake' } } };
const data = () => ({ action: 'created', repository: { full_name: 'test/relay', private: true },
  issue: { number: 1 }, sender: { id: 99 }, comment: { id: 10, user: { id: 99 },
    body: encodeRelayComment('request', { v: 1, id: 'test', ciphertext: 'encrypted' }) } });
function parsed(value, extra = {}) {
  const body = Buffer.from(JSON.stringify(value));
  const headers = { 'x-github-event': 'issue_comment', 'x-hub-signature-256':
    'sha256=' + createHmac('sha256', secret).update(body).digest('hex'), ...extra };
  return parseWebhook(body, headers, settings);
}
describe('signed webhook boundary', () => {
  it('accepts only original raw bytes', () => {
    const body = Buffer.from('bytes');
    const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyWebhook(body, sig, secret)).toBe(true);
    for (const value of [undefined, '', sig + 'a', sig.toUpperCase()])
      expect(verifyWebhook(body, value, secret)).toBe(false);
    expect(verifyWebhook(Buffer.from('Bytes'), sig, secret)).toBe(false);
  });
  it('enforces private repo, actor and issue bindings', () => {
    expect(parsed(data()).issue).toBe(1);
    for (const mutate of [x => x.repository.private = false,
      x => x.repository.full_name = 'other/relay', x => x.issue.number = 2,
      x => x.comment.user.id = 100, x => x.sender.id = 100,
      x => x.issue.pull_request = {}, x => x.comment.id = -1]) {
      const event = data(); mutate(event);
      expect(parsed(event).status).toBe(403);
    }
    expect(parsed(data(), { 'x-hub-signature-256': '' }).status).toBe(401);
    expect(parsed(data(), { 'x-github-event': 'push' }).status).toBe(202);
    expect(parsed({ ...data(), action: 'edited' }).status).toBe(202);
  });
  it('caps streamed bodies and refuses pre-parsed JSON', async () => {
    const stream = Readable.from([Buffer.from('hello')]); stream.headers = {};
    expect((await readRawBody(stream)).toString()).toBe('hello');
    await expect(readRawBody({ headers: {}, body: {} })).rejects.toThrow('raw_body');
    await expect(readRawBody({ headers: {}, body: Buffer.alloc(MAX_WEBHOOK_BYTES + 1) }))
      .rejects.toThrow('raw_body');
  });
});
