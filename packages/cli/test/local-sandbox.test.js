import {it,expect} from 'vitest';
import {mkdtemp,mkdir,rm,writeFile,readFile,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLocalFiles} from '../src/local-files.js';
import {createLocalMcp} from '../src/mcp.js';
import {checkedSandboxRequest,buildBubblewrapCommand,
 executeConfirmedLocalSandbox,readLocalSandboxStatus,
 checkedSandboxPlan,executeConfirmedSandboxPlan}
 from '../src/local-sandbox.js';
const rpc=(mcp,name,args)=>mcp.dispatch({jsonrpc:'2.0',id:1,
 method:'tools/call',params:{name,arguments:args}});
const rejected=x=>x.result.isError===true;
async function fixture(fn){
 const base=await mkdtemp(join(tmpdir(),'rtool-sandbox-'));
 const root=join(base,'approved');
 try{
  await mkdir(root);await mkdir(join(root,'src'));
  await writeFile(join(root,'src','note'),'inside');
  await writeFile(join(base,'outside'),'outside secret');
  await symlink(base,join(root,'escape'));
  const files=await createLocalFiles([root]);
  const mcp=createLocalMcp({servers:new Map(),env:{},localFiles:files});
  return await fn({mcp,root,base,files});
 }finally{await rm(base,{recursive:true,force:true});}
}
it('includes sandbox only for explicit local CLI and keeps base read shell separate',async()=>fixture(async({mcp})=>{
 const plain=createLocalMcp({servers:new Map(),env:{}});
 expect(plain.catalog.tools.find(x=>x.name==='local.shell_execute')).toBeUndefined();
 expect(mcp.catalog.tools.find(x=>x.name==='local.shell_execute').annotations)
  .toMatchObject({readOnlyHint:false,destructiveHint:true});
 expect(mcp.catalog.tools.find(x=>x.name==='local.shell_sandbox_status').annotations)
  .toMatchObject({readOnlyHint:true});
}));
it('refuses unconfirmed executable requests and never launches a host fallback',async()=>fixture(async({mcp})=>{
 for(const argv of [['sudo','apt','update'],['curl','https://example.com'],
   ['bash\n-c','id'],['node','-e','process.exit()']]){
  const bad=await rpc(mcp,'local.shell_execute',{argv});
  expect(rejected(bad)).toBe(true);
 }
 expect(rejected(await rpc(mcp,'local.shell_execute',{
  argv:['node','--version'],confirm:false}))).toBe(true);
 const status=await rpc(mcp,'local.shell_sandbox_status',{});
 expect(status.result.structuredContent.unsandboxedFallback).toBe(false);
}));
it('builds a kernel-isolation command with all user-supplied args after the delimiter',()=>{
 const args=buildBubblewrapCommand('/root/project','/work/src',
  ['bash','-c','pwd; printf ok']);
 expect(args.slice(0,args.indexOf('--'))).toContain('--unshare-all');
 expect(args.slice(0,args.indexOf('--'))).toContain('--bind');
 expect(args.indexOf('--')).toBeGreaterThan(0);
 expect(args.slice(args.indexOf('--')+1)).toEqual(['bash','-c','pwd; printf ok']);
 expect(args).not.toContain('--share-net');
 expect(args.slice(0,args.indexOf('--')).join(' ')).not.toContain('/home');
 expect(args).toContain('--clearenv');
});
it('validates explicit argv, workdir, timeout and output-file choices without command substitution',()=>{
 const valid=checkedSandboxRequest({argv:['npm','test'],confirm:true,
  workdir:'src',timeoutMs:5000});
 expect(valid).toMatchObject({rootIndex:0,timeoutMs:5000,workdir:'src'});
 for(const input of [
  {argv:['sudo','-s'],confirm:true},
  {argv:['node','x'],confirm:true,timeoutMs:25000},
  {argv:['node','x'],confirm:true,unknown:true},
  {argv:['node','x'],confirm:true,root:-1},
  {argv:['node','x\nnext'],confirm:true},
  {argv:['node','x'],confirm:1}
 ])expect(()=>checkedSandboxRequest(input)).toThrow();
});
it('refuses to execute without a system sandbox binary, and never calls the injected subprocess',async()=>fixture(async({root})=>{
 let touched=false;
 await expect(executeConfirmedLocalSandbox([root],
  {argv:['node','--version'],confirm:true},{
   findRuntime:async()=>null,
   run:async()=>{touched=true;return {stdout:'',stderr:'',exitCode:0};}
  })).rejects.toThrow();
 expect(touched).toBe(false);
}));
it('passes verified approved root and scoped workdir to an injected bwrap executor',async()=>fixture(async({root,base})=>{
 if(process.platform!=='linux')return;
 let argumentsList;
 const run=async(_path,args)=>{
   argumentsList=args;
   return {stdout:'ok\n',stderr:'',exitCode:0};
 };
 const input={argv:['node','--version'],workdir:'src',timeoutMs:3000,confirm:true};
 const result=await executeConfirmedLocalSandbox([root],input,{
   findRuntime:async()=>'/usr/bin/bwrap',run});
 expect(result).toMatchObject({sandboxed:true,exitCode:0,stdout:'ok\n'});
 expect(argumentsList).toContain('/work/src');
 expect(argumentsList.indexOf('--unshare-all')).toBeGreaterThanOrEqual(0);
 for(const workdir of ['../','escape','/etc','src/../src']){
  await expect(executeConfirmedLocalSandbox([root],{...input,workdir},{
    findRuntime:async()=>'/usr/bin/bwrap',run})).rejects.toThrow();
 }
 expect(await readFile(join(base,'outside'),'utf8')).toBe('outside secret');
}));
it('separates safe bounded output from confirmed create-only output files',async()=>fixture(async({root})=>{
 if(process.platform!=='linux')return;
 const run=async()=>({stdout:'synthetic run\n',stderr:'',exitCode:3});
 const result=await executeConfirmedLocalSandbox([root],
  {argv:['npm','test'],outputFile:'output.log',confirm:true},{
   findRuntime:async()=>'/usr/bin/bwrap',run});
 expect(result).toMatchObject({sandboxed:true,exitCode:3,
   outputFile:'output.log',contentReturned:false});
 expect(await readFile(join(root,'output.log'),'utf8')).toBe('synthetic run\n');
 await expect(executeConfirmedLocalSandbox([root],
  {argv:['npm','test'],outputFile:'output.log',confirm:true},{
   findRuntime:async()=>'/usr/bin/bwrap',run})).rejects.toThrow();
}));
it('status is truthful about unprobed kernel acceptance',async()=>fixture(async({root})=>{
 const s=await readLocalSandboxStatus([root],{},{
   findRuntime:async()=>'/usr/bin/bwrap'});
 expect(s.actualNamespaceAcceptance).toBe('not-probed');
 expect(s.runtimeInstalled).toBe(process.platform==='linux');
}));

it('validates ALL sandbox plan inputs before any command can run',()=>{
 const valid=checkedSandboxPlan({confirm:true,steps:[
  {argv:['node','--version'],timeoutMs:2000},
  {argv:['npm','test'],workdir:'src',timeoutMs:5000}
 ]});
 expect(valid.steps).toHaveLength(2);
 for(const x of [
  {steps:[{argv:['node','--version']}]},
  {confirm:true,steps:[]},
  {confirm:true,steps:Array(4).fill({argv:['node','--version']})},
  {confirm:true,steps:[{argv:['node','ok'],timeoutMs:19000},
    {argv:['npm','test'],timeoutMs:4000}]},
  {confirm:true,steps:[{argv:['sudo','whoami']}]},
  {confirm:true,steps:[{argv:['node','ok'],unknown:true}]}
 ])expect(()=>checkedSandboxPlan(x)).toThrow();
});
it('executes sequential confirmed steps, stops on failure, and exposes no unconfined fallback',async()=>fixture(async({root})=>{
 if(process.platform!=='linux')return;
 const calls=[],sequence=[0,3];
 const run=async(_binary,args)=>{
  calls.push(args);
  const n=sequence.shift();
  return {stdout:'test\n',stderr:'',exitCode:n};
 };
 const results=await executeConfirmedSandboxPlan([root],{
  confirm:true,steps:[
   {argv:['node','--version']},{argv:['npm','test']},
   {argv:['git','status']}
  ]},{findRuntime:async()=>'/usr/bin/bwrap',run});
 expect(results).toMatchObject({completed:2,reason:'nonzero_exit',stoppedAt:2,
  noRollback:true,networkDisabled:true});
 expect(results.results.map(r=>r.command)).toEqual(['node','npm']);
 expect(calls).toHaveLength(2);
 for(const args of calls){
  expect(args).toContain('--unshare-all');
  expect(args).not.toContain('--share-net');
 }
 let touched=false;
 await expect(executeConfirmedSandboxPlan([root],{
  confirm:true,steps:[{argv:['node','--version']}]},{
  findRuntime:async()=>null,run:async()=>{touched=true;return {};}
 })).rejects.toThrow();
 expect(touched).toBe(false);
}));
it('sandbox plan does not continue after a failed or indeterminate runtime',async()=>fixture(async({root})=>{
 if(process.platform!=='linux')return;
 let runs=0;
 const result=await executeConfirmedSandboxPlan([root],{
  confirm:true,steps:[
   {argv:['npm','test']},{argv:['npm','run','build']}
  ]},{
  findRuntime:async()=>'/usr/bin/bwrap',
  run:async()=>{runs++;throw new Error('sandbox denied');}
 });
 expect(runs).toBe(1);
 expect(result).toMatchObject({completed:0,reason:'execution_refused_or_failed',
  stoppedAt:1});
}));

it('explicit read-only namespace probe distinguishes installation, kernel failure and success',async()=>fixture(async({root})=>{
 if(process.platform!=='linux')return;
 let launched=0;
 const run=async(_runtime,args,timeout)=>{
  launched++;
  expect(timeout).toBe(2000);
  expect(args[args.indexOf('--ro-bind')+1]).toBe('/usr');
  const at=args.lastIndexOf('--ro-bind');
  expect(args.slice(at,at+3)).toEqual(['--ro-bind',root,'/work']);
  expect(args.slice(args.indexOf('--')+1))
   .toEqual(['/usr/bin/test','-d','/work']);
  return {stdout:'',stderr:'',exitCode:0};
 };
 const defaultStatus=await readLocalSandboxStatus([root],{},{
   findRuntime:async()=>'/usr/bin/bwrap',run});
 expect(defaultStatus.probe).toBe('not_requested');
 expect(launched).toBe(0);
 const success=await readLocalSandboxStatus([root],{probe:true},{
   findRuntime:async()=>'/usr/bin/bwrap',run});
 expect(success).toMatchObject({probe:'passed',
   actualNamespaceAcceptance:'local-probe-only',unsandboxedFallback:false});
 expect(launched).toBe(1);
 const denied=await readLocalSandboxStatus([root],{probe:true},{
   findRuntime:async()=>'/usr/bin/bwrap',
   run:async()=>{throw Error('user namespaces disabled');}});
 expect(denied).toMatchObject({probe:'failed',
   actualNamespaceAcceptance:'not-probed'});
 const unavailable=await readLocalSandboxStatus([root],{probe:true},{
   findRuntime:async()=>null,run:async()=>{throw Error('must not run');}});
 expect(unavailable.probe).toBe('unavailable');
 await expect(readLocalSandboxStatus([root],{probe:'true'})).rejects.toThrow();
}));
it('confirmed plans capture each requested step privately without overwriting files',async()=>fixture(async({root})=>{
 if(process.platform!=='linux')return;
 const args={confirm:true,steps:[
  {argv:['npm','test'],outputFile:'step-one.log'},
  {argv:['npm','run','build'],outputFile:'step-two.log'},
  {argv:['git','status']}
 ]};
 let calls=0;
 const first=await executeConfirmedSandboxPlan([root],args,{
  findRuntime:async()=>'/usr/bin/bwrap',
  run:async()=>({stdout:'receipt '+(++calls)+'\\n',stderr:'',exitCode:0})
 });
 expect(first).toMatchObject({completed:3,reason:'success',
   results:[{outputFile:'step-one.log',contentReturned:false},
    {outputFile:'step-two.log',contentReturned:false},{stdout:'receipt 3\\n'}]});
 expect(await readFile(join(root,'step-one.log'),'utf8')).toBe('receipt 1\\n');
 expect(await readFile(join(root,'step-two.log'),'utf8')).toBe('receipt 2\\n');
 expect(JSON.stringify(first)).not.toContain('receipt 1\\n');
 expect(calls).toBe(3);
 const second=await executeConfirmedSandboxPlan([root],args,{
  findRuntime:async()=>'/usr/bin/bwrap',
  run:async()=>{calls++;return {stdout:'unsafe',stderr:'',exitCode:0};}
 });
 expect(second).toMatchObject({completed:0,stoppedAt:1,
   reason:'execution_refused_or_failed',noRollback:true});
 expect(calls).toBe(4); // execution was possible; the output write refused
 expect(await readFile(join(root,'step-one.log'),'utf8')).toBe('receipt 1\\n');
 expect(()=>checkedSandboxPlan({confirm:true,steps:[
  {argv:['node','--version'],outputFile:'same.log'},
  {argv:['node','--version'],outputFile:'same.log'}
 ]})).toThrow();
 expect(()=>checkedSandboxPlan({confirm:true,steps:[
  {argv:['node','--version'],outputFile:'../outside.log'}
 ]})).toThrow();
}));
