import { readRawBody } from './webhook.js';
import { createRelayRuntime } from './runtime.js';
export function createWebhookHandler(getRuntime = createRelayRuntime()) {
  return async (req, res) => {
    let status, body;
    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST'); status = 405; body = { code: 'method_not_allowed' };
    } else {
      let runtime;
      try { runtime = getRuntime(); }
      catch { status = 503; body = { code: 'relay_not_configured' }; }
      if (runtime) {
        let raw;
        try { raw = await readRawBody(req); }
        catch { status = 413; body = { code: 'raw_body_refused' }; }
        if (raw) {
          try { ({ status, body } = await runtime.handle(raw, req.headers)); }
          catch { status = 503; body = { code: 'relay_unavailable' }; }
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
export function createWebhookFetch(getRuntime = createRelayRuntime()) {
  const handler = createWebhookHandler(getRuntime);
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
