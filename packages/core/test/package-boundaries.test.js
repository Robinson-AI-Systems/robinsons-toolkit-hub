import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyCorePackage} from '../../../scripts/verify-core-package.mjs';

const actual=fileURLToPath(new URL('../',import.meta.url));
function withFixture(run) {
  const root=mkdtempSync(join(tmpdir(),'rt-core-boundary-'));
  try {
    mkdirSync(join(root,'src'));
    const pkg={name:'robinson-mcp-core',version:'0.1.0',private:true,type:'module',
      files:['src/'],exports:{'./good':'./src/good.js'}};
    const save=()=>writeFileSync(join(root,'package.json'),JSON.stringify(pkg));
    const code=value=>writeFileSync(join(root,'src','good.js'),value);
    code('export const ok=true;');save();
    return run({root,pkg,save,code});
  } finally {rmSync(root,{recursive:true,force:true});}
}
describe('K-3 private package boundary verifier',()=>{
  it('allows every reviewed real source export and no sibling runtime',()=>{
    const proof=verifyCorePackage(actual);
    expect(proof.modules).toContain('src/crypto.js');
    expect(proof.modules).toContain('src/mcp-dispatch.js');
    expect(proof.modules).toHaveLength(11);
    expect(Object.isFrozen(proof.modules)).toBe(true);
  });
  it('accepts an isolated self-contained ESM module',()=>withFixture(({root})=>{
    expect(verifyCorePackage(root).modules).toEqual(['src/good.js']);
  }));
  it('refuses undeclared source files and duplicate public targets',()=>withFixture(({root,pkg,save})=>{
    writeFileSync(join(root,'src','hidden.js'),'export const secret=true;');
    expect(()=>verifyCorePackage(root)).toThrow(/Unreviewed/);
    pkg.exports['./hidden']='./src/hidden.js';save();
    expect(verifyCorePackage(root).modules).toHaveLength(2);
    pkg.exports['./duplicate']='./src/hidden.js';save();
    expect(()=>verifyCorePackage(root)).toThrow(/duplicate/);
  }));
  it('refuses package scripts, dependencies and public release while gated',()=>withFixture(({root,pkg,save})=>{
    pkg.scripts={prepare:'echo unsafe'};save();
    expect(()=>verifyCorePackage(root)).toThrow(/scripts/);
    delete pkg.scripts;pkg.dependencies={stripe:'1.0.0'};save();
    expect(()=>verifyCorePackage(root)).toThrow(/dependencies/);
    delete pkg.dependencies;pkg.private=false;save();
    expect(()=>verifyCorePackage(root)).toThrow(/private/);
    expect(verifyCorePackage(root,{requirePrivate:false}).modules).toHaveLength(1);
  }));
  it('refuses path escape, dynamic loads, provider imports and unknown builtins',()=>withFixture(({root,pkg,save,code})=>{
    pkg.exports={'./escape':'../outside.js'};save();
    expect(()=>verifyCorePackage(root)).toThrow(/Unsafe/);
    pkg.exports={'./good':'./src/good.js'};save();
    for(const value of ["import('stripe')","const a=require('node:fs')",
      "import Stripe from 'stripe';","import fs from 'node:fake-builtin';",
      "import {ok} from './missing.js';"]) {
      code(value);
      expect(()=>verifyCorePackage(root)).toThrow();
    }
    code("import { randomBytes } from 'node:crypto'; export const ok=!!randomBytes;");
    expect(verifyCorePackage(root).modules).toHaveLength(1);
  }));
  it('refuses a symlinked public source even when the target remains inside',()=>withFixture(({root,pkg,save})=>{
    symlinkSync(join(root,'src','good.js'),join(root,'src','alias.js'));
    pkg.exports['./alias']='./src/alias.js';save();
    expect(()=>verifyCorePackage(root)).toThrow(/Unsafe|Non-regular/);
  }));
});
