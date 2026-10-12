import {describe,it,expect,vi} from 'vitest';
import {compareK3UpstreamTree,verifyK3UpstreamDrift} from '../../scripts/verify-k3-upstream-drift.mjs';
import {readFileSync} from 'node:fs';
const baseline=JSON.parse(readFileSync(new URL('../../docs/audits/K3-UPSTREAM-BASELINE.json',import.meta.url),'utf8'));
const main=baseline.reviewedMain;
const tree=()=>({truncated:false,tree:Object.entries({...baseline.source,...baseline.tests})
  .map(([path,sha])=>({path,sha,type:'blob'}))});
const fetcher=(head=main,blobTree=tree())=>vi.fn(async url=>({
  ok:true,status:200,json:async()=>url.includes('/branches/main')?
    {commit:{sha:head}}:blobTree
}));
describe('K-3 authentic-upstream drift probe (offline transport fixture)',()=>{
  it('pins all eleven runtime source modules and eight original test suites',()=>{
    const report=compareK3UpstreamTree(baseline,main,tree());
    expect(report).toMatchObject({unchanged:true,ahead:false,examined:19});
  });
  it('detects a new head without declaring source changes or release readiness',async()=>{
    const head='a'.repeat(40),fetchImpl=fetcher(head);
    const report=await verifyK3UpstreamDrift(baseline,{fetchImpl});
    expect(report).toMatchObject({ahead:true,unchanged:true,currentMain:head});
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toContain(head+'?recursive=1');
  });
  it('pinpoints altered blobs and deleted original suites',()=>{
    const t=tree();t.tree[0].sha='b'.repeat(40);
    t.tree=t.tree.filter(x=>x.path!=='tests/unit/oauth-handlers.test.js');
    const result=compareK3UpstreamTree(baseline,main,t);
    expect(result.changed.map(x=>x.path)).toEqual(['src/core/oauth.js']);
    expect(result.missing).toEqual(['tests/unit/oauth-handlers.test.js']);
    expect(result.unchanged).toBe(false);
  });
  it('classifies upstream runtime drift separately from service-catalog assertion drift',()=>{
    const source=Object.keys(baseline.source)[0];
    const suite='tests/unit/registry.test.js';
    const t=tree();
    t.tree.find(x=>x.path===suite).sha='a'.repeat(40);
    const onlyCatalog=compareK3UpstreamTree(baseline,main,t);
    expect(onlyCatalog).toMatchObject({unchanged:false,sourceUnchanged:true,
      sourceChanged:[],sourceMissing:[],testMissing:[]});
    expect(onlyCatalog.testChanged.map(x=>x.path)).toEqual([suite]);
    t.tree.find(x=>x.path===source).sha='b'.repeat(40);
    t.tree=t.tree.filter(x=>x.path!=='tests/unit/oauth-core.test.js');
    const both=compareK3UpstreamTree(baseline,main,t);
    expect(both.sourceUnchanged).toBe(false);
    expect(both.sourceChanged.map(x=>x.path)).toEqual([source]);
    expect(both.testChanged.map(x=>x.path)).toEqual([suite]);
    expect(both.testMissing).toEqual(['tests/unit/oauth-core.test.js']);
  });
  it('pins reviewed Stripe source and changed service catalog suite SHA values',()=>{
    expect(baseline.reviewedMain).toBe('7c9e981b75806e7fbfdbfdc84622ed11ca2185a2');
    expect(baseline.tests['tests/unit/registry.test.js']).toBe('93fbbf8e575d25f6431e27e71db48d2368a27c35');
    expect(baseline.tests['tests/unit/profiles.test.js']).toBe('716e26c5f4de9f6b7fdf894a01b1c755ba72ad06');
    expect(compareK3UpstreamTree(baseline,main,tree())).toMatchObject({unchanged:true,sourceUnchanged:true,examined:19});
    expect(Object.values(baseline.source)).toHaveLength(11);
    expect(Object.values(baseline.tests)).toHaveLength(8);
  });
  it('rejects truncated trees, invalid baseline, reduced inventory and transport failures',async()=>{
    expect(()=>compareK3UpstreamTree(baseline,main,{...tree(),truncated:true})).toThrow(/incomplete/);
    expect(()=>compareK3UpstreamTree({...baseline,tests:{}},main,tree())).toThrow(/reduced/);
    expect(()=>compareK3UpstreamTree({...baseline,source:{...baseline.source,'../../unsafe.js':'a'.repeat(40)}},main,tree())).toThrow();
    await expect(verifyK3UpstreamDrift(baseline,{fetchImpl:async()=>{throw Error('token here')}}))
      .rejects.toThrow(/unreachable/);
    await expect(verifyK3UpstreamDrift(baseline,{fetchImpl:async()=>({ok:false,status:403})}))
      .rejects.toThrow(/403/);
  });
});
