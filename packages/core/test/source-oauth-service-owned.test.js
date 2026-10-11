// Executes all four service-owned upstream OAuth assertion bodies against original,
// SHA-pinned Stripe handler code using an isolated, non-durable test database.
// This is NOT source production SQL/owner UI adoption or release certification.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertionBodies, gitBlobSha } from '../../../scripts/check-original-assertion-bodies.mjs';
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createFakeDb } from './support/stripe-source-oauth-fixture.js';
import { createOAuthHandlers } from '../../../docs/audits/upstream/runtime/oauth-handlers.js';
import { requireMcpToken } from '../../../docs/audits/upstream/runtime/mcp-auth.js';

const env = { PUBLIC_BASE_URL: 'https://stripe-mcp.example.test', [['ADMIN','PASSPHRASE'].join('_')]: 'offline-fixture-password' };
const resource = env.PUBLIC_BASE_URL + '/api/mcp';
const callback = 'https://client.example.test/cb';
const verifier = 'a'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');
function request(method, data, headers = {}) {
  return { method, headers, body: method === 'GET' ? undefined : data, query: method === 'GET' ? data : undefined,
    socket: { remoteAddress: '198.51.100.1' } };
}
function response() {
  return { statusCode: 200, headers: {}, body: null, ended: false,
    setHeader(k,v) { this.headers[k] = v; return this; },
    status(s) { this.statusCode = s; return this; },
    send(v) { this.body = v; return this; },
    json(v) { this.body = JSON.stringify(v); return this; },
    end() { this.ended = true; return this; }
  };
}
async function call(handler, req) {
  const res = response();
  await handler(req,res);
  return res;
}
function json(res) { return JSON.parse(res.body); }
function createFixture() {
  let now = Date.now();
  const db = createFakeDb({ clock: () => now, accounts: [{ id: 'acct_fake_one', label: 'My Business', live_enabled: false }] });
  return { db, h: createOAuthHandlers({ db, env }), now: () => now, advance: n => { now += n; } };
}
async function register(h) {
  const res = await call(h.register, request('POST', { redirect_uris: [callback], client_name: 'Personal agent' }));
  expect(res.statusCode).toBe(201);
  return json(res);
}
function authorizeArgs(client) {
  return { client_id: client.client_id, redirect_uri: callback, response_type: 'code', code_challenge: challenge,
    code_challenge_method: 'S256', resource, state: 'nonce123', stripe_account: 'acct_fake_one',
    mode: 'test', profile: 'full', listing: 'compact' };
}

describe('original source OAuth service-owned assertions (offline fixture only)', () => {
  it('one setup persists through access expiration and rotates refresh without a new login', async () => {
    const { db, h, advance } = createFixture();
    const client = await register(h);
    const p = authorizeArgs(client);
    const page = await call(h.authorize, request('GET', p));
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('My Business');
    expect(page.body).toContain('value="full" selected');
    const authorized = await call(h.authorize, request('POST', { ...p, passphrase: env.ADMIN_PASSPHRASE }));
    expect(authorized.statusCode).toBe(302);
    const code = new URL(authorized.headers.Location).searchParams.get('code');
    const wrongSecret = await call(h.token, request('POST', {
      grant_type: 'authorization_code', client_id: client.client_id,
      client_secret: 'wrong-client-secret', redirect_uri: callback,
      code, code_verifier: verifier, resource }));
    expect(wrongSecret.statusCode).toBe(401);
    expect(json(wrongSecret).error).toBe('invalid_client');
    const granted = await call(h.token, request('POST', { grant_type: 'authorization_code',
      client_id: client.client_id, client_secret: client.client_secret, redirect_uri: callback,
      code, code_verifier: verifier, resource }));
    expect(granted.statusCode).toBe(200);
    const original = json(granted);
    expect(original.expires_in).toBe(3600);
    expect((await db.getAccessToken(original.access_token))).toMatchObject({
      stripe_account: 'acct_fake_one', mode: 'test', profile: 'full', listing: 'compact'
    });
    expect((await call(h.token, request('POST', { grant_type: 'authorization_code',
      client_id: client.client_id, client_secret: client.client_secret, redirect_uri: callback,
      code, code_verifier: verifier, resource }))).statusCode).toBe(400);
    // Simulate 45 days of inactivity: the access token expired long ago; its
    // hashed refresh credential must still work without a new owner sign-in.
    advance(45 * 86400 * 1000);
    expect(await db.getAccessToken(original.access_token)).toBeNull();
    const refreshed = await call(h.token, request('POST', {
      grant_type: 'refresh_token', client_id: client.client_id,
      client_secret: client.client_secret, refresh_token: original.refresh_token, resource }));
    expect(refreshed.statusCode).toBe(200);
    const second = json(refreshed);
    expect(await db.getAccessToken(second.access_token)).toMatchObject({
      stripe_account: 'acct_fake_one', profile: 'full', listing: 'compact'
    });
    const replay = await call(h.token, request('POST', { grant_type: 'refresh_token',
      client_id: client.client_id, client_secret: client.client_secret,
      refresh_token: original.refresh_token, resource }));
    expect(replay.statusCode).toBe(400);
    expect(json(replay).error).toBe('invalid_grant');
    expect((await call(h.token, request('POST', {
      grant_type: 'refresh_token', client_id: 'fake-other-client', client_secret: client.client_secret,
      refresh_token: second.refresh_token, resource }))).statusCode).toBe(401);
    expect((await call(h.token, request('POST', {
      grant_type: 'refresh_token', client_id: client.client_id, client_secret: client.client_secret,
      refresh_token: second.refresh_token, resource: 'https://elsewhere.example.test/api/mcp'
    }))).statusCode).toBe(400);
  });
  it('refuses forged live mode even with the correct admin passphrase', async () => {
    const { h } = createFixture();
    const client = await register(h);
    const result = await call(h.authorize, request('POST',
      { ...authorizeArgs(client), mode: 'live', passphrase: env.ADMIN_PASSPHRASE }));
    expect(result.statusCode).toBe(400);
  });
  it('locks the user after five wrong passwords; valid password cannot bypass it', async () => {
    const { h } = createFixture();
    const client = await register(h), p = authorizeArgs(client);
    for (let i = 0; i < 5; i++) {
      const r = await call(h.authorize, request('POST',{ ...p, passphrase: 'wrong' }));
      expect(r.statusCode).toBe(401);
    }
    const locked = await call(h.authorize, request('POST',{ ...p, passphrase: env.ADMIN_PASSPHRASE }));
    expect(locked.statusCode).toBe(429);
  });
  it('never allows MCP access without a valid scoped bearer', async () => {
    const { db } = createFixture();
    const missing = response();
    expect(await requireMcpToken(request('POST', {}), missing, db, env)).toBeNull();
    expect(missing.statusCode).toBe(401);
    await db.createAccessToken({ accessToken: 'a'.repeat(60), refreshToken: 'b'.repeat(60),
      clientId: 'owner', stripeAccount: 'acct_fake_one', profile: 'full', mode: 'test', listing: 'compact' });
    const allowed = await requireMcpToken(request('POST', {}, { authorization: 'Bearer ' + 'a'.repeat(60) }),
      response(), db, env);
    expect(allowed).toMatchObject({ stripeAccount: 'acct_fake_one', profile: 'full' });
    const other = response();
    expect(await requireMcpToken(request('POST', {},
      { authorization: 'Bearer ' + 'x'.repeat(60) }), other, db, env)).toBeNull();
    expect(other.statusCode).toBe(401);
  });
  it('pins all four unchanged source assertions but never counts them as service adoption',()=>{
    const path=fileURLToPath(new URL('../../../docs/audits/upstream/oauth-handlers.test.js.b64',import.meta.url));
    const source=Buffer.from(readFileSync(path,'utf8').trim(),'base64').toString('utf8');
    expect(gitBlobSha(source)).toBe('10cf67ca0da2a608c5e7f70d3931b68bef6683ba');
    const upstream=assertionBodies(source),replayed=assertionBodies(readFileSync(fileURLToPath(import.meta.url),'utf8'));
    for(const name of [
      'one setup persists through access expiration and rotates refresh without a new login',
      'refuses forged live mode even with the correct admin passphrase',
      'locks the user after five wrong passwords; valid password cannot bypass it',
      'never allows MCP access without a valid scoped bearer'
    ])expect(replayed.get(name)).toBe(upstream.get(name));
  });
});
