// A constant-size public MCP menu. Until H-2's independently scoped grants
// and H-3's guarded router exist, only these two actual Hub-owned reads can
// be discovered or executed. Never treat broker names as provider names.
const empty={type:'object',properties:{},additionalProperties:false};
const string={type:'string',minLength:1,maxLength:120};
const rtcName={type:'string',pattern:'^[a-z][a-z0-9_]{2,119}$',maxLength:120};
const catalog=Object.freeze([
  {name:'hub_whoami',description:'Read current TEST Hub connection permissions',inputSchema:empty},
  {name:'hub_health',description:'Read Hub foundation readiness and federation status',inputSchema:empty},
  {name:'hub_search_tools',description:'Search eligible Hub and separately granted RTC read tools',
    inputSchema:{type:'object',properties:{query:string,limit:{type:'integer',minimum:1,maximum:20},
      server:{type:'string',pattern:'^[a-z][a-z0-9_]{1,59}$'},
      area:{type:'string',pattern:'^[a-z][a-z0-9_]{0,59}$'}},
      required:['query'],additionalProperties:false}},
  {name:'hub_describe_tool',description:'Describe an authorized RTC read tool on demand',
    inputSchema:{type:'object',properties:{name:rtcName},required:['name'],additionalProperties:false}},
  {name:'hub_call',description:'Call an independently granted RTC read tool',
    inputSchema:{type:'object',properties:{name:rtcName,args:{type:'object'}},
      required:['name'],additionalProperties:false}},
  {name:'hub_batch',description:'Execute up to ten authorized Hub-owned read calls',
    inputSchema:{type:'object',properties:{calls:{type:'array',minItems:1,maxItems:10,
      items:{type:'object',properties:{name:rtcName,args:{type:'object'}},required:['name'],
        additionalProperties:false}}},
      required:['calls'],additionalProperties:false}},
  {name:'hub_namespaces',description:'List bounded accessible namespaces without fetching upstream tools',
    inputSchema:empty}
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
    typeof args.query==='string' && args.query.length>0 && args.query.length<=120 &&
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
