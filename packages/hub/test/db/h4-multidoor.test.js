// H-4 cross-door source acceptance. REAL disposable PostgreSQL state,
// synthetic independently scoped RTC providers. Never hosted acceptance.
import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {issueHubPass,authenticateHubPass,revokeHubPass}
 from '../../src/identity.js';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,
 authenticateOAuth,rotateOAuthRefresh} from '../../src/oauth.js';
import {stageCallerGrant,activateVerifiedCallerGrant,resolveActiveCallerGrant}
 from '../../src/grants.js';
import {narrowHubPassServiceAreas,narrowOAuthFamilyServiceAreas}
 from '../../src/service-area-policy.js';
import {narrowOAuthServiceProfile} from '../../src/service-profile-policy.js';
import {storeRtcResult,readRtcResult} from '../../src/rtc-results.js';
import {mcpFederatedReply,handleMcp} from '../../src/http-door.js';
import {handleHubTools} from '../../src/tools-http.js';
import {runFederatedBroker} from '../../src/federation.js';

const owner='h4_owner',pepper='synthetic-H4-multidoor-pepper-012345678901';
const settings={pepper,grantsKey:randomBytes(32).toString('base64url'),
 resultsKey:randomBytes(32).toString('base64url')};
const services=['stripe','workspace'];
let db,schema;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('Disposable SQL URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await db.connect();
 schema='h4_multidoor_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const name of [
  '001-hub-foundation.sql','002-hub-oauth.sql','004-hub-registry.sql',
  '005-hub-grants.sql','006-hub-activation.sql','008-hub-rtc-audit.sql',
  '009-hub-rtc-results.sql','010-hub-pass-servers.sql',
  '011-hub-oauth-server-scopes.sql','012-hub-grant-area-ceilings.sql',
  '015-hub-caller-service-area-policy.sql','016-hub-grant-renewal.sql',
  '017-hub-caller-service-profile-policy.sql',
  '018-hub-initial-oauth-service-areas.sql'
 ])await db.query(await readFile(new URL('../../migrations/'+name,import.meta.url),'utf8'));
 for(const name of services)
  await db.query(`INSERT INTO hub_servers
   (name,owner_id,prefix,origin,claimed_rtc,claimed_counts)
   VALUES($1,$2,$1,$3,1,'{"tools":2,"writes":0,"money":0}')`,
   [name,owner,'https://'+name+'.example.com']);
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
async function stage(actor,kind,server){
 const pass='synthetic_service_'+server+'_'+randomBytes(32).toString('base64url');
 const staged=await stageCallerGrant(db,{ownerId:owner,serverName:server,
  callerKind:kind,callerId:actor.id,areas:['billing','reports'],pass,
  ttlSeconds:3600},{ownerVerified:true,settings});
 await activateVerifiedCallerGrant(db,{ownerId:owner,id:staged.id},settings,{
  ownerVerified:true,inspect:async info=>({server:info.name,prefix:info.prefix,
   mode:'test',profile:'read_only',areas:info.areas,callable:false,
   identityVerified:true})});
 return {id:staged.id,pass};
}
function fakeTransports(){
 const read=vi.fn(async(grant,name)=>({ok:true,result:{source:grant.server,
  tool:name,value:'harmless synthetic read'},logged:{id:'rtc_source_'+grant.server}}));
 const search=vi.fn(async(grant)=>({tools:[{name:grant.server+'_read_'+grant.areas[0],
  area:grant.areas[0],writes:false,money:false,destructive:false,
  description:'Harmless scoped TEST metadata'}],incomplete:false}));
 const describe=vi.fn(async(_grant,name)=>({
  name,area:name.split('_').at(-1),writes:false,money:false,destructive:false,
  inputSchema:{type:'object'},annotations:{readOnlyHint:true}}));
 return {read,search,describe,correlation:randomUUID};
}
const req=(name,args)=>({jsonrpc:'2.0',id:41,method:'tools/call',
 params:{name,arguments:args}});
function response(){
 return {code:0,body:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.code=n;return this;},
  json(x){this.body=x;return this;},
  end(){this.ended=true;return this;}};
}
async function direct(actor,route,method,query,body,transport){
 const res=response();
 await handleHubTools({method,query,body,headers:{authorization:'Bearer fixture'}},
  res,{withDb:async cb=>cb(db,settings),
   authorize:async()=>({actor}),
   federate:(name,args,identity,client,config)=>
     runFederatedBroker(name,args,identity,client,config,transport)},route);
 return res;
}
async function native(token,method,transport){
 const res=response();
 await handleMcp({method:'POST',body:method,
  headers:{authorization:'Bearer '+token}},res,{
  withDb:async cb=>cb(db,settings),
  authorize:async(_db,_settings,bearer)=>{
   const actor=await authenticateOAuth(db,bearer.slice(7),{pepper});
   return actor?{actor}:null;
  },
  federate:(input,actor,client,config)=>
   mcpFederatedReply(input,actor,client,config,transport)
 });
 return res;
}
it('one owner pass retains two independent RTC grants across direct HTTPS and narrowing',async()=>{
 const issued=await issueHubPass(db,{ownerId:owner,profile:'read_only',
  mode:'test',allowWrites:false,areas:['gateway'],ttlSeconds:3600,
  serverNames:services},{ownerVerified:true,pepper});
 const actor=await authenticateHubPass(db,'Bearer '+issued.pass,{pepper});
 const a=await stage(actor,'pass','stripe'),b=await stage(actor,'pass','workspace');
 expect(a.pass).not.toBe(b.pass);
 const deps=fakeTransports();
 const list=await direct(actor,'list','GET',{q:'read',limit:'5'},null,deps);
 expect(list.code).toBe(200);
 expect(list.body.result.tools.map(x=>x.name))
  .toEqual(['stripe_read_billing','workspace_read_billing']);
 const item=await direct(actor,'item','POST',{name:'stripe_read_billing'},{},deps);
 expect(item.code).toBe(200);
 expect(item.body.result.server).toBe('stripe');
 const before=await storeRtcResult(db,actor,a.id,'stripe',{safe:'old'},settings);
 expect(await readRtcResult(db,actor,before.handle,0,settings)).not.toBeNull();
 const applied=await narrowHubPassServiceAreas(db,{ownerId:owner,id:actor.id,
  serverName:'stripe',areas:['reports']},{ownerVerified:true});
 expect(applied.updated).toBe(true);
 expect(await readRtcResult(db,actor,before.handle,0,settings)).toBeNull();
 const old=await direct(actor,'item','POST',{name:'stripe_read_billing'},{},deps);
 expect([403,404]).toContain(old.code);
 const preserved=await direct(actor,'item','POST',{name:'workspace_read_billing'},{},deps);
 expect(preserved.code).toBe(200);
 const batch=await direct(actor,'batch','POST',{},{
  calls:[{name:'stripe_read_billing',args:{}},
   {name:'workspace_read_billing',args:{}}]},deps);
 expect(batch.code).toBe(200);
 expect(batch.body.result.results.map(x=>x.ok)).toEqual([false,true]);
 expect(deps.read).toHaveBeenCalledTimes(3);
 expect(await revokeHubPass(db,actor.id,owner,{ownerVerified:true})).toBe(true);
 const denied=await direct(actor,'item','POST',{name:'workspace_read_billing'},{},deps);
 expect([403,404]).toContain(denied.code);
 expect(deps.read).toHaveBeenCalledTimes(3);
});
it('native MCP OAuth is independently scoped and live refresh/restrictions defeat stale actors',async()=>{
 const clientId='h4_two_service_client',redirectUri='https://agent.example.com/mcp/callback';
 const verifier='h4-multidoor-oauth-verifier-abcdefghijklmnopqrstuvwxyz';
 await registerOAuthClient(db,{ownerId:owner,clientId,redirectUri},{ownerVerified:true});
 const code=await issueOAuthCode(db,{ownerId:owner,clientId,redirectUri,
  challenge:createHash('sha256').update(verifier).digest('base64url'),
  profile:'read_only',mode:'test',areas:['gateway'],serverNames:services,
  serviceAreas:{stripe:['billing'],workspace:['reports']}},
  {ownerVerified:true,pepper});
 const issued=await exchangeOAuthCode(db,{clientId,redirectUri,verifier,code},{pepper});
 const first=await authenticateOAuth(db,issued.access_token,{pepper});
 await stage(first,'oauth','stripe');await stage(first,'oauth','workspace');
 const deps=fakeTransports();
 const search=await native(issued.access_token,
  req('hub_search_tools',{query:'read',limit:5}),deps);
 expect(search.code).toBe(200);
 expect(search.body.result.structuredContent.tools.map(x=>x.name))
  .toEqual(['stripe_read_billing','workspace_read_reports']);
 const good=await native(issued.access_token,
  req('hub_call',{name:'workspace_read_reports',args:{}}),deps);
 expect(good.body.result.structuredContent.server).toBe('workspace');
 const forbidden=await native(issued.access_token,
  req('hub_call',{name:'workspace_read_billing',args:{}}),deps);
 expect(forbidden.body.error).toBeDefined();
 const rotated=await rotateOAuthRefresh(db,{clientId,refreshToken:issued.refresh_token},{pepper});
 const fresh=await authenticateOAuth(db,rotated.access_token,{pepper});
 expect((await resolveActiveCallerGrant(db,{actor:fresh,serverName:'stripe'},settings)).areas)
  .toEqual(['billing']);
 expect((await narrowOAuthFamilyServiceAreas(db,{ownerId:owner,id:fresh.id,
   serverName:'stripe',areas:['reports']},{ownerVerified:true})).updated).toBe(false);
 const retired=await narrowOAuthServiceProfile(db,{ownerId:owner,id:fresh.id,
  serverName:'workspace',profile:'disabled'},{ownerVerified:true});
 expect(retired.updated).toBe(true);
 for(const token of [issued.access_token,rotated.access_token]){
  const now=await native(token,
   req('hub_call',{name:'workspace_read_reports',args:{}}),deps);
  expect(now.body.error).toBeDefined();
 }
 const still=await native(rotated.access_token,
  req('hub_call',{name:'stripe_read_billing',args:{}}),deps);
 expect(still.body.result.structuredContent.server).toBe('stripe');
 const mixed=await native(rotated.access_token,req('hub_batch',{calls:[
  {name:'workspace_read_reports',args:{}},{name:'stripe_read_billing',args:{}}]}),deps);
 expect(mixed.body.result.structuredContent.results.map(x=>x.ok))
  .toEqual([false,true]);
 expect(JSON.stringify(mixed.body)).not.toContain('synthetic_service_');
});
