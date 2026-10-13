import {describe,it,expect} from 'vitest';
import {publicEncrypt,createHash,constants} from 'node:crypto';
import {developerConnect,developerAccess,nativeMcp} from '../src/developer-client.js';
import {makeKeychain,nativePlan} from '../src/keychain.js';
const origin='https://custom.example',clientId='client_'+'c'.repeat(32),clientSecret='s'.repeat(43);
const access='a'.repeat(43),refresh='r'.repeat(43),code='k'.repeat(43),request='q'.repeat(43);
const digest=x=>createHash('sha256').update(x).digest('base64url');
function fixture(){
 let saved=null,pending,approved=false,refreshes=0;const requests=[];
 const vault={getOAuth:async()=>saved,setOAuth:async(_n,v)=>{saved=structuredClone(v);}};
 const fetchImpl=async(url,options)=>{
  const u=new URL(url),body=options.body?JSON.parse(options.body):null;requests.push({url,body,headers:options.headers});
  const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
  if(u.pathname==='/.well-known/oauth-authorization-server')return json({authorization_endpoint:origin+'/api/oauth/authorize',token_endpoint:origin+'/api/oauth/token',registration_endpoint:origin+'/api/oauth/register'});
  if(u.pathname==='/api/oauth/register')return json({client_id:clientId,client_secret:clientSecret});
  if(u.pathname==='/api/developer/connect'&&options.method==='POST'){
   pending=body;const v=new URL(origin+'/api/oauth/authorize');v.searchParams.set('state',request);v.searchParams.set('code_challenge',body.challenge);v.searchParams.set('redirect_uri',origin+'/api/developer/connect');
   return json({request_id:request,authorization_url:v.href,expires_at:new Date(Date.now()+600000).toISOString()});
  }
  if(u.pathname==='/api/developer/connect')return approved?json({status:'authorized',sealed_code:publicEncrypt({key:pending.public_key,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(code)).toString('base64url')}):json({status:'authorization_pending'},202);
  if(u.pathname==='/api/oauth/token'){
   expect(body.client_secret).toBe(clientSecret);expect(body.resource).toBe(origin+'/api/mcp');
   if(body.grant_type==='authorization_code'){expect(body.code).toBe(code);expect(digest(body.code_verifier)).toBe(pending.challenge);}
   else{refreshes++;expect(body.refresh_token).toBe(refresh);}
   return json({access_token:access,refresh_token:refresh,token_type:'Bearer',expires_in:3600});
  }
  if(u.pathname==='/api/mcp'){
   expect(options.headers.authorization).toBe('Bearer '+access);
   if(body.method==='tools/call')return json({jsonrpc:'2.0',id:1,result:{content:[{type:'text',text:'provider result'}]}});
   return new Response('event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:1,result:{serverInfo:{name:'actual-custom-service'},capabilities:{tools:{}}}})+'\n\n',{headers:{'content-type':'text/event-stream'}});
  }
  throw Error('unexpected request');
 };
 return {vault,fetchImpl,requests,approve(){approved=true;},saved:()=>saved,expire(){saved.expiresAt=0;},refreshes:()=>refreshes};
}
describe('implementing-agent managed native connections',()=>{
 it('requires one mobile authorization, stores credentials privately and reuses the connection',async()=>{
  const f=fixture(),args={name:'custom',origin,vault:f.vault,fetchImpl:f.fetchImpl};
  const start=await developerConnect(args);expect(start.status).toBe('awaiting_owner_authorization');
  expect(JSON.stringify(start)).not.toContain(clientSecret);expect(f.saved().profile).toBe('full');
  expect((await developerConnect(args)).status).toBe('awaiting_owner_authorization');
  f.approve();const done=await developerConnect(args);expect(done.status).toBe('connected');expect(JSON.stringify(done)).not.toContain(access);
  expect(f.saved().verifier).toBeUndefined();expect(f.saved().privateKey).toBeUndefined();
  expect((await developerConnect(args)).reused).toBe(true);
  expect((await nativeMcp({...args,method:'initialize',params:{}})).serverInfo.name).toBe('actual-custom-service');
 });
 it('refreshes once for concurrent requests without widening the existing service grant',async()=>{
  const f=fixture(),args={name:'custom',origin,vault:f.vault,fetchImpl:f.fetchImpl};
  await developerConnect(args);f.approve();await developerConnect(args);f.expire();
  expect(await Promise.all([developerAccess(args),developerAccess(args)])).toEqual([access,access]);expect(f.refreshes()).toBe(1);
  const refreshBody=f.requests.find(x=>x.body?.grant_type==='refresh_token').body;
  expect(refreshBody.profile).toBeUndefined();expect(refreshBody.mode).toBeUndefined();
 });
 it('supports native developer writes through the original server guards without imposing read_only',async()=>{
  const f=fixture(),args={name:'custom',origin,vault:f.vault,fetchImpl:f.fetchImpl};
  await developerConnect(args);f.approve();await developerConnect(args);
  await nativeMcp({...args,method:'tools/call',params:{name:'provider_create_fixture',arguments:{dryRun:true}}});
  expect(f.requests.at(-1).body.params).toEqual({name:'provider_create_fixture',arguments:{dryRun:true}});
 });
 it('refuses changed origins before a bearer is sent and sanitizes token failures',async()=>{
  const f=fixture(),args={name:'custom',origin,vault:f.vault,fetchImpl:f.fetchImpl};await developerConnect(args);f.approve();await developerConnect(args);
  const n=f.requests.length;await expect(developerAccess({...args,origin:'https://attacker.example'})).rejects.toThrow('required');expect(f.requests.length).toBe(n);
  f.expire();await expect(developerAccess({...args,fetchImpl:async()=>new Response(JSON.stringify({error:'invalid_grant',error_description:access}),{status:400})})).rejects.toThrow('reauthorization_required');
 });
 it('never automatically repeats a native call after an ambiguous network failure',async()=>{
  const f=fixture(),args={name:'custom',origin,vault:f.vault,fetchImpl:f.fetchImpl};await developerConnect(args);f.approve();await developerConnect(args);
  let calls=0;await expect(nativeMcp({...args,method:'tools/call',fetchImpl:async()=>{calls++;throw Error(access);}})).rejects.toThrow('outcome_unknown');expect(calls).toBe(1);
 });
 it('keeps native OAuth credentials separate from RTC passes in the OS vault',async()=>{
  const f=fixture();const args={name:'custom',origin,vault:f.vault,fetchImpl:f.fetchImpl};await developerConnect(args);f.approve();await developerConnect(args);
  let payload;const vault=makeKeychain({platform:'linux',env:{},run:async(plan,value)=>{expect(plan.args.join(' ')).toContain('developer-oauth');expect(JSON.stringify(plan)).not.toContain(access);payload=value;return {found:true,value};}});
  await vault.setOAuth('custom',f.saved());expect(JSON.parse(payload).accessToken).toBe(access);
  expect(nativePlan({name:'custom',action:'lookup',platform:'linux',kind:'pass'}).args.join(' ')).not.toContain('developer-oauth');
 });
});
