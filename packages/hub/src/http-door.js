const meta=Object.freeze([
  {name:'hub_whoami',description:'Read authenticated Toolkit Hub connection identity',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
  {name:'hub_health',description:'Read Toolkit Hub foundation and federation readiness',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}
]);
export function brokerCatalog() { return meta; }
export function mcpReply(request,actor) {
  const id=request?.id??null;
  const base={jsonrpc:'2.0',id};
  if (!request || request.jsonrpc!=='2.0' || typeof request.method!=='string')
    return {...base,error:{code:-32600,message:'Invalid request'}};
  if (request.method==='notifications/initialized') return null;
  if (request.method==='initialize') {
    if (typeof request.params?.protocolVersion!=='string')
      return {...base,error:{code:-32602,message:'Invalid initialization'}};
    return {...base,result:{protocolVersion:'2025-03-26',
      capabilities:{tools:{listChanged:false}},serverInfo:{name:'robinsons-toolkit-hub',version:'0.1.0'}}};
  }
  if (request.method==='ping') return {...base,result:{}};
  if (request.method==='tools/list') return {...base,result:{tools:meta}};
  if (request.method!=='tools/call') return {...base,error:{code:-32601,message:'Method not found'}};
  if (request.params?.name!=='hub_whoami' && request.params?.name!=='hub_health')
    return {...base,error:{code:-32602,message:'Unknown tool'}};
  if (request.params?.arguments && (typeof request.params.arguments!=='object' ||
      Array.isArray(request.params.arguments) || Object.keys(request.params.arguments).length!==0))
    return {...base,error:{code:-32602,message:'Invalid tool arguments'}};
  const result=request.params.name==='hub_whoami' ?
    {profile:actor.profile,mode:actor.mode,areas:actor.areas,allowWrites:false} :
    {foundation:'ready',federation:'not_configured',providerCallsEnabled:false};
  return {...base,result:{content:[{type:'text',text:JSON.stringify(result)}],
    structuredContent:result,isError:false}};
}
export async function handleMcp(req,res,{withDb,authorize}) {
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
      if (!state) return res.status(401).json({error:'unauthorized'});
      if (state.retryAfter) {
        res.setHeader('Retry-After',String(state.retryAfter));
        return res.status(429).json({error:'rate_limited'});
      }
      const reply=mcpReply(body,state.actor);
      if (!reply) return res.status(202).end();
      return res.status(200).json(reply);
    });
  } catch { return res.status(503).json({error:'hub_unavailable'}); }
}
