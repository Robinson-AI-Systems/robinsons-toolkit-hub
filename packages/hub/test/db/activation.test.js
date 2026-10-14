import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,
  authenticateOAuth,rotateOAuthRefresh,revokeOAuthFamily} from '../../src/oauth.js';
import {issueHubPass} from '../../src/identity.js';
import {stageCallerGrant,resolveActiveCallerGrant,listEligibleRtcTargets,revokeCallerGrant,
  activateVerifiedCallerGrant} from '../../src/grants.js';
import {disableStagedServer} from '../../src/registry.js';
const settings={grantsKey:randomBytes(32).toString('base64url')};
const pepper='synthetic-h2-verified-sql-test-only-pepper-32';
const pass='rtc_pass_'+randomBytes(32).toString('base64url');
let db,schema,actor,grantId;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await db.connect();
 schema='hub_activation_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const p of ['001-hub-foundation.sql','002-hub-oauth.sql',
   '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql'])
   await db.query(await readFile(new URL('../../migrations/'+p,import.meta.url),'utf8'));
 const c=await issueHubPass(db,{ownerId:'owner-a',profile:'read_only',
  mode:'test',areas:['gateway'],allowWrites:false,ttlSeconds:3600},
  {pepper,ownerVerified:true});
 actor={id:c.id,ownerId:'owner-a',mode:'test',profile:'read_only',
  areas:['gateway'],allowWrites:false};
 await db.query(`INSERT INTO hub_servers
   (name,owner_id,prefix,origin,claimed_rtc,claimed_counts)
   VALUES('stripe','owner-a','stripe','https://stripe-mcp-psi.vercel.app',1,
   '{"tools":1,"writes":0,"money":0}')`);
 const staged=await stageCallerGrant(db,{ownerId:'owner-a',serverName:'stripe',
  callerKind:'pass',callerId:actor.id,areas:['billing'],pass,
  ttlSeconds:3600},{ownerVerified:true,settings});
 grantId=staged.id;
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');
 await db.end();}});
it('refuses wrong-owner and failed probe without activating pending grants',async()=>{
 const good=async input=>({server:input.name,prefix:input.prefix,
  areas:input.areas,profile:'read_only',mode:'test',
  identityVerified:true,callable:false});
 await expect(activateVerifiedCallerGrant(db,{ownerId:'not-owner',id:grantId},
  settings,{ownerVerified:true,inspect:good})).rejects.toThrow();
 await expect(activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:grantId},
  settings,{ownerVerified:true,inspect:async()=>{throw Error('provider denied');}}))
  .rejects.toThrow();
 expect((await db.query('SELECT state FROM hub_servers')).rows[0].state).toBe('pending');
 expect((await db.query('SELECT verified_at FROM hub_server_grants')).rows[0]
  .verified_at).toBeNull();
 expect(await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings)).toBeNull();
});
it('activates exact TEST grant after scope proof, then revocation disables resolution',async()=>{
 const inspect=async input=>{
  expect(input.pass).toBe(pass);
  expect(input.areas).toEqual(['billing']);
  return {server:input.name,prefix:input.prefix,areas:[...input.areas],
   profile:'read_only',mode:'test',identityVerified:true,callable:false};
 };
 const result=await activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:grantId},
  settings,{ownerVerified:true,inspect});
 expect(result).toMatchObject({registryActive:true,providerRoutingEnabled:false});
 expect((await db.query('SELECT state FROM hub_servers')).rows[0].state).toBe('active');
 const grant=await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings);
 expect(grant.pass).toBe(pass);
 expect(grant.areas).toEqual(['billing']);
 expect(await revokeCallerGrant(db,{ownerId:'owner-a',id:grantId},
  {ownerVerified:true})).toBe(true);
 expect(await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings)).toBeNull();
 expect(await disableStagedServer(db,{ownerId:'owner-a',name:'stripe'},
  {ownerVerified:true})).toBe(true);
 expect((await db.query('SELECT state FROM hub_servers')).rows[0].state).toBe('disabled');
});

it('narrows full TEST developer identity to a separately verified read_only RTC grant',async()=>{
 const issued=await issueHubPass(db,{ownerId:'owner-a',profile:'full',
  mode:'test',areas:['gateway'],allowWrites:false,ttlSeconds:3600},
  {pepper,ownerVerified:true});
 const developer={id:issued.id,ownerId:'owner-a',mode:'test',profile:'full',
  areas:['gateway'],allowWrites:false};
 await db.query(`INSERT INTO hub_servers
   (name,owner_id,prefix,origin,claimed_rtc,claimed_counts)
   VALUES('workspace','owner-a','google','https://google-workspace-mcp.vercel.app',1,
   '{"tools":20,"writes":3,"money":0}')`);
 const staged=await stageCallerGrant(db,{ownerId:'owner-a',serverName:'workspace',
  callerKind:'pass',callerId:developer.id,areas:['gmail'],pass,ttlSeconds:3600},
  {ownerVerified:true,settings});
 expect(await listEligibleRtcTargets(db,developer)).toEqual([]);
 const accepted=await activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:staged.id},
  settings,{ownerVerified:true,inspect:async({name,prefix,areas})=>({
    server:name,prefix,areas,mode:'test',profile:'read_only',
    identityVerified:true,callable:false})});
 expect(accepted.registryActive).toBe(true);
 expect(await listEligibleRtcTargets(db,developer)).toEqual([
  expect.objectContaining({name:'workspace',prefix:'google',
    readOnlyGrant:true,areas:['gmail']})]);
 const active=await resolveActiveCallerGrant(db,{actor:developer,serverName:'workspace'},settings);
 expect(active).toMatchObject({server:'workspace',profile:'read_only',
  mode:'test',origin:'https://google-workspace-mcp.vercel.app',
  prefix:'google',areas:['gmail']});
 expect(active.pass).toBe(pass);
 for(const narrowed of [{...developer,mode:'live'},{...developer,allowWrites:true},
   {...developer,areas:[]},{...developer,id:'different'}]) {
   expect(await listEligibleRtcTargets(db,narrowed)).toEqual([]);
   expect(await resolveActiveCallerGrant(db,{actor:narrowed,
     serverName:'workspace'},settings)).toBeNull();
 }
 expect(await revokeCallerGrant(db,{ownerId:'owner-a',id:staged.id},
  {ownerVerified:true})).toBe(true);
 expect(await listEligibleRtcTargets(db,developer)).toEqual([]);
 expect(await resolveActiveCallerGrant(db,{actor:developer,serverName:'workspace'},settings))
   .toBeNull();
});

it('keeps a sealed read grant bound to the same OAuth family through refresh, not another family',async()=>{
 const clientId='authorized_builder_client';
 const redirectUri='https://agent.example.com/oauth/cb';
 const verifier='oauth-verifier-valid-0123456789-abcdefghijklmnopqrstuvwxyz';
 const challenge=createHash('sha256').update(verifier).digest('base64url');
 await registerOAuthClient(db,{ownerId:'owner-a',clientId,redirectUri},
   {ownerVerified:true});
 const code=await issueOAuthCode(db,{ownerId:'owner-a',clientId,redirectUri,
  challenge,profile:'full',mode:'test',areas:['gateway']},{pepper,ownerVerified:true});
 const first=await exchangeOAuthCode(db,{code,clientId,redirectUri,verifier},{pepper});
 const before=await authenticateOAuth(db,first.access_token,{pepper});
 await db.query(`INSERT INTO hub_servers
   (name,owner_id,prefix,origin,claimed_rtc,claimed_counts)
   VALUES('neon','owner-a','neon','https://neon-mcp.vercel.app',1,
   '{"tools":10,"writes":0,"money":0}')`);
 const grant=await stageCallerGrant(db,{ownerId:'owner-a',serverName:'neon',
   callerKind:'oauth',callerId:before.id,areas:['database'],pass,ttlSeconds:3600},
   {ownerVerified:true,settings});
 await activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:grant.id},settings,
  {ownerVerified:true,inspect:async({name,prefix,areas})=>({
   server:name,prefix,areas,profile:'read_only',mode:'test',
   identityVerified:true,callable:false})});
 const token=await rotateOAuthRefresh(db,{refreshToken:first.refresh_token,clientId},{pepper});
 const after=await authenticateOAuth(db,token.access_token,{pepper});
 expect(after.id).not.toBe(before.id);
 expect(after.profile).toBe('full');
 expect((await listEligibleRtcTargets(db,after)).map(x=>x.name)).toEqual(['neon']);
 expect(await resolveActiveCallerGrant(db,{actor:after,serverName:'neon'},settings))
  .toMatchObject({grantId:grant.id,profile:'read_only',mode:'test'});
 const separate=await issueOAuthCode(db,{ownerId:'owner-a',clientId,redirectUri,
  challenge,profile:'full',mode:'test',areas:['gateway']},{pepper,ownerVerified:true});
 const otherToken=await exchangeOAuthCode(db,{code:separate,clientId,redirectUri,verifier},{pepper});
 const otherActor=await authenticateOAuth(db,otherToken.access_token,{pepper});
 expect(await listEligibleRtcTargets(db,otherActor)).toEqual([]);
 expect(await resolveActiveCallerGrant(db,{actor:otherActor,serverName:'neon'},settings))
  .toBeNull();
 await revokeOAuthFamily(db,{ownerId:'owner-a',sessionId:after.id},{ownerVerified:true});
 expect(await listEligibleRtcTargets(db,after)).toEqual([]);
 expect(await resolveActiveCallerGrant(db,{actor:after,serverName:'neon'},settings))
  .toBeNull();
});
