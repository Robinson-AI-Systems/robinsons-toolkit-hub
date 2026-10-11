import { createHmac, timingSafeEqual } from 'node:crypto';
import { decodeRelayComment } from '../../cli/src/relay.js';

export const MAX_WEBHOOK_BYTES = 512 * 1024;
export function verifyWebhook(body, signature, secret) {
  if (!Buffer.isBuffer(body) || body.length > MAX_WEBHOOK_BYTES ||
      typeof secret !== 'string' || secret.length < 32 ||
      typeof signature !== 'string' || !/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}
export function parseWebhook(body, headers, { secret, repo, bindings }) {
  if (!verifyWebhook(body, headers['x-hub-signature-256'], secret))
    return { status: 401, code: 'invalid_signature' };
  if (headers['x-github-event'] !== 'issue_comment') return { status: 202, code: 'ignored' };
  let data;
  try { data = JSON.parse(body.toString('utf8')); }
  catch { return { status: 400, code: 'invalid_payload' }; }
  if (!data || data.action !== 'created') return { status: 202, code: 'ignored' };
  const issue = data.issue?.number;
  const binding = bindings[String(issue)];
  if (data.repository?.full_name !== repo || data.repository?.private !== true ||
      !binding || data.issue?.pull_request || !Number.isSafeInteger(issue) || issue < 1 ||
      data.comment?.user?.id !== binding.actorId || data.sender?.id !== binding.actorId ||
      !Number.isSafeInteger(data.comment?.id) || data.comment.id < 1)
    return { status: 403, code: 'outside_relay_scope' };
  const envelope = decodeRelayComment('request', data.comment.body);
  if (!envelope) return { status: 202, code: 'ignored' };
  return { issue, binding, envelope, commentId: data.comment.id };
}
export async function readRawBody(req) {
  const length = Number(req.headers?.['content-length']);
  if (Number.isFinite(length) && length > MAX_WEBHOOK_BYTES) throw new Error('body_cap');
  // Vercel must not parse the body: signatures authenticate the original bytes.
  if (req.body !== undefined) {
    if (!Buffer.isBuffer(req.body) || req.body.length > MAX_WEBHOOK_BYTES)
      throw new Error('raw_body_required');
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_WEBHOOK_BYTES) throw new Error('body_cap');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}
