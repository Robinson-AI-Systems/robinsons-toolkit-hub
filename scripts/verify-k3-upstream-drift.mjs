// Explicit online source-drift probe. NOT a release gate or authorization.
// CI tests inject an offline fetch; operator invocation checks real GitHub REST.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {githubEvidenceJson} from './github-evidence-json.mjs';
const endpoint='https://api.github.com/repos/Robinson-AI-Systems/stripe-mcp';
const sha=/^[a-f0-9]{40}$/;
function fail(message){throw new Error('K-3 upstream drift: '+message);}
export function compareK3UpstreamTree(manifest,head,tree){
  if(manifest?.schema!==1||manifest.sourceRepository!=='Robinson-AI-Systems/stripe-mcp'||
    manifest.disposition!=='REVIEWED_SNAPSHOT_NOT_RELEASE'||!sha.test(manifest.reviewedMain)||
    !sha.test(head)||tree?.truncated!==false||!Array.isArray(tree.tree)){
    fail('invalid baseline, head or incomplete upstream tree');
  }
  const changed=[],missing=[];
  const paths=new Map(tree.tree.filter(x=>x.type==='blob').map(x=>[x.path,x.sha]));
  const expected={...manifest.source,...manifest.tests};
  if(Object.keys(manifest.source).length!==11||Object.keys(manifest.tests).length<8){
    fail('source or original test suite coverage was reduced');
  }
  for(const [path,blob] of Object.entries(expected)){
    if(!/^(src\/core|tests\/unit)\/[a-z0-9-]+(?:\.test)?\.js$/.test(path)||
       !sha.test(blob)) fail('invalid reviewed path or blob');
    const actual=paths.get(path);
    if(!actual)missing.push(path);
    else if(actual!==blob)changed.push({path,expected:blob,actual});
  }
  // Runtime-module drift demands adapter/source review; test-only drift demands
  // assertion and catalog reconciliation. Neither may silently count as clean.
  const sourceChanged=changed.filter(x=>Object.hasOwn(manifest.source,x.path));
  const testChanged=changed.filter(x=>Object.hasOwn(manifest.tests,x.path));
  const sourceMissing=missing.filter(path=>Object.hasOwn(manifest.source,path));
  const testMissing=missing.filter(path=>Object.hasOwn(manifest.tests,path));
  return Object.freeze({reviewedMain:manifest.reviewedMain,currentMain:head,
    unchanged:missing.length===0&&changed.length===0,
    sourceUnchanged:sourceChanged.length===0&&sourceMissing.length===0,
    ahead:head!==manifest.reviewedMain,examined:Object.keys(expected).length,
    missing,changed,sourceChanged,testChanged,sourceMissing,testMissing});
}
export async function verifyK3UpstreamDrift(manifest,{fetchImpl=globalThis.fetch,signal}={}){
  if(typeof fetchImpl!=='function')fail('fetch transport unavailable');
  const json=url=>githubEvidenceJson(fetchImpl,url,{
    signal,
    unavailable:'K-3 upstream drift: upstream unreachable; no inferred source compatibility',
    failed:status=>'K-3 upstream drift: upstream API returned '+status,
    malformed:'K-3 upstream drift: malformed upstream JSON'
  });
  const branch=await json(endpoint+'/branches/main');
  const head=branch?.commit?.sha;
  if(!sha.test(head||''))fail('upstream head SHA missing');
  const tree=await json(endpoint+'/git/trees/'+head+'?recursive=1');
  return compareK3UpstreamTree(manifest,head,tree);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const manifest=JSON.parse(readFileSync(new URL('../docs/audits/K3-UPSTREAM-BASELINE.json',import.meta.url)));
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const report=await verifyK3UpstreamDrift(manifest,{signal:controller.signal});
    if(!report.unchanged)fail('review required: '+JSON.stringify({missing:report.missing,changed:report.changed}));
    console.log('Upstream checked at '+report.currentMain+': '+report.examined+
      ' source/test blobs unchanged; still private, not release-certified.');
  }catch(error){console.error(error.message);process.exitCode=1;}
  finally{clearTimeout(timer);}
}
