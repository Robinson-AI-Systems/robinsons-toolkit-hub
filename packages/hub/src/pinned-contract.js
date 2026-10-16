import {serverNamePattern} from './server-name.js';
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

// Match the socket's requested Node DNS callback shape. Modern Node HTTPS
// asks for {all:true}; returning a scalar then fails before TLS (even with
// an otherwise valid public RTC origin). Every DNS answer is validated
// BEFORE one vetted IPv4 is selected. Never return an unvetted fallback.
export function pinnedRtcSocketLookup(hostname,dnsLookup=systemLookup) {
  return (asked,options,callback)=>{
    if(asked!==hostname) return callback(new Error('Unexpected RTC hostname'));
    dnsLookup(asked,{all:true,family:4},(err,answers)=>{
      if(err)return callback(new Error('RTC DNS unavailable'));
      try {
        const address=choosePublicIpv4(answers);
        if(options?.all===true) callback(null,[{address,family:4}]);
        else callback(null,address,4);
      }catch {callback(new Error('RTC DNS origin refused'));}
    });
  };
}

// Only the RTC read-only listing and exact-tool-schema doors may extend the
// original contract/whoami HTTPS allowlist; no user-supplied arbitrary path.
function safeToolReadRoute(route) {
  if(typeof route!=='string'||route.length>512||route.includes('#'))return false;
  if(/^\/api\/tools\/[a-z][a-z0-9_]{1,119}$/.test(route))return true;
  let parsed;
  try {parsed=new URL(route,'https://fixed.example.org');}
  catch {return false;}
  if(parsed.pathname!=='/api/tools'||!['','?'].includes(route.slice(10,11))||
    parsed.searchParams.size>4||parsed.username||parsed.password||
    parsed.origin!=='https://fixed.example.org')return false;
  for(const key of parsed.searchParams.keys())
    if(!['q','area','limit','cursor','page','offset'].includes(key)||
       parsed.searchParams.getAll(key).length!==1)
      return false;
  const q=parsed.searchParams.get('q'),area=parsed.searchParams.get('area'),
    limit=parsed.searchParams.get('limit'),cursor=parsed.searchParams.get('cursor'),
    page=parsed.searchParams.get('page'),offset=parsed.searchParams.get('offset');
  return (!q||q.length<=120)&&(!area||/^[a-z][a-z0-9_]{0,59}$/.test(area))&&
    (!limit||/^(?:[1-9]|1[0-9]|20)$/.test(limit))&&
    (!cursor||/^[A-Za-z0-9_.~-]{1,128}$/.test(cursor))&&
    (!page||/^[1-9][0-9]{0,5}$/.test(page)&&Number(page)<=100000)&&
    (!offset||/^[1-9][0-9]{0,5}$/.test(offset)&&Number(offset)<=100000)&&
    [cursor,page,offset].filter(value=>value!==null).length<=1;
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
export async function pinnedRtcJsonGet(origin,route,
  {pass,lookup=systemLookup,request=httpsRequest,timeoutMs=5000}={}) {
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000)
    throw new TypeError('Invalid pinned RTC metadata deadline');
  validateStagedOrigin(origin);
  if (!['/api/contract','/api/whoami'].includes(route) && !safeToolReadRoute(route) ||
    (route==='/api/contract' && pass!==undefined)||
    (route!=='/api/contract' && (typeof pass!=='string'||
      !/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(pass))))
    throw new TypeError('Invalid pinned RTC read request');
  const hostname=new URL(origin).hostname;
  const manifest=await new Promise((resolve,reject)=>{
    let complete=false;
    const fail=message=>{
      if (!complete) {complete=true;reject(new Error(message));}
    };
    let req;
    try {
      req=request({protocol:'https:',hostname,port:443,method:'GET',
        path:route,agent:false,rejectUnauthorized:true,
        signal:AbortSignal.timeout(timeoutMs),
        headers:{accept:'application/json',
          ...(pass===undefined?{}:{authorization:'Bearer '+pass})},
        lookup:pinnedRtcSocketLookup(hostname,lookup),response=>{
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
          if(total>(safeToolReadRoute(route)?65536:16384)) {
            fail('RTC manifest exceeds byte limit');
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        response.on('error',()=>fail('RTC contract transport failed'));
        response.on('end',()=>{
          if(complete) return;
          try {
            const decoded=JSON.parse(Buffer.concat(chunks).toString('utf8'));
            complete=true;
            resolve(decoded);
          } catch {fail('Invalid RTC JSON manifest');}
        });
      });
      req.setTimeout(timeoutMs,()=>{fail('RTC contract timeout');req.destroy();});
      req.on('error',()=>fail('RTC contract connection failed'));
      req.end();
    } catch {fail('RTC contract connection failed');}
  });
  return manifest;
}
export async function probeStagedRtcContract(origin,identity,transport={}) {
  if (!identity||!serverNamePattern.test(identity.name||'')||
    !/^[a-z][a-z0-9_]{1,59}$/.test(identity.prefix||''))
    throw new TypeError('Invalid expected RTC service identity');
  return assertManifest(await pinnedRtcJsonGet(origin,'/api/contract',transport),identity);
}
