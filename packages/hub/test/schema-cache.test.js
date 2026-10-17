import {randomUUID} from 'node:crypto';
import {it,expect,vi} from 'vitest';
import {createSchemaCache} from '../src/schema-cache.js';
import {runFederatedBroker} from '../src/federation.js';
import {mcpFederatedReply} from '../src/http-door.js';
import {handleHubTools} from '../src/tools-http.js';

const actor={id:randomUUID(),ownerId:'synthetic-schema-owner',
 clientId:'synthetic-client',mode:'test',profile:'full',
 allowWrites:false,areas:['gateway']};
const settings={pepper:'nonsecret-schema-cache-isolation-key-over-32'};
const target={name:'workspace',prefix:'workspace_',areas:['drive'],
 origin:'https://workspace.example.net',verifiedAt:'2026-10-14T00:00:00Z',
 grantId:'grant-before'};
const grant={server:'workspace',prefix:'workspace_',areas:['drive'],
 grantId:'grant-before',origin:target.origin,mode:'test',profile:'read_only',
 pass:'synthetic-pass-do-not-return'};
const name='workspace_drive_list';
const schema={name,description:'Read authorized TEST drive metadata',
 area:'drive',profiles:['read_only'],writes:false,money:false,
 destructive:false,annotations:{readOnlyHint:true,destructiveHint:false},
 inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:20}},
  additionalProperties:false}};
const params=(a=actor,g=grant,t=target,n=name)=>({
 actor:a,grant:g,target:t,name:n,settings});

it('serves a bounded schema from isolated memory and does not extend 15-second TTL on hit',async()=>{
 let clock=10000;
 const cache=createSchemaCache(),fetch=vi.fn(async()=>schema);
 const first=await cache.describe(params(),fetch,{now:()=>clock});
 expect(first).toMatchObject({name,area:'drive',writes:false});
 expect(first.annotations).toEqual({readOnlyHint:true});
 expect(first.inputSchema.properties.limit.maximum).toBe(20);
 first.inputSchema.properties.limit.maximum=9000;
 const second=await cache.describe(params(),fetch,{now:()=>clock+1000});
 expect(second.inputSchema.properties.limit.maximum).toBe(20);
 expect(fetch).toHaveBeenCalledTimes(1);
 clock+=15000;
 await cache.describe(params(),fetch,{now:()=>clock});
 expect(fetch).toHaveBeenCalledTimes(2);
 expect(cache.stats().entries).toBe(1);
 cache.clear();expect(cache.stats()).toEqual({entries:0,bytes:0});
});

it('binds schema descriptions to precise owner, caller, server, grant, origin, verification, tool',async()=>{
 const cache=createSchemaCache(),fetch=vi.fn(async()=>schema);
 await cache.describe(params(),fetch);
 const changes=[
  params({...actor,id:randomUUID()}),
  params({...actor,ownerId:'other-owner'}),
  params(actor,{...grant,grantId:'rotated'}),
  params(actor,{...grant,origin:'https://other.example.net'}),
  params(actor,grant,{...target,verifiedAt:'2026-10-14T01:00:00Z'}),
  params(actor,grant,{...target,grantId:'rotated'}),
  params({...actor,profile:'read_only'}),
  params({...actor,areas:['gateway','extra']})
 ];
 for(const p of changes)await cache.describe(p,fetch);
 expect(fetch).toHaveBeenCalledTimes(changes.length+1);
 expect(cache.stats().entries).toBe(changes.length+1);
});

it('refuses unsafe executable schema, unexpected prefix, writes, money and malformed metadata',async()=>{
 for(const bad of [
  {...schema,writes:true},{...schema,money:true},
  {...schema,destructive:true},
  {...schema,annotations:{readOnlyHint:false}},
  {...schema,name:'workspace__drive_list'},
  {...schema,area:'billing'},
  {...schema,inputSchema:'not-object'},
  {...schema,inputSchema:null},
  {...schema,profiles:['full']},
  {...schema,description:'x'.repeat(161)},
  {...schema,inputSchema:{type:'object',properties:{huge:{const:'z'.repeat(17000)}}}}
 ]) {
  const cache=createSchemaCache(),fetch=vi.fn(async()=>bad);
  await expect(cache.describe(params(),fetch)).rejects.toThrow();
  expect(cache.stats().entries).toBe(0);
  expect(fetch).toHaveBeenCalledTimes(1);
 }
});

it('does not cache failures or spill provider-controlled credentials and unknown fields',async()=>{
 const cache=createSchemaCache(),fetch=vi.fn()
  .mockRejectedValueOnce(new Error('provider unavailable'))
  .mockResolvedValueOnce({...schema,
   upstreamPass:'confidential-upstream-pass',
   outputSchema:{secret:'do not expose'}});
 await expect(cache.describe(params(),fetch)).rejects.toThrow('provider unavailable');
 const safe=await cache.describe(params(),fetch);
 expect(safe).not.toHaveProperty('upstreamPass');
 expect(safe).not.toHaveProperty('outputSchema');
 expect(JSON.stringify(safe)).not.toContain('confidential-upstream-pass');
 expect(cache.stats().entries).toBe(1);
});

it('evicts the oldest schema after 32 entries and keeps a 192 KiB total ceiling',async()=>{
 const cache=createSchemaCache();
 const fetch=vi.fn(async()=>({...schema}));
 for(let i=0;i<40;i++){
  const tool='workspace_drive_'+i.toString().padStart(3,'0');
  const fields={...schema,name:tool};
  await cache.describe(params(actor,grant,target,tool),async()=>{
   fetch();return fields;
  });
  expect(cache.stats().entries).toBeLessThanOrEqual(32);
  expect(cache.stats().bytes).toBeLessThanOrEqual(192*1024);
 }
 expect(cache.stats().entries).toBe(32);
 await cache.describe(params(actor,grant,target,'workspace_drive_039'),
  async()=>({...schema,name:'workspace_drive_039'}));
 expect(cache.stats().entries).toBe(32);
});

function federation(cache=createSchemaCache()) {
 let live={...grant};
 const deps={
  schemaCache:cache,
  list:vi.fn(async()=>[target]),
  resolve:vi.fn(async()=>live),
  describe:vi.fn(async()=>structuredClone(schema)),
  read:vi.fn(async()=>({ok:true,result:{read:'synthetic-test'},logged:{id:'test_42'}})),
  audit:vi.fn(async()=>1),
  correlation:randomUUID
 };
 return {deps,setGrant:g=>{live=g;}};
}
it('shares a safe on-demand described schema but never uses cached metadata to authorize POST',async()=>{
 const {deps}=federation();
 const first=await runFederatedBroker('hub_describe_tool',{name},actor,{},settings,deps);
 const second=await runFederatedBroker('hub_describe_tool',{name},actor,{},settings,deps);
 expect(first.ok).toBe(true);expect(second.ok).toBe(true);
 expect(first.result.server).toBe('workspace');
 expect(deps.describe).toHaveBeenCalledTimes(1);
 expect(deps.resolve).toHaveBeenCalledTimes(4);
 const read=await runFederatedBroker('hub_call',{name,args:{limit:1}},
  actor,{},settings,deps);
 expect(read.ok).toBe(true);
 expect(deps.describe).toHaveBeenCalledTimes(2);
 expect(deps.read).toHaveBeenCalledTimes(1);
 expect(deps.audit).toHaveBeenCalledTimes(2);
 expect(JSON.stringify([first,second,read])).not.toContain(grant.pass);
});

it('blocks metadata disclosure after cache hit if grant is revoked mid-request',async()=>{
 const {deps,setGrant}=federation();
 const first=await runFederatedBroker('hub_describe_tool',{name},actor,{},settings,deps);
 expect(first.ok).toBe(true);
 let count=0;
 deps.resolve.mockImplementation(async()=>{
  count++;return count===2?null:grant;
 });
 const refused=await runFederatedBroker('hub_describe_tool',{name},actor,{},settings,deps);
 expect(refused.ok).toBe(false);
 expect(refused.error.code).toBe('outside_scope');
 expect(deps.describe).toHaveBeenCalledTimes(1);
 expect(deps.read).not.toHaveBeenCalled();
 setGrant(null);
 deps.resolve.mockResolvedValue(null);
 const revoked=await runFederatedBroker('hub_describe_tool',{name},actor,{},settings,deps);
 expect(revoked.ok).toBe(false);
 expect(deps.describe).toHaveBeenCalledTimes(1);
});

it('denies provider change from read-only to write-capable even after a safe description is cached',async()=>{
 const {deps}=federation();
 const described=await runFederatedBroker('hub_describe_tool',{name},actor,{},settings,deps);
 expect(described.ok).toBe(true);
 deps.describe.mockResolvedValueOnce({...schema,writes:true,annotations:{readOnlyHint:false}});
 const denied=await runFederatedBroker('hub_call',{name,args:{}},actor,{},settings,deps);
 expect(denied.error.code).toBe('outside_scope');
 expect(deps.read).not.toHaveBeenCalled();
 expect(deps.audit).not.toHaveBeenCalled();
 expect(deps.describe).toHaveBeenCalledTimes(2);
});

it('preserves native MCP/HTTPS on-demand schema parity without widening caller rights',async()=>{
 const {deps}=federation();
 const native=await mcpFederatedReply({jsonrpc:'2.0',id:1,
  method:'tools/call',params:{name:'hub_describe_tool',arguments:{name}}},
  actor,{},settings,deps);
 expect(native.result.structuredContent).toMatchObject({name,server:'workspace'});
 const response={headers:{},code:null,body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.code=n;return this;},
  json(x){this.body=x;return this;}};
 await handleHubTools({method:'GET',query:{name},headers:{authorization:'synthetic'}},
  response,{authorize:async()=>({actor}),withDb:async f=>f({},settings),
   federate:(n,a,who,db,s)=>runFederatedBroker(n,a,who,db,s,deps)},'item');
 expect(response.code).toBe(200);
 expect(response.body.result.name).toBe(name);
 expect(deps.describe).toHaveBeenCalledTimes(1);
 expect(deps.resolve).toHaveBeenCalledTimes(4);
 expect(response.headers['Cache-Control']).toBe('no-store');
});

it('coalesces simultaneous descriptions only for identical grant-scoped GETs',async()=>{
 const cache=createSchemaCache();
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const fetch=vi.fn(async()=>{await gate;return schema;});
 const one=cache.describe(params(),fetch);
 const two=cache.describe(params(),fetch);
 const different=cache.describe(params(actor,{...grant,grantId:'different'}),fetch);
 expect(fetch).toHaveBeenCalledTimes(2);
 release();
 const results=await Promise.all([one,two,different]);
 expect(results.every(x=>x.name===name)).toBe(true);
 expect(fetch).toHaveBeenCalledTimes(2);
 results[0].inputSchema.properties.limit.maximum=999;
 expect(results[1].inputSchema.properties.limit.maximum).toBe(20);
});
it('cleans rejected in-flight GET without leaving a poisoned cache promise',async()=>{
 const cache=createSchemaCache(),fetch=vi.fn()
  .mockRejectedValueOnce(new Error('offline'))
  .mockResolvedValueOnce(schema);
 const [a,b]=await Promise.allSettled([
  cache.describe(params(),fetch),cache.describe(params(),fetch)]);
 expect(a.status).toBe('rejected');expect(b.status).toBe('rejected');
 expect(fetch).toHaveBeenCalledTimes(1);
 const retried=await cache.describe(params(),fetch);
 expect(retried.name).toBe(name);
 expect(fetch).toHaveBeenCalledTimes(2);
});

it('isolates user-delegated LIVE full-profile READ schemas and refuses privilege confusion',async()=>{
 const cache=createSchemaCache();
 const liveActor={...actor,mode:'live',profile:'full',allowWrites:true};
 const liveGrant={...grant,mode:'live',profile:'full',grantId:'independent-live-rtc-grant'};
 const liveSchema={...schema,profiles:['full']};
 const fetched=vi.fn(async()=>liveSchema);
 const first=await cache.describe(params(liveActor,liveGrant),fetched);
 expect(first).toMatchObject({name,profiles:['full'],writes:false,
  annotations:{readOnlyHint:true}});
 expect((await cache.describe(params(liveActor,liveGrant),fetched)).profiles).toEqual(['full']);
 expect(fetched).toHaveBeenCalledTimes(1);
 await expect(cache.describe(params(liveActor,{...liveGrant,profile:'read_only'}),
  fetched)).rejects.toThrow();
 await expect(cache.describe(params(liveActor,liveGrant),async()=>({
  ...liveSchema,writes:true}))).resolves.toMatchObject({writes:false});
 // A cached harmless read remains READ metadata only, never a POST permit.
 cache.clear();
 await expect(cache.describe(params(liveActor,liveGrant),async()=>({
  ...liveSchema,writes:true}))).rejects.toThrow();
});
