import {createHmac} from 'node:crypto';
import {validProviderPage} from './provider-cursor.js';

// RTC metadata listing cache. Only sanitized read-only tool summaries from
// the pinned GET implementation are eligible. Cached data is never enough
// to authorize a request: the federation broker independently resolves the
// current exact caller grant both before and after every cache lookup.
// Executable schemas and POST eligibility are intentionally NEVER cached.
const ttlMs=15000;
const maxEntries=64;
const maxBytes=131072;
const maxEntryBytes=8192;
function validReadResult(value) {
 return value&&typeof value==='object'&&!Array.isArray(value)&&
  Array.isArray(value.tools)&&value.tools.length<=20&&
  value.tools.every(tool=>tool&&typeof tool==='object'&&
   !Array.isArray(tool)&&typeof tool.name==='string'&&
   tool.writes===false&&tool.money===false&&tool.destructive===false&&
   tool.annotations?.readOnlyHint===true)&&
  (value.next===null||value.next===undefined||validProviderPage(value.next));
}
function digest(actor,target,grant,params,settings) {
 const pepper=settings?.pepper;
 if(typeof pepper!=='string'||pepper.length<32)
  throw new Error('Hub catalogue cache identity unavailable');
 if(!actor?.ownerId||!actor.id||!grant?.grantId||
  !target?.name||!grant.origin||!grant.prefix||
  !Array.isArray(grant.areas)||!Array.isArray(actor.areas))
  throw new Error('Hub catalogue cache scope unavailable');
 // Never store actor IDs, sealed passes, upstream query selectors or
 // host addresses as plaintext Map keys. HMAC also domain-separates this
 // from the Hub's distinct search/provider/fleet cursor secrets.
 const binding=['rtc-read-catalogue-v1',
  actor.ownerId,actor.id,actor.clientId??'',actor.mode,actor.profile,
  actor.areas,actor.allowWrites,grant.grantId,grant.server,grant.prefix,
  grant.origin,grant.mode,grant.profile,grant.areas,
  target.verifiedAt??null,target.grantId??null,
  params.query,params.area??null,params.limit,
  params.cursor?.kind??null,params.cursor?.value??null];
 return createHmac('sha256',pepper).update(JSON.stringify(binding))
  .digest('hex');
}
/** A tiny bounded in-process LRU; no SQL/Redis, secrets, process timers or retries. */
export function createCatalogueCache() {
 const entries=new Map();
 let bytes=0;
 function drop(key) {
  const item=entries.get(key);
  if(!item)return;
  entries.delete(key);
  bytes-=item.bytes;
 }
 function expire(time) {
  for(const [key,value] of entries)
   if(value.expires<=time)drop(key);
 }
 function trim() {
  while(entries.size>maxEntries||bytes>maxBytes) {
   const oldest=entries.keys().next().value;
   if(oldest===undefined)break;
   drop(oldest);
  }
 }
 return {
  /** Callers must still reauthorize the current grant after this returns. */
  async getOrFetch(actor,target,grant,params,settings,fetch,{now=Date.now}={}) {
   if(typeof fetch!=='function')throw new TypeError('Missing RTC metadata fetch');
   const key=digest(actor,target,grant,params,settings);
   const time=now();
   if(!Number.isFinite(time))throw new TypeError('Invalid cache clock');
   expire(time);
   const existing=entries.get(key);
   if(existing) {
    // Move the entry to the tail without extending TTL.
    entries.delete(key);entries.set(key,existing);
    return JSON.parse(existing.serialized);
   }
   // Never cache failures, promise results, unvalidated or overlarge data.
   // Concurrent callers may both make the same independent safe GET;
   // no provider mutation or uncertain POST can be retried here.
   const outcome=await fetch();
   if(!validReadResult(outcome))return outcome;
   let serialized;
   try {serialized=JSON.stringify(outcome);}catch{return outcome;}
   if(typeof serialized!=='string')return outcome;
   const size=Buffer.byteLength(serialized,'utf8');
   if(size>maxEntryBytes||size>maxBytes)return outcome;
   // In case a slow GET finishes after the TTL window, set expiry from
   // completion, not invocation; each request still checks its live grant.
   const expiresAt=now();
   if(!Number.isFinite(expiresAt))return outcome;
   expire(expiresAt);
   drop(key);
   entries.set(key,{serialized,expires:expiresAt+ttlMs,bytes:size});
   bytes+=size;
   trim();
   return JSON.parse(serialized);
  },
  /** Explicit invalidation is useful when a caller's current roster changed. */
  clear() {entries.clear();bytes=0;},
  stats() {return {entries:entries.size,bytes};}
 };
}
export const scopedCatalogueCache=createCatalogueCache();
