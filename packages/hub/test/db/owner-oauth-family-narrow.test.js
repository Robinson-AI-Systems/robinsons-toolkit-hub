import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,
 authenticateOAuth,rotateOAuthRefresh,narrowOwnerOAuthFamilyServers} from '../../src/oauth.js';
import {stageCallerGrant,activateVerifiedCallerGrant,
 resolveActiveCallerGrant,listEligibleRtcTargets} from '../../src/grants.js';
import {storeRtcResult,readRtcResult} from '../../src/rtc-results.js';
const pepper='h4-family-scope-test-only-pepper-123456789';
const settings={pepper,grantsKey:randomBytes(32).toString('base64url'),
 resultsKey:randomBytes(32).toString('base64url')};
const providerPass='rtc_pass_'+randomBytes(32).toString('base64url');
const clientId='h4_scoped_oauth_client',redirectUri='https://agent.example.com/callback';
const verifier='this-verifier-is-for-synthetic-pkce-only-0123456789abcdef';
const challenge=createHash('sha256').update(verifier).digest('base64url');
let db,schema;
async function createFamily() {
 const code=await issueOAuthCode(db,{ownerId:'owner-a',clientId,redirectUri,
  challenge,profile:'read_only',mode:'test',areas:['gateway'],
  serverNames:['stripe','workspace']},{ownerVerified:true,pepper});
 const tokens=await exchangeOAuthCode(db,{code,clientId,redirectUri,verifier},{pepper});
 const actor=await authenticateOAuth(db,tokens.access_token,{pepper});
 return {tokens,actor};
}
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
 schema='h4_oauth_scope_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const file of ['001-hub-foundation.sql','002-hub-oauth.sql','004-hub-registry.sql',
  '005-hub-grants.sql','006-hub-activation.sql','008-hub-rtc-audit.sql',
  '009-hub-rtc-results.sql','011-hub-oauth-server-scopes.sql',
  '014-hub-oauth-family-scope-audit.sql'])
  await db.query(await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 await registerOAuthClient(db,{ownerId:'owner-a',clientId,redirectUri},{ownerVerified:true});
 for(const name of ['stripe','workspace'])
  await db.query("INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts) VALUES ($1,'owner-a',$1,$2,1,'{\"tools\":3,\"writes\":0,\"money\":0}')",
   [name,'https://'+name+'.example.com']);
});
afterAll(async()=>{if(db){
 if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');
 await db.end();
}});
it('atomically narrows every OAuth refresh generation and removes old RTC handles',async()=>{
 const family=await createFamily();
 let removedGrant;
 for(const name of ['stripe','workspace']) {
  const grant=await stageCallerGrant(db,{ownerId:'owner-a',serverName:name,
   callerKind:'oauth',callerId:family.actor.id,areas:['billing'],
   pass:providerPass,ttlSeconds:3600},{ownerVerified:true,settings});
  await activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:grant.id},settings,
   {ownerVerified:true,inspect:async a=>({server:a.name,prefix:a.prefix,
    areas:a.areas,mode:'test',profile:'read_only',identityVerified:true,callable:false})});
  if(name==='workspace')removedGrant=grant.id;
 }
 const prior=await storeRtcResult(db,family.actor,removedGrant,'workspace',
  {test:'bounded read page'},settings);
 const rotated=await rotateOAuthRefresh(db,{
  refreshToken:family.tokens.refresh_token,clientId},{pepper});
 const fresh=await authenticateOAuth(db,rotated.access_token,{pepper});
 expect((await listEligibleRtcTargets(db,fresh)).map(x=>x.name)).toEqual(['stripe','workspace']);
 expect(await readRtcResult(db,family.actor,prior.handle,0,settings)).not.toBeNull();
 const narrowed=await narrowOwnerOAuthFamilyServers(db,{ownerId:'owner-a',
  sessionId:fresh.id,serverNames:['stripe']},{ownerVerified:true});
 expect(narrowed).toEqual({updated:true,serverNames:['stripe']});
 expect((await authenticateOAuth(db,rotated.access_token,{pepper})).serverNames)
  .toEqual(['stripe']);
 expect((await listEligibleRtcTargets(db,fresh)).map(x=>x.name)).toEqual(['stripe']);
 expect(await resolveActiveCallerGrant(db,{actor:fresh,serverName:'workspace'},settings))
  .toBeNull();
 expect(await resolveActiveCallerGrant(db,{actor:family.actor,serverName:'workspace'},settings))
  .toBeNull();
 expect(await readRtcResult(db,family.actor,prior.handle,0,settings)).toBeNull();
 expect((await db.query('SELECT count(*)::int AS n FROM hub_rtc_result_handles WHERE grant_id=$1',
  [removedGrant])).rows[0].n).toBe(0);
 expect((await db.query('SELECT affected_sessions,purged_handles FROM hub_oauth_family_scope_audit'))
  .rows).toEqual([{affected_sessions:2,purged_handles:1}]);
 expect((await narrowOwnerOAuthFamilyServers(db,{ownerId:'owner-a',
  sessionId:fresh.id,serverNames:['workspace']},{ownerVerified:true})).updated).toBe(false);
 const more=await rotateOAuthRefresh(db,{refreshToken:rotated.refresh_token,clientId},{pepper});
 expect((await authenticateOAuth(db,more.access_token,{pepper})).serverNames)
  .toEqual(['stripe']);
});
it('wrong owner and a racing conflicting narrowing never restore removed servers',async()=>{
 const x=await createFamily(),other=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await other.connect();
 try {
  await other.query('SET search_path TO "'+schema+'"');
  const inputs=[
   narrowOwnerOAuthFamilyServers(db,{ownerId:'owner-a',sessionId:x.actor.id,
     serverNames:['stripe']},{ownerVerified:true}),
   narrowOwnerOAuthFamilyServers(other,{ownerId:'owner-a',sessionId:x.actor.id,
     serverNames:['workspace']},{ownerVerified:true})
  ];
  const results=await Promise.all(inputs);
  expect(results.filter(x=>x.updated)).toHaveLength(1);
  const actor=await authenticateOAuth(db,x.tokens.access_token,{pepper});
  expect(actor.serverNames).toEqual(results.find(x=>x.updated).serverNames);
  const check=await narrowOwnerOAuthFamilyServers(db,{ownerId:'wrong',sessionId:x.actor.id,
   serverNames:['stripe']},{ownerVerified:true});
  expect(check.updated).toBe(false);
  await expect(narrowOwnerOAuthFamilyServers(db,{ownerId:'owner-a',
   sessionId:'no',serverNames:['stripe']},{ownerVerified:true})).rejects.toThrow();
  await expect(narrowOwnerOAuthFamilyServers(db,{ownerId:'owner-a',
   sessionId:x.actor.id,serverNames:['stripe']},{})).rejects.toThrow();
 }finally{await other.end();}
});
