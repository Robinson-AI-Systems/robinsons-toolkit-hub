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

it('requires independent verified owner before listing or reducing pass permissions',async()=>{
 const list=vi.fn(async()=>[{
   id,profile:'read_only',mode:'test',areas:['gateway'],
   serverNames:['stripe','<script>'],state:'current',expiresAt:'tomorrow'
 }]);
 expect((await send('POST','action=list&password=wrong',{list})).statusCode).toBe(401);
 expect(list).not.toHaveBeenCalled();
 const owner=await send('POST','action=list&password=synthetic-owner-auth',{list});
 expect(owner.statusCode).toBe(200);
 expect(owner.headers['Cache-Control']).toBe('no-store');
 expect(owner.html).toContain('stripe');
 expect(owner.html).not.toContain('<script>');
 expect(owner.html).not.toContain('synthetic-one-time-value');
 expect(list).toHaveBeenCalledWith({},'owner-one',{ownerVerified:true});
 const narrow=vi.fn(async()=>({updated:true,serverNames:['stripe']}));
 const params='action=narrow&password=synthetic-owner-auth&id='+id+'&servers=stripe';
 expect((await send('POST',params.replace('synthetic-owner-auth','wrong'),
   {narrow})).statusCode).toBe(401);
 expect(narrow).not.toHaveBeenCalled();
 const narrowed=await send('POST',params,{narrow});
 expect(narrowed.statusCode).toBe(200);
 expect(narrow).toHaveBeenCalledWith({},{
   ownerId:'owner-one',id,serverNames:['stripe']
 },{ownerVerified:true});
 expect((await send('POST',params,{narrow:async()=>({updated:false})}))
   .statusCode).toBe(404);
});
it('rejects narrowing without an exact ID, real selected subset or owner review',async()=>{
 const narrow=vi.fn();
 for(const params of [
   'action=narrow&password=synthetic-owner-auth&id=bad&servers=stripe',
   'action=narrow&password=synthetic-owner-auth&id='+id,
   'action=narrow&password=synthetic-owner-auth&id='+id+'&servers=stripe%2Cstripe',
   'action=narrow&password=synthetic-owner-auth&id='+id+'&servers=..',
   'action=narrow&password=synthetic-owner-auth&id='+id+'&servers='
 ])expect((await send('POST',params,{narrow})).statusCode).toBe(400);
 expect(narrow).not.toHaveBeenCalled();
});

it('profile actions authenticate the owner and reject unsupported upgrades',async()=>{
 const narrowProfile=vi.fn(async()=>({updated:true,profile:'disabled'}));
 const body='action=narrow_profile&id='+id+'&server=stripe&profile=disabled&password=synthetic-owner-auth';
 expect((await send('POST',body.replace('synthetic-owner-auth','wrong'),
  {narrowProfile})).statusCode).toBe(401);
 for(const invalid of [body.replace('profile=disabled','profile=full'),
  body.replace('server=stripe','server=..'),body.replace(id,'invalid')])
  expect((await send('POST',invalid,{narrowProfile})).statusCode).toBe(400);
 expect(narrowProfile).not.toHaveBeenCalled();
 expect((await send('POST',body,{narrowProfile})).statusCode).toBe(200);
 expect(narrowProfile).toHaveBeenCalledWith({},{
  ownerId:'owner-one',id,serverName:'stripe',profile:'disabled'
 },{ownerVerified:true});
 const audit=vi.fn(async()=>[{at:'today',kind:'pass',callerId:id,
  server:'<script>',profile:'disabled',purgedHandles:3}]);
 const result=await send('POST','action=profile_audit&password=synthetic-owner-auth',
  {profileAudit:audit});
 expect(result.statusCode).toBe(200);
 expect(result.html).not.toContain('<script>');
 expect(audit).toHaveBeenCalledWith({},'owner-one',{ownerVerified:true});
});

it('pass issuance starts with owner-selected area ceilings and refuses invalid scopes',async()=>{
 const issue=vi.fn(async()=>({id,pass:'synthetic-one-time-value'}));
 const good='action=issue&password=synthetic-owner-auth&servers=stripe%2Cworkspace'+
  '&service_areas=stripe%3Abilling%7Creports%2Cworkspace%3Adrive';
 expect((await send('POST',good,{issue})).statusCode).toBe(201);
 expect(issue).toHaveBeenCalledWith({},expect.objectContaining({
  serverNames:['stripe','workspace'],serviceAreas:{
   stripe:['billing','reports'],workspace:['drive']}}),
  {ownerVerified:true,pepper:env.HUB_TOKEN_PEPPER});
 issue.mockClear();
 for(const denied of ['stripe%3ABilling','unknown%3Abilling','stripe%3A',
   'stripe%3Abilling%2Cstripe%3Areports']){
  const res=await send('POST',
   'action=issue&password=synthetic-owner-auth&servers=stripe&service_areas='+denied,
   {issue});
  expect(res.statusCode).toBe(400);
 }
 expect(issue).not.toHaveBeenCalled();
 const form=await send('GET');
 expect(form.html).toContain('name="service_areas"');
});

it('multi-service pass plan validates before owner auth and previews/commits only after approval',async()=>{
 const previewAreaPlan=vi.fn(async()=>({canApply:true,scopes:[{
   server:'stripe',before:['billing','reports'],after:['billing'],available:true
 }]}));
 const executeAreaPlan=vi.fn(async()=>({updated:true,services:['stripe'],atomic:true}));
 const base='&id='+id+'&password=synthetic-owner-auth'+
  '&area_plan=stripe%3Abilling';
 const malformed=await send('POST','action=narrow_area_plan'+base.replace(
  'stripe%3Abilling','stripe%3ABilling'),{executeAreaPlan});
 expect(malformed.statusCode).toBe(400);
 expect(executeAreaPlan).not.toHaveBeenCalled();
 const denied=await send('POST','action=preview_area_plan'+base.replace(
  'synthetic-owner-auth','wrong'),{previewAreaPlan});
 expect(denied.statusCode).toBe(401);
 expect(previewAreaPlan).not.toHaveBeenCalled();
 const preview=await send('POST','action=preview_area_plan'+base,{previewAreaPlan});
 expect(preview.statusCode).toBe(200);
 expect(preview.html).toContain('No permissions changed');
 expect(previewAreaPlan).toHaveBeenCalledWith({},{
  ownerId:'owner-one',callerKind:'pass',id,plan:{stripe:['billing']}
 },{ownerVerified:true});
 const applied=await send('POST','action=narrow_area_plan'+base,{executeAreaPlan});
 expect(applied.statusCode).toBe(200);
 expect(executeAreaPlan).toHaveBeenCalledWith({},{
  ownerId:'owner-one',callerKind:'pass',id,plan:{stripe:['billing']}
 },{ownerVerified:true});
 expect((await send('POST','action=narrow_area_plan'+base,{
  executeAreaPlan:async()=>({updated:false})})).statusCode).toBe(404);
 expect((await send('GET')).html).toContain('name="area_plan"');
});
