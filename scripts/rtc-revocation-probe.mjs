#!/usr/bin/env node
// TEST-only owner-authorized negative authentication proof. No token arguments.
import { checkRevokedPass, parseRevocationArgs } from '../packages/cli/src/revocation-check.js';
try {
  const opts = parseRevocationArgs(process.argv.slice(2));
  if (!opts.authorizedRealRun) throw new Error('owner opt-in required');
  process.exitCode = await checkRevokedPass(opts);
} catch {
  process.stderr.write('Usage: node scripts/rtc-revocation-probe.mjs --server ALIAS --pass-env ENV_NAME --authorized-revoked-test (TEST-only revoked credential)\n');
  process.exitCode = 2;
}
