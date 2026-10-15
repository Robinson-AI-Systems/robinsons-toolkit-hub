// L-1: the local-only, owner-confirmed developer refactor door.
// Every mutation requires an exact SHA-256 of an already existing regular
// file, an explicit confirm:true and an enabled canonical local root.
// No arbitrary shell, provider account or Git remote is involved.
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {open,realpath,link,unlink} from 'node:fs/promises';
import {ToolError} from './http.js';
import {resolveLocalWriteTarget} from './local-file-create.js';
import {hashLocalFile,updateConfirmedLocalFile} from './local-file-update.js';

const digest=/^[a-f0-9]{64}$/;
const MAX_PATCHES=16,MAX_EDIT=4096,MAX_NEW=16384;
const refused=()=>{throw new ToolError('Local confirmed refactor refused',-32602);};
const annotations=Object.freeze({readOnlyHint:false,destructiveHint:true,
 idempotentHint:false,openWorldHint:false});
const rootProperty={type:'integer',minimum:0};
const fileProperty={type:'string',minLength:1,maxLength:1024};
const digestProperty={type:'string',pattern:'^[a-f0-9]{64}$'};
const approveProperty={type:'boolean',const:true};
export const LOCAL_FILE_REFACTOR_TOOLS=Object.freeze([
 Object.freeze({
  name:'local.file_patch',
  description:'Apply 1–16 unique exact literal text replacements to a SHA-256-verified local file. Confirm required; refuses ambiguous or stale edits.',
  inputSchema:{type:'object',additionalProperties:false,
   properties:{root:rootProperty,path:fileProperty,
    expectedSha256:digestProperty,confirm:approveProperty,
    changes:{type:'array',minItems:1,maxItems:MAX_PATCHES,
     items:{type:'object',additionalProperties:false,
      properties:{before:{type:'string',minLength:1,maxLength:MAX_EDIT},
       after:{type:'string',maxLength:MAX_EDIT}},required:['before','after']}}},
   required:['path','expectedSha256','confirm','changes']},
  annotations
 }),
 Object.freeze({
  name:'local.file_move',
  description:'Move a verified local regular file to an unoccupied path in the SAME approved root. Hash and confirm required; never overwrite.',
  inputSchema:{type:'object',additionalProperties:false,
   properties:{root:rootProperty,path:fileProperty,to:fileProperty,
    expectedSha256:digestProperty,confirm:approveProperty},
   required:['path','to','expectedSha256','confirm']},
  annotations
 }),
 Object.freeze({
  name:'local.file_delete',
  description:'Permanently unlink one regular file only with explicit confirmation and its current exact SHA-256, inside approved root.',
  inputSchema:{type:'object',additionalProperties:false,
   properties:{root:rootProperty,path:fileProperty,
    expectedSha256:digestProperty,confirm:approveProperty},
   required:['path','expectedSha256','confirm']},
  annotations
 })
]);

function checkedArguments(args,extra) {
 if(!args||typeof args!=='object'||Array.isArray(args)||
    args.confirm!==true||typeof args.path!=='string'||
    typeof args.expectedSha256!=='string'||!digest.test(args.expectedSha256)||
    Object.keys(args).some(k=>!['root','path','expectedSha256','confirm',...extra].includes(k)))
  refused();
}
function pairEqual(before,now) {
 return before.sha256===now.sha256 &&
    before.info.ino===now.info.ino &&
    before.info.dev===now.info.dev &&
    before.info.mtimeNs===now.info.mtimeNs &&
    before.info.ctimeNs===now.info.ctimeNs;
}
async function verifiedSource(roots,args){
 const resolved=await resolveLocalWriteTarget(roots,{
   root:args.root,path:args.path,content:'',confirm:true
 });
 const {target}=resolved;
 let canonical;
 try {canonical=await realpath(target);}catch{refused();}
 if(canonical!==target)refused(); // no symlinked source leaf
 const original=await hashLocalFile(target);
 if(original.sha256!==args.expectedSha256)refused();
 // Refuse operations on multi-linked files: moving/deleting would change
 // which caller can see this inode, and could surprise other processes.
 if(original.info.nlink!==1n)refused();
 return {...resolved,original};
}
async function noFollowText(file,expected) {
 let handle;
 try {
  handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
  const st=await handle.stat({bigint:true});
  if(!st.isFile()||st.size>256n*1024n)refused();
  const bytes=await handle.readFile();
  if(bytes.length>256*1024||
    createHash('sha256').update(bytes).digest('hex')!==expected)refused();
  const value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(value.includes('\0'))refused();
  return value;
 }catch{refused();}
 finally{if(handle)await handle.close();}
}
function checkedEdits(changes){
 if(!Array.isArray(changes)||changes.length<1||changes.length>MAX_PATCHES)
  refused();
 return changes.map(change=>{
  if(!change||typeof change!=='object'||Array.isArray(change)||
     Object.keys(change).some(k=>!['before','after'].includes(k))||
     typeof change.before!=='string'||typeof change.after!=='string'||
     !change.before||change.before===change.after||
     Buffer.byteLength(change.before,'utf8')>MAX_EDIT||
     Buffer.byteLength(change.after,'utf8')>MAX_EDIT||
     change.before.includes('\0')||change.after.includes('\0'))refused();
  return {before:change.before,after:change.after};
 });
}
export function applyExactLiteralChanges(content,changes){
 if(typeof content!=='string')refused();
 let value=content;
 for(const {before,after} of checkedEdits(changes)){
  const start=value.indexOf(before);
  if(start<0||start!==value.lastIndexOf(before))refused();
  value=value.slice(0,start)+after+value.slice(start+before.length);
  if(Buffer.byteLength(value,'utf8')>MAX_NEW)refused();
 }
 if(value===content)refused();
 return value;
}
export async function patchConfirmedLocalFile(roots,args){
 checkedArguments(args,['changes']);
 // Treat exact-patch previews as private: only edit count/bytes/digest
 // are returned. The old and new file content never appears in MCP output.
 const changes=checkedEdits(args.changes);
 const original=await verifiedSource(roots,args);
 const current=await noFollowText(original.target,args.expectedSha256);
 const updated=applyExactLiteralChanges(current,changes);
 const result=await updateConfirmedLocalFile(roots,{
  path:args.path,root:args.root,content:updated,
  expectedSha256:args.expectedSha256,confirm:true
 });
 return {patched:true,root:original.index,path:original.relative,
  replacements:changes.length,bytes:result.bytes,sha256:result.sha256};
}
async function acquireFileLock(path) {
 let handle;
 try{handle=await open(path+'.rtool-lock',constants.O_WRONLY|
   constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);}
 catch{refused();}
 return async()=>{
  await handle.close().catch(()=>{});
  await unlink(path+'.rtool-lock').catch(()=>{});
 };
}
async function protectedUnlink(roots,args,{destination=null}={}){
 const original=await verifiedSource(roots,args);
 let targetInfo=null;
 if(destination!==null){
  if(typeof destination!=='string'||!destination||destination===args.path)
   refused();
  targetInfo=await resolveLocalWriteTarget(roots,{
   root:args.root,path:destination,content:'',confirm:true
  });
  if(targetInfo.index!==original.index||targetInfo.target===original.target)
   refused();
 }
 const unlock=await acquireFileLock(original.target);
 let linked=false;
 try{
  const current=await hashLocalFile(original.target);
  if(!pairEqual(original.original,current))refused();
  if(targetInfo){
   // Hard-linking is an atomic NO-REPLACE publication: existing files
   // and destination symlinks both cause refusal, not replacement.
   await link(original.target,targetInfo.target);
   linked=true;
   const atNew=await hashLocalFile(targetInfo.target);
   const atOld=await hashLocalFile(original.target);
   // A successful hard-link publication legitimately changes inode ctime
   // and link count; recheck its bytes, inode, device and mtime, not ctime.
   if(atOld.sha256!==original.original.sha256||
      atOld.info.ino!==original.original.info.ino||
      atOld.info.dev!==original.original.info.dev||
      atOld.info.mtimeNs!==original.original.info.mtimeNs||
      atNew.sha256!==original.original.sha256||
      atNew.info.ino!==original.original.info.ino||
      atNew.info.dev!==original.original.info.dev)refused();
  }
  // Explicit deletion is the last irreversible step. This guard protects
  // only cooperating local-tool writes; no kernel-wide CAS is claimed.
  const final=await hashLocalFile(original.target);
  if(final.sha256!==original.original.sha256||
     final.info.ino!==original.original.info.ino||
     final.info.dev!==original.original.info.dev||
     final.info.mtimeNs!==original.original.info.mtimeNs)refused();
  await unlink(original.target);
  linked=false;
  return {root:original.index,path:original.relative,
   sha256:original.original.sha256,
   ...(targetInfo?{moved:true,to:targetInfo.relative}:{deleted:true})};
 }catch{refused();}
 finally{
  if(linked)await unlink(targetInfo.target).catch(()=>{});
  await unlock();
 }
}
export async function moveConfirmedLocalFile(roots,args){
 checkedArguments(args,['to']);
 return protectedUnlink(roots,args,{destination:args.to});
}
export async function deleteConfirmedLocalFile(roots,args){
 checkedArguments(args,[]);
 return protectedUnlink(roots,args);
}
