import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,
  authenticateOAuth,rotateOAuthRefresh} from '../../src/oauth.js';
import {issueHubPass,authenticateHubPass} from '../../src/identity.js';
import {stageCallerGrant,activateVerifiedCallerGrant,resolveActiveCallerGrant,
  listEligibleRtcTargets} from '../../src/grants.js';
import {cancelStagedGrant,listGrantLifecycleAudit,
  reclaimExpiredStagedGrants,listOwnerGrantReadiness,
  revokeOwnerVerifiedGrant} from '../../src/grant-lifecycle.js';
import {storeRtcResult,readRtcResult} from '../../src/rtc-results.js';
const pepper='synthetic-credential-renewal-pepper-abcdef123456';
const settings={pepper,grantsKey:randomBytes(32).toString('base64url'),
  resultsKey:randomBytes(32).toString('base64url')};
const pass=()=> 'rtc_pass_'+randomBytes(32).toString('base64url');
let db,schema;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
 schema='grant_renewal_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const file of ['001-hub-foundation.sql','002-hub-oauth.sql',
  '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
  '008-hub-rtc-audit.sql','009-hub-rtc-results.sql',
  '010-hub-pass-servers.sql','011-hub-oauth-server-scopes.sql',
  '012-hub-grant-area-ceilings.sql','015-hub-caller-service-area-policy.sql',
  '016-hub-grant-renewal.sql'])
  await db.query(await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 await db.query("INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts) VALUES('stripe','owner','stripe','https://stripe.example.com',1,'{\"tools\":3,\"writes\":0,\"money\":0}')");
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
async function caller(){
 const credentials=await issueHubPass(db,{ownerId:'owner',profile:'read_only',
  mode:'test',allowWrites:false,areas:['gateway'],serverNames:['stripe'],
  ttlSeconds:3600},{pepper,ownerVerified:true});
 return authenticateHubPass(db,'Bearer '+credentials.pass,{pepper});
}
const owner={ownerVerified:true};
const identity=async row=>({identityVerified:true,callable:false,
 server:row.name,prefix:row.prefix,areas:row.areas,profile:'read_only',mode:'test'});
async function stage(actor,areas,credential){
 return stageCallerGrant(db,{ownerId:'owner',serverName:'stripe',callerKind:'pass',
  callerId:actor.id,pass:credential,areas,ttlSeconds:3600},
  {ownerVerified:true,settings});
}
async function verify(id,probe=identity){
 return activateVerifiedCallerGrant(db,{ownerId:'owner',id},settings,{...owner,inspect:probe});
}
it('makes active service usable for newly issued exact-caller TEST grant',async()=>{
 const first=await caller(),original=pass();
 const staged=await stage(first,['billing','reports'],original);
 expect(staged).toMatchObject({callable:false,serverAlreadyActive:false});
 await verify(staged.id);
 expect((await resolveActiveCallerGrant(db,{actor:first,serverName:'stripe'},settings)).pass)
  .toBe(original);
 const newCaller=await caller();
 const newPass=pass();
 const add=await stage(newCaller,['billing'],newPass);
 expect(add.serverAlreadyActive).toBe(true);
 expect(await resolveActiveCallerGrant(db,{actor:newCaller,serverName:'stripe'},settings))
  .toBeNull();
 await verify(add.id);
 expect((await resolveActiveCallerGrant(db,{actor:newCaller,serverName:'stripe'},settings)).pass)
  .toBe(newPass);
 expect((await listEligibleRtcTargets(db,newCaller))[0].areas).toEqual(['billing']);
 const records=await listGrantLifecycleAudit(db,'owner',owner);
 expect(records).toEqual(expect.arrayContaining([
  expect.objectContaining({action:'additional_caller',server:'stripe',
   callerId:newCaller.id})]));
});
it('keeps old credential usable during failed probe and atomically swaps after verification',async()=>{
 const actor=await caller(),oldPass=pass();
 const original=await stage(actor,['billing','reports'],oldPass);
 await verify(original.id);
 const oldPage=await storeRtcResult(db,actor,original.id,'stripe',{test:true},settings);
 const newPass=pass(),replacement=await stage(actor,['billing'],newPass);
 expect(replacement.serverAlreadyActive).toBe(true);
 expect(await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings))
  .toMatchObject({grantId:original.id,pass:oldPass});
 await expect(verify(replacement.id,async()=>{throw Error('failed scope proof');}))
  .rejects.toThrow('failed scope proof');
 expect((await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings)).pass)
  .toBe(oldPass);
 expect(await readRtcResult(db,actor,oldPage.handle,0,settings)).not.toBeNull();
 const accepted=await verify(replacement.id);
 expect(accepted).toMatchObject({action:'renewal',replaced:original.id,
  purgedHandles:1});
 expect((await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings)))
  .toMatchObject({grantId:replacement.id,pass:newPass,areas:['billing']});
 expect(await readRtcResult(db,actor,oldPage.handle,0,settings)).toBeNull();
 expect((await db.query('SELECT revoked_at FROM hub_server_grants WHERE id=$1',
  [original.id])).rows[0].revoked_at).not.toBeNull();
 expect((await listGrantLifecycleAudit(db,'owner',owner))[0])
  .toMatchObject({action:'renewal',retiredId:original.id,purgedHandles:1});
});
it('refuses broadening, missing owner and cancel after verification',async()=>{
 const actor=await caller(),cred=pass();
 const first=await stage(actor,['billing'],cred);
 await verify(first.id);
 await expect(stage(actor,['billing','reports'],pass())).rejects.toThrow();
 expect(await cancelStagedGrant(db,{ownerId:'owner',id:first.id},owner)).toBe(false);
 const staged=await stage(actor,['billing'],pass());
 expect(await cancelStagedGrant(db,{ownerId:'owner',id:staged.id},owner)).toBe(true);
 expect(await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings))
  .toMatchObject({grantId:first.id});
 expect((await listGrantLifecycleAudit(db,'owner',owner))[0])
  .toMatchObject({action:'cancel_staged'});
});

it('reclaims expired, unverified grant slots without changing a live replacement',async()=>{
 const actor=await caller(),working=await stage(actor,['billing'],pass());
 await verify(working.id);
 const abandoned=await stage(actor,['billing'],pass());
 // Advance both historical issuance and expiry to preserve DB CHECKs.
 // This models a missed owner verification after a session expires.
 await db.query(`UPDATE hub_server_grants
   SET created_at=now()-interval '2 hours',
     expires_at=now()-interval '1 hour' WHERE id=$1`,[abandoned.id]);
 expect((await listOwnerGrantReadiness(db,'owner',owner)).find(
   x=>x.id===abandoned.id)).toMatchObject({state:'expired',
    locallyVerified:false,hasActivePredecessor:true});
 expect((await reclaimExpiredStagedGrants(db,'owner',owner)).reclaimed).toBe(1);
 expect((await reclaimExpiredStagedGrants(db,'owner',owner)).reclaimed).toBe(0);
 expect((await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings)).grantId)
  .toBe(working.id);
 const next=await stage(actor,['billing'],pass());
 expect(next.serverAlreadyActive).toBe(true);
 const canceled=await cancelStagedGrant(db,{ownerId:'owner',id:next.id},owner);
 expect(canceled).toBe(true);
 expect((await listGrantLifecycleAudit(db,'owner',owner)).some(
   item=>item.action==='expire_staged')).toBe(true);
});
it('owner readiness never exposes RTC credentials and fails closed for wrong owner',async()=>{
 const state=await listOwnerGrantReadiness(db,'owner',owner);
 expect(state.length).toBeGreaterThan(0);
 expect(state.some(x=>x.state==='verified_locally')).toBe(true);
 expect(JSON.stringify(state)).not.toContain('rtc_pass_');
 expect(await listOwnerGrantReadiness(db,'other',{ownerVerified:true}))
  .toEqual([]);
 await expect(reclaimExpiredStagedGrants(db,'owner',{limit:500,
  ownerVerified:true})).rejects.toThrow();
 await expect(listOwnerGrantReadiness(db,'owner')).rejects.toThrow();
});

it('renews an OAuth family original caller after access expiry when matching refreshed session is valid',async()=>{
 const clientId='renewal_oauth_client',redirectUri='https://agent.example.com/return';
 const verifier='synthetic-pkce-verifier-only-abcdefghijklmnopqrstuvwxyz-12345';
 await registerOAuthClient(db,{ownerId:'owner',clientId,redirectUri},owner);
 const code=await issueOAuthCode(db,{ownerId:'owner',clientId,redirectUri,
  challenge:createHash('sha256').update(verifier).digest('base64url'),
  profile:'read_only',mode:'test',areas:['gateway'],serverNames:['stripe']},
  {...owner,pepper});
 const access=await exchangeOAuthCode(db,{code,clientId,redirectUri,verifier},{pepper});
 const first=await authenticateOAuth(db,access.access_token,{pepper});
 const original=await stageCallerGrant(db,{ownerId:'owner',serverName:'stripe',
  callerKind:'oauth',callerId:first.id,areas:['billing','reports'],
  pass:pass(),ttlSeconds:3600},{...owner,settings});
 await verify(original.id);
 const rotated=await rotateOAuthRefresh(db,{refreshToken:access.refresh_token,clientId},{pepper});
 const fresh=await authenticateOAuth(db,rotated.access_token,{pepper});
 await db.query(`UPDATE hub_oauth_sessions SET access_expires_at=now()-interval '1 second'
   WHERE id=$1`,[first.id]);
 expect((await resolveActiveCallerGrant(db,{actor:fresh,serverName:'stripe'},settings)).grantId)
  .toBe(original.id);
 const renewed=await stageCallerGrant(db,{ownerId:'owner',serverName:'stripe',
  callerKind:'oauth',callerId:first.id,areas:['billing'],
  pass:pass(),ttlSeconds:3600},{...owner,settings});
 await verify(renewed.id);
 expect((await resolveActiveCallerGrant(db,{actor:fresh,serverName:'stripe'},settings)))
  .toMatchObject({grantId:renewed.id,areas:['billing']});
});
it('owner revocation purges old RTC pages and records nonsecret audit',async()=>{
 const actor=await caller(),g=await stage(actor,['billing'],pass());
 await verify(g.id);
 const result=await storeRtcResult(db,actor,g.id,'stripe',{data:'sensitive'},settings);
 expect(await readRtcResult(db,actor,result.handle,0,settings)).not.toBeNull();
 expect(await revokeOwnerVerifiedGrant(db,{ownerId:'other',id:g.id},owner))
  .toBe(false);
 expect(await revokeOwnerVerifiedGrant(db,{ownerId:'owner',id:g.id},owner))
  .toBe(true);
 expect(await revokeOwnerVerifiedGrant(db,{ownerId:'owner',id:g.id},owner))
  .toBe(false);
 expect(await readRtcResult(db,actor,result.handle,0,settings)).toBeNull();
 expect((await listGrantLifecycleAudit(db,'owner',owner)).find(
  r=>r.stagedId===g.id)).toMatchObject({action:'revoke',purgedHandles:1});
});
