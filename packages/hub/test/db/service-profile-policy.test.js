import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {createHash,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {issueHubPass,authenticateHubPass,listHubPassScopes} from '../../src/identity.js';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,
 authenticateOAuth,rotateOAuthRefresh,listOwnerOAuthFamilies}
 from '../../src/oauth.js';
import {stageCallerGrant,activateVerifiedCallerGrant,
 resolveActiveCallerGrant,listEligibleRtcTargets} from '../../src/grants.js';
import {narrowPassServiceProfile,narrowOAuthServiceProfile,
 listOwnerProfileAudit} from '../../src/service-profile-policy.js';
import {inspectOwnerServiceScope} from '../../src/owner-service-scope.js';
import {storeRtcResult,readRtcResult} from '../../src/rtc-results.js';
const owner='owner',pepper='synthetic-rtc-profile-test-key-123456789';
const settings={pepper,grantsKey:randomBytes(32).toString('base64url'),
 resultsKey:randomBytes(32).toString('base64url')};
const pass='rtc_pass_'+randomBytes(32).toString('base64url');
let db,schema;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await db.connect();
 schema='h4_service_profile_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const filename of ['001-hub-foundation.sql','002-hub-oauth.sql',
  '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
  '008-hub-rtc-audit.sql','009-hub-rtc-results.sql',
  '010-hub-pass-servers.sql','011-hub-oauth-server-scopes.sql',
  '012-hub-grant-area-ceilings.sql','015-hub-caller-service-area-policy.sql',
  '017-hub-caller-service-profile-policy.sql'])
  await db.query(await readFile(new URL('../../migrations/'+filename,import.meta.url),'utf8'));
 for(const name of ['stripe','workspace']) await db.query(
  "INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts) VALUES($1,$2,$1,$3,1,'{\"tools\":3,\"writes\":0,\"money\":0}')",
  [name,owner,'https://'+name+'.example.com']);
});
afterAll(async()=>{
 if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');
 await db.end();}
});
async function grant(actor,kind,serverName){
 const staged=await stageCallerGrant(db,{ownerId:owner,serverName,
  callerKind:kind,callerId:actor.id,areas:['billing','reports'],
  pass,ttlSeconds:3600},{ownerVerified:true,settings});
 await activateVerifiedCallerGrant(db,{ownerId:owner,id:staged.id},settings,{
   ownerVerified:true,inspect:async target=>({
    server:target.name,prefix:target.prefix,areas:target.areas,
    mode:'test',profile:'read_only',identityVerified:true,callable:false})});
 return staged.id;
}
it('owner service-profile change disables exact pass service, not sibling, with audit and cache refusal',async()=>{
 const issued=await issueHubPass(db,{ownerId:owner,mode:'test',
  profile:'read_only',areas:['gateway'],allowWrites:false,
  serverNames:['stripe','workspace'],ttlSeconds:3600},
  {ownerVerified:true,pepper});
 const actor=await authenticateHubPass(db,'Bearer '+issued.pass,{pepper});
 const stripe=await grant(actor,'pass','stripe');
 const workspace=await grant(actor,'pass','workspace');
 const cached=await storeRtcResult(db,actor,stripe,'stripe',{detail:'secret'},settings);
 const prior=(await db.query('SELECT ciphertext,nonce,tag FROM hub_server_grants WHERE id=$1',
  [stripe])).rows[0];
 expect((await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings)))
  .toMatchObject({profile:'read_only',areas:['billing','reports']});
 expect(await readRtcResult(db,actor,cached.handle,0,settings)).not.toBeNull();
 expect((await narrowPassServiceProfile(db,{ownerId:owner,id:actor.id,
  serverName:'stripe',profile:'read_only'},{ownerVerified:true})).updated).toBe(true);
 expect((await narrowPassServiceProfile(db,{ownerId:owner,id:actor.id,
  serverName:'stripe',profile:'disabled'},{ownerVerified:true})).updated).toBe(true);
 expect(await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings))
  .toBeNull();
 expect((await listEligibleRtcTargets(db,actor)).map(x=>x.name))
  .toEqual(['workspace']);
 expect((await resolveActiveCallerGrant(db,{actor,serverName:'workspace'},settings)).grantId)
  .toBe(workspace);
 expect(await readRtcResult(db,actor,cached.handle,0,settings)).toBeNull();
 expect((await inspectOwnerServiceScope(db,{ownerId:owner,callerKind:'pass',
  callerId:actor.id,serverName:'stripe'},{ownerVerified:true}))
 ).toMatchObject({available:true,callable:false,profile:'disabled',
  callerProfileLimit:'disabled'});
 expect((await listHubPassScopes(db,owner,{ownerVerified:true}))
   .find(x=>x.id===actor.id).serviceProfiles).toEqual({stripe:'disabled'});
 expect((await narrowPassServiceProfile(db,{ownerId:owner,id:actor.id,
  serverName:'stripe',profile:'read_only'},{ownerVerified:true})).updated).toBe(false);
 expect((await narrowPassServiceProfile(db,{ownerId:'wrong',id:actor.id,
  serverName:'workspace',profile:'disabled'},{ownerVerified:true})).updated).toBe(false);
 const after=(await db.query('SELECT ciphertext,nonce,tag FROM hub_server_grants WHERE id=$1',
  [stripe])).rows[0];
 for(const name of ['ciphertext','nonce','tag'])
  expect(after[name].equals(prior[name])).toBe(true);
 const history=await listOwnerProfileAudit(db,owner,{ownerVerified:true});
 expect(history[0]).toMatchObject({kind:'pass',server:'stripe',profile:'disabled',
  affectedSessions:1});
 expect(history[0].purgedHandles).toBe(0);
 expect(history[1].purgedHandles).toBe(1);
});
it('OAuth profile policy stays one-way across all rotated family generations',async()=>{
 const clientId='service_profile_oauth_client';
 const redirectUri='https://agent.example.com/oauth/cb';
 const verifier='synthetic-oauth-profile-verifier-abcdefghijklmnopqrstuvwxyz';
 await registerOAuthClient(db,{ownerId:owner,clientId,redirectUri},
  {ownerVerified:true});
 const code=await issueOAuthCode(db,{ownerId:owner,clientId,redirectUri,
  profile:'read_only',mode:'test',areas:['gateway'],
  challenge:createHash('sha256').update(verifier).digest('base64url'),
  serverNames:['workspace']},{pepper,ownerVerified:true});
 const initial=await exchangeOAuthCode(db,{code,clientId,redirectUri,verifier},
  {pepper});
 const first=await authenticateOAuth(db,initial.access_token,{pepper});
 const id=await grant(first,'oauth','workspace');
 const old=await storeRtcResult(db,first,id,'workspace',{secret:true},settings);
 const rotated=await rotateOAuthRefresh(db,{
  clientId,refreshToken:initial.refresh_token},{pepper});
 const second=await authenticateOAuth(db,rotated.access_token,{pepper});
 expect((await listEligibleRtcTargets(db,second)).map(x=>x.name))
  .toEqual(['workspace']);
 expect((await narrowOAuthServiceProfile(db,{ownerId:owner,id:second.id,
  serverName:'workspace',profile:'disabled'},{ownerVerified:true})).updated)
  .toBe(true);
 for(const actor of [first,second]){
  expect(await resolveActiveCallerGrant(db,{actor,serverName:'workspace'},settings))
   .toBeNull();
  expect(await listEligibleRtcTargets(db,actor)).toEqual([]);
 }
 expect(await readRtcResult(db,first,old.handle,0,settings)).toBeNull();
 const next=await rotateOAuthRefresh(db,{
  clientId,refreshToken:rotated.refresh_token},{pepper});
 const newest=await authenticateOAuth(db,next.access_token,{pepper});
 expect((await listEligibleRtcTargets(db,newest))).toEqual([]);
 expect((await listOwnerOAuthFamilies(db,owner,{ownerVerified:true}))
   .find(x=>x.id===newest.id).serviceProfiles).toEqual({workspace:'disabled'});
 expect((await narrowOAuthServiceProfile(db,{ownerId:owner,id:newest.id,
  serverName:'workspace',profile:'read_only'},{ownerVerified:true})).updated)
  .toBe(false);
 expect((await inspectOwnerServiceScope(db,{ownerId:owner,callerKind:'oauth',
  callerId:newest.id,serverName:'workspace'},{ownerVerified:true}))
 ).toMatchObject({available:true,callable:false,profile:'disabled'});
 const records=await listOwnerProfileAudit(db,owner,{ownerVerified:true});
 expect(records[0]).toMatchObject({kind:'oauth',profile:'disabled',
  affectedSessions:2,purgedHandles:1});
});
it('fails closed when profile ceiling SQL is invoked without owner challenge',async()=>{
 await expect(narrowPassServiceProfile(db,{ownerId:owner,
  id:'00000000-0000-4000-8000-000000000001',
  serverName:'stripe',profile:'disabled'})).rejects.toThrow();
 await expect(listOwnerProfileAudit(db,'wrong owner',
  {ownerVerified:true})).rejects.toThrow();
});

it('initial pass issuance selects disabled service before any grant can be staged',async()=>{
 const issued=await issueHubPass(db,{ownerId:owner,mode:'test',
  profile:'read_only',areas:['gateway'],allowWrites:false,
  serverNames:['stripe','workspace'],
  serviceProfiles:{stripe:'disabled',workspace:'read_only'},
  ttlSeconds:3600},{ownerVerified:true,pepper});
 const actor=await authenticateHubPass(db,'Bearer '+issued.pass,{pepper});
 expect((await listHubPassScopes(db,owner,{ownerVerified:true}))
   .find(x=>x.id===actor.id).serviceProfiles)
   .toEqual({stripe:'disabled',workspace:'read_only'});
 await expect(stageCallerGrant(db,{ownerId:owner,
  serverName:'stripe',callerKind:'pass',callerId:actor.id,
  areas:['billing'],pass,ttlSeconds:3600},
  {ownerVerified:true,settings})).rejects.toThrow('scope');
 await grant(actor,'pass','workspace');
 expect((await listEligibleRtcTargets(db,actor)).map(x=>x.name))
  .toEqual(['workspace']);
 expect(await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings))
  .toBeNull();
});
it('initial OAuth authorization profile ceilings bind code, first token and every refresh',async()=>{
 const clientId='initial_profile_oauth_client',
  redirectUri='https://agent.example.com/initial/callback';
 const verifier='synthetic-initial-profile-verifier-abcdefghijklmnopqrstuvwxyz';
 await registerOAuthClient(db,{ownerId:owner,clientId,redirectUri},
  {ownerVerified:true});
 const issue={ownerId:owner,clientId,redirectUri,
  profile:'read_only',mode:'test',areas:['gateway'],
  challenge:createHash('sha256').update(verifier).digest('base64url'),
  serverNames:['stripe','workspace'],
  serviceProfiles:{stripe:'disabled',workspace:'read_only'}};
 await expect(issueOAuthCode(db,{...issue,serviceProfiles:{neon:'read_only'}},
  {pepper,ownerVerified:true})).rejects.toThrow();
 const code=await issueOAuthCode(db,issue,{pepper,ownerVerified:true});
 const firstToken=await exchangeOAuthCode(db,{code,clientId,redirectUri,verifier},{pepper});
 const first=await authenticateOAuth(db,firstToken.access_token,{pepper});
 expect((await listOwnerOAuthFamilies(db,owner,{ownerVerified:true}))
   .find(x=>x.id===first.id).serviceProfiles)
   .toEqual({stripe:'disabled',workspace:'read_only'});
 await expect(stageCallerGrant(db,{ownerId:owner,
  serverName:'stripe',callerKind:'oauth',callerId:first.id,
  areas:['billing'],pass,ttlSeconds:3600},
  {ownerVerified:true,settings})).rejects.toThrow('scope');
 await grant(first,'oauth','workspace');
 const secondToken=await rotateOAuthRefresh(db,{
  clientId,refreshToken:firstToken.refresh_token},{pepper});
 const second=await authenticateOAuth(db,secondToken.access_token,{pepper});
 expect((await listEligibleRtcTargets(db,second)).map(x=>x.name))
  .toEqual(['workspace']);
 expect((await listOwnerOAuthFamilies(db,owner,{ownerVerified:true}))
   .find(x=>x.id===second.id).serviceProfiles)
   .toEqual({stripe:'disabled',workspace:'read_only'});
 expect(await resolveActiveCallerGrant(db,{actor:second,serverName:'stripe'},settings))
  .toBeNull();
});
