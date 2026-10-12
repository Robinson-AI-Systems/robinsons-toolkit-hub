// Development-only focused test runner. Never replaces npm run check, npm test,
// npm run test:db, source jobs or exact-head CI.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const focusGroups=Object.freeze({
  core:['packages/core/test'],
  upstream:['tests/unit/k3-upstream-drift.test.js','tests/unit/k3-source-ci-evidence.test.js'],
  release:['tests/unit/check-k3-release-gates.test.js','tests/unit/k3-remote-release.test.js'],
  auth:['packages/core/test/mcp-auth.test.js','packages/core/test/oauth-compat.test.js',
    'packages/core/test/one-time-secrets.test.js'],
  adapter:['packages/core/test/source-adapter-differential.test.js',
    'packages/core/test/source-http-runtime-differential.test.js',
    'packages/core/test/source-mcp-dispatch-differential.test.js']
});
export function focusPlan(groups) {
  if(!Array.isArray(groups)||groups.length===0)throw Error('choose a known test group');
  const files=[];
  for(const group of groups) {
    if(!Object.hasOwn(focusGroups,group))throw Error('unknown test group: '+group);
    for(const path of focusGroups[group])if(!files.includes(path))files.push(path);
  }
  return Object.freeze(files);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  try {
    const args=process.argv.slice(2);
    const list=args.includes('--list');
    const groups=args.filter(a=>a!=='--list');
    const files=focusPlan(groups);
    if(list)console.log(files.join('\n'));
    else {
      const run=spawnSync('npx',['--no-install','vitest','run',...files],{
        stdio:'inherit',shell:false,timeout:600000
      });
      if(run.error)throw run.error;
      process.exitCode=run.status??1;
    }
  }catch(error){
    console.error(error.message);
    process.exitCode=2;
  }
}
