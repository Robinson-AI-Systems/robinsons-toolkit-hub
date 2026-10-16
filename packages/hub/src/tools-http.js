import { brokerCatalog, mcpReply } from './http-door.js';
import { runFederatedBroker } from './federation.js';
import {serverNamePattern} from './server-name.js';

const toolName = /^[a-z][a-z0-9_]{2,119}$/;
const serverName = serverNamePattern;
const areaName = /^[a-z][a-z0-9_]{0,59}$/;
const deny = code => ({ ok: false, error: { code } });
const selectTool = name => brokerCatalog().find(tool => tool.name === name);
const federatedHubTools = new Set([
  'hub_health', 'hub_search_tools', 'hub_describe_tool',
  'hub_call', 'hub_batch', 'hub_namespaces', 'hub_recent_changes',
  'hub_provider_read', 'hub_provider_describe'
]);
function inScope(actor) {
  return actor?.mode === 'test' && Array.isArray(actor.areas) &&
    actor.areas.includes('gateway') && actor.allowWrites !== true;
}
function listTools(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query) ||
    Object.keys(query).some(key => !['q', 'area', 'server', 'limit', 'cursor'].includes(key))) return null;
  const q = query.q ?? '';
  const area = query.area ?? '';
  const server = query.server;
  const cursor = query.cursor;
  const limitRaw = query.limit ?? '10';
  if (typeof q !== 'string' || q.length > 120 || typeof area !== 'string' ||
    (area && !areaName.test(area)) ||
    (server !== undefined && (typeof server !== 'string' || !serverName.test(server))) ||
    (cursor !== undefined && (typeof cursor !== 'string' || cursor.length > 1280)) ||
    (typeof limitRaw !== 'string' && typeof limitRaw !== 'number') ||
    !/^[1-9][0-9]?$|^100$/.test(String(limitRaw)) ||
    Array.isArray(limitRaw)) return null;
  const limit = Number(limitRaw);
  const matching = brokerCatalog().filter(tool =>
    (!server || server === 'hub') && (!area || tool.area === area) &&
    (!q || (tool.name + ' ' + tool.description).toLowerCase().includes(q.toLowerCase())));
  return { q, area, server, cursor, limit, tools: matching.slice(0, limit), next: null };
}
function argsValid(args) {
  if (args === undefined) return true;
  return args !== null && typeof args === 'object' && !Array.isArray(args) &&
    Object.getPrototypeOf(args) === Object.prototype;
}
function runTool(name, args, actor) {
  const tool = selectTool(name);
  if (!tool || tool.writes || !argsValid(args)) return deny('invalid_args');
  const reply = mcpReply({ jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name, arguments: args ?? {} } }, actor);
  if (!reply || reply.error || reply.result?.isError) return deny('invalid_args');
  return { ok: true, result: reply.result.structuredContent };
}
function validBatch(body) {
  return body && typeof body === 'object' && !Array.isArray(body) &&
    Object.getPrototypeOf(body) === Object.prototype &&
    Object.keys(body).length === 1 &&
    Array.isArray(body.calls) && body.calls.length > 0 && body.calls.length <= 10 &&
    body.calls.every(call => call && typeof call === 'object' &&
      !Array.isArray(call) && Object.getPrototypeOf(call) === Object.prototype &&
      typeof call.name === 'string' && toolName.test(call.name) &&
      argsValid(call.args) && Object.keys(call).every(key => ['name','args'].includes(key)));
}
function boundedBody(body) {
  if (!argsValid(body)) return false;
  try { return Buffer.byteLength(JSON.stringify(body), 'utf8') <= 8192; }
  catch { return false; }
}
function statusFor(code) {
  return code === 'not_found' ? 404 :
    ['outside_scope','permission','pass_revoked','pass_expired','refused_by_guard',
      'needs_confirmation'].includes(code) ? 403 :
    code === 'rate_limited' ? 429 :
    ['unavailable','service_error'].includes(code) ? 503 : 400;
}
function send(res, payload, status = 200) {
  let size;
  try { size = Buffer.byteLength(JSON.stringify(payload), 'utf8'); }
  catch { return res.status(503).json(deny('service_error')); }
  // HTTP, JSON-RPC text and structured results must never silently truncate.
  if (size > 16384) return res.status(413).json(deny('too_large'));
  return res.status(status).json(payload);
}
function respondFederated(res, state) {
  if (!state?.ok) {
    const code = typeof state?.error?.code === 'string' ?
      state.error.code : 'service_error';
    return send(res, deny(code), statusFor(code));
  }
  return send(res, { ok: true, result: state.result });
}

// Direct RTC HTTPS is the same actor- and grant-scoped TEST read plane as
// native /api/mcp, not a separate unguarded provider proxy. Existing Hub-owned
// routes retain their backward-compatible shapes.
export async function handleHubTools(req, res, { withDb, authorize, federate = runFederatedBroker }, route) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const methods = route === 'list' ? ['GET'] : route === 'item' ?
    ['GET','POST'] : ['POST'];
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    return res.status(405).json(deny('method_not_allowed'));
  }
  const name = route === 'item' ? req.query?.name : null;
  if (route === 'item' && (typeof name !== 'string' || !toolName.test(name)))
    return res.status(400).json(deny('invalid_args'));
  const filtered = route === 'list' ? listTools(req.query) : null;
  if (route === 'list' && !filtered) return res.status(400).json(deny('invalid_args'));
  if (req.method === 'POST' && !boundedBody(req.body))
    return res.status(400).json(deny('invalid_args'));
  if (route === 'batch' && !validBatch(req.body))
    return res.status(400).json(deny('invalid_args'));
  try {
    return await withDb(async (db, settings) => {
      const state = await authorize(db, settings, req.headers?.authorization, 'pass');
      if (!state) return res.status(401).json(deny('permission'));
      if (state.retryAfter) {
        res.setHeader('Retry-After', String(state.retryAfter));
        return res.status(429).json(deny('rate_limited'));
      }
      if (!inScope(state.actor)) return res.status(403).json(deny('outside_scope'));
      const actor = state.actor;
      if (route === 'list') {
        // Empty search is intentionally the compact, bounded Hub catalogue.
        // A nonempty query selects at most three caller-authorized RTC grants.
        if (!Object.hasOwn(req.query, 'q') && !filtered.server && !filtered.cursor)
          return send(res, { ok: true, result: { tools: filtered.tools, next: null } });
        if (filtered.server === 'hub' || !actor.ownerId) {
          if (filtered.server && filtered.server !== 'hub')
            return res.status(403).json(deny('outside_scope'));
          return send(res, { ok: true, result: { tools: filtered.tools, next: null } });
        }
        if (filtered.limit > 20)
          return res.status(400).json(deny('invalid_args'));
        return respondFederated(res, await federate('hub_search_tools', {
          query: filtered.q, limit: filtered.limit,
          ...(filtered.area ? { area: filtered.area } : {}),
          ...(filtered.cursor ? { cursor: filtered.cursor } : {}),
          ...(filtered.server && filtered.server !== 'hub' ? { server: filtered.server } : {})
        }, actor, db, settings));
      }
      if (route === 'item' && req.method === 'GET') {
        const tool = selectTool(name);
        if (tool) return send(res, { ok: true, result: tool });
        if (name.startsWith('hub_')) return res.status(404).json(deny('not_found'));
        if (!actor.ownerId) return res.status(403).json(deny('outside_scope'));
        return respondFederated(res, await federate('hub_describe_tool', { name },
          actor, db, settings));
      }
      if (route === 'item') {
        if (selectTool(name)) {
          // Public broker names must use the same authorized, audited RTC
          // dispatcher as native MCP and direct provider HTTPS calls. The
          // synchronous foundation would otherwise misreport health and
          // silently refuse already-eligible federated read operations.
          if (federatedHubTools.has(name))
            return respondFederated(res, await federate(name, req.body,
              actor, db, settings));
          const result = runTool(name, req.body, actor);
          return send(res, result, result.ok ? 200 : 400);
        }
        if (name.startsWith('hub_')) return res.status(404).json(deny('not_found'));
        if (!actor.ownerId) return res.status(403).json(deny('outside_scope'));
        return respondFederated(res, await federate('hub_call',
          { name, args: req.body }, actor, db, settings));
      }
      // Keep existing Hub-only batches stable. Mixed service batches use
      // the single audited, non-retrying, sequential H-3 implementation.
      if (req.body.calls.every(call => selectTool(call.name) &&
        !federatedHubTools.has(call.name))) {
        const calls = req.body.calls.map(call => runTool(call.name, call.args, actor));
        if (calls.some(call => !call.ok))
          return res.status(400).json(deny('invalid_args'));
        return send(res, { ok: true, result: { results: calls } });
      }
      // Hub-only calls remain usable for legacy TEST identities without
      // owner-scoped RTC grants. Such identities cannot invoke upstream
      // tools; grant selection also independently fails closed.
      if (!actor.ownerId && req.body.calls.some(call => !selectTool(call.name)))
        return res.status(403).json(deny('outside_scope'));
      return respondFederated(res, await federate('hub_batch',
        { calls: req.body.calls }, actor, db, settings));
    });
  } catch {
    return res.status(503).json(deny('service_error'));
  }
}
