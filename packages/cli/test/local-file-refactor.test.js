import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,rm,readFile,readdir,writeFile,symlink,link} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createLocalFiles} from '../src/local-files.js';
import {createLocalMcp} from '../src/mcp.js';
import {applyExactLiteralChanges} from '../src/local-file-refactor.js';
const sha=value=>createHash('sha256').update(value).digest('hex');
async function setup(fn){
 const parent=await mkdtemp(join(tmpdir(),'rtool-refactor-'));
 const root=join(parent,'safe');
 try{
  await mkdir(root);await mkdir(join(root,'.git'));
  await writeFile(join(root,'.git','config'),'private git config');
  await mkdir(join(root,'nested'));
  await writeFile(join(root,'src.txt'),'one\ntwo\nthree\n');
  await writeFile(join(parent,'secret'),'outside workspace');
  await symlink(join(parent,'secret'),join(root,'link.txt'));
  await symlink(parent,join(root,'bad-parent'));
  const mcp=createLocalMcp({servers:new Map(),env:{},
   localFiles:await createLocalFiles([root])});
  return await fn({root,parent,mcp});
 }finally{await rm(parent,{recursive:true,force:true});}
}
const call=(mcp,name,args)=>mcp.dispatch({jsonrpc:'2.0',id:1,
 method:'tools/call',params:{name,arguments:args}});
const data=result=>result.result.structuredContent;
const fails=result=>result.result.isError===true;
describe('opt-in confirmed literal file patch, move and delete',()=>{
 it('is never exported from default hosted/unconfigured MCP catalog',async()=>setup(async({mcp})=>{
  const none=createLocalMcp({servers:new Map(),env:{}});
  expect(none.catalog.tools.find(x=>x.name==='local.file_patch')).toBeUndefined();
  for(const name of ['local.file_patch','local.file_move','local.file_delete']){
   expect(mcp.catalog.tools.find(x=>x.name===name)?.annotations)
    .toMatchObject({readOnlyHint:false,destructiveHint:true});
  }
 }));
 it('makes two exact replacements through existing conditional atomic update',async()=>setup(async({mcp,root})=>{
  const result=await call(mcp,'local.file_patch',{path:'src.txt',
   expectedSha256:sha('one\ntwo\nthree\n'),confirm:true,
   changes:[{before:'one\n',after:'ONE\n'},{before:'three\n',after:'THREE\n'}]});
  expect(data(result)).toMatchObject({patched:true,replacements:2,
   sha256:sha('ONE\ntwo\nTHREE\n')});
  expect(await readFile(join(root,'src.txt'),'utf8')).toBe('ONE\ntwo\nTHREE\n');
  const names=await readdir(root);
  expect(names.some(x=>x.endsWith('.rtool-lock')||x.startsWith('.rtool-update-')))
   .toBe(false);
  expect(JSON.stringify(result)).not.toContain('THREE');
 }));
 it('refuses stale digest, no confirm, ambiguous or nonliteral patches and oversize',async()=>setup(async({mcp,root})=>{
  const before=sha('one\ntwo\nthree\n');
  const base={path:'src.txt',confirm:true,expectedSha256:before};
  for(const changes of [
   [{before:'missing',after:'x'}],
   [{before:'o',after:'x'}],
   [{before:'one',after:'one'}],
   [{before:'one',after:'x'.repeat(17000)}],
   [{before:'one',after:'x'},{before:'x',after:'one'}],
   [{before:'',after:'x'}],
   [{before:'one',after:'x',extra:true}]
  ])expect(fails(await call(mcp,'local.file_patch',{...base,changes}))).toBe(true);
  expect(fails(await call(mcp,'local.file_patch',{...base,confirm:false,
   changes:[{before:'one',after:'x'}]}))).toBe(true);
  expect(fails(await call(mcp,'local.file_patch',{...base,expectedSha256:sha('wrong'),
   changes:[{before:'one',after:'x'}]}))).toBe(true);
  expect(await readFile(join(root,'src.txt'),'utf8')).toBe('one\ntwo\nthree\n');
 }));
 it('atomically publishes no-overwrite move within same approved root',async()=>setup(async({mcp,root})=>{
  const initial=sha('one\ntwo\nthree\n');
  const first=await call(mcp,'local.file_move',{path:'src.txt',to:'nested/moved.txt',
   expectedSha256:initial,confirm:true});
  expect(data(first)).toMatchObject({moved:true,to:'nested/moved.txt',sha256:initial});
  expect(await readFile(join(root,'nested','moved.txt'),'utf8')).toBe('one\ntwo\nthree\n');
  await expect(readFile(join(root,'src.txt'),'utf8')).rejects.toThrow();
  await writeFile(join(root,'src.txt'),'another file');
  const noOverwrite=await call(mcp,'local.file_move',{path:'src.txt',
   to:'nested/moved.txt',expectedSha256:sha('another file'),confirm:true});
  expect(fails(noOverwrite)).toBe(true);
  expect(await readFile(join(root,'nested','moved.txt'),'utf8')).toBe('one\ntwo\nthree\n');
 }));
 it('deletes only exact confirmed file and leaves protected Git tree intact',async()=>setup(async({mcp,root})=>{
  const original='one\ntwo\nthree\n';
  expect(fails(await call(mcp,'local.file_delete',{path:'src.txt',
   expectedSha256:sha(original),confirm:false}))).toBe(true);
  const deleted=await call(mcp,'local.file_delete',{path:'src.txt',
   expectedSha256:sha(original),confirm:true});
  expect(data(deleted)).toMatchObject({deleted:true,sha256:sha(original)});
  await expect(readFile(join(root,'src.txt'))).rejects.toThrow();
  const rerun=await call(mcp,'local.file_delete',{path:'src.txt',
   expectedSha256:sha(original),confirm:true});
  expect(fails(rerun)).toBe(true);
  expect(await readFile(join(root,'.git','config'),'utf8')).toBe('private git config');
 }));
 it('refuses external symlinks, .git, traversal and multiple hardlinks',async()=>setup(async({mcp,root,parent})=>{
  const original=sha('one\ntwo\nthree\n');
  await link(join(root,'src.txt'),join(root,'also-linked.txt'));
  for(const args of [
   {path:'link.txt',to:'nested/no.txt'},
   {path:'src.txt',to:'../escape.txt'},
   {path:'src.txt',to:'.git/config'},
   {path:'.git/config',to:'nested/conf'},
   {path:'src.txt',to:'bad-parent/output'},
   {path:'src.txt',to:'nested/no.txt'},
   {path:'src.txt',to:'src.txt'}
  ])expect(fails(await call(mcp,'local.file_move',{...args,
   expectedSha256:original,confirm:true}))).toBe(true);
  expect(fails(await call(mcp,'local.file_delete',{path:'src.txt',
   expectedSha256:original,confirm:true}))).toBe(true);
  expect(fails(await call(mcp,'local.file_patch',{path:'link.txt',
   expectedSha256:sha('outside workspace'),confirm:true,
   changes:[{before:'outside',after:'inside'}]}))).toBe(true);
  expect(await readFile(join(parent,'secret'),'utf8')).toBe('outside workspace');
  expect(await readFile(join(root,'src.txt'),'utf8')).toBe('one\ntwo\nthree\n');
 }));
 it('holds local cooperative lock and refuses a stale SHA without corrupting original',async()=>setup(async({mcp,root})=>{
  const old=sha('one\ntwo\nthree\n');
  await writeFile(join(root,'src.txt.rtool-lock'),'locked');
  expect(fails(await call(mcp,'local.file_move',{path:'src.txt',to:'nested/new',
   expectedSha256:old,confirm:true}))).toBe(true);
  expect(fails(await call(mcp,'local.file_delete',{path:'src.txt',
   expectedSha256:old,confirm:true}))).toBe(true);
  expect(await readFile(join(root,'src.txt'),'utf8')).toBe('one\ntwo\nthree\n');
 }));
});
it('literal patch helper refuses duplicate ambiguous matches, no-op and suspicious shapes',()=>{
 expect(applyExactLiteralChanges('abc def',[{before:'abc',after:'ABC'}]))
  .toBe('ABC def');
 for(const changes of [
  [{before:'a',after:'x'}],
  [{before:'abc',after:'abc'}],
  [{before:'ab',after:'x',unexpected:1}]
 ])expect(()=>applyExactLiteralChanges('abc abc',changes)).toThrow();
});
