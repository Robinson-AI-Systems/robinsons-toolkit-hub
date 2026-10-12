import { createHmac, randomBytes } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { createWebhookFetch, preflightSignedWebhook } from '../src/handler.js';

const secret = randomBytes(32).toString('hex');
const url = 'https://relay.example.com/api/relay/github';
const send = async (fn, payload, options = {}) => {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(raw).digest('hex');
  return fn(new Request(url, { method: 'POST',
    headers: { 'x-github-event': options.event || 'issue_comment',
      'x-hub-signature-256': 'sha256=' +
        (options.invalid ? (signature[0] === 'a' ? 'b' : 'a') + signature.slice(1) : signature) },
    body: raw }));
};

describe('D-4 signed harmless ingress without activating custom service', () => {
  it('accepts signed inert edited event while refusing forged signatures before runtime', async () => {
    let runtimeCalls = 0;
    const handler = createWebhookFetch(() => { runtimeCalls++; throw Error('not configured'); },
      { secret });
    const ignored = await send(handler, { action: 'edited', issue: { number: 0 } });
    expect(ignored.status).toBe(202);
    expect(await ignored.json()).toEqual({ code: 'ignored' });
    const denied = await send(handler, { action: 'edited', issue: { number: 0 } },
      { invalid: true });
    expect(denied.status).toBe(401);
    expect(await denied.json()).toEqual({ code: 'invalid_signature' });
    expect(runtimeCalls).toBe(0);
  });
  it('never routes signed created events without the full guarded runtime', async () => {
    let calls = 0;
    const handler = createWebhookFetch(() => { calls++; throw Error('no RTC bindings'); },
      { secret });
    const created = await send(handler, { action: 'created', issue: { number: 1 },
      repository: { full_name: 'owner/relay', private: true } });
    expect(created.status).toBe(503);
    expect(await created.json()).toEqual({ code: 'relay_not_configured' });
    expect(calls).toBe(1);
    const denied = await send(handler, { action: 'created' }, { invalid: true });
    expect(denied.status).toBe(401);
    expect(calls).toBe(1);
  });
  it('checks raw signature prior to JSON parsing and ignores signed other event types', async () => {
    let calls = 0;
    const fn = createWebhookFetch(() => { calls++; throw Error(); }, { secret });
    expect((await send(fn, '{"invalid":', { invalid: true })).status).toBe(401);
    expect((await send(fn, '{"invalid":')).status).toBe(400);
    const response = await send(fn, { action: 'created' }, { event: 'push' });
    expect(response.status).toBe(202);
    expect(calls).toBe(0);
  });
  it('retains 405 and cap checks and fails closed without signing secret', async () => {
    const broken = createWebhookFetch(() => { throw Error(); }, { secret: undefined });
    // Explicit null prevents the default secret getter from enabling preflight.
    const absent = createWebhookFetch(() => { throw Error(); }, { secret: null });
    const reply = await send(absent, { action: 'edited' });
    expect(reply.status).toBe(503);
    const method = await broken(new Request(url, { method: 'GET' }));
    expect(method.status).toBe(405);
    const big = await send(createWebhookFetch(() => { throw Error(); }, { secret }),
      'x'.repeat(512 * 1024 + 1));
    expect(big.status).toBe(413);
  });
  it('preflight cannot treat unsigned created events as harmless', () => {
    const body = Buffer.from(JSON.stringify({ action: 'created' }));
    expect(preflightSignedWebhook(body, {}, secret)).toEqual({
      status: 401, body: { code: 'invalid_signature' } });
  });
});
