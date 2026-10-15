// L-1 detailed, opt-in read-only Git inspection for local coding agents.
// Fixed argv only, the same reviewed bounded git child-process runner,
// no provider connectivity, hooks, external diffs, pager or shell.
import {runReadOnlyGit} from './local-git.js';
import {ToolError} from './http.js';
const reject=()=>{throw new ToolError('Local Git detail inspection refused',-32602);};
const safePath=path=>typeof path==='string'&&path.length>=1&&
 path.length<=1024&&!/^[a-zA-Z]:/.test(path)&&!path.startsWith('/')&&
 !path.includes('\\')&&!/[\x00-\x1f\x7f]/.test(path)&&
 path.split('/').every(part=>part&&part!=='.'&&part!=='..'&&
  part.toLowerCase()!=='.git'&&part.length<=200)&&
 !path.startsWith('-')&&!path.includes(':');
const sha40=/^[a-f0-9]{40}$/;
const str={type:'string',minLength:1,maxLength:1024};
const root={type:'integer',minimum:0};
const schema=(args,required)=>({type:'object',additionalProperties:false,
 properties:{root,...args},required});
const annotation={readOnlyHint:true,destructiveHint:false,
 idempotentHint:true,openWorldHint:false};
export const LOCAL_GIT_DETAIL_TOOLS=Object.freeze([
 {name:'local.git_diff_file',
  description:'Read a bounded actual Git patch for one approved tracked file, not just the diff statistic.',
  inputSchema:schema({path:str,staged:{type:'boolean'}},['path'])},
 {name:'local.git_file_at_commit',
  description:'Read a bounded tracked file snapshot from an exact immutable 40-hex Git commit, without worktree changes.',
  inputSchema:schema({path:str,commit:{type:'string',pattern:'^[a-f0-9]{40}$'}},['path','commit'])},
 {name:'local.git_tracked_files',
  description:'List at most 100 actual Git-tracked source paths from one approved local repo, no untracked files.',
  inputSchema:schema({},[])},
 {name:'local.git_file_history',
  description:'Read at most 10 commit subjects touching one approved tracked path, without rewriting refs.',
  inputSchema:schema({path:str},['path'])}
].map(x=>Object.freeze({...x,annotations:Object.freeze({...annotation})})));
function options(name,args){
 const fields=name==='local.git_tracked_files'?['root']:
  name==='local.git_diff_file'?['root','path','staged']:
  name==='local.git_file_at_commit'?['root','path','commit']:
  name==='local.git_file_history'?['root','path']:null;
 if(!fields||!args||typeof args!=='object'||Array.isArray(args)||
   Object.keys(args).some(k=>!fields.includes(k))||
   (args.root!==undefined&&(!Number.isInteger(args.root)||args.root<0))||
   (name!=='local.git_tracked_files'&&!safePath(args.path))||
   (name==='local.git_file_at_commit'&&!sha40.test(args.commit||''))||
   (name==='local.git_diff_file'&&args.staged!==undefined&&
     typeof args.staged!=='boolean'))
   reject();
 if(name==='local.git_tracked_files')
  return ['ls-files','--cached','-z','--'];
 if(name==='local.git_diff_file')
  return ['diff','--no-ext-diff','--no-textconv',
   ...(args.staged?['--cached']:[]),'--',args.path];
 if(name==='local.git_file_history')
  return ['log','--max-count=10','--format=%h %s','--',args.path];
 // A full immutable commit ID + a validated in-repo path.
 // Never accept revision expressions, selectors, flags, glob or URL syntax.
 return ['show','--no-ext-diff','--no-textconv',args.commit+':'+args.path];
}
export async function inspectLocalGitDetail(name,root,args){
 const cmd=options(name,args);
 let stdout;
 try {stdout=await runReadOnlyGit(root,cmd);}
 catch{reject();}
 if(name==='local.git_tracked_files'){
  if(stdout&&!stdout.endsWith('\0'))reject();
  const names=stdout?stdout.slice(0,-1).split('\0'):[];
  // No silent partial list: refuse unexpectedly large inventory. A caller
  // can opt into an appropriately bounded narrower directory in future.
  if(names.length>100||names.some(path=>!safePath(path)))reject();
  return {action:name,files:names,count:names.length,incomplete:false};
 }
 if(stdout.includes('\0')||
   Buffer.byteLength(stdout,'utf8')>4096)reject();
 return {action:name,path:args.path,output:stdout,
  ...(name==='local.git_file_at_commit'?{commit:args.commit}:{}),
  ...(name==='local.git_diff_file'?{staged:args.staged===true}:{})};
}
