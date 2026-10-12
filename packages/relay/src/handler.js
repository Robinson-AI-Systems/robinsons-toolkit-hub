import { readRawBody, verifyWebhook } from './webhook.js';
import { createRelayRuntime } from './runtime.js';
// An inert signed event can prove ingress without initializing DB, GitHub
// transport or any custom RTC destination. Created events remain fully guarded.
export function preflightSignedWebhook(raw, headers, secret) {
  if (!verifyWebhook(raw, headers?.['x-hub-signature-256'], secret))
    return { status: 401, body: { code: 'invalid_signature' } };
  if (headers?.['x-github-event'] !== 'issue_comment')
    return { status: 202, body: { code: 'ignored' } };
  let event;
  try { event = JSON.parse(raw.toString('utf8')); }
  catch { return { status: 400, body: { code: 'invalid_payload' } }; }
  if (!event || event.action !== 'created')
    return { status: 202, body: { code: 'ignored' } };
  return null; // The normal relay runtime still verifies signature, repo, actor and grant.
}
export function createWebhookHandler(getRuntime = createRelayRuntime(),
  { secret = process.env.RELAY_WEBHOOK_SECRET } = {}) {
  return async (req, res) => {
    let status, body;
    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST'); status = 405; body = { code: 'method_not_allowed' };
    } else {
      let runtime, raw, preliminary;
      // Only a valid configured signing secret enables runtime-free preflight.
      // A missing secret retains the original fail-closed runtime behavior.
      if (typeof secret === 'string' && secret.length >= 32) {
        try { raw = await readRawBody(req); }
        catch { status = 413; body = { code: 'raw_body_refused' }; }
        if (raw) preliminary = preflightSignedWebhook(raw, req.headers, secret);
      }
      if (preliminary) ({ status, body } = preliminary);
      else if (status === undefined) {
        try { runtime = getRuntime(); }
        catch { status = 503; body = { code: 'relay_not_configured' }; }
        if (runtime) {
          if (!raw) {
            try { raw = await readRawBody(req); }
            catch { status = 413; body = { code: 'raw_body_refused' }; }
          }
          if (raw) {
            try { ({ status, body } = await runtime.handle(raw, req.headers)); }
            catch { status = 503; body = { code: 'relay_unavailable' }; }
          }
        }
      }
    }
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };
}

// Standard Web signature avoids platform JSON helpers touching signed bytes.
export function createWebhookFetch(getRuntime = createRelayRuntime(), options) {
  const handler = createWebhookHandler(getRuntime, options);
  return async (request) => {
    const headers = {};
    let status, body;
    const response = { setHeader: (key, value) => { headers[key] = value; },
      set statusCode(value) { status = value; }, end: (value) => { body = value; } };
    const incoming = { method: request.method, headers: Object.fromEntries(request.headers),
      async *[Symbol.asyncIterator]() {
        if (request.body) for await (const bytes of request.body) yield bytes;
      } };
    await handler(incoming, response);
    return new Response(body, { status, headers });
  };
}
