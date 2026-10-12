// Reviewed, fixed upstream catalog diff. Prevents accidental treating provider tool
// catalog growth as shared-core semantic change or release/adoption proof.
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {compareK3UpstreamTree} from '../../scripts/verify-k3-upstream-drift.mjs';
const manifest=JSON.parse(readFileSync(new URL('../../docs/audits/K3-UPSTREAM-BASELINE.json',import.meta.url),'utf8'));
const reviewedSource={
  'src/core/oauth.js':'2e2fa72529869d7f2320661a641cdaa1d5de9841',
  'src/core/crypto.js':'34dce85cd4ca32553bfa2512778e68f819558de5',
  'src/core/registry.js':'a92f4f36987b73a02bcc32c1d98902cc3b6ef7ca',
  'src/core/http.js':'9b2ca1afe16a3b8f5ae6a7db8a7b6b521997324e',
  'src/core/write-contract-check.js':'c604cf99d6d2b5fbbcf7ca77306b2c383079b146',
  'src/core/profiles.js':'654d1dedbc244a6f0e799793d7b41e89bf92304e',
  'src/core/mcp-auth.js':'eea535069b2179dfa74ed4ad101abacd5789dea0',
  'src/core/one-time-secrets.js':'071900c19db7d77a608c7bb65574b12b24c080fb',
  'src/core/oauth-handlers.js':'3ba84fb8f0080b19271b4df8b72334469cfedb21',
  'src/core/write.js':'82157d03a818a60d6a9ae6e28dd798e0e7ca2a86',
  'src/core/mcp-server.js':'0b8364f0e8dd8358ff618f68ed037273c940ea87'
};
const reviewedTests={
  'tests/unit/oauth-core.test.js': 'fb3a616a02f775f94a9d5b9f06caff465dc1f712',
  'tests/unit/oauth-handlers.test.js': '217c0c18a0c427963fa374aa4c6fad570747865f',
  'tests/unit/keys.test.js': '05574eecb0d0f246f0ddfd9a9bddb673bd75c5f0',
  'tests/unit/registry.test.js': '93fbbf8e575d25f6431e27e71db48d2368a27c35',
  'tests/unit/profiles.test.js': '716e26c5f4de9f6b7fdf894a01b1c755ba72ad06',
  'tests/unit/write-metadata.test.js': '46cf601b1dffee8bfc23ced5bbed3be9fd8cc0ef',
  'tests/unit/write-core.test.js': 'f74d93b67748b23c660ddb0425c7ca48f9721d6d',
  'tests/unit/write-contract.test.js': '7c36ab9733d1d46e728984524cf20f3aeb558924'
};
describe('K-3 current Stripe original runtime/source-suite drift evidence',()=>{
  it('pins each original source blob including three reviewed changed modules',()=>{
    expect(manifest.source).toEqual(reviewedSource);
    expect(manifest.tests).toEqual(reviewedTests);
    expect(manifest.serviceOwnedCore).toEqual({
      'src/core/browser-cors.js':'e4b5d948a83737344c53079912dc148b4227ef60',
      'src/core/rtc-passes.js':'81d10139ca1432afcead399b2e51c61b3b28d480',
      'src/core/rtc-http.js':'47c1c66bdf5ef8c8b7544238344fedbe948267ac',
      'src/core/rtc-route.js':'7833386fd04717dc137f06132c0caf3c375f6362'
    });
    expect(manifest.disposition).toBe('REVIEWED_SNAPSHOT_NOT_RELEASE');
    expect(manifest.reviewedMain).toBe('de56af8199fee39b20c2a1ac733562f2622dfda7');
  });
  it('retains a fixed accounting of five real upstream changes, not silently treating changed suites as unchanged',()=>{
    const historical={
      'src/core/http.js':'1b2078afb1bccbb576bfb493c623067871866b7f',
      'src/core/oauth-handlers.js':'3aa62cf055e28dc4fcda6affa3a52dc0381be94e',
      'src/core/mcp-server.js':'51309da34c8aab8f44c67411fe83c89367d664b6',
      'tests/unit/oauth-handlers.test.js':'10cf67ca0da2a608c5e7f70d3931b68bef6683ba',
      'tests/unit/keys.test.js':'b05a1fa49019d9bbcdfac23fb0ebcc286a7a23a9'
    };
    for(const [path,old] of Object.entries(historical)){
      expect((manifest.source[path]||manifest.tests[path])).not.toBe(old);
      expect((manifest.source[path]||manifest.tests[path])).toMatch(/^[a-f0-9]{40}$/);
    }
    expect(manifest.tests['tests/unit/oauth-handlers.test.js']).toBe('217c0c18a0c427963fa374aa4c6fad570747865f');
    expect(manifest.tests['tests/unit/keys.test.js']).toBe('05574eecb0d0f246f0ddfd9a9bddb673bd75c5f0');
    expect(Object.keys({...manifest.source,...manifest.tests})).toHaveLength(19);
  });
  it('rejects any unseen core module drift even if service test SHA values are accepted',()=>{
    const tree={truncated:false,tree:Object.entries({...manifest.source,...manifest.tests,...manifest.serviceOwnedCore})
      .map(([path,sha])=>({type:'blob',path,sha}))};
    expect(compareK3UpstreamTree(manifest,manifest.reviewedMain,tree)).toMatchObject({
      unchanged:true,sourceUnchanged:true,examined:23
    });
    tree.tree.find(x=>x.path==='src/core/write.js').sha='f'.repeat(40);
    const changed=compareK3UpstreamTree(manifest,manifest.reviewedMain,tree);
    expect(changed).toMatchObject({unchanged:false,sourceUnchanged:false});
    expect(changed.sourceChanged.map(x=>x.path)).toEqual(['src/core/write.js']);
  });
});
