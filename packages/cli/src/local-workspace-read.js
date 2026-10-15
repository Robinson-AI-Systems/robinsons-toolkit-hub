// L-1 opt-in workspace navigation and compact multi-file reading.
// No providers, subprocesses, hidden metadata, write operations or symlink
// traversal; caller must explicitly enable canonical root directories.
import {constants} from 'node:fs';
import {open,realpath,readdir,stat} from 'node:fs/promises';
import {isAbsolute,resolve,sep} from 'node:path';
import {ToolError} from './http.js';
const bad=()=>{throw new ToolError('Local workspace read refused',-32602);};
const within=(root,path)=>path===root||path.startsWith(root+sep);
const MAX_BUNDLE_FILES=6,MAX_FILE=1024,MAX_BUNDLE_BYTES=5300;
const MAX_DEPTH=4,MAX_ENTRIES=80,MAX_SCANNED=300;
const meta={readOnlyHint:true,destructiveHint:false,
 idempotentHint:true,openWorldHint:false};
const rootField={type:'integer',minimum:0};
export const LOCAL_WORKSPACE_READ_TOOLS=Object.freeze([
 Object.freeze({
  name:'local.file_read_many',
  description:'Read at most six explicitly named UTF-8 source files, 1024 bytes each and 5300 bytes total, within an enabled folder.',
  inputSchema:{type:'object',additionalProperties:false,
   properties:{root:rootField,paths:{type:'array',minItems:1,
    maxItems:MAX_BUNDLE_FILES,items:{type:'string',minLength:1,maxLength:1024}}},
   required:['paths']},annotations:meta
 }),
 Object.freeze({
  name:'local.file_tree',
  description:'List a bounded recursive source tree (up to 80 returned entries, depth 1–4), skipping hidden paths, dependencies and symlinks.',
  inputSchema:{type:'object',additionalProperties:false,
   properties:{root:rootField,path:{type:'string',maxLength:1024},
    depth:{type:'integer',minimum:1,maximum:MAX_DEPTH}},annotations:meta
 })
]);
function validateRelative(p,allowEmpty=false){
 if(typeof p!=='string'||p.length>1024||(!p&&!allowEmpty)||
    isAbsolute(p)||p.includes('\\')||/^[a-zA-Z]:/.test(p)||
    /[\x00-\x1f\x7f]/.test(p)||p.split('/').some(bit=>
      bit==='.'||bit==='..'||bit.toLowerCase()==='.git'||
      bit==='node_modules'||bit==='vendor'||bit==='__pycache__'))bad();
 if(p&&p.split('/').some(x=>!x||x.length>200))bad();
 return p;
}
function validatedRoot(roots,args,fields){
 if(!args||typeof args!=='object'||Array.isArray(args)||
    Object.keys(args).some(k=>!['root',...fields].includes(k)))bad();
 const index=args.root??0;
 if(!Number.isInteger(index)||index<0||index>=roots.length)bad();
 return {root:roots[index],index};
}
async function scopedPath(root,rel){
 const lexical=resolve(root,rel);
 if(!within(root,lexical))bad();
 let actual;
 try{actual=await realpath(lexical);}
 catch{bad();}
 if(actual!==lexical||!within(root,actual))bad();
 return actual;
}
async function readSmallFile(path){
 let fd;
 try{
  fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  const st=await fd.stat();
  if(!st.isFile()||st.size>MAX_FILE)bad();
  const b=await fd.readFile();
  if(b.length>MAX_FILE)bad();
  const content=new TextDecoder('utf8',{fatal:true}).decode(b);
  if(content.includes('\0'))bad();
  return {bytes:b.length,content};
 }catch{bad();}
 finally{if(fd)await fd.close();}
}
export async function readLocalFileBundle(roots,args){
 const {root,index}=validatedRoot(roots,args,['paths']);
 if(!Array.isArray(args.paths)||args.paths.length<1||
   args.paths.length>MAX_BUNDLE_FILES)bad();
 const paths=args.paths.map(p=>validateRelative(p));
 if(new Set(paths).size!==paths.length)bad();
 const result=[];
 let total=0;
 for(const path of paths){
  const data=await readSmallFile(await scopedPath(root,path));
  total+=data.bytes;
  if(total>MAX_BUNDLE_BYTES)bad();
  result.push({path,bytes:data.bytes,content:data.content});
 }
 return {root:index,files:result,totalBytes:total,complete:true};
}
const omit=name=>name.startsWith('.')||
 ['node_modules','vendor','dist','build','coverage','__pycache__'].includes(name);
export async function readLocalWorkspaceTree(roots,args){
 const {root,index}=validatedRoot(roots,args,['path','depth']);
 const relative=validateRelative(args.path??'',true);
 const depth=args.depth??2;
 if(!Number.isInteger(depth)||depth<1||depth>MAX_DEPTH)bad();
 const start=await scopedPath(root,relative);
 let initial;
 try{initial=await stat(start);}
 catch{bad();}
 if(!initial.isDirectory())bad();
 const queue=[{dir:start,rel:relative,level:0}];
 const entries=[];
 let scanned=0,incomplete=false;
 while(queue.length){
  const next=queue.shift();
  let items;
  try{items=(await readdir(next.dir,{withFileTypes:true}))
    .sort((a,b)=>a.name.localeCompare(b.name));}
  catch{bad();}
  scanned+=items.length;
  if(scanned>MAX_SCANNED){incomplete=true;break;}
  for(const ent of items){
   if(omit(ent.name)||(!ent.isDirectory()&&!ent.isFile()))continue;
   const path=next.rel?next.rel+'/'+ent.name:ent.name;
   if(path.length>1024)continue;
   // Do not silently truncate a listed name into an unsafe path. Limit
   // the result itself so it fits the local MCP 8KiB inline budget.
   if(entries.length>=MAX_ENTRIES||
      Buffer.byteLength(JSON.stringify(entries),'utf8')>5200){
     incomplete=true;break;
   }
   entries.push({path,kind:ent.isDirectory()?'directory':'file'});
   if(ent.isDirectory()&&next.level+1<depth)
     queue.push({dir:resolve(next.dir,ent.name),rel:path,level:next.level+1});
  }
  if(incomplete)break;
 }
 return {root:index,path:relative,depth,entries,incomplete,
   scanned,complete:!incomplete};
}
