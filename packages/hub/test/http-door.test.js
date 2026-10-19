import { it, expect, vi } from 'vitest';
import { brokerCatalog, mcpReply, handleMcp } from '../src/http-door.js';
const actor={id:'local-actor',profile:'read_only',mode:'test',areas:['gateway']};
function reply() {
  return {headers:{},statusCode:0,body:null,setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(){return this;}};
}
it('fixed broker menu exposes fourteen Hub tools and guarded leaf reads',()=>{
  expect(brokerCatalog().map(x=>x.name)).toEqual(['hub_whoami','hub_health','hub_search_tools','hub_describe_tool','hub_call','hub_provider_read','hub_provider_describe','hub_batch','hub_recent_changes',
    'hub_workflow_plan','hub_workflow_execute','hub_workflow_status','hub_undo_run','hub_namespaces']);
  expect(mcpReply({jsonrpc:'2.0',method:'tools/list',id:1},actor).result.tools).toHaveLength(14);
  const who=mcpReply({jsonrpc:'2.0',method:'tools/call',id:2,params:{name:'hub_whoami'}},actor);
  expect(who.result.structuredContent.profile).toBe('read_only');
  expect(who.result.content[0].text).toContain('read_only');
  const search=mcpReply({jsonrpc:'2.0',method:'tools/call',id:4,
    params:{name:'hub_search_tools',arguments:{query:'health'}}},actor);
  expect(search.result.structuredContent.tools[0].name).toBe('hub_health');
  expect(mcpReply({jsonrpc:'2.0',method:'initialize',id:5,
    params:{protocolVersion:'2025-11-25'}},actor).result.protocolVersion).toBe('2025-11-25');
  const identity=mcpReply({jsonrpc:'2.0',method:'initialize',id:6,
    params:{protocolVersion:'2025-11-25'}},actor).result.serverInfo;
  expect(identity.name).toBe('robinsons-toolkit-hub');
  expect(identity.title).toBe("Robinson's Toolkit Hub by Robinson AI Systems");
  expect(mcpReply({jsonrpc:'2.0',method:'tools/call',id:3,
    params:{name:'stripe_send_money'}},actor).error.code).toBe(-32602);
});
it('authenticates before menu listing and denies shared-budget overrun',async()=>{
  const withDb=vi.fn(async fn=>fn({},{}));
  const authorize=vi.fn().mockResolvedValue(null);
  const req={method:'POST',headers:{},body:{jsonrpc:'2.0',method:'tools/list',id:1}};
  let res=reply();await handleMcp(req,res,{withDb,authorize});
  expect(res.statusCode).toBe(401);
  authorize.mockResolvedValue({retryAfter:15});
  res=reply();await handleMcp(req,res,{withDb,authorize});
  expect(res.statusCode).toBe(429);expect(res.headers['Retry-After']).toBe('15');
  authorize.mockResolvedValue({actor});
  res=reply();await handleMcp(req,res,{withDb,authorize});
  expect(res.body.result.tools).toHaveLength(14);
  authorize.mockResolvedValue({actor:{...actor,areas:['other']}});
  res=reply();await handleMcp(req,res,{withDb,authorize});
  expect(res.statusCode).toBe(403);
});
it('rejects unbounded and malformed requests without authorization lookup',async()=>{
  const withDb=vi.fn();
  for(const body of [null,[],{text:'z'.repeat(20000)}]) {
    const res=reply();await handleMcp({method:'POST',headers:{},body},res,{withDb});
    expect([400,413]).toContain(res.statusCode);
  }
  const res=reply();await handleMcp({method:'GET',headers:{}},res,{withDb});
  expect(res.statusCode).toBe(405);expect(withDb).not.toHaveBeenCalled();
});

it('validates browser Origin before any Hub auth or DB read; native clients without Origin remain supported',async()=>{
  const withDb=vi.fn(async fn=>fn({},{}));
  const authorize=vi.fn(async()=>({actor}));
  const body={jsonrpc:'2.0',id:7,method:'tools/list',params:{}};
  const origin='https://hub.example.test';
  const env=process.env.HUB_PUBLIC_ORIGIN;
  process.env.HUB_PUBLIC_ORIGIN=origin;
  try{
    for(const badOrigin of ['https://attacker.example.test','null',
      origin+':443','http://hub.example.test','https://hub.example.test.evil',
      '', ['https://hub.example.test']]){
      const res=reply();
      await handleMcp({method:'POST',headers:{origin:badOrigin},body},res,{withDb,authorize});
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({error:'invalid_origin'});
    }
    expect(withDb).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
    for(const validHeaders of [{origin},{}]){
      const res=reply();
      await handleMcp({method:'POST',headers:validHeaders,body},res,{withDb,authorize});
      expect(res.statusCode).toBe(200);
      expect(res.body.result.tools).toHaveLength(14);
    }
    expect(authorize).toHaveBeenCalledTimes(2);
  }finally{
    if(env===undefined)delete process.env.HUB_PUBLIC_ORIGIN;
    else process.env.HUB_PUBLIC_ORIGIN=env;
  }
});
it('refuses browser-origin MCP traffic if public origin is unconfigured, without DB access',async()=>{
  const original=process.env.HUB_PUBLIC_ORIGIN;
  delete process.env.HUB_PUBLIC_ORIGIN;
  try {
    const withDb=vi.fn(),res=reply();
    await handleMcp({method:'POST',headers:{origin:'https://hub.example.test'},
      body:{jsonrpc:'2.0',id:1,method:'tools/list'}},res,{withDb});
    expect(res.statusCode).toBe(503);
    expect(withDb).not.toHaveBeenCalled();
  }finally{
    if(original!==undefined)process.env.HUB_PUBLIC_ORIGIN=original;
  }
});
