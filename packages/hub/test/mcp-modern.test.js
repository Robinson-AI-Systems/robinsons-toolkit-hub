import {it,expect,vi} from 'vitest';
import {handleMcp,mcpFederatedReply} from '../src/http-door.js';
import {checkModernMcp} from '../src/mcp-modern.js';
const actor={id:'test-actor',ownerId:'owner-a',mode:'live',profile:'read_only',
 areas:['gateway'],allowWrites:false};
const meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28',
 'io.modelcontextprotocol/clientCapabilities':{},
 'io.modelcontextprotocol/clientInfo':{name:'generic-remote-mcp-client',version:'1.0.0'}};
const headers=(method,name)=>({
 'mcp-protocol-version':'2026-07-28','mcp-method':method,
 accept:'application/json, text/event-stream',
 ...(name?{'mcp-name':name}:{})});
const body=(method,name,id=1)=>({jsonrpc:'2.0',id,method,
 params:{...(name?{name,arguments:{}}:{}),_meta:meta}});
const response=()=>({headers:{},statusCode:null,body:null,
 setHeader(k,v){this.headers[k]=v;return this;},
 status(n){this.statusCode=n;return this;},
 json(o){this.body=o;return this;},end(){return this;}});
async function send(m,head,args={}){
 const res=response(),withDb=vi.fn(async fn=>fn({},{}));
 const authorize=vi.fn(async()=>({actor}));
 const federate=vi.fn(mcpFederatedReply);
 await handleMcp({method:'POST',headers:head,body:m},res,{
  withDb,authorize,federate,...args});
 return {res,withDb,authorize,federate};
}
it('supports 2026 stateless discovery, fixed cached menu and Hub identity without an initialize handshake',async()=>{
 const discover=await send(body('server/discover'),headers('server/discover'));
 expect(discover.res.statusCode).toBe(200);
 expect(discover.res.body.result).toMatchObject({
  resultType:'complete',supportedVersions:['2026-07-28','2025-11-25','2025-06-18','2025-03-26'],
  capabilities:{tools:{listChanged:false}},
  cacheScope:'private',ttlMs:60000,
  _meta:{'io.modelcontextprotocol/serverInfo':{
   name:'robinsons-toolkit-hub',title:"Robinson's Toolkit Hub by Robinson AI Systems"}}
 });
 expect(discover.federate).not.toHaveBeenCalled();
 const menu=await send(body('tools/list'),headers('tools/list'));
 expect(menu.res.statusCode).toBe(200);
 expect(menu.res.body.result.resultType).toBe('complete');
 expect(menu.res.body.result.tools).toHaveLength(14);
 expect(menu.res.body.result.cacheScope).toBe('private');
 expect(menu.res.body.result.ttlMs).toBe(60000);
 const who=await send(body('tools/call','hub_whoami'),headers('tools/call','hub_whoami'));
 expect(who.res.statusCode).toBe(200);
 expect(who.res.body.result.resultType).toBe('complete');
 expect(who.res.body.result.structuredContent.mode).toBe('live');
 expect(who.federate.mock.calls[0][0].params).not.toHaveProperty('_meta');
});
it('modern versions strictly check standard headers before auth or any provider request',async()=>{
 const base=body('tools/call','hub_whoami');
 const good=headers('tools/call','hub_whoami');
 for(const broken of [
  {...good,'mcp-protocol-version':'2025-11-25'},
  {...good,'mcp-method':'tools/list'},
  {...good,'mcp-name':'hub_health'},
  {...good,'mcp-name':undefined},
  {...good,accept:'application/json'},
  {...good,accept:'text/event-stream'},
  {...good,'mcp-protocol-version':undefined},
  {...good,'mcp-protocol-version':['2026-07-28']}
 ]){
  const z=await send(base,broken);
  expect(z.res.statusCode).toBe(400);
  expect(z.withDb).not.toHaveBeenCalled();
  expect(z.federate).not.toHaveBeenCalled();
 }
 const missingCaps=body('tools/list');missingCaps.params._meta={
  'io.modelcontextprotocol/protocolVersion':'2026-07-28'};
 const denied=await send(missingCaps,headers('tools/list'));
 expect(denied.res.statusCode).toBe(400);
 expect(denied.res.body.error.code).toBe(-32021);
 expect(denied.authorize).not.toHaveBeenCalled();
});
it('modern unknown versions explain supported versions and do not enter provider routing',async()=>{
 const req=body('tools/list');
 req.params._meta={'io.modelcontextprotocol/protocolVersion':'2099-01-01',
  'io.modelcontextprotocol/clientCapabilities':{}};
 const out=await send(req,{...headers('tools/list'),'mcp-protocol-version':'2099-01-01'});
 expect(out.res.statusCode).toBe(400);
 expect(out.res.body.error).toMatchObject({code:-32022,
  data:{requested:'2099-01-01',supported:expect.arrayContaining(['2026-07-28'])}});
 expect(out.withDb).not.toHaveBeenCalled();
});
it('modern tools/call requires matched name and never exposes unknown methods as successful tool invocations',async()=>{
 const missing=await send(body('tools/call','hub_not_a_tool'),
  headers('tools/call','hub_not_a_tool'));
 expect(missing.res.statusCode).toBe(200);
 expect(missing.res.body.error.code).toBe(-32602);
 const other=await send(body('resources/list'),headers('resources/list'));
 expect(other.res.statusCode).toBe(404);
 expect(other.res.body.error.code).toBe(-32601);
 const unsupported=await send(body('initialize'),headers('initialize'));
 expect(unsupported.res.statusCode).toBe(404);
});
it('modern direct MCP still authenticates OAuth principal and refuses unauthorized LIVE calls',async()=>{
 const req=body('tools/list'),h=headers('tools/list');
 const without=await send(req,h,{authorize:vi.fn(async()=>null)});
 expect(without.res.statusCode).toBe(401);
 expect(without.federate).not.toHaveBeenCalled();
 const outOfScope=await send(req,h,{authorize:vi.fn(async()=>({actor:{
  ...actor,areas:['files']}}))});
 expect(outOfScope.res.statusCode).toBe(403);
 expect(outOfScope.federate).not.toHaveBeenCalled();
 const noOrigin=await send(req,{...h,origin:'https://untrusted.invalid'});
 expect(noOrigin.res.statusCode).toBe(403);
 expect(noOrigin.withDb).not.toHaveBeenCalled();
});
it('legacy clients still initialize and list without modern headers or per-request metadata',async()=>{
 const legacy={jsonrpc:'2.0',id:1,method:'initialize',
  params:{protocolVersion:'2025-11-25'}};
 const result=await send(legacy,{});
 expect(result.res.statusCode).toBe(200);
 expect(result.res.body.result.protocolVersion).toBe('2025-11-25');
 expect(result.res.body.result).not.toHaveProperty('resultType');
 const list=await send({jsonrpc:'2.0',id:2,method:'tools/list'},{});
 expect(list.res.statusCode).toBe(200);
 expect(list.res.body.result.tools).toHaveLength(14);
 expect(list.res.body.result).not.toHaveProperty('ttlMs');
});
