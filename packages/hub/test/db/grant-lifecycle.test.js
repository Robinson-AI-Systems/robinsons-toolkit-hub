import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {issueHubPass,authenticateHubPass} from '../../src/identity.js';
import {stageCallerGrant,activateVerifiedCallerGrant,resolveActiveCallerGrant,
  listEligibleRtcTargets} from '../../src/grants.js';
import {cancelStagedGrant,listGrantLifecycleAudit} from '../../src/grant-lifecycle.js';
import {storeRtcResult,readRtcResult} from '../../src/rtc-results.js';
const pepper='synthetic-credential-renewal-pepper-abcdef123456';
const settings={pepper,grantsKey:randomBytes(32).toString('base64url'),
  resultsKey:randomBytes(32).toString('base64url')};
const pass=()=> 'rtc_pass_'+randomBytes(32).toString('base64url');
let db,schema;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
 schema='grant_renewal_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const file of ['001-hub-foundation.sql','002-hub-oauth.sql',
  '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
  '008-hub-rtc-audit.sql','009-hub-rtc-results.sql',
  '010-hub-pass-servers.sql','012-hub-grant-area-ceilings.sql',
  '016-hub-grant-renewal.sql'])
  await db.query(await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 await db.query("INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts) VALUES('stripe','owner','stripe','https://stripe.example.com',1,'{\"tools\":3,\"writes\":0,\"money\":0}')");
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
async function caller(){
 const credentials=await issueHubPass(db,{ownerId:'owner',profile:'read_only',
  mode:'test',allowWrites:false,areas:['gateway'],serverNames:['stripe'],
  ttlSeconds:3600},{pepper,ownerVerified:true});
 return authenticateHubPass(db,'Bearer '+credentials.pass,{pepper});
}
const owner={ownerVerified:true};
const identity=async row=>({identityVerified:true,callable:false,
 server:row.name,prefix:row.prefix,areas:row.areas,profile:'read_only',mode:'test'});
async function stage(actor,areas,credential){
 return stageCallerGrant(db,{ownerId:'owner',serverName:'stripe',callerKind:'pass',
  callerId:actor.id,pass:credential,areas,ttlSeconds:3600},
  {ownerVerified:true,settings});
}
async function verify(id,probe=identity){
 return activateVerifiedCallerGrant(db,{ownerId:'owner',id},settings,{...owner,inspect:probe});
}
it('makes active service usable for newly issued exact-caller TEST grant',async()=>{
 const first=await caller(),original=pass();
 const staged=await stage(first,['billing','reports'],original);
 expect(staged).toMatchObject({callable:false,serverAlreadyActive:false});
 await verify(staged.id);
 expect((await resolveActiveCallerGrant(db,{actor:first,serverName:'stripe'},settings)).pass)
  .toBe(original);
 const newCaller=await caller();
 const newPass=pass();
 const add=await stage(newCaller,['billing'],newPass);
 expect(add.serverAlreadyActive).toBe(true);
 expect(await resolveActiveCallerGrant(db,{actor:newCaller,serverName:'stripe'},settings))
  .toBeNull();
 await verify(add.id);
 expect((await resolveActiveCallerGrant(db,{actor:newCaller,serverName:'stripe'},settings)).pass)
  .toBe(newPass);
 expect((await listEligibleRtcTargets(db,newCaller))[0].areas).toEqual(['billing']);
 const records=await listGrantLifecycleAudit(db,'owner',owner);
 expect(records).toEqual(expect.arrayContaining([
  expect.objectContaining({action:'additional_caller',server:'stripe',
   callerId:newCaller.id})]));
});
it('keeps old credential usable during failed probe and atomically swaps after verification',async()=>{
 const actor=await caller(),oldPass=pass();
 const original=await stage(actor,['billing','reports'],oldPass);
 await verify(original.id);
 const oldPage=await storeRtcResult(db,actor,original.id,'stripe',{test:true},settings);
 const newPass=pass(),replacement=await stage(actor,['billing'],newPass);
 expect(replacement.serverAlreadyActive).toBe(true);
 expect(await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings))
  .toMatchObject({grantId:original.id,pass:oldPass});
 await expect(verify(replacement.id,async()=>{throw Error('failed scope proof');}))
  .rejects.toThrow('failed scope proof');
 expect((await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings)).pass)
  .toBe(oldPass);
 expect(await readRtcResult(db,actor,oldPage.handle,0,settings)).not.toBeNull();
 const accepted=await verify(replacement.id);
 expect(accepted).toMatchObject({action:'renewal',replaced:original.id,
  purgedHandles:1});
 expect((await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings)))
  .toMatchObject({grantId:replacement.id,pass:newPass,areas:['billing']});
 expect(await readRtcResult(db,actor,oldPage.handle,0,settings)).toBeNull();
 expect((await db.query('SELECT revoked_at FROM hub_server_grants WHERE id=$1',
  [original.id])).rows[0].revoked_at).not.toBeNull();
 expect((await listGrantLifecycleAudit(db,'owner',owner))[0])
  .toMatchObject({action:'renewal',retiredId:original.id,purgedHandles:1});
});
it('refuses broadening, missing owner and cancel after verification',async()=>{
 const actor=await caller(),cred=pass();
 const first=await stage(actor,['billing'],cred);
 await verify(first.id);
 await expect(stage(actor,['billing','reports'],pass())).rejects.toThrow();
 expect(await cancelStagedGrant(db,{ownerId:'owner',id:first.id},owner)).toBe(false);
 const staged=await stage(actor,['billing'],pass());
 expect(await cancelStagedGrant(db,{ownerId:'owner',id:staged.id},owner)).toBe(true);
 expect(await resolveActiveCallerGrant(db,{actor,serverName:'stripe'},settings))
  .toMatchObject({grantId:first.id});
 expect((await listGrantLifecycleAudit(db,'owner',owner))[0])
  .toMatchObject({action:'cancel_staged'});
});
