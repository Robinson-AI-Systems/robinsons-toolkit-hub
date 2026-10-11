// Portable original Stripe endpoint assertion bodies, unchanged below.
// Remaining owner-authorization and SQL assertions stay in the original service.
import { describe, it, expect } from 'vitest';
import { createOAuthProtocolHandlers } from '../src/oauth-protocol.js';
const env = { PUBLIC_BASE_URL: 'https://stripe-mcp.example.test' };
const resource = env.PUBLIC_BASE_URL + '/api/mcp';
function request(method, data, headers = {}) {
  return { method, headers, body: method === 'GET' ? undefined : data,
    query: method === 'GET' ? data : undefined,
    socket: { remoteAddress: '198.51.100.1' } };
}
function response() {
  return { statusCode: 200, headers: {}, body: null,
    setHeader(k,v) { this.headers[k] = v; return this; },
    status(s) { this.statusCode = s; return this; },
    send(v) { this.body = v; return this; } };
}
async function call(handler, req) { const res = response(); await handler(req,res); return res; }
function json(res) { return JSON.parse(res.body); }
function createFixture() {
  const db = { createOAuthClient: async () => {}, getOAuthClient: async () => null,
    consumeAuthCode: async () => null, createAccessToken: async () => {},
    rotateRefreshToken: async () => null };
  return { h: createOAuthProtocolHandlers({ db, env, buildAccessRow: () => null }) };
}
describe('original source portable OAuth endpoint assertions', () => {
  it('publishes fixed HTTPS metadata and does not advertise weak PKCE', async () => {
    const { h } = createFixture();
    const auth = json(await call(h.metadata, request('GET', {})));
    expect(auth.issuer).toBe(env.PUBLIC_BASE_URL);
    expect(auth.code_challenge_methods_supported).toEqual(['S256']);
    expect(json(await call(h.resourceMetadata, request('GET', {}))).resource).toBe(resource);
  });
  it('rejects insecure redirect URIs and unsupported public-client auth', async () => {
    const { h } = createFixture();
    const res = await call(h.register, request('POST', { redirect_uris: ['http://evil.example.test/cb'] }));
    expect(res.statusCode).toBe(400);
    expect(json(res).error).toBe('invalid_client_metadata');
  });
});
