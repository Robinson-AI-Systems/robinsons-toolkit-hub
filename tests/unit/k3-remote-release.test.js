import {createHash} from 'node:crypto';
import {describe,it,expect,vi} from 'vitest';
import {validateK3CandidateEvidence,verifyK3RemoteRelease} from '../../scripts/verify-k3-remote-release.mjs';
const repo='Robinson-AI-Systems/robinsons-toolkit-hub';
const tag='v0.1.0',commit='a'.repeat(40),body=Buffer.from('offline-review-only-archive');
const m={schema:1,repository:repo,tag,version:'0.1.0',commit,
  assetName:'robinson-mcp-core-0.1.0.tgz',bytes:body.length,
  sha256:createHash('sha256').update(body).digest('hex')};
const url='https://github.com/'+repo+'/releases/download/'+tag+'/'+m.assetName;
const release={draft:false,prerelease:false,published_at:'2026-10-11T00:00:00Z',
  tag_name:tag,assets:[{name:m.assetName,size:m.bytes,digest:'sha256:'+m.sha256,
    state:'uploaded',browser_download_url:url}]};
const result=(value,status=200)=>new Response(JSON.stringify(value),
  {status,headers:{'Content-Type':'application/json'}});
function fixture({rel=release,ref={object:{type:'commit',sha:commit}},binary=body}={}){
  return vi.fn(async requestUrl=>{
    if(requestUrl.includes('/releases/tags/'))return result(rel);
    if(requestUrl.includes('/git/ref/tags/'))return result(ref);
    if(requestUrl.includes('/git/tags/'))return result({tag,object:{type:'commit',sha:commit}});
    if(requestUrl===url)return new Response(binary);
    throw Error('unexpected URL');
  });
}
describe('K-3 final remote release verifier (offline GitHub response simulation)',()=>{
  it('requires an exact final candidate, not locally inferred version or digest',()=>{
    expect(validateK3CandidateEvidence(m).commit).toBe(commit);
    for(const invalid of [{...m,tag:'latest'},{...m,assetName:'other.tgz'},
      {...m,bytes:0},{...m,sha256:'0'.repeat(40)},{...m,repository:'elsewhere'}])
      expect(()=>validateK3CandidateEvidence(invalid)).toThrow();
  });
  it('verifies remote tag, release metadata AND downloaded archive SHA256',async()=>{
    const fetchImpl=fixture();
    const actual=await verifyK3RemoteRelease(m,{fetchImpl});
    expect(actual).toMatchObject({verified:true,bytes:body.length,sha256:m.sha256});
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it('accepts a correctly dereferenced annotated tag',async()=>{
    const f=fixture({ref:{object:{type:'tag',sha:'b'.repeat(40)}}});
    await expect(verifyK3RemoteRelease(m,{fetchImpl:f})).resolves.toHaveProperty('verified',true);
    expect(f).toHaveBeenCalledTimes(4);
  });
  it('refuses draft, tag mismatch, duplicated or inaccurate archive metadata',async()=>{
    for(const rel of [{...release,draft:true},{...release,tag_name:'v9.9.9'},
      {...release,assets:[release.assets[0],release.assets[0]]},
      {...release,assets:[{...release.assets[0],digest:'sha256:'+'b'.repeat(64)}]},
      {...release,assets:[{...release.assets[0],browser_download_url:'https://evil.invalid/archive'}]}]){
      await expect(verifyK3RemoteRelease(m,{fetchImpl:fixture({rel})})).rejects.toThrow();
    }
  });
  it('rejects tag displacement, interrupted streams and tampered remote bytes',async()=>{
    await expect(verifyK3RemoteRelease(m,{fetchImpl:fixture({
      ref:{object:{type:'commit',sha:'b'.repeat(40)}}})})).rejects.toThrow(/commit/);
    await expect(verifyK3RemoteRelease(m,{fetchImpl:fixture({binary:Buffer.from('tampered')})}))
      .rejects.toThrow(/bytes or SHA256/);
    await expect(verifyK3RemoteRelease(m,{fetchImpl:fixture({binary:Buffer.concat([body,body])})}))
      .rejects.toThrow(/exceeds/);
    await expect(verifyK3RemoteRelease(m,{fetchImpl:async()=>{throw Error('offline')}}))
      .rejects.toThrow(/unavailable/);
  });
});
