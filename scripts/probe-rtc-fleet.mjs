#!/usr/bin/env node
// RTC fleet checks are opt-in and do not read ambient keychain credentials.
import { readFile } from 'node:fs/promises';
import { checkAgent } from '../packages/cli/src/agent-check.js';
import { parseFleetOrigins, parsePinnedFleetInventory, parseReadTests, probeRtcFleet } from '../packages/cli/src/fleet-probe.js';
async function main() {
  // Public observation is safe in CI: it reads only reviewed inventory and
  // never loads credentials, overrides, or protected TEST probe plans.
  if (process.argv.length > 3 ||
      (process.argv.length === 3 &&
        !['--authorized-read-only', '--public-observe'].includes(process.argv[2])))
    throw new Error('Invalid options');
  const authorized = process.argv[2] === '--authorized-read-only';
  const publicObserve = process.argv[2] === '--public-observe';
  const pinned = parsePinnedFleetInventory(await readFile(
    new URL('../docs/rtc-fleet-origins.json', import.meta.url), 'utf8'));
  // Environment only adds or overrides fixed owner-verified HTTPS endpoints;
  // it never drops mandatory servers from the snapshot.
  const origins = publicObserve ? pinned :
    { ...pinned, ...parseFleetOrigins(process.env.RTC_FLEET_ORIGINS) };
  const tests = authorized ? parseReadTests(process.env.RTC_FLEET_READ_TESTS) : {};
  const result = await probeRtcFleet({
    origins,
    authorize: authorized ? async (server, origin, manifest) => {
      const test = tests[server];
      if (!test || !test.readTool.startsWith(manifest.prefix + '_')) return false;
      const env = { ...process.env, RTOOL_SERVERS: server + '=' + origin };
      let snapshot;
      const code = await checkAgent({ server, readTool: test.readTool,
        passEnv: test.passEnv, argsEnv: test.argsEnv, expectRoute: 'direct',
        authorizedRealRun: true, env, reader: async () => '{"servers":{}}',
        write: value => { snapshot = JSON.parse(value); } });
      return code === 0 && snapshot?.ok === true && snapshot.route === 'direct';
    } : undefined
  });
  process.stdout.write(JSON.stringify(result) + '\n');
  // "No successful authenticated reads" is an observation, not a test error.
  // Only the explicit opt-in acceptance mode treats that as an unsuccessful exit.
  process.exitCode = publicObserve ? 0 :
    result.checks.every(c => c.state === 'ready') ? 0 : 1;
}
try { await main(); } catch {
  process.stderr.write('RTC fleet probe refused: use pinned public --public-observe or supply fixed owner-verified HTTPS RTC_FLEET_ORIGINS JSON; --authorized-read-only additionally requires temporary TEST read_only passes.\n');
  process.exitCode = 2;
}
