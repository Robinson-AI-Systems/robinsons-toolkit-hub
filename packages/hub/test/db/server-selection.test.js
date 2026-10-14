import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {issueHubPass,authenticateHubPass} from '../../src/identity.js';
import {stageCallerGrant,activateVerifiedCallerGrant,
  listEligibleRtcTargets,resolveActiveCallerGrant,revokeCallerGrant}
  from '../../src/grants.js';

const pepper='synthetic-h4-db-credential-scope-key-32';
const settings={grantsKey:randomBytes(32).toString('base64url')};
const upstreamPass='rtc_pass_'+randomBytes(32).toString('base64url');
let db,schema,original,actor,first,second;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await db.connect();
 schema='hub_h4_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const name of ['001-hub-foundation.sql','002-hub-oauth.sql',
   '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
   '010-hub-pass-servers.sql'])
   await db.query(await readFile(new URL('../../migrations/'+name,import.meta.url),'utf8'));
 for(const [name,prefix,origin] of [
   ['stripe','stripe','https://stripe-mcp-psi.vercel.app'],
   ['workspace','workspace_','https://google-workspace-mcp.vercel.app']
 ]) await db.query("INSERT INTO hub_servers(name,owner_id,prefix,origin,claimed_rtc,claimed_counts) VALUES($1,'owner-a',$2,$3,1,'{\"tools\":1,\"writes\":0,\"money\":0}')",[name,prefix,origin]);
 original=await issueHubPass(db,{ownerId:'owner-a',profile:'read_only',
   areas:['gateway'],mode:'test',allowWrites:false,ttlSeconds:3600},
   {pepper,ownerVerified:true});
 actor=await authenticateHubPass(db,'Bearer '+original.pass,{pepper});
 for(const name of ['stripe','workspace']){
   const staged=await stageCallerGrant(db,{ownerId:'owner-a',serverName:name,
     callerKind:'pass',callerId:original.id,areas:['billing'],
     pass:upstreamPass,ttlSeconds:3600},{ownerVerified:true,settings});
   await activateVerifiedCallerGrant(db,{ownerId:'owner-a',id:staged.id},
     settings,{ownerVerified:true,inspect:async request=>({
       server:request.name,prefix:request.prefix,areas:request.areas,
       profile:'read_only',mode:'test',identityVerified:true,callable:false
     })});
   if(name==='stripe')first=staged.id;
   else second=staged.id;
 }
});
afterAll(async()=>{if(db){
 if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');
 await db.end();
}});
it('verified grants retain old exact-caller behavior before an explicit narrowing',async()=>{
 expect(actor.serverNames).toBeNull();
 expect((await listEligibleRtcTargets(db,actor)).map(x=>x.name))
   .toEqual(['stripe','workspace']);
 const selected=await issueHubPass(db,{ownerId:'owner-a',profile:'read_only',
   mode:'test',areas:['gateway'],allowWrites:false,ttlSeconds:3600,
   serverNames:['stripe']},{pepper,ownerVerified:true});
 const narrowed=await authenticateHubPass(db,'Bearer '+selected.pass,{pepper});
 expect(narrowed.serverNames).toEqual(['stripe']);
 expect(await listEligibleRtcTargets(db,narrowed)).toEqual([]);
 await expect(stageCallerGrant(db,{ownerId:'owner-a',serverName:'workspace',
   callerKind:'pass',callerId:selected.id,areas:['billing'],
   pass:upstreamPass,ttlSeconds:3600},{ownerVerified:true,settings}))
   .rejects.toThrow('scope');
});
it('an installed server allowlist narrows discovery and actual decrypted RTC dispatch',async()=>{
 await db.query("UPDATE hub_callers SET allowed_servers=ARRAY['stripe']::text[] WHERE id=$1",[original.id]);
 const narrowed=await authenticateHubPass(db,'Bearer '+original.pass,{pepper});
 expect(narrowed.serverNames).toEqual(['stripe']);
 expect((await listEligibleRtcTargets(db,narrowed)).map(x=>x.name)).toEqual(['stripe']);
 expect(await resolveActiveCallerGrant(db,
   {actor:narrowed,serverName:'workspace'},settings)).toBeNull();
 expect(await resolveActiveCallerGrant(db,
   {actor:narrowed,serverName:'stripe'},settings))
   .toMatchObject({grantId:first,profile:'read_only',mode:'test'});
 await db.query("UPDATE hub_callers SET allowed_servers=ARRAY['workspace']::text[] WHERE id=$1",[original.id]);
 expect(await listEligibleRtcTargets(db,narrowed)).toEqual([]);
 expect(await resolveActiveCallerGrant(db,
   {actor:narrowed,serverName:'stripe'},settings)).toBeNull();
 expect(await resolveActiveCallerGrant(db,
   {actor:narrowed,serverName:'workspace'},settings)).toBeNull();
 const fresh=await authenticateHubPass(db,'Bearer '+original.pass,{pepper});
 expect((await listEligibleRtcTargets(db,fresh)).map(x=>x.name)).toEqual(['workspace']);
 expect(await resolveActiveCallerGrant(db,
   {actor:fresh,serverName:'workspace'},settings))
   .toMatchObject({grantId:second});
 expect(await revokeCallerGrant(db,{ownerId:'owner-a',id:second},
   {ownerVerified:true})).toBe(true);
 expect(await resolveActiveCallerGrant(db,
   {actor:fresh,serverName:'workspace'},settings)).toBeNull();
});
