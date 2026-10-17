// The only Hub-owned public workflow door. Never accepts provider bearer,
// origin, tenant or claimed permissions from args: live DB + authenticated
// Hub actor and independently scoped RTC issuer grants decide everything.
import {planWorkflow,executeWorkflow,undoWorkflow,inspectWorkflow} from './workflow-engine.js';
import {createWorkflowRtcAdapter} from './workflow-rtc.js';

export const workflowTools=new Set(['hub_workflow_plan','hub_workflow_execute','hub_undo_run','hub_workflow_status']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 [Object.prototype,null].includes(Object.getPrototypeOf(x));
const deny=code=>({ok:false,error:{code,what:'Authorized workflow request refused'}});
export async function dispatchWorkflow(name,args,actor,db,settings,{
 adapterFactory=createWorkflowRtcAdapter}={}){
 if(!workflowTools.has(name)||!plain(args))return deny('invalid_args');
 // Owner-selected write authority is not implied by an old read-only actor.
 if(!actor||actor.allowWrites!==true||!['everyday','full'].includes(actor.profile)||
   !['test','live'].includes(actor.mode)||!actor.areas?.includes('gateway'))
  return deny('outside_scope');
 const principal={...actor,kind:actor.clientId?'oauth':'pass'};
 if(name!=='hub_workflow_status'&&!/^[A-Za-z0-9_-]{43}$/.test(settings?.workflowKey||''))return deny('unavailable');
 const valid=name==='hub_workflow_plan' ?
    Object.keys(args).length===1&&plain(args.spec):
   name==='hub_workflow_execute'?
    Object.keys(args).length===3&&plain(args.spec)&&
     typeof args.runId==='string'&&args.confirm===true:
   name==='hub_workflow_status'?
    Object.keys(args).length===1&&typeof args.runId==='string':
    Object.keys(args).length===2&&typeof args.runId==='string'&&args.confirm===true;
 if(!valid)return deny('invalid_args');
 try{
  const adapter=adapterFactory(db,settings);
  const result=name==='hub_workflow_plan'?
   await planWorkflow({db,actor:principal,spec:args.spec,adapter}):
   name==='hub_workflow_execute'?
   await executeWorkflow({db,actor:principal,runId:args.runId,
     spec:args.spec,adapter,settings,confirm:true}):
   name==='hub_workflow_status'?
   await inspectWorkflow({db,actor:principal,runId:args.runId,adapter}):
   await undoWorkflow({db,actor:principal,runId:args.runId,adapter,settings,confirm:true});
  const encoded=JSON.stringify(result);
  if(typeof encoded!=='string'||Buffer.byteLength(encoded,'utf8')>12000)
   return deny('unavailable');
  return {ok:true,result};
 }catch(error){
  // No exception message is a user-facing result: providers may embed
  // access keys, response bodies or partial state in exception text.
  return deny(['outside_scope','invalid_args','needs_confirmation','not_found',
    'already_claimed','unavailable'].includes(error?.code)?error.code:'unavailable');
 }
}
