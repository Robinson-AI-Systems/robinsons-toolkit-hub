import {describe,it,expect,vi} from 'vitest';
import {compareK3UpstreamTree,verifyK3UpstreamDrift} from '../../scripts/verify-k3-upstream-drift.mjs';
import baseline from '../../docs/audits/K3-UPSTREAM-BASELINE.json' with {type:'json'};
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
