#!/usr/bin/env node
// RTC fleet checks are opt-in and do not read ambient keychain credentials.
import { checkAgent } from '../packages/cli/src/agent-check.js';
import { parseFleetOrigins, parseReadTests, probeRtcFleet } from '../packages/cli/src/fleet-probe.js';
async function main() {
  if (process.argv.length > 3 ||
      (process.argv.length === 3 && process.argv[2] !== '--authorized-read-only'))
    throw new Error('Invalid options');
  const authorized = process.argv[2] === '--authorized-read-only';
  const origins = parseFleetOrigins(process.env.RTC_FLEET_ORIGINS);
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
  process.exitCode = result.checks.every(c => c.state === 'ready') ? 0 : 1;
}
try { await main(); } catch {
  process.stderr.write('RTC fleet probe refused: supply fixed owner-verified HTTPS RTC_FLEET_ORIGINS JSON. Optional --authorized-read-only requires RTC_FLEET_READ_TESTS env-name plans and temporary TEST read_only passes.\n');
  process.exitCode = 2;
}
