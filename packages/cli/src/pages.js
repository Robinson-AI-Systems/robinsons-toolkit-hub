// Follow RTC pagination without taking an unbounded result into an agent's context.
// All page retrieval stays on the configured server's origin and uses the same pass.
import { send } from './dispatch.js';
import { ToolError } from './http.js';

const MAX_PAGES = 50;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
function nextPath(base, token) {
  if (typeof token === 'number' && Number.isSafeInteger(token) && token > 0) {
    const q = new URLSearchParams(base.slice(base.indexOf('?') + 1));
    q.set('page', String(token));
    return base.split('?')[0] + '?' + q.toString();
  }
  if (typeof token !== 'string' || !token || token.length > 1024) {
    throw new ToolError('Invalid pagination cursor from service');
  }
  if (token.startsWith('/api/')) {
    const path = token.split('?')[0];
    if (!['/api/tools', '/api/results'].some((prefix) => path === prefix ||
      path.startsWith(prefix + '/'))) throw new ToolError('Unsafe pagination path');
    return token;
  }
  if (/^https?:\/\//.test(token)) throw new ToolError('Cross-origin pagination URL refused');
  const q = new URLSearchParams(base.includes('?') ? base.slice(base.indexOf('?') + 1) : '');
  q.set('cursor', token);
  return base.split('?')[0] + '?' + q.toString();
}
export async function* toolPages(server, initial) {
  let path = initial;
  const visited = new Set();
  for (let i = 0; i < MAX_PAGES; i++) {
    if (visited.has(path)) throw new ToolError('Service pagination cursor repeats');
    visited.add(path);
    const data = await send(server, path);
    const tools = data?.result?.tools;
    if (!Array.isArray(tools)) throw new ToolError('Invalid tools page');
    yield tools;
    const next = data.result.next ?? data.next;
    if (!next) return;
    path = nextPath(initial, next);
  }
  throw new ToolError('Result exceeded safe pagination limit');
}
export async function materialize(server, data) {
  if (!data?.handle) return data;
  const pages = [];
  const initial = '/api/results/' + encodeURIComponent(data.handle);
  let path = initial;
  const visited = new Set();
  let bytes = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    if (visited.has(path)) throw new ToolError('Repeated result page');
    visited.add(path);
    const payload = await send(server, path);
    const json = JSON.stringify(payload);
    bytes += Buffer.byteLength(json);
    if (bytes > MAX_FILE_BYTES) throw new ToolError('Result exceeds safe 50 MB file limit');
    if (payload?.ok === false) throw new ToolError('Result page failed');
    pages.push(payload.result ?? payload);
    const next = payload.next ?? payload.result?.next;
    if (!next) return { ok: true, result: pages.length === 1 ? pages[0] : pages };
    path = nextPath(initial, next);
  }
  throw new ToolError('Result has too many pages');
}
