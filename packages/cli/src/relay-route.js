import { createEncryptedRelayClient, githubCommentTransport } from './relay.js';
import { importRelayPublicKey } from '../../relay/src/crypto.js';
import { RouteError } from './config.js';
// Cache only route metadata/client in one invocation; never serialize passes.
const notices = new WeakMap();
export function relayRoute(name, env = process.env, notice = () => {}) {
  if (!env.RTOOL_RELAY) return null;
  let config;
  try {
    config = JSON.parse(env.RTOOL_RELAY);
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error();
  } catch { throw new RouteError('Invalid public relay configuration'); }
  const binding = config.servers?.[name];
  if (!binding) return null; // missing route isolates just this service
  let client;
  try {
    client = createEncryptedRelayClient({ publicKey: importRelayPublicKey(config.publicKey),
      transport: githubCommentTransport({ repo: config.repo, issue: binding.issue,
        token: env.RTOOL_RELAY_TOKEN }) });
  } catch { throw new RouteError('Relay key, binding or scoped token configuration missing'); }
  return async (pass, path, { method = 'GET', args } = {}) => {
    let seen = notices.get(env);
    if (!seen) { seen = new Set(); notices.set(env, seen); }
    if (!seen.has(name)) { notice('Using encrypted GitHub relay for ' + name + '\n'); seen.add(name); }
    let value;
    try {
      value = await client.execute({ server: name, tool: 'rtc.http', pass,
        args: { path, method, ...(args === undefined ? {} : { body: args }) } });
    } catch { throw new RouteError('Encrypted relay failed; request outcome may be unknown; do not repeat a write'); }
    if (path === '/api/contract' && value?.ok === true) return value.result;
    return value;
  };
}
export function safeToFallback(error, method) {
  if (method === 'GET') return true;
  // Only errors that prove a connection was never established permit POST fallback.
  const code = error?.cause?.code || error?.code;
  return ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code);
}
