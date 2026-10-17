import {EventEmitter} from 'node:events';
import {randomBytes} from 'node:crypto';
import {it,expect,vi} from 'vitest';
import {pinnedRtcWriteCall,createWorkflowRtcAdapter} from '../src/workflow-rtc.js';
import {dispatchWorkflow} from '../src/workflow-door.js';
import {mcpFederatedReply} from '../src/http-door.js';

const pass='rtc_pass_'+randomBytes(32).toString('base64url');
const actor={id:'00000000-0000-4000-8000-000000000007',
 ownerId:'owner-a',profile:'full',mode:'test',allowWrites:true,
 areas:['gateway'],serverNames:['neon-mcp']};
const target={server:'neon-mcp',prefix:'neon',origin:'https://neon-mcp.vercel.app',
 pass,profile:'full',mode:'test',allowWrites:true,areas:['projects'],
 grantId:'00000000-0000-4000-8000-000000000009'};
const tool='neon_project_create',args={name:'fixture',dryRun:true,confirm:false};
function wire({status=200,mime='application/json',answer={ok:true,result:{
 done:false,summary:'Would create fixture'}},answers=[{address:'8.8.8.8',family:4}]}={}){
 const requests=[];const lookup=vi.fn((_h,_o,cb)=>cb(null,answers));
 const request=vi.fn((options,receive)=>{
  const req=new EventEmitter();req.setTimeout=vi.fn();req.destroy=vi.fn();
  req.end=data=>{
   requests.push({options,data});
   options.lookup(options.hostname,{all:true},err=>{
    if(err){queueMicrotask(()=>req.emit('error',err));return;}
    queueMicrotask(()=>{
     const res=new EventEmitter();res.statusCode=status;
     res.headers={'content-type':mime};res.resume=vi.fn();
     receive(res);
     res.emit('data',Buffer.from(JSON.stringify(answer)));
     res.emit('end');
    });
   });
  };
  return req;
 });
 return {request,lookup,requests};
}
it('submits one pinned TLS POST with the issuer pass, never a Hub token',async()=>{
 const f=wire();
 const response=await pinnedRtcWriteCall(target,tool,args,f);
 expect(response.result.done).toBe(false);
 expect(f.requests).toHaveLength(1);
 expect(f.requests[0].options).toMatchObject({
  protocol:'https:',hostname:'neon-mcp.vercel.app',
  method:'POST',agent:false,rejectUnauthorized:true,
  path:'/api/tools/neon_project_create'});
 expect(f.requests[0].options.headers.authorization).toBe('Bearer '+pass);
 expect(JSON.parse(f.requests[0].data)).toEqual(args);
});
it('refuses DNS rebinding, redirects, read-only bearer and oversized input before any replay',async()=>{
 const fake=wire({answers:[{address:'10.1.1.1',family:4}]});
 await expect(pinnedRtcWriteCall(target,tool,args,fake)).rejects.toThrow('do not retry');
 expect(fake.requests).toHaveLength(1);
 expect(fake.request).toHaveBeenCalledTimes(1);
 const redirected=wire({status:302,mime:'text/html'});
 await expect(pinnedRtcWriteCall(target,tool,args,redirected)).rejects.toThrow('do not retry');
 expect(redirected.request).toHaveBeenCalledTimes(1);
 const never=wire();
 for(const bad of [{...target,profile:'read_only'},
  {...target,allowWrites:false},{...target,origin:'https://127.0.0.1'}]){
  await expect(pinnedRtcWriteCall(bad,tool,args,never)).rejects.toThrow();
 }
 await expect(pinnedRtcWriteCall(target,'stripe_refund_create',args,never)).rejects.toThrow();
 await expect(pinnedRtcWriteCall(target,tool,{big:'x'.repeat(9000)},never)).rejects.toThrow();
 expect(never.requests).toHaveLength(0);
});
it('requires exact verified provider metadata and current grant for each preview and effect',async()=>{
 const resolve=vi.fn(async()=>target);
 const describe=vi.fn(async()=>({ok:true,result:{name:tool,area:'projects',
  profiles:['full'],writes:true,inputSchema:{type:'object'}}}));
 const post=vi.fn(async(_grant,_name,value)=>({ok:true,result:value.dryRun?
  {done:false,summary:'Would create one fixture'}:
  {done:true,confirmed:true,summary:'Created one fixture',logged:{id:'log-1'}}}));
 const adapter=createWorkflowRtcAdapter({}, {},{resolve,describe,post});
 const identity={...actor,kind:'pass'};
 const verdict=await adapter.authorize({actor:identity,server:'neon-mcp',tool});
 expect(verdict).toMatchObject({allowed:true,canWrite:true,
   grantId:target.grantId,server:'neon-mcp',profile:'full',mode:'test'});
 const preview=await adapter.invoke({actor:identity,server:'neon-mcp',
  tool,args,phase:'preview'});
 expect(preview).toMatchObject({done:false,summary:'Would create one fixture'});
 const applied=await adapter.invoke({actor:identity,server:'neon-mcp',tool,
  args:{...args,dryRun:false,confirm:true},phase:'execute'});
 expect(applied).toMatchObject({done:true,confirmed:true,logged:{id:'log-1'}});
 expect(resolve).toHaveBeenCalledTimes(3);
 expect(describe).toHaveBeenCalledTimes(3);
 expect(post).toHaveBeenCalledTimes(2);
 describe.mockResolvedValueOnce({ok:true,result:{name:tool,area:'other',
  profiles:['full'],writes:true,inputSchema:{type:'object'}}});
 await expect(adapter.authorize({actor:identity,server:'neon-mcp',tool}))
  .rejects.toThrow();
 resolve.mockResolvedValueOnce({...target,profile:'read_only'});
 await expect(adapter.authorize({actor:identity,server:'neon-mcp',tool}))
  .rejects.toThrow();
});
it('refusal cannot be promoted into a successful effect',async()=>{
 const adapter=createWorkflowRtcAdapter({}, {},{
  resolve:async()=>target,
  describe:async()=>({ok:true,result:{name:tool,area:'projects',
   profiles:['full'],writes:true,inputSchema:{type:'object'}}}),
  post:async()=>({ok:false,error:{code:'permission'}})});
 const outcome=await adapter.invoke({actor:{...actor,kind:'pass'},
  server:'neon-mcp',tool,args:{...args,dryRun:false,confirm:true},phase:'execute'});
 expect(outcome).toMatchObject({done:false,confirmed:false});
});
it('public workflow handler denies old read-only and requires a separately confirmed plan',async()=>{
 const noEffects=vi.fn();
 const factory=()=>({authorize:vi.fn(),invoke:noEffects});
 const settings={workflowKey:randomBytes(32).toString('base64url')};
 const spec={workflow:'fixture',steps:[{server:'neon-mcp',tool,args:{name:'fixture'}}]};
 expect(await dispatchWorkflow('hub_workflow_plan',{spec},
  {...actor,allowWrites:false},{},settings,{adapterFactory:factory}))
  .toMatchObject({ok:false,error:{code:'outside_scope'}});
 expect(await dispatchWorkflow('hub_workflow_execute',
  {runId:'00000000-0000-4000-8000-000000000001',spec,confirm:false},
  actor,{},settings,{adapterFactory:factory}))
  .toMatchObject({ok:false,error:{code:'invalid_args'}});
 expect(noEffects).not.toHaveBeenCalled();
});
it('native MCP returns bounded machine readable refusal for unauthorized workflow actor',async()=>{
 const msg={jsonrpc:'2.0',id:5,method:'tools/call',
  params:{name:'hub_workflow_plan',arguments:{spec:{workflow:'fixture',steps:[]}}}};
 const reply=await mcpFederatedReply(msg,{...actor,allowWrites:false},{},{workflowKey:'not_set'});
 expect(reply.error.code).toBe(-32602);
 expect(reply.error.message).not.toContain(pass);
});
