// Offline source-assertion coverage ledger. Counts and titles are pinned to reviewed
// upstream suites; this does not claim service-specific tests were copied.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../',import.meta.url));
const read = (dir,path) => readFileSync(resolve(dir,path),'utf8');
function requirePath(path) {
  if(typeof path!=='string'||!/^packages\/core\/test\/[a-z0-9-]+\.test\.js$/.test(path)){
    throw new Error('Invalid local core assertion suite path');
  }
  return path;
}
export function verifyCoreAssertionCoverage(dir=root) {
  const ledger=JSON.parse(read(dir,'docs/audits/K3-ASSERTION-COVERAGE.json'));
  const trace=JSON.parse(read(dir,'docs/audits/K3-SOURCE-TRACE.json'));
  if(ledger.schema!==1||ledger.sourceRepository!==trace.sourceRepository||
    ledger.sourceMain!==trace.sourceMain||ledger.status!=='INCOMPLETE_SERVER_ADOPTION'){
    throw new Error('Unreviewed source assertion baseline or completion claim');
  }
  const verbatim=Object.entries(trace.modules).filter(([,v])=>v.kind==='verbatim');
  const covered=Object.keys(ledger.modules||{});
  if(verbatim.length!==covered.length||verbatim.some(([name])=>!covered.includes(name))||
      covered.some(name=>trace.modules[name]?.kind!=='verbatim')){
    throw new Error('Assertion ledger must cover every and only verbatim core export');
  }
  let portable=0,serverOwned=0;
  for(const [name,entry] of Object.entries(ledger.modules)){
    if(!entry || !/^tests\/unit\/[a-z0-9-]+\.test\.js$/.test(entry.sourceTest)||
      !trace.modules[name].tests.includes(requirePath(entry.coreTest))){
      throw new Error('Unreviewed test mapping for '+name);
    }
    const text=read(dir,entry.coreTest);
    if(/\b(?:it|test)\.(?:skip|todo|only)\s*\(/.test(text)){
      throw new Error('Skipped, focused or TODO assertion suite: '+name);
    }
    const titles=[...text.matchAll(/\bit\s*\(\s*(['"`])([^'"`]+)\1\s*,/g)]
      .map(match=>({title:match[2],start:match.index}));
    const names=titles.map(x=>x.title);
    if(names.length!==new Set(names).size)throw new Error('Duplicate case title: '+name);
    if(!Array.isArray(entry.portable)||!entry.portable.length||
       !Array.isArray(entry.serverOwned))throw new Error('Missing assertion disposition: '+name);
    const sourceTitles=new Set();
    for(const c of entry.portable){
      if(typeof c.title!=='string'||!Number.isSafeInteger(c.minimumExpects)||
        c.minimumExpects<1||sourceTitles.has(c.title)){
        throw new Error('Invalid source assertion contract: '+name);
      }
      sourceTitles.add(c.title);
      const at=names.indexOf(c.title);
      if(at<0)throw new Error('Dropped source assertion: '+name+' / '+c.title);
      const segment=text.slice(titles[at].start,titles[at+1]?.start??text.length);
      const assertionCount=(segment.match(/\bexpect\s*\(/g)||[]).length;
      if(assertionCount<c.minimumExpects)throw new Error('Reduced source assertions: '+name+' / '+c.title);
      portable++;
    }
    for(const c of entry.serverOwned){
      if(typeof c.title!=='string'||typeof c.reason!=='string'||
        c.reason.length<12||sourceTitles.has(c.title)){
        throw new Error('Unexplained or duplicated server-owned assertion: '+name);
      }
      sourceTitles.add(c.title);serverOwned++;
    }
  }
  return {portable,serverOwned,modules:verbatim.length,
    releaseReady:false,sourceMain:ledger.sourceMain};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=verifyCoreAssertionCoverage();
  console.log('Core source assertion inventory:',result.portable,'local cases,',
    result.serverOwned,'server-owned cases; NOT RELEASE READY');
}
