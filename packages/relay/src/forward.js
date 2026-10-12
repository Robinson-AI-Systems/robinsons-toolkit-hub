// The pass belongs to the RTC server. Relay policy only narrows routing.
import { isIP } from 'node:net';
import { relayHttpRoute } from './routes.js';
const MAX_RESULT_BYTES = 32 * 1024;
const failure = (code) => ({ ok: false, error: { code, what: 'Relay service request failed' } });
// Only fixed public HTTPS RTC origins may leave the hosted relay. Private
// address literals and internal DNS names are never valid hosted destinations.
const INTERNAL_DNS = /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/;
function addressScope(host, allowLoopback) {
  const unbracketed = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  const kind = isIP(unbracketed);
  if (kind === 6) return allowLoopback && unbracketed === '::1' ? 'loopback' : 'forbidden';
  if (kind === 4) {
    const [a, b, c] = unbracketed.split('.').map(Number);
    if (a === 127) return allowLoopback ? 'loopback' : 'forbidden';
    if (a === 0 || a === 10 || a >= 224 || a === 169 && b === 254 ||
        a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 ||
          b === 0 && c === 0 || b === 0 && c === 2) ||
        a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19 ||
          b === 51 && c === 100) || a === 203 && b === 0 && c === 113)
      return 'forbidden';
    return 'public';
  }
  if (unbracketed === 'localhost') return allowLoopback ? 'loopback' : 'forbidden';
  if (INTERNAL_DNS.test(unbracketed)) return 'forbidden';
  return 'public';
}
export function validateServerUrl(value, allowLoopback = false) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid relay server URL'); }
  const scope = addressScope(url.hostname, allowLoopback);
  if (scope === 'forbidden' || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/' || url.port ||
      !(url.protocol === 'https:' || (allowLoopback && scope === 'loopback' &&
        url.protocol === 'http:')))
    throw new Error('Relay needs a fixed public HTTPS server origin');
  return url.origin;
}
export async function boundedJson(response, cap = MAX_RESULT_BYTES) {
  if (Number(response.headers.get('content-length')) > cap) throw new Error('result_cap');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('missing_body');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > cap) throw new Error('result_cap');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export function createForwarder({ servers, fetchImpl = fetch, allowLoopback = false }) {
  const origins = new Map(Object.entries(servers).map(([name, value]) =>
    [name, validateServerUrl(value, allowLoopback)]));
  return async ({ server, tool, args, pass }) => {
    if (!origins.has(server) || (tool !== 'rtc.http' && !/^[a-z][a-z0-9_]{0,199}$/.test(tool)))
      return failure('outside_scope');
    try {
      const route = tool === 'rtc.http' ? relayHttpRoute(args) :
        { path: '/api/tools/' + tool, method: 'POST', body: args };
      const response = await fetchImpl(origins.get(server) + route.path, {
        method: route.method, redirect: 'error', signal: AbortSignal.timeout(12000),
        headers: { authorization: 'Bearer ' + pass, 'content-type': 'application/json' },
        ...(route.body === undefined ? {} : { body: JSON.stringify(route.body) })
      });
      const value = await boundedJson(response);
      if (route.path === '/api/contract' && route.method === 'GET' && response.ok && value?.rtc === 1)
        return { ok: true, result: value };
      if (!value || typeof value !== 'object' || typeof value.ok !== 'boolean')
        return failure('service_error');
      if (!response.ok && value.ok) return failure('service_error');
      return value;
    } catch { return failure('service_error'); }
  };
}
