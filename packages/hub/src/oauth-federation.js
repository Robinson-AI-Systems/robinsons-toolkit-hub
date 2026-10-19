// Optional OAuth transport for the EXISTING fixed H-3 broker.
// No extra Hub tools, eager remote schema catalog, or provider-specific code.
import {listActorUpstreamOauth,withActorUpstreamOauth} from './upstream-oauth-connections.js';
import {listEligibleRtcTargets,resolveActiveCallerGrant} from './grants.js';
import {searchPinnedRtcTools,describePinnedRtcTool} from './pinned-tools.js';
import {pinnedRtcReadCall} from './pinned-read-call.js';
import {appendRtcReadAudit} from './rtc-read-audit.js';
import {ownsRtcToolName} from './rtc-prefix.js';

const namePattern=/^[a-z][a-z0-9_]{2,119}$/;
const areaPattern=/^[a-z][a-z0-9_]{0,59}$/;
function mcpMeta(prefix,kind) {
 return prefix+(prefix.endsWith('_')?'':'_')+kind;
}
function unwrap(reply){
 if(reply?.jsonrpc!=='2.0'||reply.error||reply.result?.isError===true)
  throw Error('Authorized MCP request refused by original service');
 let content=reply.result?.structuredContent;
 if(!content&&Array.isArray(reply.result?.content)){
  const raw=reply.result.content.find(x=>x.type==='text')?.text;
  if(typeof raw==='string'&&raw.length<=14000)
   try{content=JSON.parse(raw);}catch{}
 }
 if(!content||typeof content!=='object'||Array.isArray(content))
  throw Error('Invalid MCP result envelope');
 if(content.ok===false)throw Error('Original MCP refused request');
 return content.ok===true&&content.result&&typeof content.result==='object'
  ?content.result:content;
}
async function callMcp(service,post,leaf,args,limit=16384){
 const value=await post(service.resource,{method:'POST',bearer:service.accessToken,
  body:{jsonrpc:'2.0',id:1,method:'tools/call',
   params:{name:mcpMeta(service.prefix,leaf),arguments:args}},
  headers:{'mcp-protocol-version':'2025-11-25'},
  maxBytes:limit,timeoutMs:5000});
 return unwrap(value);
}
function validRead(t,grant){
 return t&&namePattern.test(t.name||'')&&
  ownsRtcToolName(grant.prefix,t.name)&&
  areaPattern.test(t.area||'')&&grant.areas.includes(t.area)&&
  Array.isArray(t.profiles)&&t.profiles.includes(grant.profile)&&
  t.writes===false&&t.money===false&&t.destructive===false&&
  t.annotations?.readOnlyHint===true;
}
function grantTarget(c){
 return {name:c.name,prefix:c.prefix,areas:c.areas,
  grantId:c.id,origin:c.origin,verifiedAt:String(c.expiresAt),
  claimedCounts:{tools:0,writes:0,money:0},mode:c.mode,
  effectiveProfile:c.profile,readOnlyGrant:c.profile==='read_only',kind:'oauth'};
}
function serviceGrant(c){
 return {kind:'oauth',grantId:c.id,server:c.name,mode:c.mode,
  profile:c.profile,prefix:c.prefix,origin:c.origin,areas:c.areas};
}
export function genericFederationDependencies({actor,db,settings},{
 legacyList=listEligibleRtcTargets,legacyResolve=resolveActiveCallerGrant,
 legacySearch=searchPinnedRtcTools,legacyDescribe=describePinnedRtcTool,
 legacyRead=pinnedRtcReadCall,legacyAudit=appendRtcReadAudit,
 oauthList=listActorUpstreamOauth,oauthWith=withActorUpstreamOauth}={}){
 const active=async()=>actor?.clientId?
   (await oauthList(db,actor)).slice(0,100):[];
 const targets=async(_db,_actor,options={})=>{
  const [oauth,legacy]=await Promise.all([
   active(),legacyList(db,actor,{limit:100})]);
  const selected=new Set(oauth.map(c=>c.name));
  return [...oauth.map(grantTarget),...legacy.filter(x=>!selected.has(x.name))]
   .sort((x,y)=>x.name.localeCompare(y.name)).slice(0,options.limit??100);
 };
 const resolve=async(_db,{serverName},config)=>{
  const chosen=(await active()).find(c=>c.name===serverName);
  if(chosen)return serviceGrant(chosen);
  return legacyResolve(db,{actor,serverName},config);
 };
 const via=async(grant,work)=>oauthWith(db,settings,
  {actor,id:grant.grantId},work);
 const search=async(grant,request)=>{
  if(grant.kind!=='oauth')return legacySearch(grant,request);
  return via(grant,async(service,post)=>{
   const result=await callMcp(service,post,'search_tools',{
    query:request.query??'',limit:Math.min(request.limit??10,20),
    ...(request.area?{area:request.area}:{}),
    ...(request.cursor?{cursor:request.cursor}:{})},8192);
   if(!Array.isArray(result.tools)||result.tools.length>(request.limit??10)||
    result.tools.length>20)throw Error('Unbounded provider search refused');
   const tools=result.tools.filter(x=>validRead(x,grant)).map(t=>({
    name:t.name,description:String(t.description??'').slice(0,160),
    area:t.area,profiles:[grant.profile],writes:false,money:false,
    destructive:false,annotations:{readOnlyHint:true},
    ...(t.audience?{audience:t.audience}:{})}));
   return {tools,next:result.next??null,
    incomplete:result.incomplete===true||result.next!=null};
  });
 };
 const describe=async(grant,name)=>{
  if(grant.kind!=='oauth')return legacyDescribe(grant,name);
  if(!namePattern.test(name)||!ownsRtcToolName(grant.prefix,name))
   throw Error('Invalid scoped MCP tool name');
  return via(grant,async(service,post)=>{
   const response=await callMcp(service,post,'describe_tool',{name},16384);
   const detail=response.tool??response;
   if(detail.name!==name||!validRead(detail,grant)||
     !detail.inputSchema||typeof detail.inputSchema!=='object'||
     Array.isArray(detail.inputSchema))
    throw Error('RTC tool not an authorized nonwriting operation');
   return detail;
  });
 };
 const read=async(grant,name,args)=>{
  if(grant.kind!=='oauth')return legacyRead(grant,name,args);
  if(!namePattern.test(name)||!ownsRtcToolName(grant.prefix,name)||
    !args||typeof args!=='object'||Array.isArray(args)||
    Buffer.byteLength(JSON.stringify(args),'utf8')>8192)
   throw Error('Invalid MCP READ operation');
  return via(grant,async(service,post)=>{
   const result=await callMcp(service,post,'call',{name,args},65536);
   return {ok:true,result};
  });
 };
 const audit=async(client,{actor:caller,grantId,service,tool,
  correlationId,phase,outcome,upstreamLogId=null})=>{
  const c=(await active()).find(x=>x.id===grantId&&x.name===service);
  if(!c)return legacyAudit(client,{actor:caller,grantId,service,tool,
   correlationId,phase,outcome,upstreamLogId});
  if(caller.id!==actor.id||caller.ownerId!==actor.ownerId)
   throw Error('MCP audit caller changed');
  const saved=await client.query(`INSERT INTO hub_upstream_oauth_read_audit
   (owner_id,caller_family,connection_id,service_name,tool_name,
    correlation_id,phase,outcome,upstream_log_id)
   SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9
   FROM hub_upstream_oauth_connections c
   JOIN hub_oauth_sessions s ON s.owner_id=c.owner_id
    AND s.family_id=c.caller_family
   WHERE c.id=$3 AND c.owner_id=$1 AND c.caller_family=$2
    AND c.service_name=$4 AND c.revoked_at IS NULL
    AND s.id=$10 AND s.revoked_at IS NULL
    AND s.access_expires_at>now() AND s.refresh_expires_at>now()
   RETURNING id`,[actor.ownerId,c.family,grantId,service,tool,
   correlationId,phase,outcome,upstreamLogId,actor.id]);
  if(saved.rows.length!==1)throw Error('Durable OAuth read audit unavailable');
  return saved.rows[0].id;
 };
 return {list:targets,resolve,search,describe,read,audit};
}
