import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,
  rotateOAuthRefresh,authenticateOAuth,listOwnerOAuthFamilies,
  revokeOwnerOAuthFamily} from '../../src/oauth.js';
import {stageCallerGrant,activateVerifiedCallerGrant} from '../../src/grants.js';
import {storeRtcResult,readRtcResult} from '../../src/rtc-results.js';
const pepper='test-only-owner-h4-oauth-family-pepper-more-than-32';
const settings={pepper,grantsKey:randomBytes(32).toString('base64url'),
  resultsKey:randomBytes(32).toString('base64url')};
const fakePass='rtc_pass_'+randomBytes(32).toString('base64url');
const clientId='h4_owner_family_client',redirectUri='https://agent.example/cb';
const verifier='test-owner-revocation-verifier-1234567890abcdefghijklmnop';
const challenge=createHash('sha256').update(verifier).digest('base64url');
let db,schema;
async function issue() {
 const code=await issueOAuthCode(db,{ownerId:'owner-a',clientId,redirectUri,challenge,
  profile:'read_only',mode:'test',areas:['gateway'],serverNames:['stripe']},
  {pepper,ownerVerified:true});
 const tokens=await exchangeOAuthCode(db,{code,clientId,redirectUri,verifier},{pepper});
 const actor=await authenticateOAuth(db,tokens.access_token,{pepper});
 return {tokens,actor};
}
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw new Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
 schema='hub_owner_oauth_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const file of ['001-hub-foundation.sql','002-hub-oauth.sql','004-hub-registry.sql',
  '005-hub-grants.sql','006-hub-activation.sql','008-hub-rtc-audit.sql',
  '009-hub-rtc-results.sql','011-hub-oauth-server-scopes.sql',
  '013-hub-owner-oauth-audit.sql'])
  await db.query(await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 await registerOAuthClient(db,{ownerId:'owner-a',clientId,redirectUri},{ownerVerified:true});
 await db.query("INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts) VALUES ('stripe','owner-a','stripe','https://stripe.example.com',1,'{\"tools\":3,\"writes\":0,\"money\":0}')");
});
afterAll(async()=>{if(db){
 if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');
 await db.end();
}});
it('owner lists one latest session per family and irreversibly revokes all rotations and result pages',async()=>{
 const first=await issue();
 const grant=await stageCallerGrant(db,{ownerId:'owner-a',serverName:'stripe',
  callerKind:'oauth',callerId:first.actor.id,areas:['billing'],pass:fakePass,
  ttlSeconds:3600},{ownerVerified:true,settings});
 await activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:grant.id},settings,
  {ownerVerified:true,inspect:async arg=>({server:arg.name,prefix:arg.prefix,
   areas:arg.areas,mode:'test',profile:'read_only',identityVerified:true,callable:false})});
 const encrypted=await storeRtcResult(db,first.actor,grant.id,'stripe',
  {value:'synthetic-only'},settings);
 const refreshed=await rotateOAuthRefresh(db,{
  refreshToken:first.tokens.refresh_token,clientId},{pepper});
 const current=await authenticateOAuth(db,refreshed.access_token,{pepper});
 const unrelated=await issue();
 const listing=await listOwnerOAuthFamilies(db,'owner-a',{ownerVerified:true});
 expect(listing).toHaveLength(2);
 expect(listing.find(x=>x.id===current.id)).toMatchObject({
  clientId,serverNames:['stripe'],areas:['gateway'],profile:'read_only',mode:'test'});
 expect(JSON.stringify(listing)).not.toContain(refreshed.access_token);
 expect(JSON.stringify(listing)).not.toContain(refreshed.refresh_token);
 expect(await listOwnerOAuthFamilies(db,'another',{ownerVerified:true})).toEqual([]);
 await expect(listOwnerOAuthFamilies(db,'owner-a')).rejects.toThrow('owner');
 expect(await readRtcResult(db,first.actor,encrypted.handle,0,settings)).not.toBeNull();
 expect(await revokeOwnerOAuthFamily(db,{ownerId:'other',sessionId:current.id},
  {ownerVerified:true})).toBe(false);
 expect(await revokeOwnerOAuthFamily(db,{ownerId:'owner-a',sessionId:current.id},
  {ownerVerified:true})).toBe(true);
 expect(await authenticateOAuth(db,refreshed.access_token,{pepper})).toBeNull();
 expect(await authenticateOAuth(db,first.tokens.access_token,{pepper})).toBeNull();
 expect(await readRtcResult(db,first.actor,encrypted.handle,0,settings)).toBeNull();
 expect((await db.query('SELECT count(*)::int AS n FROM hub_rtc_result_handles WHERE grant_id=$1',
  [grant.id])).rows[0].n).toBe(0);
 expect((await db.query('SELECT action,affected_sessions,purged_handles FROM hub_oauth_owner_audit WHERE owner_id=$1',
  ['owner-a'])).rows).toEqual([{action:'revoke',affected_sessions:2,purged_handles:1}]);
 expect(await revokeOwnerOAuthFamily(db,{ownerId:'owner-a',sessionId:current.id},
  {ownerVerified:true})).toBe(false);
 expect(await authenticateOAuth(db,unrelated.tokens.access_token,{pepper})).not.toBeNull();
 expect((await listOwnerOAuthFamilies(db,'owner-a',{ownerVerified:true})).map(x=>x.id))
  .toEqual([unrelated.actor.id]);
});
it('missing audit migration fails closed and does not partially revoke family',async()=>{
 const other=await issue();
 await db.query('SAVEPOINT oauth_owner_scope_probe').catch(()=>{});
 // A mismatched exact owner ID is always a no-op without revealing other sessions.
 expect(await revokeOwnerOAuthFamily(db,{ownerId:'nonowner',sessionId:other.actor.id},
  {ownerVerified:true})).toBe(false);
 await expect(revokeOwnerOAuthFamily(db,{ownerId:'owner-a',sessionId:'not-uuid'},
  {ownerVerified:true})).rejects.toThrow('selector');
 await expect(revokeOwnerOAuthFamily(db,{ownerId:'owner-a',sessionId:other.actor.id}))
  .rejects.toThrow('owner');
 expect(await authenticateOAuth(db,other.tokens.access_token,{pepper})).not.toBeNull();
});
