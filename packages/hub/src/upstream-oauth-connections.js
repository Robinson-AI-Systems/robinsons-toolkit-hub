// Provider-neutral OAuth 2.1/PKCE outbound connection. No TEST pass is issued.
// Browser consent is service-owned; only issuer tokens enter the sealed Hub DB.
import {createHash,createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {discoverMcpOAuth,validateRegistration} from './upstream-oauth-discovery.js';
import {pinnedMcpRequest} from './upstream-mcp-http.js';
import {stageHubServer} from './registry.js';

const hex=s=>createHash('sha256').update(s).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const isOwner=s=>typeof s==='string'&&/^[A-Za-z0-9:_-]{1,120}$/.test(s);
const area=/^[a-z][a-z0-9_]{0,59}$/;
const basePass=/^[A-Za-z0-9_-]{43}$/;
const safeScope=/^[A-Za-z0-9_:.\/ -]{0,500}$/;
function aesKey(settings){
 const source=settings?.grantsKey;
 if(typeof source!=='string'||!basePass.test(source))throw Error('OAuth vault unavailable');
 const key=Buffer.from(source,'base64url');
 if(key.length!==32||key.toString('base64url')!==source)throw Error('OAuth vault unavailable');
 return key;
}
function seal(value,aad,settings){
 const nonce=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',aesKey(settings),nonce);
 cipher.setAAD(Buffer.from(aad));
 const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return {enc:bytes,nonce,tag:cipher.getAuthTag()};
}
function open(row,aad,settings){
 const decrypt=createDecipheriv('aes-256-gcm',aesKey(settings),row.secret_nonce);
 decrypt.setAAD(Buffer.from(aad));decrypt.setAuthTag(row.secret_tag);
 return JSON.parse(Buffer.concat([
  decrypt.update(row.secret_enc),decrypt.final()]).toString('utf8'));
}
const flowAAD=row=>JSON.stringify([row.owner_id,row.caller_family,row.service_name,
  row.resource,row.state_digest]);
const connectionAAD=row=>JSON.stringify([row.owner_id,row.caller_family,
  row.service_name,row.resource,row.id]);
function safeAreas(input,offered){
 if(!Array.isArray(input)||input.length<1||input.length>32||
   input.some(x=>!area.test(x)||!offered.includes(x))||
   new Set(input).size!==input.length)throw Error('Unapproved MCP service areas');
 return [...input];
}
async function currentFamily(db,ownerId,family,serviceName,mode,profile){
 if(!isOwner(ownerId)||typeof family!=='string'||family.length>80||
   !['test','live'].includes(mode)||!['read_only','everyday','full'].includes(profile))
   throw Error('Invalid Hub OAuth connection selection');
 const {rows}=await db.query(`SELECT DISTINCT ON (family_id)
  id,family_id,profile,mode,areas,client_id,
  to_jsonb(s)->'allowed_servers' AS allowed_servers,
  to_jsonb(s)->'service_profile_policy' AS profile_policy
  FROM hub_oauth_sessions s WHERE owner_id=$1
    AND revoked_at IS NULL AND refresh_expires_at>now()
    AND access_expires_at>now() AND 'gateway'=ANY(areas)
    AND NOT EXISTS (SELECT 1 FROM hub_oauth_sessions gone
      WHERE gone.family_id=s.family_id AND gone.revoked_at IS NOT NULL)
  ORDER BY family_id,access_expires_at DESC LIMIT 25`,[ownerId]);
 const eligible=rows.filter(x=>(!family||x.family_id===family)&&
   x.mode===mode&&x.profile===profile&&
   (!Array.isArray(x.allowed_servers)||x.allowed_servers.includes(serviceName))&&
   x.profile_policy?.[serviceName]!=='disabled');
 if(eligible.length!==1)throw Error('Choose exactly one active Hub OAuth connection with matching mode/profile');
 return eligible[0].family_id;
}
function tokenResult(body){
 if(!body||typeof body.access_token!=='string'||!body.access_token||
   body.access_token.length>4096||/\s/.test(body.access_token)||
   body.token_type?.toLowerCase()!=='bearer'||
   !Number.isInteger(body.expires_in)||body.expires_in<60||body.expires_in>31536000||
   body.refresh_token!==undefined&&
    (typeof body.refresh_token!=='string'||body.refresh_token.length>4096||
     !body.refresh_token||/\s/.test(body.refresh_token)))
   throw Error('OAuth issuer returned invalid scoped token response');
 return {accessToken:body.access_token,refreshToken:body.refresh_token??null,
  expiresIn:body.expires_in,scopes:typeof body.scope==='string'&&
  safeScope.test(body.scope)?body.scope:null};
}
async function issuerToken(metadata,client,grantParams,post=pinnedMcpRequest){
 const body=new URLSearchParams({...grantParams,client_id:client.clientId,
   ...(client.authMethod==='client_secret_post'?{
    client_secret:client.clientSecret}: {})}).toString();
 return tokenResult(await post(metadata.tokenEndpoint,{
   method:'POST',body,headers:{'content-type':'application/x-www-form-urlencoded',
    accept:'application/json'},timeoutMs:10000,maxBytes:8192}));
}
// RTC1 already supplies fixed search/describe meta-tools. Never request
// an entire remote tools/list to authorize one provider: that would reload
// hundreds/thousands of tools and defeat Hub's fixed-context architecture.
const rtcTool=(prefix,leaf)=>prefix+(prefix.endsWith('_')?'':'_')+leaf;
function validSearchPreview(value,prefix){
 if(value?.jsonrpc!=='2.0'||value?.error||value?.result?.isError===true)
  throw Error('Issuer search metadata unavailable');
 let details=value.result?.structuredContent;
 if(!details&&Array.isArray(value.result?.content)){
  const raw=value.result.content.find(x=>x.type==='text')?.text;
  if(typeof raw==='string'&&raw.length<=5000)
   try{details=JSON.parse(raw);}catch{}
 }
 const tools=details?.result?.tools??details?.tools;
 if(!Array.isArray(tools)||tools.length>1||
   tools.some(t=>!t||typeof t.name!=='string'||
     !t.name.startsWith(prefix.endsWith('_')?prefix:prefix+'_')||
     t.name.length>120||!t.name.includes('_')))
  throw Error('Issuer ignored bounded RTC1 search or returned invalid tool metadata');
 return tools;
}
export async function issuerMcpTools(resource,access,prefix,post=pinnedMcpRequest){
 const response=await post(resource,{method:'POST',
  body:{jsonrpc:'2.0',id:1,method:'tools/call',
   params:{name:rtcTool(prefix,'search_tools'),
    arguments:{query:'',limit:1}}},
  bearer:access,headers:{'mcp-protocol-version':'2025-11-25'},
  maxBytes:8192,timeoutMs:10000});
 return validSearchPreview(response,prefix);
}
export async function issuerMcpWhoami(resource,access,prefix,expected,post=pinnedMcpRequest){
 const body=await post(resource,{method:'POST',
  body:{jsonrpc:'2.0',id:2,method:'tools/call',
   params:{name:rtcTool(prefix,'whoami'),arguments:{}}},bearer:access,
  headers:{'mcp-protocol-version':'2025-11-25'},timeoutMs:10000,maxBytes:16384});
 if(body?.error||body?.result?.isError===true)
  throw Error('MCP provider identity verification refused');
 let who=body?.result?.structuredContent;
 if(!who&&Array.isArray(body?.result?.content)) {
  const raw=body.result.content.find(x=>x.type==='text')?.text;
  if(typeof raw==='string'&&raw.length<=12000)
   try{who=JSON.parse(raw);}catch{}
 }
 // Do not mistake a successful OAuth code exchange for chosen delegation.
 if(!who||who.mode!==expected.mode||who.profile!==expected.profile||
    !Array.isArray(who.areas)||expected.areas.some(x=>!who.areas.includes(x))||
    (expected.profile==='read_only'&&
      (who.allowWrites===true||who.allow_writes===true)))
  throw Error('MCP provider did not attest the chosen authorization');
 return true;
}
export async function beginUpstreamOauth(db,settings,{ownerId,origin,
 family=null,mode='live',profile='read_only',areas,scopes='',
 hubOrigin,ack=false},{
 discover=discoverMcpOAuth,post=pinnedMcpRequest,
 stage=stageHubServer}={}){
 if(!isOwner(ownerId)||!hubOrigin||!safeScope.test(scopes)||
   (mode==='live'||profile!=='read_only')&&ack!==true)
  throw Error('Invalid or unapproved MCP OAuth authorization');
 const remote=await discover(origin);
 const allowed=safeAreas(areas,remote.areas);
 if(!remote.modes.includes(mode)||!remote.profiles.includes(profile))
   throw Error('MCP service does not offer requested delegated permissions');
 const selectedFamily=await currentFamily(db,ownerId,family,remote.name,mode,profile);
 const registered=await db.query(
  'SELECT name,prefix,origin,state FROM hub_servers WHERE name=$1 AND owner_id=$2',
  [remote.name,ownerId]);
 if(registered.rows.length>1)throw Error('Ambiguous registered MCP service');
 if(registered.rows.length){
  const original=registered.rows[0];
  if(original.origin!==origin||original.prefix!==remote.prefix||
    !['pending','active'].includes(original.state))
    throw Error('Existing RTC service conflicts with discovered identity');
 }else{
  await stage(db,{ownerId,name:remote.name,prefix:remote.prefix,origin,
   manifest:{rtc:1,server:remote.name,prefix:remote.prefix,
    modes:remote.modes,profiles:remote.profiles,counts:remote.counts}},
   {ownerVerified:true});
 }
 const redirectUri=hubOrigin+'/api/owner/connect-mcp-callback';
 const payload={client_name:'Robinson Toolkit Hub',
   redirect_uris:[redirectUri],grant_types:['authorization_code','refresh_token'],
   response_types:['code'],token_endpoint_auth_method:'client_secret_post'};
 const registeredClient=validateRegistration(await post(remote.registrationEndpoint,{
  method:'POST',body:payload,headers:{accept:'application/json'},maxBytes:8192,
  timeoutMs:10000}),remote,redirectUri);
 const state=token(),browser=token(),verifier=token();
 const digest=hex(state);
 const values={verifier,clientSecret:registeredClient.clientSecret,
  authMethod:registeredClient.authMethod};
 const row={owner_id:ownerId,caller_family:selectedFamily,
  service_name:remote.name,resource:remote.resource,state_digest:digest};
 const secret=seal(values,flowAAD(row),settings);
 await db.query(`INSERT INTO hub_upstream_oauth_flows
 (state_digest,browser_digest,owner_id,caller_family,service_name,
  origin,resource,issuer,token_endpoint,client_id,secret_enc,secret_nonce,secret_tag,
  requested_scopes,requested_mode,requested_profile,allowed_areas,expires_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
  now()+interval '10 minutes')`,[digest,hex(browser),ownerId,selectedFamily,
  remote.name,origin,remote.resource,remote.issuer,remote.tokenEndpoint,
  registeredClient.clientId,secret.enc,secret.nonce,secret.tag,scopes,mode,profile,allowed]);
 const authorization=new URL(remote.authorizationEndpoint);
 for(const[k,v]of Object.entries({
  response_type:'code',client_id:registeredClient.clientId,
  redirect_uri:redirectUri,state,code_challenge_method:'S256',
  code_challenge:createHash('sha256').update(verifier).digest('base64url'),
  resource:remote.resource,mode,
  profile,areas:allowed.join(','),...(scopes?{scope:scopes}:{})}))
  authorization.searchParams.set(k,v);
 return {authorizeUrl:authorization.href,browserNonce:browser,
  server:remote.name,mode,profile};
}
export async function finishUpstreamOauth(db,settings,{ownerId,state,browser,code,hubOrigin,issuer=null},
 {post=pinnedMcpRequest,list=issuerMcpTools}={}){
 if(!isOwner(ownerId)||!basePass.test(state||'')||!basePass.test(browser||'')||
   typeof code!=='string'||!code||code.length>4096||
   /[\r\n]/.test(code))throw Error('Invalid MCP OAuth callback');
 const digest=hex(state);
 // Claim before exchanging: replay/double-submits cannot exchange the code twice.
 const result=await db.query(`UPDATE hub_upstream_oauth_flows
  SET consumed_at=now() WHERE state_digest=$1 AND owner_id=$2 AND browser_digest=$3
  AND consumed_at IS NULL AND expires_at>now() RETURNING *`,
 [digest,ownerId,hex(browser)]);
 const pending=result.rows[0];
 if(!pending)throw Error('MCP OAuth callback expired or replayed');
 if(issuer!==null&&issuer!==pending.issuer)throw Error('OAuth issuer state mismatch');
 const saved=open(pending,flowAAD(pending),settings);
 const client={clientId:pending.client_id,...saved};
 const issued=await issuerToken({tokenEndpoint:pending.token_endpoint},client,{
  grant_type:'authorization_code',code,
  redirect_uri:hubOrigin+'/api/owner/connect-mcp-callback',
  code_verifier:saved.verifier,resource:pending.resource},post);
 // A successful token exchange alone cannot activate an unverified MCP server.
 const manifest=await discoverMcpOAuth(pending.origin,{get:post});
 if(manifest.name!==pending.service_name||manifest.resource!==pending.resource||
    manifest.issuer!==pending.issuer||manifest.tokenEndpoint!==pending.token_endpoint)
   throw Error('MCP OAuth issuer/RTC identity changed before connection activation');
 const catalog=await list(pending.resource,issued.accessToken,manifest.prefix,post);
 await issuerMcpWhoami(pending.resource,issued.accessToken,manifest.prefix,
  {mode:pending.requested_mode,profile:pending.requested_profile,
   areas:pending.allowed_areas},post);
 const freshFamily=await currentFamily(db,pending.owner_id,pending.caller_family,
  pending.service_name,pending.requested_mode,pending.requested_profile);
 if(freshFamily!==pending.caller_family)throw Error('Hub OAuth family no longer permitted');
 const id=randomUUID();
 const connection={id,owner_id:pending.owner_id,caller_family:pending.caller_family,
  service_name:pending.service_name,resource:pending.resource};
 const sealed=seal({clientSecret:saved.clientSecret,authMethod:saved.authMethod,
  accessToken:issued.accessToken,refreshToken:issued.refreshToken},
  connectionAAD(connection),settings);
 await db.query('BEGIN');
 try{
  // An old valid session remains until every upstream test above succeeds.
  await db.query(`UPDATE hub_upstream_oauth_connections SET revoked_at=now()
   WHERE owner_id=$1 AND caller_family=$2 AND service_name=$3
   AND revoked_at IS NULL`,[pending.owner_id,pending.caller_family,pending.service_name]);
  await db.query(`INSERT INTO hub_upstream_oauth_connections
   (id,owner_id,caller_family,service_name,origin,resource,issuer,token_endpoint,
    client_id,secret_enc,secret_nonce,secret_tag,authorized_scopes,allowed_areas,
    mode,profile,access_expires_at,refresh_available)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
     now()+$17::integer*interval '1 second',$18)`,
  [id,pending.owner_id,pending.caller_family,pending.service_name,pending.origin,
   pending.resource,pending.issuer,pending.token_endpoint,pending.client_id,
   sealed.enc,sealed.nonce,sealed.tag,issued.scopes??pending.requested_scopes,
   pending.allowed_areas,pending.requested_mode,pending.requested_profile,
   issued.expiresIn,Boolean(issued.refreshToken)]);
  await db.query(`UPDATE hub_servers SET state='active',updated_at=now()
    WHERE owner_id=$1 AND name=$2 AND origin=$3 AND state='pending'`,
    [pending.owner_id,pending.service_name,pending.origin]);
  await db.query('COMMIT');
 }catch(err){try{await db.query('ROLLBACK');}catch{}throw err;}
 return {server:pending.service_name,state:'connected',tools:catalog.length,
  refreshAvailable:Boolean(issued.refreshToken)};
}
export async function listUpstreamOauthConnections(db,ownerId){
 if(!isOwner(ownerId))throw Error('Owner required');
 const {rows}=await db.query(`SELECT id,service_name,mode,profile,allowed_areas,
  authorized_scopes,access_expires_at,refresh_available,revoked_at
  FROM hub_upstream_oauth_connections WHERE owner_id=$1
  ORDER BY created_at DESC LIMIT 50`,[ownerId]);
 return rows.map(x=>({id:x.id,server:x.service_name,mode:x.mode,profile:x.profile,
  areas:x.allowed_areas,scopes:x.authorized_scopes,
  expiresAt:x.access_expires_at,
  state:x.revoked_at?'disconnected':new Date(x.access_expires_at)<new Date()?
   x.refresh_available?'renewal_available':'reconnect_required':'connected'}));
}

export async function remoteConnectionRead(db,settings,{ownerId,id},
 {post=pinnedMcpRequest,list=issuerMcpTools}={}){
 if(!isOwner(ownerId)||!/^[-0-9a-f]{36}$/i.test(id||''))
   throw Error('Invalid owner connection selection');
 const opened=await db.query(`SELECT * FROM hub_upstream_oauth_connections
  WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL`,[id,ownerId]);
 const current=opened.rows[0];
 if(!current)throw Error('Upstream MCP connection unavailable');
 await currentFamily(db,ownerId,current.caller_family,current.service_name,
  current.mode,current.profile);
 let credentials=open(current,connectionAAD(current),settings);
 if(new Date(current.access_expires_at).getTime()<=Date.now()+60000){
  if(!credentials.refreshToken)throw Error('Upstream consent expired; reconnect through Hub');
  // Serialize rotating refresh grants so two reads cannot reuse the same token.
  await db.query('BEGIN');
  try{
   const checked=await db.query(`SELECT * FROM hub_upstream_oauth_connections
    WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL FOR UPDATE`,[id,ownerId]);
   if(checked.rows.length!==1)throw Error('Connection was disconnected');
   const row=checked.rows[0];
   await currentFamily(db,ownerId,row.caller_family,row.service_name,row.mode,row.profile);
   credentials=open(row,connectionAAD(row),settings);
   if(new Date(row.access_expires_at).getTime()<=Date.now()+60000){
    if(!credentials.refreshToken)throw Error('Refresh no longer authorized');
    const renewed=await issuerToken({tokenEndpoint:row.token_endpoint},
     {clientId:row.client_id,clientSecret:credentials.clientSecret,
      authMethod:credentials.authMethod},
     {grant_type:'refresh_token',refresh_token:credentials.refreshToken,
      resource:row.resource},post);
    // A refresh may not silently switch principal, profile, environment or area.
    const registry=await db.query('SELECT prefix FROM hub_servers WHERE name=$1 AND owner_id=$2',
     [row.service_name,ownerId]);
    if(registry.rows.length!==1)throw Error('Service identity changed during OAuth refresh');
    await issuerMcpWhoami(row.resource,renewed.accessToken,registry.rows[0].prefix,
     {mode:row.mode,profile:row.profile,areas:row.allowed_areas},post);
    credentials={...credentials,accessToken:renewed.accessToken,
      refreshToken:renewed.refreshToken??credentials.refreshToken};
    const sealed=seal(credentials,connectionAAD(row),settings);
    const update=await db.query(`UPDATE hub_upstream_oauth_connections
       SET secret_enc=$3,secret_nonce=$4,secret_tag=$5,
        access_expires_at=now()+$6::integer*interval '1 second',
        updated_at=now(),refresh_available=$7
       WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL RETURNING id`,
       [id,ownerId,sealed.enc,sealed.nonce,sealed.tag,
        renewed.expiresIn,Boolean(credentials.refreshToken)]);
    if(update.rowCount!==1)throw Error('OAuth renewal changed during refresh');
   }
   await db.query('COMMIT');
  }catch(err){try{await db.query('ROLLBACK');}catch{}
   throw Error('Upstream MCP OAuth refresh unavailable');
  }
 }
 const resourceOrigin=new URL(current.resource).origin;
 if(resourceOrigin!==current.origin)throw Error('MCP connection resource changed');
 const active=await db.query(`SELECT 1 FROM hub_upstream_oauth_connections
  WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL`,[id,ownerId]);
 if(active.rows.length!==1)throw Error('Connection revoked before use');
 const service=await db.query('SELECT prefix,state,origin FROM hub_servers WHERE owner_id=$1 AND name=$2',
  [ownerId,current.service_name]);
 if(service.rows.length!==1||service.rows[0].state!=='active'||
   service.rows[0].origin!==current.origin)throw Error('MCP service disabled or changed');
 const tools=await list(current.resource,credentials.accessToken,service.rows[0].prefix,post);
 // Only independently authenticated metadata, bounded at the receiving API.
 return {server:current.service_name,mode:current.mode,profile:current.profile,
  tools:tools.slice(0,30).map(t=>({name:t.name,
   description:String(t.description??'').slice(0,160),
   readOnly:t.annotations?.readOnlyHint===true})),
  incomplete:tools.length>30};
}
export async function disconnectUpstreamOauth(db,{ownerId,id}){
 if(!isOwner(ownerId)||!/^[-0-9a-f]{36}$/i.test(id||''))
   throw Error('Invalid MCP disconnect selection');
 const result=await db.query(`UPDATE hub_upstream_oauth_connections
  SET revoked_at=now(),updated_at=now()
  WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL RETURNING id`,[id,ownerId]);
 return result.rowCount===1;
}

function eligibleHubActor(actor){
 return actor?.clientId&&typeof actor.ownerId==='string'&&
  /^[0-9a-f-]{36}$/i.test(actor.id??'')&&
  ['test','live'].includes(actor.mode)&&
  ['read_only','everyday','full'].includes(actor.profile)&&
  !(actor.profile==='read_only'&&actor.allowWrites===true)&&
  Array.isArray(actor.areas)&&actor.areas.includes('gateway');
}
export async function listActorUpstreamOauth(db,actor){
 if(!eligibleHubActor(actor))return [];
 // Token access never broadens a Hub caller's own persisted service selection,
 // profile restrictions, tenant, OAuth family or source permission.
 const {rows}=await db.query(`SELECT c.id,c.service_name,c.origin,c.resource,
  c.mode,c.profile,c.allowed_areas,c.access_expires_at,
  s.family_id,s.profile AS hub_profile,s.mode AS hub_mode,
  s.areas AS hub_areas,
  to_jsonb(s)->'allowed_servers' AS selected_servers,
  to_jsonb(s)->'service_profile_policy' AS profile_policy,
  to_jsonb(s)->'service_area_policy' AS area_policy,
  h.prefix,h.state AS registry_state
  FROM hub_oauth_sessions s
  JOIN hub_upstream_oauth_connections c ON c.owner_id=s.owner_id
    AND c.caller_family=s.family_id
  JOIN hub_servers h ON h.owner_id=c.owner_id AND h.name=c.service_name
    AND h.origin=c.origin
  WHERE s.id=$1 AND s.owner_id=$2 AND s.revoked_at IS NULL
    AND s.access_expires_at>now() AND s.refresh_expires_at>now()
    AND s.mode=$3 AND s.profile=$4 AND 'gateway'=ANY(s.areas)
    AND c.revoked_at IS NULL AND c.mode=s.mode AND c.profile=s.profile
    AND h.state='active'
    AND NOT EXISTS (SELECT 1 FROM hub_oauth_sessions broken
     WHERE broken.family_id=s.family_id AND broken.revoked_at IS NOT NULL)
  ORDER BY c.service_name LIMIT 100`,
 [actor.id,actor.ownerId,actor.mode,actor.profile]);
 return rows.filter(x=>
    (!Array.isArray(actor.serverNames)||actor.serverNames.includes(x.service_name))&&
    (!Array.isArray(x.selected_servers)||x.selected_servers.includes(x.service_name))&&
    x.profile_policy?.[x.service_name]!=='disabled')
  .map(x=>{
   const narrowed=x.area_policy?.[x.service_name];
   const areas=Array.isArray(narrowed)?
    x.allowed_areas.filter(a=>narrowed.includes(a)):x.allowed_areas;
   return {id:x.id,name:x.service_name,prefix:x.prefix,
    mode:x.mode,profile:x.profile,areas,origin:x.origin,
    expiresAt:x.access_expires_at,
    family:x.family_id};
  }).filter(x=>x.areas.length>0);
}
export async function withActorUpstreamOauth(db,settings,{actor,id},work,
 {post=pinnedMcpRequest}={}){
 if(!eligibleHubActor(actor)||typeof work!=='function'||
   !/^[-0-9a-f]{36}$/i.test(id??''))throw Error('MCP delegated caller invalid');
 let authorized=(await listActorUpstreamOauth(db,actor)).find(x=>x.id===id);
 if(!authorized)throw Error('MCP connection is not delegated to this caller');
 // Reuse the existing issuer refresh/row-lock lifecycle before any provider
 // request; no synthetic hub_server_grant or reusable service TEST pass.
 await remoteConnectionRead(db,settings,{ownerId:actor.ownerId,id},
  {post,list:async()=>[]});
 authorized=(await listActorUpstreamOauth(db,actor)).find(x=>x.id===id);
 if(!authorized)throw Error('MCP connection authorization changed');
 const {rows}=await db.query(`SELECT * FROM hub_upstream_oauth_connections
  WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL
  AND access_expires_at>now()+interval '30 seconds'`,[id,actor.ownerId]);
 const row=rows[0];
 if(!row||row.caller_family!==authorized.family||row.resource!==
   authorized.origin+'/api/mcp')throw Error('MCP OAuth audience changed');
 const values=open(row,connectionAAD(row),settings);
 const result=await work({...authorized,resource:row.resource,
  accessToken:values.accessToken},post);
 const after=(await listActorUpstreamOauth(db,actor)).find(x=>x.id===id);
 if(!after||after.mode!==authorized.mode||after.profile!==authorized.profile||
   after.areas.join('|')!==authorized.areas.join('|'))
  throw Error('MCP connection was revoked or narrowed during request');
 return result;
}
