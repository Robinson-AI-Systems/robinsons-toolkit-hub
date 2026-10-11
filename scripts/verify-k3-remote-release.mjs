// Authenticated/public GitHub REST release evidence checker. READ ONLY.
// A local npm pack or fabricated REST fixture never authorizes publication.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const repo='Robinson-AI-Systems/robinsons-toolkit-hub';
const api='https://api.github.com/repos/'+repo;
function fail(message){throw Error('K-3 remote Release proof: '+message);}
const hash=/^[0-9a-f]{64}$/;
const commitHash=/^[0-9a-f]{40}$/;
export function validateK3CandidateEvidence(expected){
  if(!expected||expected.schema!==1||expected.repository!==repo||
    !/^v\d+\.\d+\.\d+$/.test(expected.tag)||
    !commitHash.test(expected.commit||'')||
    expected.version!==expected.tag.slice(1)||
    expected.assetName!=='robinson-mcp-core-'+expected.version+'.tgz'||
    !Number.isSafeInteger(expected.bytes)||expected.bytes<1||expected.bytes>50_000_000||
    !hash.test(expected.sha256||'')){
    fail('requires an independently reviewed immutable candidate manifest');
  }
  return Object.freeze({...expected});
}
export async function verifyK3RemoteRelease(expected,{fetchImpl=globalThis.fetch,signal}={}){
  const m=validateK3CandidateEvidence(expected);
  if(typeof fetchImpl!=='function')fail('HTTPS transport missing');
  async function request(url,accept){
    let res;
    try{res=await fetchImpl(url,{headers:{Accept:accept},signal});}
    catch{fail('remote request unavailable');}
    if(!res?.ok)fail('remote request failed ('+String(res?.status||'unknown')+')');
    return res;
  }
  async function getJson(url){
    const res=await request(url,'application/vnd.github+json');
    try{return await res.json();}catch{fail('unreadable GitHub REST JSON');}
  }
  const release=await getJson(api+'/releases/tags/'+encodeURIComponent(m.tag));
  if(release?.draft!==false||release?.prerelease!==false||
    release.tag_name!==m.tag||!release.published_at){
    fail('no published final release for requested tag');
  }
  const tag=await getJson(api+'/git/ref/tags/'+encodeURIComponent(m.tag));
  let object=tag?.object;
  if(object?.type==='tag'){
    const annotated=await getJson(api+'/git/tags/'+encodeURIComponent(object.sha));
    if(annotated.tag!==m.tag)fail('annotated tag name changed');
    object=annotated.object;
  }
  if(object?.type!=='commit'||object.sha!==m.commit){
    fail('remote tag does not resolve to approved candidate commit');
  }
  const matches=(release.assets||[]).filter(x=>x.name===m.assetName);
  if(matches.length!==1||matches[0].state!=='uploaded'||matches[0].size!==m.bytes||
    matches[0].digest!=='sha256:'+m.sha256){
    fail('uploaded asset name, size, state or remote digest differs');
  }
  const asset=matches[0];
  const expectedUrl='https://github.com/'+repo+'/releases/download/'+m.tag+'/'+m.assetName;
  if(asset.browser_download_url!==expectedUrl)fail('unexpected asset download host or path');
  const body=await request(expectedUrl,'application/octet-stream');
  if(!body.body||typeof body.body[Symbol.asyncIterator]!=='function')fail('archive stream unavailable');
  const h=createHash('sha256');let bytes=0;
  try{
    for await(const part of body.body){
      bytes+=part.byteLength;
      if(bytes>m.bytes)fail('remote archive exceeds candidate size');
      h.update(part);
    }
  }catch(error){if(error.message.startsWith('K-3 remote Release proof:'))throw error;
    fail('remote archive stream was interrupted');}
  if(bytes!==m.bytes||h.digest('hex')!==m.sha256){
    fail('downloaded archive bytes or SHA256 mismatch');
  }
  return Object.freeze({verified:true,tag:m.tag,commit:m.commit,asset:m.assetName,bytes,
    sha256:m.sha256,releaseUrl:'https://github.com/'+repo+'/releases/tag/'+m.tag});
}
if(process.argv[1]&&process.argv[1]===fileURLToPath(import.meta.url)){
  const path=process.argv[2];
  if(!path){console.error('Supply an independently approved final candidate JSON path; nothing published.');process.exitCode=1;}
  else {
    const timeout=new AbortController();const timer=setTimeout(()=>timeout.abort(),30000);
    try {
      const proof=await verifyK3RemoteRelease(JSON.parse(readFileSync(path,'utf8')),{signal:timeout.signal});
      console.log('Verified real remote archive at '+proof.releaseUrl+' SHA256='+proof.sha256);
    } catch(error){console.error(error.message);process.exitCode=1;}
    finally{clearTimeout(timer);}
  }
}
