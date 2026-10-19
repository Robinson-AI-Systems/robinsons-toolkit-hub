import {beforeEach,it,expect,vi} from 'vitest';
const runtime=vi.hoisted(()=>({withHubDb:vi.fn(),hubActor:vi.fn()}));
vi.mock('../src/runtime.js',()=>runtime);
import handler from '../../../api/whoami.js';
import {mcpReply} from '../src/http-door.js';
const db={},settings={};
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},
 status(n){this.code=n;return this;},json(body){this.body=body;return this;}};}
const req={method:'GET',headers:{authorization:'Bearer FAKE_identity_route_fixture'}};
beforeEach(()=>{vi.resetAllMocks();runtime.withHubDb.mockImplementation(fn=>fn(db,settings));});
it.each(['test','live'].flatMap(mode=>[['read_only',false],['everyday',false],
 ['everyday',true],['full',false],['full',true]].map(([profile,allowWrites])=>
 ({mode,profile,allowWrites}))))('HTTP/native parity for $mode/$profile writes=$allowWrites',async selection=>{
 const actor={...selection,id:'private-caller-id',ownerId:'private-owner-id',areas:['gateway'],
  passDigest:'private-digest-must-not-return',serverNames:['private-selection']};
 runtime.hubActor.mockResolvedValue({actor});
 const res=response();await handler(req,res);
 expect(res.code).toBe(200);expect(res.headers['Cache-Control']).toBe('no-store');
 expect(runtime.hubActor).toHaveBeenCalledWith(db,settings,req.headers.authorization,'pass');
 const native=mcpReply({jsonrpc:'2.0',method:'tools/call',id:1,params:{name:'hub_whoami'}},actor);
 expect(res.body).toEqual({ok:true,result:native.result.structuredContent});
 expect(Object.keys(res.body.result).sort()).toEqual(['allowWrites','areas','mode','profile']);
 expect(JSON.stringify(res.body)).not.toContain('private-');
});
it.each([undefined,null,1,'true',false])('never infers write delegation from non-true value %s',async allowWrites=>{
 runtime.hubActor.mockResolvedValue({actor:{profile:'full',mode:'live',areas:['gateway'],allowWrites}});
 const res=response();await handler(req,res);
 expect(res.body.result.allowWrites).toBe(false);
});
it('denies missing/revoked authorization before any identity response',async()=>{
 runtime.hubActor.mockResolvedValue(null);const res=response();await handler(req,res);
 expect(res.code).toBe(401);expect(res.body).toEqual({ok:false,error:{code:'permission'}});
});
it('retains shared rate-limit denial and method refusal',async()=>{
 runtime.hubActor.mockResolvedValue({retryAfter:17});let res=response();await handler(req,res);
 expect(res.code).toBe(429);expect(res.headers['Retry-After']).toBe('17');
 expect(res.body).toEqual({ok:false,error:{code:'rate_limited'}});
 runtime.withHubDb.mockClear();res=response();await handler({...req,method:'POST'},res);
 expect(res.code).toBe(405);expect(runtime.withHubDb).not.toHaveBeenCalled();
});
it('storage failure leaks no internal error or identity',async()=>{
 runtime.withHubDb.mockRejectedValue(Error('private database configuration'));
 const res=response();await handler(req,res);
 expect(res.code).toBe(503);expect(res.body).toEqual({ok:false,error:{code:'unavailable'}});
});
