// L-1 Linux-only confirmed sandboxed developer command execution.
// The owner must explicitly opt in with `rtool mcp --local`. Host command
// execution must NEVER fall back to an unconfined process when the kernel,
// bubblewrap or any required check is unavailable. In particular, a cwd
// check by itself is NOT a filesystem/process security boundary.
import {constants} from 'node:fs';
import {access,realpath,lstat,stat} from 'node:fs/promises';
import {execFile as executeChild} from 'node:child_process';
import {resolve,sep,isAbsolute} from 'node:path';
import {createConfirmedLocalFile} from './local-file-create.js';
import {ToolError} from './http.js';

const err=(message='Local sandbox execution refused')=>{
 throw new ToolError(message,-32602);
};
const allowedCommands=new Set(['node','npm','python3','git','rg','grep',
 'ls','cat','head','tail','wc','find','make','sh','bash']);
const forbiddenArgs=new Set(['sudo','su','doas']);
const runtimeCandidates=Object.freeze(['/usr/bin/bwrap','/bin/bwrap']);
const MAX_ARGS=16,MAX_ARG=300,MAX_ALL_ARGS=1536;
const MAX_TIMEOUT=20000,MIN_TIMEOUT=1000;
const MAX_STDOUT=4096,MAX_STDERR=2048,MAX_CAPTURE=16384;
const MAX_CAPTURE_TEXT=16000,MAX_BWRAP_INPUT=4096;
const safeEnv=Object.freeze({HOME:'/tmp',PATH:'/usr/bin:/bin',
 LANG:'C.UTF-8',LC_ALL:'C.UTF-8',TZ:'UTC',
 GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',
 GIT_TERMINAL_PROMPT:'0',GIT_NO_LAZY_FETCH:'1',
 GIT_OPTIONAL_LOCKS:'0',GIT_PAGER:'cat',
 CI:'1',NO_COLOR:'1'});
const descriptiveSchema={
 type:'object',additionalProperties:false,
 properties:{root:{type:'integer',minimum:0}},
};
export const LOCAL_SANDBOX_TOOLS=Object.freeze([
 Object.freeze({
  name:'local.shell_sandbox_status',
  description:'Check whether a Linux bubblewrap runtime is installed for confirmed, locally confined processes. A binary check is NOT a kernel-isolation acceptance proof.',
  inputSchema:descriptiveSchema,
  annotations:{readOnlyHint:true,destructiveHint:false,
   idempotentHint:true,openWorldHint:false}
 }),
 Object.freeze({
  name:'local.shell_plan',
  description:'Run 1–3 explicitly confirmed developer commands sequentially in fresh Linux network-isolated namespaces. Stops on first failure; no rollback.',
  inputSchema:{type:'object',additionalProperties:false,
   properties:{
    root:{type:'integer',minimum:0},
    steps:{type:'array',minItems:1,maxItems:3,
     items:{type:'object',additionalProperties:false,
      properties:{
       argv:{type:'array',minItems:1,maxItems:MAX_ARGS,
        items:{type:'string',minLength:1,maxLength:MAX_ARG}},
       workdir:{type:'string',maxLength:1024},
       timeoutMs:{type:'integer',minimum:MIN_TIMEOUT,maximum:10000}
      },required:['argv']}},
    confirm:{type:'boolean',const:true}
   },required:['steps','confirm']},
  annotations:{readOnlyHint:false,destructiveHint:true,
   idempotentHint:false,openWorldHint:false}
 }),
 Object.freeze({
  name:'local.shell_execute',
  description:'Explicitly confirmed sandboxed developer subprocess. Linux bubblewrap mandatory, no host shell fallback, no network, writable approved root only; 1–20 s timeout and bounded output.',
  inputSchema:{type:'object',additionalProperties:false,
   properties:{
    root:{type:'integer',minimum:0},
    argv:{type:'array',minItems:1,maxItems:MAX_ARGS,
     items:{type:'string',minLength:1,maxLength:MAX_ARG}},
    workdir:{type:'string',maxLength:1024},
    timeoutMs:{type:'integer',minimum:MIN_TIMEOUT,maximum:MAX_TIMEOUT},
    outputFile:{type:'string',minLength:1,maxLength:1024},
    confirm:{type:'boolean',const:true}
   },required:['argv','confirm']},
  annotations:{readOnlyHint:false,destructiveHint:true,
   idempotentHint:false,openWorldHint:false}
 })
]);

/**
 * Pure validation: caller values may only become argv following bwrap '--'.
 * Unknown inputs and control characters are refused. Shell interpreters are
 * allowed only INSIDE the OS namespace after exact owner confirmation.
 */
export function checkedSandboxRequest(args) {
 if(!args||typeof args!=='object'||Array.isArray(args)||
    Object.keys(args).some(k=>!['root','argv','workdir','timeoutMs','outputFile','confirm'].includes(k))||
    args.confirm!==true||
    (args.root!==undefined&&(!Number.isInteger(args.root)||args.root<0))||
    !Array.isArray(args.argv)||args.argv.length<1||args.argv.length>MAX_ARGS)
    err();
 let total=0;
 const argv=args.argv.map(arg=>{
  if(typeof arg!=='string'||!arg||arg.length>MAX_ARG||
     /[\x00-\x1f\x7f]/.test(arg))err();
  total+=Buffer.byteLength(arg,'utf8');
  return arg;
 });
 if(total>MAX_ALL_ARGS||!allowedCommands.has(argv[0])||
   argv.some((arg,i)=>i>0&&forbiddenArgs.has(arg)))err();
 const timeoutMs=args.timeoutMs??10000;
 if(!Number.isInteger(timeoutMs)||timeoutMs<MIN_TIMEOUT||
   timeoutMs>MAX_TIMEOUT)err();
 if(args.workdir!==undefined &&
    (typeof args.workdir!=='string'||args.workdir.length>1024))err();
 if(args.outputFile!==undefined &&
    (typeof args.outputFile!=='string'||args.outputFile.length>1024))
    err();
 return {argv,timeoutMs,rootIndex:args.root??0,
   workdir:args.workdir??'',outputFile:args.outputFile??null};
}
function checkedRelative(path,{allowEmpty=false}={}){
 if(typeof path!=='string'||path.length>1024||(!path&&!allowEmpty)||
    isAbsolute(path)||/^[A-Za-z]:/.test(path)||path.includes('\\')||
    /[\x00-\x1f\x7f]/.test(path))err();
 if(path&&path.split('/').some(x=>!x||x==='.'||x==='..'||
   x.toLowerCase()==='.git'))err();
 return path;
}
const inside=(root,path)=>path===root||path.startsWith(root+sep);
async function existingScopedDir(root,relative) {
 const lexical=resolve(root,relative);
 if(!inside(root,lexical))err();
 let actual;
 try{actual=await realpath(lexical);}
 catch{err();}
 if(actual!==lexical||!inside(root,actual))err();
 const info=await lstat(actual,{bigint:true}).catch(()=>err());
 if(!info.isDirectory()||info.isSymbolicLink())err();
 return {path:actual,dev:info.dev,ino:info.ino};
}
async function findBubblewrap() {
 if(process.platform!=='linux')return null;
 for(const candidate of runtimeCandidates){
  try{
   const actual=await realpath(candidate);
   const info=await stat(actual);
   if(!info.isFile())continue;
   if(!actual.startsWith('/usr/bin/')&&!actual.startsWith('/bin/'))
    continue;
   await access(actual,constants.X_OK);
   return actual;
  }catch{ /* missing or not executable; never fallback to shell */ }
 }
 return null;
}
export async function readLocalSandboxStatus(roots,args,
 {findRuntime=findBubblewrap}={}) {
 if(!args||typeof args!=='object'||Array.isArray(args)||
    Object.keys(args).some(k=>k!=='root'))err();
 const index=args.root??0;
 if(!Number.isInteger(index)||index<0||index>=roots.length)err();
 const runtime=await findRuntime();
 return {root:index,backend:'linux-bubblewrap',
   runtimeInstalled:process.platform==='linux'&&Boolean(runtime),
   confirmedExecutionRequired:true,
   networkInsideSandbox:'disabled',
   writableMounts:'selected-approved-root-only',
   actualNamespaceAcceptance:'not-probed',
   unsandboxedFallback:false};
}
/**
 * Pure argument builder keeps every untrusted CLI word AFTER "--".
 * A temporary root namespace contains ONLY /work, runtime directories,
 * /tmp, /dev and a NEW proc filesystem. No host HOME, .ssh, cloud key,
 * /etc credential store, arbitrary volume, or network namespace is shared.
 */
export function buildBubblewrapCommand(root,workdir,argv) {
 if(typeof root!=='string'||!isAbsolute(root)||!Array.isArray(argv)||
    !argv.length||typeof workdir!=='string'||!workdir.startsWith('/work'))
    err();
 // Minimal system runtime directories are READ-ONLY. This exposes only
 // executables/libraries, not host HOME, secrets or writable /usr.
 const args=['--die-with-parent','--new-session','--unshare-all',
  '--clearenv'];
 for(const [key,value] of Object.entries(safeEnv))
  args.push('--setenv',key,value);
 args.push('--ro-bind','/usr','/usr',
  '--ro-bind-try','/bin','/bin',
  '--ro-bind-try','/lib','/lib',
  '--ro-bind-try','/lib64','/lib64',
  '--dev','/dev','--proc','/proc','--tmpfs','/tmp',
  '--bind',root,'/work','--chdir',workdir,'--');
 args.push(...argv);
 if(args.join('\0').length>MAX_BWRAP_INPUT)err();
 return args;
}
async function invokeSandboxRuntime(executable,bwrapArgs,timeoutMs,
 {child=executeChild}={}) {
 return new Promise((resolve,reject)=>{
  child(executable,bwrapArgs,{
   shell:false,windowsHide:true,
   cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8'},
   timeout:timeoutMs,killSignal:'SIGKILL',maxBuffer:MAX_CAPTURE,
   encoding:'utf8'
  },(error,stdout='',stderr='')=>{
   if(error?.killed||error?.signal||typeof error?.code==='string'){
    reject(new ToolError('Sandbox command timed out or was refused',-32602));
    return;
   }
   if(typeof stdout!=='string'||typeof stderr!=='string'||
      Buffer.byteLength(stdout,'utf8')+Buffer.byteLength(stderr,'utf8')>MAX_CAPTURE){
    reject(new ToolError('Sandbox output exceeds bounded capture',-32602));
    return;
   }
   const exitCode=typeof error?.code==='number'?error.code:0;
   if(!Number.isInteger(exitCode)||exitCode<0||exitCode>255){
    reject(new ToolError('Sandbox process terminated abnormally',-32602));
    return;
   }
   resolve({stdout,stderr,exitCode});
  });
 });
}
async function verifyRootIdentity(root,identity){
 const now=await existingScopedDir(root,'');
 if(identity&&(
   now.dev!==identity.dev||now.ino!==identity.ino))err();
 return now;
}
/**
 * No worktree output is exposed on a failed namespace preflight. Source
 * command argv and environment secrets are not logged or persisted.
 * Real kernel sandbox execution (not mocked CI) remains an external gate.
 */
export async function executeConfirmedLocalSandbox(roots,args,
 {findRuntime=findBubblewrap,run=invokeSandboxRuntime,
  rootIdentity=null}={}) {
 const request=checkedSandboxRequest(args);
 const root=roots[request.rootIndex];
 if(typeof root!=='string')err();
 const runtime=await findRuntime();
 if(!runtime||process.platform!=='linux')
   err('Linux sandbox runtime unavailable; execution refused');
 const initial=await verifyRootIdentity(root,rootIdentity);
 checkedRelative(request.workdir,{allowEmpty:true});
 const cwd=await existingScopedDir(root,request.workdir);
 const rel=request.workdir;
 const workdir=rel?'/work/'+rel:'/work';
 if(!inside(root,cwd.path))err();
 // Reject a changed root between separate consent and actual execution.
 await verifyRootIdentity(root,initial);
 if(request.outputFile!==null)checkedRelative(request.outputFile);
 const bwrapArgs=buildBubblewrapCommand(root,workdir,request.argv);
 const actual=await run(runtime,bwrapArgs,request.timeoutMs);
 if(!actual||typeof actual.stdout!=='string'||
   typeof actual.stderr!=='string'||!Number.isInteger(actual.exitCode)||
   actual.exitCode<0||actual.exitCode>255)err();
 const output=actual.stdout,errors=actual.stderr;
 const count=Buffer.byteLength(output,'utf8')+
   Buffer.byteLength(errors,'utf8');
 if(count>MAX_CAPTURE)err();
 if(request.outputFile){
  if(count>MAX_CAPTURE_TEXT)err('Sandbox output too large for approved capture file');
  const result=await createConfirmedLocalFile(roots,{
    root:request.rootIndex,path:request.outputFile,
    content:output+errors,confirm:true
  });
  return {sandboxed:true,networkDisabled:true,
   root:request.rootIndex,command:request.argv[0],
   exitCode:actual.exitCode,outputFile:result.path,
   bytes:result.bytes,contentReturned:false};
 }
 if(Buffer.byteLength(output,'utf8')>MAX_STDOUT||
    Buffer.byteLength(errors,'utf8')>MAX_STDERR)
  err('Sandbox result exceeds MCP inline output budget');
 return {sandboxed:true,networkDisabled:true,
  root:request.rootIndex,command:request.argv[0],
  exitCode:actual.exitCode,stdout:output,stderr:errors,
  timeoutMs:request.timeoutMs,contentReturned:true};
}

/**
 * Build the whole plan and validate ALL steps before the first execution.
 * Each step runs in its own fresh bwrap namespace, preventing state leaks
 * between processes other than intentional worktree modifications. A failed
 * command stops execution; previous worktree effects are NOT rolled back.
 * Plans are never implicitly confirmed by the presence of a local root.
 */
export function checkedSandboxPlan(args) {
 if(!args||typeof args!=='object'||Array.isArray(args)||
   Object.keys(args).some(k=>!['root','steps','confirm'].includes(k))||
   args.confirm!==true||!Array.isArray(args.steps)||
   args.steps.length<1||args.steps.length>3)err();
 const index=args.root??0;
 if(!Number.isInteger(index)||index<0)err();
 const steps=args.steps.map(step=>{
   if(!step||typeof step!=='object'||Array.isArray(step)||
     Object.keys(step).some(k=>!['argv','workdir','timeoutMs'].includes(k)))err();
   const request=checkedSandboxRequest({
     root:index,argv:step.argv,workdir:step.workdir,
     timeoutMs:step.timeoutMs??5000,confirm:true
   });
   checkedRelative(request.workdir,{allowEmpty:true});
   return request;
 });
 if(steps.reduce((total,step)=>total+step.timeoutMs,0)>MAX_TIMEOUT)
   err('Sandbox plan exceeds 20-second total timeout');
 return {root:index,steps};
}
export async function executeConfirmedSandboxPlan(roots,args,deps={}) {
 const plan=checkedSandboxPlan(args);
 if(typeof roots?.[plan.root]!=='string')err();
 // Check runtime and root once even before step one; each operation also
 // independently checks its exact current source root/workdir.
 const findRuntime=deps.findRuntime??findBubblewrap;
 if(process.platform!=='linux'||!await findRuntime())
   err('Linux sandbox unavailable; no plan commands executed');
 const started=Date.now();
 const results=[];
 let totalOutput=0;
 for(let i=0;i<plan.steps.length;i++) {
   const elapsed=Date.now()-started;
   const remaining=MAX_TIMEOUT-elapsed;
   if(remaining<MIN_TIMEOUT)
     return {sandboxed:true,completed:results.length,
       stoppedAt:i+1,reason:'total_timeout',results,
       noRollback:true,networkDisabled:true};
   const step=plan.steps[i];
   let result;
   try {
     result=await executeConfirmedLocalSandbox(roots,{
       root:plan.root,argv:step.argv,workdir:step.workdir,
       timeoutMs:Math.min(remaining,step.timeoutMs),confirm:true
     },deps);
   } catch {
     // Do not execute another command after uncertainty about termination
     // or failed namespace setup. The current step may have changed files.
     return {sandboxed:true,completed:results.length,
       stoppedAt:i+1,reason:'execution_refused_or_failed',
       results,noRollback:true,networkDisabled:true};
   }
   totalOutput+=Buffer.byteLength(result.stdout,'utf8')+
     Buffer.byteLength(result.stderr,'utf8');
   if(totalOutput>MAX_STDOUT+MAX_STDERR)
     return {sandboxed:true,completed:results.length,stoppedAt:i+1,
       reason:'output_budget_exhausted',results,
       noRollback:true,networkDisabled:true};
   results.push({step:i+1,command:step.argv[0],exitCode:result.exitCode,
     stdout:result.stdout,stderr:result.stderr});
   if(result.exitCode!==0)
     return {sandboxed:true,completed:results.length,
       stoppedAt:i+1,reason:'nonzero_exit',results,
       noRollback:true,networkDisabled:true};
 }
 return {sandboxed:true,completed:results.length,
   stoppedAt:null,reason:'success',results,
   noRollback:true,networkDisabled:true};
}
