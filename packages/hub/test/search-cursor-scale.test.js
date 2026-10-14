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
  expect(deps.resolve).toHaveBeenCalledTimes(count);
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
