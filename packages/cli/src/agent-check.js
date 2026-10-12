import { loadServers, passFor, RouteError } from './config.js';
import { byName, send } from './dispatch.js';
import { contract } from './http.js';
import { materialize } from './pages.js';

const local = url => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
const goodEnvName = value => /^[A-Z][A-Z0-9_]{0,99}$/.test(value || '');
export async function checkAgent({ server, readTool, passEnv, argsEnv,
  expectRoute = 'auto', authorizedRealRun = false,
  env = process.env, reader, write = text => process.stdout.write(text) } = {}) {
  // Errors never contain provider messages, passes, args or server results.
  const report = { ok: false, route: null, checks: [], code: 'verification_failed' };
  let relayed = false, lastRelay = false;
  try {
    if (!goodEnvName(passEnv) || (argsEnv && !goodEnvName(argsEnv)) ||
        !/^[a-z][a-z0-9_]{0,199}$/.test(readTool || '') ||
        !['direct', 'relay', 'auto'].includes(expectRoute))
      throw new RouteError('Invalid verification options');
    const pass = env[passEnv];
    if (typeof pass !== 'string' || !/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(pass)) {
      report.code = 'missing_test_pass'; throw new Error();
    }
    const scoped = { ...env, relayNotice: () => { relayed = true; } };
    const servers = await loadServers(scoped, reader);
    if (!servers.has(server)) { report.code = 'unknown_server'; throw new Error(); }
    if (!local(servers.get(server)) && !authorizedRealRun) {
      report.code = 'owner_authorization_required'; throw new Error();
    }
    scoped['RTOOL_PASS_' + server.toUpperCase().replaceAll('-', '_')] = pass;
    const target = byName(servers, scoped, server);
    const fallback = target.fallback;
    if (fallback) target.fallback = async (...values) => {
      lastRelay = true; return fallback(...values);
    };
    const routes = [];
    const recordRoute = () => { routes.push(lastRelay ? 'relay' : 'direct'); lastRelay = false; };
    // Explicitly selected pass; no implicit keychain or unrelated configured pass.
    if (passFor(server, scoped) !== pass) throw new Error();
    const manifest = await contract(target.url, pass, target.fallback);
    report.checks.push('rtc_1_manifest'); recordRoute();
    if (!readTool.startsWith(manifest.prefix + '_')) {
      report.code = 'tool_prefix_mismatch'; throw new Error();
    }
    const who = await send(target, '/api/whoami');
    if (who?.result?.profile !== 'read_only') {
      report.code = 'read_only_pass_required'; throw new Error();
    }
    // An owner-approved D-4 pass is TEST-only. A live account with a read-only
    // profile is still outside that authorization. Deny before tool metadata,
    // any tool POST, or a possible encrypted relay read is attempted.
    if (who?.result?.mode !== 'test') {
      report.code = 'test_mode_required'; throw new Error();
    }
    report.checks.push('read_only_pass', 'test_mode'); recordRoute();
    const metadata = await send(target, '/api/tools/' + readTool);
    if (metadata?.result?.name !== readTool || metadata.result.writes !== false ||
        metadata.result.money !== false || metadata.result.destructive !== false) {
      report.code = 'read_only_tool_required'; throw new Error();
    }
    report.checks.push('read_only_metadata'); recordRoute();
    let args = {};
    if (argsEnv) {
      args = JSON.parse(env[argsEnv]);
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error();
    }
    const result = await send(target, '/api/tools/' + readTool, { method: 'POST', args });
    if (result?.ok !== true || result.result?.needsConfirmation) throw new Error();
    // Fetch the actual handle to prove the result door, but never print its contents.
    const readRoute = lastRelay ? 'relay' : 'direct'; recordRoute();
    if (result.handle) {
      await materialize(target, result); report.checks.push('result_handle'); recordRoute();
    }
    report.checks.push('guarded_read');
    report.route = readRoute;
    if (expectRoute !== 'auto' && routes.some(route => route !== expectRoute)) {
      report.code = 'route_mismatch'; throw new Error();
    }
    report.code = 'verified'; report.ok = true;
  } catch {
    if (report.route === null && relayed) report.route = 'relay';
  }
  write(JSON.stringify(report) + '\n');
  return report.ok ? 0 : 1;
}
export function parseAgentCheck(argv) {
  const keys = new Map([['--server', 'server'], ['--read-tool', 'readTool'],
    ['--pass-env', 'passEnv'], ['--args-env', 'argsEnv'], ['--expect-route', 'expectRoute']]);
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--authorized-real-run') {
      if (options.authorizedRealRun) throw new Error('Duplicate option');
      options.authorizedRealRun = true; continue;
    }
    const key = keys.get(argv[i]);
    if (!key || options[key] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--'))
      throw new Error('Invalid agent-check options');
    options[key] = argv[++i];
  }
  if (!options.server || !options.readTool || !options.passEnv) throw new Error('Missing verification options');
  return options;
}
