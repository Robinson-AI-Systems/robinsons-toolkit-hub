import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {issueHubPass,authenticateHubPass,revokeHubPass} from '../../src/identity.js';
import {stageCallerGrant,activateVerifiedCallerGrant,resolveActiveCallerGrant,
  listEligibleRtcTargets,listCallerGrants,narrowCallerGrantAreas,
  revokeCallerGrant,effectiveGrantAreas} from '../../src/grants.js';
import {storeRtcResult,readRtcResult} from '../../src/rtc-results.js';

const pepper='synthetic-h4-area-narrow-postgres-32-byte-only';
const settings={grantsKey:randomBytes(32).toString('base64url'),
  resultsKey:randomBytes(32).toString('base64url'),pepper};
const upstreamPass='rtc_pass_'+randomBytes(32).toString('base64url');
const owner='owner-one';
let db,schema,actor,issued,grantId,handle;
const passParams={ownerId:owner,profile:'read_only',areas:['gateway'],
  mode:'test',allowWrites:false,ttlSeconds:3600,serverNames:['stripe']};
const input=(callerId,serverName='stripe')=>({ownerId:owner,serverName,
  callerKind:'pass',callerId,areas:['billing','reports'],
  pass:upstreamPass,ttlSeconds:3600});
async function stagedAndActive(callerId,serverName='stripe') {
 const staged=await stageCallerGrant(db,input(callerId,serverName),{ownerVerified:true,settings});
 await activateVerifiedCallerGrant(db,{ownerId:owner,id:staged.id},settings,
  {ownerVerified:true,inspect:async arg=>({
   server:arg.name,prefix:arg.prefix,areas:arg.areas,
   profile:'read_only',mode:'test',identityVerified:true,callable:false
  })});
 return staged.id;
}
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await db.connect();
 schema='hub_h4_areas_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const name of ['001-hub-foundation.sql','002-hub-oauth.sql',
  '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
  '008-hub-rtc-audit.sql','009-hub-rtc-results.sql',
  '010-hub-pass-servers.sql','012-hub-grant-area-ceilings.sql']) {
  await db.query(await readFile(new URL('../../migrations/'+name,import.meta.url),'utf8'));
 }
 await db.query("INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts) VALUES('stripe',$1,'stripe','https://stripe-mcp-psi.vercel.app',1,'{\"tools\":5,\"writes\":0,\"money\":0}')",[owner]);
 issued=await issueHubPass(db,passParams,{pepper,ownerVerified:true});
 actor=await authenticateHubPass(db,'Bearer '+issued.pass,{pepper});
 grantId=await stagedAndActive(issued.id);
 handle=await storeRtcResult(db,actor,grantId,'stripe',
  {synthetic:true,area:'billing',data:'old-area-result'},settings);
});
afterAll(async()=>{
 if(db){
  if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');
  await db.end();
 }
});
it('never changes original independently encrypted pass or grant area AAD when narrowing',async()=>{
 const prior=await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings);
 expect(prior).toMatchObject({areas:['billing','reports'],
  profile:'read_only',mode:'test',grantId});
 expect(prior.pass).toBe(upstreamPass);
 expect((await readRtcResult(db,actor,handle.handle,0,settings))?.data).toBeTruthy();
 const previous=await db.query('SELECT ciphertext,nonce,tag,areas FROM hub_server_grants WHERE id=$1',[grantId]);
 const narrowed=await narrowCallerGrantAreas(db,{
  ownerId:owner,id:grantId,areas:['reports']
 },{ownerVerified:true});
 expect(narrowed).toEqual({updated:true,areas:['reports']});
 const after=await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings);
 expect(after).toMatchObject({areas:['reports'],profile:'read_only',mode:'test',grantId});
 expect(after.pass).toBe(upstreamPass);
 expect((await listEligibleRtcTargets(db,actor))[0].areas).toEqual(['reports']);
 const current=(await db.query('SELECT ciphertext,nonce,tag,areas,area_ceiling FROM hub_server_grants WHERE id=$1',[grantId])).rows[0];
 for(const key of ['ciphertext','nonce','tag']) {
  expect(current[key].equals(previous.rows[0][key])).toBe(true);
 }
 expect(current.areas).toEqual(['billing','reports']);
 expect(current.area_ceiling).toEqual(['reports']);
 const listed=await listCallerGrants(db,owner,{ownerVerified:true});
 expect(listed.find(row=>row.id===grantId)).toMatchObject({
  areas:['reports'],originalAreas:['billing','reports'],verified:true});
 expect(JSON.stringify(listed)).not.toContain(upstreamPass);
 expect(JSON.stringify(listed)).not.toContain(issued.pass);
 const audits=await db.query('SELECT owner_id,action,areas FROM hub_grant_scope_audit WHERE grant_id=$1',[grantId]);
 expect(audits.rows).toEqual([{owner_id:owner,action:'area_narrow',areas:['reports']}]);
 const oldPages=await db.query('SELECT count(*)::int AS total FROM hub_rtc_result_handles WHERE grant_id=$1',[grantId]);
 expect(oldPages.rows[0].total).toBe(0);
 expect(await readRtcResult(db,actor,handle.handle,0,settings)).toBeNull();
});
it('refuses attempts to restore an eliminated area or use another owner identity',async()=>{
 const unable=await narrowCallerGrantAreas(db,{ownerId:owner,id:grantId,areas:['billing']},
  {ownerVerified:true});
 expect(unable.updated).toBe(false);
 expect((await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings)).areas)
  .toEqual(['reports']);
 expect((await narrowCallerGrantAreas(db,{ownerId:'other',id:grantId,
  areas:['reports']},{ownerVerified:true})).updated).toBe(false);
 await expect(narrowCallerGrantAreas(db,{ownerId:owner,id:grantId,
  areas:['reports']},{})).rejects.toThrow();
 for(const invalid of [[],['Billing'],['reports','reports'],['../files'],[10]]) {
  await expect(narrowCallerGrantAreas(db,{ownerId:owner,id:grantId,areas:invalid},
    {ownerVerified:true})).rejects.toThrow();
 }
 expect((await db.query('SELECT count(*)::int AS total FROM hub_grant_scope_audit WHERE grant_id=$1',[grantId])).rows[0].total).toBe(1);
 expect(await revokeCallerGrant(db,{ownerId:owner,id:grantId},
  {ownerVerified:true})).toBe(true);
 expect((await narrowCallerGrantAreas(db,{ownerId:owner,id:grantId,areas:['reports']},
  {ownerVerified:true})).updated).toBe(false);
 expect(await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings))
  .toBeNull();
});
it('two independent DB connections cannot race area removals into expanded permissions',async()=>{
 // H-2 intentionally allows staging only while the target is pending.
 // Use a fresh independently scoped TEST service rather than weakening that gate.
 await db.query("INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts) VALUES('workspace',$1,'workspace','https://workspace.example.com',1,'{\"tools\":5,\"writes\":0,\"money\":0}')",[owner]);
 const second=await issueHubPass(db,{...passParams,serverNames:['workspace']},
  {pepper,ownerVerified:true});
 const raceId=await stagedAndActive(second.id,'workspace');
 const peer=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await peer.connect();
 try{
  await peer.query('SET search_path TO "'+schema+'"');
  const updates=await Promise.all([
   narrowCallerGrantAreas(db,{ownerId:owner,id:raceId,areas:['billing']},
    {ownerVerified:true}),
   narrowCallerGrantAreas(peer,{ownerId:owner,id:raceId,areas:['reports']},
    {ownerVerified:true})
  ]);
  expect(updates.filter(x=>x.updated)).toHaveLength(1);
  const selected=updates.find(x=>x.updated).areas;
  const raceActor=await authenticateHubPass(db,'Bearer '+second.pass,{pepper});
  expect((await resolveActiveCallerGrant(db,{actor:raceActor,serverName:'workspace'},settings)).areas)
   .toEqual(selected);
  expect((await db.query('SELECT count(*)::int AS total FROM hub_grant_scope_audit WHERE grant_id=$1',[raceId])).rows[0].total).toBe(1);
  expect(await revokeHubPass(db,second.id,owner,{ownerVerified:true})).toBe(true);
 }finally{await peer.end();}
});
it('rejects malformed in-memory ceilings before sensitive grant metadata is exposed',()=>{
 expect(effectiveGrantAreas({areas:['billing','reports']})).toEqual(['billing','reports']);
 expect(effectiveGrantAreas({areas:['billing','reports'],area_ceiling:['reports']}))
  .toEqual(['reports']);
 for(const area_ceiling of [['../invalid'],[],['other'],['billing','billing']]){
  if(area_ceiling.length===1 && area_ceiling[0]==='other') {
   // Pure local intersection is least privilege and must not return a foreign area.
   expect(effectiveGrantAreas({areas:['billing','reports'],area_ceiling})).toEqual([]);
   continue;
  }
  expect(()=>effectiveGrantAreas({areas:['billing','reports'],area_ceiling})).toThrow();
 }
});
