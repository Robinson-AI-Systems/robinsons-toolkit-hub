import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {issueHubChangeCursor,readHubChangeCursor,listHubRecentChanges}
 from '../src/recent-changes.js';
import {runFederatedBroker} from '../src/federation.js';
import {handleOwnerChanges,renderOwnerChanges} from '../src/owner-changes.js';

const settings={pepper:'synthetic-h5-history-HMAC-key-longer-than-32-bytes'};
const actor={id:randomUUID(),ownerId:'owner-one',mode:'test',
 profile:'read_only',areas:['gateway'],allowWrites:false};
const scope={ownerId:actor.ownerId,kind:'pass',callerId:actor.id,serverName:'stripe'};
const rows=[1,2,3].map((n)=>({id:String(n),occurred_at:new Date('2026-10-01T12:00:00Z'),
 caller_kind:'pass',caller_id:actor.id,server_name:'stripe',
 tool_name:'stripe_read_report',correlation_id:randomUUID(),
 outcome:n===1?'success':n===2?'refused':null,
 upstream_log_id:n===1?'provider_log_1':null}));
const makeDb=(given=rows)=>({query:vi.fn(async()=>({rows:given}))});
it('HMAC cursor is time-bounded and exact caller and service scoped',()=>{
 const cursor=issueHubChangeCursor(scope,'123',settings,{now:()=>1_000_000});
 expect(readHubChangeCursor(cursor,scope,settings,{now:()=>1_001_000})).toBe('123');
 for(const changed of [{...scope,callerId:randomUUID()},
  {...scope,ownerId:'another-owner'},{...scope,serverName:'workspace'},
  {...scope,kind:'oauth'}]){
  expect(()=>readHubChangeCursor(cursor,changed,settings,{now:()=>1_001_000})).toThrow();
 }
 expect(()=>readHubChangeCursor(cursor,scope,settings,{now:()=>1_301_000})).toThrow();
 expect(()=>readHubChangeCursor(cursor.slice(0,8)+'Q'+cursor.slice(9),
   scope,settings,{now:()=>1_001_000})).toThrow();
 expect(()=>issueHubChangeCursor(scope,'0',settings)).toThrow();
});
it('filters live caller grants, returns only permitted receipts, and uses stable SQL keysets',async()=>{
 const db=makeDb([...rows].reverse());
 const eligible=vi.fn(async()=>[{name:'stripe',areas:['billing']}]);
 const found=await listHubRecentChanges(db,{ownerId:actor.ownerId,actor,
  serverName:'stripe',limit:2},settings,{eligible});
 expect(found.count).toBe(2);
 expect(found.next).toEqual(expect.any(String));
 expect(found.changes[0]).toMatchObject({connection:'pass',
   server:'stripe',serverLogId:null,summary:'RTC read attempted; outcome not recorded'});
 expect(found.changes[1]).toMatchObject({outcome:'refused',serverLogId:null});
 expect(JSON.stringify(found)).not.toContain('password');
 expect(db.query.mock.calls[0][1]).toEqual([
  actor.ownerId,'pass',actor.id,'stripe',null,3,['stripe']]);
 const next=await listHubRecentChanges(db,{ownerId:actor.ownerId,actor,
  serverName:'stripe',limit:2,cursor:found.next},settings,{eligible});
 expect(db.query.mock.calls[1][1][4]).toBe('2');
 expect(next.count).toBe(2); // mocked database; real SQL enforces keyset
 expect(eligible).toHaveBeenCalledTimes(2);
 const noAccess=await listHubRecentChanges(makeDb([]),
  {ownerId:actor.ownerId,actor,limit:3},settings,{
   eligible:async()=>[]});
 expect(noAccess.count).toBe(0);
 const refused=[{...actor,mode:'live'},{...actor,allowWrites:true},
   {...actor,ownerId:'wrong'}];
 for(const invalid of refused)
  await expect(listHubRecentChanges(db,{ownerId:actor.ownerId,
   actor:invalid},settings,{eligible})).rejects.toThrow();
 await expect(listHubRecentChanges(db,{ownerId:actor.ownerId},
  settings)).rejects.toThrow();
});
it('owner history never needs caller identity and preserves real pending/uncertain statuses',async()=>{
 const db=makeDb(rows);
 const data=await listHubRecentChanges(db,{ownerId:actor.ownerId,
  limit:10},settings,{ownerVerified:true});
 expect(data.changes.map(x=>x.outcome)).toEqual(['success','refused','pending']);
 expect(data.changes[0].serverLogId).toBe('provider_log_1');
 expect(db.query.mock.calls[0][1][1]).toBeNull();
 expect(db.query.mock.calls[0][1][6]).toBeNull();
});
it('optional provider history requires one exact advertised read-only capability; no broad fallback',async()=>{
 const fixedGrantId=randomUUID();
 const transport={
   history:vi.fn(async()=>({changes:[],count:0,next:null})),
   list:vi.fn(async()=>[{name:'stripe',prefix:'stripe',areas:['billing']}]),
   resolve:vi.fn(async()=>({
     grantId:fixedGrantId,server:'stripe',prefix:'stripe',areas:['billing'],
     profile:'read_only',mode:'test',origin:'https://stripe.example.com'})),
   search:vi.fn(async()=>({tools:[{
     name:'stripe_recent_changes',server:'stripe',area:'billing',
     writes:false,money:false,destructive:false,
     annotations:{readOnlyHint:true}}],incomplete:false})),
   describe:vi.fn(async()=>({name:'stripe_recent_changes',area:'billing',
     writes:false,money:false,destructive:false,annotations:{readOnlyHint:true}})),
   read:vi.fn(async()=>({ok:true,result:{count:1},logged:{id:'real-synthetic-id'}})),
   audit:vi.fn(async()=>1),correlation:randomUUID
 };
 const state=await runFederatedBroker('hub_recent_changes',{
  server:'stripe',includeUpstream:true,limit:3},actor,{},settings,transport);
 expect(state.ok).toBe(true);
 expect(state.result.upstream).toMatchObject({server:'stripe',status:'read_only_test'});
 expect(transport.read).toHaveBeenCalledTimes(1);
 expect(transport.audit).toHaveBeenCalledTimes(2);
 transport.read.mockClear();
 transport.search.mockResolvedValue({tools:[],incomplete:false});
 const absent=await runFederatedBroker('hub_recent_changes',{
  server:'stripe',includeUpstream:true},actor,{},settings,transport);
 expect(absent.result.upstream.status).toBe('unavailable');
 expect(transport.read).not.toHaveBeenCalled();
 const refused=await runFederatedBroker('hub_recent_changes',{
  includeUpstream:true},actor,{},settings,transport);
 expect(refused.error.code).toBe('invalid_args');
});
function res(){return {headers:{},code:0,body:null,setHeader(k,v){
 this.headers[k]=v;return this;},status(k){this.code=k;return this;},
 send(x){this.body=x;return this;}};}
async function ownerRequest(method,body,overrides={}){
 const target=res();
 const req={method,body,headers:{'content-type':'application/x-www-form-urlencoded'},
  socket:{remoteAddress:'127.0.0.1'}};
 const verify=vi.fn(async(_db,_req,pass)=>({approved:pass==='approved',retryAfter:0}));
 const read=vi.fn(async()=>({changes:[{...rows[0],at:rows[0].occurred_at,
  connection:'pass',callerId:actor.id,server:'stripe',tool:'stripe_read_report',
  summary:'A harmless RTC read',serverLogId:'log-1'}],count:1,next:null}));
 await handleOwnerChanges(req,target,{
  withDb:async fn=>fn({},settings),env:{HUB_OWNER_ID:actor.ownerId,
   HUB_PUBLIC_ORIGIN:'https://hub.example.com'},verify,read,...overrides});
 return {target,verify,read};
}
it('owner route is password gated, no-store, bounded and safely escaped',async()=>{
 const get=await ownerRequest('GET');
 expect(get.target.code).toBe(200);
 expect(get.verify).not.toHaveBeenCalled();
 expect(get.read).not.toHaveBeenCalled();
 expect(get.target.headers['Cache-Control']).toBe('no-store');
 const bad=await ownerRequest('POST','password=approved&server=../../');
 expect(bad.target.code).toBe(400);
 expect(bad.verify).not.toHaveBeenCalled();
 const denied=await ownerRequest('POST','password=wrong&server=stripe');
 expect(denied.target.code).toBe(401);
 expect(denied.read).not.toHaveBeenCalled();
 const allowed=await ownerRequest('POST','password=approved&server=stripe');
 expect(allowed.target.code).toBe(200);
 expect(allowed.read).toHaveBeenCalledWith({},{
  ownerId:actor.ownerId,serverName:'stripe',cursor:null,limit:20},
  settings,{ownerVerified:true});
 const html=renderOwnerChanges({changes:[{
  at:'2026-10-01',server:'<script>oops</script>',outcome:'pending',
  connection:'pass',callerId:actor.id,tool:'stripe_read_report',
  summary:'<img src=x onerror=alert(1)>',correlationId:randomUUID(),
  serverLogId:null}],count:1,next:'opaque-signed-cursor'},'stripe');
 expect(html).toContain('&lt;script&gt;');
 expect(html).not.toContain('<script>');
 expect(html).not.toContain('<img');
 expect(html).toContain('name="cursor"');
 expect(html).not.toContain('approved');
});
