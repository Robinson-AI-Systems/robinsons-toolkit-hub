import {it,expect,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
import {planWorkflow,executeWorkflow,undoWorkflow} from '../src/workflow-engine.js';

const actor={ownerId:'owner',kind:'oauth',id:'caller',mode:'test',profile:'full',
 allowWrites:true};
const spec={workflow:'safe_preview',steps:[
 {server:'google-workspace-mcp',tool:'workspace_create_item',args:{name:'first'}}
]};
function adapter({deny=false,throwPreview=false}={}){
 const invoke=vi.fn(async({phase,args})=>{
  if(throwPreview)throw new Error('provider secret must not appear');
  return {done:false,summary:'Preview one item',phase,args};
 });
 return {
  authorize:vi.fn(async()=>({allowed:!deny,canWrite:true,grantId:'grant-00000001',
    mode:'test',profile:'full',areasDigest:'readonly-not-accepted'})),invoke
 };
}
const db={query:vi.fn(async()=>({rows:[],rowCount:0}))};
it('requires explicit full delegated WRITE grant before provider preview',async()=>{
 const x=adapter({deny:true});
 await expect(planWorkflow({db,actor,spec,adapter:x})).rejects.toMatchObject({
  code:'outside_scope'});
 expect(x.invoke).not.toHaveBeenCalled();
});
it('denies read-only Hub actors before DB or provider calls',async()=>{
 const x=adapter();
 const cases=[{...actor,allowWrites:false},{...actor,profile:'read_only'},
  {...actor,ownerId:'../../admin'},null];
 for(const who of cases){
  await expect(planWorkflow({db,actor:who,spec,adapter:x}))
   .rejects.toMatchObject({code:'outside_scope'});
 }
 expect(x.invoke).not.toHaveBeenCalled();
 expect(db.query).not.toHaveBeenCalled();
});
it('read-only preview cannot be promoted when returned state suggests a write',async()=>{
 const x=adapter();
 x.invoke.mockResolvedValue({done:true,confirmed:true,summary:'Oops'});
 await expect(planWorkflow({db,actor,spec,adapter:x}))
  .rejects.toMatchObject({code:'unavailable'});
 expect(x.invoke).toHaveBeenCalledTimes(1);
 expect(x.invoke.mock.calls[0][0].args).toMatchObject({dryRun:true,confirm:false});
 expect(db.query).not.toHaveBeenCalled();
});
it('provider preview failure stays generic, with no ledger claim',async()=>{
 const x=adapter({throwPreview:true});
 await expect(planWorkflow({db,actor,spec,adapter:x}))
  .rejects.toMatchObject({code:'unavailable',message:'Workflow request refused'});
 expect(db.query).not.toHaveBeenCalled();
});
it('refuses caller-chosen pass and effects before provider authorization',async()=>{
 const x=adapter();
 const versions=[
  {workflow:'safe_preview',steps:[{...spec.steps[0],args:{dryRun:false}}]},
  {workflow:'safe_preview',steps:[{...spec.steps[0],args:{pass:'secret'}}]},
  {workflow:'safe_preview',steps:[{...spec.steps[0],args:{confirm:true}}]},
  {workflow:'safe_preview',steps:[{...spec.steps[0],args:{get secret(){throw Error('getter ran')}}}]}
 ];
 for(const sample of versions){
  await expect(planWorkflow({db,actor,spec:sample,adapter:x}))
   .rejects.toMatchObject({code:'invalid_args'});
 }
 expect(x.authorize).not.toHaveBeenCalled();
 expect(x.invoke).not.toHaveBeenCalled();
});
it('refuses execution and undo when the caller does not possess write authority',async()=>{
 const x=adapter();
 for(const who of [{...actor,allowWrites:false},{...actor,profile:'read_only'}]){
  await expect(executeWorkflow({db,actor:who,runId:'bad',spec,adapter:x,
   settings:{workflowKey:randomBytes(32).toString('base64url')}}))
   .rejects.toMatchObject({code:'outside_scope'});
  await expect(undoWorkflow({db,actor:who,runId:'bad',adapter:x,
   settings:{workflowKey:randomBytes(32).toString('base64url')}}))
   .rejects.toMatchObject({code:'outside_scope'});
 }
 expect(x.invoke).not.toHaveBeenCalled();
});
