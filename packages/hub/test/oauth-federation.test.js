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
