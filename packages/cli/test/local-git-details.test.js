import {it,expect} from 'vitest';
import {mkdtemp,mkdir,rm,readFile,writeFile,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createLocalFiles} from '../src/local-files.js';
import {createLocalMcp} from '../src/mcp.js';
const git=promisify(execFile);
const run=async(root,...args)=>(await git('git',['-C',root,...args])).stdout.trim();
const cmd=(mcp,name,args={})=>mcp.dispatch({jsonrpc:'2.0',id:1,
 method:'tools/call',params:{name,arguments:args}});
const ok=r=>r.result.structuredContent;
const failed=r=>r.result.isError===true;
async function setup(fn){
 const base=await mkdtemp(join(tmpdir(),'rtool-git-details-')),root=join(base,'safe');
 try{
  await mkdir(root);
  await git('git',['init','-q',root]);
  await run(root,'config','user.name','Fixture Author');
  await run(root,'config','user.email','fixture@example.invalid');
  await writeFile(join(root,'code.txt'),'alpha\nbeta\n');
  await run(root,'add','code.txt');
  await run(root,'commit','-qm','Add source');
  const original=await run(root,'rev-parse','HEAD');
  await writeFile(join(root,'code.txt'),'alpha\nnew beta\n');
  const mcp=createLocalMcp({servers:new Map(),env:{},
   localFiles:await createLocalFiles([root])});
  return await fn({root,base,mcp,original});
 }finally{await rm(base,{recursive:true,force:true});}
}
it('reads bounded real source diff, historical snapshot, tracked list and file history',async()=>setup(async({mcp,original})=>{
 const diff=ok(await cmd(mcp,'local.git_diff_file',{path:'code.txt'}));
 expect(diff.output).toContain('+new beta');
 expect(diff.staged).toBe(false);
 const before=ok(await cmd(mcp,'local.git_file_at_commit',{path:'code.txt',commit:original}));
 expect(before.output).toBe('alpha\nbeta\n');
 const list=ok(await cmd(mcp,'local.git_tracked_files'));
 expect(list.files).toEqual(['code.txt']);
 const commits=ok(await cmd(mcp,'local.git_file_history',{path:'code.txt'}));
 expect(commits.output).toContain('Add source');
 const hidden=createLocalMcp({servers:new Map(),env:{}});
 expect(hidden.catalog.tools.find(x=>x.name==='local.git_file_at_commit')).toBeUndefined();
}));
it('refuses traversal, .git internals, revision injection and tool option injection',async()=>setup(async({mcp,root,original,base})=>{
 await writeFile(join(base,'secret'),'outside');
 await symlink(join(base,'secret'),join(root,'unsafe'));
 for(const name of ['local.git_diff_file','local.git_file_history']){
  for(const path of ['../secret','.git/config','-danger','../../etc/passwd',
    'code.txt:evil','code.txt\\other','']){
   expect(failed(await cmd(mcp,name,{path}))).toBe(true);
  }
 }
 for(const commit of ['HEAD',original+'--',original.slice(0,8),
  'deadbeef:../../secret','-p',original.toUpperCase()])
  expect(failed(await cmd(mcp,'local.git_file_at_commit',{
   path:'code.txt',commit}))).toBe(true);
 expect(failed(await cmd(mcp,'local.git_tracked_files',{unexpected:true}))).toBe(true);
 expect(failed(await cmd(mcp,'local.git_diff_file',{path:'code.txt',staged:'true'}))).toBe(true);
 expect(failed(await cmd(mcp,'local.git_file_at_commit',{path:'../secret',
  commit:original}))).toBe(true);
}));
it('shows staged changes only when explicitly selected and isolates another root',async()=>setup(async({mcp,root,original})=>{
 await run(root,'add','code.txt');
 expect(ok(await cmd(mcp,'local.git_diff_file',{path:'code.txt'})).output).toBe('');
 expect(ok(await cmd(mcp,'local.git_diff_file',{path:'code.txt',staged:true}))
  .output).toContain('+new beta');
 expect(failed(await cmd(mcp,'local.git_file_at_commit',{path:'code.txt',
  commit:original,root:2}))).toBe(true);
}));
