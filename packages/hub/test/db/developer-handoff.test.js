import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes,createHash,generateKeyPairSync,privateDecrypt,constants} from 'node:crypto';
import {registerDeveloperClient,developerClientValid,developerHandoff,developerConsent,ownerSetup} from '../../src/developer-handoff.js';
import {exchangeOAuthCode,rotateOAuthRefresh,authenticateOAuth,issueOAuthCode} from '../../src/oauth.js';
import {verifyOwnerLogin} from '../../src/owner-login.js';
let db,schema;const origin='https://hub.example';const setup=randomBytes(32).toString('base64url');
const env={HUB_OWNER_ID:'test-owner',HUB_TOKEN_PEPPER:'synthetic-database-pepper-never-live',HUB_PUBLIC_ORIGIN:origin,HUB_OWNER_SETUP_HASH:createHash('sha256').update(setup).digest('hex'),HUB_OWNER_SETUP_EXPIRES:new Date(Date.now()+600000).toISOString()};
const password='synthetic-owner-passphrase-never-live';
beforeAll(async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL);if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Only disposable localhost');
 db=new pg.Client({connectionString:url.href});await db.connect();schema='hub_developer_'+process.pid;await db.query('CREATE SCHEMA "'+schema+'"');await db.query('SET search_path TO "'+schema+'"');
 for(const f of ['001-hub-foundation.sql','002-hub-oauth.sql','007-hub-developer.sql','028-hub-native-client-registration.sql'])await db.query(await readFile(new URL('../../migrations/'+f,import.meta.url),'utf8'));
});
afterAll(async()=>{if(db){await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
it('consumes first-time setup once, stores only a verifier and rejects reset/replay',async()=>{
 const req={method:'POST',body:{setup_token:setup,password,confirmation:password}};
 const results=await Promise.all([ownerSetup(db,req,{env}),ownerSetup(db,req,{env})]);
 expect(results.map(r=>r.status).sort()).toEqual([201,409]);
 const row=(await db.query('SELECT verifier FROM hub_owner_credentials')).rows[0];expect(row.verifier).not.toContain(password);
 expect((await verifyOwnerLogin(db,{socket:{remoteAddress:'127.0.0.1'}},password,{env})).approved).toBe(true);
 expect((await ownerSetup(db,{method:'GET',query:{setup_token:setup}},{env})).status).toBe(409);
 expect((await ownerSetup(db,{method:'GET',query:{setup_token:'x'.repeat(43)}},{env})).status).toBe(403);
});
it('runs an original Hub full developer grant, encrypted polling, exchange and refresh',async()=>{
 const registered=await registerDeveloperClient(db,{redirect_uris:[origin+'/api/developer/connect'],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'client_secret_post'},{env});
 expect(registered.status).toBe(201);const {client_id,client_secret}=registered.json;
 expect(await developerClientValid(db,client_id,client_secret,{env})).toBe(true);expect(await developerClientValid(db,client_id,'w'.repeat(43),{env})).toBe(false);
 const keys=generateKeyPairSync('rsa',{modulusLength:2048}),verifier=randomBytes(32).toString('base64url'),poll=randomBytes(32).toString('base64url');
 const input={client_id,challenge:createHash('sha256').update(verifier).digest('base64url'),poll_hash:createHash('sha256').update(poll).digest('hex'),public_key:keys.publicKey.export({type:'spki',format:'pem'}),profile:'full'};
 const begun=await developerHandoff(db,{method:'POST',body:input},{env});expect(begun.status).toBe(201);
 expect((await developerHandoff(db,{method:'POST',body:input},{env})).status).toBe(409);
 const url=new URL(begun.json.authorization_url),fields=Object.fromEntries(url.searchParams);
 const pending=await developerHandoff(db,{method:'GET',query:{state:fields.state},headers:{authorization:'Bearer '+poll}},{env});expect(pending.status).toBe(202);
 expect((await developerConsent(db,{method:'POST',socket:{remoteAddress:'127.0.0.2'}},{...fields,password:'wrong'},{env})).status).toBe(401);
 expect((await developerConsent(db,{method:'GET'},{...fields,profile:'read_only'},{env})).status).toBe(400);
 const consent=await developerConsent(db,{method:'POST',socket:{remoteAddress:'127.0.0.2'}},{...fields,password},{env});expect(consent.status).toBe(303);
 const callback=new URL(consent.redirect);const code=callback.searchParams.get('code');
 expect((await developerHandoff(db,{method:'GET',query:Object.fromEntries(callback.searchParams),headers:{}},{env})).status).toBe(200);
 const request={method:'GET',query:{state:fields.state},headers:{authorization:'Bearer '+poll}};
 const delivered=await developerHandoff(db,request,{env});expect(delivered.status).toBe(200);
 const opened=privateDecrypt({key:keys.privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(delivered.json.sealed_code,'base64url')).toString();expect(opened).toBe(code);
 expect((await developerHandoff(db,request,{env})).json.sealed_code).toBe(delivered.json.sealed_code);
 const issued=await exchangeOAuthCode(db,{clientId:client_id,code:opened,verifier,redirectUri:origin+'/api/developer/connect'},{pepper:env.HUB_TOKEN_PEPPER});
 expect(await authenticateOAuth(db,issued.access_token,{pepper:env.HUB_TOKEN_PEPPER})).toMatchObject({profile:'full',mode:'test'});
 const refreshed=await rotateOAuthRefresh(db,{clientId:client_id,refreshToken:issued.refresh_token},{pepper:env.HUB_TOKEN_PEPPER});expect(refreshed.refresh_token).not.toBe(issued.refresh_token);
 expect((await developerHandoff(db,{...request,headers:{authorization:'Bearer '+'w'.repeat(43)}},{env})).status).toBe(410);
});
it('keeps arbitrary native MCP clients separate from the fixed original developer handoff',async()=>{
 const original=await registerDeveloperClient(db,{
  redirect_uris:['https://thirdparty-client.example.org/cb'],
  grant_types:['authorization_code','refresh_token'],response_types:['code'],
  token_endpoint_auth_method:'client_secret_post'},{env});
 expect(original.status).toBe(201);
 const got=await db.query('SELECT redirect_uri FROM hub_oauth_clients WHERE client_id=$1',
  [original.json.client_id]);
 expect(got.rows[0].redirect_uri).toBe('https://thirdparty-client.example.org/cb');
 const poll=await developerHandoff(db,{method:'POST',body:{
  client_id:original.json.client_id,profile:'read_only',
  challenge:'a'.repeat(43),poll_hash:'f'.repeat(64),
  public_key:'invalid'}},{env});
 expect(poll.status).toBe(400);
 const no=await registerDeveloperClient(db,{
  redirect_uris:['http://attacker.example.org/callback'],
  grant_types:['authorization_code'],response_types:['code'],
  token_endpoint_auth_method:'none'},{env});
 expect(no.status).toBe(400);
});
it('issues separately consented LIVE native PKCE public-client credentials with refresh isolation',async()=>{
 const redirect='https://independent-agent.example.org/auth/callback';
 const pub=await registerDeveloperClient(db,{
  redirect_uris:[redirect],grant_types:['authorization_code','refresh_token'],
  response_types:['code'],token_endpoint_auth_method:'none',
  client_name:'Independent MCP agent'},{env});
 expect(pub.status).toBe(201);
 expect(pub.json.client_secret).toBeUndefined();
 const cid=pub.json.client_id;
 expect(await developerClientValid(db,cid,null,{env})).toBe(true);
 expect(await developerClientValid(db,cid,'wrong',{env})).toBe(false);
 const verifier=randomBytes(32).toString('base64url');
 const challenge=createHash('sha256').update(verifier).digest('base64url');
 const code=await issueOAuthCode(db,{
  ownerId:env.HUB_OWNER_ID,clientId:cid,redirectUri:redirect,
  challenge,profile:'read_only',mode:'live',allowWrites:false,areas:['gateway']
 },{pepper:env.HUB_TOKEN_PEPPER,ownerVerified:true});
 const exchange=await exchangeOAuthCode(db,{clientId:cid,code,verifier,redirectUri:redirect},
  {pepper:env.HUB_TOKEN_PEPPER});
 expect(exchange).toHaveProperty('access_token');
 expect(await authenticateOAuth(db,exchange.access_token,{pepper:env.HUB_TOKEN_PEPPER}))
  .toMatchObject({mode:'live',profile:'read_only',allowWrites:false});
 const rotated=await rotateOAuthRefresh(db,{
  clientId:cid,refreshToken:exchange.refresh_token},{pepper:env.HUB_TOKEN_PEPPER});
 expect(rotated.refresh_token).not.toBe(exchange.refresh_token);
 expect(await rotateOAuthRefresh(db,{clientId:cid,
  refreshToken:exchange.refresh_token},{pepper:env.HUB_TOKEN_PEPPER})).toBeNull();
 // Old-refresh replay must invalidate the whole family, including the
 // token from the successful earlier rotation.
 expect(await authenticateOAuth(db,rotated.access_token,{pepper:env.HUB_TOKEN_PEPPER}))
  .toBeNull();
 expect(await developerClientValid(db,cid,'w'.repeat(43),{env})).toBe(false);
 const other=await registerDeveloperClient(db,{
  redirect_uris:['https://other-agent.example.org/cb'],
  token_endpoint_auth_method:'client_secret_post',
  grant_types:['authorization_code'],response_types:['code']},{env});
 expect(await developerClientValid(db,other.json.client_id,other.json.client_secret,{env}))
  .toBe(true);
 expect(await developerClientValid(db,other.json.client_id,null,{env})).toBe(false);
 expect(await developerClientValid(db,other.json.client_id,'q'.repeat(43),{env})).toBe(false);
});
