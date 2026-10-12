// Verify the original Stripe source SQL/owner CI jobs cannot silently drift from
// their reviewed immutable source commit or shed their required original suites.
// This validates evidence plumbing, not a release candidate or service adoption.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parse} from 'yaml';

const sha=/^[0-9a-f]{40}$/;
const sourceSql=Object.freeze([
  'tests/db/oauth-persistent.test.js',
  'tests/db/oauth.test.js',
  'tests/db/money-owner-approval.test.js',
  'tests/db/money-reservation.test.js',
  'tests/db/owner-money-limit.test.js'
]);
const ownerHttp=Object.freeze([
  'tests/unit/oauth-handlers.test.js',
  'tests/unit/money-owner-approval.test.js',
  'tests/unit/owner-money-limit.test.js',
  'tests/unit/setup-page.test.js',
  'tests/unit/owner-test-smoke.test.js'
]);
const fail=reason=>{throw new Error('K-3 Stripe source CI evidence: '+reason);};
const runs=job=>job?.steps?.filter(step=>typeof step.run==='string')
  .map(step=>step.run).join(' ')||'';

export function validateK3SourceCIEvidence({baseline,workflow}) {
  if(baseline?.schema!==1||baseline.sourceRepository!=='Robinson-AI-Systems/stripe-mcp'||
     baseline.disposition!=='REVIEWED_SNAPSHOT_NOT_RELEASE'||
     !sha.test(baseline.reviewedMain||'')||
     Object.keys(baseline.source||{}).length!==11||
     Object.keys(baseline.tests||{}).length!==8||
     Object.keys(baseline.serviceOwnedCore||{}).length!==4||
     Object.keys(baseline.serviceOwnedCore||{}).some(path=>
       !/^src\/core\/[a-z0-9-]+\.js$/.test(path)||Object.hasOwn(baseline.source,path))||
     Object.values({...baseline.source,...baseline.tests,...baseline.serviceOwnedCore}).some(value=>!sha.test(value))){
    fail('reviewed original source inventory is incomplete or invalid');
  }
  const jobs=workflow?.jobs;
  const aggregate=jobs?.ci;
  if(!aggregate||aggregate.if!=='always()'||!Array.isArray(aggregate.needs)){
    fail('the aggregate CI must remain fail-closed');
  }
  const checks=[
    ['stripe-source-sql',sourceSql,'npm run test:db --','STRIPE_SOURCE_SQL'],
    ['stripe-source-owner-http',ownerHttp,'vitest run','STRIPE_SOURCE_OWNER_HTTP']
  ];
  const aggregateScript=runs(aggregate);
  for(const [name,required,runner,variable] of checks){
    const job=jobs[name];
    if(!aggregate.needs.includes(name)||
       !aggregateScript.includes('test "$'+variable+'" = success')){
      fail(name+': omitted from required aggregate CI');
    }
    const checkouts=job?.steps?.filter(step=>step.uses?.startsWith('actions/checkout@'));
    const original=checkouts?.filter(step=>step.with?.path==='source-stripe')||[];
    const hub=checkouts?.filter(step=>!step.with?.path)||[];
    if(original.length!==1||original[0].with?.repository!==baseline.sourceRepository||
       original[0].with?.ref!==baseline.reviewedMain||
       original[0].with?.['persist-credentials']!==false||
       (name==='stripe-source-owner-http'?
         hub.length!==1||hub[0].with?.repository!==undefined||
           hub[0].with?.['persist-credentials']!==false:
         hub.length!==0)){
      fail(name+': source checkout must be the reviewed immutable, non-persistent ref');
    }
    // The immutable checkout SHA alone is insufficient if a reviewed manifest is
    // accidentally mistyped. Both original suites must hash to the exact
    // independently reviewed Git blobs in each authentic source CI job.
    const evidence=job.steps.filter(step=>
      step.name==='Verify exact reviewed original Stripe OAuth/key test blobs');
    if(evidence.length!==1||evidence[0]['working-directory']!=='source-stripe'){
      fail(name+': missing exact original suite blob verification');
    }
    for(const suite of ['tests/unit/oauth-handlers.test.js','tests/unit/keys.test.js']){
      const expected='test "$(git hash-object '+suite+')" = "'+baseline.tests[suite]+'"';
      if(!evidence[0].run?.split('\n').map(line=>line.trim()).includes(expected)){
        fail(name+': reviewed original suite blob mismatch for '+suite);
      }
    }
    for(const [module,blob] of Object.entries(baseline.serviceOwnedCore)){
      const expected='test "$(git hash-object '+module+')" = "'+blob+'"';
      if(!evidence[0].run?.split('\n').map(line=>line.trim()).includes(expected))
        fail(name+': reviewed service-owned module blob mismatch for '+module);
    }
    const command=runs(job);
    if(!command.includes('git rev-parse HEAD')||
       !command.includes(baseline.reviewedMain)||!command.includes(runner)){
      fail(name+': missing revision assertion or original test runner');
    }
    const execute=job.steps.filter(step=>typeof step.run==='string'&&step.run.includes(runner));
    if(execute.length!==1)fail(name+': original test command missing or ambiguous');
    const words=execute[0].run.split(/\s+/);
    for(const suite of required){
      if(!words.includes(suite))fail(name+': missing original suite '+suite);
    }
    if(name==='stripe-source-sql'){
      if(job.services?.postgres?.image!=='public.ecr.aws/docker/library/postgres:17'||
         !execute[0].env?.TEST_DATABASE_URL?.includes('@127.0.0.1:5432/')){
        fail(name+': source SQL must use disposable localhost PostgreSQL');
      }
    }else if(job.services)fail(name+': source owner HTTP should not use a live database');
  }
  const differential=jobs['stripe-source-owner-http'].steps.filter(step=>
    step.name==='Compare authentic source HTTP with the private portable boundary');
  if(differential.length!==1||
     differential[0].run?.trim()!=='node scripts/stripe-source-http-differential.mjs'){
    fail('authentic source HTTP differential must execute after original source suites');
  }
  return Object.freeze({reviewedMain:baseline.reviewedMain,originalSourceModules:11,
    originalTrackedSuites:8,serviceOwnedModules:4,sqlSuites:sourceSql.length,ownerHttpSuites:ownerHttp.length,
    releaseReady:false});
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const baseline=JSON.parse(readFileSync(new URL('../docs/audits/K3-UPSTREAM-BASELINE.json',import.meta.url),'utf8'));
    const workflow=parse(readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8'));
    const report=validateK3SourceCIEvidence({baseline,workflow});
    console.log('K-3 reviewed original Stripe CI: '+report.sqlSuites+' SQL and '+
      report.ownerHttpSuites+' owner HTTP suites at '+report.reviewedMain+
      '; original source and human adoption are NOT release certified.');
  }catch(error){
    console.error(error.message);
    process.exitCode=1;
  }
}
