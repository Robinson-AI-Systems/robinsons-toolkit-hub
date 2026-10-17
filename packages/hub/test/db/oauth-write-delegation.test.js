import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,
 rotateOAuthRefresh,authenticateOAuth,revokeOAuthFamily} from '../../src/oauth.js';
import {stageCallerGrant,activateVerifiedCallerGrant,
 resolveDelegatedWriteGrant} from '../../src/grants.js';
const pepper='fixture-oauth-write-owner-only-pepper-2026';
const settings={grantsKey:randomBytes(32).toString('base64url')};
const pass='rtc_pass_'+randomBytes(32).toString('base64url');
const clientId='owner_approved_workflow_client',redirectUri='https://agent.example/callback';
const verifier='synthetic-verified-pkce-code-verifier-abcdefghijklmnopqrstuvwxyz';
const challenge=createHash('sha256').update(verifier).digest('base64url');
let db,schema,original,rotated,grant;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('Disposable SQL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
 schema='hub_oauth_write_'+process.pid+'_'+randomBytes(4).toString('hex');
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const file of ['001-hub-foundation.sql','002-hub-oauth.sql',
 '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
 '010-hub-pass-servers.sql','011-hub-oauth-server-scopes.sql',
 '023-hub-user-delegated-grants.sql','024-hub-oauth-user-writes.sql'])
  await db.query(await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 await db.query(`INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts)
  VALUES('stripe','owner-a','stripe','https://stripe-mcp-psi.vercel.app',1,
   '{"tools":45,"writes":12,"money":9}')`);
 await registerOAuthClient(db,{ownerId:'owner-a',clientId,redirectUri},
  {ownerVerified:true});
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
it('requires owner approval, selected server and profile; legacy read-only remains unchanged',async()=>{
 const input={ownerId:'owner-a',clientId,redirectUri,challenge,
  profile:'full',mode:'test',allowWrites:true,areas:['gateway'],
  serverNames:['stripe']};
 await expect(issueOAuthCode(db,{...input,profile:'read_only'},
  {pepper,ownerVerified:true})).rejects.toThrow();
 await expect(issueOAuthCode(db,{...input,serverNames:null},
  {pepper,ownerVerified:true})).rejects.toThrow();
 await expect(issueOAuthCode(db,input,{pepper})).rejects.toThrow();
 const code=await issueOAuthCode(db,input,{pepper,ownerVerified:true});
 const token=await exchangeOAuthCode(db,{code,clientId,redirectUri,verifier},{pepper});
 original=await authenticateOAuth(db,token.access_token,{pepper});
 expect(original).toMatchObject({profile:'full',mode:'test',allowWrites:true,
  ownerId:'owner-a',serverNames:['stripe']});
 const readCode=await issueOAuthCode(db,{...input,profile:'read_only',
  allowWrites:false},{pepper,ownerVerified:true});
 const readToken=await exchangeOAuthCode(db,{code:readCode,clientId,redirectUri,verifier},{pepper});
 const reader=await authenticateOAuth(db,readToken.access_token,{pepper});
 expect(reader).toMatchObject({allowWrites:false,profile:'read_only'});
 expect(await resolveDelegatedWriteGrant(db,{actor:reader,serverName:'stripe'},settings)).toBeNull();
 const refreshed=await rotateOAuthRefresh(db,
  {refreshToken:token.refresh_token,clientId},{pepper});
 rotated=await authenticateOAuth(db,refreshed.access_token,{pepper});
 expect(rotated).toMatchObject({allowWrites:true,profile:'full',mode:'test'});
 expect(rotated.id).not.toBe(original.id);
});
it('uses exact separately issued provider pass and refuses stale/revoked OAuth generations',async()=>{
 const staged=await stageCallerGrant(db,{ownerId:'owner-a',serverName:'stripe',
  callerKind:'oauth',callerId:original.id,profile:'full',mode:'test',
  areas:['billing'],pass,ttlSeconds:3600},{ownerVerified:true,settings});
 grant=staged.id;
 await activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:grant},settings,
  {ownerVerified:true,inspect:async input=>({
   server:input.name,prefix:input.prefix,mode:'test',profile:'full',
   allowWrites:true,areas:input.areas,identityVerified:true,callable:false})});
 const scope=await resolveDelegatedWriteGrant(db,{actor:rotated,serverName:'stripe'},settings);
 expect(scope).toMatchObject({pass,grantId:grant,mode:'test',profile:'full',
  allowWrites:true,areas:['billing']});
 expect(await resolveDelegatedWriteGrant(db,{actor:{...rotated,ownerId:'elsewhere'},
  serverName:'stripe'},settings)).toBeNull();
 expect(await resolveDelegatedWriteGrant(db,{actor:{...rotated,id:'other'},
  serverName:'stripe'},settings)).toBeNull();
 await db.query('UPDATE hub_oauth_sessions SET allow_writes=FALSE WHERE id=$1',[rotated.id]);
 expect(await resolveDelegatedWriteGrant(db,{actor:rotated,serverName:'stripe'},settings))
  .toBeNull();
 await db.query('UPDATE hub_oauth_sessions SET allow_writes=TRUE WHERE id=$1',[rotated.id]);
 expect((await resolveDelegatedWriteGrant(db,{actor:rotated,serverName:'stripe'},settings))?.pass).toBe(pass);
 const rows=await db.query('SELECT ciphertext,pass_caller_id,oauth_session_id FROM hub_server_grants WHERE id=$1',[grant]);
 expect(JSON.stringify(rows.rows)).not.toContain(pass);
 expect(await revokeOAuthFamily(db,{ownerId:'owner-a',sessionId:original.id},
  {ownerVerified:true})).toBe(true);
 expect(await resolveDelegatedWriteGrant(db,{actor:rotated,serverName:'stripe'},settings))
  .toBeNull();
});
