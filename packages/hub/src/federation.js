import {runBroker} from './broker.js';
import {listEligibleRtcTargets,resolveActiveCallerGrant} from './grants.js';
import {searchPinnedRtcTools,describePinnedRtcTool} from './pinned-tools.js';
import {pinnedRtcReadCall} from './pinned-read-call.js';
import {appendRtcReadAudit,newRtcCorrelation} from './rtc-read-audit.js';

const namePattern=/^[a-z][a-z0-9_]{2,119}$/;
const serverPattern=/^[a-z][a-z0-9_]{1,59}$/;
const areaPattern=/^[a-z][a-z0-9_]{0,59}$/;
const ownNames=new Set(['hub_whoami','hub_health']);
const fail=(code,what)=>({ok:false,error:{code,what}});
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
  read:pinnedRtcReadCall,audit:appendRtcReadAudit,correlation:newRtcCorrelation,...deps};
 if(name==='hub_health') {
  if(Object.keys(args).length)return fail('invalid_args','Invalid Hub arguments');
  const targets=await tools.list(db,actor,{limit:50});
  return {ok:true,result:{foundation:'ready',
    federation:targets.length?'test_read_routing':'not_configured',
    providerCallsEnabled:targets.length>0,contractVersion:0,accessibleUpstreams:targets.length}};
 }
 if(name==='hub_namespaces') {
  if(Object.keys(args).length)return fail('invalid_args','Invalid Hub arguments');
  const targets=await tools.list(db,actor,{limit:50});
  return {ok:true,result:{namespaces:[{name:'hub',rtc:0,tools:2,mode:'test'},
    ...targets.map(t=>({name:t.name,prefix:t.prefix,rtc:1,mode:'test',
      claimedCounts:t.claimedCounts,readOnlyGrant:true}))],
    upstreamEnabled:targets.length>0,metadataOnly:true,next:null}};
 }
 if(name==='hub_search_tools') {
  if(Object.keys(args).some(k=>!['query','area','server','limit'].includes(k))||
    typeof args.query!=='string'||!args.query||args.query.length>120||
    (args.server!==undefined&&!serverPattern.test(args.server))||
    (args.area!==undefined&&!areaPattern.test(args.area))||
    (args.limit!==undefined&&(!Number.isInteger(args.limit)||
      args.limit<1||args.limit>20)))
    return fail('invalid_args','Invalid search parameters');
  const limit=args.limit??10;
  const owned=args.server||args.area&&args.area!=='gateway'?[]:
    runBroker('hub_search_tools',{query:args.query,limit},actor).result.tools;
  const targets=await tools.list(db,actor,{limit:50});
  const matching=targets.filter(t=>(!args.server||t.name===args.server)&&
    (!args.area||t.areas.includes(args.area)));
  if(args.server&&!matching.length)return fail('not_found','No authorized RTC service');
  const chosen=matching.slice(0,3);
  const settled=await Promise.allSettled(chosen.map(async target=>{
   if(args.area&&!target.areas.includes(args.area))return {tools:[],incomplete:false};
   const grant=await tools.resolve(db,{actor,serverName:target.name},settings);
   if(!grant)throw new Error('Grant unavailable');
   return tools.search(grant,{query:args.query,area:args.area,limit:Math.min(limit,10)});
  }));
  const found=[...owned],failures=[];
  let incomplete=matching.length>chosen.length;
  for(let i=0;i<settled.length;i++) {
   const state=settled[i];
   if(state.status==='rejected'){
    failures.push({server:chosen[i].name,code:'unavailable'});
    incomplete=true;
   } else {
    incomplete ||= state.value.incomplete===true;
    const remaining=Math.max(0,limit-found.length);
    if(state.value.tools.length>remaining)incomplete=true;
    for(const tool of state.value.tools.slice(0,remaining))
      found.push({...tool,server:chosen[i].name});
   }
  }
  return {ok:true,result:{tools:found.slice(0,limit),failures,
    incomplete,next:null,scanned:chosen.length,authorizedTargets:matching.length}};
 }
 if(name==='hub_call') {
  if(Object.keys(args).some(k=>!['name','args'].includes(k))||
    !namePattern.test(args.name||'')||
    (args.args!==undefined&&!plain(args.args)))
    return fail('invalid_args','Invalid RTC read call arguments');
  if(ownNames.has(args.name))return runBroker('hub_call',args,actor);
  const targets=await tools.list(db,actor,{limit:50});
  const target=targets.find(t=>args.name.startsWith(t.prefix+'_'));
  if(!target)return fail('not_found','RTC tool not granted to caller');
  const grant=await tools.resolve(db,{actor,serverName:target.name},settings);
  if(!grant)return fail('outside_scope','RTC grant unavailable');
  try {
   const metadata=await tools.describe(grant,args.name);
   if(metadata?.name!==args.name||metadata.writes!==false||
      metadata.money!==false||metadata.destructive!==false||
      metadata.annotations?.readOnlyHint!==true||
      !grant.areas.includes(metadata.area))
     return fail('outside_scope','RTC tool not an authorized read');
  } catch{return fail('unavailable','RTC read metadata unavailable');}
  const correlationId=tools.correlation();
  // Dispatch must never start before durable attempt receipt.
  try {await tools.audit(db,{actor,grantId:grant.grantId,
    service:target.name,tool:args.name,correlationId,
    phase:'attempt',outcome:'allowed'});}
  catch{return fail('unavailable','RTC audit storage unavailable');}
  let response,outcome='unavailable';
  try {
   response=await tools.read(grant,args.name,args.args??{});
   outcome=response?.ok===true?'success':'refused';
  } catch {}
  const sourceId=response?.logged?.id??response?.result?.logged?.id;
  const upstreamLogId=typeof sourceId==='string'&&sourceId.length<=128&&
    /^[a-zA-Z0-9:_./-]+$/.test(sourceId)?sourceId:null;
  try {await tools.audit(db,{actor,grantId:grant.grantId,
    service:target.name,tool:args.name,correlationId,
    phase:'outcome',outcome,upstreamLogId});}
  catch{return fail('unavailable','RTC audit completion unavailable');}
  if(!response)return fail('unavailable','RTC read outcome uncertain; do not retry automatically');
  if(response.ok!==true)return fail('refused_by_guard','Upstream RTC declined the read');
  const result={name:args.name,server:target.name,correlationId,
    upstreamLogId,result:response.result};
  let bytes;
  try {bytes=Buffer.byteLength(JSON.stringify(result),'utf8');}
  catch{return fail('unavailable','RTC result is not serializable');}
  if(bytes>8000)return fail('unavailable','RTC result exceeds inline safety limit');
  return {ok:true,result};
 }
 if(name==='hub_batch') {
  if(Object.keys(args).length!==1||!Array.isArray(args.calls)||
    args.calls.length<1||args.calls.length>10||
    args.calls.some(c=>!plain(c)||Object.keys(c).some(k=>!['name','args'].includes(k))||
      !namePattern.test(c.name||'')||(c.args!==undefined&&!plain(c.args))))
    return fail('invalid_args','Invalid read-only batch');
  const results=[];
  // Sequential calls preserve the original grant and independent refusal
  // of each request. Never retry an uncertain POST or parallelize >10 reads.
  for(const call of args.calls) {
   const outcome=await runFederatedBroker('hub_call',call,actor,db,settings,deps);
   results.push({name:call.name,...outcome});
  }
  return {ok:true,result:{results}};
 }
 if(name==='hub_describe_tool') {
  if(Object.keys(args).length!==1||!namePattern.test(args.name||''))
    return fail('invalid_args','Invalid tool name');
  if(ownNames.has(args.name))return runBroker(name,args,actor);
  const targets=await tools.list(db,actor,{limit:50});
  const target=targets.find(t=>args.name.startsWith(t.prefix+'_'));
  if(!target)return fail('not_found','Tool is not available to caller');
  const grant=await tools.resolve(db,{actor,serverName:target.name},settings);
  if(!grant)return fail('outside_scope','RTC grant unavailable');
  try {return {ok:true,result:{...await tools.describe(grant,args.name),
    server:target.name}};}
  catch{return fail('unavailable','RTC schema unavailable or refused');}
 }
 return runBroker(name,args,actor);
}
