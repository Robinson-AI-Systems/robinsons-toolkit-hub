import { it, expect, vi } from 'vitest';
import { handleOwnerPasses } from '../src/owner-passes.js';
const env = { HUB_PUBLIC_ORIGIN: 'https://hub.example',
  HUB_OWNER_ID: 'owner-one', HUB_TOKEN_PEPPER: 'synthetic-owner-test-only-hmac-key' };
const id = '00000000-0000-4000-8000-000000000001';
function response() {
  return { statusCode: 0, headers: {}, html: '',
    setHeader(k,v) { this.headers[k]=v; return this; },
    status(n) { this.statusCode=n; return this; },
    send(v) { this.html=v; return this; } };
}
const withDb = async fn => fn({}, { pepper: env.HUB_TOKEN_PEPPER });
async function send(method, body, overrides = {}) {
  const res = response();
  await handleOwnerPasses({ method, headers: { 'content-type':
    'application/x-www-form-urlencoded' }, body,
    socket: { remoteAddress: '127.0.0.1' } }, res, {
      withDb, env, verify: vi.fn(async (db, req, pass) => ({
        approved: pass === 'synthetic-owner-auth', retryAfter: 0
      })),
      issue: vi.fn(async () => ({ id, pass: 'synthetic-one-time-value' })),
      revoke: vi.fn(async () => true), ...overrides
    });
  return res;
}
it('serves strict no-store owner form without displaying passes', async () => {
  const res=await send('GET');
  expect(res.statusCode).toBe(200);
  expect(res.headers['Cache-Control']).toBe('no-store');
  expect(res.headers['Content-Security-Policy']).toContain("default-src 'none'");
  expect(res.html).not.toContain('synthetic-one-time-value');
});
it('issues read-only TEST/gateway for verified owner only and shows secret once', async () => {
  const issue=vi.fn(async () => ({ id, pass: 'synthetic-one-time-value' }));
  const body='action=issue&password=synthetic-owner-auth&servers=stripe%2Cworkspace&profile=full&mode=live';
  const res=await send('POST',body,{issue});
  expect(res.statusCode).toBe(201);
  expect(res.html).toContain('synthetic-one-time-value');
  expect(issue).toHaveBeenCalledWith({},{
    ownerId:'owner-one',profile:'read_only',mode:'test',
    areas:['gateway'],serverNames:['stripe','workspace'],allowWrites:false,ttlSeconds:86400
  }, {ownerVerified:true,pepper:env.HUB_TOKEN_PEPPER});
  const denied=await send('POST','action=issue&password=wrong&servers=stripe',{issue});
  expect(denied.statusCode).toBe(401);
  expect(issue).toHaveBeenCalledTimes(1);
});
it('revokes only after independent owner verification and exact identifier', async () => {
  const revoke=vi.fn(async () => true);
  expect((await send('POST','action=revoke&password=wrong&id='+id,{revoke})).statusCode)
    .toBe(401);
  expect((await send('POST','action=revoke&password=synthetic-owner-auth&id=bad',{revoke}))
    .statusCode).toBe(400);
  expect((await send('POST','action=revoke&password=synthetic-owner-auth&id='+id,
    {revoke})).statusCode).toBe(200);
  expect(revoke).toHaveBeenCalledTimes(1);
});
it('rejects duplicate fields, wrong method, lockout and missing verified origin', async () => {
  expect((await send('POST','action=issue&action=revoke&password=x')).statusCode).toBe(400);
  expect((await send('DELETE')).statusCode).toBe(405);
  const locked=await send('POST','action=issue&password=x&servers=stripe',{
    verify:vi.fn(async()=>({approved:false,retryAfter:30}))});
  expect(locked.statusCode).toBe(429);
  expect(locked.headers['Retry-After']).toBe('30');
  expect((await send('GET',null,{env:{...env,HUB_PUBLIC_ORIGIN:'http://hub.example'}}))
    .statusCode).toBe(503);
});

it('refuses a blank, duplicated or malformed server selection before owner verification',async()=>{
 const issue=vi.fn();
 const verify=vi.fn();
 for (const suffix of ['', '&servers=', '&servers=stripe%2Cstripe',
   '&servers=Stripe', '&servers=..', '&servers=stripe%2C%2Cneon']) {
   const res=await send('POST','action=issue&password=synthetic-owner-auth'+suffix,
    {issue,verify});
   expect(res.statusCode).toBe(400);
 }
 expect(issue).not.toHaveBeenCalled();
 expect(verify).not.toHaveBeenCalled();
});
