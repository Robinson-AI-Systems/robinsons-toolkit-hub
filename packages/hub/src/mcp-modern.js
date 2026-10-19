// MCP 2026-07-28 stateless request adapter for the existing authenticated
// Hub broker. Preserve the three older handshake-based MCP versions unchanged.
const modern='2026-07-28';
const supported=Object.freeze([modern,'2025-11-25','2025-06-18','2025-03-26']);
const serverInfo=Object.freeze({name:'robinsons-toolkit-hub',
 title:"Robinson's Toolkit Hub by Robinson AI Systems",version:'0.1.0'});
const metaKey='io.modelcontextprotocol/';
const hasOwn=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 [Object.prototype,null].includes(Object.getPrototypeOf(x));
function jsonError(id,code,message,data){
 return {jsonrpc:'2.0',id:id??null,error:{code,message,...(data?{data}:{})}};
}
function reject(body,code,message,data){
 return {status:400,body:jsonError(body?.id,code,message,data)};
}
// Validate mirror headers BEFORE selecting an authenticated caller or routing
// any provider request. Modern clients provide all transport fields each POST.
export function checkModernMcp(body,headers={}){
 const meta=plain(body?.params)?body.params._meta:null;
 const requested=plain(meta)?meta[metaKey+'protocolVersion']:undefined;
 const header=headers['mcp-protocol-version'];
 const modernRequest=body?.method==='server/discover'||
   header===modern||requested===modern||
   typeof requested==='string'&&!supported.includes(requested)||
   typeof header==='string'&&!supported.includes(header);
 if(!modernRequest)return {modern:false};
 if(body?.jsonrpc!=='2.0'||!Number.isSafeInteger(body.id)&&
   (typeof body?.id!=='string'||!body.id)||
   typeof body.method!=='string')return {modern:true,
   ...reject(body,-32600,'Invalid JSON-RPC request')};
 if(typeof header!=='string'||typeof requested!=='string'||
   header!==requested)return {modern:true,
   ...reject(body,-32020,'MCP header mismatch')};
 if(!supported.includes(requested))
  return {modern:true,...reject(body,-32022,'Unsupported protocol version',
   {supported:[...supported],requested})};
 if(requested!==modern)
  return {modern:true,...reject(body,-32022,'Unsupported modern protocol version',
   {supported:[modern],requested})};
 if(!plain(meta)||!plain(meta[metaKey+'clientCapabilities']))
  return {modern:true,...reject(body,-32021,'Missing required client capabilities')};
 const accept=headers.accept;
 if(typeof accept!=='string'||!accept.includes('application/json')||
   !accept.includes('text/event-stream'))
  return {modern:true,...reject(body,-32600,'Invalid MCP Accept header')};
 if(headers['mcp-method']!==body.method)
  return {modern:true,...reject(body,-32020,'MCP header mismatch')};
 if(body.method==='tools/call'){
  if(!plain(body.params)||typeof body.params.name!=='string'||
     headers['mcp-name']!==body.params.name)
   return {modern:true,...reject(body,-32020,'MCP header mismatch')};
 }else if(hasOwn(headers,'mcp-name'))
  return {modern:true,...reject(body,-32020,'MCP header mismatch')};
 if(!plain(body.params)||typeof body.params._meta!=='object')
  return {modern:true,...reject(body,-32602,'Invalid MCP request metadata')};
 return {modern:true};
}
const responseMeta=()=>({[metaKey+'serverInfo']:{...serverInfo}});
const completed=(result,cache)=>({...result,resultType:'complete',
 ...(cache?{ttlMs:60000,cacheScope:'private'}:{}),
 _meta:{...(plain(result?._meta)?result._meta:{}),...responseMeta()}});
const reply=(id,result)=>({jsonrpc:'2.0',id,result});
export async function modernMcpReply(body,actor,db,settings,federate){
 if(body.method==='server/discover'){
  if(Object.keys(body.params||{}).some(k=>k!=='_meta'))
   return {status:200,body:jsonError(body.id,-32602,'Invalid discovery arguments')};
  return {status:200,body:reply(body.id,completed({
   supportedVersions:[...supported],capabilities:{tools:{listChanged:false}},
   instructions:'Discover and access independently authorized tools through one fixed Hub MCP menu.'
  },true))};
 }
 // Stateless core has no legacy initialize/ping/initialized notifications.
 if(!['tools/list','tools/call'].includes(body.method))
  return {status:404,body:jsonError(body.id,-32601,'Method not found')};
 const sanitized={...body,params:{...body.params}};
 delete sanitized.params._meta;
 const original=await federate(sanitized,actor,db,settings);
 if(!original)return {status:400,body:jsonError(body.id,-32600,'Unexpected notification')};
 if(original.error)return {status:original.error.code===-32601?404:200,
  body:original};
 return {status:200,body:reply(body.id,completed(original.result,
  body.method==='tools/list'))};
}
