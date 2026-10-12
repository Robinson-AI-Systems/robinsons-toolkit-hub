// Portable HTTP helpers adapted from reviewed Stripe service source.
// Never trust caller Host and never serialize active caller-owned body objects.
import {isProxy} from 'node:util/types';
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
// Framework-preparsed bodies require an inert snapshot before serialization.
// JSON.stringify on caller-owned input can invoke a getter or toJSON.
function boundedParsedJson(body) {
  const visited=new WeakSet();
  let fields=0;
  const copy=(value,depth)=>{
    if(value===null||typeof value==='string'||typeof value==='boolean')return value;
    if(typeof value==='number'&&Number.isFinite(value))return value;
    if(typeof value!=='object'||depth>16||isProxy(value)||visited.has(value))
      throw new TypeError('Unsafe JSON body');
    visited.add(value);
    const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
    if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)
      throw new TypeError('Unsafe JSON body');
    const descriptors=Object.getOwnPropertyDescriptors(value);
    if(Object.getOwnPropertySymbols(value).length)throw new TypeError('Unsafe JSON body');
    const count=array?value.length:0;
    if(array&&(count>1024||Object.keys(descriptors).length!==count+1))
      throw new TypeError('Unsafe JSON array');
    const output=array?[]:Object.create(null);
    for(const [name,field] of Object.entries(descriptors)){
      if(array&&name==='length')continue;
      if(++fields>2048||!field.enumerable||!Object.hasOwn(field,'value')||
        ['__proto__','constructor','prototype','toJSON'].includes(name)||
        array&&(!/^(0|[1-9][0-9]*)$/.test(name)||Number(name)>=count))
        throw new TypeError('Unsafe JSON property');
      output[name]=copy(field.value,depth+1);
    }
    return output;
  };
  const snapshot=copy(body,0);
  if(Buffer.byteLength(JSON.stringify(snapshot),'utf8')>MAX_HTTP_BODY_BYTES)
    throw new RangeError('Oversized JSON body');
  return snapshot;
}

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
      if (!boundedParsedJson(req.body))
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
      return boundedParsedJson(body);
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
