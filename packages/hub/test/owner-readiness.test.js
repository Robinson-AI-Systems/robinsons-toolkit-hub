import {it,expect,vi} from 'vitest';
import {handleOwnerReadiness,summarizeHubReadiness} from '../src/owner-readiness.js';
const env={HUB_PUBLIC_ORIGIN:'https://hub.example',HUB_OWNER_ID:'owner-a'};
const goodKey='A'.repeat(43);
function response() {
 return {code:0,body:'',headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.code=n;return this;},
  send(v){this.body=v;return this;}};
}
async function invoke(method,body,extra={}) {
 const res=response(),query=vi.fn(async sql=>{
  if(sql.includes('information_schema'))return {rows:[
   {table_name:'hub_servers'},{table_name:'hub_server_grants'},
   {table_name:'hub_rtc_read_audit'},{table_name:'hub_rtc_result_handles'}]};
  return {rows:[{servers:2,grants:2,active:2,verified:2,ready_services:2}]};
 });
 const deps={env,withDb:async fn=>fn({query},
  {grantsKey:goodKey,resultsKey:goodKey}),
  verify:vi.fn(async(_db,_req,password)=>({approved:password==='fixture-owner'})),
  ...extra};
 await handleOwnerReadiness({method,body,headers:{
  'content-type':'application/x-www-form-urlencoded'},
  socket:{remoteAddress:'127.0.0.1'}},res,deps);
 return {res,deps,query};
}
it('GET reveals no environment, database or owner setup metadata',async()=>{
 const {res,query,deps}=await invoke('GET');
 expect(res.code).toBe(200);
 expect(res.body).toContain('Check private TEST readiness');
 expect(res.body).not.toContain(goodKey);
 expect(res.headers['Cache-Control']).toBe('no-store');
 expect(res.headers['Content-Security-Policy']).toContain("default-src 'none'");
 expect(query).not.toHaveBeenCalled();
 expect(deps.verify).not.toHaveBeenCalled();
});
it('owner-authenticated POST describes scoped TEST prerequisites without secrets',async()=>{
 const {res,query}=await invoke('POST','password=fixture-owner');
 expect(res.code).toBe(200);
 expect(res.body).toContain('Two-service TEST routing preflight: ready');
 expect(res.body).toContain('Required H-2/H-3 database tables');
 expect(res.body).toContain('Unexpired scoped TEST grants');
 expect(res.body).not.toContain(goodKey);
 expect(res.body).not.toContain('owner-a');
 expect(query).toHaveBeenCalledTimes(2);
});
it('rejects unverified owner without reading registry state',async()=>{
 const {res,query}=await invoke('POST','password=incorrect');
 expect(res.code).toBe(401);
 expect(query).not.toHaveBeenCalled();
 expect(res.body).not.toContain('database tables');
 const locked=await invoke('POST','password=x',{verify:async()=>({
  approved:false,retryAfter:20})});
 expect(locked.res.code).toBe(429);
 expect(locked.res.headers['Retry-After']).toBe('20');
});
it('labels missing grants key and incomplete migrations as not ready',async()=>{
 const db={query:vi.fn(async()=>({rows:[{table_name:'hub_servers'}]}))};
 const state=await summarizeHubReadiness(db,'owner-a',
  {grantsKey:undefined,resultsKey:goodKey});
 expect(state).toMatchObject({schemaReady:false,installedTables:1,
  grantsKeyReady:false,activeServers:0,verifiedGrants:0});
 expect(db.query).toHaveBeenCalledTimes(1);
 const {res}=await invoke('POST','password=fixture-owner',{
  summarize:async()=>state});
 expect(res.code).toBe(200);
 expect(res.body).toContain('Two-service TEST routing preflight: not ready');
});
it('rejects invalid bodies, methods and unconfigured owner without leaking errors',async()=>{
 expect((await invoke('POST','password=fixture-owner&password=other')).res.code)
  .toBe(400);
 expect((await invoke('POST','password=fixture-owner&action=list')).res.code)
  .toBe(400);
 expect((await invoke('POST','')).res.code).toBe(400);
 expect((await invoke('DELETE')).res.code).toBe(405);
 const bad=await invoke('GET',null,{env:{...env,HUB_PUBLIC_ORIGIN:'http://bad'}});
 expect(bad.res.code).toBe(503);
 const error=await invoke('POST','password=fixture-owner',{
  summarize:async()=>{throw Error('internal sensitive DB information');}});
 expect(error.res.code).toBe(503);
 expect(error.res.body).not.toContain('sensitive');
});

it('never mistakes two grants on the same service for two-service readiness',async()=>{
 const state={schemaReady:true,installedTables:4,grantsKeyReady:true,
  resultsKeyReady:true,servers:2,stagedGrants:2,activeServers:2,
  verifiedGrants:2,readyServices:1};
 const {res}=await invoke('POST','password=fixture-owner',{
  summarize:async()=>state});
 expect(res.code).toBe(200);
 expect(res.body).toContain('Distinct active TEST services with verified grants');
 expect(res.body).toContain('Two-service TEST routing preflight: not ready');
});
