import { beforeAll, afterAll, it, expect } from 'vitest';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { registerOAuthClient, issueOAuthCode, exchangeOAuthCode,
  rotateOAuthRefresh, authenticateOAuth, revokeOAuthFamily, revokeOAuthToken,
  listOwnerOAuthSessions } from '../../src/oauth.js';
const pepper='synthetic-oauth-sql-only-pepper-not-live-key';
const verifier='correct-hub-pkce-verifier-0123456789-aBCDEFGHIJKLMNOPQRSTUV';
const challenge=createHash('sha256').update(verifier).digest('base64url');
let db,schema;
beforeAll(async()=>{
  if(!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL required');
  db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
  schema='hub_oauth_'+process.pid+'_'+Math.floor(Math.random()*100000);
  await db.query('CREATE SCHEMA "'+schema+'"');await db.query('SET search_path TO "'+schema+'"');
  for(const f of ['001-hub-foundation.sql','002-hub-oauth.sql'])
    await db.query(await readFile(new URL('../../migrations/'+f,import.meta.url),'utf8'));
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
it('exchanges exact-client S256 once, preserves scopes over refresh and revokes family',async()=>{
  await registerOAuthClient(db,{ownerId:'real-owner',clientId:'approvedclient',redirectUri:'https://agent.example/cb'},
    {ownerVerified:true});
  const input={ownerId:'real-owner',clientId:'approvedclient',redirectUri:'https://agent.example/cb',
    challenge,profile:'read_only',mode:'test',areas:['testing']};
  const code=await issueOAuthCode(db,input,{pepper,ownerVerified:true});
  expect(await exchangeOAuthCode(db,{code,clientId:'wrong',redirectUri:input.redirectUri,verifier},{pepper}))
    .toBeNull();
  const first=await exchangeOAuthCode(db,{code,clientId:input.clientId,redirectUri:input.redirectUri,verifier},{pepper});
  expect(first.access_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await exchangeOAuthCode(db,{code,clientId:input.clientId,redirectUri:input.redirectUri,verifier},{pepper}))
    .toBeNull();
  expect(await authenticateOAuth(db,first.access_token,{pepper})).toMatchObject({
    ownerId:'real-owner',profile:'read_only',mode:'test',areas:['testing'],allowWrites:false});
  const rotated=await rotateOAuthRefresh(db,{refreshToken:first.refresh_token,clientId:input.clientId},{pepper});
  expect(rotated.access_token).not.toBe(first.access_token);
  const actor=await authenticateOAuth(db,rotated.access_token,{pepper});
  expect(actor.areas).toEqual(['testing']);
  expect(await listOwnerOAuthSessions(db,'real-owner',{ownerVerified:true}))
    .toEqual(expect.arrayContaining([expect.objectContaining({id:actor.id})]));
  // Replaying a consumed refresh is a bearer compromise: both fresh and
  // older sessions in that family are invalidated at the database boundary.
  expect(await rotateOAuthRefresh(db,{refreshToken:first.refresh_token,clientId:input.clientId},{pepper})).toBeNull();
  expect(await authenticateOAuth(db,rotated.access_token,{pepper})).toBeNull();
  const nextCode=await issueOAuthCode(db,input,{pepper,ownerVerified:true});
  const next=await exchangeOAuthCode(db,{code:nextCode,clientId:input.clientId,
    redirectUri:input.redirectUri,verifier},{pepper});
  const nextActor=await authenticateOAuth(db,next.access_token,{pepper});
  expect(await revokeOAuthFamily(db,{ownerId:'wrong',sessionId:nextActor.id},{ownerVerified:true})).toBe(false);
  expect(await revokeOAuthToken(db,{clientId:'otherclient',token:next.refresh_token},{pepper})).toBe(true);
  expect(await authenticateOAuth(db,next.access_token,{pepper})).not.toBeNull();
  expect(await revokeOAuthToken(db,{clientId:input.clientId,token:next.refresh_token},{pepper})).toBe(true);
  expect(await authenticateOAuth(db,next.access_token,{pepper})).toBeNull();
  const finalCode=await issueOAuthCode(db,input,{pepper,ownerVerified:true});
  const finalToken=await exchangeOAuthCode(db,{code:finalCode,clientId:input.clientId,
    redirectUri:input.redirectUri,verifier},{pepper});
  const finalActor=await authenticateOAuth(db,finalToken.access_token,{pepper});
  expect(await revokeOAuthFamily(db,{ownerId:'real-owner',sessionId:finalActor.id},{ownerVerified:true})).toBe(true);
  expect(await authenticateOAuth(db,rotated.access_token,{pepper})).toBeNull();
  expect(await authenticateOAuth(db,first.access_token,{pepper})).toBeNull();
});
