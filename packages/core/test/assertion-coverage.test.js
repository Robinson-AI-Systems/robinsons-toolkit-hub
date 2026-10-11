import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyCoreAssertionCoverage} from '../../../scripts/check-core-assertion-coverage.mjs';

const repo=fileURLToPath(new URL('../../../',import.meta.url));
const load=path=>readFileSync(join(repo,path),'utf8');
function fixture(run){
  const dir=mkdtempSync(join(tmpdir(),'k3-assertion-'));
  try{
    const tracePath='docs/audits/K3-SOURCE-TRACE.json';
    const ledgerPath='docs/audits/K3-ASSERTION-COVERAGE.json';
    const ledger=JSON.parse(load(ledgerPath)),trace=JSON.parse(load(tracePath));
    const write=(path,content)=>{
      const target=join(dir,path);mkdirSync(dirname(target),{recursive:true});
      writeFileSync(target,content);
    };
    write(tracePath,JSON.stringify(trace));write(ledgerPath,JSON.stringify(ledger));
    for(const module of Object.values(ledger.modules))write(module.coreTest,load(module.coreTest));
    return run({dir,ledger,trace,write,ledgerPath,tracePath});
  }finally{rmSync(dir,{recursive:true,force:true});}
}
describe('offline original source assertion inventory',()=>{
  it('covers five verbatim exports without claiming server adoption or release',()=>{
    expect(verifyCoreAssertionCoverage(repo)).toMatchObject({
      modules:5,portable:20,serverOwned:6,releaseReady:false
    });
  });
  it('refuses missing or reduced assertions instead of merely matching titles',()=>fixture(
    ({dir,ledger,write})=>{
      const path=ledger.modules['./oauth'].coreTest;
      write(path,load(path).replace('expect(secretsMatch(a, a)).toBe(true);',''));
      expect(()=>verifyCoreAssertionCoverage(dir)).toThrow(/Reduced source assertions/);
    }));
  it('refuses dropped source cases',()=>fixture(({dir,ledger,write})=>{
    const path=ledger.modules['./registry'].coreTest;
    write(path,load(path).replace('refuses duplicates across namespaces','renamed case'));
    expect(()=>verifyCoreAssertionCoverage(dir)).toThrow(/Dropped source assertion/);
  }));
  it('refuses skipping source tests',()=>fixture(({dir,ledger,write})=>{
    const path=ledger.modules['./oauth'].coreTest;
    write(path,load(path).replace("it('refuses missing passphrase", "it.skip('refuses missing passphrase"));
    expect(()=>verifyCoreAssertionCoverage(dir)).toThrow(/Skipped/);
  }));
  it('rejects omissions from export mapping',()=>fixture(({dir,trace,write,tracePath})=>{
    delete trace.modules['./crypto'];
    write(tracePath,JSON.stringify(trace));
    expect(()=>verifyCoreAssertionCoverage(dir)).toThrow(/every and only/);
  }));
  it('rejects false release status and upstream source changes',()=>fixture(
    ({dir,ledger,write,ledgerPath})=>{
      ledger.status='RELEASED';write(ledgerPath,JSON.stringify(ledger));
      expect(()=>verifyCoreAssertionCoverage(dir)).toThrow(/Unreviewed source/);
      ledger.status='INCOMPLETE_SERVER_ADOPTION';ledger.sourceMain='f'.repeat(40);
      write(ledgerPath,JSON.stringify(ledger));
      expect(()=>verifyCoreAssertionCoverage(dir)).toThrow(/Unreviewed source/);
    }));
  it('demands explicit nonempty disposition of excluded service suites',()=>fixture(
    ({dir,ledger,write,ledgerPath})=>{
      ledger.modules['./crypto'].serverOwned[0].reason='not core';
      write(ledgerPath,JSON.stringify(ledger));
      expect(()=>verifyCoreAssertionCoverage(dir)).toThrow(/Unexplained/);
    }));
});
