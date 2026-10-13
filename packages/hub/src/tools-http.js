import { brokerCatalog, mcpReply } from './http-door.js';

const limitedName = /^hub_[a-z0-9_]{1,80}$/;
const deny = code => ({ ok: false, error: { code } });
const selectTool = name => brokerCatalog().find(tool => tool.name === name);
function inScope(actor) {
  return actor?.mode === 'test' && Array.isArray(actor.areas) &&
    actor.areas.includes('gateway') && actor.allowWrites !== true;
}
function listTools(query) {
  const q = query?.q ?? '';
  const area = query?.area ?? '';
  const limitRaw = query?.limit ?? '10';
  if (typeof q !== 'string' || q.length > 120 || typeof area !== 'string' ||
    (area && area !== 'gateway') || !/^[1-9][0-9]?$|^100$/.test(String(limitRaw)) ||
    Array.isArray(limitRaw)) return null;
  const limit = Number(limitRaw);
  const matching = brokerCatalog().filter(tool => (!area || tool.area === area) &&
    (!q || (tool.name + ' ' + tool.description).toLowerCase().includes(q.toLowerCase())));
  return { tools: matching.slice(0, limit), next: null };
}
function argsValid(args) {
  if (args === undefined) return true;
  return args !== null && typeof args === 'object' && !Array.isArray(args) &&
    Object.getPrototypeOf(args) === Object.prototype;
}
function runTool(name, args, actor) {
  const tool = selectTool(name);
  if (!tool || tool.writes || !argsValid(args)) return deny('invalid_args');
  const result = mcpReply({ jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name, arguments: args ?? {} } }, actor);
  if (!result || result.error || result.result?.isError) return deny('invalid_args');
  return { ok: true, result: result.result.structuredContent };
}
function validBatch(body) {
  return body && typeof body === 'object' && !Array.isArray(body) &&
    Object.getPrototypeOf(body) === Object.prototype &&
    Array.isArray(body.calls) && body.calls.length > 0 && body.calls.length <= 10 &&
    body.calls.every(call => call && typeof call === 'object' &&
      !Array.isArray(call) && Object.getPrototypeOf(call) === Object.prototype &&
      typeof call.name === 'string' && argsValid(call.args) &&
      Object.keys(call).every(key => ['name','args'].includes(key)));
}
function boundedBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.getPrototypeOf(body) !== Object.prototype) return false;
  try { return Buffer.byteLength(JSON.stringify(body), 'utf8') <= 8192; }
  catch { return false; }
}

// H-1 deliberately exposes only Hub-owned harmless reads. H-2/H-3 must
// authorize separately encrypted upstream grants before any provider dispatch.
export async function handleHubTools(req, res, { withDb, authorize }, route) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const method = route === 'list' || route === 'item'
    ? (route === 'list' ? ['GET'] : ['GET','POST']) : ['POST'];
  if (!method.includes(req.method)) {
    res.setHeader('Allow', method.join(', '));
    return res.status(405).json(deny('method_not_allowed'));
  }
  const name = route === 'item' ? req.query?.name : null;
  if (route === 'item' && (typeof name !== 'string' || !limitedName.test(name)))
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
      if (!state || (state.actor && !inScope(state.actor)))
        return res.status(401).json(deny('permission'));
      if (state.retryAfter) {
        res.setHeader('Retry-After', String(state.retryAfter));
        return res.status(429).json(deny('rate_limited'));
      }
      const actor = state.actor;
      if (route === 'list') return res.status(200).json({ ok: true, result: filtered });
      if (route === 'item' && req.method === 'GET') {
        const tool = selectTool(name);
        return tool ? res.status(200).json({ ok: true, result: tool }) :
          res.status(404).json(deny('not_found'));
      }
      if (route === 'item') {
        const result = runTool(name, req.body, actor);
        return res.status(result.ok ? 200 : 400).json(result);
      }
      const calls = req.body.calls.map(call => runTool(call.name, call.args, actor));
      if (calls.some(call => !call.ok)) return res.status(400).json(deny('invalid_args'));
      return res.status(200).json({ ok: true, result: { results: calls } });
    });
  } catch {
    return res.status(503).json(deny('service_error'));
  }
}
