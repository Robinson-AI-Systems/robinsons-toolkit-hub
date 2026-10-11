// Deterministic offline source trace; no GitHub API, package publication or runtime imports.
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync} from 'node:fs';
import {resolve,join,relative,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const hex40=/^[a-f0-9]{40}$/;
const isInside=(root,file)=>file.startsWith(root+sep);
export const gitBlobSha=contents=>{
  const buf=Buffer.isBuffer(contents)?contents:Buffer.from(contents);
  return createHash('sha1').update(Buffer.from('blob '+buf.length+'\0')).update(buf).digest('hex');
};
function regular(root,path) {
  const file=resolve(root,path);
  if(!isInside(root,file)||!lstatSync(file).isFile()) {
    throw new Error('Source trace path is not a regular repo file');
  }
  return file;
}
export function verifyCoreSourceTrace(root,{manifest='docs/audits/K3-SOURCE-TRACE.json'}={}) {
  root=resolve(root);
  const data=JSON.parse(readFileSync(regular(root,manifest),'utf8'));
  const pkg=JSON.parse(readFileSync(regular(root,'packages/core/package.json'),'utf8'));
  if(data.schema!==1||data.sourceRepository!=='Robinson-AI-Systems/stripe-mcp'||
     !hex40.test(data.sourceMain)||data.status!=='PARTIAL_PRIVATE_NOT_RELEASED') {
    throw new Error('K-3 source baseline or release status is invalid');
  }
  if(pkg.private!==true)throw new Error('Source trace cannot authorize core publication');
  const names=Object.keys(pkg.exports||{}).sort();
  if(JSON.stringify(names)!==JSON.stringify(Object.keys(data.modules||{}).sort())) {
    throw new Error('Source trace does not cover every exported module');
  }
  let verbatim=0,adapted=0;
  for(const name of names) {
    const unit=data.modules[name];
    if(!unit||pkg.exports[name]!==unit.target||
       !/^src\/core\/[a-z][a-z0-9-]*\.js$/.test(unit.sourceFile)||
       !hex40.test(unit.sourceBlob)||!hex40.test(unit.coreBlob)) {
      throw new Error('Incomplete or inconsistent source mapping for '+name);
    }
    const target=regular(root,'packages/core/'+unit.target.slice(2));
    if(gitBlobSha(readFileSync(target))!==unit.coreBlob) {
      throw new Error('Core source changed without reviewed trace update: '+name);
    }
    if(!Array.isArray(unit.tests)||!unit.tests.length||
       !Array.isArray(unit.serverOwned)||!unit.serverOwned.length) {
      throw new Error('Missing source tests or server-owned boundary: '+name);
    }
    for(const t of unit.tests) {
      if(!/^((packages\/core\/test)|(tests\/db))\/[\w/-]+\.test\.js$/.test(t)) {
        throw new Error('Unapproved parity test path: '+name);
      }
      regular(root,t);
    }
    if(unit.kind==='verbatim') {
      if(unit.sourceBlob!==unit.coreBlob) {
        throw new Error('Verbatim extraction differs from pinned upstream source: '+name);
      }
      verbatim++;
    } else if(unit.kind==='adapted') {
      if(unit.sourceBlob===unit.coreBlob)throw new Error('Adaptation has no source delta: '+name);
      adapted++;
    } else throw new Error('Unknown source disposition: '+name);
  }
  return Object.freeze({sourceMain:data.sourceMain,verbatim,adapted,
    releaseReady:false});
}
const main=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main) {
  try {
    const proof=verifyCoreSourceTrace(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
    console.log('Core source trace valid: '+proof.verbatim+' byte-identical, '+
      proof.adapted+' adapted, release not certified');
  }catch(error){
    console.error('Core source trace failed: '+error.message);
    process.exitCode=1;
  }
}
