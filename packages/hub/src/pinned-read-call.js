import {lookup as systemLookup} from 'node:dns';
import {request as httpsRequest} from 'node:https';
import {choosePublicIpv4} from './pinned-contract.js';
import {validateStagedOrigin} from './registry.js';
import {ownsRtcToolName} from './rtc-prefix.js';

const toolName=/^[a-z][a-z0-9_]{2,119}$/;
const passPattern=/^rtc_pass_[A-Za-z0-9_-]{43}$/;
function object(value) {
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Object.getPrototypeOf(value)===Object.prototype;
}
/** A single strictly bounded RTC POST, never retried: uncertain POST outcome stays uncertain. */
export async function pinnedRtcReadCall(target,name,args={},
  {lookup=systemLookup,request=httpsRequest}={}) {
 if(!target||typeof target.prefix!=='string'||
   !/^[a-z][a-z0-9_]{1,59}$/.test(target.prefix)||
   !toolName.test(name||'')||!ownsRtcToolName(target.prefix,name)||
   !passPattern.test(target.pass||'')||
   target.profile!=='read_only'||target.mode!=='test'||
   !object(args))throw new TypeError('Invalid scoped RTC read request');
 const origin=validateStagedOrigin(target.origin);
 let serialized;
 try {serialized=JSON.stringify(args);}catch{throw new TypeError('Invalid RTC arguments');}
 if(typeof serialized!=='string'||Buffer.byteLength(serialized,'utf8')>8192)
   throw new RangeError('RTC request exceeds safe bound');
 const hostname=new URL(origin).hostname;
 return await new Promise((resolve,reject)=>{
   let settled=false,req;
   const fail=()=>{if(!settled){settled=true;reject(new Error(
     'RTC read outcome unavailable; do not automatically retry POST'));}};
   try{
     req=request({protocol:'https:',hostname,port:443,method:'POST',
      path:'/api/tools/'+name,agent:false,rejectUnauthorized:true,
      signal:AbortSignal.timeout(5000),
      headers:{accept:'application/json','content-type':'application/json',
       authorization:'Bearer '+target.pass,
       'content-length':Buffer.byteLength(serialized,'utf8')},
      lookup:(requested,_opts,callback)=>{
       if(requested!==hostname)return callback(new Error('Invalid RTC DNS host'));
       lookup(requested,{all:true,family:4},(err,answers)=>{
        if(err)return callback(new Error('RTC DNS failed'));
        try{callback(null,choosePublicIpv4(answers),4);}
        catch{callback(new Error('RTC DNS origin refused'));}
       });
      }
     },res=>{
      const mime=String(res.headers?.['content-type']||'');
      if(![200,400,401,403,404,409,422,429].includes(res.statusCode)||
        !/^application\/json(?:\s*;|$)/i.test(mime)){
       res.resume();return fail();
      }
      const chunks=[];let bytes=0;
      res.on('data',buffer=>{
       if(settled)return;
       bytes+=buffer.length;
       // The Hub stores at most 64KiB of parsed JSON; allow bounded RTC envelope overhead.
       if(bytes>70000){fail();req.destroy();return;}
       chunks.push(buffer);
      });
      res.on('error',fail);
      res.on('end',()=>{
       if(settled)return;
       try{
        const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(!object(parsed)||typeof parsed.ok!=='boolean'||
          parsed.ok&&(!Object.hasOwn(parsed,'result'))||
          (res.statusCode!==200&&parsed.ok!==false))return fail();
        settled=true;resolve(parsed);
       }catch{fail();}
      });
     });
     req.setTimeout(5000,()=>{fail();req.destroy();});
     req.on('error',fail);
     req.end(serialized);
   }catch{fail();}
 });
}
