import {it,expect,vi} from 'vitest';
import {runFederatedBroker} from '../src/federation.js';
import {mcpFederatedReply,mcpReply} from '../src/http-door.js';
const actor={id:'scoped-caller',ownerId:'owner-a',profile:'full',mode:'test',
 areas:['gateway'],allowWrites:false,clientId:'authorized-dev'};
const targets=[
 {name:'google',prefix:'google',claimedCounts:{tools:200},
  areas:['gmail'],readOnlyGrant:true},
 {name:'stripe',prefix:'stripe',claimedCounts:{tools:100},
  areas:['billing'],readOnlyGrant:true},
 {name:'neon',prefix:'neon',claimedCounts:{tools:50},
  areas:['database'],readOnlyGrant:true}
];
function provider() {
 const deps={
  list:vi.fn(async()=>targets),
  resolve:vi.fn(async(_db,{serverName})=>({
    server:serverName,prefix:serverName,origin:'https://service.example.com',
    pass:'synthetic-injected-pass',profile:'read_only',mode:'test',
    areas:targets.find(t=>t.name===serverName)?.areas??[]})),
  search:vi.fn(async(grant)=>({tools:[{name:grant.prefix+'_read_list',
    description:'Read TEST objects',area:grant.areas[0],writes:false,
    money:false,destructive:false}],incomplete:false})),
  describe:vi.fn(async(_grant,name)=>({name,area:'billing',
    description:'Safe RTC TEST read',profiles:['read_only'],
    inputSchema:{type:'object'},writes:false,money:false,destructive:false,
    annotations:{readOnlyHint:true}}))
 };
 return deps;
}
const req=(name,args)=>({jsonrpc:'2.0',id:19,method:'tools/call',
 params:{name,arguments:args}});
it('returns selective, grant-scoped real RTC metadata through the fixed native MCP menu',async()=>{
 const deps=provider();
 const result=await mcpFederatedReply(req('hub_search_tools',
  {query:'invoice',server:'stripe',area:'billing',limit:5}),actor,{},{},deps);
 expect(result.error).toBeUndefined();
 expect(result.result.structuredContent.tools.map(t=>t.name))
  .toEqual(['stripe_read_list']);
 expect(result.result.structuredContent.scanned).toBe(1);
 expect(result.result.structuredContent.incomplete).toBe(false);
 expect(deps.resolve).toHaveBeenCalledTimes(2);
 expect(deps.search).toHaveBeenCalledWith(expect.objectContaining({
  profile:'read_only',areas:['billing']}),expect.objectContaining({
    area:'billing',limit:5}));
 expect(JSON.stringify(result)).not.toContain('synthetic-injected-pass');
 const schema=await mcpFederatedReply(req('hub_describe_tool',
  {name:'stripe_invoice_list'}),actor,{},{},deps);
 expect(schema.result.structuredContent).toMatchObject({name:'stripe_invoice_list',
  server:'stripe',inputSchema:{type:'object'}});
 const nav=await mcpFederatedReply(req('hub_namespaces',{}),actor,{},{},deps);
 expect(nav.result.structuredContent.namespaces.map(x=>x.name))
  .toEqual(['hub','google','stripe','neon']);
 expect(nav.result.structuredContent.metadataOnly).toBe(true);
 const health=await mcpFederatedReply(req('hub_health',{}),actor,{},{},deps);
 expect(health.result.structuredContent).toMatchObject({
  foundation:'ready',federation:'test_read_routing',providerCallsEnabled:true,
  accessibleUpstreams:3});
 expect(deps.resolve).toHaveBeenCalledTimes(4);
 expect(deps.describe).toHaveBeenCalledTimes(1);
 expect(mcpReply(req('hub_whoami',{}),actor).result.structuredContent.profile)
   .toBe('full');
});
it('keeps individual RTC failures isolated, with explicit partial discovery',async()=>{
 const deps=provider();
 deps.search=vi.fn(async grant=>{
  if(grant.server==='stripe')throw Error('private provider details never returned');
  return {tools:[{name:grant.prefix+'_read_list'}],incomplete:false};
 });
 const state=await runFederatedBroker('hub_search_tools',
  {query:'read',limit:10},actor,{},{},deps);
 expect(state.ok).toBe(true);
 expect(state.result.failures).toEqual([{server:'stripe',code:'unavailable'}]);
 expect(state.result.incomplete).toBe(true);
 expect(state.result.tools.some(x=>x.name==='google_read_list')).toBe(true);
 expect(state.result.tools.some(x=>x.name==='neon_read_list')).toBe(true);
 expect(JSON.stringify(state)).not.toContain('private provider details');
});
it('limits fan-out to three active targets, with no broad automatic fallback',async()=>{
 const deps=provider();
 deps.list=vi.fn(async()=>[...targets,{name:'vercel',prefix:'vercel',
   areas:['projects'],claimedCounts:{tools:500}}]);
 const settings={pepper:'synthetic-hub-pagination-key-at-least-32-bytes'};
 const state=await runFederatedBroker('hub_search_tools',
  {query:'read',limit:10},actor,{},settings,deps);
 expect(deps.search).toHaveBeenCalledTimes(3);
 expect(state.result.authorizedTargets).toBe(4);
 expect(state.result.incomplete).toBe(true);
 expect(typeof state.result.next).toBe('string');
 const second=await runFederatedBroker('hub_search_tools',
  {query:'read',limit:10,cursor:state.result.next},actor,{},settings,deps);
 expect(second.ok).toBe(true);
 expect(second.result.scanned).toBe(1);
 expect(second.result.next).toBeNull();
 expect(deps.search).toHaveBeenCalledTimes(4);
 const denied=await runFederatedBroker('hub_search_tools',
  {query:'read',server:'nonexistent'},actor,{},{},deps);
 expect(denied.error.code).toBe('not_found');
});
it('selects a matching authorized area beyond the first three services',async()=>{
 const deps=provider();
 deps.list=vi.fn(async()=>[...targets,{name:'vercel',prefix:'vercel',
   areas:['projects'],claimedCounts:{tools:100}}]);
 const out=await runFederatedBroker('hub_search_tools',
   {query:'read',area:'projects',limit:3},actor,{},{},deps);
 expect(out.ok).toBe(true);
 expect(out.result.authorizedTargets).toBe(1);
 expect(out.result.scanned).toBe(1);
 expect(out.result.tools.map(t=>t.name)).toEqual(['vercel_read_list']);
 expect(deps.resolve).toHaveBeenCalledWith(expect.anything(),
   {actor,serverName:'vercel'},expect.anything());
});
it('does not enable provider execution or grant metadata to other identities',async()=>{
 const deps=provider();
 for(const illegal of [{...actor,mode:'live'},{...actor,allowWrites:true},
  {...actor,areas:[]},null]){
  const out=await runFederatedBroker('hub_search_tools',
   {query:'read'},illegal,{},{},deps);
  expect(out.ok).toBe(false);
 }
 for(const args of [{query:'x',limit:21},{query:'x',area:'../../bad'},
  {query:'x',server:'missing/unsafe'},{}]){
  expect((await runFederatedBroker('hub_search_tools',args,actor,{},{},deps)).ok).toBe(false);
 }
 expect((await mcpFederatedReply(req('hub_call',
  {name:'stripe_send_money',args:{}}),actor,{},{},deps)).error).toBeDefined();
 expect(deps.search).not.toHaveBeenCalled();
});

it('withholds searched RTC metadata after grant revocation or replacement during GET',async()=>{
 const deps=provider();
 const seen=new Map();
 deps.resolve=vi.fn(async(_db,{serverName})=>{
  seen.set(serverName,(seen.get(serverName)||0)+1);
  if(serverName==='google' && seen.get(serverName)===2)return null;
  return {server:serverName,prefix:serverName,grantId:serverName+'-grant',
   origin:'https://rtc.example.com',areas:['gmail','billing','database'],
   profile:'read_only',mode:'test'};
 });
 const result=await runFederatedBroker('hub_search_tools',
  {query:'read',limit:10},actor,{},{},deps);
 expect(result.ok).toBe(true);
 expect(result.result.failures).toContainEqual({server:'google',code:'unavailable'});
 expect(result.result.tools.some(t=>t.server==='google')).toBe(false);
 expect(result.result.incomplete).toBe(true);
 expect(deps.search).toHaveBeenCalledTimes(3);
});
it('refuses schema disclosure after a verified RTC grant is replaced during metadata GET',async()=>{
 const deps=provider();
 deps.resolve=vi.fn().mockResolvedValueOnce({
  grantId:'original',server:'stripe',prefix:'stripe',
  origin:'https://old.example.com',areas:['billing']})
 .mockResolvedValueOnce({
  grantId:'replacement',server:'stripe',prefix:'stripe',
  origin:'https://new.example.com',areas:['billing']});
 const result=await runFederatedBroker('hub_describe_tool',
  {name:'stripe_invoice_list'},actor,{},{},deps);
 expect(result.error.code).toBe('outside_scope');
 expect(deps.describe).toHaveBeenCalledTimes(1);
});

it('discovers a hyphenated Workspace server through one scoped Hub TEST connection',async()=>{
 const target={name:'google-workspace-mcp',prefix:'workspace',
  areas:['drive'],claimedCounts:{tools:380},readOnlyGrant:true};
 const deps=provider();
 deps.list=vi.fn(async()=>[target]);
 deps.resolve=vi.fn(async()=>({
  server:target.name,prefix:'workspace',origin:'https://google-workspace-mcp-five.vercel.app',
  pass:'synthetic-injected-pass',profile:'read_only',mode:'test',areas:['drive'],
  grantId:'00000000-0000-4000-8000-000000000001'}));
 const found=await runFederatedBroker('hub_search_tools',{
  query:'read',server:'google-workspace-mcp',area:'drive',limit:5},
  actor,{},{},deps);
 expect(found.ok).toBe(true);
 expect(found.result.tools).toEqual([expect.objectContaining({
  name:'workspace_read_list',server:'google-workspace-mcp'})]);
 expect(deps.resolve).toHaveBeenCalledWith(expect.anything(),
  {actor,serverName:'google-workspace-mcp'},expect.anything());
 const nav=await runFederatedBroker('hub_namespaces',{},actor,{},{},deps);
 expect(nav.result.namespaces).toContainEqual(expect.objectContaining({
  name:'google-workspace-mcp',prefix:'workspace',rtc:1}));
 expect(JSON.stringify(found)).not.toContain('synthetic-injected-pass');
});

it('routes ChatGPT hub_-only alias into EXACT original provider describe and guarded read',async()=>{
 const deps=provider();
 const target=targets[1];
 const grant={grantId:'stable-grant',server:'stripe',prefix:'stripe',
   origin:'https://rtc.example.com',pass:'synthetic-injected-pass',
   mode:'test',profile:'read_only',areas:['billing']};
 deps.list=vi.fn(async()=>[target]);
 deps.resolve=vi.fn(async()=>grant);
 deps.describe=vi.fn(async()=>({
  name:'stripe_invoice_list',area:'billing',description:'Scoped read',
  profiles:['read_only'],inputSchema:{type:'object'},writes:false,
  money:false,destructive:false,annotations:{readOnlyHint:true}}));
 deps.correlation=vi.fn(()=>'synthetic-correlation');
 deps.audit=vi.fn(async()=>({}));
 deps.read=vi.fn(async()=>({ok:true,result:{items:[]}}));
 const describe=await mcpFederatedReply(req('hub_call',{
  name:'hub_provider_describe',args:{name:'stripe_invoice_list'}
 }),actor,{},{},deps);
 expect(describe.error).toBeUndefined();
 expect(describe.result.structuredContent.result).toMatchObject({
  name:'stripe_invoice_list',server:'stripe',writes:false});
 const called=await mcpFederatedReply(req('hub_call',{
  name:'hub_provider_read',args:{name:'stripe_invoice_list',args:{limit:1}}
 }),actor,{},{},deps);
 expect(called.error).toBeUndefined();
 expect(called.result.structuredContent.result).toEqual({items:[]});
 expect(called.result.structuredContent.name).toBe('stripe_invoice_list');
 expect(deps.read).toHaveBeenCalledExactlyOnceWith(
  expect.objectContaining({profile:'read_only',mode:'test'}),
  'stripe_invoice_list',{limit:1});
 expect(deps.audit).toHaveBeenCalledTimes(2);
 expect(JSON.stringify(called)).not.toContain('synthetic-injected-pass');
});
it('rejects hub_-only adapter alias recursion, writes and out-of-grant names before provider calls',async()=>{
 const deps=provider();
 deps.read=vi.fn();deps.describe=vi.fn();
 for(const alias of ['hub_provider_read','hub_provider_describe']){
  for(const input of [{name:'hub_health'}, {name:'stripe_send_money'},
    {name:'../workspace_whoami'},{name:'workspace_delete_user',args:'bad'}]){
   const out=await runFederatedBroker(alias,input,actor,{},{},deps);
   expect(out.ok).toBe(false);
  }
 }
 for(const blocked of [{...actor,mode:'live'},{...actor,allowWrites:true},
   {...actor,areas:['mail']}]) {
  const result=await runFederatedBroker('hub_provider_read',{
    name:'stripe_invoice_list',args:{}},blocked,{},{},deps);
  expect(result.ok).toBe(false);
 }
 expect(deps.read).not.toHaveBeenCalled();
});
