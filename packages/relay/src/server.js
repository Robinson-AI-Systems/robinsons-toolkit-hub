import { parseWebhook } from './webhook.js';
import { safeRelayResult } from './safety.js';
import { openRequest, sealReply } from './crypto.js';

// No decrypted request data is persisted. A claim survives downstream failure:
// a retry must never repeat a write whose outcome is unknown.
export function createRelayServer({ secret, repo, bindings, privateKey, store,
  forward, transportFor, now = Date.now }) {
  return async (body, headers) => {
    const parsed = parseWebhook(body, headers, { secret, repo, bindings });
    if (parsed.status) return { status: parsed.status, body: { code: parsed.code } };
    let request;
    try { request = openRequest(parsed.envelope, privateKey, now()); }
    catch { return { status: 400, body: { code: 'invalid_envelope' } }; }
    try {
      if (request.server !== parsed.binding.server)
        return { status: 403, body: { code: 'outside_relay_scope' } };
      if (!await store.claim(request.id))
        return { status: 409, body: { code: 'replay_refused' } };
      const result = safeRelayResult(await forward(request), request.pass);
      let reply;
      try { reply = sealReply(request.id, request.replyKey, result); }
      catch { reply = sealReply(request.id, request.replyKey,
        { ok: false, error: { code: 'service_error', what: 'Relay result exceeds transport cap' } }); }
      await transportFor(parsed.issue).post('reply', reply);
      return { status: 200, body: { code: 'reply_posted' } };
    } catch {
      return { status: 503, body: { code: 'relay_unavailable' } };
    } finally {
      request.replyKey.fill(0);
      request.pass = undefined;
      request.args = undefined;
    }
  };
}
