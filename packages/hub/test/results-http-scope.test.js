import {it,expect,vi} from 'vitest';
import openapi from '../../../api/openapi.json.js';
import {handleHubResult} from '../src/results-http.js';
const rtc='rtc_'+'a'.repeat(43),legacy='b'.repeat(43);
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},
 status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
async function invoke(actor,{handle=rtc,authorize,readRtc,readLegacy,...request}={}){
 const deps={withDb:vi.fn(async fn=>fn({},{})),authorize:authorize??vi.fn(async()=>({actor})),
  readRtc:readRtc??vi.fn(async()=>({encoding:'base64url',data:'e30',page:0,pages:1,next:null})),
  readLegacy:readLegacy??vi.fn(async()=>({encoding:'base64url',data:'e30',page:0,pages:1,next:null}))};
 const res=response();await handleHubResult({method:'GET',headers:{},query:{handle},...request},res,deps);
 return {res,deps};
}
const base={id:'fixture-id',ownerId:'fixture-owner',mode:'live',profile:'read_only',areas:['gateway'],allowWrites:false};
it.each(['test','live'].flatMap(mode=>[['read_only',false],['everyday',false],['everyday',true],['full',false],['full',true]]
 .map(([profile,allowWrites])=>({mode,profile,allowWrites}))))('RTC HTTP accepts $mode/$profile delegated=$allowWrites through original reader',async scope=>{
 const actor={...base,...scope},{res,deps}=await invoke(actor);
 expect(res.code).toBe(200);expect(res.headers['Cache-Control']).toBe('no-store');
 expect(deps.readRtc).toHaveBeenCalledWith({},actor,rtc,0,{});
 expect(deps.readLegacy).not.toHaveBeenCalled();
});
it.each([{mode:'unknown'},{profile:'unknown'},{areas:[]},{areas:'gateway'},
 {profile:'read_only',allowWrites:true}])('refuses malformed RTC caller scope before decrypting %j',async change=>{
 const {res,deps}=await invoke({...base,...change});expect(res.code).toBe(403);
 expect(deps.readRtc).not.toHaveBeenCalled();expect(deps.readLegacy).not.toHaveBeenCalled();
});
it('legacy handles retain TEST/no-write restriction and never reach RTC storage',async()=>{
 for(const actor of [base,{...base,profile:'full',allowWrites:true,mode:'test'}]){
  const {res,deps}=await invoke(actor,{handle:legacy});expect(res.code).toBe(403);
  expect(deps.readLegacy).not.toHaveBeenCalled();expect(deps.readRtc).not.toHaveBeenCalled();
 }
 const {res,deps}=await invoke({...base,mode:'test'},{handle:legacy});
 expect(res.code).toBe(200);expect(deps.readLegacy).toHaveBeenCalledTimes(1);
 expect(deps.readRtc).not.toHaveBeenCalled();
});
it('authorization, rate limits and missing or failed reads retain bounded private errors',async()=>{
 let out=await invoke(base,{authorize:async()=>null});expect(out.res.code).toBe(401);
 expect(out.deps.readRtc).not.toHaveBeenCalled();
 out=await invoke(base,{authorize:async()=>({retryAfter:19})});
 expect(out.res.code).toBe(429);expect(out.res.headers['Retry-After']).toBe('19');
 out=await invoke(base,{readRtc:async()=>null});expect(out.res.code).toBe(404);
 out=await invoke(base,{readRtc:async()=>{throw Error('private encrypted record');}});
 expect(out.res.code).toBe(503);expect(JSON.stringify(out.res.body)).not.toContain('private');
});
it('malformed method/handle/page never opens storage',async()=>{
 for(const request of [{method:'POST'},{query:{handle:'bad'}},{query:{handle:rtc,page:'16'}},
  {query:{handle:rtc,page:['0']}}]){
  const {res,deps}=await invoke(base,request);expect([400,405]).toContain(res.code);
  expect(deps.withDb).not.toHaveBeenCalled();
 }
});

it('OpenAPI documents the actual bounded result route and supported read modes',()=>{
 const res=response();openapi({method:'GET'},res);
 expect(res.code).toBe(200);
 const route=res.body.paths['/api/results/{handle}'];
 expect(route.get.security).toEqual([{hubPass:[]}]);
 expect(route.parameters.find(p=>p.name==='page').schema).toMatchObject({minimum:0,maximum:15});
 expect(res.body.paths['/api/tools'].get.summary).toContain('TEST/LIVE');
});
