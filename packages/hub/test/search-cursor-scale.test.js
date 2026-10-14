import {randomUUID} from 'node:crypto';
import {it,expect,vi} from 'vitest';
import {issueSearchCursor,openSearchCursor,searchCursorScope} from '../src/search-cursor.js';
import {runFederatedBroker} from '../src/federation.js';
import {mcpFederatedReply} from '../src/http-door.js';

const actor={id:randomUUID(),ownerId:'one-owner',clientId:'dev-fixture',
 mode:'test',profile:'full',areas:['gateway'],allowWrites:false};
const settings={pepper:'nonsecret-test-cursor-HMAC-pepper-key-32'};
const input={query:'status',area:'billing',limit:5};
const targets=n=>Array.from({length:n},(_,i)=>({
 name:'svc'+String(i).padStart(3,'0'),
 prefix:'svc'+String(i).padStart(3,'0'),areas:['billing'],
 claimedCounts:{tools:100},readOnlyGrant:true}));
const setup=all=>{
 const tools={
  list:vi.fn(async()=>all),
  resolve:vi.fn(async(_db,{serverName})=>({
   prefix:serverName,server:serverName,areas:['billing'],profile:'read_only',
   mode:'test',pass:'injected-fixture-only'})),
  search:vi.fn(async grant=>({tools:[{name:grant.prefix+'_status',
   area:'billing',description:'Harmless TEST read',writes:false,
   money:false,destructive:false}],incomplete:false}))
 };
 return tools;
};
it('signs expiring search cursors against exact caller, query and authorized set',()=>{
 const all=targets(5),scope=searchCursorScope(actor,input,all),when=1000000000000;
 const issued=issueSearchCursor(scope,3,settings,{now:()=>when});
 expect(openSearchCursor(issued,scope,settings,{now:()=>when+1000})).toBe(3);
 for(const wrong of [
   issued.slice(0,-1)+(issued.endsWith('x')?'y':'x'),issued.slice(0,9)+'Q'+issued.slice(10),
   'not-valid', 'A'.repeat(300)
 ]) expect(openSearchCursor(wrong,scope,settings,{now:()=>when+1000})).toBeNull();
 expect(openSearchCursor(issued,searchCursorScope({...actor,id:randomUUID()},input,all),
  settings,{now:()=>when})).toBeNull();
 expect(openSearchCursor(issued,searchCursorScope(actor,{...input,query:'other'},all),
  settings,{now:()=>when})).toBeNull();
 expect(openSearchCursor(issued,searchCursorScope(actor,input,all.slice(1)),
  settings,{now:()=>when})).toBeNull();
 expect(openSearchCursor(issued,scope,settings,{now:()=>when+301000})).toBeNull();
});
it('searches 2/5/12/50/100 RTC services in signed three-provider pages without eager schema',async()=>{
 for(const count of [2,5,12,50,100]){
  const all=targets(count),deps=setup(all);
  const started=performance.now(),rssBefore=process.memoryUsage().rss;
  let cursor,scanned=0,seen=new Set(),pages=0;
  do {
   const args={...input,...(cursor?{cursor}:{})};
   const response=await mcpFederatedReply({jsonrpc:'2.0',id:pages+1,
    method:'tools/call',params:{name:'hub_search_tools',arguments:args}},
    actor,{},settings,deps);
   expect(response.error).toBeUndefined();
   const result=response.result.structuredContent;
   expect(Buffer.byteLength(JSON.stringify(response),'utf8')).toBeLessThan(8192);
   expect(result.scanned).toBeLessThanOrEqual(3);
   expect(result.authorizedTargets).toBe(count);
   for(const tool of result.tools)seen.add(tool.server);
   scanned+=result.scanned;
   pages++;
   cursor=result.next;
   expect(pages).toBeLessThanOrEqual(34);
  }while(cursor);
  expect(scanned).toBe(count);
  expect(seen.size).toBe(count);
  expect(deps.search).toHaveBeenCalledTimes(count);
  expect(deps.resolve).toHaveBeenCalledTimes(count*2);
  // 100 services advertise 10,000 tools, but only one candidate per
  // selected service is returned; no eager catalogue or schema calls.
  expect(all.reduce((n,s)=>n+s.claimedCounts.tools,0)).toBe(count*100);
  console.info('H3_SCALE_SAMPLE',JSON.stringify({services:count,
   advertisedTools:count*100,pages,scanned,providerRequests:deps.search.mock.calls.length,
   elapsedMs:Number((performance.now()-started).toFixed(3)),
   rssDeltaBytes:process.memoryUsage().rss-rssBefore}));
 }
});
it('refuses stale caller/selection and invalid cursor without querying upstream',async()=>{
 const all=targets(5),deps=setup(all);
 const first=await runFederatedBroker('hub_search_tools',input,actor,{},settings,deps);
 expect(first.ok).toBe(true);
 expect(first.result.next).toBeTruthy();
 const retired=setup(all.slice(1));
 const stale=await runFederatedBroker('hub_search_tools',
  {...input,cursor:first.result.next},actor,{},settings,retired);
 expect(stale.error.code).toBe('invalid_args');
 expect(retired.search).not.toHaveBeenCalled();
 const changed=await runFederatedBroker('hub_search_tools',
  {...input,cursor:first.result.next},{...actor,id:randomUUID()},
  {},settings,deps);
 expect(changed.error.code).toBe('invalid_args');
});
it('reports metadata budget incompleteness instead of overflowing MCP structured output',async()=>{
 const deps=setup(targets(2));
 deps.search.mockImplementation(async grant=>({tools:[{
  name:grant.prefix+'_status',area:'billing',
  description:'x'.repeat(2000),writes:false,money:false,destructive:false,
  annotations:{readOnlyHint:true}}],incomplete:false}));
 const reply=await runFederatedBroker('hub_search_tools',
  {...input,limit:2},actor,{},settings,deps);
 expect(reply.ok).toBe(true);
 expect(reply.result.incomplete).toBe(false);
 expect(Buffer.byteLength(JSON.stringify(reply),'utf8')).toBeLessThan(8192);
});

it('small result limits resume every authorized service without losing or repeating targets',async()=>{
 const deps=setup(targets(5)),pages=[],seen=[];
 let cursor;
 do {
  const args={query:'status',area:'billing',limit:1,...(cursor?{cursor}:{})};
  const r=await runFederatedBroker('hub_search_tools',args,actor,{},settings,deps);
  expect(r.ok).toBe(true);
  pages.push(r.result);
  seen.push(...r.result.tools.map(t=>t.server));
  cursor=r.result.next;
 }while(cursor);
 expect(seen).toEqual(['svc000','svc001','svc002','svc003','svc004']);
 expect(pages).toHaveLength(5);
 expect(deps.search).toHaveBeenCalledTimes(5);
 const local=await runFederatedBroker('hub_search_tools',
  {query:'health',server:'hub'},actor,{},settings,deps);
 expect(local.ok).toBe(true);
 expect(local.result.tools.map(t=>t.name)).toContain('hub_health');
});


it('browses all 100 scoped services without a keyword using signed bounded continuation',async()=>{
 const all=targets(100),deps=setup(all),seen=new Set();
 let cursor,pages=0;
 do {
  const r=await runFederatedBroker('hub_search_tools',
   {query:'',limit:5,...(cursor?{cursor}:{})},actor,{},settings,deps);
  expect(r.ok).toBe(true);
  expect(r.result.scanned).toBeLessThanOrEqual(3);
  expect(Buffer.byteLength(JSON.stringify(r.result),'utf8')).toBeLessThan(8192);
  for(const item of r.result.tools)if(item.server)seen.add(item.server);
  cursor=r.result.next;
  pages++;
  expect(pages).toBeLessThanOrEqual(34);
 }while(cursor);
 expect(pages).toBe(34);
 expect(seen.size).toBe(100);
 expect(deps.resolve).toHaveBeenCalledTimes(200);
 expect(deps.search).toHaveBeenCalledTimes(100);
 const first=await runFederatedBroker('hub_search_tools',
  {query:'',limit:5},actor,{},settings,deps);
 const changed=await runFederatedBroker('hub_search_tools',
  {query:'x',limit:5,cursor:first.result.next},actor,{},settings,deps);
 expect(changed.error.code).toBe('invalid_args');
 expect(deps.search).toHaveBeenCalledTimes(103);
});


it('never silently skips scanned providers when each has more tools than a shared browse page',async()=>{
 for(const limit of [1,2,5]) {
  const deps=setup(targets(5));
  deps.search.mockImplementation(async grant=>({tools:
   Array.from({length:5},(_,i)=>({
    name:grant.prefix+'_read_'+i,area:'billing',
    description:'Safe metadata '+i,writes:false,money:false,
    destructive:false,annotations:{readOnlyHint:true}
   })),incomplete:false}));
  const seen=new Set();let cursor,pages=0,hasLocal=false;
  do {
   const r=await runFederatedBroker('hub_search_tools',
    {query:'',limit,...(cursor?{cursor}:{})},actor,{},settings,deps);
   expect(r.ok).toBe(true);
   const scanned=r.result.scanned;
   expect(scanned).toBeLessThanOrEqual(Math.min(3,limit));
   expect(r.result.incomplete).toBe(true);
   expect(r.result.tools).toHaveLength(limit);
   for(const t of r.result.tools) {
    if(t.server)seen.add(t.server);
    if(t.name==='hub_health')hasLocal=true;
   }
   cursor=r.result.next;pages++;
  }while(cursor);
  expect(seen.size).toBe(5);
  expect(deps.search).toHaveBeenCalledTimes(5);
  expect(pages).toBe(Math.ceil(5/Math.min(3,limit)));
  if(limit===5)expect(hasLocal).toBe(true);
 }
});

it('marks full-page dropped provider extras incomplete and supports selected-service follow-up',async()=>{
 const deps=setup(targets(3));
 deps.search.mockImplementation(async grant=>({tools:Array.from({length:3},(_,i)=>({
  name:grant.prefix+'_list_'+i,area:'billing',writes:false,money:false,
  destructive:false,description:'Harmless metadata',
  annotations:{readOnlyHint:true}})),incomplete:false}));
 const broad=await runFederatedBroker('hub_search_tools',
  {query:'',limit:3},actor,{},settings,deps);
 expect(broad.ok).toBe(true);
 expect(broad.result.next).toBeNull();
 expect(broad.result.incomplete).toBe(true);
 expect(broad.result.tools.map(t=>t.server)).toEqual(['svc000','svc001','svc002']);
 const focused=await runFederatedBroker('hub_search_tools',
  {query:'',server:'svc002',limit:5},actor,{},settings,deps);
 expect(focused.ok).toBe(true);
 expect(focused.result.tools.map(t=>t.name)).toEqual([
  'svc002_list_0','svc002_list_1','svc002_list_2'
 ]);
 expect(focused.result.incomplete).toBe(false);
});

it('invalidates native search and namespace continuations after same-scope grant rotation',async()=>{
 const before=targets(5).map((t,i)=>({...t,grantId:'first-'+i,
  origin:'https://svc'+i+'.example.net',verifiedAt:'2026-10-14T00:00:00Z'}));
 const original=setup(before);
 const search=await runFederatedBroker('hub_search_tools',
  {query:'status',limit:3},actor,{},settings,original);
 expect(search.ok).toBe(true);
 const namespace=await runFederatedBroker('hub_namespaces',
  {limit:2},actor,{},settings,original);
 expect(namespace.ok).toBe(true);
 const changed=before.map((t,i)=>i===1?{...t,grantId:'replacement-1'}:t);
 const after=setup(changed);
 const staleSearch=await runFederatedBroker('hub_search_tools',
  {query:'status',limit:3,cursor:search.result.next},
  actor,{},settings,after);
 const staleNamespace=await runFederatedBroker('hub_namespaces',
  {limit:2,cursor:namespace.result.next},actor,{},settings,after);
 expect(staleSearch.error.code).toBe('invalid_args');
 expect(staleNamespace.error.code).toBe('invalid_args');
 expect(after.resolve).not.toHaveBeenCalled();
 expect(after.search).not.toHaveBeenCalled();
 const moved=setup(before.map((t,i)=>i===1?
  {...t,origin:'https://moved.example.net'}:t));
 const staleOrigin=await runFederatedBroker('hub_search_tools',
  {query:'status',limit:3,cursor:search.result.next},
  actor,{},settings,moved);
 expect(staleOrigin.error.code).toBe('invalid_args');
 expect(moved.search).not.toHaveBeenCalled();
});

it('browses every page of one selected RTC service with sealed caller-bound continuation',async()=>{
 const all=targets(2).map(t=>({...t,origin:'https://rtc.example.com',
  verifiedAt:'2026-10-14T16:00:00Z',grantId:t.name+'-grant'}));
 const deps=setup(all);
 deps.search.mockImplementation(async(grant,args)=>{
  const page=args.cursor==='provider_page_2'?2:1;
  return {tools:[{name:grant.prefix+'_read_'+page,area:'billing',
   description:'Scoped page '+page,writes:false,money:false,destructive:false}],
   next:page===1?'provider_page_2':null,incomplete:page===1};
 });
 const args={query:'read',server:'svc000',area:'billing',limit:3};
 const first=await runFederatedBroker('hub_search_tools',args,actor,{},settings,deps);
 expect(first.ok).toBe(true);
 expect(first.result.tools.map(t=>t.name)).toEqual(['svc000_read_1']);
 expect(first.result.incomplete).toBe(true);
 expect(first.result.next).toMatch(/^p\./);
 expect(first.result.next).not.toContain('provider_page_2');
 expect(first.result.scanned).toBe(1);
 const followed=await runFederatedBroker('hub_search_tools',
  {...args,cursor:first.result.next},actor,{},settings,deps);
 expect(followed.ok).toBe(true);
 expect(followed.result.tools.map(t=>t.name)).toEqual(['svc000_read_2']);
 expect(followed.result.next).toBeNull();
 expect(followed.result.incomplete).toBe(false);
 expect(deps.search.mock.calls.map(c=>c[1].cursor)).toEqual([undefined,'provider_page_2']);
 expect(deps.resolve).toHaveBeenCalledTimes(4);
 for(const changed of [
  {...args,server:'svc001',cursor:first.result.next},
  {...args,query:'other',cursor:first.result.next},
  {...args,cursor:first.result.next.slice(0,-1)+'x'}
 ]){
  const rejected=await runFederatedBroker('hub_search_tools',
   changed,actor,{},settings,deps);
  expect(rejected.error.code).toBe('invalid_args');
 }
 expect(deps.search).toHaveBeenCalledTimes(2);
 const rotated=setup(all.map(t=>({...t,grantId:t.grantId+'-rotated'})));
 const stale=await runFederatedBroker('hub_search_tools',
  {...args,cursor:first.result.next},actor,{},settings,rotated);
 expect(stale.error.code).toBe('invalid_args');
 expect(rotated.search).not.toHaveBeenCalled();
 const otherActor=await runFederatedBroker('hub_search_tools',
  {...args,cursor:first.result.next},{...actor,id:randomUUID()}, {},settings,deps);
 expect(otherActor.error.code).toBe('invalid_args');
 expect(deps.search).toHaveBeenCalledTimes(2);
});
it('keeps broad service pagination distinct from focused provider page tokens',async()=>{
 const deps=setup(targets(5));
 deps.search.mockImplementation(async grant=>({tools:[{
  name:grant.prefix+'_read',area:'billing',description:'Read scoped data',
  writes:false,money:false,destructive:false
 }],next:'upstream_page_2',incomplete:true}));
 const first=await runFederatedBroker('hub_search_tools',input,actor,{},settings,deps);
 expect(first.ok).toBe(true);
 expect(first.result.next).toBeTruthy();
 expect(first.result.next.startsWith('p.')).toBe(false);
 expect(first.result.incomplete).toBe(true);
 const second=await runFederatedBroker('hub_search_tools',
  {...input,cursor:first.result.next},actor,{},settings,deps);
 expect(second.ok).toBe(true);
 expect(second.result.scanned).toBe(2);
 expect(deps.search).toHaveBeenCalledTimes(5);
 const rejected=await runFederatedBroker('hub_search_tools',
  {query:'read',server:'svc000',area:'billing',cursor:first.result.next},
  actor,{},settings,deps);
 expect(rejected.error.code).toBe('invalid_args');
});