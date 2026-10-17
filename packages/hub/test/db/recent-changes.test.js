// H-5: full disposable PostgreSQL evidence, never a real provider request.
import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {issueHubPass,authenticateHubPass,revokeHubPass,
 narrowHubPassServers} from '../../src/identity.js';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,
 authenticateOAuth,rotateOAuthRefresh} from '../../src/oauth.js';
import {stageCallerGrant,activateVerifiedCallerGrant} from '../../src/grants.js';
import {appendRtcReadAudit} from '../../src/rtc-read-audit.js';
import {listHubRecentChanges} from '../../src/recent-changes.js';
import {mcpFederatedReply} from '../../src/http-door.js';
import {handleHubTools} from '../../src/tools-http.js';
const owner='h5_owner',pepper='synthetic-h5-owner-key-123456789012345678901';
const settings={pepper,grantsKey:randomBytes(32).toString('base64url'),
 resultsKey:randomBytes(32).toString('base64url')};
let db,schema;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await db.connect();
 schema='h5_changes_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const name of [
  '001-hub-foundation.sql','002-hub-oauth.sql','004-hub-registry.sql',
  '005-hub-grants.sql','006-hub-activation.sql','008-hub-rtc-audit.sql',
  '009-hub-rtc-results.sql','010-hub-pass-servers.sql',
  '011-hub-oauth-server-scopes.sql','012-hub-grant-area-ceilings.sql',
  '015-hub-caller-service-area-policy.sql','016-hub-grant-renewal.sql',
  '017-hub-caller-service-profile-policy.sql',
  '018-hub-initial-oauth-service-areas.sql',
  '019-hub-change-history.sql'
 ]) await db.query(await readFile(new URL('../../migrations/'+name,import.meta.url),'utf8'));
 for(const service of ['stripe','workspace'])
  await db.query(`INSERT INTO hub_servers(name,owner_id,prefix,origin,
    claimed_rtc,claimed_counts) VALUES($1,$2,$1,$3,1,
    '{"tools":2,"writes":0,"money":0}')`,
    [service,owner,'https://'+service+'.example.com']);
});
afterAll(async()=>{if(db){
 if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');
 await db.end();
}});
async function stage(actor,callerKind,serverName){
 const staged=await stageCallerGrant(db,{ownerId:owner,callerKind,
  callerId:actor.id,serverName,areas:['billing','reports'],
  pass:'rtc_pass_'+randomBytes(32).toString('base64url'),ttlSeconds:3600},
  {ownerVerified:true,settings});
 await activateVerifiedCallerGrant(db,{ownerId:owner,id:staged.id},settings,{
  ownerVerified:true,inspect:async target=>({
   server:target.name,prefix:target.prefix,mode:'test',profile:'read_only',
   areas:target.areas,identityVerified:true,callable:false
  })});
 return staged.id;
}
async function record(actor,grantId,serverName,phase,outcome,correlationId,log=null){
 return appendRtcReadAudit(db,{actor,grantId,service:serverName,
   tool:serverName+'_read_billing',correlationId,phase,outcome,
   upstreamLogId:log});
}
const history=(actor,params={})=>listHubRecentChanges(db,{
 ownerId:owner,actor,limit:10,...params},settings);
const ownerHistory=(params={})=>listHubRecentChanges(db,{
 ownerId:owner,limit:20,...params},settings,{ownerVerified:true});
function res(){return {code:0,body:null,headers:{},
 setHeader(k,v){this.headers[k]=v;return this;},
 status(n){this.code=n;return this;},json(x){this.body=x;return this;}};}
it('one H-3 RTC call gives exactly one H-5 correlated history entry and no secret',async()=>{
 const issued=await issueHubPass(db,{ownerId:owner,profile:'read_only',
  mode:'test',areas:['gateway'],allowWrites:false,ttlSeconds:3600,
  serverNames:['stripe','workspace']},{ownerVerified:true,pepper});
 const actor=await authenticateHubPass(db,'Bearer '+issued.pass,{pepper});
 const a=await stage(actor,'pass','stripe');
 const b=await stage(actor,'pass','workspace');
 const successful=randomUUID(),refused=randomUUID(),pending=randomUUID();
 await record(actor,a,'stripe','attempt','allowed',successful);
 await record(actor,a,'stripe','outcome','success',successful,'server_safe_12');
 await record(actor,b,'workspace','attempt','allowed',refused);
 await record(actor,b,'workspace','outcome','refused',refused);
 await record(actor,b,'workspace','attempt','allowed',pending);
 const source=await history(actor);
 expect(source.changes).toHaveLength(3);
 expect(source.changes.map(x=>x.outcome)).toEqual(['pending','refused','success']);
 expect(source.changes[2]).toMatchObject({
   connection:'pass',server:'stripe',serverLogId:'server_safe_12',
   correlationId:successful});
 expect(JSON.stringify(source)).not.toContain(issued.pass);
 const all=await ownerHistory();
 expect(all.changes.some(x=>x.correlationId===successful)).toBe(true);
 // The fixed native MCP and direct HTTP doors have the same actual SQL.
 const native=await mcpFederatedReply({jsonrpc:'2.0',id:7,method:'tools/call',
  params:{name:'hub_recent_changes',arguments:{server:'stripe'}}},
  actor,db,settings);
 expect(native.result.structuredContent.changes.map(x=>x.correlationId))
  .toContain(successful);
 const nested=await mcpFederatedReply({jsonrpc:'2.0',id:8,method:'tools/call',
  params:{name:'hub_batch',arguments:{calls:[
   {name:'hub_recent_changes',args:{server:'stripe'}},
   {name:'hub_whoami',args:{}}
  ]}}},actor,db,settings);
 expect(nested.result.structuredContent.results.map(x=>x.ok))
  .toEqual([true,true]);
 expect(nested.result.structuredContent.results[0].result.changes
  .map(x=>x.correlationId)).toContain(successful);
 const direct=res();
 await handleHubTools({method:'POST',query:{name:'hub_recent_changes'},
   body:{server:'stripe'},headers:{authorization:'Bearer synthetic'}},
   direct,{withDb:async fn=>fn(db,settings),authorize:async()=>({actor})},'item');
 expect(direct.code).toBe(200);
 expect(direct.body.result.changes.map(x=>x.correlationId)).toEqual(
  native.result.structuredContent.changes.map(x=>x.correlationId));
 const one=await history(actor,{serverName:'workspace',limit:1});
 expect(one.next).toBeTypeOf('string');
 const older=await history(actor,{serverName:'workspace',limit:1,cursor:one.next});
 expect(older.changes[0].outcome).toBe('refused');
 const other=await issueHubPass(db,{ownerId:owner,profile:'read_only',
  mode:'test',areas:['gateway'],allowWrites:false,ttlSeconds:3600,
  serverNames:['stripe']},{ownerVerified:true,pepper});
 const stranger=await authenticateHubPass(db,'Bearer '+other.pass,{pepper});
 expect((await history(stranger)).changes).toEqual([]);
 const narrowed=await narrowHubPassServers(db,{
  ownerId:owner,id:actor.id,serverNames:['stripe']},{ownerVerified:true});
 expect(narrowed.updated).toBe(true);
 const after=await history(actor);
 expect(after.changes.every(x=>x.server==='stripe')).toBe(true);
 expect(after.changes.some(x=>x.correlationId===refused)).toBe(false);
 expect(await revokeHubPass(db,actor.id,owner,{ownerVerified:true})).toBe(true);
 expect((await history(actor)).changes).toEqual([]);
 expect((await ownerHistory()).changes.some(x=>x.correlationId===successful)).toBe(true);
});
it('replacement grant cannot expose receipts from an older grant on the same service',async()=>{
 const issued=await issueHubPass(db,{ownerId:owner,profile:'read_only',
  mode:'test',areas:['gateway'],allowWrites:false,ttlSeconds:3600,
  serverNames:['stripe']},{ownerVerified:true,pepper});
 const actor=await authenticateHubPass(db,'Bearer '+issued.pass,{pepper});
 const previous=await stage(actor,'pass','stripe');
 const oldCorrelation=randomUUID();
 await record(actor,previous,'stripe','attempt','allowed',oldCorrelation);
 await record(actor,previous,'stripe','outcome','success',oldCorrelation,'prior_log');
 expect((await history(actor)).changes.some(x=>x.correlationId===oldCorrelation)).toBe(true);
 const renewed=await stage(actor,'pass','stripe');
 expect(renewed).not.toBe(previous);
 const now=await history(actor);
 expect(now.changes.some(x=>x.correlationId===oldCorrelation)).toBe(false);
 expect((await ownerHistory()).changes.some(x=>x.correlationId===oldCorrelation)).toBe(true);
 const newCorrelation=randomUUID();
 await record(actor,renewed,'stripe','attempt','allowed',newCorrelation);
 await record(actor,renewed,'stripe','outcome','success',newCorrelation);
 expect((await history(actor)).changes.some(x=>x.correlationId===newCorrelation)).toBe(true);
 const today=new Date().toISOString().slice(0,10);
 const scoped=await history(actor,{toolName:'stripe_read_billing',
   since:today,until:today});
 expect(scoped.changes.some(x=>x.correlationId===newCorrelation)).toBe(true);
 const noMatch=await history(actor,{toolName:'stripe_missing_tool'});
 expect(noMatch.changes).toEqual([]);
 const direct=res();
 await handleHubTools({method:'POST',query:{name:'hub_recent_changes'},
   body:{tool:'stripe_read_billing',since:today,until:today},
   headers:{authorization:'Bearer synthetic'}},
   direct,{withDb:async fn=>fn(db,settings),authorize:async()=>({actor})},'item');
 expect(direct.code).toBe(200);
 expect(direct.body.result.changes.some(x=>x.correlationId===newCorrelation)).toBe(true);
 const native=await mcpFederatedReply({jsonrpc:'2.0',id:9,method:'tools/call',
   params:{name:'hub_recent_changes',arguments:{tool:'stripe_read_billing',
     since:today,until:today}}},actor,db,settings);
 expect(native.result.structuredContent.changes.map(x=>x.correlationId))
   .toEqual(direct.body.result.changes.map(x=>x.correlationId));
 await revokeHubPass(db,actor.id,owner,{ownerVerified:true});
 expect((await history(actor)).changes).toEqual([]);
});
it('OAuth refresh caller boundaries cannot expose other sessions history',async()=>{
 const clientId='h5_history_client',redirectUri='https://agent.example.com/h5/cb';
 const verifier='h5-history-pkce-verifier-abcdefghijklmnopqrstuvwxyz';
 await registerOAuthClient(db,{ownerId:owner,clientId,redirectUri},{ownerVerified:true});
 const code=await issueOAuthCode(db,{ownerId:owner,clientId,redirectUri,
  challenge:createHash('sha256').update(verifier).digest('base64url'),
  profile:'read_only',mode:'test',areas:['gateway'],serverNames:['stripe']},
  {pepper,ownerVerified:true});
 const tokens=await exchangeOAuthCode(db,{clientId,redirectUri,verifier,code},{pepper});
 const actor=await authenticateOAuth(db,tokens.access_token,{pepper});
 const grant=await stage(actor,'oauth','stripe');
 const correlationId=randomUUID();
 await record(actor,grant,'stripe','attempt','allowed',correlationId);
 await record(actor,grant,'stripe','outcome','unavailable',correlationId);
 expect((await history(actor)).changes.some(x=>x.correlationId===correlationId)).toBe(true);
 const refreshed=await rotateOAuthRefresh(db,{clientId,refreshToken:tokens.refresh_token},{pepper});
 const current=await authenticateOAuth(db,refreshed.access_token,{pepper});
 expect((await history(current)).changes.some(x=>x.correlationId===correlationId)).toBe(false);
 expect((await ownerHistory()).changes.some(x=>x.correlationId===correlationId)).toBe(true);
});
