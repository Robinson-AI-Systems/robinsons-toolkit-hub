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
const tables=['hub_servers','hub_server_grants','hub_rtc_read_audit','hub_rtc_result_handles'];
const columns=[...['name','owner_id','state'].map(column_name=>({table_name:'hub_servers',column_name})),
 ...['owner_id','server_name','mode','revoked_at','expires_at','verified_at'].map(column_name=>({table_name:'hub_server_grants',column_name}))];
const constraints=[
 ['hub_server_grants','hub_grant_selected_profile',"CHECK ((profile = ANY (ARRAY['read_only'::text, 'everyday'::text, 'full'::text])))"],
 ['hub_server_grants','hub_grant_selected_mode',"CHECK ((mode = ANY (ARRAY['test'::text, 'live'::text])))"]]
 .map(([table_name,conname,definition])=>({table_name,conname,definition,convalidated:true}));
function fixtureDb({tableRows=tables.map(table_name=>({table_name})),columnRows=columns,
 constraintRows=constraints,grantRows=[{mode:'test',grants:2,verified:2,registered_services:2}]}={}) {
 return {query:vi.fn(async sql=>{
  if(sql.includes('information_schema.tables'))return {rows:tableRows};
  if(sql.includes('information_schema.columns'))return {rows:columnRows};
  if(sql.includes('pg_constraint'))return {rows:constraintRows};
  if(sql.includes('GROUP BY'))return {rows:grantRows};
  return {rows:[{servers:2,active:2}]};
 })};
}
async function invoke(method,body,extra={}) {
 const res=response(),{query}=fixtureDb();
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
 expect(res.body).toContain('Check private readiness');
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
 expect(res.body).toContain('Unexpired TEST grants');
 expect(res.body).not.toContain(goodKey);
 expect(res.body).not.toContain('owner-a');
 expect(query).toHaveBeenCalledTimes(5);
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
 expect(db.query).toHaveBeenCalledTimes(3);
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
 expect(res.body).toContain('Distinct active registered TEST services with verified grants');
 expect(res.body).toContain('Two-service TEST routing preflight: not ready');
});

it('never lets LIVE grants satisfy TEST counts or TEST grants satisfy LIVE configuration',async()=>{
 const db=fixtureDb({grantRows:[{mode:'live',grants:3,verified:3,registered_services:2}]});
 const state=await summarizeHubReadiness(db,'owner-a',{grantsKey:goodKey,resultsKey:goodKey});
 expect(state.modes.test.registeredServices).toBe(0);
 expect(state.modes.live.registeredServices).toBe(2);
 expect(state.readyServices).toBe(0);
 const {res}=await invoke('POST','password=fixture-owner',{summarize:async()=>state});
 expect(res.body).toContain('LIVE read configuration preflight: ready');
 expect(res.body).toContain('TEST read configuration preflight: not ready');
 expect(res.body).toContain('Two-service TEST routing preflight: not ready');
 expect(res.body).toContain('Current caller authorization');
 expect(res.body).toContain('Optional OAuth write-delegation schema (024): <strong>not ready');
});
it('four table names without verified_at do not trigger unsafe count queries',async()=>{
 const db=fixtureDb({columnRows:columns.filter(r=>r.column_name!=='verified_at')});
 const state=await summarizeHubReadiness(db,'owner-a',{});
 expect(state).toMatchObject({installedTables:4,schemaReady:false,liveGrantSchemaReady:false});
 expect(db.query).toHaveBeenCalledTimes(3);
 const {res}=await invoke('POST','password=fixture-owner',{summarize:async()=>state});
 expect(res.body).toContain('Verified LIVE grants: <strong>unavailable');
});
it.each(['missing','unvalidated','wrong definition','foreign table'])(
 'selected-mode schema refuses %s constraints',async kind=>{
 const rows=constraints.map(x=>({...x}));
 if(kind==='missing')rows.pop();
 if(kind==='unvalidated')rows[1].convalidated=false;
 if(kind==='wrong definition')rows[1].definition="CHECK (mode = 'test'::text)";
 if(kind==='foreign table')rows[1].table_name='unrelated';
 const state=await summarizeHubReadiness(fixtureDb({constraintRows:rows}),'owner-a',{});
 expect(state.liveGrantSchemaReady).toBe(false);
});
it('only queries owner-scoped counts and catalog metadata, never credential columns',async()=>{
 const db=fixtureDb();await summarizeHubReadiness(db,'owner-a',{});
 for(const [sql,args] of db.query.mock.calls){
  expect(sql).not.toMatch(/ciphertext|pass_digest|refresh_digest|INSERT|UPDATE|DELETE|ALTER/i);
  if(sql.includes('count(')){expect(sql).toContain('owner_id=$1');expect(args).toEqual(['owner-a']);}
 }
});

it('reports optional OAuth connection readiness without touching credential or plaintext columns',async()=>{
 const oauthTables=['hub_upstream_oauth_connections','hub_upstream_oauth_result_handles'];
 const query=vi.fn(async(sql,_args)=>{
  if(sql.includes('information_schema.tables'))return {
   rows:[...tables,...oauthTables].map(table_name=>({table_name}))};
  if(sql.includes('information_schema.columns'))return {rows:columns};
  if(sql.includes('pg_constraint'))return {rows:constraints};
  if(sql.includes('FROM hub_upstream_oauth_connections'))return {rows:[
   {mode:'live',total:3,renewable:2,expires_soon:1,reconnect_required:1},
   {mode:'test',total:1,renewable:1,expires_soon:0,reconnect_required:0}
  ]};
  if(sql.includes('GROUP BY'))return {rows:[]};
  return {rows:[{servers:1,active:1}]};
 });
 const db={query};
 const state=await summarizeHubReadiness(db,'owner-a',{
  grantsKey:goodKey,resultsKey:goodKey});
 expect(state).toMatchObject({schemaReady:true,installedTables:4,
  oauthSchemaReady:true,oauth:{installed:true,live:3,test:1,renewable:3,
   expiresSoon:1,reconnectRequired:1}});
 const {res}=await invoke('POST','password=fixture-owner',{
  summarize:async()=>state});
 expect(res.body).toContain('Stored LIVE OAuth connections');
 expect(res.body).toContain('Issuer-renewable connections');
 expect(res.body).toContain('NOT tested provider authorization');
 expect(res.body).not.toContain(goodKey);
 for(const [sql,args] of query.mock.calls){
  expect(sql).not.toMatch(/secret_enc|access_token|refresh_token|pass_digest|DELETE|UPDATE/i);
  if(sql.includes('FROM hub_upstream_oauth_connections'))
   expect(args).toEqual(['owner-a']);
 }
});
