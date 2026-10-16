import {it,expect,vi} from 'vitest';
import {handleOwnerConnectWorkspace,connectWorkspace} from '../src/owner-connect-workspace.js';
const owner='christcr2012';
const code='rtc_pass_'+('A'.repeat(43));
const env={HUB_OWNER_ID:owner,HUB_PUBLIC_ORIGIN:'https://hub.example'};
const response=()=>({code:0,body:'',headers:{},setHeader(k,v){this.headers[k]=v;return this;},
 status(n){this.code=n;return this;},send(v){this.body=v;return this;}});
async function invoke(method,body={},overrides={},query={}){
 const res=response(),deps={env,withDb:fn=>fn({},{}),
  verify:vi.fn(async(_db,_req,pass)=>({approved:pass==='synthetic-owner-auth'})),
  connect:vi.fn(async()=>({state:'prepared'})),...overrides};
 await handleOwnerConnectWorkspace({method,query,body,headers:{
  'content-type':'application/x-www-form-urlencoded'}},res,deps);
 return {res,deps};
}
it('shows simple one-page form even with protected access query parameters',async()=>{
 const {res,deps}=await invoke('GET',{}, {},{_vercel_share:'opaque-token'});
 expect(res.code).toBe(200);
 expect(res.body).toContain('Connect Google Workspace');
 expect(res.body).toContain('Hub owner passphrase');
 expect(res.body).not.toContain('Caller kind');
 expect(res.body).not.toContain('Service ID');
 expect(res.body).not.toContain('opaque-token');
 expect(deps.connect).not.toHaveBeenCalled();
});
it('requires independent owner verification before touching server registration',async()=>{
 const denied=await invoke('POST',{password:'wrong',service_pass:code});
 expect(denied.res.code).toBe(401);
 expect(denied.deps.connect).not.toHaveBeenCalled();
 const okay=await invoke('POST',{password:'synthetic-owner-auth'});
 expect(okay.res.code).toBe(202);
 expect(okay.deps.connect).toHaveBeenCalledWith({}, {},owner,null);
 expect(okay.res.body).not.toContain('synthetic-owner-auth');
 const connected=await invoke('POST',{password:'synthetic-owner-auth',service_pass:code},
  {connect:vi.fn(async()=>({state:'verified_test'}))});
 expect(connected.res.code).toBe(200);
 expect(connected.res.body).not.toContain(code);
});
it('refuses ambiguous or missing service pass and untrusted extra arguments',async()=>{
 for(const body of [
  {password:'synthetic-owner-auth',service_pass:'rtc_pass_bad'},
  {password:'synthetic-owner-auth',server:'stripe'},
  {password:'synthetic-owner-auth',service_pass:code,caller:'arbitrary'}
 ]) {
  const result=await invoke('POST',body);
  expect(result.res.code).toBe(400);
  expect(result.deps.verify).not.toHaveBeenCalled();
 }
});
const service='google-workspace-mcp';
const origin='https://google-workspace-mcp-chris-projects-de6cd1bf.vercel.app';
function stubs({found=[],whoAreas=['files','calendar'],sessions=[{id:'owned-oauth'}]}={}){
 const db={query:vi.fn(async(sql)=>{
  if(sql.includes('FROM hub_servers WHERE name'))return {rows:found};
  if(sql.includes('FROM hub_oauth_sessions'))return {rows:sessions};
  if(sql.includes('FROM hub_server_grants'))return {rows:[]};
  throw new Error('Unexpected SQL');
 })};
 const deps={probe:vi.fn(async()=>({tools:380,writes:200,money:0})),
  stage:vi.fn(async()=>({state:'pending'})),
  read:vi.fn(async()=>({ok:true,result:{
   profile:'read_only',mode:'test',allow_writes:false,areas:whoAreas}})),
  grant:vi.fn(async()=>({id:'00000000-0000-4000-8000-000000000001'})),
  activate:vi.fn(async()=>({state:'verified_test'}))};
 return {db,deps};
}
it('prepares exact canonical Workspace origin with only the owner passphrase',async()=>{
 const {db,deps}=stubs();
 const value=await connectWorkspace(db,{},owner,null,deps);
 expect(value.state).toBe('prepared');
 expect(deps.probe).toHaveBeenCalledWith(origin,{name:service,prefix:'workspace'});
 expect(deps.stage).toHaveBeenCalledWith(db,expect.objectContaining({
  ownerId:owner,name:service,origin,prefix:'workspace'}),{ownerVerified:true});
 expect(deps.read).not.toHaveBeenCalled();
 expect(deps.grant).not.toHaveBeenCalled();
 expect(deps.activate).not.toHaveBeenCalled();
});
it('autobinds exactly one eligible Hub caller, scopes to the service-owned pass and verifies',async()=>{
 const {db,deps}=stubs();
 const value=await connectWorkspace(db,{grantsKey:'synthetic'},owner,code,deps);
 expect(value.state).toBe('verified_test');
 expect(deps.read).toHaveBeenCalledWith(origin,'/api/whoami',{pass:code});
 expect(deps.grant).toHaveBeenCalledWith(db,expect.objectContaining({
  ownerId:owner,serverName:service,callerKind:'oauth',callerId:'owned-oauth',
  areas:['files','calendar'],pass:code,ttlSeconds:86400}),
  {ownerVerified:true,settings:{grantsKey:'synthetic'}});
 expect(deps.activate).toHaveBeenCalledWith(db,
  {ownerId:owner,id:'00000000-0000-4000-8000-000000000001'},
  {grantsKey:'synthetic'},{ownerVerified:true});
});
it('refuses an unknown registered origin or ambiguously eligible callers before grant',async()=>{
 const wrong=stubs({found:[{origin:'https://attacker.example.org',prefix:'workspace',state:'active'}]});
 await expect(connectWorkspace(wrong.db,{},owner,code,wrong.deps)).rejects.toThrow();
 expect(wrong.deps.grant).not.toHaveBeenCalled();
 const many=stubs({sessions:[{id:'one'},{id:'two'}]});
 expect((await connectWorkspace(many.db,{},owner,code,many.deps)).state)
  .toBe('needs_one_hub_connection');
 expect(many.deps.grant).not.toHaveBeenCalled();
 const no=stubs({sessions:[]});
 expect((await connectWorkspace(no.db,{},owner,code,no.deps)).state)
  .toBe('needs_one_hub_connection');
 expect(no.deps.grant).not.toHaveBeenCalled();
});
it('refuses a service write pass and mismatched RTC areas before storing a secret',async()=>{
 const bad=stubs();
 bad.deps.read=vi.fn(async()=>({ok:true,result:{
  mode:'test',profile:'full',allow_writes:true,areas:['files']}}));
 await expect(connectWorkspace(bad.db,{},owner,code,bad.deps)).rejects.toThrow();
 expect(bad.deps.grant).not.toHaveBeenCalled();
 const other=stubs({whoAreas:['files','unsafe_writes']});
 await expect(connectWorkspace(other.db,{},owner,code,other.deps)).rejects.toThrow();
 expect(other.deps.grant).not.toHaveBeenCalled();
});
it('uses the provider all-areas convention but still clamps to reviewed Workspace RTC areas',async()=>{
 const all=stubs({whoAreas:null});
 const result=await connectWorkspace(all.db,{},owner,code,all.deps);
 expect(result.state).toBe('verified_test');
 const scoped=all.deps.grant.mock.calls[0][1];
 expect(scoped.areas).toHaveLength(14);
 expect(scoped.areas).toContain('mail');
 expect(scoped.areas).toContain('admin');
});
