import {EventEmitter} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {it,expect,vi} from 'vitest';
import {runFederatedBroker} from '../src/federation.js';
import {pinnedRtcReadCall} from '../src/pinned-read-call.js';
import {pinnedRtcJsonGet} from '../src/pinned-contract.js';
import {mcpFederatedReply} from '../src/http-door.js';
import {handleHubTools} from '../src/tools-http.js';

const actor={id:randomUUID(),ownerId:'deadline-test-owner',clientId:'test-client',
 mode:'test',profile:'read_only',areas:['gateway'],allowWrites:false};
const pass='rtc_pass_'+randomBytes(32).toString('base64url');
const target={name:'workspace',server:'workspace',prefix:'workspace_',
 origin:'https://example-rtc.vercel.app',profile:'read_only',
 mode:'test',areas:['drive'],grantId:randomUUID()};
const schema={name:'workspace_drive_list',description:'Harmless read-only metadata',
 area:'drive',profiles:['read_only'],writes:false,money:false,destructive:false,
 annotations:{readOnlyHint:true},inputSchema:{type:'object',properties:{}}};
function setup() {
 let millis=0;
 const deps={now:()=>millis,list:vi.fn(async()=>[target]),
  resolve:vi.fn(async()=>target),
  describe:vi.fn(async()=>schema),
  read:vi.fn(async()=>({ok:true,result:{records:[1,2]},
   logged:{id:'synthetic_read_9'}})),
  audit:vi.fn(async()=>1),
  correlation:randomUUID};
 return {deps,clock:()=>millis,setTime:x=>{millis=x;}};
}
const calls=n=>Array.from({length:n},()=>({name:'workspace_drive_list',args:{limit:1}}));
const settings={pepper:'synthetic-deadline-test-pepper-over-32-characters'};

it('passes a real bounded remaining timeout to an in-flight provider POST',async()=>{
 const {deps,setTime}=setup();
 deps.describe.mockImplementation(async()=>{setTime(19000);return schema;});
 const result=await runFederatedBroker('hub_batch',{calls:calls(1)},
  actor,{},settings,deps);
 expect(result.ok).toBe(true);
 expect(result.result.results[0].ok).toBe(true);
 expect(deps.describe).toHaveBeenCalledWith(target,schema.name,{timeoutMs:5000});
 expect(deps.read).toHaveBeenCalledWith(target,schema.name,{limit:1},
  {timeoutMs:1000});
 expect(deps.audit).toHaveBeenCalledTimes(2);
 expect(result.result.incomplete).toBe(false);
});

it('does not dispatch after a metadata GET consumes the absolute deadline',async()=>{
 const {deps,setTime}=setup();
 deps.describe.mockImplementation(async()=>{setTime(20001);return schema;});
 const result=await runFederatedBroker('hub_batch',{calls:calls(3)},
  actor,{},settings,deps);
 expect(result.ok).toBe(true);
 expect(result.result.incomplete).toBe(true);
 expect(result.result.results).toHaveLength(3);
 expect(result.result.results.every(x=>x.ok===false)).toBe(true);
 expect(deps.read).not.toHaveBeenCalled();
 expect(deps.audit).not.toHaveBeenCalled();
 expect(deps.describe).toHaveBeenCalledTimes(1);
});

it('keeps the complete durable audit pair when time expires during attempt recording',async()=>{
 const {deps,setTime}=setup();
 deps.audit.mockImplementation(async(_db,record)=>{
  if(record.phase==='attempt')setTime(20001);
  return 1;
 });
 const result=await runFederatedBroker('hub_batch',{calls:calls(3)},
  actor,{},settings,deps);
 expect(result.ok).toBe(true);
 expect(result.result.incomplete).toBe(true);
 expect(result.result.results[0].error.code).toBe('unavailable');
 expect(result.result.results).toHaveLength(3);
 expect(deps.audit.mock.calls.map(x=>x[1].phase)).toEqual(['attempt','outcome']);
 expect(deps.audit.mock.calls[1][1].outcome).toBe('unavailable');
 expect(deps.read).not.toHaveBeenCalled();
});

it('stops all subsequent provider reads after a completed first read exceeds the budget',async()=>{
 const {deps,setTime}=setup();
 deps.read.mockImplementation(async()=>{setTime(21000);return {ok:true,result:{safe:true}};});
 const result=await runFederatedBroker('hub_batch',{calls:calls(5)},
  actor,{},settings,deps);
 expect(result.ok).toBe(true);
 expect(result.result.incomplete).toBe(true);
 expect(result.result.results[0].ok).toBe(true);
 expect(result.result.results.slice(1).every(x=>x.ok===false)).toBe(true);
 expect(deps.read).toHaveBeenCalledTimes(1);
 expect(deps.audit).toHaveBeenCalledTimes(2);
});

it('uses the full five seconds in standalone calls, without widening grant scope',async()=>{
 const {deps}=setup();
 const r=await runFederatedBroker('hub_call',
  {name:schema.name,args:{limit:1}},actor,{},settings,deps);
 expect(r.ok).toBe(true);
 expect(deps.describe).toHaveBeenCalledWith(target,schema.name);
 expect(deps.read).toHaveBeenCalledWith(target,schema.name,{limit:1});
 expect(deps.audit).toHaveBeenCalledTimes(2);
});

it('does not retry or disclose a provider result after a deadline-related POST failure',async()=>{
 const {deps}=setup();
 deps.read.mockRejectedValueOnce(new Error('provider maybe completed unknown POST'));
 const r=await runFederatedBroker('hub_batch',{calls:calls(2)},
  actor,{},settings,deps);
 expect(r.ok).toBe(true);
 expect(r.result.results[0].error.code).toBe('unavailable');
 expect(deps.audit.mock.calls[1][1].outcome).toBe('unavailable');
 expect(deps.read).toHaveBeenCalledTimes(2);
 expect(JSON.stringify(r)).not.toContain('provider maybe completed unknown POST');
});

function fakeTls(body) {
 const captures=[],lookup=vi.fn((_host,_options,cb)=>cb(null,[{
  family:4,address:'8.8.8.8'}]));
 const request=vi.fn((options,onResponse)=>{
  const req=new EventEmitter();
  req.destroy=vi.fn();
  req.setTimeout=vi.fn((value)=>{captures.at(-1).timeout=value;});
  captures.push({options,req});
  req.end=()=>{
   options.lookup(options.hostname,{},err=>{
    if(err){queueMicrotask(()=>req.emit('error',err));return;}
    queueMicrotask(()=>{
     const res=new EventEmitter();
     res.statusCode=200;res.headers={'content-type':'application/json'};
     res.resume=vi.fn();onResponse(res);
     res.emit('data',Buffer.from(JSON.stringify(body)));
     res.emit('end');
    });
   });
  };
  return req;
 });
 return {lookup,request,captures};
}

it('bounds pinned RTC POST at the precise supplied transport timeout, including DNS/socket',async()=>{
 const targetWithPass={...target,pass};
 const valid=fakeTls({ok:true,result:{records:['TEST']}});
 const result=await pinnedRtcReadCall(targetWithPass,schema.name,{},{
  ...valid,timeoutMs:37});
 expect(result.ok).toBe(true);
 expect(valid.captures).toHaveLength(1);
 expect(valid.captures[0].timeout).toBe(37);
 expect(valid.captures[0].options.signal).toBeDefined();
 expect(valid.captures[0].options.agent).toBe(false);
 expect(valid.captures[0].options.rejectUnauthorized).toBe(true);
 for(const timeoutMs of [0,5001,1.2,-2,'5000',null]) {
  await expect(pinnedRtcReadCall(targetWithPass,schema.name,{},
   {...valid,timeoutMs})).rejects.toThrow();
 }
 expect(valid.captures).toHaveLength(1);
});

it('bounds pinned GET schema transport without changing the credential or path allowlist',async()=>{
 const fake=fakeTls({ok:true,result:{...schema}});
 const reply=await pinnedRtcJsonGet(target.origin,'/api/tools/'+schema.name,{
  ...fake,pass,timeoutMs:42});
 expect(reply.ok).toBe(true);
 expect(fake.captures[0].timeout).toBe(42);
 expect(fake.captures[0].options.signal).toBeDefined();
 expect(fake.captures[0].options.headers.authorization).toBe('Bearer '+pass);
 expect(fake.captures[0].options.path).toBe('/api/tools/'+schema.name);
 for(const timeoutMs of [0,5001,NaN,-1]) {
  await expect(pinnedRtcJsonGet(target.origin,'/api/tools/'+schema.name,{
   ...fake,pass,timeoutMs})).rejects.toThrow();
 }
 expect(fake.captures).toHaveLength(1);
});

it('refuses a deadline reached during grant reauthorization before creating an audit attempt',async()=>{
 const {deps,setTime}=setup();
 let count=0;
 deps.resolve.mockImplementation(async()=>{count++;
  if(count===2)setTime(20100);
  return target;
 });
 const r=await runFederatedBroker('hub_batch',{calls:calls(2)},
  actor,{},settings,deps);
 expect(r.result.incomplete).toBe(true);
 expect(deps.read).not.toHaveBeenCalled();
 expect(deps.audit).not.toHaveBeenCalled();
 expect(deps.resolve).toHaveBeenCalledTimes(2);
});

it('native MCP and authenticated HTTPS batches apply the same remaining deadline',async()=>{
 const {deps,setTime}=setup();
 deps.read.mockImplementation(async()=>{setTime(20500);
  return {ok:true,result:{items:[1]}};});
 const native=await mcpFederatedReply({jsonrpc:'2.0',id:5,method:'tools/call',
  params:{name:'hub_batch',arguments:{calls:calls(3)}}},actor,{},settings,deps);
 expect(native.result.structuredContent.incomplete).toBe(true);
 expect(native.result.structuredContent.results).toHaveLength(3);
 expect(deps.read).toHaveBeenCalledTimes(1);
 // Separate fresh request clock and mocked provider reads for HTTPS parity.
 const fixture=setup();
 fixture.deps.read.mockImplementation(async()=>{fixture.setTime(20500);
  return {ok:true,result:{items:[1]}};});
 const res={headers:{},code:null,body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.code=n;return this;},
  json(v){this.body=v;return this;}};
 await handleHubTools({method:'POST',query:{},body:{calls:calls(3)},
  headers:{authorization:'synthetic'}},res,{
  authorize:async()=>({actor}),withDb:async fn=>fn({},settings),
  federate:(name,args,a,db,s)=>runFederatedBroker(name,args,a,db,s,fixture.deps)
 },'batch');
 expect(res.code).toBe(200);
 expect(res.body.result.incomplete).toBe(true);
 expect(res.body.result.results).toHaveLength(3);
 expect(fixture.deps.read).toHaveBeenCalledTimes(1);
 expect(fixture.deps.audit).toHaveBeenCalledTimes(2);
 expect(JSON.stringify(res.body)).not.toContain(pass);
});
