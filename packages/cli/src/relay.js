// GitHub issue comments are an encrypted transport, not a secret store.
// Only ciphertext envelopes reach the API; the relay must delete consumed comments.
import { sealRequest, openReply } from '../../relay/src/crypto.js';

const marker = (kind) => 'rtc:v1:' + kind + ':';
const validRepo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export function encodeRelayComment(kind, envelope) {
  if (!['request', 'reply'].includes(kind)) throw new Error('Invalid relay comment kind');
  return marker(kind) + Buffer.from(JSON.stringify(envelope)).toString('base64url');
}
export function decodeRelayComment(kind, body) {
  if (typeof body !== 'string' || !body.startsWith(marker(kind)) ||
    body.length > 250000) return null;
  try {
    const result = JSON.parse(Buffer.from(body.slice(marker(kind).length), 'base64url').toString('utf8'));
    if (!result || result.v !== 1 || typeof result.id !== 'string' ||
      typeof result.ciphertext !== 'string') return null;
    return result;
  } catch { return null; }
}
export function githubCommentTransport({ repo, issue, token, fetchImpl = fetch } = {}) {
  if (!validRepo.test(repo || '') || !Number.isSafeInteger(issue) || issue < 1 ||
    typeof token !== 'string' || !token.trim()) {
    throw new Error('GitHub relay repo, issue and scoped token are required');
  }
  const base = 'https://api.github.com/repos/' + repo;
  const request = async (path, method = 'GET', data) => {
    let response;
    try {
      response = await fetchImpl(base + path, {
        method, headers: { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json',
          'content-type': 'application/json', 'user-agent': 'rtool-relay-v1',
          'x-github-api-version': '2022-11-28' },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
        signal: AbortSignal.timeout(10000)
      });
    } catch { throw new Error('Encrypted GitHub relay transport unavailable'); }
    if (!response.ok) throw new Error('Encrypted GitHub relay API refused request (HTTP ' + response.status + ')');
    if (response.status === 204) return null;
    try { return await response.json(); }
    catch { throw new Error('GitHub relay returned invalid JSON'); }
  };
  return {
    repo, issue,
    async post(kind, envelope) {
      const response = await request('/issues/' + issue + '/comments', 'POST',
        { body: encodeRelayComment(kind, envelope) });
      if (!Number.isSafeInteger(response?.id)) throw new Error('GitHub did not return comment ID');
      return response.id;
    },
    async list() {
      const comments = [];
      for (let page = 1; page <= 5; page++) {
        const result = await request('/issues/' + issue + '/comments?per_page=100&page=' + page);
        if (!Array.isArray(result)) throw new Error('Invalid GitHub comments listing');
        comments.push(...result.filter((x) => Number.isSafeInteger(x.id) &&
          typeof x.body === 'string').map((x) => ({ id: x.id, body: x.body })));
        if (result.length < 100) return comments;
      }
      throw new Error('GitHub relay issue has too many comments; cleanup required');
    },
    async delete(id) {
      if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid GitHub comment ID');
      await request('/issues/comments/' + id, 'DELETE');
    }
  };
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function createEncryptedRelayClient({ transport, publicKey, attempts = 15,
  pollIntervalMs = 2000 } = {}) {
  if (!transport || !publicKey || !Number.isInteger(attempts) || attempts < 1 || attempts > 120 ||
    !Number.isInteger(pollIntervalMs) || pollIntervalMs < 0 || pollIntervalMs > 30000)
    throw new Error('Invalid encrypted relay client options');
  return {
    async execute({ server, tool, args = {}, pass }) {
      const sealed = sealRequest({ publicKey, server, tool, args, pass });
      let requestComment = null, replyComment = null, completed = false, value;
      let taskError = null;
      try {
        requestComment = await transport.post('request', sealed.request);
        for (let i = 0; i < attempts; i++) {
          const list = await transport.list();
          const matched = list.map((x) => ({ id: x.id, box: decodeRelayComment('reply', x.body) }))
            .find((x) => x.box?.id === sealed.id);
          if (matched) {
            replyComment = matched.id;
            value = openReply(matched.box, sealed.id, sealed.replyKey);
            completed = true;
            break;
          }
          if (i < attempts - 1) await sleep(pollIntervalMs);
        }
      } catch (error) {
        taskError = error;
      }
      const ids = [replyComment, requestComment].filter(Boolean);
      const settled = await Promise.allSettled(ids.map((id) => transport.delete(id)));
      if (settled.some((x) => x.status === 'rejected'))
        throw new Error('Encrypted relay cleanup failed; ciphertext comments need manual cleanup');
      if (taskError) throw taskError;
      if (!completed) throw new Error('Encrypted relay reply did not arrive before timeout');
      return value;
    }
  };
}
