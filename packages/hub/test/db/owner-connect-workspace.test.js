import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {registerOAuthClient,issueOAuthCode,exchangeOAuthCode,authenticateOAuth} from '../../src/oauth.js';
import {connectWorkspace} from '../../src/owner-connect-workspace.js';
import {activateVerifiedCallerGrant,resolveActiveCallerGrant} from '../../src/grants.js';

const owner='test-workspace-owner';
const origin='https://google-workspace-mcp-chris-projects-de6cd1bf.vercel.app';
const settings={pepper:'synthetic-workspace-test-pepper-32-bytes',grantsKey:randomBytes(32).toString('base64url')};
const providerPass='rtc_pass_'+randomBytes(32).toString('base64url');
const clientId='workspace-onboarding-test-client';
const redirectUri='https://example.net/auth/callback';
let db,schema,actor;
const account=(pass=providerPass)=>({ok:true,result:{profile:'read_only',mode:'test',
  allow_writes:false,areas:null}});
function transport({who=account(),confirmed=true}={}){
 const calls=[];
 return {calls,
  probe:async(url,identity)=>{
   calls.push('public_contract');
   expect(url).toBe(origin);
   expect(identity).toMatchObject({name:'google-workspace-mcp',prefix:'workspace'});
   return {tools:382,writes:212,money:0};
  },
  read:async(url,route,{pass})=>{
   calls.push('provider_whoami');
   expect(url).toBe(origin);expect(route).toBe('/api/whoami');
   expect(pass).toBe(providerPass);
   return who;
  },
  activate:async(connection,id,key,options)=>{
   calls.push('verified_activation');
   return activateVerifiedCallerGrant(connection,id,key,{...options,inspect:async input=>{
    expect(input.pass).toBe(providerPass);
    if(!confirmed)throw Error('Independent provider identity refused');
    return {identityVerified:true,callable:false,server:input.name,
     prefix:input.prefix,mode:'test',profile:'read_only',areas:input.areas};
   }});
  }
 };
}
beforeAll(async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL);
 if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Use disposable local database only');
 db=new pg.Client({connectionString:url.href});await db.connect();
 schema='hub_workspace_ready_'+process.pid;
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const path of ['001-hub-foundation.sql','002-hub-oauth.sql','004-hub-registry.sql',
  '005-hub-grants.sql','006-hub-activation.sql','008-hub-rtc-audit.sql',
  '009-hub-rtc-results.sql','010-hub-pass-servers.sql','011-hub-oauth-server-scopes.sql',
  '012-hub-grant-area-ceilings.sql','015-hub-caller-service-area-policy.sql',
  '016-hub-grant-renewal.sql','020-hub-service-identities.sql'])
   await db.query(await readFile(new URL('../../migrations/'+path,import.meta.url),'utf8'));
 await registerOAuthClient(db,{ownerId:owner,clientId,redirectUri},{ownerVerified:true});
 const verifier=randomBytes(32).toString('base64url');
 const code=await issueOAuthCode(db,{ownerId:owner,clientId,redirectUri,
  challenge:createHash('sha256').update(verifier).digest('base64url'),
  profile:'read_only',mode:'test',areas:['gateway']},{pepper:settings.pepper,ownerVerified:true});
 const tokens=await exchangeOAuthCode(db,{clientId,redirectUri,code,verifier},{pepper:settings.pepper});
 actor=await authenticateOAuth(db,tokens.access_token,{pepper:settings.pepper});
});
afterAll(async()=>{if(db){await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
it('stores owner-approved registration without pass or caller grant',async()=>{
 const t=transport();
 const outcome=await connectWorkspace(db,settings,owner,null,t);
 expect(outcome.state).toBe('prepared');
 expect(t.calls).toEqual(['public_contract']);
 expect((await db.query("SELECT name,prefix,state FROM hub_servers")).rows)
  .toEqual([{name:'google-workspace-mcp',prefix:'workspace',state:'pending'}]);
 expect((await db.query("SELECT COUNT(*)::int AS n FROM hub_server_grants")).rows[0].n).toBe(0);
});
it('refuses unauthorized or write-enabled upstream identity before any grant',async()=>{
 const before=(await db.query("SELECT COUNT(*)::int AS n FROM hub_server_grants")).rows[0].n;
 for(const who of [
  {ok:false,error:{code:'invalid_pass'}},
  {ok:true,result:{mode:'test',profile:'full',areas:['files'],allow_writes:true}},
  {ok:true,result:{mode:'live',profile:'read_only',areas:['files'],allow_writes:false}}
 ]) {
  await expect(connectWorkspace(db,settings,owner,providerPass,transport({who})))
   .rejects.toThrow();
 }
 expect((await db.query("SELECT COUNT(*)::int AS n FROM hub_server_grants")).rows[0].n).toBe(before);
});
it('verifies the exact current OAuth caller, encrypts pass, activates only TEST and routes a genuine scoped grant',async()=>{
 const t=transport();
 const connected=await connectWorkspace(db,settings,owner,providerPass,t);
 expect(connected.state).toBe('verified_test');
 expect(t.calls).toEqual(['public_contract','provider_whoami','verified_activation']);
 const rows=(await db.query("SELECT profile,mode,areas,verified_at,ciphertext FROM hub_server_grants")).rows;
 expect(rows).toHaveLength(1);
 expect(rows[0]).toMatchObject({profile:'read_only',mode:'test'});
 expect(rows[0].areas).toContain('files');
 expect(rows[0].areas).toContain('mail');
 expect(rows[0].verified_at).not.toBeNull();
 expect(rows[0].ciphertext.toString('utf8')).not.toContain(providerPass);
 const result=await resolveActiveCallerGrant(db,{actor,serverName:'google-workspace-mcp'},settings);
 expect(result).toMatchObject({pass:providerPass,origin,prefix:'workspace',
  server:'google-workspace-mcp',profile:'read_only',mode:'test'});
 expect(JSON.stringify(rows.map(({ciphertext,...rest})=>rest))).not.toContain(providerPass);
});
