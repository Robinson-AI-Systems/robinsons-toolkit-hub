import { describe, expect, it } from 'vitest';
import { generateRelayKeys, openRequest, sealReply } from '../../relay/src/crypto.js';
import { githubCommentTransport, createEncryptedRelayClient,
  decodeRelayComment } from '../src/relay.js';

describe('GitHub encrypted issue-comment transport', () => {
  const pass = 'rtc_pass_' + 'S'.repeat(43);
  it('posts only ciphertext, reads encrypted reply and deletes both comments', async () => {
    const pair = generateRelayKeys();
    const comments = new Map();
    const calls = [];
    let counter = 10;
    const fakeFetch = async (url, options) => {
      calls.push({ url, method: options.method, body: options.body || '' });
      if (options.method === 'POST') {
        const data = JSON.parse(options.body);
        const id = ++counter;
        comments.set(id, data.body);
        const request = decodeRelayComment('request', data.body);
        const opened = openRequest(request, pair.privateKey);
        expect(opened.pass).toBe(pass);
        expect(opened.tool).toBe('fake_read_record');
        const reply = sealReply(opened.id, opened.replyKey, { ok: true, result: { value: 'done' } });
        comments.set(++counter, 'rtc:v1:reply:' +
          Buffer.from(JSON.stringify(reply)).toString('base64url'));
        return { ok: true, status: 201, json: async () => ({ id }) };
      }
      if (options.method === 'DELETE') {
        comments.delete(Number(url.split('/').at(-1)));
        return { ok: true, status: 204 };
      }
      return { ok: true, status: 200,
        json: async () => [...comments].map(([id, body]) => ({ id, body })) };
    };
    const transport = githubCommentTransport({
      repo: 'Robinson-AI-Systems/relay-private', issue: 2,
      token: 'FAKE_GITHUB_TOKEN', fetchImpl: fakeFetch });
    const client = createEncryptedRelayClient({
      transport, publicKey: pair.publicKey, pollIntervalMs: 0, attempts: 2 });
    const result = await client.execute({ server: 'one', tool: 'fake_read_record', pass });
    expect(result.result.value).toBe('done');
    expect(comments.size).toBe(0);
    expect(calls.filter((x) => x.method === 'DELETE')).toHaveLength(2);
    for (const request of calls) {
      expect(request.body).not.toContain(pass);
      expect(request.url).toMatch(/^https:\/\/api\.github\.com\/repos\/Robinson-AI-Systems\/relay-private/);
    }
  });
  it('cleans up pending request after no matching response and refuses unsafe targets', async () => {
    const keys = generateRelayKeys();
    const deleted = [];
    const transport = {
      post: async () => 12,
      list: async () => [],
      delete: async (id) => { deleted.push(id); }
    };
    const client = createEncryptedRelayClient({ transport, publicKey: keys.publicKey,
      attempts: 1, pollIntervalMs: 0 });
    await expect(client.execute({ server: 'one', tool: 'fake_read', pass })).rejects.toThrow(/timeout/);
    expect(deleted).toEqual([12]);
    expect(() => githubCommentTransport({ repo: 'https://evil.test/a',
      issue: 1, token: 'FAKE' })).toThrow();
  });
});
