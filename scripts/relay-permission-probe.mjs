#!/usr/bin/env node
// Authorized D-4 private-transport probe. Never prints credentials or comment bodies.
import { githubCommentTransport } from '../packages/cli/src/relay.js';

export async function relayPermissionProbe({ args = process.argv.slice(2), env = process.env,
  transportFactory = githubCommentTransport, write = text => process.stdout.write(text) } = {}) {
  const fail = code => { write(JSON.stringify({ ok: false, code }) + '\n'); return 1; };
  if (args.length !== 3 || args[0] !== '--issue' || args[2] !== '--authorized-relay-test' ||
      !/^[1-9][0-9]*$/.test(args[1])) return fail('explicit_authorization_required');
  const issue = Number(args[1]);
  if (!Number.isSafeInteger(issue)) return fail('invalid_issue');
  let bindings;
  try { bindings = JSON.parse(env.RELAY_BINDINGS); } catch { return fail('bindings_missing'); }
  const assigned = bindings && !Array.isArray(bindings) &&
    Object.hasOwn(bindings, String(issue)) && bindings[String(issue)];
  if (!Number.isSafeInteger(assigned?.actorId) || assigned.actorId < 1 ||
      typeof assigned.server !== 'string' || !/^[a-z][a-z0-9_-]{0,39}$/.test(assigned.server))
    return fail('unbound_issue');
  if (typeof env.RELAY_GITHUB_TOKEN !== 'string' || !env.RELAY_GITHUB_TOKEN.trim() ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.RELAY_REPOSITORY || ''))
    return fail('transport_configuration_missing');
  try {
    const transport = transportFactory({
      repo: env.RELAY_REPOSITORY, issue, token: env.RELAY_GITHUB_TOKEN
    });
    const result = await transport.probePermissions();
    if (result?.repositoryPrivate !== true || result?.issueRead !== true ||
        result?.commentCreate !== true || result?.commentDelete !== true ||
        result.leastPrivilegeVerified !== false) return fail('invalid_probe_evidence');
    write(JSON.stringify({ ok: true, code: 'transport_verified',
      repositoryPrivate: true, issueRead: true, commentCreate: true, commentDelete: true,
      leastPrivilegeVerified: false }) + '\n');
    return 0;
  } catch { return fail('transport_probe_failed_or_cleanup_required'); }
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href)
  process.exitCode = await relayPermissionProbe();
