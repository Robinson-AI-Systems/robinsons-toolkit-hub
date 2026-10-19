import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {genericFederationDependencies} from '../../src/oauth-federation.js';
import {beginUpstreamOauth,finishUpstreamOauth,remoteConnectionRead,
 listUpstreamOauthConnections,disconnectUpstreamOauth}
 from '../../src/upstream-oauth-connections.js';

const owner='oauth_owner',origin='https://mcp.example.org',
 hubOrigin='https://hub.example.org',issuer=origin;
const settings={grantsKey:randomBytes(32).toString('base64url')};
const family=randomUUID(),session=randomUUID();
const remote={origin,resource:origin+'/api/mcp',issuer,
 authorizationEndpoint:issuer+'/api/oauth/authorize',
 tokenEndpoint:issuer+'/api/oauth/token',
 registrationEndpoint:issuer+'/api/oauth/register',refreshSupported:true,
 name:'independent-mcp',prefix:'independent',areas:['files','calendar'],
 modes:['test','live'],profiles:['read_only','everyday','full'],
 counts:{tools:17,writes:3,money:0}};
let db,schema;
const tool={name:'independent_files_list',description:'Read documents',
 inputSchema:{type:'object'},area:'files',profiles:['read_only'],
 writes:false,money:false,destructive:false,annotations:{readOnlyHint:true}};
const post=vi.fn(async(url,options)=>{
 if(url===remote.registrationEndpoint)return {
  client_id:'registered-dcr-client',client_secret:'synthetic-registration-secret',
  token_endpoint_auth_method:'client_secret_post',
  redirect_uris:[hubOrigin+'/api/owner/connect-mcp-callback']};
 if(url===remote.tokenEndpoint) {
  expect(options.method).toBe('POST');
  expect(options.body).toContain('resource=');
  expect(options.body).toContain('client_secret=');
  if(options.body.includes('refresh_token'))return {
   access_token:'rotated-access-secret',refresh_token:'rotated-refresh-secret',
   token_type:'Bearer',expires_in:3600};
  expect(options.body).toContain('code_verifier=');
  return {access_token:'initial-provider-access',refresh_token:'initial-provider-refresh',
   token_type:'Bearer',expires_in:3600};
 }
 if(url===remote.resource){
  // The Hub never fetches the full provider schema catalog at connection
  // time. It performs one bounded RTC1 meta search, then exact whoami.
  expect(options.body?.method).toBe('tools/call');
  if(options.body.params.name==='independent_whoami')return {jsonrpc:'2.0',id:2,
   result:{structuredContent:{mode:'live',profile:'read_only',
    areas:['files','calendar'],allowWrites:false}}};
  expect(options.body.params.name).toBe('independent_search_tools');
  expect(options.body.params.arguments).toMatchObject({query:'',limit:1});
  return {jsonrpc:'2.0',id:1,result:{structuredContent:{tools:[tool]}}};
 }
 if(url===origin+'/api/contract')return {
  rtc:1,server:remote.name,prefix:remote.prefix,
  areas:remote.areas,profiles:remote.profiles,modes:remote.modes,
  counts:remote.counts};
 if(url===origin+'/.well-known/oauth-protected-resource/api/mcp')throw Error('none');
 if(url===origin+'/.well-known/oauth-protected-resource')return {
  resource:remote.resource,authorization_servers:[issuer]};
 if(url===issuer+'/.well-known/oauth-authorization-server')return {
  issuer,authorization_endpoint:remote.authorizationEndpoint,
  token_endpoint:remote.tokenEndpoint,registration_endpoint:remote.registrationEndpoint,
  grant_types_supported:['authorization_code','refresh_token'],
  response_types_supported:['code'],code_challenge_methods_supported:['S256']};
 throw Error('Unexpected MCP network target');
});
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('Disposable test PostgreSQL required');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
 schema='oauth_remote_'+process.pid+'_'+Math.floor(Math.random()*100000);
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 for(const file of ['001-hub-foundation.sql','002-hub-oauth.sql',
   '004-hub-registry.sql','005-hub-grants.sql','006-hub-activation.sql',
   '020-hub-service-identities.sql',
   '025-hub-upstream-oauth-connections.sql',
   '026-hub-oauth-mcp-read-audit.sql'])
  await db.query(await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 await db.query(`INSERT INTO hub_oauth_clients(client_id,owner_id,redirect_uri)
 VALUES('synthetic-client',$1,'https://agent.example.org/callback')`,[owner]);
 await db.query(`INSERT INTO hub_oauth_sessions(id,family_id,owner_id,
 client_id,access_digest,refresh_digest,profile,areas,mode,access_expires_at,
 refresh_expires_at) VALUES($1,$2,$3,'synthetic-client',$4,$5,
 'full',ARRAY['gateway'],'live',now()+interval '2 hours',
 now()+interval '30 days')`,
 [session,family,owner,randomUUID(),randomUUID()]);
});
afterAll(async()=>{if(db){if(schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.end();}});
let connectionId,firstState,firstBrowser;
it('Hub initiates generic service registration and RFC8707 PKCE consent',async()=>{
 const result=await beginUpstreamOauth(db,settings,{
  ownerId:owner,origin,hubOrigin,mode:'live',profile:'read_only',
  family,areas:['files'],ack:true},{discover:async()=>remote,post});
 const url=new URL(result.authorizeUrl);
 expect(url.origin).toBe(origin);
 expect(url.searchParams.get('resource')).toBe(origin+'/api/mcp');
 expect(url.searchParams.get('code_challenge_method')).toBe('S256');
 expect(url.searchParams.get('profile')).toBe('read_only');
 expect(url.searchParams.get('areas')).toBe('files');
 expect(url.searchParams.get('client_id')).toBe('registered-dcr-client');
 firstState=url.searchParams.get('state');firstBrowser=result.browserNonce;
 expect(firstState).toMatch(/^[A-Za-z0-9_-]{43}$/);
 expect(firstBrowser).toMatch(/^[A-Za-z0-9_-]{43}$/);
 const pending=(await db.query('SELECT * FROM hub_upstream_oauth_flows')).rows[0];
 expect(pending.state_digest).not.toBe(firstState);
 expect(JSON.stringify(pending)).not.toContain('synthetic-registration-secret');
 const saved=(await db.query('SELECT state FROM hub_servers')).rows[0];
 expect(saved.state).toBe('pending');
});
it('requires exact owner-selected issuer identity and one-use browser state',async()=>{
 const args={ownerId:owner,state:firstState,browser:firstBrowser,
  code:'synthetic-code',hubOrigin};
 await expect(finishUpstreamOauth(db,settings,{...args,browser:'Z'.repeat(43)},
  {post})).rejects.toThrow();
 const worked=await finishUpstreamOauth(db,settings,args,{post});
 expect(worked).toMatchObject({server:'independent-mcp',state:'connected',
   refreshAvailable:true,tools:1});
 const current=(await db.query('SELECT * FROM hub_upstream_oauth_connections WHERE revoked_at IS NULL')).rows[0];
 connectionId=current.id;
 expect(current.mode).toBe('live');
 expect(current.profile).toBe('read_only');
 expect(current.allowed_areas).toEqual(['files']);
 expect(current.refresh_available).toBe(true);
 expect(JSON.stringify(current)).not.toContain('initial-provider-access');
 expect(JSON.stringify(current)).not.toContain('synthetic-registration-secret');
 expect((await db.query('SELECT state FROM hub_servers')).rows[0].state).toBe('active');
 await expect(finishUpstreamOauth(db,settings,args,{post})).rejects.toThrow();
});
it('refreshes a real encrypted issuer credential under a row lock, no grants copied',async()=>{
 await db.query(`UPDATE hub_upstream_oauth_connections SET
   access_expires_at=now()-interval '1 minute' WHERE id=$1`,[connectionId]);
 const read=await remoteConnectionRead(db,settings,{ownerId:owner,id:connectionId},{
  post,list:async(_resource,access)=>{
   expect(access).toBe('rotated-access-secret');return [tool];
  }});
 expect(read).toMatchObject({server:'independent-mcp',mode:'live',
  tools:[{name:tool.name,readOnly:true}]});
 const current=(await db.query('SELECT * FROM hub_upstream_oauth_connections WHERE id=$1',[connectionId])).rows[0];
 expect(new Date(current.access_expires_at).getTime()).toBeGreaterThan(Date.now());
 expect(JSON.stringify(current)).not.toContain('rotated-access-secret');
 expect((await listUpstreamOauthConnections(db,owner)).find(
  x=>x.id===connectionId).state).toBe('connected');
});
it('isolates actual LIVE Hub OAuth caller to this connection and records durable read audit',async()=>{
 const actor={id:session,ownerId:owner,clientId:'synthetic-client',
  mode:'live',profile:'full',areas:['gateway'],allowWrites:false};
 const {listActorUpstreamOauth}=await import('../../src/upstream-oauth-connections.js');
 const authorized=await listActorUpstreamOauth(db,actor);
 expect(authorized).toEqual([expect.objectContaining({name:'independent-mcp',
  mode:'live',profile:'read_only',areas:['files'],id:connectionId})]);
 expect(await listActorUpstreamOauth(db,{...actor,id:randomUUID()})).toEqual([]);
 expect(await listActorUpstreamOauth(db,{...actor,mode:'test'})).toEqual([]);
 const adapters=genericFederationDependencies({actor,db,settings},{
  legacyList:async()=>[],legacyResolve:async()=>null,
  oauthWith:async()=>{throw Error('Not needed for identity audit');}});
 const targets=await adapters.list(db,actor,{limit:100});
 expect(targets).toHaveLength(1);
 expect(targets[0]).toMatchObject({name:'independent-mcp',
  prefix:'independent',mode:'live',grantId:connectionId});
 const correlationId=randomUUID();
 await adapters.audit(db,{actor,grantId:connectionId,service:'independent-mcp',
  tool:'independent_files_list',phase:'attempt',outcome:'allowed',
  correlationId});
 const row=await db.query('SELECT owner_id,connection_id,phase,outcome FROM hub_upstream_oauth_read_audit');
 expect(row.rows).toEqual([{owner_id:owner,connection_id:connectionId,
  phase:'attempt',outcome:'allowed'}]);
 await expect(adapters.audit(db,{actor:{...actor,ownerId:'wrong'},
  grantId:connectionId,service:'independent-mcp',
  tool:'independent_files_list',phase:'outcome',outcome:'success',
  correlationId})).rejects.toThrow();
});
it('rejects changed caller authority and disconnects without changing provider accounts',async()=>{
 await db.query(`UPDATE hub_oauth_sessions SET revoked_at=now() WHERE id=$1`,[session]);
 await expect(remoteConnectionRead(db,settings,{ownerId:owner,id:connectionId},
  {post,list:async()=>[tool]})).rejects.toThrow();
 expect(await disconnectUpstreamOauth(db,{ownerId:owner,id:connectionId})).toBe(true);
 expect(await disconnectUpstreamOauth(db,{ownerId:owner,id:connectionId})).toBe(false);
 await expect(remoteConnectionRead(db,settings,{ownerId:owner,id:connectionId},
  {post,list:async()=>[tool]})).rejects.toThrow();
});
