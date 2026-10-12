// An observation is never a certification: record hosted contract, read-only and route gates separately.
import { validateServerUrl, boundedJson } from '../../relay/src/forward.js';
export const REQUIRED_RTC_SERVERS = Object.freeze([
  'stripe', 'github', 'vercel', 'neon', 'google-workspace'
]);
const namePattern = /^[a-z][a-z0-9_-]{0,39}$/;
const goodManifest = (m) => m && m.rtc === 1 &&
  /^[a-z][a-z0-9_]*$/.test(m.prefix || '') &&
  typeof m.server === 'string' && m.server.length > 0;
export function parseFleetOrigins(raw) {
  let data;
  try { data = JSON.parse(raw || '{}'); } catch { throw new Error('Invalid RTC fleet origin JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.getPrototypeOf(data) !== Object.prototype) throw new Error('Invalid RTC fleet origins');
  const origins = {};
  for (const [name, url] of Object.entries(data)) {
    if (!namePattern.test(name) || typeof url !== 'string')
      throw new Error('Invalid RTC fleet server entry');
    origins[name] = validateServerUrl(url);
  }
  return origins;
}
export function parseReadTests(raw) {
  let data;
  try { data = JSON.parse(raw || '{}'); } catch { throw new Error('Invalid RTC fleet read-test JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid RTC fleet read tests');
  for (const [name, value] of Object.entries(data)) {
    if (!namePattern.test(name) || !value || Array.isArray(value) ||
        Object.keys(value).some(k => !['readTool', 'passEnv', 'argsEnv'].includes(k)) ||
        !/^[a-z][a-z0-9_]{0,199}$/.test(value.readTool || '') ||
        !/^[A-Z][A-Z0-9_]{0,99}$/.test(value.passEnv || '') ||
        (value.argsEnv && !/^[A-Z][A-Z0-9_]{0,99}$/.test(value.argsEnv)))
      throw new Error('Invalid RTC fleet read-test plan');
  }
  return data;
}
function report(name, origin, state, reason, extra = {}) {
  return { server: name, origin: origin || null, state, reason, contract: false,
    authenticatedReadOnly: false, direct: false, relay: false, sandbox: false,
    revocation: false, fullAcceptance: false, ...extra };
}
export async function probeRtcFleet({ origins = {}, fetchImpl = fetch, authorize } = {}) {
  const names = [...new Set([...REQUIRED_RTC_SERVERS, ...Object.keys(origins)])].sort();
  const checks = [];
  for (const name of names) {
    if (!Object.hasOwn(origins, name)) {
      checks.push(report(name, null, 'unverified', 'no_verified_origin')); continue;
    }
    let origin;
    try { origin = validateServerUrl(origins[name]); } catch {
      checks.push(report(name, null, 'blocked', 'unsafe_origin')); continue;
    }
    let response;
    try {
      response = await fetchImpl(origin + '/api/contract', {
        method: 'GET', redirect: 'error', headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(12000)
      });
    } catch {
      checks.push(report(name, origin, 'unavailable', 'network_or_redirect_failure')); continue;
    }
    if ([401, 403, 407, 451].includes(response.status)) {
      checks.push(report(name, origin, 'blocked', 'access_protected', { httpStatus: response.status })); continue;
    }
    if (!response.ok) {
      checks.push(report(name, origin, 'unavailable', 'http_error', { httpStatus: response.status })); continue;
    }
    let manifest;
    try {
      if (!/^application\/(?:[\w.+-]*\+)?json\b/i.test(response.headers.get('content-type') || ''))
        throw new Error('Not JSON');
      manifest = await boundedJson(response, 32 * 1024);
    } catch {
      checks.push(report(name, origin, 'blocked', 'invalid_or_oversized_manifest')); continue;
    }
    if (!goodManifest(manifest)) {
      checks.push(report(name, origin, 'blocked', 'rtc_1_contract_invalid',
        { httpStatus: response.status, advertisedRtc: Number.isInteger(manifest?.rtc) ? manifest.rtc : null })); continue;
    }
    if (!authorize) {
      checks.push(report(name, origin, 'unverified', 'read_only_auth_unverified',
        { httpStatus: response.status, contract: true, prefix: manifest.prefix })); continue;
    }
    let authorized = false;
    try { authorized = (await authorize(name, origin, manifest)) === true; } catch { /* never print provider errors */ }
    checks.push(report(name, origin, authorized ? 'ready' : 'unverified',
      authorized ? 'authenticated_direct_read_only' : 'read_only_auth_unverified',
      { httpStatus: response.status, contract: true, prefix: manifest.prefix,
        authenticatedReadOnly: authorized, direct: authorized }));
  }
  return { schema: 1, allAccepted: false, checks };
}
