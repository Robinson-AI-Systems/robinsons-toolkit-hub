import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,authenticateOAuth,
  rotateOAuthRefresh,revokeOAuthFamily} from '../../src/oauth.js';
import {stageCallerGrant,activateVerifiedCallerGrant,listEligibleRtcTargets,
  resolveActiveCallerGrant,revokeCallerGrant} from '../../src/grants.js';

const pepper='h4-oauth-postgres-only-synthetic-pepper-32';
const settings={grantsKey:randomBytes(32).toString('base64url')};
const pass='rtc_pass_'+randomBytes(32).toString('base64url');
const clientId='h4_authorized_oauth_client',redirectUri='https://agent.example.com/callback';
const verifier='correct-code-verifier-0123456789-abcdefghijklmnopqrstuvwxyz';
const challenge=createHash('sha256').update(verifier).digest('base64url');
let db,schema;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw new Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
 schema='hub_oauth_h4_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');await db.query('SET search_path TO "'+schema+'"');
 for(const migration of ['001-hub-foundation.sql','002-hub-oauth.sql',
  '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
  '010-hub-pass-servers.sql','011-hub-oauth-server-scopes.sql'])
   await db.query(await readFile(new URL('../../migrations/'+migration,import.meta.url),'utf8'));
 await registerOAuthClient(db,{ownerId:'owner-a',clientId,redirectUri},
   {ownerVerified:true});
 for(const name of ['stripe','workspace'])
  await db.query("INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts) VALUES($1,'owner-a',$2,$3,1,'{\"tools\":3,\"writes\":0,\"money\":0}')",
    [name,name,'https://'+name+'.example.com']);
});
afterAll(async()=>{if(db){
 if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();
}});
it('requires registered, owned server names and persists PKCE and refresh-family scope',async()=>{
 const input={ownerId:'owner-a',clientId,redirectUri,challenge,
  profile:'read_only',mode:'test',areas:['gateway'],serverNames:['stripe']};
 await expect(issueOAuthCode(db,{...input,serverNames:['unregistered']},
   {pepper,ownerVerified:true})).rejects.toThrow('registered');
 const code=await issueOAuthCode(db,input,{pepper,ownerVerified:true});
 const token=await exchangeOAuthCode(db,{code,clientId,redirectUri,verifier},{pepper});
 expect(token.access_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
 const original=await authenticateOAuth(db,token.access_token,{pepper});
 expect(original.serverNames).toEqual(['stripe']);
 expect(Object.isFrozen(original.serverNames)).toBe(true);
 const grant=await stageCallerGrant(db,{ownerId:'owner-a',serverName:'stripe',
  callerKind:'oauth',callerId:original.id,areas:['billing'],pass,
  ttlSeconds:3600},{ownerVerified:true,settings});
 await expect(stageCallerGrant(db,{ownerId:'owner-a',serverName:'workspace',
   callerKind:'oauth',callerId:original.id,areas:['billing'],pass,
   ttlSeconds:3600},{ownerVerified:true,settings})).rejects.toThrow('scope');
 await activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:grant.id},settings,
  {ownerVerified:true,inspect:async arg=>({server:arg.name,prefix:arg.prefix,
   areas:arg.areas,mode:'test',profile:'read_only',
   identityVerified:true,callable:false})});
 expect((await listEligibleRtcTargets(db,original)).map(x=>x.name)).toEqual(['stripe']);
 expect(await resolveActiveCallerGrant(db,{actor:original,serverName:'workspace'},settings))
  .toBeNull();
 const active=await resolveActiveCallerGrant(db,{actor:original,serverName:'stripe'},settings);
 expect(active).toMatchObject({grantId:grant.id,profile:'read_only',mode:'test'});
 expect(active.pass).toBe(pass);
 const rotated=await rotateOAuthRefresh(db,{refreshToken:token.refresh_token,clientId},{pepper});
 const fresh=await authenticateOAuth(db,rotated.access_token,{pepper});
 expect(fresh.id).not.toBe(original.id);
 expect(fresh.serverNames).toEqual(['stripe']);
 expect((await listEligibleRtcTargets(db,fresh)).map(x=>x.name)).toEqual(['stripe']);
 expect(await resolveActiveCallerGrant(db,{actor:fresh,serverName:'stripe'},settings))
  .toMatchObject({grantId:grant.id});
 await db.query("UPDATE hub_oauth_sessions SET allowed_servers=ARRAY['workspace']::text[] WHERE id=$1",
   [original.id]);
 expect(await listEligibleRtcTargets(db,fresh)).toEqual([]);
 expect(await resolveActiveCallerGrant(db,{actor:fresh,serverName:'stripe'},settings))
  .toBeNull();
 expect(await revokeOAuthFamily(db,{ownerId:'owner-a',sessionId:fresh.id},
   {ownerVerified:true})).toBe(true);
 expect(await authenticateOAuth(db,rotated.access_token,{pepper})).toBeNull();
 expect(await revokeCallerGrant(db,{ownerId:'owner-a',id:grant.id},
   {ownerVerified:true})).toBe(true);
 await expect(stageCallerGrant(db,{ownerId:'owner-a',serverName:'stripe',
   callerKind:'oauth',callerId:fresh.id,areas:['billing'],pass,
   ttlSeconds:3600},{ownerVerified:true,settings})).rejects.toThrow();
});
