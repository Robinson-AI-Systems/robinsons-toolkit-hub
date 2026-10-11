import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gitBlobSha,verifyCoreSourceTrace} from '../../../scripts/check-core-source-trace.mjs';

const repo=fileURLToPath(new URL('../../../',import.meta.url));
function fixture(run){
  const root=mkdtempSync(join(tmpdir(),'rt-k3-parity-'));
  try{
    for(const sub of ['packages','packages/core','packages/core/src',
      'packages/core/test','docs','docs/audits'])mkdirSync(join(root,sub));
    const src='export const tested=true;\n',sha=gitBlobSha(src);
    writeFileSync(join(root,'packages/core/src/leaf.js'),src);
    writeFileSync(join(root,'packages/core/test/leaf.test.js'),'// isolated test fixture\n');
    const pkg={name:'robinson-mcp-core',private:true,
      exports:{'./leaf':'./src/leaf.js'}};
    const data={schema:1,sourceRepository:'Robinson-AI-Systems/stripe-mcp',
      sourceMain:'a'.repeat(40),status:'PARTIAL_PRIVATE_NOT_RELEASED',
      modules:{'./leaf':{sourceFile:'src/core/leaf.js',sourceBlob:sha,
        coreBlob:sha,target:'./src/leaf.js',kind:'verbatim',
        tests:['packages/core/test/leaf.test.js'],
        serverOwned:['service policy']}}};
    const save=()=>{
      writeFileSync(join(root,'packages/core/package.json'),JSON.stringify(pkg));
      writeFileSync(join(root,'docs/audits/K3-SOURCE-TRACE.json'),JSON.stringify(data));
    };
    save();
    return run({root,pkg,data,save});
  }finally{rmSync(root,{recursive:true,force:true});}
}
describe('pinned K-3 source provenance and incomplete-release gate',()=>{
  it('pins real Stripe source hashes across every public core module',()=>{
    const result=verifyCoreSourceTrace(repo);
    expect(result.verbatim).toBe(5);
    expect(result.adapted).toBe(6);
    expect(result.releaseReady).toBe(false);
  });
  it('hashes exact Git blobs rather than normalized JS text',()=>{
    expect(gitBlobSha('test content\n')).toMatch(/^[0-9a-f]{40}$/);
    expect(gitBlobSha('test content\n')).not.toBe(gitBlobSha('test content'));
  });
  it('recognizes a verified isolated leaf without service dependencies',()=>fixture(({root})=>{
    expect(verifyCoreSourceTrace(root)).toMatchObject({verbatim:1,adapted:0,releaseReady:false});
  }));
  it('rejects edited source without an explicit new reviewed digest',()=>fixture(({root})=>{
    writeFileSync(join(root,'packages/core/src/leaf.js'),'export const tested=false;\n');
    expect(()=>verifyCoreSourceTrace(root)).toThrow(/reviewed trace/);
  }));
  it('rejects new untracked exports and attempts to claim release completion',()=>fixture(({root,pkg,data,save})=>{
    pkg.exports['./new']='./src/new.js';save();
    expect(()=>verifyCoreSourceTrace(root)).toThrow(/cover every/);
    delete pkg.exports['./new'];data.status='RELEASED';save();
    expect(()=>verifyCoreSourceTrace(root)).toThrow(/baseline or release status/);
  }));
  it('rejects missing tests, altered upstream hash and false byte parity',()=>fixture(({root,data,save})=>{
    data.modules['./leaf'].tests=['packages/core/test/missing.test.js'];save();
    expect(()=>verifyCoreSourceTrace(root)).toThrow();
    data.modules['./leaf'].tests=['packages/core/test/leaf.test.js'];
    data.modules['./leaf'].sourceBlob='b'.repeat(40);save();
    expect(()=>verifyCoreSourceTrace(root)).toThrow(/differs/);
  }));
});
