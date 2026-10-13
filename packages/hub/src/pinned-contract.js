import {lookup as systemLookup} from 'node:dns';
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';
import {validateStagedOrigin} from './registry.js';

// Restrict first-stage RTC validation to globally routed IPv4; IPv6-only
// services remain pending rather than risking ambiguous address classifiers.
export function publicIpv4(address) {
  if (isIP(address)!==4) return false;
  const [a,b,c,d]=address.split('.').map(Number);
  if (!Number.isInteger(d)||a===0||a===10||a===127||a>=224||
    (a===100&&b>=64&&b<=127)||
    (a===169&&b===254)||
    (a===172&&b>=16&&b<=31)||
    (a===192&&(b===0||(b===88&&c===99)||(b===168)))||
    (a===198&&((b===18||b===19)||(b===51&&c===100)))||
    (a===203&&b===0&&c===113)) return false;
  return true;
}

export function choosePublicIpv4(answers) {
  if (!Array.isArray(answers)||!answers.length||answers.length>32||
    answers.some(a=>!a||a.family!==4||!publicIpv4(a.address)))
    throw new Error('RTC DNS origin refused');
  return answers[0].address;
}

function assertManifest(manifest,{name,prefix}) {
  if (!manifest || typeof manifest!=='object'||Array.isArray(manifest)||
    manifest.rtc!==1||manifest.server!==name||manifest.prefix!==prefix||
    !Array.isArray(manifest.modes)||!manifest.modes.includes('test')||
    !Array.isArray(manifest.profiles)||!manifest.profiles.includes('read_only')||
    !manifest.counts||!['tools','writes','money'].every(k=>
      Number.isSafeInteger(manifest.counts[k])&&manifest.counts[k]>=0&&
      manifest.counts[k]<=1000000))
    throw new Error('RTC 1 manifest identity or scope mismatch');
  return {server:name,prefix,rtc:1,tools:manifest.counts.tools,
    writes:manifest.counts.writes,money:manifest.counts.money,
    mode:'test',profile:'read_only',networkVerified:true,callable:false};
}

// This probe neither activates a registry row nor forwards an upstream pass.
// Node HTTPS retains the hostname for TLS SNI/certificate verification, while
// this one request resolves and pins its connect address through lookup.
// agent:false prevents pooled socket reuse; no redirects or proxies are used.
export async function probeStagedRtcContract(origin,identity,
  {lookup=systemLookup,request=httpsRequest}={}) {
  validateStagedOrigin(origin);
  if (!identity||!/^[a-z][a-z0-9_]{1,59}$/.test(identity.name||'')||
    !/^[a-z][a-z0-9_]{1,59}$/.test(identity.prefix||''))
    throw new TypeError('Invalid expected RTC service identity');
  const hostname=new URL(origin).hostname;
  const manifest=await new Promise((resolve,reject)=>{
    let complete=false;
    const fail=message=>{
      if (!complete) {complete=true;reject(new Error(message));}
    };
    let req;
    try {
      req=request({protocol:'https:',hostname,port:443,method:'GET',
        path:'/api/contract',agent:false,rejectUnauthorized:true,
        headers:{accept:'application/json'},
        lookup:(asked,_options,callback)=>{
          if(asked!==hostname) return callback(new Error('Unexpected RTC hostname'));
          // DNS is resolved in the socket's connection lookup, not as an
          // earlier preflight whose answer could be swapped by rebinding.
          lookup(asked,{all:true,family:4},(err,answers)=>{
            if(err) return callback(new Error('RTC DNS unavailable'));
            try { callback(null,choosePublicIpv4(answers),4); }
            catch { callback(new Error('RTC DNS origin refused')); }
          });
        }
      },response=>{
        const mime=String(response.headers?.['content-type']||'');
        if(response.statusCode!==200||!/^application\/json(?:\s*;|$)/i.test(mime)) {
          response.resume();
          return fail('RTC contract response refused');
        }
        const chunks=[];
        let total=0;
        response.on('data',chunk=>{
          if(complete) return;
          total+=chunk.length;
          if(total>16384) {
            fail('RTC manifest exceeds byte limit');
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        response.on('error',()=>fail('RTC contract transport failed'));
        response.on('end',()=>{
          if(complete) return;
          try {complete=true;resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
          catch {fail('Invalid RTC JSON manifest');}
        });
      });
      req.setTimeout(5000,()=>{fail('RTC contract timeout');req.destroy();});
      req.on('error',()=>fail('RTC contract connection failed'));
      req.end();
    } catch {fail('RTC contract connection failed');}
  });
  return assertManifest(manifest,identity);
}
