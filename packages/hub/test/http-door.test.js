import { it, expect, vi } from 'vitest';
import { brokerCatalog, mcpReply, handleMcp } from '../src/http-door.js';
const actor={id:'local-actor',profile:'read_only',mode:'test',areas:['gateway']};
function reply() {
  return {headers:{},statusCode:0,body:null,setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(){return this;}};
}
it('fixed menu exposes only two genuine Hub tools',()=>{
  expect(brokerCatalog().map(x=>x.name)).toEqual(['hub_whoami','hub_health']);
  expect(mcpReply({jsonrpc:'2.0',method:'tools/list',id:1},actor).result.tools).toHaveLength(2);
  const who=mcpReply({jsonrpc:'2.0',method:'tools/call',id:2,params:{name:'hub_whoami'}},actor);
  expect(who.result.structuredContent.profile).toBe('read_only');
  expect(who.result.content[0].text).toContain('read_only');
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
  expect(res.body.result.tools).toHaveLength(2);
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
