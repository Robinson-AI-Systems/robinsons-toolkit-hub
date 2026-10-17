import {serverNamePattern} from './server-name.js';
// A constant-size public MCP menu. Until H-2's independently scoped grants
// and H-3's guarded router exist, only these two actual Hub-owned reads can
// be discovered or executed. Never treat broker names as provider names.
const empty={type:'object',properties:{},additionalProperties:false};
const rtcName={type:'string',pattern:'^[a-z][a-z0-9_]{2,119}$',maxLength:120};
const workflowSpec={type:'object',properties:{
 workflow:{type:'string',pattern:'^[a-z][a-z0-9_]{2,59}
  {name:'hub_whoami',description:'Read current TEST Hub connection permissions',inputSchema:empty},
  {name:'hub_health',description:'Read Hub foundation readiness and federation status',inputSchema:empty},
  {name:'hub_search_tools',description:'Search eligible Hub and separately granted RTC read tools',
    inputSchema:{type:'object',properties:{query:{type:'string',maxLength:120},limit:{type:'integer',minimum:1,maximum:20},
      server:{type:'string',pattern:serverNamePattern.source},
      cursor:{type:'string',minLength:1,maxLength:1280},
      area:{type:'string',pattern:'^[a-z][a-z0-9_]{0,59}$'}},
      required:['query'],additionalProperties:false}},
  {name:'hub_describe_tool',description:'Describe an authorized RTC read tool on demand',
    inputSchema:{type:'object',properties:{name:rtcName},required:['name'],additionalProperties:false}},
  {name:'hub_call',description:'Call an independently granted RTC read tool',
    inputSchema:{type:'object',properties:{name:rtcName,args:{type:'object'}},
      required:['name'],additionalProperties:false}},
  // Cloud-hosted ChatGPT adapters that accept only the stable hub_* outer
  // name can still invoke a provider read through this owned alias. The
  // inner provider name is validated by the original H-3 exact-tool router.
  {name:'hub_provider_read',description:'Call one separately granted upstream TEST read-only tool through the existing Hub router',
    inputSchema:{type:'object',properties:{name:rtcName,args:{type:'object'}},
      required:['name'],additionalProperties:false}},
  {name:'hub_provider_describe',description:'Describe one separately granted upstream TEST read-only tool through the existing Hub router',
    inputSchema:{type:'object',properties:{name:rtcName},required:['name'],additionalProperties:false}},
  {name:'hub_batch',description:'Execute up to ten authorized Hub-owned read calls',
    inputSchema:{type:'object',properties:{calls:{type:'array',minItems:1,maxItems:10,
      items:{type:'object',properties:{name:rtcName,args:{type:'object'}},required:['name'],
        additionalProperties:false}}},
      required:['calls'],additionalProperties:false}},
  {name:'hub_recent_changes',description:'Read only your durable TEST RTC routed history; optionally query one exact authorized upstream history tool',
    inputSchema:{type:'object',properties:{
      server:{type:'string',pattern:serverNamePattern.source},
      tool:{type:'string',pattern:rtcName.pattern,maxLength:120},
      since:{type:'string',maxLength:24,description:'UTC date or ISO instant, inclusive'},
      until:{type:'string',maxLength:24,description:'UTC date or ISO instant, inclusive'},
      limit:{type:'integer',minimum:1,maximum:20},
      cursor:{type:'string',minLength:1,maxLength:540},
      includeUpstream:{type:'boolean'}
    },additionalProperties:false}},
  {name:'hub_workflow_plan',description:'Preview every independently authorized provider write without applying changes; returns combined cost and effect summaries',
    inputSchema:{type:'object',properties:{spec:workflowSpec},required:['spec'],additionalProperties:false}},
  {name:'hub_workflow_execute',description:'Execute one previously previewed plan exactly once with explicit confirmation and server guards',
    inputSchema:{type:'object',properties:{runId:runIdField,spec:workflowSpec,confirm:{type:'boolean',const:true}},
      required:['runId','spec','confirm'],additionalProperties:false}},
  {name:'hub_undo_run',description:'Explicitly undo supported recorded steps in reverse order; irreversible actions remain reported',
    inputSchema:{type:'object',properties:{runId:runIdField,confirm:{type:'boolean',const:true}},
      required:['runId','confirm'],additionalProperties:false}},
  {name:'hub_namespaces',description:'List bounded accessible namespaces without fetching upstream tools',
    inputSchema:{type:'object',properties:{
      limit:{type:'integer',minimum:1,maximum:20},
      cursor:{type:'string',minLength:1,maxLength:160}
    },additionalProperties:false}}
].map(tool=>Object.freeze({
  ...tool,area:'gateway',profiles:['read_only','everyday','full'],
  writes:['hub_workflow_execute','hub_undo_run'].includes(tool.name),
  money:false,destructive:['hub_workflow_execute','hub_undo_run'].includes(tool.name),
  audience:['builder','owner','operator'],
  annotations:{readOnlyHint:!['hub_workflow_execute','hub_undo_run'].includes(tool.name),
    destructiveHint:['hub_workflow_execute','hub_undo_run'].includes(tool.name),
    idempotentHint:tool.name!=='hub_undo_run',openWorldHint:false}
})));
const leaf=new Set(['hub_whoami','hub_health']);
const own=Object.freeze({hub_whoami:1,hub_health:1});
function plain(value) {
  return value!==null && typeof value==='object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value)===Object.prototype;
}
function validLeaf(name,args) {
  return typeof name==='string' && Object.hasOwn(own,name) &&
    (args===undefined || (plain(args) && Object.keys(args).length===0));
}
function selected(name) {return catalog.find(x=>x.name===name);}
function error(code,what) {return {ok:false,error:{code,what}};}
function leafCall(name,actor) {
  if(name==='hub_whoami') return {profile:actor.profile,mode:actor.mode,
    areas:[...actor.areas],allowWrites:false};
  return {foundation:'ready',federation:'not_configured',providerCallsEnabled:false,
    contractVersion:0};
}
function validArguments(name,args) {
  if(!plain(args)) return false;
  if(name==='hub_whoami'||name==='hub_health'||name==='hub_namespaces')
    return Object.keys(args).length===0;
  if(name==='hub_search_tools') return Object.keys(args).every(k=>['query','limit'].includes(k)) &&
    typeof args.query==='string' && args.query.length<=120 &&
    (args.limit===undefined || (Number.isInteger(args.limit)&&args.limit>=1&&args.limit<=20));
  if(name==='hub_describe_tool') return Object.keys(args).length===1 &&
    typeof args.name==='string' && args.name.length<=81;
  if(name==='hub_call') return Object.keys(args).every(k=>['name','args'].includes(k)) &&
    validLeaf(args.name,args.args);
  if(name==='hub_batch') return Object.keys(args).length===1 &&
    Array.isArray(args.calls) && args.calls.length>=1 && args.calls.length<=10 &&
    args.calls.every(call=>plain(call)&&Object.keys(call).every(k=>['name','args'].includes(k)) &&
      validLeaf(call.name,call.args));
  return false;
}
export function brokerCatalog() {return catalog;}
export function runBroker(name,args,actor) {
  if(!selected(name)||!validArguments(name,args)) return error('invalid_args','Invalid Hub tool or arguments');
  if(!actor || actor.mode!=='test' || actor.allowWrites===true || !Array.isArray(actor.areas) ||
    !actor.areas.includes('gateway'))
    return error('outside_scope','Caller cannot access Hub gateway');
  if(leaf.has(name)) return {ok:true,result:leafCall(name,actor)};
  if(name==='hub_namespaces') return {ok:true,result:{
    namespaces:[{name:'hub',rtc:0,tools:leaf.size,mode:'test'}],
    upstreamEnabled:false,next:null}};
  if(name==='hub_search_tools') {
    const q=args.query.toLowerCase();
    const tools=catalog.filter(x=>leaf.has(x.name)&&
      (x.name+' '+x.description).toLowerCase().includes(q));
    return {ok:true,result:{tools:tools.slice(0,args.limit??10),next:null,
      incomplete:false}};
  }
  if(name==='hub_describe_tool') {
    const tool=selected(args.name);
    // Never promise provider/federated dispatch before scoped upstream grants.
    if(!tool||!leaf.has(tool.name)) return error('not_found','Tool not callable');
    return {ok:true,result:tool};
  }
  if(name==='hub_call') return {ok:true,result:{
    name:args.name,result:leafCall(args.name,actor)}};
  if(name==='hub_batch') return {ok:true,result:{results:args.calls.map(x=>({
    name:x.name,ok:true,result:leafCall(x.name,actor)}))}};
  return error('not_found','Tool not found');
}
},
 steps:{type:'array',minItems:1,maxItems:10,items:{type:'object',properties:{
 server:{type:'string',pattern:serverNamePattern.source},
 tool:rtcName,args:{type:'object'}},required:['server','tool','args'],additionalProperties:false}}
},required:['workflow','steps'],additionalProperties:false};
const runIdField={type:'string',pattern:'^[0-9a-f-]{36}
  {name:'hub_whoami',description:'Read current TEST Hub connection permissions',inputSchema:empty},
  {name:'hub_health',description:'Read Hub foundation readiness and federation status',inputSchema:empty},
  {name:'hub_search_tools',description:'Search eligible Hub and separately granted RTC read tools',
    inputSchema:{type:'object',properties:{query:{type:'string',maxLength:120},limit:{type:'integer',minimum:1,maximum:20},
      server:{type:'string',pattern:serverNamePattern.source},
      cursor:{type:'string',minLength:1,maxLength:1280},
      area:{type:'string',pattern:'^[a-z][a-z0-9_]{0,59}$'}},
      required:['query'],additionalProperties:false}},
  {name:'hub_describe_tool',description:'Describe an authorized RTC read tool on demand',
    inputSchema:{type:'object',properties:{name:rtcName},required:['name'],additionalProperties:false}},
  {name:'hub_call',description:'Call an independently granted RTC read tool',
    inputSchema:{type:'object',properties:{name:rtcName,args:{type:'object'}},
      required:['name'],additionalProperties:false}},
  // Cloud-hosted ChatGPT adapters that accept only the stable hub_* outer
  // name can still invoke a provider read through this owned alias. The
  // inner provider name is validated by the original H-3 exact-tool router.
  {name:'hub_provider_read',description:'Call one separately granted upstream TEST read-only tool through the existing Hub router',
    inputSchema:{type:'object',properties:{name:rtcName,args:{type:'object'}},
      required:['name'],additionalProperties:false}},
  {name:'hub_provider_describe',description:'Describe one separately granted upstream TEST read-only tool through the existing Hub router',
    inputSchema:{type:'object',properties:{name:rtcName},required:['name'],additionalProperties:false}},
  {name:'hub_batch',description:'Execute up to ten authorized Hub-owned read calls',
    inputSchema:{type:'object',properties:{calls:{type:'array',minItems:1,maxItems:10,
      items:{type:'object',properties:{name:rtcName,args:{type:'object'}},required:['name'],
        additionalProperties:false}}},
      required:['calls'],additionalProperties:false}},
  {name:'hub_recent_changes',description:'Read only your durable TEST RTC routed history; optionally query one exact authorized upstream history tool',
    inputSchema:{type:'object',properties:{
      server:{type:'string',pattern:serverNamePattern.source},
      tool:{type:'string',pattern:rtcName.pattern,maxLength:120},
      since:{type:'string',maxLength:24,description:'UTC date or ISO instant, inclusive'},
      until:{type:'string',maxLength:24,description:'UTC date or ISO instant, inclusive'},
      limit:{type:'integer',minimum:1,maximum:20},
      cursor:{type:'string',minLength:1,maxLength:540},
      includeUpstream:{type:'boolean'}
    },additionalProperties:false}},
  {name:'hub_namespaces',description:'List bounded accessible namespaces without fetching upstream tools',
    inputSchema:{type:'object',properties:{
      limit:{type:'integer',minimum:1,maximum:20},
      cursor:{type:'string',minLength:1,maxLength:160}
    },additionalProperties:false}}
].map(tool=>Object.freeze({
  ...tool,area:'gateway',profiles:['read_only','everyday','full'],
  writes:false,money:false,destructive:false,audience:['builder','owner','operator'],
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
})));
const leaf=new Set(['hub_whoami','hub_health']);
const own=Object.freeze({hub_whoami:1,hub_health:1});
function plain(value) {
  return value!==null && typeof value==='object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value)===Object.prototype;
}
function validLeaf(name,args) {
  return typeof name==='string' && Object.hasOwn(own,name) &&
    (args===undefined || (plain(args) && Object.keys(args).length===0));
}
function selected(name) {return catalog.find(x=>x.name===name);}
function error(code,what) {return {ok:false,error:{code,what}};}
function leafCall(name,actor) {
  if(name==='hub_whoami') return {profile:actor.profile,mode:actor.mode,
    areas:[...actor.areas],allowWrites:false};
  return {foundation:'ready',federation:'not_configured',providerCallsEnabled:false,
    contractVersion:0};
}
function validArguments(name,args) {
  if(!plain(args)) return false;
  if(name==='hub_whoami'||name==='hub_health'||name==='hub_namespaces')
    return Object.keys(args).length===0;
  if(name==='hub_search_tools') return Object.keys(args).every(k=>['query','limit'].includes(k)) &&
    typeof args.query==='string' && args.query.length<=120 &&
    (args.limit===undefined || (Number.isInteger(args.limit)&&args.limit>=1&&args.limit<=20));
  if(name==='hub_describe_tool') return Object.keys(args).length===1 &&
    typeof args.name==='string' && args.name.length<=81;
  if(name==='hub_call') return Object.keys(args).every(k=>['name','args'].includes(k)) &&
    validLeaf(args.name,args.args);
  if(name==='hub_batch') return Object.keys(args).length===1 &&
    Array.isArray(args.calls) && args.calls.length>=1 && args.calls.length<=10 &&
    args.calls.every(call=>plain(call)&&Object.keys(call).every(k=>['name','args'].includes(k)) &&
      validLeaf(call.name,call.args));
  return false;
}
export function brokerCatalog() {return catalog;}
export function runBroker(name,args,actor) {
  if(!selected(name)||!validArguments(name,args)) return error('invalid_args','Invalid Hub tool or arguments');
  if(!actor || actor.mode!=='test' || actor.allowWrites===true || !Array.isArray(actor.areas) ||
    !actor.areas.includes('gateway'))
    return error('outside_scope','Caller cannot access Hub gateway');
  if(leaf.has(name)) return {ok:true,result:leafCall(name,actor)};
  if(name==='hub_namespaces') return {ok:true,result:{
    namespaces:[{name:'hub',rtc:0,tools:leaf.size,mode:'test'}],
    upstreamEnabled:false,next:null}};
  if(name==='hub_search_tools') {
    const q=args.query.toLowerCase();
    const tools=catalog.filter(x=>leaf.has(x.name)&&
      (x.name+' '+x.description).toLowerCase().includes(q));
    return {ok:true,result:{tools:tools.slice(0,args.limit??10),next:null,
      incomplete:false}};
  }
  if(name==='hub_describe_tool') {
    const tool=selected(args.name);
    // Never promise provider/federated dispatch before scoped upstream grants.
    if(!tool||!leaf.has(tool.name)) return error('not_found','Tool not callable');
    return {ok:true,result:tool};
  }
  if(name==='hub_call') return {ok:true,result:{
    name:args.name,result:leafCall(args.name,actor)}};
  if(name==='hub_batch') return {ok:true,result:{results:args.calls.map(x=>({
    name:x.name,ok:true,result:leafCall(x.name,actor)}))}};
  return error('not_found','Tool not found');
}
};
const catalog=Object.freeze([
  {name:'hub_whoami',description:'Read current TEST Hub connection permissions',inputSchema:empty},
  {name:'hub_health',description:'Read Hub foundation readiness and federation status',inputSchema:empty},
  {name:'hub_search_tools',description:'Search eligible Hub and separately granted RTC read tools',
    inputSchema:{type:'object',properties:{query:{type:'string',maxLength:120},limit:{type:'integer',minimum:1,maximum:20},
      server:{type:'string',pattern:serverNamePattern.source},
      cursor:{type:'string',minLength:1,maxLength:1280},
      area:{type:'string',pattern:'^[a-z][a-z0-9_]{0,59}$'}},
      required:['query'],additionalProperties:false}},
  {name:'hub_describe_tool',description:'Describe an authorized RTC read tool on demand',
    inputSchema:{type:'object',properties:{name:rtcName},required:['name'],additionalProperties:false}},
  {name:'hub_call',description:'Call an independently granted RTC read tool',
    inputSchema:{type:'object',properties:{name:rtcName,args:{type:'object'}},
      required:['name'],additionalProperties:false}},
  // Cloud-hosted ChatGPT adapters that accept only the stable hub_* outer
  // name can still invoke a provider read through this owned alias. The
  // inner provider name is validated by the original H-3 exact-tool router.
  {name:'hub_provider_read',description:'Call one separately granted upstream TEST read-only tool through the existing Hub router',
    inputSchema:{type:'object',properties:{name:rtcName,args:{type:'object'}},
      required:['name'],additionalProperties:false}},
  {name:'hub_provider_describe',description:'Describe one separately granted upstream TEST read-only tool through the existing Hub router',
    inputSchema:{type:'object',properties:{name:rtcName},required:['name'],additionalProperties:false}},
  {name:'hub_batch',description:'Execute up to ten authorized Hub-owned read calls',
    inputSchema:{type:'object',properties:{calls:{type:'array',minItems:1,maxItems:10,
      items:{type:'object',properties:{name:rtcName,args:{type:'object'}},required:['name'],
        additionalProperties:false}}},
      required:['calls'],additionalProperties:false}},
  {name:'hub_recent_changes',description:'Read only your durable TEST RTC routed history; optionally query one exact authorized upstream history tool',
    inputSchema:{type:'object',properties:{
      server:{type:'string',pattern:serverNamePattern.source},
      tool:{type:'string',pattern:rtcName.pattern,maxLength:120},
      since:{type:'string',maxLength:24,description:'UTC date or ISO instant, inclusive'},
      until:{type:'string',maxLength:24,description:'UTC date or ISO instant, inclusive'},
      limit:{type:'integer',minimum:1,maximum:20},
      cursor:{type:'string',minLength:1,maxLength:540},
      includeUpstream:{type:'boolean'}
    },additionalProperties:false}},
  {name:'hub_namespaces',description:'List bounded accessible namespaces without fetching upstream tools',
    inputSchema:{type:'object',properties:{
      limit:{type:'integer',minimum:1,maximum:20},
      cursor:{type:'string',minLength:1,maxLength:160}
    },additionalProperties:false}}
].map(tool=>Object.freeze({
  ...tool,area:'gateway',profiles:['read_only','everyday','full'],
  writes:false,money:false,destructive:false,audience:['builder','owner','operator'],
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
})));
const leaf=new Set(['hub_whoami','hub_health']);
const own=Object.freeze({hub_whoami:1,hub_health:1});
function plain(value) {
  return value!==null && typeof value==='object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value)===Object.prototype;
}
function validLeaf(name,args) {
  return typeof name==='string' && Object.hasOwn(own,name) &&
    (args===undefined || (plain(args) && Object.keys(args).length===0));
}
function selected(name) {return catalog.find(x=>x.name===name);}
function error(code,what) {return {ok:false,error:{code,what}};}
function leafCall(name,actor) {
  if(name==='hub_whoami') return {profile:actor.profile,mode:actor.mode,
    areas:[...actor.areas],allowWrites:false};
  return {foundation:'ready',federation:'not_configured',providerCallsEnabled:false,
    contractVersion:0};
}
function validArguments(name,args) {
  if(!plain(args)) return false;
  if(name==='hub_whoami'||name==='hub_health'||name==='hub_namespaces')
    return Object.keys(args).length===0;
  if(name==='hub_search_tools') return Object.keys(args).every(k=>['query','limit'].includes(k)) &&
    typeof args.query==='string' && args.query.length<=120 &&
    (args.limit===undefined || (Number.isInteger(args.limit)&&args.limit>=1&&args.limit<=20));
  if(name==='hub_describe_tool') return Object.keys(args).length===1 &&
    typeof args.name==='string' && args.name.length<=81;
  if(name==='hub_call') return Object.keys(args).every(k=>['name','args'].includes(k)) &&
    validLeaf(args.name,args.args);
  if(name==='hub_batch') return Object.keys(args).length===1 &&
    Array.isArray(args.calls) && args.calls.length>=1 && args.calls.length<=10 &&
    args.calls.every(call=>plain(call)&&Object.keys(call).every(k=>['name','args'].includes(k)) &&
      validLeaf(call.name,call.args));
  return false;
}
export function brokerCatalog() {return catalog;}
export function runBroker(name,args,actor) {
  if(!selected(name)||!validArguments(name,args)) return error('invalid_args','Invalid Hub tool or arguments');
  if(!actor || actor.mode!=='test' || actor.allowWrites===true || !Array.isArray(actor.areas) ||
    !actor.areas.includes('gateway'))
    return error('outside_scope','Caller cannot access Hub gateway');
  if(leaf.has(name)) return {ok:true,result:leafCall(name,actor)};
  if(name==='hub_namespaces') return {ok:true,result:{
    namespaces:[{name:'hub',rtc:0,tools:leaf.size,mode:'test'}],
    upstreamEnabled:false,next:null}};
  if(name==='hub_search_tools') {
    const q=args.query.toLowerCase();
    const tools=catalog.filter(x=>leaf.has(x.name)&&
      (x.name+' '+x.description).toLowerCase().includes(q));
    return {ok:true,result:{tools:tools.slice(0,args.limit??10),next:null,
      incomplete:false}};
  }
  if(name==='hub_describe_tool') {
    const tool=selected(args.name);
    // Never promise provider/federated dispatch before scoped upstream grants.
    if(!tool||!leaf.has(tool.name)) return error('not_found','Tool not callable');
    return {ok:true,result:tool};
  }
  if(name==='hub_call') return {ok:true,result:{
    name:args.name,result:leafCall(args.name,actor)}};
  if(name==='hub_batch') return {ok:true,result:{results:args.calls.map(x=>({
    name:x.name,ok:true,result:leafCall(x.name,actor)}))}};
  return error('not_found','Tool not found');
}
