import {describe,it,expect} from 'vitest';
import {buildOfflineCoreEvidence,inspectPackedCore} from '../../../scripts/core-artifact-evidence.mjs';

const expected=['package.json','src/oauth.js'];
const valid={name:'robinson-mcp-core',version:'0.1.0',
  filename:'robinson-mcp-core-0.1.0.tgz',size:1024,shasum:'a'.repeat(40),
  files:expected.map(path=>({path}))};
describe('K-3 unpublished offline artifact integrity',()=>{
  it('validates an exact reviewed tarball file list',()=>{
    expect(inspectPackedCore(valid,expected)).toMatchObject({
      name:'robinson-mcp-core',bytes:1024,files:expected});
  });
  it('refuses any hidden new module, duplicate file or path traversal',()=>{
    for(const file of ['src/hidden.js','../secret','src/foo.json',
      '.npmrc','package-lock.json','src/../private.js']){
      const fake={...valid,files:[...valid.files,{path:file}]};
      expect(()=>inspectPackedCore(fake,expected)).toThrow(/allowlist/);
    }
    expect(()=>inspectPackedCore({...valid,files:[...valid.files,valid.files[1]]},
      expected)).toThrow(/allowlist/);
  });
  it('rejects truncated, oversized, wrong-name or malformed tarballs',()=>{
    for(const fake of [
      {...valid,size:0},{...valid,size:2000001},
      {...valid,filename:'../robinson-mcp-core-0.1.0.tgz'},
      {...valid,version:'0.1.0-pre'},{...valid,shasum:'abc'},
      {...valid,name:'stripe-mcp'},{...valid,files:null}
    ])expect(()=>inspectPackedCore(fake,expected)).toThrow();
  });
  it('packs the actual private core offline, checks bytes and checksum and leaves release gated',()=>{
    const artifact=buildOfflineCoreEvidence();
    expect(artifact.name).toBe('robinson-mcp-core');
    expect(artifact.version).toBe('0.1.0');
    expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.bytes).toBeGreaterThan(0);
    expect(artifact.files).toEqual([
      'package.json','src/crypto.js','src/http.js','src/mcp-auth.js',
      'src/mcp-dispatch.js','src/oauth-protocol.js','src/oauth.js',
      'src/one-time-secrets.js','src/profiles.js','src/registry.js',
      'src/write-contract-check.js','src/write.js'
    ].sort());
    expect(artifact).toMatchObject({verbatim:5,adapted:6,
      published:false,releaseReady:false});
    expect(artifact.note).toMatch(/Unpublished/);
  });
  it('treats subprocess failure as a refusal without leaking its output',()=>{
    expect(()=>buildOfflineCoreEvidence({packRunner:()=>({
      status:1,stdout:'private-value',stderr:'private-value'})})).toThrow(
      /Offline core packing failed/);
    try{
      buildOfflineCoreEvidence({packRunner:()=>({
        status:1,stdout:'private-value',stderr:'private-value'})});
    }catch(error){expect(error.message).not.toContain('private-value');}
  });
});
