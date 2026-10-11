// The pass belongs to the RTC server. Relay policy only narrows routing.
const MAX_RESULT_BYTES = 32 * 1024;
const failure = (code) => ({ ok: false, error: { code, what: 'Relay service request failed' } });
export function validateServerUrl(value, allowLoopback = false) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid relay server URL'); }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(url.protocol === 'https:' || (allowLoopback && loopback && url.protocol === 'http:')) ||
      (!allowLoopback && loopback)) throw new Error('Relay needs a fixed HTTPS server origin');
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
    if (!origins.has(server) || !/^[A-Za-z0-9_]{1,200}$/.test(tool))
      return failure('outside_scope');
    try {
      const response = await fetchImpl(origins.get(server) + '/api/tools/' + tool, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
        headers: { authorization: 'Bearer ' + pass, 'content-type': 'application/json' },
        body: JSON.stringify(args)
      });
      const value = await boundedJson(response);
      if (!value || typeof value !== 'object' || typeof value.ok !== 'boolean')
        return failure('service_error');
      if (!response.ok && value.ok) return failure('service_error');
      return value;
    } catch { return failure('service_error'); }
  };
}
