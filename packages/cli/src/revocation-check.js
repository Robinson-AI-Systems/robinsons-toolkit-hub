// Revocation proof must observe the server's explicit denial. A generic 401,
 // proxy error or revoked-looking token never proves a pass was revoked.
import { loadServers } from './config.js';
import { validateServerUrl, boundedJson } from '../../relay/src/forward.js';
const namePattern = /^[a-z][a-z0-9_-]{0,39}$/;
const envPattern = /^[A-Z][A-Z0-9_]{0,99}$/;
const passPattern = /^rtc_pass_[A-Za-z0-9_-]{43}$/;
const fail = (server, reason, state = 'unverified', httpStatus = null) =>
  ({ schema:1, server, ok:false, revocationVerified:false, route:'direct',
    state, reason, httpStatus, fullAcceptance:false });
export function parseRevocationArgs(argv) {
  const result = {};
  const options = {'--server':'server','--pass-env':'passEnv'};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--authorized-revoked-test') {
      if (result.authorizedRealRun) throw new Error('duplicate authorization');
      result.authorizedRealRun = true; continue;
    }
    const key = options[arg];
    if (!key || result[key] || !argv[i+1] || argv[i+1].startsWith('--'))
      throw new Error('Invalid revoked-test options');
    result[key] = argv[++i];
  }
  if (!namePattern.test(result.server || '') || !envPattern.test(result.passEnv || ''))
    throw new Error('Missing or invalid revoked-test options');
  return result;
}
export async function checkRevokedPass({ server, passEnv, authorizedRealRun = false,
  env = process.env, reader, fetchImpl = fetch,
  write = value => process.stdout.write(value) } = {}) {
  let result = fail(server || null, 'invalid_parameters');
  try {
    if (!namePattern.test(server || '') || !envPattern.test(passEnv || '')) throw Error();
    const pass = env[passEnv];
    if (typeof pass !== 'string' || !passPattern.test(pass)) {
      result = fail(server, 'revoked_test_pass_missing'); throw Error();
    }
    const map = await loadServers(env, reader);
    if (!map.has(server)) {
      result = fail(server, 'server_not_configured'); throw Error();
    }
    const url = validateServerUrl(map.get(server), true);
    const localhost = new URL(url).hostname;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(localhost);
    if (!local && !authorizedRealRun) {
      result = fail(server, 'owner_authorization_required', 'blocked'); throw Error();
    }
    let response;
    try {
      response = await fetchImpl(url + '/api/whoami', {
        method:'GET', redirect:'error', signal:AbortSignal.timeout(12000),
        headers:{accept:'application/json',authorization:'Bearer '+pass}
      });
    } catch {
      result = fail(server,'network_or_redirect_failure','unavailable'); throw Error();
    }
    if (response.status !== 401) {
      result = fail(server, 'not_explicit_pass_revoked', response.ok ? 'blocked' : 'unverified',
        response.status); throw Error();
    }
    let body;
    try {
      if (!/^application\/(?:[\w.+-]*\+)?json\b/i.test(response.headers.get('content-type') || ''))
        throw Error();
      body = await boundedJson(response, 8192);
    } catch {
      result = fail(server,'invalid_revocation_envelope','blocked',response.status); throw Error();
    }
    if (body?.ok !== false || body?.error?.code !== 'pass_revoked') {
      result = fail(server,'not_explicit_pass_revoked','unverified',response.status);
      throw Error();
    }
    result = { schema:1, server, ok:true, revocationVerified:true, route:'direct',
      state:'ready', reason:'explicit_pass_revoked', httpStatus:401, fullAcceptance:false };
  } catch { /* Never print server exceptions, tokens, response bodies or raw headers. */ }
  write(JSON.stringify(result)+'\n');
  return result.ok ? 0 : 1;
}
