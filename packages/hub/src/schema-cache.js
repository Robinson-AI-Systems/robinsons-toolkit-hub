import {createHmac} from 'node:crypto';
import {ownsRtcToolName} from './rtc-prefix.js';

// The schema cache is strictly a DESCRIBE optimization, never an execution
// authorization. Every hub_call re-fetches readOnlyHint and schema through
// the original pinned RTC transport before dispatching a POST.
const maxEntries=32, maxBytes=192*1024, maxOne=16*1024, ttlMs=15000;
const toolName=/^[a-z][a-z0-9_]{2,119}$/;
const areaName=/^[a-z][a-z0-9_]{0,59}$/;
function plain(o) {
 return o!==null&&typeof o==='object'&&!Array.isArray(o)&&
  Object.getPrototypeOf(o)===Object.prototype;
}
function scopedSchema(schema,name,grant) {
 if(!plain(schema)||!toolName.test(name)||schema.name!==name||
   !ownsRtcToolName(grant.prefix,name)||!areaName.test(schema.area??'')||
   !grant.areas.includes(schema.area)||
   typeof schema.description!=='string'||schema.description.length>160||
   schema.writes!==false||schema.money!==false||schema.destructive!==false||
   schema.annotations?.readOnlyHint!==true||
   !Array.isArray(schema.profiles)||
   schema.profiles.length!==1||schema.profiles[0]!==grant.profile||
   !plain(schema.inputSchema))
  throw new Error('RTC read-only describe schema refused');
 // Rebuild a safe read-only view rather than caching arbitrary upstream
 // properties, credentials, output blobs or unconstrained annotations.
 const safe={name,description:schema.description,area:schema.area,
  profiles:[grant.profile],writes:false,money:false,destructive:false,
  annotations:{readOnlyHint:true},inputSchema:schema.inputSchema};
 let serialized;
 try {serialized=JSON.stringify(safe);}
 catch {throw new Error('RTC read schema could not be serialized');}
 if(typeof serialized!=='string'||Buffer.byteLength(serialized,'utf8')>maxOne)
  throw new Error('RTC read schema exceeds cache/read bound');
 return serialized;
}
function scopeKey(actor,target,grant,name,settings) {
 const pepper=settings?.pepper;
 if(typeof pepper!=='string'||pepper.length<32||!actor?.ownerId||
   !actor.id||!target?.name||!grant?.grantId||
   !grant.origin||!grant.prefix||!Array.isArray(grant.areas)||
   !Array.isArray(actor.areas)||!toolName.test(name))
  throw new Error('RTC describe cache unavailable');
 return createHmac('sha256',pepper).update(JSON.stringify([
  'rtc-describe-cache-v1',actor.ownerId,actor.id,actor.clientId??null,
  actor.mode,actor.profile,actor.allowWrites,actor.areas,
  name,target.name,target.prefix,target.origin??null,
  target.verifiedAt??null,target.grantId??null,
  grant.grantId,grant.server,grant.origin,grant.prefix,
  grant.profile,grant.mode,grant.areas])).digest('hex');
}
/**
 * Memory-only, short-lived, owner/caller/grant/verified-endpoint-bound
 * schema descriptions. Failed and incomplete results are never cached.
 * Only caller-facing hub_describe_tool uses this cache; provider POST
 * authorization always performs a new pinned schema request.
 */
export function createSchemaCache() {
 const entries=new Map(),inflight=new Map();
 let bytes=0;
 const remove=k=>{
  const entry=entries.get(k);
  if(entry){entries.delete(k);bytes-=entry.bytes;}
 };
 const expired=time=>{
  for(const [key,value] of entries)
   if(value.expiresAt<=time)remove(key);
 };
 const trim=()=>{
  while(entries.size>maxEntries||bytes>maxBytes)
   remove(entries.keys().next().value);
 };
 return {
  async describe({actor,target,grant,name,settings},fetch,{now=Date.now}={}) {
   if(typeof fetch!=='function')throw new TypeError('Missing RTC describe fetch');
   const key=scopeKey(actor,target,grant,name,settings);
   const started=now();
   if(!Number.isSafeInteger(started))
    throw new Error('Invalid RTC describe cache clock');
   expired(started);
   const hit=entries.get(key);
   if(hit) {
    entries.delete(key);entries.set(key,hit);
    // Return independent objects: no shared mutable schema across callers.
    return JSON.parse(hit.serialized);
   }
   // Concurrent identical, already-grant-scoped DESCRIBE calls share one
   // pinned GET, but callers independently reauthorize after awaiting it.
   // Never single-flight a POST or any other execution side effect.
   if(inflight.has(key))return JSON.parse(await inflight.get(key));
   const work=(async()=>{
    const fetched=await fetch();
    const serialized=scopedSchema(fetched,name,grant);
    const finished=now();
    if(!Number.isSafeInteger(finished))
     throw new Error('Invalid RTC describe cache clock');
    expired(finished);
    remove(key);
    entries.set(key,{serialized,bytes:Buffer.byteLength(serialized,'utf8'),
     expiresAt:finished+ttlMs});
    bytes+=Buffer.byteLength(serialized,'utf8');
    trim();
    return serialized;
   })();
   if(inflight.size<maxEntries)inflight.set(key,work);
   try{return JSON.parse(await work);}
   finally{if(inflight.get(key)===work)inflight.delete(key);}
  },
  clear(){entries.clear();bytes=0;},
  stats(){return {entries:entries.size,bytes};}
 };
}
export const scopedSchemaCache=createSchemaCache();
