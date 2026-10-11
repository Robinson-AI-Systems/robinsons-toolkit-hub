// The direct HTTPS door never moves authorization tokens into a query or log.
import { RouteError } from './config.js';

export class ToolError extends Error {
  constructor(message, exitCode = 4) {
    super(message); this.name = 'ToolError'; this.exitCode = exitCode;
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
export async function httpRequest(base, pass, path, { method = 'GET', args } = {}) {
  const url = new URL(path, base);
  if (url.origin !== new URL(base).origin) throw new RouteError('Cross-origin tool URL refused');
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: { ...(pass ? { authorization: 'Bearer ' + pass } : {}),
        ...(args === undefined ? {} : { 'content-type': 'application/json' }) },
      body: args === undefined ? undefined : JSON.stringify(args),
      signal: AbortSignal.timeout(12000)
    });
  } catch { throw new RouteError('Direct HTTPS connection failed; relay is not yet configured'); }
  let data;
  try { data = await response.json(); } catch {
    throw new ToolError('Service sent a non-JSON HTTP response (' + response.status + ')');
  }
  if (response.status >= 400 || data?.ok === false) {
    const reason = data?.error?.what || data?.error?.code || 'HTTP ' + response.status;
    throw new ToolError(redacted(reason), errorCodeOf(data));
  }
  return data;
}
export async function contract(base) {
  const manifest = await httpRequest(base, null, '/api/contract');
  if (manifest?.rtc !== 1 || !/^[a-z][a-z0-9_]*$/.test(manifest.prefix || '')) {
    throw new RouteError('Server does not advertise supported RTC 1 manifest');
  }
  return manifest;
}
