import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {genericFederationDependencies} from '../src/oauth-federation.js';
import {mcpReply} from '../src/http-door.js';

const actor={id:randomUUID(),clientId:'test-hub-client',ownerId:'test-owner',
 profile:'read_only',mode:'live',areas:['gateway'],allowWrites:false};
const ids=[randomUUID(),randomUUID()];
const roster=['workspace','stripe'].map((prefix,i)=>({
 id:ids[i],name:prefix+'-mcp',prefix,mode:'live',profile:'read_only',
 origin:'https://'+prefix+'.example.org',areas:[prefix==='workspace'?'files':'billing'],
 expiresAt:'2026-12-01T00:00:00Z',family:randomUUID()
}));
const metadata=prefix=>({name:prefix+'_read_records',
 area:prefix==='workspace'?'files':'billing',
 profiles:['read_only'],description:'Read authorized records',
 writes:false,money:false,destructive:false,
 annotations:{readOnlyHint:true},
 inputSchema:{type:'object',properties:{limit:{type:'integer'}}}});
function fixture(all=roster){
 const sent=[];
 const post=vi.fn(async(url,options)=>{
  sent.push({url,tool:options.body?.params?.name,args:options.body?.params?.arguments,
   method:options.method,contentBytes:Buffer.byteLength(JSON.stringify(options.body))});
  expect(options.method).toBe('POST');
  expect(options.body?.method).toBe('tools/call');
  expect(options.body?.params?.name).toMatch(/_(search_tools|describe_tool|call)$/);
  const prefix=options.body.params.name.split('_')[0];
  const meta=metadata(prefix);
  if(options.body.params.name.endsWith('_search_tools'))return {
   jsonrpc:'2.0',id:1,result:{structuredContent:{tools:[meta],next:null}}};
  if(options.body.params.name.endsWith('_describe_tool'))return {
   jsonrpc:'2.0',id:1,result:{structuredContent:meta}};
  return {jsonrpc:'2.0',id:1,result:{structuredContent:{
   ok:true,result:{kind:'fixture-data',count:1}}}};
 });
 const db={query:vi.fn(async()=>({rows:[{id:1}]}))};
 const oauthList=vi.fn(async()=>all);
 const oauthWith=vi.fn(async(_db,_settings,{id},work)=>{
  const found=all.find(x=>x.id===id);
  if(!found)throw Error('Not scoped');
  return work({...found,resource:found.origin+'/api/mcp',
    accessToken:'synthetic-access'},post);
 });
 const deps=genericFederationDependencies({actor,db,settings:{}},{
  oauthList,oauthWith,legacyList:vi.fn(async()=>[]),
  legacyResolve:vi.fn(async()=>null),
  legacySearch:vi.fn(),legacyDescribe:vi.fn(),legacyRead:vi.fn(),legacyAudit:vi.fn()});
 return {deps,sent,post,db,oauthList,oauthWith};
}
it('keeps one compact Hub MCP tool list for one service, 100 services and 10,000 provider tools',()=>{
 const initial=mcpReply({jsonrpc:'2.0',id:1,method:'tools/list',params:{}},actor);
 expect(initial.error).toBeUndefined();
 const encoded=JSON.stringify(initial.result.tools);
 expect(initial.result.tools.length).toBeLessThan(20);
 expect(encoded).not.toContain('workspace_read_records');
 expect(encoded).not.toContain('stripe_read_records');
 // No up-front remote call or injected tool list is needed to build menu.
 const fake10k=Array.from({length:100},(_,i)=>({name:'remote'+i,count:100}));
 expect(fake10k.reduce((n,x)=>n+x.count,0)).toBe(10000);
 expect(Buffer.byteLength(encoded)).toBeLessThan(16000);
 const again=mcpReply({jsonrpc:'2.0',id:2,method:'tools/list',params:{}},actor);
 expect(JSON.stringify(again.result.tools)).toBe(encoded);
});
it('discovers two unrelated OAuth services through the same generic RTC1 read transport',async()=>{
 const {deps,post,sent}=fixture();
 const all=await deps.list(null,actor,{limit:100});
 expect(all).toHaveLength(2);
 expect(all.map(x=>x.name)).toEqual(['stripe-mcp','workspace-mcp']);
 expect(post).not.toHaveBeenCalled();
 const target=all.find(x=>x.name==='workspace-mcp');
 const grant=await deps.resolve(null,{actor,serverName:target.name},{});
 expect(grant).toMatchObject({kind:'oauth',grantId:ids[0],mode:'live',
  profile:'read_only',areas:['files']});
 const found=await deps.search(grant,{query:'record',limit:1});
 expect(found.tools).toEqual([expect.objectContaining({
  name:'workspace_read_records',writes:false,area:'files'})]);
 const detail=await deps.describe(grant,'workspace_read_records');
 expect(detail.inputSchema).toMatchObject({type:'object'});
 const read=await deps.read(grant,'workspace_read_records',{limit:1});
 expect(read).toEqual({ok:true,result:{kind:'fixture-data',count:1}});
 expect(sent.map(x=>x.tool)).toEqual([
  'workspace_search_tools','workspace_describe_tool','workspace_call']);
 expect(sent.every(x=>x.contentBytes<2048)).toBe(true);
 expect(sent.every(x=>x.method==='POST')).toBe(true);
 expect(JSON.stringify([found,detail,read])).not.toContain('synthetic-access');
});
it('rejects provider write tool metadata and disallowed areas before they enter Hub search',async()=>{
 const f=fixture(roster.slice(0,1));
 const grant=await f.deps.resolve(null,{actor,serverName:'workspace-mcp'},{});
 f.post.mockResolvedValueOnce({jsonrpc:'2.0',id:1,result:{
  structuredContent:{tools:[{...metadata('workspace'),writes:true}]}}});
 expect((await f.deps.search(grant,{query:'records',limit:1})).tools).toEqual([]);
 f.post.mockResolvedValueOnce({jsonrpc:'2.0',id:1,result:{
  structuredContent:{tools:[{...metadata('workspace'),area:'admin'}]}}});
 expect((await f.deps.search(grant,{query:'records',limit:1})).tools).toEqual([]);
 f.post.mockResolvedValueOnce({jsonrpc:'2.0',id:1,result:{
  structuredContent:{...metadata('workspace'),destructive:true}}});
 await expect(f.deps.describe(grant,'workspace_read_records')).rejects.toThrow();
});
it('durably audits a genuinely eligible OAuth caller without leaking access credentials',async()=>{
 const f=fixture(roster.slice(0,1));
 const event={actor,grantId:ids[0],service:'workspace-mcp',
  tool:'workspace_read_records',correlationId:randomUUID(),
  phase:'attempt',outcome:'allowed'};
 await f.deps.audit(f.db,event);
 expect(f.db.query).toHaveBeenCalledTimes(1);
 const args=f.db.query.mock.calls[0][1];
 expect(args).toMatchObject([actor.ownerId,roster[0].family,ids[0],
  'workspace-mcp','workspace_read_records',event.correlationId,'attempt',
  'allowed',null,actor.id]);
 expect(JSON.stringify(f.db.query.mock.calls)).not.toContain('synthetic-access');
});

it('passes through a provider refusal as the original guarded denial without retry',async()=>{
 const f=fixture(roster.slice(0,1));
 const grant=await f.deps.resolve(null,{actor,serverName:'workspace-mcp'},{});
 f.post.mockResolvedValueOnce({jsonrpc:'2.0',id:1,result:{
  structuredContent:{ok:false,error:{code:'needs_confirmation'}}}});
 const denied=await f.deps.read(grant,'workspace_read_records',{confirm:false});
 expect(denied).toEqual({ok:false,error:{code:'needs_confirmation'}});
 expect(f.post).toHaveBeenCalledTimes(1);
});

it('searches a 10,000-tool/100-server OAuth fleet with just three provider calls in one page',async()=>{
 const hundred=Array.from({length:100},(_,i)=>{
  const prefix='svc'+String(i).padStart(3,'0');
  return {id:randomUUID(),name:prefix+'-mcp',prefix,mode:'live',
   profile:'read_only',origin:'https://'+prefix+'.example.org',
   claimedCounts:{tools:100,writes:0,money:0},
   areas:['billing'],expiresAt:'2026-12-01T00:00:00Z',family:randomUUID()};
 });
 const {deps,post,oauthList}=fixture(hundred);
 const {runFederatedBroker}=await import('../src/federation.js');
 const state=await runFederatedBroker('hub_search_tools',
  {query:'records',area:'billing',limit:5},actor,{},{
   pepper:'synthetic-search-cursor-pepper-32-byte-key'},deps);
 expect(state.ok).toBe(true);
 expect(state.result.authorizedTargets).toBe(100);
 expect(state.result.scanned).toBe(3);
 expect(state.result.incomplete).toBe(true);
 expect(state.result.tools.filter(t=>t.server)).toHaveLength(3);
 expect(post).toHaveBeenCalledTimes(3);
 expect(post.mock.calls.every(([,options])=>
  options.body?.params?.arguments?.limit===1)).toBe(true);
 expect(hundred.reduce((sum,x)=>sum+x.claimedCounts.tools,0)).toBe(10000);
 const menu=mcpReply({jsonrpc:'2.0',id:1,method:'tools/list',params:{}},actor);
 expect(menu.result.tools).toHaveLength(
  mcpReply({jsonrpc:'2.0',id:2,method:'tools/list',params:{}},actor).result.tools.length);
 expect(JSON.stringify(menu)).not.toContain('svc000_read_records');
 expect(Buffer.byteLength(JSON.stringify(state.result))).toBeLessThan(8192);
 expect(oauthList).toHaveBeenCalled();
});

it('continues actual Workspace RTC1 offset pagination without losing later tools',async()=>{
 const f=fixture(roster.slice(0,1));
 const grant=await f.deps.resolve(null,{actor,serverName:'workspace-mcp'},{});
 const content=value=>({jsonrpc:'2.0',id:1,result:{
  content:[{type:'text',text:JSON.stringify(value)}]}});
 f.post.mockResolvedValueOnce(content({tools:[metadata('workspace')],count:1,
  totalMatched:55,offset:0,nextOffset:1}));
 const first=await f.deps.search(grant,{query:'',limit:1});
 expect(first.next).toEqual({kind:'offset',value:'1'});
 expect(first.incomplete).toBe(true);
 f.post.mockResolvedValueOnce(content({tools:[metadata('workspace')],count:1,
  totalMatched:55,offset:1,nextOffset:2}));
 const second=await f.deps.search(grant,{query:'',limit:1,cursor:first.next});
 expect(second.tools).toHaveLength(1);
 expect(second.next).toEqual({kind:'offset',value:'2'});
 expect(f.post.mock.calls.map(([,options])=>options.body.params.arguments))
  .toMatchObject([{query:'',limit:1},{query:'',limit:1,offset:1}]);
 expect(f.post.mock.calls[1][1].body.params.arguments)
  .not.toHaveProperty('cursor');
});
it('supports original RTC1 page and opaque continuation without guessing provider identity',async()=>{
 const f=fixture(roster.slice(0,1));
 const grant=await f.deps.resolve(null,{actor,serverName:'workspace-mcp'},{});
 for(const [key,raw,expected] of [
  ['next','2',{kind:'page',value:'2'}],
  ['nextCursor','opaque_ABC',{kind:'cursor',value:'opaque_ABC'}]
 ]) {
  f.post.mockResolvedValueOnce({jsonrpc:'2.0',id:1,
   result:{structuredContent:{tools:[metadata('workspace')],[key]:raw}}});
  const page=await f.deps.search(grant,{query:'',limit:1});
  expect(page.next).toEqual(expected);
  f.post.mockResolvedValueOnce({jsonrpc:'2.0',id:1,
   result:{structuredContent:{tools:[metadata('workspace')],next:null}}});
  const resumed=await f.deps.search(grant,{query:'',limit:1,cursor:page.next});
  expect(resumed.next).toBe(null);
  const sent=f.post.mock.calls.at(-1)[1].body.params.arguments;
  expect(sent[expected.kind]).toBe(expected.value);
 }
});
it('refuses ambiguous or malicious provider pages instead of unsafe replay',async()=>{
 const f=fixture(roster.slice(0,1));
 const grant=await f.deps.resolve(null,{actor,serverName:'workspace-mcp'},{});
 for(const unsafe of [
  {nextOffset:-1},{nextOffset:100001},{nextOffset:1,next:'2'},
  {nextCursor:'../private'},{nextPage:'0'}
 ]) {
  f.post.mockResolvedValueOnce({jsonrpc:'2.0',id:1,
   result:{structuredContent:{tools:[metadata('workspace')],...unsafe}}});
  await expect(f.deps.search(grant,{query:'',limit:1})).rejects.toThrow();
 }
 await expect(f.deps.search(grant,{query:'',limit:1,cursor:{
  kind:'offset',value:'-3'}})).rejects.toThrow();
});
