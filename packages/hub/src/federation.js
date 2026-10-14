import {runBroker} from './broker.js';
import {listEligibleRtcTargets,resolveActiveCallerGrant} from './grants.js';
import {searchPinnedRtcTools,describePinnedRtcTool} from './pinned-tools.js';
import {pinnedRtcReadCall} from './pinned-read-call.js';
import {appendRtcReadAudit,newRtcCorrelation} from './rtc-read-audit.js';
import {storeRtcResult,readRtcResult} from './rtc-results.js';
import {searchCursorScope,issueSearchCursor,openSearchCursor} from './search-cursor.js';
import {issueProviderCursor,openProviderCursor,validProviderPage} from './provider-cursor.js';
import {issueFleetCursor,openFleetCursor,maxFleetDepth} from './fleet-cursor.js';
import {scopedCatalogueCache} from './catalogue-cache.js';
import {scopedSchemaCache} from './schema-cache.js';
import {ownsRtcToolName} from './rtc-prefix.js';

const namePattern=/^[a-z][a-z0-9_]{2,119}$/;
const serverPattern=/^[a-z][a-z0-9_]{1,59}$/;
const areaPattern=/^[a-z][a-z0-9_]{0,59}$/;
const ownNames=new Set(['hub_whoami','hub_health']);
function ownerOfTool(targets,name) {
  // Registry enforces unique prefixes, not prefix-free names. Choose the
  // longest prefix followed by '_' so nested services route deterministically.
  const matches=targets.filter(target=>ownsRtcToolName(target.prefix,name));
  matches.sort((left,right)=>right.prefix.length-left.prefix.length);
  return matches[0]??null;
}
const fail=(code,what)=>({ok:false,error:{code,what}});
function sameGrant(before,after) {
 // Re-resolve after provider metadata GET: a revoked/replaced grant must not
 // publish stale tool names, descriptions, areas or schema to its old caller.
 return Boolean(after && before.grantId===after.grantId &&
  before.server===after.server && before.origin===after.origin &&
  before.prefix===after.prefix &&
  Array.isArray(before.areas) && Array.isArray(after.areas) &&
  before.areas.length===after.areas.length &&
  before.areas.every((a,i)=>a===after.areas[i]));
}
function plain(a) {
 return a&&typeof a==='object'&&!Array.isArray(a)&&
   Object.getPrototypeOf(a)===Object.prototype;
}
function eligible(actor) {
 return actor&&actor.mode==='test'&&actor.allowWrites!==true&&
   ['read_only','everyday','full'].includes(actor.profile)&&
   Array.isArray(actor.areas)&&actor.areas.includes('gateway');
}
// This is the selective metadata plane, not the POST execution/data plane.
// Search touches at most three upstreams per request; every target re-resolves
// its own sealed grant immediately before a socket-pinned request.
export async function runFederatedBroker(name,args,actor,db,settings,deps={}) {
 if(!eligible(actor))return fail('outside_scope','Hub TEST gateway access required');
 if(!plain(args))return fail('invalid_args','Invalid Hub arguments');
 const tools={
  list:listEligibleRtcTargets,resolve:resolveActiveCallerGrant,
  search:searchPinnedRtcTools,describe:describePinnedRtcTool,
  read:pinnedRtcReadCall,audit:appendRtcReadAudit,correlation:newRtcCorrelation,
  storeResult:storeRtcResult,readResult:readRtcResult,
  cache:scopedCatalogueCache,schemaCache:scopedSchemaCache,...deps};
 if(name==='hub_health') {
  if(Object.keys(args).length)return fail('invalid_args','Invalid Hub arguments');
  const targets=await tools.list(db,actor,{limit:100});
  return {ok:true,result:{foundation:'ready',
    federation:targets.length?'test_read_routing':'not_configured',
    providerCallsEnabled:targets.length>0,contractVersion:0,accessibleUpstreams:targets.length}};
 }
 if(name==='hub_namespaces') {
  if(Object.keys(args).some(k=>!['limit','cursor'].includes(k))||
    (args.limit!==undefined&&(!Number.isInteger(args.limit)||
      args.limit<1||args.limit>20))||
    (args.cursor!==undefined&&(typeof args.cursor!=='string'||args.cursor.length>160)))
    return fail('invalid_args','Invalid namespace page request');
  const targets=await tools.list(db,actor,{limit:100});
  const scope=searchCursorScope(actor,{query:'__namespaces__'},targets);
  let offset=0;
  if(args.cursor!==undefined) {
    try{offset=openSearchCursor(args.cursor,scope,settings);}
    catch{return fail('unavailable','Namespace continuation unavailable');}
    if(offset===null||offset>=targets.length)
      return fail('invalid_args','Namespace continuation invalid or expired');
  }
  const limit=args.limit??10,chosen=targets.slice(offset,offset+limit);
  const namespaces=[
   ...(offset===0?[{name:'hub',rtc:0,tools:2,mode:'test'}]:[]),
   ...chosen.map(t=>({name:t.name,prefix:t.prefix,rtc:1,mode:'test',
    claimedCounts:t.claimedCounts,readOnlyGrant:true}))];
  let next=null;
  if(offset+chosen.length<targets.length) {
    try{next=issueSearchCursor(scope,offset+chosen.length,settings);}
    catch{return fail('unavailable','Namespace continuation unavailable');}
  }
  if(Buffer.byteLength(JSON.stringify({namespaces,next}),'utf8')>7000)
    return fail('unavailable','Namespace metadata exceeds safe bound');
  return {ok:true,result:{namespaces,upstreamEnabled:targets.length>0,
    metadataOnly:true,authorizedTargets:targets.length,next}};
 }
 if(name==='hub_search_tools') {
  if(Object.keys(args).some(k=>!['query','area','server','limit','cursor'].includes(k))||
    typeof args.query!=='string'||args.query.length>120||
    (args.server!==undefined&&!serverPattern.test(args.server))||
    (args.area!==undefined&&!areaPattern.test(args.area))||
    (args.limit!==undefined&&(!Number.isInteger(args.limit)||
      args.limit<1||args.limit>20))||
    (args.cursor!==undefined&&(typeof args.cursor!=='string'||args.cursor.length>1280)))
    return fail('invalid_args','Invalid search parameters');
  const limit=args.limit??10;
  if(args.server==='hub')return runBroker('hub_search_tools',
    {query:args.query,limit},actor);
  const owned=args.cursor||args.server||args.area&&args.area!=='gateway'?[]:
    runBroker('hub_search_tools',{query:args.query,limit},actor).result.tools;
  const targets=await tools.list(db,actor,{limit:100});
  const matching=targets.filter(t=>(!args.server||t.name===args.server)&&
    (!args.area||t.areas.includes(args.area)));
  if(args.server&&!matching.length)return fail('not_found','No authorized RTC service');
  const scope=searchCursorScope(actor,args,matching);
  const focused=Boolean(args.server && matching.length===1);
  let offset=0,providerCursor=null,pending=[];
  if(args.cursor!==undefined) {
   try {
    if(focused)providerCursor=openProviderCursor(args.cursor,scope,settings);
    else if(args.cursor.startsWith('f.')) {
     const state=openFleetCursor(args.cursor,scope,settings);
     if(state){offset=state.o;pending=state.p;}
     else offset=null;
    } else offset=openSearchCursor(args.cursor,scope,settings);
   }catch{return fail('unavailable','RTC search continuation unavailable');}
   if((focused&&providerCursor===null)||
      (!focused&&(offset===null||offset>matching.length||
       offset===matching.length&&pending.length===0)))
    return fail('invalid_args','Search continuation invalid or expired');
  }
  // Each broad GET requests exactly one result per provider. This prevents
  // a page from silently discarding provider tools when the shared result
  // budget fills. The provider's real next selector is retained in a sealed
  // fleet step, while the roster advances by at most three origins per turn.
  const jobs=[];
  let nextPending=[];
  if(focused) jobs.push({index:0,depth:0,cursor:providerCursor});
  else {
   const capacity=Math.min(3,limit);
   const resumed=pending.slice(0,capacity);
   nextPending=pending.slice(capacity);
   for(const state of resumed)jobs.push({
    index:state.i,depth:state.d,cursor:state.n
   });
   while(jobs.length<capacity&&offset<matching.length) {
    jobs.push({index:offset,depth:0,cursor:null});
    offset++;
   }
  }
  const chosen=jobs.map(job=>matching[job.index]);
  const settled=await Promise.allSettled(jobs.map(async(job,i)=>{
   const target=chosen[i];
   if(args.area&&!target.areas.includes(args.area))
    return {tools:[],incomplete:false,next:null};
   const grant=await tools.resolve(db,{actor,serverName:target.name},settings);
   if(!grant)throw new Error('Grant unavailable');
   const request={query:args.query,area:args.area,
    limit:focused?Math.min(limit,10):1,
    ...(job.cursor!==null?{cursor:job.cursor}:{})};
   // Only the verified real pinned metadata provider uses the shared
   // in-process cache by default. Injected fake transports remain uncached
   // unless a test opts into an isolated cache. This is metadata-only;
   // executable tool schemas and POST are always fresh.
   const get=()=>tools.search(grant,request);
   const discovered=(tools.search===searchPinnedRtcTools||deps.cache)
    ?await tools.cache.getOrFetch(actor,target,grant,request,settings,get)
    :await get();
   // Never forward a fabricated page selector or malformed catalogue.
   if(!discovered||!Array.isArray(discovered.tools)||
      discovered.next!=null&&!validProviderPage(discovered.next))
    throw new Error('RTC provider pagination refused');
   const refreshed=await tools.resolve(db,{actor,serverName:target.name},settings);
   if(!sameGrant(grant,refreshed))
    throw new Error('RTC grant changed during metadata lookup');
   return discovered;
  }));
  const found=[],failures=[],candidates=[];
  let incomplete=!focused&&offset<matching.length;
  for(let i=0;i<settled.length;i++) {
   const state=settled[i],job=jobs[i];
   if(state.status==='rejected'){
    failures.push({server:chosen[i].name,code:'unavailable'});
    incomplete=true;
   } else {
    const page=state.value;
    incomplete ||= page.incomplete===true||page.next!=null;
    // Mark a provider that violates the requested one-result bound as
    // incomplete; never invent a fake continuation or repeat its POST.
    if(!focused&&page.tools.length>1)incomplete=true;
    candidates.push({server:chosen[i].name,tools:page.tools,
      next:page.next??null,index:job.index});
    if(!focused&&page.next!=null) {
     if(job.depth+1<=maxFleetDepth)
      nextPending.push({i:job.index,n:page.next,d:job.depth+1});
     else incomplete=true;
    }
   }
  }
  function include(entry) {
   if(found.length>=limit ||
      Buffer.byteLength(JSON.stringify([...found,entry]),'utf8')>6500) {
    incomplete=true;
    return false;
   }
   found.push(entry);
   return true;
  }
  // Cross-service fairness: every scanned provider gets a reserved first
  // slot before Hub-owned results and extra focused-service metadata.
  for(const provider of candidates) {
   if(provider.tools.length)include({...provider.tools[0],server:provider.server});
  }
  for(const tool of owned)include(tool);
  for(const provider of candidates) {
   // A conforming broad source sends at most one. Keep this conservative
   // fallback for legacy synthetic transports that ignore the limit.
   for(const tool of provider.tools.slice(1))
    include({...tool,server:provider.server});
  }
  let next=null;
  if(focused&&candidates.length===1&&candidates[0].next!==null) {
   try{next=issueProviderCursor(scope,candidates[0].next,settings);}
   catch{return fail('unavailable','RTC provider continuation unavailable');}
  }else if(!focused&&nextPending.length) {
   try{next=issueFleetCursor(scope,{o:offset,p:nextPending},settings);}
   catch{return fail('unavailable','RTC fleet continuation unavailable');}
  }else if(!focused&&offset<matching.length) {
   try{next=issueSearchCursor(scope,offset,settings);}
   catch{return fail('unavailable','RTC search continuation unavailable');}
  }
  return {ok:true,result:{tools:found.slice(0,limit),failures,
    incomplete,next,scanned:chosen.length,authorizedTargets:matching.length}};
 }
 if(name==='hub_result_read') {
  if(Object.keys(args).some(k=>!['handle','page'].includes(k))||
    typeof args.handle!=='string'||!/^rtc_[A-Za-z0-9_-]{43}$/.test(args.handle)||
    (args.page!==undefined&&(!Number.isInteger(args.page)||args.page<0||args.page>15)))
    return fail('invalid_args','Invalid RTC result page request');
  try {
   const page=await tools.readResult(db,actor,args.handle,args.page??0,settings);
   return page?{ok:true,result:page}:
     fail('not_found','RTC result missing, expired or grant revoked');
  } catch{return fail('unavailable','RTC result temporarily unavailable');}
 }
 if(name==='hub_call') {
  if(Object.keys(args).some(k=>!['name','args'].includes(k))||
    !namePattern.test(args.name||'')||
    (args.args!==undefined&&!plain(args.args)))
    return fail('invalid_args','Invalid RTC read call arguments');
  if(args.name==='hub_result_read')
   return runFederatedBroker('hub_result_read',args.args??{},actor,db,settings,deps);
  if(ownNames.has(args.name)) {
   // The indirect Hub-owned health read must reflect the same actual
   // eligible grants as a direct hub_health request (including in a
   // sequential batch), not the pre-federation foundation stub.
   if(args.name==='hub_health') {
     if(args.args!==undefined&&Object.keys(args.args).length)
       return fail('invalid_args','Hub health takes no arguments');
     const state=await runFederatedBroker('hub_health',{},actor,db,settings,deps);
     return state.ok?{ok:true,result:{name:args.name,result:state.result}}:state;
   }
   return runBroker('hub_call',args,actor);
  }
  const targets=await tools.list(db,actor,{limit:100});
  const target=ownerOfTool(targets,args.name);
  if(!target)return fail('not_found','RTC tool not granted to caller');
  const grant=await tools.resolve(db,{actor,serverName:target.name},settings);
  if(!grant)return fail('outside_scope','RTC grant unavailable');
  let metadata;
  try {
   metadata=await tools.describe(grant,args.name);
   if(metadata?.name!==args.name||metadata.writes!==false||
      metadata.money!==false||metadata.destructive!==false||
      metadata.annotations?.readOnlyHint!==true||
      !grant.areas.includes(metadata.area))
     return fail('outside_scope','RTC tool not an authorized read');
  } catch{return fail('unavailable','RTC read metadata unavailable');}
  // A revoked or replaced grant during schema lookup must not reach POST.
  const rechecked=await tools.resolve(db,{actor,serverName:target.name},settings);
  if(!rechecked||rechecked.grantId!==grant.grantId||
    rechecked.prefix!==grant.prefix||rechecked.origin!==grant.origin||
    !rechecked.areas.includes(metadata.area))
    return fail('outside_scope','RTC grant changed during read validation');
  const correlationId=tools.correlation();
  // Dispatch must never start before durable attempt receipt.
  try {await tools.audit(db,{actor,grantId:grant.grantId,
    service:target.name,tool:args.name,correlationId,
    phase:'attempt',outcome:'allowed'});}
  catch{return fail('unavailable','RTC audit storage unavailable');}
  let response,outcome='unavailable';
  try {
   response=await tools.read(rechecked,args.name,args.args??{});
   outcome=response?.ok===true?'success':'refused';
  } catch {}
  const sourceId=response?.logged?.id??response?.result?.logged?.id;
  const upstreamLogId=typeof sourceId==='string'&&sourceId.length<=128&&
    /^[a-zA-Z0-9:_./-]+$/.test(sourceId)?sourceId:null;
  try {await tools.audit(db,{actor,grantId:grant.grantId,
    service:target.name,tool:args.name,correlationId,
    phase:'outcome',outcome,upstreamLogId});}
  catch{return fail('unavailable','RTC audit completion unavailable');}
  // A server may finish a harmless read after its Hub grant is revoked.
  // A successful provider POST is not permission to disclose its result now.
  let completedGrant;
  try {completedGrant=await tools.resolve(db,{actor,serverName:target.name},settings);}
  catch{return fail('unavailable','RTC grant status unavailable after read');}
  if(!sameGrant(rechecked,completedGrant))
   return fail('outside_scope','RTC grant changed during provider read');
  if(!response)return fail('unavailable','RTC read outcome uncertain; do not retry automatically');
  if(response.ok!==true) {
   const acceptedCodes=new Set(['needs_confirmation','refused_by_guard',
    'not_found','permission','service_error','rate_limited','pass_expired',
    'pass_revoked','invalid_args','outside_scope']);
   const code=acceptedCodes.has(response?.error?.code)?
     response.error.code:'refused_by_guard';
   return fail(code,'Upstream RTC declined the read');
  }
  const result={name:args.name,server:target.name,correlationId,
    upstreamLogId,result:response.result};
  let bytes;
  try {bytes=Buffer.byteLength(JSON.stringify(result),'utf8');}
  catch{return fail('unavailable','RTC result is not serializable');}
  if(bytes>8000) {
   if(bytes>65536)return fail('unavailable','RTC result exceeds storage bound');
   // The same post-POST grant read also gates encrypted result storage;
   // pages independently reauthorize on every subsequent access.
   try {
    const saved=await tools.storeResult(db,actor,grant.grantId,target.name,result,settings);
    return {ok:true,result:{name:args.name,server:target.name,
      correlationId,upstreamLogId,stored:true,...saved}};
   } catch{return fail('unavailable','RTC encrypted result storage unavailable');}
  }
  return {ok:true,result};
 }
 if(name==='hub_batch') {
  if(Object.keys(args).length!==1||!Array.isArray(args.calls)||
    args.calls.length<1||args.calls.length>10||
    args.calls.some(c=>!plain(c)||Object.keys(c).some(k=>!['name','args'].includes(k))||
      !namePattern.test(c.name||'')||(c.args!==undefined&&!plain(c.args))))
    return fail('invalid_args','Invalid read-only batch');
  const results=[];
  const started=(deps.now??Date.now)();
  const now=deps.now??Date.now;
  const maxMs=20000,maxBytes=10000;
  let usedBytes=0,incomplete=false,stopped=false;
  // A serverless request cannot safely promise ten serial five-second RTC
  // POSTs or return ten large inline results. Each call is single-shot, and
  // budget exhaustion is disclosed per remaining item, never silently cut.
  for(const call of args.calls) {
   if(stopped || now()-started>=maxMs) {
    incomplete=true;stopped=true;
    results.push({name:call.name,ok:false,error:{code:'unavailable',
     what:'Hub batch deadline or response budget exhausted'}});
    continue;
   }
   const outcome=await runFederatedBroker('hub_call',call,actor,db,settings,deps);
   const item={name:call.name,...outcome};
   let bytes;
   try{bytes=Buffer.byteLength(JSON.stringify(item),'utf8');}
   catch{bytes=maxBytes+1;}
   if(usedBytes+bytes>maxBytes) {
    incomplete=true;stopped=true;
    results.push({name:call.name,ok:false,error:{code:'unavailable',
     what:'Hub batch response budget exhausted after audited read'}});
    continue;
   }
   results.push(item);
   usedBytes+=bytes;
  }
  return {ok:true,result:{results,incomplete}};
 }
 if(name==='hub_describe_tool') {
  if(Object.keys(args).length!==1||!namePattern.test(args.name||''))
    return fail('invalid_args','Invalid tool name');
  if(ownNames.has(args.name))return runBroker(name,args,actor);
  const targets=await tools.list(db,actor,{limit:100});
  const target=ownerOfTool(targets,args.name);
  if(!target)return fail('not_found','Tool is not available to caller');
  const grant=await tools.resolve(db,{actor,serverName:target.name},settings);
  if(!grant)return fail('outside_scope','RTC grant unavailable');
  try {
   // Cache only independently grant-narrowed DESCRIBE responses. Real
   // execution preflight below still fetches live provider metadata for
   // every POST. No cached readOnlyHint can authorize execution.
   const schema=await ((tools.describe===describePinnedRtcTool||deps.schemaCache)
    ?tools.schemaCache.describe({actor,target,grant,name:args.name,settings},
      ()=>tools.describe(grant,args.name))
    :tools.describe(grant,args.name));
   const refreshed=await tools.resolve(db,{actor,serverName:target.name},settings);
   if(!sameGrant(grant,refreshed) || !grant.areas.includes(schema.area) ||
     schema.name!==args.name || schema.writes!==false ||
     schema.money!==false || schema.destructive!==false ||
     schema.annotations?.readOnlyHint!==true)
    return fail('outside_scope','RTC read-only schema no longer granted');
   return {ok:true,result:{...schema,server:target.name}};
  }
  catch{return fail('unavailable','RTC schema unavailable or refused');}
 }
 return runBroker(name,args,actor);
}
