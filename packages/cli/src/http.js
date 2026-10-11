// The direct HTTPS door never moves authorization tokens into a query or log.
import { RouteError } from './config.js';
import { safeToFallback } from './relay-route.js';

export class ToolError extends Error {
  constructor(message, exitCode = 4, code = 'service_error') {
    super(message); this.name = 'ToolError'; this.exitCode = exitCode; this.code = code;
  }
}
const redacted = (message) => String(message)
  .replace(/rtc_pass_[A-Za-z0-9_-]{43}/g, '[redacted]')
  .replace(/(?:sk|rk)_live_[A-Za-z0-9]{12,}/g, '[redacted]')
  .slice(0, 280);
export function errorCodeOf(data) {
  if (data?.result?.needsConfirmation) return 2;
  const code = data?.error?.code;
  if (code === 'needs_confirmation') return 2;
  if (['refused_by_guard', 'outside_scope', 'permission'].includes(code)) return 3;
  if (['pass_expired', 'pass_revoked'].includes(code)) return 5;
  return 4;
}
export async function httpRequest(base, pass, path, { method = 'GET', args, fallback } = {}) {
  const url = new URL(path, base);
  if (url.origin !== new URL(base).origin) throw new RouteError('Cross-origin tool URL refused');
  let response;
  try {
    response = await fetch(url, {
      method, redirect: 'error',
      headers: { ...(pass ? { authorization: 'Bearer ' + pass } : {}),
        ...(args === undefined ? {} : { 'content-type': 'application/json' }) },
      body: args === undefined ? undefined : JSON.stringify(args),
      signal: AbortSignal.timeout(12000)
    });
  } catch (error) {
    if (fallback && safeToFallback(error, method)) {
      const data = await fallback(pass, path, { method, args });
      if (data?.ok === false) throw new ToolError(redacted(data.error?.what || data.error?.code), errorCodeOf(data), data?.error?.code);
      return data;
    }
    throw new RouteError(method === 'POST' ?
      'Direct request failed; write outcome may be unknown; do not automatically retry' :
      'Direct HTTPS connection failed; no usable relay route');
  }
  let data;
  try { data = await response.json(); } catch {
    throw new ToolError('Service sent a non-JSON HTTP response (' + response.status + ')');
  }
  if (response.status >= 400 || data?.ok === false) {
    const reason = data?.error?.what || data?.error?.code || 'HTTP ' + response.status;
    throw new ToolError(redacted(reason), errorCodeOf(data), data?.error?.code);
  }
  return data;
}
export async function contract(base, pass = null, fallback) {
  const manifest = await httpRequest(base, pass, '/api/contract', { fallback });
  if (manifest?.rtc !== 1 || !/^[a-z][a-z0-9_]*$/.test(manifest.prefix || '')) {
    throw new RouteError('Server does not advertise supported RTC 1 manifest');
  }
  return manifest;
}
