// Outbound-only, bounded, DNS-pinned HTTPS for a Hub-owned MCP OAuth client.
// This deliberately does not reuse or forward an inbound Hub token.
import {lookup as systemLookup} from 'node:dns';
import {request as systemRequest} from 'node:https';
import {pinnedRtcSocketLookup} from './pinned-contract.js';
import {validateStagedOrigin} from './registry.js';

export function checkedRemoteUrl(value,origin=null) {
 if(typeof value!=='string'||value.length>700)throw new TypeError('Invalid MCP HTTPS URL');
 let url;try{url=new URL(value);}catch{throw new TypeError('Invalid MCP HTTPS URL');}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port||
    !url.pathname.startsWith('/')||url.pathname.length>400||
    /[\\\x00-\x1f]/.test(url.pathname+url.search)||url.search.length>120)
   throw new TypeError('Unsafe MCP endpoint URL');
 validateStagedOrigin(url.origin);
 if(origin!==null&&url.origin!==origin)throw new TypeError('MCP origin mismatch');
 return url;
}
function decoded(content,ctype) {
 if(/^application\/json(?:\s*;|$)/i.test(ctype))return JSON.parse(content);
 if(/^text\/event-stream(?:\s*;|$)/i.test(ctype)) {
  const entries=content.split(/\r?\n\r?\n/);
  for(const entry of entries){
   const data=entry.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('');
   if(data&&data!=='[DONE]')return JSON.parse(data);
  }
 }
 throw new Error('MCP response content type refused');
}
export async function pinnedMcpRequest(url,{method='GET',body=null,
 bearer=null,headers={},timeoutMs=5000,maxBytes=65536,
 request=systemRequest,lookup=systemLookup}={}) {
 const parsed=checkedRemoteUrl(url);
 if(!['GET','POST'].includes(method)||!Number.isInteger(timeoutMs)||timeoutMs<1||
   timeoutMs>10000||!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>65536||
   (bearer!==null&&(typeof bearer!=='string'||!bearer.length||bearer.length>4096||
    /[\r\n]/.test(bearer))))throw new TypeError('Invalid MCP outbound request');
 const data=body===null?null:typeof body==='string'?body:JSON.stringify(body);
 if(data!==null&&(method!=='POST'||Buffer.byteLength(data)>16384))
  throw new TypeError('Invalid MCP outbound body');
 const custom={};
 for(const [k,v]of Object.entries(headers)) {
  if(!['content-type','accept','mcp-protocol-version'].includes(k.toLowerCase())||
    typeof v!=='string'||v.length>160||/[\r\n]/.test(v))
   throw new TypeError('Unsupported MCP outbound header');
  custom[k.toLowerCase()]=v;
 }
 return await new Promise((resolve,reject)=>{
  let done=false,req;
  const fail=(error)=>{if(!done){done=true;reject(error);}};
  try{
   req=request({protocol:'https:',hostname:parsed.hostname,port:443,
    method,path:parsed.pathname+parsed.search,agent:false,rejectUnauthorized:true,
    lookup:pinnedRtcSocketLookup(parsed.hostname,lookup),
    signal:AbortSignal.timeout(timeoutMs),
    headers:{accept:'application/json, text/event-stream',...(data===null?{}:{
      'content-type':'application/json','content-length':Buffer.byteLength(data)}),
      ...custom,...(bearer===null?{}:{authorization:'Bearer '+bearer})}
   },res=>{
    if(![200,201].includes(res.statusCode)){
      res.resume();return fail(new Error('Upstream MCP rejected request'));
    }
    const ctype=String(res.headers?.['content-type']||'');
    if(!/^(?:application\/json|text\/event-stream)(?:\s*;|$)/i.test(ctype)){
      res.resume();return fail(new Error('MCP response type refused'));
    }
    let size=0;const chunks=[];
    res.on('data',chunk=>{if(done)return;size+=chunk.length;
      if(size>maxBytes){fail(new Error('MCP response too large'));req.destroy();}
      else chunks.push(chunk);
    });
    res.on('error',()=>fail(new Error('MCP response interrupted')));
    res.on('end',()=>{if(done)return;try{
      const parsedBody=decoded(Buffer.concat(chunks).toString('utf8'),ctype);
      done=true;resolve(parsedBody);
    }catch{fail(new Error('Invalid MCP response'));}});
   });
   req.setTimeout(timeoutMs,()=>{fail(new Error('MCP timeout'));req.destroy();});
   req.on('error',()=>fail(new Error('MCP HTTPS transport failed')));
   req.end(data??undefined);
  }catch{fail(new Error('MCP HTTPS request refused'));}
 });
}
