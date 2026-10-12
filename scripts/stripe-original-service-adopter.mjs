// Genuine, bounded K-3 private archive adoption rehearsal against original Stripe service.
// Mutate ONLY the disposable CI checkout; never the upstream repository or a deployed service.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gitBlobSha} from './check-core-source-trace.mjs';
import {verifyCorePackage} from './verify-core-package.mjs';
import {inspectPackedCore} from './core-artifact-evidence.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const originalLeafExports=Object.freeze([
  './oauth','./crypto','./registry','./write-contract-check'
]);
export const originalAdopterTests=Object.freeze([
  'tests/unit/oauth-core.test.js','tests/unit/keys.test.js',
  'tests/unit/registry.test.js','tests/unit/write-metadata.test.js',
  'tests/unit/oauth-handlers.test.js'
]);
export function validateOriginalAdoptionPlan({baseline,trace,sourceHead}) {
  if(baseline?.disposition!=='REVIEWED_SNAPSHOT_NOT_RELEASE'||
    !/^[a-f0-9]{40}$/.test(sourceHead||'')||
    sourceHead!==baseline.reviewedMain||trace?.status!=='PARTIAL_PRIVATE_NOT_RELEASED')
    throw new Error('Original Stripe checkout is not the reviewed private source');
  const plans=originalLeafExports.map(name=>{
    const record=trace.modules?.[name];
    const src=record?.sourceFile;
    if(record?.kind!=='verbatim'||typeof src!=='string'||
      !/^src\/core\/[a-z-]+\.js$/.test(src)||
      record.sourceBlob!==baseline.source?.[src]||
      record.coreBlob!==record.sourceBlob||
      !/^[a-f0-9]{40}$/.test(record.sourceBlob)||
      record.target!=='./src/'+name.slice(2)+'.js')
      throw new Error('Private package leaf differs from the reviewed original service');
    return Object.freeze({exportName:name,sourceFile:src,blob:record.sourceBlob});
  });
  for(const test of originalAdopterTests){
    if(!/^[a-f0-9]{40}$/.test(baseline.tests?.[test]||''))
      throw new Error('Original adopting-service assertion suite is not pinned');
  }
  return Object.freeze({sourceHead,plans:Object.freeze(plans)});
}
const run=(command,args,cwd,timeout=60000)=>{
  const result=spawnSync(command,args,{cwd,encoding:'utf8',timeout,
    env:{...process.env,NODE_OPTIONS:'',npm_config_offline:'true',
      npm_config_audit:'false',npm_config_fund:'false'}});
  if(result.error||result.status!==0)
    throw new Error('Original-service adoption command refused ('+
      command.split(/[\\/]/).at(-1)+', exit '+String(result.status)+')');
  return result.stdout;
};
export function verifyPrivateAdoption() {
  const source=join(root,'source-stripe');
  const baseline=JSON.parse(readFileSync(join(root,'docs/audits/K3-UPSTREAM-BASELINE.json'),'utf8'));
  const trace=JSON.parse(readFileSync(join(root,'docs/audits/K3-SOURCE-TRACE.json'),'utf8'));
  const sourceHead=run('git',['rev-parse','HEAD'],source).trim();
  const plan=validateOriginalAdoptionPlan({baseline,trace,sourceHead});
  const originalFiles=new Map();
  const temp=mkdtempSync(join(tmpdir(),'k3-private-stripe-adopt-'));
  const install=join(source,'node_modules','robinson-mcp-core');
  const npm=process.platform==='win32'?'npm.cmd':'npm';
  const npx=process.platform==='win32'?'npx.cmd':'npx';
  try {
    if(existsSync(install))throw new Error('Original checkout already has private core installed');
    for(const {sourceFile,blob} of plan.plans){
      const file=join(source,sourceFile);
      const bytes=readFileSync(file);
      if(gitBlobSha(bytes)!==blob)throw new Error('Original source module blob mismatch');
      originalFiles.set(file,bytes);
    }
    for(const test of originalAdopterTests){
      if(gitBlobSha(readFileSync(join(source,test)))!==baseline.tests[test])
        throw new Error('Original Stripe test assertion blob mismatch');
    }
    const output=run(npm,['pack','--workspace','packages/core','--json',
      '--ignore-scripts','--pack-destination',temp],root);
    const listed=JSON.parse(output);
    if(!Array.isArray(listed)||listed.length!==1)
      throw new Error('Ambiguous private package build');
    const pkg=verifyCorePackage(join(root,'packages/core'));
    const packed=inspectPackedCore(listed[0],['package.json',...pkg.modules]);
    const tarball=join(temp,packed.filename);
    const bytes=readFileSync(tarball);
    if(statSync(tarball).size!==packed.bytes)
      throw new Error('Private package was changed after metadata verification');
    mkdirSync(install,{recursive:true});
    run('tar',['-xzf',tarball,'-C',install,'--strip-components=1'],root);
    const installed=JSON.parse(readFileSync(join(install,'package.json'),'utf8'));
    if(installed.private!==true||installed.name!=='robinson-mcp-core')
      throw new Error('The installed private package identity differs');
    for(const {exportName,sourceFile} of plan.plans){
      writeFileSync(join(source,sourceFile),
        'export * from '+JSON.stringify('robinson-mcp-core/'+exportName.slice(2))+';\n');
    }
    // The original, blob-verified Stripe assertion bodies execute against
    // its real server imports, now routed through the installed core tarball.
    run(npx,['--no-install','vitest','run','--config','vitest.config.js',
      ...originalAdopterTests],source,90000);
    return Object.freeze({source:sourceHead,overlaidOriginalModules:plan.plans.length,
      unchangedOriginalTests:originalAdopterTests.length,
      privateArchiveSha256:createHash('sha256').update(bytes).digest('hex'),
      serviceRepoModified:false,serviceDeployed:false,
      adapterOwnedSqlAndMoneyApprovalProven:false,releaseReady:false});
  }finally{
    for(const [file,bytes] of originalFiles)writeFileSync(file,bytes);
    rmSync(install,{recursive:true,force:true});
    rmSync(temp,{recursive:true,force:true});
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(verifyPrivateAdoption()));}
  catch(error){console.error('Private K-3 source adopter: '+error.message);
    process.exitCode=1;}
}
