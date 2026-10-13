import {it,expect,vi} from 'vitest';
import {handleOwnerGrants} from '../src/owner-grants.js';
const env={HUB_PUBLIC_ORIGIN:'https://hub.example',HUB_OWNER_ID:'owner-a'};
const id='00000000-0000-4000-8000-000000000001';
const secret='rtc_pass_'+('A'.repeat(43));
const stageBody='action=stage&password=synthetic-owner-auth&server=stripe'+
  '&kind=pass&caller='+id+'&areas=billing%2Ccustomers&service_pass='+secret;
function response() {
  return {code:0,body:'',headers:{},setHeader(k,v){this.headers[k]=v;return this;},
    status(v){this.code=v;return this;},send(v){this.body=v;return this;}};
}
async function call(method,body,extra={}) {
  const res=response();
  const deps={env,withDb:async fn=>fn({}, {grantsKey:'synthetic-key'}),
    verify:vi.fn(async(_db,_req,password)=>({approved:password==='synthetic-owner-auth'})),
    stage:vi.fn(async()=>({callable:false})),list:vi.fn(async()=>[]),
    revoke:vi.fn(async()=>true),...extra};
  await handleOwnerGrants({method,body,headers:{
    'content-type':'application/x-www-form-urlencoded'},
    socket:{remoteAddress:'127.0.0.1'}},res,deps);
  return {res,deps};
}
it('does not reveal credentials on GET or admin list',async()=>{
  const get=await call('GET');
  expect(get.res.code).toBe(200);
  expect(get.res.body).not.toContain(secret);
  expect(get.res.headers['Cache-Control']).toBe('no-store');
  const rows=[{id,server:'<script>',callerKind:'pass',callerId:id,
    areas:['billing'],revoked:false}];
  const list=await call('POST','action=list&password=synthetic-owner-auth',
    {list:vi.fn(async()=>rows)});
  expect(list.res.code).toBe(200);
  expect(list.res.body).toContain('&lt;script&gt;');
  expect(list.res.body).not.toContain('<script>');
  expect(list.res.body).not.toContain(secret);
  expect(list.deps.list).toHaveBeenCalledWith(expect.anything(),'owner-a',
    {ownerVerified:true});
});
it('denies unverified owner before encrypted pass staging',async()=>{
  const x=await call('POST',stageBody.replace('synthetic-owner-auth','incorrect'));
  expect(x.res.code).toBe(401);
  expect(x.deps.stage).not.toHaveBeenCalled();
});
it('stages exactly one owner/caller/service noncallable TEST read grant',async()=>{
  const x=await call('POST',stageBody+'&profile=full&mode=live&ttl=999999');
  expect(x.res.code).toBe(201);
  expect(x.deps.stage).toHaveBeenCalledWith(expect.anything(),{
    ownerId:'owner-a',serverName:'stripe',callerKind:'pass',callerId:id,
    areas:['billing','customers'],pass:secret,ttlSeconds:86400
  },{ownerVerified:true,settings:{grantsKey:'synthetic-key'}});
  expect(x.res.body).not.toContain(secret);
  expect(x.res.body).toContain('No routing enabled.');
});
it('revokes only exact grant following independent password check',async()=>{
  expect((await call('POST','action=revoke&id='+id+'&password=incorrect')).res.code)
    .toBe(401);
  const x=await call('POST','action=revoke&id='+id+
    '&password=synthetic-owner-auth');
  expect(x.res.code).toBe(200);
  expect(x.deps.revoke).toHaveBeenCalledWith(expect.anything(),
    {ownerId:'owner-a',id},{ownerVerified:true});
});
it('rejects duplicates, malformed callers/scopes/pass and unconfigured owner',async()=>{
  for(const body of [stageBody+'&action=list',stageBody.replace('kind=pass','kind=all'),
    stageBody.replace('billing%2Ccustomers','billing%2Cbilling'),
    stageBody.replace('service_pass='+secret,'service_pass=bad'),
    stageBody.replace(id,'bad')])
    expect((await call('POST',body)).res.code).toBe(400);
  expect((await call('DELETE')).res.code).toBe(405);
  const locked=await call('POST',stageBody,{verify:async()=>({approved:false,retryAfter:20})});
  expect(locked.res.code).toBe(429);
  expect(locked.res.headers['Retry-After']).toBe('20');
  const down=await call('POST',stageBody,{stage:async()=>{throw Error('test secret');}});
  expect(down.res.code).toBe(503);
  expect(down.res.body).not.toContain('test secret');
  expect((await call('GET',null,{env:{...env,HUB_PUBLIC_ORIGIN:'http://hub.example'}}))
    .res.code).toBe(503);
});
