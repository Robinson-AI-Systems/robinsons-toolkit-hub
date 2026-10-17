import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {issueHubPass,authenticateHubPass,revokeHubPass} from '../../src/identity.js';
import {stageCallerGrant,activateVerifiedCallerGrant,
 resolveActiveCallerGrant,resolveDelegatedWriteGrant,revokeCallerGrant} from '../../src/grants.js';
const pepper='fixture-only-owner-write-delegation-pepper-2026';
const settings={grantsKey:randomBytes(32).toString('base64url')};
const upstream='rtc_pass_'+randomBytes(32).toString('base64url');
let db,schema,ownerPass,actor,stagedId;
const owner='write-owner';
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('Disposable Postgres required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await db.connect();schema='hub_delegated_'+process.pid+'_'+randomBytes(4).toString('hex');
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const file of ['001-hub-foundation.sql','002-hub-oauth.sql',
  '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
  '010-hub-pass-servers.sql','023-hub-user-delegated-grants.sql'])
   await db.query(await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 await db.query(`INSERT INTO hub_servers
  (name,owner_id,prefix,origin,claimed_rtc,claimed_counts,state)
  VALUES('neon-mcp',$1,'neon','https://neon-mcp.vercel.app',1,
  '{"tools":40,"writes":25,"money":0}','pending')`,[owner]);
 const issued=await issueHubPass(db,{ownerId:owner,profile:'full',mode:'live',
  allowWrites:true,areas:['gateway'],serverNames:['neon-mcp'],ttlSeconds:3600},
  {ownerVerified:true,pepper});
 ownerPass=issued.pass;
 actor=await authenticateHubPass(db,'Bearer '+ownerPass,{pepper});
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
it('owner expressly issues LIVE/full writable bearer but never silently upgrades a read-only caller',async()=>{
 expect(actor).toMatchObject({ownerId:owner,mode:'live',profile:'full',allowWrites:true});
 await expect(issueHubPass(db,{ownerId:owner,profile:'read_only',mode:'live',
  allowWrites:true,areas:['gateway'],serverNames:['neon-mcp'],ttlSeconds:3600},
  {ownerVerified:true,pepper})).rejects.toThrow();
 await expect(issueHubPass(db,{ownerId:owner,profile:'full',mode:'live',
  allowWrites:true,areas:['gateway'],serverNames:['neon-mcp'],ttlSeconds:3600},
  {ownerVerified:false,pepper})).rejects.toThrow();
 expect(await resolveDelegatedWriteGrant(db,{actor,serverName:'neon-mcp'},settings)).toBeNull();
});
it('stages encrypted exact-mode provider pass, checks issuer whoami and activates without effects',async()=>{
 const grant=await stageCallerGrant(db,{ownerId:owner,serverName:'neon-mcp',
  callerKind:'pass',callerId:actor.id,profile:'full',mode:'live',
  areas:['projects'],pass:upstream,ttlSeconds:3600},{ownerVerified:true,settings});
 stagedId=grant.id;
 expect(grant).toMatchObject({profile:'full',mode:'live',state:'staged'});
 expect(await resolveDelegatedWriteGrant(db,{actor,serverName:'neon-mcp'},settings)).toBeNull();
 const bad=()=>activateVerifiedCallerGrant(db,{ownerId:owner,id:stagedId},settings,
  {ownerVerified:true,inspect:async()=>({server:'neon-mcp',prefix:'neon',
    profile:'read_only',mode:'test',areas:['projects'],identityVerified:true,
    callable:false})});
 await expect(bad()).rejects.toThrow('Scoped RTC identity');
 const inspect=async({profile,mode,pass,areas})=>{
  expect(profile).toBe('full');expect(mode).toBe('live');
  expect(pass).toBe(upstream);expect(areas).toEqual(['projects']);
  return {server:'neon-mcp',prefix:'neon',profile:'full',mode:'live',
    allowWrites:true,areas:['projects'],identityVerified:true,callable:false};
 };
 const active=await activateVerifiedCallerGrant(db,{ownerId:owner,id:stagedId},
  settings,{ownerVerified:true,inspect});
 expect(active).toMatchObject({state:'verified_live',registryActive:true});
 const grantTarget=await resolveDelegatedWriteGrant(db,
  {actor,serverName:'neon-mcp'},settings);
 expect(grantTarget).toMatchObject({pass:upstream,profile:'full',mode:'live',
  grantId:stagedId,allowWrites:true,areas:['projects']});
 const readOnly={...actor,allowWrites:false};
 expect(await resolveDelegatedWriteGrant(db,{actor:readOnly,serverName:'neon-mcp'},settings))
  .toBeNull();
 expect(await resolveActiveCallerGrant(db,{actor,serverName:'neon-mcp'},settings))
  .toBeNull();
 const rows=await db.query('SELECT * FROM hub_server_grants WHERE id=$1',[stagedId]);
 expect(JSON.stringify(rows.rows)).not.toContain(upstream);
});
it('follows owner narrowing, wrong caller, and exact grant revocation with no stale upgrade',async()=>{
 expect(await resolveDelegatedWriteGrant(db,{actor:{...actor,id:'wrong'},
  serverName:'neon-mcp'},settings)).toBeNull();
 const other=await resolveDelegatedWriteGrant(db,{actor:{...actor,ownerId:'other'},
  serverName:'neon-mcp'},settings);
 expect(other).toBeNull();
 const blocked=await db.query('UPDATE hub_callers SET allow_writes=FALSE WHERE id=$1',
  [actor.id]);
 expect(blocked.rowCount).toBe(1);
 expect(await resolveDelegatedWriteGrant(db,{actor,serverName:'neon-mcp'},settings)).toBeNull();
 await db.query('UPDATE hub_callers SET allow_writes=TRUE WHERE id=$1',[actor.id]);
 expect((await resolveDelegatedWriteGrant(db,{actor,serverName:'neon-mcp'},settings))?.pass)
  .toBe(upstream);
 expect(await revokeCallerGrant(db,{ownerId:owner,id:stagedId},
  {ownerVerified:true})).toBe(true);
 expect(await resolveDelegatedWriteGrant(db,{actor,serverName:'neon-mcp'},settings))
  .toBeNull();
 await revokeHubPass(db,actor.id,owner,{ownerVerified:true});
 expect(await authenticateHubPass(db,'Bearer '+ownerPass,{pepper})).toBeNull();
});
