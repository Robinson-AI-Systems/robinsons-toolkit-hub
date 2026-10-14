import {randomBytes} from 'node:crypto';
import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {issueHubPass} from '../../src/identity.js';
import {stageCallerGrant,activateVerifiedCallerGrant,
 listEligibleRtcTargets} from '../../src/grants.js';
import {retireHubServerAndGrants} from '../../src/registry.js';

const pepper='synthetic-H3-retirement-ci-only-pepper-32';
const settings={grantsKey:randomBytes(32).toString('base64url')};
const testPass='rtc_pass_'+randomBytes(32).toString('base64url');
let db,schema,actor,stripeId,googleId;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await db.connect();
 schema='rtc_retirement_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const file of ['001-hub-foundation.sql','002-hub-oauth.sql',
  '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql'])
  await db.query(await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 const issued=await issueHubPass(db,{ownerId:'owner-a',profile:'full',
  mode:'test',allowWrites:false,areas:['gateway'],ttlSeconds:3600},
  {pepper,ownerVerified:true});
 actor={id:issued.id,ownerId:'owner-a',profile:'full',mode:'test',
  allowWrites:false,areas:['gateway']};
 for(const [name,origin,area] of [
  ['stripe','https://stripe-mcp-psi.vercel.app','billing'],
  ['google','https://google-workspace-mcp.vercel.app','drive']]){
  await db.query(`INSERT INTO hub_servers
   (name,owner_id,prefix,origin,claimed_rtc,claimed_counts)
   VALUES($1,'owner-a',$1,$2,1,'{"tools":2,"writes":0,"money":0}')`,
   [name,origin]);
  const staged=await stageCallerGrant(db,{ownerId:'owner-a',serverName:name,
   callerKind:'pass',callerId:actor.id,areas:[area],
   pass:testPass,ttlSeconds:3600},{ownerVerified:true,settings});
  if(name==='stripe')stripeId=staged.id;
  else googleId=staged.id;
  await activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:staged.id},settings,
   {ownerVerified:true,inspect:async({name:verifiedName,prefix,areas})=>({
    identityVerified:true,callable:false,server:verifiedName,prefix,areas,
    profile:'read_only',mode:'test'})});
 }
});
afterAll(async()=>{
 if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');
  await db.end();}
});
it('retires only the exact owned service and revokes its grants atomically',async()=>{
 const before=await listEligibleRtcTargets(db,actor,{limit:100});
 expect(before.map(t=>t.name)).toEqual(['google','stripe']);
 const other=await retireHubServerAndGrants(db,{ownerId:'other',name:'stripe'},
  {ownerVerified:true});
 expect(other).toBeNull();
 expect((await listEligibleRtcTargets(db,actor,{limit:100})).length).toBe(2);
 const retired=await retireHubServerAndGrants(db,
  {ownerId:'owner-a',name:'stripe'},{ownerVerified:true});
 expect(retired).toEqual({server:'stripe',disabled:true,revokedCount:1});
 const after=await listEligibleRtcTargets(db,actor,{limit:100});
 expect(after.map(t=>t.name)).toEqual(['google']);
 const record=await db.query('SELECT revoked_at FROM hub_server_grants WHERE id=$1',
  [stripeId]);
 expect(record.rows[0].revoked_at).not.toBeNull();
 expect(JSON.stringify(after)).not.toContain(testPass);
 const again=await retireHubServerAndGrants(db,
  {ownerId:'owner-a',name:'stripe'},{ownerVerified:true});
 expect(again.revokedCount).toBe(0);
});
it('rolls back a disabled service if grant revocation SQL fails',async()=>{
 const failing={query:async(sql,...params)=>{
  if(String(sql).startsWith('UPDATE hub_server_grants'))
   throw Error('synthetic SQL failure');
  return db.query(sql,...params);
 }};
 await expect(retireHubServerAndGrants(failing,
  {ownerId:'owner-a',name:'google'},{ownerVerified:true})).rejects.toThrow();
 const server=await db.query('SELECT state FROM hub_servers WHERE name=$1',
  ['google']);
 expect(server.rows[0].state).toBe('active');
 const grant=await db.query('SELECT revoked_at FROM hub_server_grants WHERE id=$1',
  [googleId]);
 expect(grant.rows[0].revoked_at).toBeNull();
 expect((await listEligibleRtcTargets(db,actor,{limit:100}))
  .map(t=>t.name)).toEqual(['google']);
});
it('rejects unverified owner and invalid service without DB writes',async()=>{
 await expect(retireHubServerAndGrants(db,{ownerId:'owner-a',name:'google'}))
  .rejects.toThrow('Independent verified owner');
 await expect(retireHubServerAndGrants(db,
  {ownerId:'owner-a',name:'../../google'},{ownerVerified:true}))
  .rejects.toThrow();
 const row=await db.query('SELECT state FROM hub_servers WHERE name=$1',
  ['google']);
 expect(row.rows[0].state).toBe('active');
});
