// C-1: independently delegated write plane; never reuse the read-only H-3
// call or the Hub bearer as a provider credential. This is ONLY invoked by
// explicitly authorized workflow operations, not arbitrary provider names.
import {createHash} from 'node:crypto';
import {lookup as systemLookup} from 'node:dns';
import {request as httpsRequest} from 'node:https';
import {resolveDelegatedWriteGrant} from './grants.js';
import {pinnedRtcJsonGet,pinnedRtcSocketLookup} from './pinned-contract.js';
import {validateStagedOrigin} from './registry.js';
import {ownsRtcToolName} from './rtc-prefix.js';

const tool=/^[a-z][a-z0-9_]{2,119}$/;
const plain=value=>value!==null&&typeof value==='object'&&
 !Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const sha=value=>createHash('sha256').update(value).digest('hex');
const bad=()=>{throw new Error('Provider authorization or result unavailable');};
function metadata(info,grant,name){
 if(!plain(info)||info.ok!==true||!plain(info.result))return bad();
 const t=info.result;
 if(t.name!==name||!ownsRtcToolName(grant.prefix,name)||
  typeof t.area!=='string'||!grant.areas.includes(t.area)||
  !Array.isArray(t.profiles)||!t.profiles.includes(grant.profile)||
  t.writes!==true||!plain(t.inputSchema)||
  t.annotations?.readOnlyHint===true)return bad();
 return t;
}
// Socket-pinned HTTPS POST. No redirects, agent pooling, proxy, or retry.
// An ambiguous failure is ALWAYS reported to the workflow as unknown.
export async function pinnedRtcWriteCall(target,name,args,{
 lookup=systemLookup,request=httpsRequest,timeoutMs=5000}={}){
 if(!target||!tool.test(name||'')||
   !ownsRtcToolName(target.prefix,name)||
   !['everyday','full'].includes(target.profile)||
   !['test','live'].includes(target.mode)||target.allowWrites!==true||
   !/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(target.pass||'')||
   !plain(args)||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000)bad();
 const origin=validateStagedOrigin(target.origin);
 const text=JSON.stringify(args);
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>8192)bad();
 const hostname=new URL(origin).hostname;
 return new Promise((resolve,reject)=>{
  let settled=false,req;
  const rejectUnknown=()=>{if(!settled){settled=true;reject(new Error('RTC POST outcome unknown, do not retry'));}};
  try{
   req=request({protocol:'https:',hostname,port:443,method:'POST',
    path:'/api/tools/'+name,agent:false,rejectUnauthorized:true,
    signal:AbortSignal.timeout(timeoutMs),lookup:pinnedRtcSocketLookup(hostname,lookup),
    headers:{accept:'application/json','content-type':'application/json',
      authorization:'Bearer '+target.pass,'content-length':Buffer.byteLength(text,'utf8')}},
   res=>{
    const mime=String(res.headers?.['content-type']||'');
    if(![200,400,401,403,404,409,422,429].includes(res.statusCode)||
       !/^application\\/json(?:\\s*;|$)/i.test(mime)){
      res.resume();return rejectUnknown();
    }
    const pieces=[];let length=0;
    res.on('data',chunk=>{
     if(settled)return;
     length+=chunk.length;
     if(length>70000){rejectUnknown();req.destroy();return;}
     pieces.push(chunk);
    });
    res.on('error',rejectUnknown);
    res.on('end',()=>{
     if(settled)return;
     try{
      const body=JSON.parse(Buffer.concat(pieces).toString('utf8'));
      if(!plain(body)||typeof body.ok!=='boolean'||
       (body.ok===true&&!Object.hasOwn(body,'result'))||
       (res.statusCode!==200&&body.ok!==false))return rejectUnknown();
      settled=true;resolve(body);
     }catch{rejectUnknown();}
    });
   });
   req.setTimeout(timeoutMs,()=>{rejectUnknown();req.destroy();});
   req.on('error',rejectUnknown);
   req.end(text);
  }catch{rejectUnknown();}
 });
}
// The same scope query runs on planning and before every effect, including
// inverses. A read-only issuer grant can never be relabelled as a write grant.
export function createWorkflowRtcAdapter(db,settings,{
 resolve=resolveDelegatedWriteGrant,describe=pinnedRtcJsonGet,
 post=pinnedRtcWriteCall}={}){
 async function allowed(actor,server,name){
  if(!tool.test(name||''))bad();
  const grant=await resolve(db,{actor,serverName:server},settings);
  if(!grant||grant.allowWrites!==true||!ownsRtcToolName(grant.prefix,name))bad();
  const response=await describe(grant.origin,'/api/tools/'+name,{pass:grant.pass});
  metadata(response,grant,name);
  return grant;
 }
 return {
  async authorize({actor,server,tool:name}){
   const grant=await allowed(actor,server,name);
   return {allowed:true,canWrite:true,grantId:grant.grantId,
    ownerId:actor.ownerId,callerId:actor.id,
    callerKind:actor.kind,server,mode:grant.mode,profile:grant.profile,
    areasDigest:sha(JSON.stringify([...grant.areas].sort()))};
  },
  async invoke({actor,server,tool:name,args,phase}){
   const grant=await allowed(actor,server,name);
   if(!plain(args)||args.dryRun!==(phase==='preview')||
      args.confirm!==(phase!=='preview'))bad();
   const response=await post(grant,name,args);
   // Never treat provider refusal as a confirmed effect, and never claim
   // success from HTTP 200 alone or invent an undo. The provider supplies
   // explicit evidence and its own inverse metadata.
   if(response?.ok===false){
    if(phase==='preview')bad();
    return {done:false,confirmed:false,summary:'Provider refused the operation'};
   }
   if(!plain(response?.result))bad();
   const result=response.result;
   if(phase==='preview'){
    if(result.done!==false||typeof result.summary!=='string')bad();
    return {done:false,summary:result.summary,
      needsConfirmation:result.needsConfirmation===true};
   }
   if(result.done!==true||result.confirmed!==true)bad();
   return {done:true,confirmed:true,summary:result.summary,
    logged:result.logged,inverse:result.inverse,
    irreversible:result.irreversible===true,money:result.money===true};
  }
 };
}
