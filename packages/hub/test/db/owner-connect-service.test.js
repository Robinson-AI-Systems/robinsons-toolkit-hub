import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {registerDiscoveredService,availableServiceCallers,connectRtcService} from '../../src/owner-connect-service.js';
import {issueHubPass,authenticateHubPass} from '../../src/identity.js';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,authenticateOAuth,rotateOAuthRefresh} from '../../src/oauth.js';
import {activateVerifiedCallerGrant,resolveActiveCallerGrant,listEligibleRtcTargets,revokeCallerGrant} from '../../src/grants.js';
const owner='generic-setup-owner';
const settings={pepper:'synthetic-generic-onboarding-pepper-32bytes',grantsKey:randomBytes(32).toString('base64url')};
const services=[['reports-service','reports','live'],['independent-calendar','calendar','test']].map(([server,prefix,mode])=>({
 server,prefix,mode,origin:'https://'+server+'.example.org',rtc:1,tools:2,writes:0,money:0,
 modes:['test','live'],profiles:['read_only','full'],areas:['reports','calendar']}));
const passes=services.map(()=> 'rtc_pass_'+randomBytes(32).toString('base64url'));
let db,schema,actors=[],ids=[];
function dependencies(index){
 const service=services[index];const inspect=async input=>{
  expect(input).toMatchObject({origin:service.origin,name:service.server,prefix:service.prefix,
   mode:service.mode,profile:'read_only',areas:['reports'],pass:passes[index]});
  return {server:service.server,prefix:service.prefix,mode:service.mode,profile:'read_only',
   areas:['reports'],identityVerified:true,callable:false};
 };
 return {ownerVerified:true,discover:async origin=>{expect(origin).toBe(service.origin);return service;},inspect,
  activate:(client,input,config,options)=>activateVerifiedCallerGrant(client,input,config,{...options,inspect})};
}
const selection=(index,actor=actors[index])=>({origin:services[index].origin,server:services[index].server,prefix:services[index].prefix,
 callerKind:actor.clientId?'oauth':'pass',callerId:actor.id,mode:services[index].mode,profile:'read_only',areas:['reports'],pass:passes[index]});
beforeAll(async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL);if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Disposable localhost database only');
 db=new pg.Client({connectionString:url.href});await db.connect();schema='hub_generic_'+process.pid+'_'+randomBytes(4).toString('hex');
 await db.query('CREATE SCHEMA "'+schema+'"');await db.query('SET search_path TO "'+schema+'"');
 const dir=new URL('../../migrations/',import.meta.url);
 for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.query(await readFile(new URL(file,dir),'utf8'));
 for(const service of services){
  await registerDiscoveredService(db,owner,service,{ownerVerified:true});
  const issued=await issueHubPass(db,{ownerId:owner,profile:'read_only',mode:service.mode,allowWrites:false,
   areas:['gateway'],serverNames:[service.server],ttlSeconds:3600},{ownerVerified:true,pepper:settings.pepper});
  actors.push(await authenticateHubPass(db,'Bearer '+issued.pass,{pepper:settings.pepper}));
 }
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
it('prepares two independent discovered registries without grants, enumerates current owned callers only',async()=>{
 const rows=(await db.query('SELECT name,state FROM hub_servers ORDER BY name')).rows;
 expect(rows).toHaveLength(2);expect(rows.every(r=>r.state==='pending')).toBe(true);
 expect((await db.query('SELECT COUNT(*)::int AS n FROM hub_server_grants')).rows[0].n).toBe(0);
 const owned=await availableServiceCallers(db,owner,{ownerVerified:true});expect(owned).toHaveLength(2);
 expect(owned.map(c=>c.mode).sort()).toEqual(['live','test']);
 expect(await availableServiceCallers(db,'foreign-owner',{ownerVerified:true})).toEqual([]);
 expect(JSON.stringify(owned)).not.toContain('rtc_pass_');
});
it.each([0,1])('normal selected service %s activation encrypts original scoped credentials and feeds unchanged discovery resolver',async index=>{
 const result=await connectRtcService(db,settings,owner,selection(index),dependencies(index));ids[index]=result.grantId;
 expect(result.state).toBe('verified_'+services[index].mode);
 const saved=(await db.query('SELECT * FROM hub_server_grants WHERE id=$1',[ids[index]])).rows[0];
 expect(JSON.stringify(saved)).not.toContain(passes[index]);expect(saved.verified_at).not.toBeNull();
 expect(saved.mode).toBe(services[index].mode);
 const target=await resolveActiveCallerGrant(db,{actor:actors[index],serverName:services[index].server},settings);
 expect(target).toMatchObject({pass:passes[index],areas:['reports'],mode:services[index].mode});
 const visible=await listEligibleRtcTargets(db,actors[index]);expect(visible.map(x=>x.name)).toEqual([services[index].server]);
 const foreign=await resolveActiveCallerGrant(db,{actor:actors[1-index],serverName:services[index].server},settings);
 expect(foreign).toBeNull();
});
it('preserves verified credentials when discovery repeats or connect is resubmitted',async()=>{
 const before=(await db.query('SELECT id,ciphertext,nonce,tag,verified_at,revoked_at FROM hub_server_grants ORDER BY id')).rows;
 await registerDiscoveredService(db,owner,services[0],{ownerVerified:true});
 await expect(connectRtcService(db,settings,owner,selection(0),dependencies(0))).rejects.toThrow(/renewal/);
 const after=(await db.query('SELECT id,ciphertext,nonce,tag,verified_at,revoked_at FROM hub_server_grants ORDER BY id')).rows;
 expect(after).toEqual(before);
});
it('refuses owned registration substitution, current caller tampering and changed discovery without new grants',async()=>{
 await expect(registerDiscoveredService(db,owner,{...services[0],origin:'https://foreign.example.org'},{ownerVerified:true})).rejects.toThrow();
 const issued=await issueHubPass(db,{ownerId:owner,profile:'read_only',mode:'live',allowWrites:false,
  areas:['gateway'],serverNames:[services[0].server],ttlSeconds:3600},{ownerVerified:true,pepper:settings.pepper});
 const actor=await authenticateHubPass(db,'Bearer '+issued.pass,{pepper:settings.pepper});
 await expect(connectRtcService(db,settings,'foreign-owner',selection(0,actor),dependencies(0))).rejects.toThrow();
 const deps=dependencies(0);deps.discover=async()=>({...services[0],prefix:'foreign'});
 await expect(connectRtcService(db,settings,owner,selection(0,actor),deps)).rejects.toThrow(/changed/);
 expect((await db.query('SELECT COUNT(*)::int AS n FROM hub_server_grants')).rows[0].n).toBe(2);
});
it('independent verification failure leaves only one noncallable staged grant for explicit recovery',async()=>{
 const issued=await issueHubPass(db,{ownerId:owner,profile:'read_only',mode:'live',allowWrites:false,
  areas:['gateway'],serverNames:[services[0].server],ttlSeconds:3600},{ownerVerified:true,pepper:settings.pepper});
 const actor=await authenticateHubPass(db,'Bearer '+issued.pass,{pepper:settings.pepper});
 const deps=dependencies(0);deps.activate=(client,input,config,options)=>activateVerifiedCallerGrant(client,input,config,
  {...options,inspect:async()=>{throw Error('synthetic issuer revoked after preview');}});
 await expect(connectRtcService(db,settings,owner,selection(0,actor),deps)).rejects.toThrow();
 expect(await resolveActiveCallerGrant(db,{actor,serverName:services[0].server},settings)).toBeNull();
 await expect(connectRtcService(db,settings,owner,selection(0,actor),dependencies(0))).rejects.toThrow(/recovery/);
 const rows=(await db.query('SELECT verified_at,revoked_at FROM hub_server_grants WHERE caller_id=$1',[actor.id])).rows;
 expect(rows).toEqual([{verified_at:null,revoked_at:null}]);
});
it('does not implicitly renew an OAuth family grant after its selected session rotates',async()=>{
 const clientId='generic-connection-client',redirectUri='https://agent.example.org/callback';
 await registerOAuthClient(db,{ownerId:owner,clientId,redirectUri},{ownerVerified:true});
 const verifier=randomBytes(32).toString('base64url');
 const code=await issueOAuthCode(db,{ownerId:owner,clientId,redirectUri,
  challenge:createHash('sha256').update(verifier).digest('base64url'),profile:'read_only',mode:'test',areas:['gateway'],
  serverNames:[services[1].server]},{pepper:settings.pepper,ownerVerified:true});
 const tokens=await exchangeOAuthCode(db,{clientId,redirectUri,code,verifier},{pepper:settings.pepper});
 const initial=await authenticateOAuth(db,tokens.access_token,{pepper:settings.pepper});
 const connected=await connectRtcService(db,settings,owner,selection(1,initial),dependencies(1));
 const refreshed=await rotateOAuthRefresh(db,{clientId,refreshToken:tokens.refresh_token},{pepper:settings.pepper});
 const fresh=await authenticateOAuth(db,refreshed.access_token,{pepper:settings.pepper});
 expect(fresh.id).not.toBe(initial.id);
 await expect(connectRtcService(db,settings,owner,selection(1,fresh),dependencies(1))).rejects.toThrow(/renewal/);
 expect((await db.query('SELECT revoked_at FROM hub_server_grants WHERE id=$1',[connected.grantId])).rows[0].revoked_at).toBeNull();
});
it('exact grant revocation removes its discovery and dispatch while the other service remains available',async()=>{
 expect(await revokeCallerGrant(db,{ownerId:owner,id:ids[0]},{ownerVerified:true})).toBe(true);
 expect(await listEligibleRtcTargets(db,actors[0])).toEqual([]);
 expect(await resolveActiveCallerGrant(db,{actor:actors[0],serverName:services[0].server},settings)).toBeNull();
 expect((await listEligibleRtcTargets(db,actors[1])).map(x=>x.name)).toEqual([services[1].server]);
});
