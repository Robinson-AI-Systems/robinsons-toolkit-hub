import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import {validateK3SourceCIEvidence} from '../../scripts/check-k3-source-ci-evidence.mjs';

const baseline=JSON.parse(readFileSync(new URL('../../docs/audits/K3-UPSTREAM-BASELINE.json',import.meta.url),'utf8'));
const workflow=parse(readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8'));
const copy=()=>({baseline:structuredClone(baseline),workflow:structuredClone(workflow)});
const checkout=(wf,name)=>wf.jobs[name].steps.find(s=>s.uses?.startsWith('actions/checkout@'));
const command=(wf,name,fragment)=>wf.jobs[name].steps.find(s=>s.run?.includes(fragment));
describe('K-3 authentic source CI is tied to reviewed evidence, not release permission',()=>{
  it('requires all nine original source suites and keeps the private release incomplete',()=>{
    expect(validateK3SourceCIEvidence(copy())).toMatchObject({
      reviewedMain:baseline.reviewedMain,originalSourceModules:11,
      originalTrackedSuites:8,serviceOwnedModules:4,sqlSuites:5,ownerHttpSuites:5,releaseReady:false
    });
  });
  it('rejects moving refs, mismatched SQL and owner sources and persistent tokens',()=>{
    for(const name of ['stripe-source-sql','stripe-source-owner-http']){
      const original=copy();
      checkout(original.workflow,name).with.ref='main';
      expect(()=>validateK3SourceCIEvidence(original)).toThrow(/immutable/);
      const different=copy();
      checkout(different.workflow,name).with.repository='other/project';
      expect(()=>validateK3SourceCIEvidence(different)).toThrow(/checkout/);
      const token=copy();
      checkout(token.workflow,name).with['persist-credentials']=true;
      expect(()=>validateK3SourceCIEvidence(token)).toThrow(/checkout/);
    }
  });
  it('rejects removed original source tests or replaced runner and revision assertion',()=>{
    const db=copy();
    command(db.workflow,'stripe-source-sql','npm run test:db').run=
      command(db.workflow,'stripe-source-sql','npm run test:db').run.replace(
        'tests/db/money-owner-approval.test.js','');
    expect(()=>validateK3SourceCIEvidence(db)).toThrow(/missing original suite/);
    const http=copy();
    command(http.workflow,'stripe-source-owner-http','vitest run').run=
      command(http.workflow,'stripe-source-owner-http','vitest run').run.replace(
        'tests/unit/oauth-handlers.test.js','');
    expect(()=>validateK3SourceCIEvidence(http)).toThrow(/missing original suite/);
    const smoke=copy();
    command(smoke.workflow,'stripe-source-owner-http','vitest run').run=
      command(smoke.workflow,'stripe-source-owner-http','vitest run').run.replace(
        'tests/unit/owner-test-smoke.test.js','');
    expect(()=>validateK3SourceCIEvidence(smoke)).toThrow(/missing original suite/);
    const pin=copy();
    command(pin.workflow,'stripe-source-sql','git rev-parse HEAD').run='true';
    expect(()=>validateK3SourceCIEvidence(pin)).toThrow(/revision assertion/);
  });
  it('rejects missing aggregate check and non-disposable SQL database',()=>{
    const dropped=copy();
    dropped.workflow.jobs.ci.needs=dropped.workflow.jobs.ci.needs.filter(
      item=>item!=='stripe-source-owner-http');
    expect(()=>validateK3SourceCIEvidence(dropped)).toThrow(/aggregate/);
    const sql=copy();
    sql.workflow.jobs['stripe-source-sql'].services.postgres.image='other/postgres';
    expect(()=>validateK3SourceCIEvidence(sql)).toThrow(/localhost/);
    const url=copy();
    command(url.workflow,'stripe-source-sql','npm run test:db').env.TEST_DATABASE_URL=
      'postgresql://example.invalid/test';
    expect(()=>validateK3SourceCIEvidence(url)).toThrow(/localhost/);
  });
  it('rejects silent 40-character replacement of either exact reviewed original suite hash',()=>{
    for(const suite of ['tests/unit/oauth-handlers.test.js','tests/unit/keys.test.js']){
      const changed=copy();
      changed.baseline.tests[suite]='f'.repeat(40);
      expect(()=>validateK3SourceCIEvidence(changed)).toThrow(/reviewed original suite blob mismatch/);
    }
  });
  it('requires exact new source-owned RTC and browser blobs in both original CI jobs',()=>{
    for(const job of ['stripe-source-sql','stripe-source-owner-http']){
      for(const blob of Object.values(baseline.serviceOwnedCore)){
        const bad=copy();
        const item=bad.workflow.jobs[job].steps.find(
          step=>step.name==='Verify exact reviewed original Stripe OAuth/key test blobs');
        item.run=item.run.replace(blob,'a'.repeat(40));
        expect(()=>validateK3SourceCIEvidence(bad))
          .toThrow(/reviewed service-owned module blob mismatch/);
      }
    }
    const missing=copy();delete missing.baseline.serviceOwnedCore['src/core/rtc-http.js'];
    expect(()=>validateK3SourceCIEvidence(missing)).toThrow(/inventory/);
  });
  it('rejects a removed, substituted or skipped original Git blob verification step',()=>{
    for(const job of ['stripe-source-sql','stripe-source-owner-http']){
      const absent=copy();
      absent.workflow.jobs[job].steps=absent.workflow.jobs[job].steps.filter(
        s=>s.name!=='Verify exact reviewed original Stripe OAuth/key test blobs');
      expect(()=>validateK3SourceCIEvidence(absent)).toThrow(/missing exact original suite blob/);
      const wrong=copy();
      const check=wrong.workflow.jobs[job].steps.find(
        s=>s.name==='Verify exact reviewed original Stripe OAuth/key test blobs');
      check.run=check.run.replace('217c0c18a0c427963fa374aa4c6fad570747865f','a'.repeat(40));
      expect(()=>validateK3SourceCIEvidence(wrong)).toThrow(/reviewed original suite blob mismatch/);
    }
  });
  it('rejects fewer original source modules, suites or changed release disposition',()=>{
    const missing=copy();
    delete missing.baseline.source['src/core/oauth.js'];
    expect(()=>validateK3SourceCIEvidence(missing)).toThrow(/inventory/);
    const missingTest=copy();
    delete missingTest.baseline.tests['tests/unit/oauth-core.test.js'];
    expect(()=>validateK3SourceCIEvidence(missingTest)).toThrow(/inventory/);
    const released=copy();
    released.baseline.disposition='RELEASE_READY';
    expect(()=>validateK3SourceCIEvidence(released)).toThrow(/inventory/);
  });
});
