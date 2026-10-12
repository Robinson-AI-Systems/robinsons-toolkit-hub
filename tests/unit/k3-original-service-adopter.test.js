import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {validateOriginalAdoptionPlan,originalLeafExports,originalAdopterTests,
  originalAdopterSqlTests,assertDisposableSqlEnvironment}
  from '../../scripts/stripe-original-service-adopter.mjs';

const baseline=JSON.parse(readFileSync(
  new URL('../../docs/audits/K3-UPSTREAM-BASELINE.json',import.meta.url),'utf8'));
const trace=JSON.parse(readFileSync(
  new URL('../../docs/audits/K3-SOURCE-TRACE.json',import.meta.url),'utf8'));
const inspect=(b=baseline,t=trace,h=baseline.reviewedMain)=>
  validateOriginalAdoptionPlan({baseline:b,trace:t,sourceHead:h});

describe('true private core adoption into original Stripe source imports',()=>{
  it('allows exactly four verbatim reviewed leaves and five original test files',()=>{
    const proof=inspect();
    expect(proof.plans.map(x=>x.exportName)).toEqual([...originalLeafExports]);
    expect(originalAdopterTests).toHaveLength(5);
    expect(proof.sourceHead).toBe(baseline.reviewedMain);
    expect(proof.plans.every(x=>x.blob===baseline.source[x.sourceFile])).toBe(true);
  });
  it('rejects moving source revisions, missing original suites and adapted modules',()=>{
    expect(()=>inspect(baseline,trace,'f'.repeat(40))).toThrow(/reviewed private source/);
    const missing=structuredClone(baseline);
    delete missing.tests['tests/unit/oauth-handlers.test.js'];
    expect(()=>inspect(missing)).toThrow(/assertion suite/);
    const modified=structuredClone(trace);
    modified.modules['./oauth'].kind='adapted';
    expect(()=>inspect(baseline,modified)).toThrow(/reviewed original service/);
    modified.modules['./oauth'].kind='verbatim';
    modified.modules['./oauth'].coreBlob='a'.repeat(40);
    expect(()=>inspect(baseline,modified)).toThrow(/reviewed original service/);
  });
  it('pins seven real original SQL suites and permits only disposable CI SQL',()=>{
    expect(originalAdopterSqlTests).toHaveLength(7);
    expect(originalAdopterSqlTests).toContain('tests/db/money-owner-approval.test.js');
    expect(originalAdopterSqlTests).toContain('tests/db/owner-money-limit.test.js');
    const env={CI:'true',TEST_DATABASE_URL:
      'postgresql://postgres:ci-only-not-a-secret@127.0.0.1:5432/postgres'};
    expect(assertDisposableSqlEnvironment(env)).toBe(true);
    for(const bad of [
      {...env,CI:'false'},
      {...env,TEST_DATABASE_URL:'postgresql://example.org:5432/postgres'},
      {...env,TEST_DATABASE_URL:'postgresql://127.0.0.1:5432/production'},
      {...env,TEST_DATABASE_URL:'postgresql://127.0.0.1:55432/postgres'},
      {...env,TEST_DATABASE_URL:'postgresql://127.0.0.1:5432/postgres?sslmode=require'},
      {...env,TEST_DATABASE_URL:''}
    ])expect(()=>assertDisposableSqlEnvironment(bad)).toThrow();
  });
  it('does not permit package import to replace host-owned adapted HTTP policy',()=>{
    expect(originalLeafExports).not.toContain('./http');
    expect(originalLeafExports).not.toContain('./write');
    expect(originalLeafExports).not.toContain('./mcp-auth');
    expect(originalLeafExports).not.toContain('./oauth-protocol');
  });
});
