// Reviewed, fixed upstream catalog diff. Prevents accidental treating provider tool
// catalog growth as shared-core semantic change or release/adoption proof.
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {compareK3UpstreamTree} from '../../scripts/verify-k3-upstream-drift.mjs';
const manifest=JSON.parse(readFileSync(new URL('../../docs/audits/K3-UPSTREAM-BASELINE.json',import.meta.url),'utf8'));
const unchangedSource={
  'src/core/oauth.js':'2e2fa72529869d7f2320661a641cdaa1d5de9841',
  'src/core/crypto.js':'34dce85cd4ca32553bfa2512778e68f819558de5',
  'src/core/registry.js':'a92f4f36987b73a02bcc32c1d98902cc3b6ef7ca',
  'src/core/http.js':'1b2078afb1bccbb576bfb493c623067871866b7f',
  'src/core/write-contract-check.js':'c604cf99d6d2b5fbbcf7ca77306b2c383079b146',
  'src/core/profiles.js':'654d1dedbc244a6f0e799793d7b41e89bf92304e',
  'src/core/mcp-auth.js':'eea535069b2179dfa74ed4ad101abacd5789dea0',
  'src/core/one-time-secrets.js':'071900c19db7d77a608c7bb65574b12b24c080fb',
  'src/core/oauth-handlers.js':'3aa62cf055e28dc4fcda6affa3a52dc0381be94e',
  'src/core/write.js':'82157d03a818a60d6a9ae6e28dd798e0e7ca2a86',
  'src/core/mcp-server.js':'51309da34c8aab8f44c67411fe83c89367d664b6'
};
describe('K-3 reviewed current Stripe service catalog-only source delta',()=>{
  it('pins the entire eleven-file runtime source unchanged independently of current test counts',()=>{
    expect(manifest.source).toEqual(unchangedSource);
    expect(manifest.disposition).toBe('REVIEWED_SNAPSHOT_NOT_RELEASE');
    expect(manifest.reviewedMain).toBe('b2a1432fa6398b7f6848d84771e5af5b21d686e7');
  });
  it('rejects any unseen core module drift even if service test SHA values are accepted',()=>{
    const tree={truncated:false,tree:Object.entries({...manifest.source,...manifest.tests})
      .map(([path,sha])=>({type:'blob',path,sha}))};
    expect(compareK3UpstreamTree(manifest,manifest.reviewedMain,tree)).toMatchObject({
      unchanged:true,sourceUnchanged:true,examined:19
    });
    tree.tree.find(x=>x.path==='src/core/write.js').sha='f'.repeat(40);
    const changed=compareK3UpstreamTree(manifest,manifest.reviewedMain,tree);
    expect(changed).toMatchObject({unchanged:false,sourceUnchanged:false});
    expect(changed.sourceChanged.map(x=>x.path)).toEqual(['src/core/write.js']);
  });
});
