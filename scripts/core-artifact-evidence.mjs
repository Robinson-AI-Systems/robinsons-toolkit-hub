// Unpublished offline K-3 artifact inspection. Produces verifiable local evidence, not a release.
// Every temporary candidate is removed. Service adoption and independent money approval stay gated.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,lstatSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyCorePackage} from './verify-core-package.mjs';
import {verifyCoreSourceTrace} from './check-core-source-trace.mjs';

const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const sha1=bytes=>createHash('sha1').update(bytes).digest('hex');

export function inspectPackedCore(pack,expectedPaths,{sizeLimit=2000000}={}) {
  if(!pack || pack.name!=='robinson-mcp-core' ||
    !/^\d+\.\d+\.\d+$/.test(pack.version) ||
    typeof pack.filename!=='string' ||
    !/^robinson-mcp-core-\d+\.\d+\.\d+\.tgz$/.test(pack.filename) ||
    !Array.isArray(pack.files) || !Number.isSafeInteger(pack.size) ||
    pack.size<=0 || pack.size>sizeLimit || typeof pack.shasum!=='string' ||
    !/^[a-f0-9]{40}$/.test(pack.shasum)) {
    throw new Error('Invalid or excessive offline package metadata');
  }
  const actual=pack.files.map(item=>item?.path);
  if(actual.some(path=>typeof path!=='string' || !/^(package\.json|src\/[a-z][a-z0-9-]*\.js)$/.test(path)) ||
     new Set(actual).size!==actual.length ||
     JSON.stringify([...actual].sort())!==JSON.stringify([...expectedPaths].sort())) {
    throw new Error('Core tarball differs from explicitly reviewed source allowlist');
  }
  return Object.freeze({name:pack.name,version:pack.version,filename:pack.filename,
    bytes:pack.size,sha1:pack.shasum,files:Object.freeze([...actual].sort())});
}

export function buildOfflineCoreEvidence({root=repositoryRoot,packRunner=spawnSync}={}) {
  const pkg=verifyCorePackage(join(root,'packages/core'));
  const source=verifyCoreSourceTrace(root);
  if(source.releaseReady!==false)throw new Error('Release requires independent approved source parity');
  const tmp=mkdtempSync(join(tmpdir(),'rt-k3-artifact-'));
  try {
    const npm=process.platform==='win32'?'npm.cmd':'npm';
    const result=packRunner(npm,['pack','--workspace','packages/core','--json',
      '--ignore-scripts','--pack-destination',tmp],{
      cwd:root,encoding:'utf8',timeout:30000,
      env:{...process.env,npm_config_offline:'true',npm_config_audit:'false',
        npm_config_fund:'false',NODE_OPTIONS:''}
    });
    // Do not echo stderr/stdout if package scripts or environment change in the future.
    if(result.error || result.status!==0)throw new Error('Offline core packing failed');
    let metadata;
    try { const parsed=JSON.parse(result.stdout);metadata=parsed.length===1?parsed[0]:null; }
    catch {throw new Error('Offline pack metadata is not valid JSON');}
    const expected=['package.json',...pkg.modules];
    const inspected=inspectPackedCore(metadata,expected);
    if(inspected.version!==pkg.version)throw new Error('Packed version differs from local manifest');
    const file=join(tmp,inspected.filename);
    if(!lstatSync(file).isFile())throw new Error('Missing regular packed tarball');
    const bytes=readFileSync(file);
    if(bytes.byteLength!==inspected.bytes ||
       sha1(bytes)!==inspected.sha1)throw new Error('Packed archive size or checksum mismatch');
    return Object.freeze({
      name:inspected.name,version:inspected.version,
      sha256:sha256(bytes),bytes:bytes.byteLength,files:inspected.files,
      sourceMain:source.sourceMain,verbatim:source.verbatim,adapted:source.adapted,
      published:false,releaseReady:false,
      note:'Unpublished local archive proof; source parity and server adoption still gated'
    });
  } finally {rmSync(tmp,{recursive:true,force:true});}
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  try{
    const proof=buildOfflineCoreEvidence();
    // Digest is safe to print; credentials, path, tarball contents and runner output are never printed.
    console.log(JSON.stringify(proof,null,2));
  }catch(error){
    console.error('Offline K-3 evidence failed: '+error.message);
    process.exitCode=1;
  }
}
