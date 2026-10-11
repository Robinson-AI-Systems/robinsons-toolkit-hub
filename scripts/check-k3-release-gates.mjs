// K-3 private-release prerequisite guard. This deliberately cannot authorize
// publication: CI validates an honest blocker ledger, not a forged release proof.
import {readFileSync, existsSync} from 'node:fs';
import {resolve, join, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyOriginalAssertionBodies} from './check-original-assertion-bodies.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const required = Object.freeze({
  'package-isolation':'VERIFIED_LOCAL',
  'current-source-drift':'OPEN',
  'original-http-assertions':'PARTIAL',
  'adapted-interface-matrix':'PARTIAL',
  'service-durable-storage':'OPEN',
  'money-owner-approval':'OPEN',
  'independent-service-adoption':'OPEN',
  'github-release-asset':'OPEN'
});
const json = (dir,path) => JSON.parse(readFileSync(join(dir,path),'utf8'));
const fail = message => {throw new Error('K-3 release prerequisite gate: '+message);};

/**
 * Validate the current conservative machine-readable release ledger against
 * independently checked project state. No status supplied by an agent can
 * substitute for final authenticated service or GitHub Release verification.
 */
export function validateK3ReleaseLedger({ledger,pkg,trace,coverage,originalBodies,
  hasEvidence=()=>true,releaseDoc=''}) {
  if(ledger?.schema!==1||ledger.state!=='NOT_READY'||
     ledger.packageName!=='robinson-mcp-core'||ledger.packageVersion!==pkg?.version) {
    fail('the package must remain explicitly NOT_READY at the audited version');
  }
  if(pkg?.private!==true||pkg.name!==ledger.packageName||
     !pkg.exports||Object.keys(pkg.exports).length!==11) {
    fail('a private, reviewed eleven-export core package is mandatory');
  }
  if(trace?.status!=='PARTIAL_PRIVATE_NOT_RELEASED'||
     coverage?.status!=='INCOMPLETE_SERVER_ADOPTION'||
     trace.sourceMain!==ledger.sourceMain||
     coverage.sourceMain!==ledger.sourceMain) {
    fail('source provenance and assertion ledgers must agree on their incomplete state');
  }
  if(!Number.isSafeInteger(originalBodies)||originalBodies!==21||
     ledger.originalBodiesVerified!==originalBodies) {
    fail('exact original assertion body count changed without a new reviewed gate');
  }
  if(!releaseDoc.includes('NOT READY / NOT RELEASED')) {
    fail('the human-readable release decision no longer explicitly refuses publication');
  }
  const items=ledger.requirements;
  if(!Array.isArray(items)||items.length!==Object.keys(required).length) {
    fail('complete prerequisite ledger is required');
  }
  const found=new Set();
  for(const item of items) {
    if(!item||typeof item.id!=='string'||!Object.hasOwn(required,item.id)||
       found.has(item.id)||item.status!==required[item.id]) {
      fail('unknown, duplicate, omitted or prematurely satisfied prerequisite');
    }
    found.add(item.id);
    if(typeof item.owner!=='string'||item.owner.length<3||
       typeof item.reason!=='string'||item.reason.length<30||
       typeof item.next!=='string'||item.next.length<30) {
      fail('prerequisites require a specific owner, explanation and next verification');
    }
    if(typeof item.evidence!=='string'||
       !/^(?:docs|scripts)\/[a-zA-Z0-9/._-]+$/.test(item.evidence)||
       item.evidence.split('/').includes('..')||!hasEvidence(item.evidence)) {
      fail('unreviewed or missing prerequisite evidence path: '+item.id);
    }
  }
  if(found.size!==Object.keys(required).length)fail('incomplete prerequisite index');
  return Object.freeze({
    ready:false, state:'NOT_READY',
    originalBodies, blockers:Object.freeze(items.filter(i=>i.status!=='VERIFIED_LOCAL').map(i=>i.id))
  });
}

export function inspectK3ReleaseReadiness(dir=root,{candidate=false}={}) {
  const rootDir=resolve(dir);
  const ledger=json(rootDir,'docs/audits/K3-RELEASE-PREREQUISITES.json');
  const report=validateK3ReleaseLedger({
    ledger,
    pkg:json(rootDir,'packages/core/package.json'),
    trace:json(rootDir,'docs/audits/K3-SOURCE-TRACE.json'),
    coverage:json(rootDir,'docs/audits/K3-ASSERTION-COVERAGE.json'),
    originalBodies:verifyOriginalAssertionBodies(rootDir),
    releaseDoc:readFileSync(join(rootDir,'docs/audits/K3-RELEASE-GATES.md'),'utf8'),
    hasEvidence:path=>{
      const full=resolve(rootDir,path);
      return full.startsWith(rootDir+sep)&&existsSync(full);
    }
  });
  if(candidate) {
    fail('candidate refused; missing independent verified evidence for '+
      report.blockers.join(', ')+'. Do not tag, publish or upload an archive.');
  }
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const candidate=process.argv.slice(2).includes('--candidate');
  try {
    const report=inspectK3ReleaseReadiness(root,{candidate});
    console.log('K-3 release: NOT READY; '+report.blockers.length+
      ' non-local prerequisite(s) still open. Private core only.');
  } catch(error) {
    console.error(error.message);
    process.exitCode=1;
  }
}
