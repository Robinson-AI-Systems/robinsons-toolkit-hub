import {beforeAll,afterAll,it,expect} from 'vitest';
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {planWorkflow,executeWorkflow,undoWorkflow} from '../../src/workflow-engine.js';

const actor={ownerId:'owner-one',kind:'pass',id:'caller-one',mode:'test',
 profile:'full',allowWrites:true,areas:['gateway']};
const settings={workflowKey:randomBytes(32).toString('base64url')};
const spec={workflow:'setup_fixture',steps:[
 {server:'workspace-mcp',tool:'workspace_create_fixture',args:{key:'alpha'}},
 {server:'neon-mcp',tool:'neon_create_fixture',args:{key:'beta'}}
]};
const snapshot=value=>JSON.parse(JSON.stringify(value));
function fixture({unknownAt,refuseAt,nonreversibleAt,rotateAt,allow=true}={}){
 const attempted=[],effects=[],previews=[],inverseCalls=[];
 const grants=new Map([['workspace-mcp','grant-workspace-0001'],
  ['neon-mcp','grant-neon-0001']]);
 const adapter={
  async authorize({actor:principal,server}){
   if(!allow||principal.ownerId!=='owner-one')return {allowed:false};
   return {allowed:true,canWrite:true,grantId:grants.get(server),
    mode:'test',profile:'full',areasDigest:'approved'};
  },
  async invoke({phase,server,tool,args,requestId}){
   const request={phase,server,tool,args:snapshot(args),requestId};
   if(phase==='preview'){
    previews.push(request);
    return {done:false,summary:'Would change '+server};
   }
   if(phase==='undo'){
    inverseCalls.push(request);
    return {done:true,confirmed:true,summary:'Reversed',
      logged:{id:'undo-'+inverseCalls.length}};
   }
   attempted.push(request);
   if(unknownAt===attempted.length)throw new Error('network closed after POST');
   if(refuseAt===attempted.length)return {done:false,summary:'Refused'};
   effects.push(server);
   if(rotateAt===attempted.length)grants.set('neon-mcp','grant-neon-0002');
   return {done:true,confirmed:true,summary:'Applied '+server,
    logged:{id:'log-'+attempted.length},
    ...(attempted.length===nonreversibleAt?{irreversible:true}:{
      inverse:{name:server==='workspace-mcp'?'workspace_undo_fixture':'neon_undo_fixture',
       args:{key:args.key,receipt:'ref-'+attempted.length}}})};
  }
 };
 return {adapter,attempted,effects,previews,inverseCalls,grants};
}
let db,db2,schema;
beforeAll(async()=>{
 if(!process.env.TEST_DATABASE_URL)throw Error('Local disposable PostgreSQL required');
 schema='hub_workflow_'+process.pid+'_'+randomBytes(4).toString('hex');
 db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 db2=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});
 await db.connect();await db2.connect();
 await db.query('CREATE SCHEMA "'+schema+'"');
 await db.query('SET search_path TO "'+schema+'"');
 await db2.query('SET search_path TO "'+schema+'"');
 await db.query(await readFile(new URL('../../migrations/022-hub-workflow-runs.sql',import.meta.url),'utf8'));
});
afterAll(async()=>{
 if(db&&schema)await db.query('DROP SCHEMA "'+schema+'" CASCADE');
 await db?.end();await db2?.end();
});
it('persists only a combined real dryRun preview and needs separate one-time execution',async()=>{
 const x=fixture();
 const plan=await planWorkflow({db,actor,spec,adapter:x.adapter});
 expect(plan.state).toBe('planned');
 expect(plan.previews).toHaveLength(2);
 expect(x.previews.map(p=>[p.phase,p.args.dryRun,p.args.confirm]))
  .toEqual([['preview',true,false],['preview',true,false]]);
 expect(x.attempted).toHaveLength(0);
 const before=await db.query('SELECT * FROM hub_workflow_runs WHERE id=$1',[plan.runId]);
 expect(before.rows[0].state).toBe('planned');
 const result=await executeWorkflow({confirm:true,db,actor,runId:plan.runId,spec,adapter:x.adapter,settings});
 expect(result.state).toBe('complete');
 expect(result.receipts.map(s=>s.logId)).toEqual(['log-1','log-2']);
 expect(x.effects).toEqual(['workspace-mcp','neon-mcp']);
 expect(x.attempted.every(p=>p.args.confirm===true&&p.args.dryRun===false)).toBe(true);
 const data=await db.query('SELECT * FROM hub_workflow_steps WHERE run_id=$1 ORDER BY ordinal',
  [plan.runId]);
 expect(data.rows.map(s=>s.state)).toEqual(['confirmed','confirmed']);
 expect(data.rows.map(s=>s.provider_log_id)).toEqual(['log-1','log-2']);
 expect(data.rows[0].inverse_ciphertext).not.toContain('ref-1');
 const dump=JSON.stringify(data.rows);
 expect(dump).not.toContain('alpha');expect(dump).not.toContain('beta');
 expect(dump).not.toContain(settings.workflowKey);
 const undo=await undoWorkflow({confirm:true,db,actor,runId:plan.runId,adapter:x.adapter,settings});
 expect(undo.state).toBe('undone');
 expect(undo.receipts.map(s=>s.ordinal)).toEqual([2,1]);
 expect(x.inverseCalls.map(s=>s.server)).toEqual(['neon-mcp','workspace-mcp']);
 await expect(undoWorkflow({confirm:true,db,actor,runId:plan.runId,adapter:x.adapter,settings}))
  .rejects.toMatchObject({code:'outside_scope'});
});
it('lost POST answer stays unknown, does not replay, run next step or auto-undo',async()=>{
 const a=fixture({unknownAt:2});
 const input={workflow:'three_step_fixture',steps:[...spec.steps,
  {server:'workspace-mcp',tool:'workspace_create_fixture',args:{key:'third'}}]};
 const plan=await planWorkflow({db,actor,spec:input,adapter:a.adapter});
 const result=await executeWorkflow({confirm:true,db,actor,runId:plan.runId,spec:input,
   adapter:a.adapter,settings});
 expect(result.state).toBe('unknown');
 expect(result.requiresReconciliation).toBe(true);
 expect(result.receipts.map(s=>s.logId)).toEqual(['log-1']);
 expect(a.attempted).toHaveLength(2);
 expect(a.inverseCalls).toHaveLength(0);
 const states=(await db.query('SELECT state FROM hub_workflow_steps WHERE run_id=$1 ORDER BY ordinal',[plan.runId]))
  .rows.map(s=>s.state);
 expect(states).toEqual(['confirmed','unknown','planned']);
 await expect(executeWorkflow({confirm:true,db,actor,runId:plan.runId,spec:input,
    adapter:a.adapter,settings})).rejects.toMatchObject({code:'outside_scope'});
 await expect(undoWorkflow({confirm:true,db,actor,runId:plan.runId,adapter:a.adapter,settings}))
  .rejects.toMatchObject({code:'outside_scope'});
 expect(a.attempted).toHaveLength(2);
});
it('two independent SQL clients cannot dispatch a confirmed plan twice',async()=>{
 const a=fixture();
 const plan=await planWorkflow({db,actor,spec,adapter:a.adapter});
 const results=await Promise.allSettled([
  executeWorkflow({confirm:true,db,actor,runId:plan.runId,spec,adapter:a.adapter,settings}),
  executeWorkflow({confirm:true,db:db2,actor,runId:plan.runId,spec,adapter:a.adapter,settings})
 ]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
 expect(a.attempted).toHaveLength(2);
 const state=await db.query('SELECT state FROM hub_workflow_runs WHERE id=$1',[plan.runId]);
 expect(state.rows[0].state).toBe('complete');
});
it('identities, changed rights, expiry and missing independent writes refuse before effects',async()=>{
 const a=fixture();
 await expect(planWorkflow({db,actor:{...actor,allowWrites:false},spec,
   adapter:a.adapter})).rejects.toMatchObject({code:'outside_scope'});
 expect(a.previews).toHaveLength(0);
 const plan=await planWorkflow({db,actor,spec,adapter:a.adapter});
 await expect(executeWorkflow({confirm:true,db,actor:{...actor,id:'caller-other'},runId:plan.runId,
   spec,adapter:a.adapter,settings})).rejects.toMatchObject({code:'not_found'});
 a.grants.set('workspace-mcp','grant-workspace-0002');
 await expect(executeWorkflow({confirm:true,db,actor,runId:plan.runId,spec,adapter:a.adapter,
   settings})).rejects.toMatchObject({code:'outside_scope'});
 expect(a.attempted).toHaveLength(0);
 a.grants.set('workspace-mcp','grant-workspace-0001');
 await expect(executeWorkflow({confirm:true,db,actor,runId:plan.runId,spec,adapter:a.adapter,
   settings,clock:()=>Date.now()+11*60*1000})).rejects.toMatchObject({code:'outside_scope'});
 expect(a.attempted).toHaveLength(0);
 await expect(planWorkflow({db,actor,spec,adapter:fixture({allow:false}).adapter}))
  .rejects.toMatchObject({code:'outside_scope'});
});
it('a grant changed between first receipt and second POST stops before next effect',async()=>{
 const a=fixture({rotateAt:1});
 const plan=await planWorkflow({db,actor,spec,adapter:a.adapter});
 const result=await executeWorkflow({confirm:true,db,actor,runId:plan.runId,spec,
  adapter:a.adapter,settings});
 expect(result.state).toBe('failed');
 expect(result.receipts.map(s=>s.logId)).toEqual(['log-1']);
 expect(a.attempted).toHaveLength(1);
 const statuses=await db.query('SELECT state FROM hub_workflow_steps WHERE run_id=$1 ORDER BY ordinal',
  [plan.runId]);
 expect(statuses.rows.map(s=>s.state)).toEqual(['confirmed','failed']);
});
it('irreversible steps remain reported rather than fabricating an inverse',async()=>{
 const a=fixture({nonreversibleAt:1});
 const plan=await planWorkflow({db,actor,spec,adapter:a.adapter});
 const result=await executeWorkflow({confirm:true,db,actor,runId:plan.runId,spec,
  adapter:a.adapter,settings});
 expect(result.state).toBe('complete');
 const undo=await undoWorkflow({confirm:true,db,actor,runId:plan.runId,adapter:a.adapter,settings});
 expect(undo.state).toBe('undo_partial');
 expect(undo.receipts.map(s=>s.status)).toEqual(['reversed','not_reversible']);
 expect(a.inverseCalls).toHaveLength(1);
});
it('separate positive confirmation is mandatory before effect or undo',async()=>{
 const a=fixture();
 const plan=await planWorkflow({db,actor,spec,adapter:a.adapter});
 await expect(executeWorkflow({db,actor,runId:plan.runId,spec,adapter:a.adapter,settings}))
  .rejects.toMatchObject({code:'needs_confirmation'});
 expect(a.attempted).toHaveLength(0);
 const result=await executeWorkflow({confirm:true,db,actor,runId:plan.runId,spec,adapter:a.adapter,settings});
 expect(result.state).toBe('complete');
 await expect(undoWorkflow({db,actor,runId:plan.runId,adapter:a.adapter,settings}))
  .rejects.toMatchObject({code:'needs_confirmation'});
 expect(a.inverseCalls).toHaveLength(0);
});
it('malformed input, getters, caller-selected confirmation and wrong key refuse',async()=>{
 const a=fixture();
 const unsafe={...spec,steps:[{server:'workspace-mcp',tool:'workspace_create_fixture',
  args:Object.defineProperty({},'token',{get(){throw new Error('secret getter ran');}})}]};
 await expect(planWorkflow({db,actor,spec:unsafe,adapter:a.adapter}))
  .rejects.toMatchObject({code:'invalid_args'});
 await expect(planWorkflow({db,actor,spec:{...spec,
  steps:[{...spec.steps[0],args:{confirm:true}}]},adapter:a.adapter}))
  .rejects.toMatchObject({code:'invalid_args'});
 const plan=await planWorkflow({db,actor,spec,adapter:a.adapter});
 await expect(executeWorkflow({confirm:true,db,actor,runId:plan.runId,spec,adapter:a.adapter,
  settings:{workflowKey:'short'}})).rejects.toMatchObject({code:'unavailable'});
 expect(a.attempted).toHaveLength(0);
});
