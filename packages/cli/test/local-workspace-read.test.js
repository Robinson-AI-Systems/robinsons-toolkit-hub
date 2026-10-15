import {it,expect} from 'vitest';
import {mkdtemp,mkdir,rm,writeFile,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLocalMcp} from '../src/mcp.js';
import {createLocalFiles} from '../src/local-files.js';
async function run(fn){
 const base=await mkdtemp(join(tmpdir(),'rtool-workspace-'));
 const root=join(base,'approved');
 try{
  await mkdir(root);await mkdir(join(root,'src'));
  await mkdir(join(root,'.git'));await mkdir(join(root,'node_modules'));
  await writeFile(join(root,'a.txt'),'small\n');
  await writeFile(join(root,'src','b.txt'),'another\n');
  await writeFile(join(root,'.git','config'),'private');
  await writeFile(join(root,'node_modules','hidden.txt'),'exclude');
  await writeFile(join(root,'too-big.txt'),'X'.repeat(1025));
  await writeFile(join(base,'outside.txt'),'outside secret');
  await symlink(join(base,'outside.txt'),join(root,'escape.txt'));
  const mcp=createLocalMcp({servers:new Map(),env:{},
   localFiles:await createLocalFiles([root])});
  return await fn({base,root,mcp});
 }finally{await rm(base,{recursive:true,force:true});}
}
const call=(mcp,name,args)=>mcp.dispatch({jsonrpc:'2.0',id:1,method:'tools/call',
 params:{name,arguments:args}});
const good=x=>x.result.structuredContent;
const denied=x=>x.result.isError===true;
it('reads named compact real files without exposing unrequested file content',async()=>run(async({mcp})=>{
 const r=good(await call(mcp,'local.file_read_many',{paths:['a.txt','src/b.txt']}));
 expect(r).toMatchObject({complete:true,totalBytes:14});
 expect(r.files.map(x=>x.content)).toEqual(['small\n','another\n']);
 expect(JSON.stringify(r)).not.toContain('outside secret');
}));
it('lists bounded file tree with no symlink or hidden dependency walk',async()=>run(async({mcp})=>{
 const r=good(await call(mcp,'local.file_tree',{path:'',depth:3}));
 expect(r.entries.map(x=>x.path)).toContain('src/b.txt');
 expect(r.entries.map(x=>x.path)).not.toContain('.git/config');
 expect(r.entries.map(x=>x.path)).not.toContain('node_modules/hidden.txt');
 expect(r.entries.map(x=>x.path)).not.toContain('escape.txt');
 expect(r.complete).toBe(true);
}));
it('refuses traversal, leaf symlinks, unsupported files, duplicates and roots',async()=>run(async({mcp})=>{
 for(const paths of [['escape.txt'],['too-big.txt'],['../outside.txt'],
  ['a.txt','a.txt'],['.git/config'],['node_modules/hidden.txt']])
  expect(denied(await call(mcp,'local.file_read_many',{paths}))).toBe(true);
 for(const args of [
  {path:'../'}, {path:'.git'}, {path:'escape.txt'}, {path:'',depth:5},
  {path:'',root:22},{path:'src',unexpected:true}
 ])expect(denied(await call(mcp,'local.file_tree',args))).toBe(true);
 const none=createLocalMcp({servers:new Map(),env:{}});
 expect(none.catalog.tools.find(x=>x.name==='local.file_read_many')).toBeUndefined();
}));
