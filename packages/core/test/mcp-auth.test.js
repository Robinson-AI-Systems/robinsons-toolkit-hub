import { describe, expect, it, vi } from 'vitest';
import { createMcpBearerAuthenticator } from '../src/mcp-auth.js';

const token = 'T'.repeat(32);
function response() {
  const headers = {};
  const res = {
    statusCode: null, body: null,
    setHeader(key, value) { headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    send(value) { this.body = JSON.parse(value); return this; }
  };
  return { res, headers };
}
function fixture() {
  const getAccessToken = vi.fn(async () => ({
    client_id: 'client-1', tenant_id: 'tenant-1', profile: 'read_only',
    mode: 'test', listing: 'compact', access_secret: 'never-project'
  }));
  const projectConnection = vi.fn(row =>
    row.mode === 'test' && row.profile === 'read_only' ?
      { clientId: row.client_id, tenant: row.tenant_id, profile: row.profile } : null);
  const authenticate = createMcpBearerAuthenticator({
    getAccessToken, projectConnection, env: { PUBLIC_BASE_URL: 'https://tools.example' }
  });
  return { getAccessToken, projectConnection, authenticate };
}
describe('portable MCP bearer boundary', () => {
  it('refuses absent, malformed and unsupported bearer inputs before storage access', async () => {
    const f = fixture();
    for (const auth of [undefined, 'Basic ' + token, 'Bearer x', 'Bearer ' + token + 'extra$',
      'bearer ' + token, 'Bearer ' + token + ' ']) {
      const { res, headers } = response();
      expect(await f.authenticate({ headers: { authorization: auth } }, res)).toBeNull();
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('unauthorized');
      expect(headers['WWW-Authenticate']).toBe(
        'Bearer resource_metadata="https://tools.example/.well-known/oauth-protected-resource"');
      expect(headers['Cache-Control']).toBe('no-store');
    }
    expect(f.getAccessToken).not.toHaveBeenCalled();
    expect(f.projectConnection).not.toHaveBeenCalled();
  });
  it('rejects throwing request and Authorization accessors without querying credentials', async () => {
    const f = fixture();
    const bad = [
      { get headers() { throw new Error('private request getter'); } },
      { headers: { get authorization() { throw new Error('private header getter'); } } },
      new Proxy({}, { get() { throw new Error('private request proxy'); } }),
      { headers: new Proxy({}, { get() { throw new Error('private header proxy'); } }) }
    ];
    for (const req of bad) {
      const { res, headers } = response();
      expect(await f.authenticate(req, res)).toBeNull();
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({
        error: 'unauthorized', error_description: 'A valid connection is required'
      });
      expect(headers['Cache-Control']).toBe('no-store');
      expect(headers['WWW-Authenticate']).toContain('resource_metadata=');
      expect(JSON.stringify(res.body)).not.toContain('private');
    }
    expect(f.getAccessToken).not.toHaveBeenCalled();
    expect(f.projectConnection).not.toHaveBeenCalled();
  });
  it('checks storage and applies server policy before returning frozen projected identity', async () => {
    const f = fixture();
    const {res} = response();
    const claims = await f.authenticate({headers:{authorization:'Bearer '+token}},res);
    expect(f.getAccessToken).toHaveBeenCalledExactlyOnceWith(token);
    expect(f.projectConnection).toHaveBeenCalledTimes(1);
    expect(claims).toEqual({clientId:'client-1',tenant:'tenant-1',profile:'read_only'});
    expect(Object.isFrozen(claims)).toBe(true);
    expect(JSON.stringify(claims)).not.toContain('never-project');
    expect(JSON.stringify(claims)).not.toContain(token);
    expect(res.statusCode).toBeNull();
  });
  it('rejects expired/revoked lookup and denied server policies with invalid_token challenge', async () => {
    const f=fixture();
    for (const record of [null, {mode:'live'}, {mode:'test',profile:'full'}]) {
      f.getAccessToken.mockResolvedValueOnce(record);
      const {res,headers}=response();
      expect(await f.authenticate({headers:{authorization:'Bearer '+token}},res)).toBeNull();
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({error:'invalid_token'});
      expect(headers['WWW-Authenticate']).toContain('error="invalid_token"');
    }
  });
  it('fails closed when projector throws or returns invalid output', async () => {
    const f=fixture();
    for (const output of [undefined, {}, [], 'claims']) {
      f.projectConnection.mockImplementationOnce(() => output);
      const {res}=response();
      expect(await f.authenticate({headers:{authorization:'Bearer '+token}},res)).toBeNull();
      expect(res.statusCode).toBe(401);
    }
    f.projectConnection.mockImplementationOnce(() => { throw new Error('private failure'); });
    const {res}=response();
    expect(await f.authenticate({headers:{authorization:'Bearer '+token}},res)).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('private failure');
  });
  it('refuses missing secure origin and never substitutes an untrusted request Host', async () => {
    const f=fixture();
    const bad=createMcpBearerAuthenticator({
      getAccessToken:f.getAccessToken, projectConnection:f.projectConnection, env:{}
    });
    await expect(bad({headers:{authorization:'Bearer '+token,host:'attacker.test'}},
      response().res)).rejects.toThrow(/HTTPS origin/);
    expect(f.getAccessToken).not.toHaveBeenCalled();
  });
  it('requires explicit storage and policy functions on construction', () => {
    expect(() => createMcpBearerAuthenticator({})).toThrow(/required/);
    expect(() => createMcpBearerAuthenticator({getAccessToken:()=>null})).toThrow(/required/);
  });
});
