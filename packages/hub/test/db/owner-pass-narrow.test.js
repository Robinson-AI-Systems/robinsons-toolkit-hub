import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {issueHubPass,authenticateHubPass,narrowHubPassServers,
  listHubPassScopes,revokeHubPass} from '../../src/identity.js';
import {stageCallerGrant,activateVerifiedCallerGrant,
  listEligibleRtcTargets,resolveActiveCallerGrant} from '../../src/grants.js';
import {storeRtcResult,readRtcResult} from '../../src/rtc-results.js';

const pepper='owner-h4-db-test-pepper-only-32-characters';
const settings={grantsKey:randomBytes(32).toString('base64url'),
  resultsKey:randomBytes(32).toString('base64url'),pepper};
const upstreamPass='rtc_pass_'+randomBytes(32).toString('base64url');
const issueArgs={ownerId:'owner-a',profile:'read_only',mode:'test',
  areas:['gateway'],allowWrites:false,ttlSeconds:3600,
  serverNames:['stripe','workspace']};
let db,schema,issued,actor,workspaceGrant,result;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw new Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
 schema='hub_owner_narrow_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');await db.query('SET search_path TO "'+schema+'"');
 for(const migration of ['001-hub-foundation.sql','002-hub-oauth.sql',
  '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
  '008-hub-rtc-audit.sql','009-hub-rtc-results.sql','010-hub-pass-servers.sql'])
   await db.query(await readFile(new URL('../../migrations/'+migration,import.meta.url),'utf8'));
 for(const name of ['stripe','workspace'])
  await db.query("INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts) VALUES($1,'owner-a',$2,$3,1,'{\"tools\":3,\"writes\":0,\"money\":0}')",
    [name,name,'https://'+name+'.example.com']);
 issued=await issueHubPass(db,issueArgs,{pepper,ownerVerified:true});
 actor=await authenticateHubPass(db,'Bearer '+issued.pass,{pepper});
 for(const name of ['stripe','workspace']) {
  const staged=await stageCallerGrant(db,{ownerId:'owner-a',serverName:name,
   callerKind:'pass',callerId:issued.id,areas:['billing'],pass:upstreamPass,
   ttlSeconds:3600},{settings,ownerVerified:true});
  await activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:staged.id},settings,
   {ownerVerified:true,inspect:async arg=>({server:arg.name,prefix:arg.prefix,
    areas:arg.areas,mode:'test',profile:'read_only',
    identityVerified:true,callable:false})});
  if(name==='workspace')workspaceGrant=staged.id;
 }
 result=await storeRtcResult(db,actor,workspaceGrant,'workspace',
  {source:'synthetic-upstream',data:'safe'},settings);
});
afterAll(async()=>{if(db){
 if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();
}});
it('owner narrows without reissuing a bearer and invalidates existing encrypted result reads',async()=>{
 expect((await listEligibleRtcTargets(db,actor)).map(x=>x.name))
  .toEqual(['stripe','workspace']);
 expect((await readRtcResult(db,actor,result.handle,0,settings))?.data).toBeDefined();
 const before=await listHubPassScopes(db,'owner-a',{ownerVerified:true});
 expect(before[0].serverNames).toEqual(['stripe','workspace']);
 expect(JSON.stringify(before)).not.toContain(issued.pass);
 const narrowed=await narrowHubPassServers(db,{ownerId:'owner-a',id:issued.id,
  serverNames:['stripe']},{ownerVerified:true});
 expect(narrowed).toMatchObject({updated:true,serverNames:['stripe']});
 const refresh=await authenticateHubPass(db,'Bearer '+issued.pass,{pepper});
 expect(refresh.serverNames).toEqual(['stripe']);
 expect((await listEligibleRtcTargets(db,refresh)).map(x=>x.name)).toEqual(['stripe']);
 // The formerly broad actor itself is now refused by persisted SQL, not
 // merely by a fresh cached catalogue or the new authenticated actor.
 expect(await resolveActiveCallerGrant(db,{actor,serverName:'workspace'},settings))
  .toBeNull();
 expect(await readRtcResult(db,actor,result.handle,0,settings)).toBeNull();
 expect(await readRtcResult(db,refresh,result.handle,0,settings)).toBeNull();
 const wider=await narrowHubPassServers(db,{ownerId:'owner-a',id:issued.id,
  serverNames:['workspace']},{ownerVerified:true});
 expect(wider.updated).toBe(false);
 const audit=await db.query("SELECT action,outcome FROM hub_forward_audit WHERE caller_id=$1 AND action='hub_pass_scope_narrow'",[issued.id]);
 expect(audit.rows).toEqual([{action:'hub_pass_scope_narrow',outcome:'allowed'}]);
 expect((await listHubPassScopes(db,'other',{ownerVerified:true}))).toEqual([]);
 expect(await revokeHubPass(db,issued.id,'owner-a',{ownerVerified:true})).toBe(true);
 expect(await authenticateHubPass(db,'Bearer '+issued.pass,{pepper})).toBeNull();
 expect((await narrowHubPassServers(db,{ownerId:'owner-a',id:issued.id,
  serverNames:['stripe']},{ownerVerified:true})).updated).toBe(false);
});
it('concurrent independent database clients cannot race to widen the same pass',async()=>{
 const race=await issueHubPass(db,issueArgs,{pepper,ownerVerified:true});
 const other=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await other.connect();
 try {
  await other.query('SET search_path TO "'+schema+'"');
  const inputs=[
   narrowHubPassServers(db,{ownerId:'owner-a',id:race.id,
    serverNames:['stripe']},{ownerVerified:true}),
   narrowHubPassServers(other,{ownerId:'owner-a',id:race.id,
    serverNames:['workspace']},{ownerVerified:true})
  ];
  const settled=await Promise.all(inputs);
  expect(settled.filter(x=>x.updated)).toHaveLength(1);
  const checked=await authenticateHubPass(db,'Bearer '+race.pass,{pepper});
  expect(checked.serverNames).toEqual(settled.find(x=>x.updated).serverNames);
  const audit=await db.query("SELECT count(*)::int AS count FROM hub_forward_audit WHERE caller_id=$1 AND action='hub_pass_scope_narrow'",[race.id]);
  expect(audit.rows[0].count).toBe(1);
 } finally {await other.end();}
});
