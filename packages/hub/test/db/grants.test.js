import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {stageCallerGrant,listCallerGrants,revokeCallerGrant,resolveActiveCallerGrant} from '../../src/grants.js';
import {issueHubPass,revokeHubPass} from '../../src/identity.js';
const settings={grantsKey:randomBytes(32).toString('base64url')};
const pepper='synthetic-grant-test-only-hmac-pepper-32';
const upstreamPass='rtc_pass_'+randomBytes(32).toString('base64url');
let db,schema,callerId,grantId;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw new Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
 schema='hub_grants_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');await db.query('SET search_path TO "'+schema+'"');
 for(const path of ['001-hub-foundation.sql','002-hub-oauth.sql',
  '004-hub-registry.sql','005-hub-grants.sql'])
  await db.query(await readFile(new URL('../../migrations/'+path,import.meta.url),'utf8'));
 const issued=await issueHubPass(db,{ownerId:'owner-a',profile:'read_only',areas:['gateway'],
  mode:'test',allowWrites:false,ttlSeconds:3600},{pepper,ownerVerified:true});
 callerId=issued.id;
 await db.query(`INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts)
  VALUES('stripe','owner-a','stripe','https://stripe-mcp-psi.vercel.app',1,'{"tools":1,"writes":0,"money":0}')`);
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
it('encrypts TEST upstream pass and binds it to one owner and caller',async()=>{
 const grant=await stageCallerGrant(db,{ownerId:'owner-a',serverName:'stripe',
  callerKind:'pass',callerId,areas:['billing'],pass:upstreamPass,ttlSeconds:3600},
  {ownerVerified:true,settings});
 grantId=grant.id;
 const rows=await db.query('SELECT * FROM hub_server_grants WHERE id=$1',[grantId]);
 expect(rows.rows[0].ciphertext.toString('utf8')).not.toContain(upstreamPass);
 expect(JSON.stringify(await listCallerGrants(db,'owner-a',{ownerVerified:true})))
   .not.toContain(upstreamPass);
 expect(await listCallerGrants(db,'other',{ownerVerified:true})).toEqual([]);
 const actor={id:callerId,ownerId:'owner-a',profile:'read_only',mode:'test',
  allowWrites:false,areas:['gateway']};
 // Pending registry cannot emit a pass, even for its exact caller.
 expect(await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings)).toBeNull();
 await expect(stageCallerGrant(db,{ownerId:'owner-a',serverName:'stripe',
  callerKind:'pass',callerId,areas:['billing'],pass:upstreamPass,ttlSeconds:3600},
  {ownerVerified:true,settings})).rejects.toThrow();
 expect(await revokeCallerGrant(db,{ownerId:'other',id:grantId},
  {ownerVerified:true})).toBe(false);
 expect(await revokeCallerGrant(db,{ownerId:'owner-a',id:grantId},
  {ownerVerified:true})).toBe(true);
 expect(await revokeCallerGrant(db,{ownerId:'owner-a',id:grantId},
  {ownerVerified:true})).toBe(false);
});
it('rejects already-revoked caller at storage boundary',async()=>{
 await revokeHubPass(db,callerId,'owner-a',{ownerVerified:true});
 await expect(stageCallerGrant(db,{ownerId:'owner-a',serverName:'stripe',
  callerKind:'pass',callerId,areas:['billing'],pass:upstreamPass,ttlSeconds:3600},
  {ownerVerified:true,settings})).rejects.toThrow();
});
