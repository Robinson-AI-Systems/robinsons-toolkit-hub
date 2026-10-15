import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {issueHubPass,authenticateHubPass} from '../../src/identity.js';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,
  authenticateOAuth,rotateOAuthRefresh} from '../../src/oauth.js';
import {stageCallerGrant,activateVerifiedCallerGrant,resolveActiveCallerGrant,
  listEligibleRtcTargets} from '../../src/grants.js';
import {narrowHubPassServiceAreas,narrowOAuthFamilyServiceAreas} from '../../src/service-area-policy.js';
import {inspectOwnerServiceScope,listOwnerServiceAreaAudit} from '../../src/owner-service-scope.js';
import {storeRtcResult,readRtcResult} from '../../src/rtc-results.js';
const owner='owner',pepper='synthetic-service-area-policy-pepper-123456';
const settings={pepper,grantsKey:randomBytes(32).toString('base64url'),
  resultsKey:randomBytes(32).toString('base64url')};
const rtcPass='rtc_pass_'+randomBytes(32).toString('base64url');
let db,schema;
async function install(){
 for(const name of ['001-hub-foundation.sql','002-hub-oauth.sql',
  '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
  '008-hub-rtc-audit.sql','009-hub-rtc-results.sql',
  '010-hub-pass-servers.sql','011-hub-oauth-server-scopes.sql',
  '012-hub-grant-area-ceilings.sql','015-hub-caller-service-area-policy.sql',
  '016-hub-grant-renewal.sql','018-hub-initial-oauth-service-areas.sql'])
  await db.query(await readFile(new URL('../../migrations/'+name,import.meta.url),'utf8'));
 for(const name of ['stripe','workspace']) await db.query(
  "INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts) VALUES($1,$2,$1,$3,1,'{\"tools\":3,\"writes\":0,\"money\":0}')",
  [name,owner,'https://'+name+'.example.com']);
}
async function grant(actor,kind,server='stripe'){
 const staged=await stageCallerGrant(db,{ownerId:owner,serverName:server,
  callerKind:kind,callerId:actor.id,areas:['billing','reports'],pass:rtcPass,
  ttlSeconds:3600},{ownerVerified:true,settings});
 await activateVerifiedCallerGrant(db,{ownerId:owner,id:staged.id},settings,
  {ownerVerified:true,inspect:async a=>({server:a.name,prefix:a.prefix,
   areas:a.areas,mode:'test',profile:'read_only',identityVerified:true,callable:false})});
 return staged.id;
}
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
 schema='h4_service_area_'+process.pid+'_'+Math.floor(Math.random()*10000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 await install();
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
it('owner narrows one pass per-service; SQL discovery, dispatch, results and audits honor current scope',async()=>{
 const issued=await issueHubPass(db,{ownerId:owner,profile:'read_only',
  mode:'test',allowWrites:false,areas:['gateway'],ttlSeconds:3600,
  serverNames:['stripe']},{ownerVerified:true,pepper});
 const actor=await authenticateHubPass(db,'Bearer '+issued.pass,{pepper});
 const id=await grant(actor,'pass');
 const before=await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings);
 expect(before.areas).toEqual(['billing','reports']);
 const ownerPreview=await inspectOwnerServiceScope(db,{ownerId:owner,
   callerKind:'pass',callerId:actor.id,serverName:'stripe'},{ownerVerified:true});
 expect(ownerPreview).toMatchObject({callable:true,profile:'read_only',
   authorizedAreas:['billing','reports']});
 const saved=await storeRtcResult(db,actor,id,'stripe',{area:'billing'},settings);
 expect(await readRtcResult(db,actor,saved.handle,0,settings)).not.toBeNull();
 const previous=(await db.query('SELECT ciphertext,nonce,tag FROM hub_server_grants WHERE id=$1',[id])).rows[0];
 expect(await narrowHubPassServiceAreas(db,{ownerId:owner,id:actor.id,
  serverName:'stripe',areas:['reports']},{ownerVerified:true}))
  .toMatchObject({updated:true,areas:['reports']});
 expect((await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings)).areas)
  .toEqual(['reports']);
 expect((await listEligibleRtcTargets(db,actor))[0].areas).toEqual(['reports']);
 expect(await readRtcResult(db,actor,saved.handle,0,settings)).toBeNull();
 expect((await inspectOwnerServiceScope(db,{ownerId:owner,
   callerKind:'pass',callerId:actor.id,serverName:'stripe'},
   {ownerVerified:true})).authorizedAreas).toEqual(['reports']);
 const recent=await listOwnerServiceAreaAudit(db,owner,{ownerVerified:true});
 expect(recent[0]).toMatchObject({kind:'pass',server:'stripe',
   areas:['reports'],purgedHandles:1});
 const sealed=(await db.query('SELECT ciphertext,nonce,tag FROM hub_server_grants WHERE id=$1',[id])).rows[0];
 for(const field of ['ciphertext','nonce','tag'])
  expect(sealed[field].equals(previous[field])).toBe(true);
 expect((await narrowHubPassServiceAreas(db,{ownerId:owner,id:actor.id,
  serverName:'stripe',areas:['billing']},{ownerVerified:true})).updated).toBe(false);
 expect((await narrowHubPassServiceAreas(db,{ownerId:'wrong',id:actor.id,
  serverName:'stripe',areas:['reports']},{ownerVerified:true})).updated).toBe(false);
 const log=await db.query("SELECT caller_kind,areas FROM hub_caller_service_area_audit WHERE caller_id=$1",[actor.id]);
 expect(log.rows).toEqual([{caller_kind:'pass',areas:['reports']}]);
});
it('OAuth per-service policy remains attached to an entire rotated family and is one-way',async()=>{
 const clientId='area_policy_client',redirectUri='https://agent.example.com/callback';
 const verifier='oauth-verifier-only-testing-0123456789abcdef';
 await registerOAuthClient(db,{ownerId:owner,clientId,redirectUri},{ownerVerified:true});
 const code=await issueOAuthCode(db,{ownerId:owner,clientId,redirectUri,
  challenge:createHash('sha256').update(verifier).digest('base64url'),
  profile:'read_only',mode:'test',areas:['gateway'],serverNames:['workspace']},
  {pepper,ownerVerified:true});
 const tokens=await exchangeOAuthCode(db,{code,clientId,redirectUri,verifier},{pepper});
 const actor=await authenticateOAuth(db,tokens.access_token,{pepper});
 const grantId=await grant(actor,'oauth','workspace');
 const old=await storeRtcResult(db,actor,grantId,'workspace',{area:'billing'},settings);
 const rotated=await rotateOAuthRefresh(db,{refreshToken:tokens.refresh_token,clientId},{pepper});
 const fresh=await authenticateOAuth(db,rotated.access_token,{pepper});
 expect((await resolveActiveCallerGrant(db,{actor:fresh,serverName:'workspace'},settings)).areas)
  .toEqual(['billing','reports']);
 const narrowed=await narrowOAuthFamilyServiceAreas(db,{ownerId:owner,id:fresh.id,
  serverName:'workspace',areas:['billing']},{ownerVerified:true});
 expect(narrowed).toMatchObject({updated:true,areas:['billing']});
 for(const current of [actor,fresh]){
  expect((await resolveActiveCallerGrant(db,{actor:current,serverName:'workspace'},settings)).areas)
   .toEqual(['billing']);
  expect((await listEligibleRtcTargets(db,current))[0].areas).toEqual(['billing']);
 }
 expect(await readRtcResult(db,actor,old.handle,0,settings)).toBeNull();
 expect((await inspectOwnerServiceScope(db,{ownerId:owner,callerKind:'oauth',
   callerId:fresh.id,serverName:'workspace'},{ownerVerified:true}))
   .authorizedAreas).toEqual(['billing']);
 expect((await listOwnerServiceAreaAudit(db,owner,{ownerVerified:true}))[0])
   .toMatchObject({kind:'oauth',server:'workspace',areas:['billing'],
     affectedSessions:2,purgedHandles:1});
 expect((await narrowOAuthFamilyServiceAreas(db,{ownerId:owner,id:fresh.id,
  serverName:'workspace',areas:['reports']},{ownerVerified:true})).updated).toBe(false);
 const next=await rotateOAuthRefresh(db,{refreshToken:rotated.refresh_token,clientId},{pepper});
 const newest=await authenticateOAuth(db,next.access_token,{pepper});
 expect((await resolveActiveCallerGrant(db,{actor:newest,serverName:'workspace'},settings)).areas)
  .toEqual(['billing']);
});

it('owner inspector fails closed for another owner and invalid caller ID',async()=>{
 expect(await inspectOwnerServiceScope(db,{ownerId:'other',callerKind:'pass',
   callerId:'00000000-0000-4000-8000-000000000001',serverName:'stripe'},
   {ownerVerified:true})).toMatchObject({available:false,callable:false});
 await expect(inspectOwnerServiceScope(db,{ownerId:owner,callerKind:'pass',
   callerId:'invalid',serverName:'stripe'},{ownerVerified:true})).rejects.toThrow();
 await expect(listOwnerServiceAreaAudit(db,owner)).rejects.toThrow();
 await expect(listOwnerServiceAreaAudit(db,owner,{ownerVerified:true,limit:500}))
   .rejects.toThrow();
});

it('initial owner area restrictions constrain pass grant discovery, result and owner readback from issuance',async()=>{
 const issued=await issueHubPass(db,{ownerId:owner,profile:'read_only',mode:'test',
  allowWrites:false,areas:['gateway'],ttlSeconds:3600,
  serverNames:['stripe','workspace'],
  serviceAreas:{stripe:['billing'],workspace:['reports']}},
  {ownerVerified:true,pepper});
 const actor=await authenticateHubPass(db,'Bearer '+issued.pass,{pepper});
 const primary=await grant(actor,'pass','stripe');
 await grant(actor,'pass','workspace');
 expect((await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings)).areas)
  .toEqual(['billing']);
 expect((await resolveActiveCallerGrant(db,{actor,serverName:'workspace'},settings)).areas)
  .toEqual(['reports']);
 const targets=await listEligibleRtcTargets(db,actor);
 expect(targets.map(t=>[t.name,t.areas])).toEqual([
  ['stripe',['billing']],['workspace',['reports']]]);
 const scope=await inspectOwnerServiceScope(db,{ownerId:owner,
  callerKind:'pass',callerId:actor.id,serverName:'stripe'},
  {ownerVerified:true});
 expect(scope).toMatchObject({callerAreaLimit:['billing'],authorizedAreas:['billing']});
 const old=await storeRtcResult(db,actor,primary,'stripe',{secret:'synthetic'},settings);
 expect(await readRtcResult(db,actor,old.handle,0,settings)).not.toBeNull();
 expect((await narrowHubPassServiceAreas(db,{ownerId:owner,id:actor.id,
  serverName:'stripe',areas:['reports']},{ownerVerified:true})).updated).toBe(false);
 expect((await narrowHubPassServiceAreas(db,{ownerId:owner,id:actor.id,
  serverName:'stripe',areas:['billing']},{ownerVerified:true})).updated).toBe(true);
 expect(await readRtcResult(db,actor,old.handle,0,settings)).toBeNull();
});
it('initial OAuth service areas survive PKCE code exchange, refresh and current family narrowing',async()=>{
 const clientId='initial_area_policy_client',redirectUri='https://agent.example.com/area/cb';
 const verifier='initial-oauth-area-verifier-abcdefghijklmnopqrstuvwxyz';
 await registerOAuthClient(db,{ownerId:owner,clientId,redirectUri},{ownerVerified:true});
 const code=await issueOAuthCode(db,{ownerId:owner,clientId,redirectUri,
  challenge:createHash('sha256').update(verifier).digest('base64url'),
  profile:'read_only',mode:'test',areas:['gateway'],
  serverNames:['stripe','workspace'],serviceAreas:{stripe:['reports']}},
  {pepper,ownerVerified:true});
 const tokens=await exchangeOAuthCode(db,{code,clientId,redirectUri,verifier},{pepper});
 const initial=await authenticateOAuth(db,tokens.access_token,{pepper});
 await grant(initial,'oauth','stripe');
 await grant(initial,'oauth','workspace');
 expect((await resolveActiveCallerGrant(db,{actor:initial,serverName:'stripe'},settings)).areas)
  .toEqual(['reports']);
 const rotated=await rotateOAuthRefresh(db,{clientId,refreshToken:tokens.refresh_token},{pepper});
 const fresh=await authenticateOAuth(db,rotated.access_token,{pepper});
 expect((await resolveActiveCallerGrant(db,{actor:fresh,serverName:'stripe'},settings)).areas)
  .toEqual(['reports']);
 expect((await resolveActiveCallerGrant(db,{actor:fresh,serverName:'workspace'},settings)).areas)
  .toEqual(['billing','reports']);
 expect((await narrowOAuthFamilyServiceAreas(db,{ownerId:owner,id:fresh.id,
  serverName:'stripe',areas:['billing']},{ownerVerified:true})).updated).toBe(false);
 expect((await narrowOAuthFamilyServiceAreas(db,{ownerId:owner,id:fresh.id,
  serverName:'stripe',areas:['reports']},{ownerVerified:true})).updated).toBe(true);
 expect((await resolveActiveCallerGrant(db,{actor:initial,serverName:'stripe'},settings)).areas)
  .toEqual(['reports']);
});
