import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {validProviderPage} from './provider-cursor.js';

// The fleet navigator keeps up to three selected-provider continuation
// positions. Its payload is encrypted: upstream pagination selectors are
// credentials-adjacent metadata and must not be copied into Hub responses.
// Search scope includes owner, exact caller, filters and the complete active
// grant/verified-origin roster. No upstream pass or Hub bearer is serialized.
const tokenPattern=/^f\.([A-Za-z0-9_-]{40,1278})$/;
const maxTokenBytes=1280;
const maxPending=3;
const maxServices=100;
export const maxFleetDepth=1000;

function sealKey(settings) {
 const pepper=settings?.pepper;
 if(typeof pepper!=='string'||pepper.length<32)
  throw new Error('Hub fleet cursor sealing unavailable');
 return createHash('sha256').update('hub-rtc-fleet-cursor-v1\0')
  .update(pepper).digest();
}
function validPending(entry,offset) {
 return entry&&typeof entry==='object'&&!Array.isArray(entry)&&
  Object.keys(entry).sort().join(',')==='d,i,n'&&
  Number.isInteger(entry.i)&&entry.i>=0&&entry.i<offset&&
  Number.isInteger(entry.d)&&entry.d>=1&&entry.d<=maxFleetDepth&&
  validProviderPage(entry.n);
}
function validState(state) {
 if(!state||typeof state!=='object'||Array.isArray(state)||
  Object.keys(state).sort().join(',')!=='o,p'||
  !Number.isInteger(state.o)||state.o<0||state.o>maxServices||
  !Array.isArray(state.p)||state.p.length>maxPending||
  state.p.some(p=>!validPending(p,state.o)))return false;
 const indices=state.p.map(p=>p.i);
 return new Set(indices).size===indices.length;
}
function boundScope(scope) {
 const value=JSON.stringify(scope);
 if(typeof value!=='string'||Buffer.byteLength(value,'utf8')>65536)
  throw new Error('Hub fleet search scope unavailable');
 return Buffer.from(value,'utf8');
}
function validLifetime(expiry,now) {
 const seconds=Math.floor(now()/1000);
 return Number.isInteger(expiry)&&expiry>seconds&&expiry<=seconds+300;
}
/** Issue an independently authenticated five-minute, caller-bound fleet step. */
export function issueFleetCursor(scope,state,settings,{now=Date.now}={}) {
 if(!validState(state)||state.o===0&&state.p.length===0)
  throw new TypeError('Invalid fleet continuation state');
 const payload=Buffer.from(JSON.stringify({v:1,e:Math.floor(now()/1000)+300,
  o:state.o,p:state.p}),'utf8');
 if(payload.length>900)throw new TypeError('Fleet continuation state exceeds bound');
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',sealKey(settings),nonce);
 cipher.setAAD(boundScope(scope));
 const body=Buffer.concat([cipher.update(payload),cipher.final()]);
 const token='f.'+Buffer.concat([nonce,cipher.getAuthTag(),body]).toString('base64url');
 if(token.length>maxTokenBytes)
  throw new TypeError('Fleet continuation exceeds safe bound');
 return token;
}
/** No caller can alter a provider selector, roster, route or offset. */
export function openFleetCursor(token,scope,settings,{now=Date.now}={}) {
 if(typeof token!=='string'||token.length>maxTokenBytes)return null;
 const match=tokenPattern.exec(token);
 if(!match)return null;
 try {
  const data=Buffer.from(match[1],'base64url');
  if(data.toString('base64url')!==match[1]||data.length<40||
    data.length>950)return null;
  const decipher=createDecipheriv('aes-256-gcm',sealKey(settings),data.subarray(0,12));
  decipher.setAAD(boundScope(scope));
  decipher.setAuthTag(data.subarray(12,28));
  const decoded=Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]);
  if(decoded.length>900)return null;
  const state=JSON.parse(decoded.toString('utf8'));
  if(!state||Object.keys(state).sort().join(',')!=='e,o,p,v'||
    state.v!==1||!validLifetime(state.e,now)||
    !validState({o:state.o,p:state.p}))return null;
  return {o:state.o,p:state.p};
 }catch{return null;}
}
