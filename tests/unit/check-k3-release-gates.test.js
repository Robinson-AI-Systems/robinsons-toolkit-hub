import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  inspectK3ReleaseReadiness, validateK3ReleaseLedger
} from '../../scripts/check-k3-release-gates.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const load = p=>JSON.parse(readFileSync(join(root,p),'utf8'));
const baseline = {
  ledger:load('docs/audits/K3-RELEASE-PREREQUISITES.json'),
  pkg:load('packages/core/package.json'),
  trace:load('docs/audits/K3-SOURCE-TRACE.json'),
  coverage:load('docs/audits/K3-ASSERTION-COVERAGE.json'),
  originalBodies:21,
  releaseDoc:'NOT READY / NOT RELEASED',
  hasEvidence:()=>true
};
function fixture() {
  const copy=JSON.parse(JSON.stringify({...baseline,hasEvidence:undefined}));
  return {...copy,hasEvidence:()=>true};
}
const validated = () => validateK3ReleaseLedger(fixture());

describe('K-3 release prerequisite anti-overclaim guard', () => {
  it('keeps the real package private and reports every outstanding external prerequisite',()=>{
    const report=inspectK3ReleaseReadiness(root);
    expect(report.ready).toBe(false);
    expect(report.state).toBe('NOT_READY');
    expect(report.originalBodies).toBe(21);
    expect(report.blockers).toHaveLength(7);
    expect(report.blockers).toContain('money-owner-approval');
    expect(report.blockers).toContain('github-release-asset');
  });
  it('candidate mode is fail-closed; no local archive can masquerade as remote release',()=>{
    expect(()=>inspectK3ReleaseReadiness(root,{candidate:true}))
      .toThrow(/candidate refused; missing independent verified evidence/);
  });
  it('accepts the current truthful private ledger without implying readiness',()=>{
    expect(validated()).toMatchObject({ready:false,state:'NOT_READY',originalBodies:21});
  });
  it('rejects a fabricated release decision or publicly switched package',()=>{
    const f=fixture();
    f.ledger.state='READY';
    expect(()=>validateK3ReleaseLedger(f)).toThrow(/NOT_READY/);
    f.ledger.state='NOT_READY';
    f.pkg.private=false;
    expect(()=>validateK3ReleaseLedger(f)).toThrow(/private/);
  });
  it('rejects any count/provenance mismatch rather than trusting a declaration',()=>{
    const f=fixture();
    f.ledger.originalBodiesVerified=25;
    expect(()=>validateK3ReleaseLedger(f)).toThrow(/assertion body count/);
    f.ledger.originalBodiesVerified=21;
    f.coverage.sourceMain='f'.repeat(40);
    expect(()=>validateK3ReleaseLedger(f)).toThrow(/provenance/);
  });
  it('refuses to mark missing owner consent or remote GitHub assets as locally verified',()=>{
    const f=fixture();
    const money=f.ledger.requirements.find(x=>x.id==='money-owner-approval');
    money.status='VERIFIED_LOCAL';
    expect(()=>validateK3ReleaseLedger(f)).toThrow(/prematurely satisfied/);
    money.status='OPEN';
    f.ledger.requirements.find(x=>x.id==='github-release-asset').status='VERIFIED_LOCAL';
    expect(()=>validateK3ReleaseLedger(f)).toThrow(/prematurely satisfied/);
  });
  it('catches omitted, duplicated or invented required gates',()=>{
    const f=fixture();
    f.ledger.requirements.pop();
    expect(()=>validateK3ReleaseLedger(f)).toThrow(/complete prerequisite/);
    const g=fixture();
    g.ledger.requirements[0].id=g.ledger.requirements[1].id;
    expect(()=>validateK3ReleaseLedger(g)).toThrow(/duplicate/);
    const h=fixture();
    h.ledger.requirements[0].id='fake-approval';
    expect(()=>validateK3ReleaseLedger(h)).toThrow(/unknown/);
  });
  it('demands meaningful owners, next verification and safe existing evidence paths',()=>{
    const f=fixture();
    f.ledger.requirements[1].reason='unknown';
    expect(()=>validateK3ReleaseLedger(f)).toThrow(/specific owner/);
    const g=fixture();
    g.ledger.requirements[1].evidence='../outside.json';
    expect(()=>validateK3ReleaseLedger(g)).toThrow(/evidence path/);
    const h=fixture();
    h.hasEvidence=()=>false;
    expect(()=>validateK3ReleaseLedger(h)).toThrow(/missing prerequisite evidence/);
  });
  it('keeps incomplete status visible in the human-readable release decision',()=>{
    const f=fixture();
    f.releaseDoc='All gates passed and core is released';
    expect(()=>validateK3ReleaseLedger(f)).toThrow(/decision no longer/);
  });
});
