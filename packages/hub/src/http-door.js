import {brokerCatalog,runBroker} from './broker.js';
import {runFederatedBroker} from './federation.js';
export {brokerCatalog} from './broker.js';
const supported=new Set(['2025-11-25','2025-06-18','2025-03-26']);
export function mcpReply(request,actor) {
  const id=request?.id??null;
  const base={jsonrpc:'2.0',id};
  if (!request || request.jsonrpc!=='2.0' || typeof request.method!=='string' ||
    (request.id!==undefined && (typeof request.id!=='number' &&
    typeof request.id!=='string' || !String(request.id).length)))
    return {...base,error:{code:-32600,message:'Invalid request'}};
  if (request.method==='notifications/initialized') return null;
  if (request.method==='initialize') {
    if (typeof request.params?.protocolVersion!=='string' ||
      !supported.has(request.params.protocolVersion))
      return {...base,error:{code:-32602,message:'Unsupported protocol version'}};
    return {...base,result:{protocolVersion:request.params.protocolVersion,
      capabilities:{tools:{listChanged:false}},
      serverInfo:{name:'robinsons-toolkit-hub',version:'0.1.0'}}};
  }
  if (request.method==='ping') return {...base,result:{}};
  if (request.method==='tools/list') {
    if(request.params && (typeof request.params!=='object'||Array.isArray(request.params)||
      Object.keys(request.params).some(k=>k!=='cursor')))
      return {...base,error:{code:-32602,message:'Invalid listing'}};
    if(request.params?.cursor) return {...base,error:{code:-32602,message:'Unknown cursor'}};
    return {...base,result:{tools:brokerCatalog()}};
  }
  if (request.method!=='tools/call') return {...base,error:{code:-32601,message:'Method not found'}};
  if (!request.params || typeof request.params.name!=='string' ||
    (request.params.arguments!==undefined && (!request.params.arguments ||
      typeof request.params.arguments!=='object'||Array.isArray(request.params.arguments))))
    return {...base,error:{code:-32602,message:'Invalid tool arguments'}};
  const value=runBroker(request.params.name,request.params.arguments??{},actor);
  if(!value.ok) return {...base,error:{code:-32602,message:value.error.what}};
  const json=JSON.stringify(value.result);
  if(Buffer.byteLength(json)>8192)
    return {...base,error:{code:-32603,message:'Result exceeds safe bound'}};
  return {...base,result:{content:[{type:'text',text:json}],
    structuredContent:value.result,isError:false}};
}

const federatedMetadata=new Set(['hub_health','hub_search_tools','hub_describe_tool','hub_namespaces','hub_call','hub_batch','hub_recent_changes']);
// Maintain the synchronous foundation for existing Hub-owned reads and
// transport validation. Only three explicit metadata operations opt into
// separately scoped, asynchronous RTC discovery; execution remains disabled.
export async function mcpFederatedReply(request,actor,db,settings,deps={}) {
 const baseline=mcpReply(request,actor);
 if(request?.jsonrpc!=='2.0'||request.method!=='tools/call'||
   !request.params||!federatedMetadata.has(request.params.name)||
   (request.id!==undefined&&(typeof request.id!=='string'&&typeof request.id!=='number'||
     !String(request.id).length))||
   request.params.arguments!==undefined&&(!request.params.arguments||
     typeof request.params.arguments!=='object'||
     Array.isArray(request.params.arguments)))
   return baseline;
 const base={jsonrpc:'2.0',id:request.id??null};
 try {
  const state=await runFederatedBroker(request.params.name,
    request.params.arguments??{},actor,db,settings,deps);
  if(!state.ok)return {...base,error:{code:-32602,
    message:state.error.what||'RTC metadata refused'}};
  const serialized=JSON.stringify(state.result);
  if(typeof serialized!=='string'||Buffer.byteLength(serialized,'utf8')>8192)
   return {...base,error:{code:-32603,message:'Result exceeds safe bound'}};
  return {...base,result:{content:[{type:'text',text:serialized}],
   structuredContent:state.result,isError:false}};
 }catch {
  return {...base,error:{code:-32603,message:'RTC metadata temporarily unavailable'}};
 }
}

export async function handleMcp(req,res,{withDb,authorize,
  federate=mcpFederatedReply}) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method!=='POST') {
    res.setHeader('Allow','POST');
    return res.status(405).json({error:'method_not_allowed'});
  }
  const body=req.body;
  if (!body || typeof body!=='object' || Array.isArray(body) ||
    Object.getPrototypeOf(body)!==Object.prototype) return res.status(400).json({error:'invalid_request'});
  let size;
  try { size=Buffer.byteLength(JSON.stringify(body),'utf8'); }
  catch { return res.status(400).json({error:'invalid_request'}); }
  if (size>16384) return res.status(413).json({error:'too_large'});
  try {
    return await withDb(async(db,settings)=>{
      const state=await authorize(db,settings,req.headers.authorization,'mcp');
      if (!state) {
        const origin=process.env.HUB_PUBLIC_ORIGIN;
        if (typeof origin==='string' && /^https:\/\/[A-Za-z0-9.-]+(?::443)?$/.test(origin))
          res.setHeader('WWW-Authenticate',
            'Bearer resource_metadata="'+origin+'/.well-known/oauth-protected-resource"');
        else res.setHeader('WWW-Authenticate','Bearer');
        return res.status(401).json({error:'unauthorized'});
      }
      if (state.retryAfter) {
        res.setHeader('Retry-After',String(state.retryAfter));
        return res.status(429).json({error:'rate_limited'});
      }
      if (!state.actor || state.actor.mode!=='test' ||
        !Array.isArray(state.actor.areas) || !state.actor.areas.includes('gateway') ||
        state.actor.allowWrites===true)
        return res.status(403).json({error:'outside_scope'});
      const reply=await federate(body,state.actor,db,settings);
      if (!reply) return res.status(202).end();
      return res.status(200).json(reply);
    });
  } catch { return res.status(503).json({error:'hub_unavailable'}); }
}
