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
    inputSchema:{type:'object'},writes:false}))
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
 expect(deps.resolve).toHaveBeenCalledTimes(1);
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
  foundation:'ready',federation:'discovery_only',providerCallsEnabled:false,
  accessibleUpstreams:3});
 expect(deps.resolve).toHaveBeenCalledTimes(2);
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
 const state=await runFederatedBroker('hub_search_tools',
  {query:'read',limit:10},actor,{},{},deps);
 expect(deps.search).toHaveBeenCalledTimes(3);
 expect(state.result.authorizedTargets).toBe(4);
 expect(state.result.incomplete).toBe(true);
 expect(state.result.next).toBeNull();
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
