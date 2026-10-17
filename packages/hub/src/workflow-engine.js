// C-1 durable internal workflow kernel. Intentionally NOT a new network door.
// A future owner-authorized route must independently authenticate the caller,
// resolve each provider's genuine delegated WRITE grant and supply the adapter.
// Existing TEST/read_only H-3 routes must not call this kernel.
import {createHash,randomUUID,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';

const serverName=/^[a-z][a-z0-9_-]{1,119}$/;
const toolName=/^[a-z][a-z0-9_]{2,119}$/;
const workflowName=/^[a-z][a-z0-9_]{2,59}$/;
const digest=value=>createHash('sha256').update(value).digest('hex');
const deny=(code='outside_scope')=>{
 const error=new Error('Workflow request refused');
 error.code=code;
 throw error;
};
function plain(value){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(value));
}
// Do not invoke getters, toJSON, inherited methods or proxy traps to
// serialize a tool request. A caller's arguments are never persisted.
function inert(value,depth=0){
 if(depth>8)deny('invalid_args');
 if(Array.isArray(value)){
  if(value.length>100)deny('invalid_args');
  return value.map(item=>inert(item,depth+1));
 }
 if(plain(value)){
  const result=Object.create(null);
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Object.keys(descriptors).length>80)deny('invalid_args');
  for(const [key,descriptor] of Object.entries(descriptors)){
   if(!Object.hasOwn(descriptor,'value')||key==='__proto__'||
      key==='constructor'||key==='prototype'||key.length>120)
    deny('invalid_args');
   result[key]=inert(descriptor.value,depth+1);
  }
  return result;
 }
 if(value===null||typeof value==='boolean'||typeof value==='string'||
   typeof value==='number'&&Number.isFinite(value)){
  if(typeof value==='string'&&Buffer.byteLength(value,'utf8')>2048)
   deny('invalid_args');
  return value;
 }
 deny('invalid_args');
}
function bounded(value,max){
 const serialized=JSON.stringify(value);
 if(typeof serialized!=='string'||Buffer.byteLength(serialized,'utf8')>max)
  deny('invalid_args');
 return serialized;
}
function caller(actor){
 if(!plain(actor)||typeof actor.ownerId!=='string'||
   !/^[A-Za-z0-9:_-]{1,120}$/.test(actor.ownerId)||
   typeof actor.id!=='string'||!/^[A-Za-z0-9:_-]{1,120}$/.test(actor.id)||
   !['pass','oauth'].includes(actor.kind)||
   !['test','live'].includes(actor.mode)||
   actor.allowWrites!==true||!['everyday','full'].includes(actor.profile))
  deny();
 return {ownerId:actor.ownerId,kind:actor.kind,id:actor.id};
}
function stepsOf(spec){
 if(!plain(spec)||Object.keys(spec).some(k=>!['workflow','steps'].includes(k))||
  !workflowName.test(spec.workflow||'')||!Array.isArray(spec.steps)||
  spec.steps.length<1||spec.steps.length>10)deny('invalid_args');
 const steps=spec.steps.map(step=>{
  if(!plain(step)||Object.keys(step).some(k=>!['server','tool','args'].includes(k))||
    !serverName.test(step.server||'')||!toolName.test(step.tool||'')||
    !plain(step.args||{}))deny('invalid_args');
  const args=inert(step.args||{});
  if(Object.hasOwn(args,'dryRun')||Object.hasOwn(args,'confirm')||
     Object.hasOwn(args,'authorization')||Object.hasOwn(args,'pass'))
    deny('invalid_args');
  return {server:step.server,tool:step.tool,args};
 });
 bounded(steps,12000);
 return {workflow:spec.workflow,steps};
}
function safeSummary(value){
 if(typeof value!=='string'||!value.trim()||
   Buffer.byteLength(value,'utf8')>400||
   /(?:rtc_pass_|Bearer\s|sk_live_|rk_live_|github_pat_)/i.test(value))
  deny('unsafe_result');
 return value;
}
function safeLog(value){
 if(value===null||value===undefined)return null;
 if(typeof value!=='string'||value.length<1||value.length>128||
   /[\x00-\x1f\x7f]/.test(value)||
   /(?:rtc_pass_|Bearer\\s|sk_live_|rk_live_|github_pat_)/i.test(value))return null;
 return value;
}
function keyBytes(settings){
 const encoded=settings?.workflowKey;
 if(typeof encoded!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(encoded))
  deny('unavailable');
 const key=Buffer.from(encoded,'base64url');
 if(key.length!==32)deny('unavailable');
 return key;
}
function sealInverse(settings,context,inverse){
 const key=keyBytes(settings),nonce=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',key,nonce);
 cipher.setAAD(Buffer.from(context));
 const payload=Buffer.from(bounded(inverse,3500),'utf8');
 const encrypted=Buffer.concat([cipher.update(payload),cipher.final()]);
 return Buffer.concat([nonce,cipher.getAuthTag(),encrypted]).toString('base64url');
}
function openInverse(settings,context,blob){
 if(typeof blob!=='string'||blob.length>8192)deny('unavailable');
 try{
  const b=Buffer.from(blob,'base64url');
  if(b.length<29)return deny('unavailable');
  const d=createDecipheriv('aes-256-gcm',keyBytes(settings),b.subarray(0,12));
  d.setAAD(Buffer.from(context));
  d.setAuthTag(b.subarray(12,28));
  return inert(JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8')));
 }catch{return deny('unavailable');}
}
function inverseContext(actor,runId,ordinal){
 return ['C1',actor.ownerId,actor.kind,actor.id,runId,ordinal].join(':');
}
async function authority(adapter,actor,step,operation){
 if(typeof adapter?.authorize!=='function')deny('unavailable');
 const grant=await adapter.authorize({actor,server:step.server,tool:step.tool,operation});
 if(!plain(grant)||grant.allowed!==true||typeof grant.grantId!=='string'||
    !/^[A-Za-z0-9:_-]{8,128}$/.test(grant.grantId)||
    grant.ownerId!==actor.ownerId||grant.callerId!==actor.id||
    grant.callerKind!==actor.kind||grant.server!==step.server||
    grant.mode!==actor.mode||!['everyday','full'].includes(grant.profile)||
    typeof grant.areasDigest!=='string'||
    !/^[a-f0-9]{64}$/.test(grant.areasDigest)||
    grant.canWrite!==true||grant.expired===true||grant.revoked===true)
  deny('outside_scope');
 // Field boundaries and identity selectors are encoded, never ambiguous
 // delimiter-joined strings supplied by an untrusted provider.
 return digest(JSON.stringify([actor.ownerId,actor.kind,actor.id,
   step.server,step.tool,grant.grantId,grant.mode,grant.profile,
   grant.areasDigest]));
}
async function authorizations(adapter,actor,steps,operation){
 const marks=[];
 for(const step of steps)marks.push(await authority(adapter,actor,step,operation));
 return {digest:digest(marks.join(':')),marks};
}
function ensureAdapter(adapter){
 if(!adapter||typeof adapter.invoke!=='function'||typeof adapter.authorize!=='function')
  deny('unavailable');
}
async function begin(db){
 await db.query('BEGIN');
}
async function transaction(db,work){
 await begin(db);
 try{
  const result=await work();
  await db.query('COMMIT');
  return result;
 }catch(error){
  await db.query('ROLLBACK').catch(()=>{});
  throw error;
 }
}
function storedScope(actor){
 return [actor.ownerId,actor.kind,actor.id];
}
async function load(db,actor,runId){
 if(typeof runId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(runId))deny('invalid_args');
 const r=await db.query('SELECT * FROM hub_workflow_runs WHERE id=$1 AND owner_id=$2 AND caller_kind=$3 AND caller_id=$4',
  [runId,...storedScope(actor)]);
 if(r.rows.length!==1)deny('not_found');
 const steps=await db.query('SELECT * FROM hub_workflow_steps WHERE run_id=$1 ORDER BY ordinal',
  [runId]);
 return {run:r.rows[0],steps:steps.rows};
}
function hasSameSpec(spec,loaded){
 const normalized=stepsOf(spec);
 if(digest(bounded(normalized,12000))!==loaded.run.spec_digest)deny('outside_scope');
 return normalized;
}
// Previews are real dryRun requests against each independent service, never
// substitutes produced by the Hub. Nothing is recorded as executable unless
// every step explicitly reports no change and a safe human-readable preview.
export async function planWorkflow({db,actor:principal,spec,adapter,clock=Date.now}){
 const actor=caller(principal);ensureAdapter(adapter);
 const normalized=stepsOf(spec);
 const bound=await authorizations(adapter,principal,normalized.steps,'preview');
 const previews=[];
 for(const step of normalized.steps){
  let observed;
  try{observed=await adapter.invoke({actor:principal,server:step.server,
    tool:step.tool,args:{...step.args,dryRun:true,confirm:false},phase:'preview'});}
  catch{deny('unavailable');}
  if(!plain(observed)||observed.done!==false||observed.needsConfirmation===true)
   deny('unavailable');
  previews.push(safeSummary(observed.summary));
 }
 const id=randomUUID(),now=clock();
 if(!Number.isFinite(now))deny('unavailable');
 const expires=new Date(now+10*60*1000);
 await transaction(db,async()=>{
  await db.query('INSERT INTO hub_workflow_runs (id,owner_id,caller_kind,caller_id,authority_digest,spec_digest,workflow,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
   [id,...storedScope(actor),bound.digest,digest(bounded(normalized,12000)),normalized.workflow,expires]);
  for(let i=0;i<normalized.steps.length;i++){
   const step=normalized.steps[i];
   await db.query('INSERT INTO hub_workflow_steps (run_id,ordinal,server_name,tool_name,args_digest,authority_digest,preview_summary) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id,i+1,step.server,step.tool,digest(bounded(step.args,12000)),bound.marks[i],previews[i]]);
  }
 });
 return {runId:id,workflow:normalized.workflow,state:'planned',
  expiresAt:expires.toISOString(),previews:previews.map((summary,i)=>({
   ordinal:i+1,server:normalized.steps[i].server,tool:normalized.steps[i].tool,summary
  }))};
}
async function markStep(db,runId,ordinal,state,fields={}){
 const keys=['provider_log_id','outcome_summary','inverse_tool','inverse_ciphertext',
  'undo_log_id','undo_state'];
 if(Object.keys(fields).some(key=>!keys.includes(key)))deny('invalid_args');
 const sets=['state=$3','finished_at=now()'],params=[runId,ordinal,state];
 for(const [field,value] of Object.entries(fields)){
  params.push(value);
  sets.push(field+'=$'+params.length);
 }
 await db.query('UPDATE hub_workflow_steps SET '+sets.join(',')+
   ' WHERE run_id=$1 AND ordinal=$2 AND state=\'claimed\'',params);
}
export async function executeWorkflow({db,actor:principal,runId,spec,adapter,settings,confirm=false,clock=Date.now}){
 const actor=caller(principal);ensureAdapter(adapter);
 if(confirm!==true)deny('needs_confirmation');
 const loaded=await load(db,actor,runId),normalized=hasSameSpec(spec,loaded);
 const now=clock();
 if(loaded.run.state!=='planned'||!(new Date(loaded.run.expires_at).getTime()>now)||
  loaded.steps.length!==normalized.steps.length)deny('outside_scope');
 const bound=await authorizations(adapter,principal,normalized.steps,'execute');
 if(bound.digest!==loaded.run.authority_digest)deny('outside_scope');
 // Require the independent encryption key before any provider effect.
 keyBytes(settings);
 const claimed=await db.query('UPDATE hub_workflow_runs SET state=\'running\',updated_at=now() WHERE id=$1 AND owner_id=$2 AND caller_kind=$3 AND caller_id=$4 AND state=\'planned\' AND expires_at>now() AND authority_digest=$5 RETURNING id',
  [runId,...storedScope(actor),bound.digest]);
 if(claimed.rowCount!==1)deny('already_claimed');
 const receipts=[];
 let terminal='complete';
 for(let i=0;i<normalized.steps.length;i++){
  const step=normalized.steps[i];
  const accepted=await db.query('UPDATE hub_workflow_steps SET state=\'claimed\',dispatched_at=now() WHERE run_id=$1 AND ordinal=$2 AND state=\'planned\' RETURNING ordinal',
   [runId,i+1]);
  if(accepted.rowCount!==1){terminal='unknown';break;}
  // Reauthorize after claiming and before dispatch. If provider outcome is
  // ambiguous, a durable claimed row prevents automatic replay.
  try{
   const current=await authority(adapter,principal,step,'execute');
   if(current!==loaded.steps[i].authority_digest)deny('outside_scope');
  }catch{
   await markStep(db,runId,i+1,'failed',{outcome_summary:'Authorization no longer valid'});
   terminal='failed';break;
  }
  let outcome;
  try{
   outcome=await adapter.invoke({actor:principal,server:step.server,tool:step.tool,
    args:{...step.args,dryRun:false,confirm:true},phase:'execute',
    requestId:runId+':'+(i+1)});
  }catch{
   await markStep(db,runId,i+1,'unknown',{outcome_summary:'Provider effect unverified; do not retry'});
   terminal='unknown';break;
  }
  // Explicit server refusal is different from a lost POST answer: record
  // failed, stop descendants, and never label it confirmed or retry it.
  if(plain(outcome)&&outcome.done===false&&outcome.confirmed===false){
   await markStep(db,runId,i+1,'failed',{outcome_summary:'Provider explicitly refused this step'});
   terminal='failed';break;
  }
  if(!plain(outcome)||outcome.done!==true||outcome.confirmed!==true||
     !safeLog(outcome.logged?.id)){
   await markStep(db,runId,i+1,'unknown',{outcome_summary:'Provider effect unverified; do not retry'});
   terminal='unknown';break;
  }
  let inverseTool=null,inverseCiphertext=null;
  if(outcome.inverse&&outcome.irreversible!==true&&outcome.money!==true){
   const inverse=inert(outcome.inverse);
   if(plain(inverse)&&toolName.test(inverse.name||'')&&plain(inverse.args)){
    inverseTool=inverse.name;
    inverseCiphertext=sealInverse(settings,inverseContext(actor,runId,i+1),
      {name:inverse.name,args:inverse.args});
   }
  }
  await markStep(db,runId,i+1,'confirmed',{
   provider_log_id:safeLog(outcome.logged.id),
   outcome_summary:safeSummary(outcome.summary||'Provider confirmed this step'),
   inverse_tool:inverseTool,inverse_ciphertext:inverseCiphertext
  });
  receipts.push({ordinal:i+1,server:step.server,tool:step.tool,
    logId:safeLog(outcome.logged.id),reversible:Boolean(inverseTool)});
 }
 await db.query('UPDATE hub_workflow_runs SET state=$2,updated_at=now() WHERE id=$1 AND state=\'running\'',
  [runId,terminal]);
 return {runId,state:terminal,receipts,notAttempted:normalized.steps.length-receipts.length-
  (terminal==='complete'?0:1),requiresReconciliation:terminal==='unknown'};
}
// Deliberately separate user request. No background or automatic rollback;
// even a confirmed inverse must pass the currently authenticated service guard.
export async function undoWorkflow({db,actor:principal,runId,adapter,settings,confirm=false}){
 const actor=caller(principal);ensureAdapter(adapter);
 if(confirm!==true)deny('needs_confirmation');
 keyBytes(settings);
 const original=await load(db,actor,runId);
 if(!['complete','failed'].includes(original.run.state))deny('outside_scope');
 const claimed=await db.query('UPDATE hub_workflow_runs SET state=\'undoing\',updated_at=now() WHERE id=$1 AND owner_id=$2 AND caller_kind=$3 AND caller_id=$4 AND state IN (\'complete\',\'failed\') RETURNING id',
  [runId,...storedScope(actor)]);
 if(claimed.rowCount!==1)deny('already_claimed');
 const receipts=[];
 let partial=false;
 for(const step of [...original.steps].reverse()){
  if(step.state!=='confirmed')continue;
  if(!step.inverse_tool||!step.inverse_ciphertext){
   partial=true;
   await db.query('UPDATE hub_workflow_steps SET undo_state=\'not_reversible\' WHERE run_id=$1 AND ordinal=$2 AND undo_state=\'not_attempted\'',
    [runId,step.ordinal]);
   receipts.push({ordinal:step.ordinal,status:'not_reversible'});
   continue;
  }
  const accepted=await db.query('UPDATE hub_workflow_steps SET undo_state=\'claimed\' WHERE run_id=$1 AND ordinal=$2 AND undo_state=\'not_attempted\' RETURNING ordinal',
   [runId,step.ordinal]);
  if(accepted.rowCount!==1){partial=true;break;}
  let inverse;
  try{
   inverse=openInverse(settings,inverseContext(actor,runId,step.ordinal),step.inverse_ciphertext);
   if(!plain(inverse)||inverse.name!==step.inverse_tool||!plain(inverse.args))
    deny('unavailable');
   await authority(adapter,principal,{server:step.server_name,tool:inverse.name},'undo');
  }catch{
   partial=true;
   await db.query('UPDATE hub_workflow_steps SET undo_state=\'failed\' WHERE run_id=$1 AND ordinal=$2 AND undo_state=\'claimed\'',
    [runId,step.ordinal]);
   receipts.push({ordinal:step.ordinal,status:'failed'});
   break;
  }
  let outcome;
  try{
   outcome=await adapter.invoke({actor:principal,server:step.server_name,
    tool:inverse.name,args:{...inverse.args,dryRun:false,confirm:true},
    phase:'undo',requestId:runId+':undo:'+(step.ordinal)});
  }catch{
   partial=true;
   await db.query('UPDATE hub_workflow_steps SET undo_state=\'unknown\' WHERE run_id=$1 AND ordinal=$2 AND undo_state=\'claimed\'',
    [runId,step.ordinal]);
   receipts.push({ordinal:step.ordinal,status:'unknown'});
   break;
  }
  if(!plain(outcome)||outcome.done!==true||outcome.confirmed!==true||
   !safeLog(outcome.logged?.id)){
   partial=true;
   await db.query('UPDATE hub_workflow_steps SET undo_state=\'unknown\' WHERE run_id=$1 AND ordinal=$2 AND undo_state=\'claimed\'',
    [runId,step.ordinal]);
   receipts.push({ordinal:step.ordinal,status:'unknown'});
   break;
  }
  await db.query('UPDATE hub_workflow_steps SET undo_state=\'reversed\',undo_log_id=$3 WHERE run_id=$1 AND ordinal=$2 AND undo_state=\'claimed\'',
   [runId,step.ordinal,safeLog(outcome.logged.id)]);
  receipts.push({ordinal:step.ordinal,status:'reversed',logId:safeLog(outcome.logged.id)});
 }
 await db.query('UPDATE hub_workflow_runs SET state=$2,updated_at=now() WHERE id=$1 AND state=\'undoing\'',
  [runId,partial?'undo_partial':'undone']);
 return {runId,state:partial?'undo_partial':'undone',receipts};
}
