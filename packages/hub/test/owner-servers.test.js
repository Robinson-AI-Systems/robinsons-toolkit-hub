import {it,expect,vi} from 'vitest';
import {handleOwnerServers} from '../src/owner-servers.js';
const env={HUB_PUBLIC_ORIGIN:'https://hub.example',HUB_OWNER_ID:'owner-one'};
function response() {
  return {code:0,html:'',headers:{},
    setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.code=n;return this;},
    send(v){this.html=v;return this;}};
}
async function invoke(method,body,overrides={}) {
  const res=response();
  const deps={env,withDb:async fn=>fn({query:vi.fn()}),
    verify:vi.fn(async(_db,_req,pass)=>({approved:pass==='synthetic-owner-auth'})),
    probe:vi.fn(async()=>({tools:12,writes:2,money:0})),
    stage:vi.fn(async()=>({state:'pending',callable:false})),
    list:vi.fn(async()=>[]),disable:vi.fn(async()=>true),
    retire:vi.fn(async()=>({disabled:true,revokedCount:2})),...overrides};
  await handleOwnerServers({method,body,headers:{
    'content-type':'application/x-www-form-urlencoded'},
    socket:{remoteAddress:'127.0.0.1'}},res,deps);
  return {res,deps};
}
const stage='action=stage&password=synthetic-owner-auth&name=stripe&prefix=stripe'+
  '&origin=https%3A%2F%2Fstripe-mcp-psi.vercel.app';
it('GET provides no data, no stored credentials and hardened headers',async()=>{
  const {res,deps}=await invoke('GET');
  expect(res.code).toBe(200);
  expect(res.html).toContain('Verify and stage');
  expect(res.headers['Cache-Control']).toBe('no-store');
  expect(res.headers['Content-Security-Policy']).toContain("default-src 'none'");
  expect(deps.verify).not.toHaveBeenCalled();
  expect(deps.list).not.toHaveBeenCalled();
});
it('owner verification precedes DNS probe, stages only inspected counts',async()=>{
  const denied=await invoke('POST',stage.replace('synthetic-owner-auth','incorrect'));
  expect(denied.res.code).toBe(401);
  expect(denied.deps.probe).not.toHaveBeenCalled();
  expect(denied.deps.stage).not.toHaveBeenCalled();
  const {res,deps}=await invoke('POST',stage+'&tools=99999&mode=live');
  expect(res.code).toBe(201);
  expect(deps.probe).toHaveBeenCalledWith(
    'https://stripe-mcp-psi.vercel.app',{name:'stripe',prefix:'stripe'});
  const input=deps.stage.mock.calls[0][1];
  expect(input).toMatchObject({ownerId:'owner-one',name:'stripe',
    origin:'https://stripe-mcp-psi.vercel.app',
    manifest:{rtc:1,server:'stripe',prefix:'stripe',
      counts:{tools:12,writes:2,money:0}}});
  expect(deps.stage.mock.calls[0][2]).toEqual({ownerVerified:true});
  expect(res.html).not.toContain('synthetic-owner-auth');
  expect(res.html).toContain('No routing, credential or live authorization was enabled.');
});
it('listing is owner verified, escaped, capped by registry and never public',async()=>{
  const list=vi.fn(async()=>[{name:'<script>',prefix:'other',
    origin:'https://a.b.example.org',state:'pending'}]);
  expect((await invoke('POST','action=list&password=incorrect',{list})).res.code).toBe(401);
  const {res,deps}=await invoke('POST','action=list&password=synthetic-owner-auth',{list});
  expect(res.code).toBe(200);
  expect(res.html).toContain('&lt;script&gt;');
  expect(res.html).not.toContain('<script>');
  expect(deps.list).toHaveBeenCalledWith(expect.anything(),'owner-one',
    {ownerVerified:true});
});
it('disable is exact-name and independently authorized',async()=>{
  const disable=vi.fn(async()=>true);
  expect((await invoke('POST','action=disable&name=bad&id=1&password=x',
    {disable})).res.code).toBe(401);
  const {res,deps}=await invoke('POST',
    'action=disable&name=stripe&password=synthetic-owner-auth',{disable});
  expect(res.code).toBe(200);
  expect(deps.disable).toHaveBeenCalledWith(expect.anything(),
    {ownerId:'owner-one',name:'stripe'},{ownerVerified:true});
});
it('refuses duplicates, malformed origins, blocked accounts, methods and content',async()=>{
  expect((await invoke('POST',stage+'&action=list')).res.code).toBe(400);
  expect((await invoke('POST',stage.replace('name=stripe','name=UPPER'))).res.code).toBe(400);
  expect((await invoke('DELETE')).res.code).toBe(405);
  const locked=await invoke('POST',stage,{verify:async()=>({approved:false,retryAfter:30})});
  expect(locked.res.code).toBe(429);
  expect(locked.res.headers['Retry-After']).toBe('30');
  const failure=await invoke('POST',stage,{probe:async()=>{throw Error('dns refused');}});
  expect(failure.res.code).toBe(503);
  expect(failure.res.html).not.toContain('dns refused');
  expect((await invoke('GET',null,{env:{...env,HUB_PUBLIC_ORIGIN:'http://example.com'}}))
    .res.code).toBe(503);
});

it('requires exact owner verification and typed RETIRE before atomic TEST grant cleanup',async()=>{
 const form=await invoke('GET');
 expect(form.res.html).toContain('Type RETIRE');
 const body='action=retire&name=stripe&confirm=RETIRE&password=synthetic-owner-auth';
 const invalid=await invoke('POST',body.replace('confirm=RETIRE','confirm=yes'));
 expect(invalid.res.code).toBe(400);
 expect(invalid.deps.retire).not.toHaveBeenCalled();
 const unauthenticated=await invoke('POST',body.replace(
  'synthetic-owner-auth','incorrect'));
 expect(unauthenticated.res.code).toBe(401);
 expect(unauthenticated.deps.retire).not.toHaveBeenCalled();
 const {res,deps}=await invoke('POST',body);
 expect(res.code).toBe(200);
 expect(res.html).toContain('2 remaining scoped grants revoked');
 expect(deps.retire).toHaveBeenCalledWith(expect.anything(),
  {ownerId:'owner-one',name:'stripe'},{ownerVerified:true});
 expect(deps.probe).not.toHaveBeenCalled();
 expect(deps.stage).not.toHaveBeenCalled();
 expect(res.html).not.toContain('synthetic-owner-auth');
});
it('does not leak grant identities on retirement failure',async()=>{
 const body='action=retire&name=stripe&confirm=RETIRE&password=synthetic-owner-auth';
 const error=await invoke('POST',body,{retire:async()=>{
  throw Error('private sealed grant details')}});
 expect(error.res.code).toBe(503);
 expect(error.res.html).not.toContain('private sealed');
 const unknown=await invoke('POST',body,{retire:async()=>null});
 expect(unknown.res.code).toBe(404);
});
