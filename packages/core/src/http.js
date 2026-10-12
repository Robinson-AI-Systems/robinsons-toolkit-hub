// Service-independent HTTP helpers. Never derive OAuth issuer from an untrusted Host header.
export function publicOrigin(env = process.env) {
  const value = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  let url;
  try { url = new URL(value); } catch { throw new Error('PUBLIC_BASE_URL must be configured as an HTTPS origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search || url.pathname !== '/') {
    throw new Error('PUBLIC_BASE_URL must be configured as an HTTPS origin');
  }
  return url.origin;
}

export function send(res, status, value, contentType = 'application/json; charset=utf-8') {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', contentType);
  return res.status(status).send(contentType.startsWith('application/json') ? JSON.stringify(value) : value);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
export const MAX_HTTP_BODY_BYTES = 16 * 1024;

// Vercel can pre-parse JSON before a handler runs. Reserializing an object
// cannot prove original wire size (insignificant whitespace and duplicate keys vanish).
export function incomingBodyWithinLimit(req) {
  if (req.method !== 'POST') return true;
  const supplied = req.headers?.['content-length'];
  let declared;
  if (supplied !== undefined) {
    if (typeof supplied !== 'string' || !/^(0|[1-9]\d*)$/.test(supplied)) return false;
    declared = Number(supplied);
    if (!Number.isSafeInteger(declared) || declared > MAX_HTTP_BODY_BYTES) return false;
  }
  const raw = req.rawBody;
  if (raw !== undefined) {
    if (typeof raw !== 'string' && !Buffer.isBuffer(raw)) return false;
    const bytes = Buffer.byteLength(raw);
    if (bytes > MAX_HTTP_BODY_BYTES || (declared !== undefined && bytes !== declared)) return false;
  } else if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    const bytes = Buffer.byteLength(req.body);
    if (bytes > MAX_HTTP_BODY_BYTES || (declared !== undefined && bytes !== declared)) return false;
  } else if (req.body && typeof req.body === 'object') {
    // Some frameworks pre-parse JSON and leave a caller-controlled short
    // Content-Length behind. Always bound the structured payload itself;
    // the declared length alone is not evidence that the object was small.
    if (declared === undefined) return false;
    try {
      if (Buffer.byteLength(JSON.stringify(req.body), 'utf8') > MAX_HTTP_BODY_BYTES)
        return false;
    } catch { return false; }
  }
  return true;
}

export function paramsOf(req) {
  if (req.method === 'GET') return req.query || {};
  const contentType = String(req.headers?.['content-type'] || '').split(';')[0].toLowerCase();
  const body = req.body;
  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    // Frameworks preparse JSON and form bodies; enforce the same transport cap
    // as the raw-string path before touching DB or authentication state.
    try {
      if (Buffer.byteLength(JSON.stringify(body), 'utf8') <= MAX_HTTP_BODY_BYTES) return body;
    } catch { /* Reject unserializable structured bodies. */ }
    throw new Error('Invalid request body');
  }
  if (typeof body !== 'string' || Buffer.byteLength(body) > MAX_HTTP_BODY_BYTES) throw new Error('Invalid request body');
  if (contentType === 'application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(body));
  if (contentType === 'application/json') {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  }
  throw new Error('Unsupported request body');
}
export const only = (res, req, methods) => {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  send(res, 405, { error: 'method_not_allowed' });
  return false;
};
