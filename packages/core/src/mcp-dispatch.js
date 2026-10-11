// Transport-free RTC MCP dispatch. The source server owns authentication, profile policy,
// provider error redaction, result filtering, durable scoped results and SDK transport.
import { randomBytes } from 'node:crypto';

const deny = message => ({ isError: true, content: [{ type: 'text', text: message }] });
const jsonBytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
const MAX_INLINE_BYTES = 8192;
const MAX_NESTED_READS = 8;

export function createGuardedMcpDispatcher({ registry, authorizeTool, shapeResult,
  readDetail, splitResult, resultPage, formatError, skipDetailFor = () => false }) {
  if (!Array.isArray(registry?.tools) || !registry?.handlers ||
      typeof authorizeTool !== 'function' || typeof shapeResult !== 'function' ||
      typeof readDetail !== 'function' || typeof splitResult !== 'function' ||
      typeof resultPage !== 'function' || typeof formatError !== 'function' ||
      typeof skipDetailFor !== 'function') {
    throw new TypeError('Explicit registry, policy, redaction and result adapters are required');
  }
  async function dispatch({ name, args = {}, connection, db, services = {} }, depth = 0) {
    if (!connection || typeof connection !== 'object' || !name || depth > MAX_NESTED_READS ||
        !args || typeof args !== 'object' || Array.isArray(args)) {
      return deny('Tool unavailable for this connection');
    }
    const item = registry.tools.find(t => t.name === name);
    let permitted = false;
    try { permitted = !!item && (await authorizeTool(item, connection)) === true; }
    catch { permitted = false; }
    if (!permitted) return deny('Tool unavailable for this connection');
    const handler = registry.handlers[name];
    if (typeof handler !== 'function') return deny('Tool unavailable');
    try {
      const raw = await shapeResult(await handler(args, {
        connection, connectionId: connection.resultScope, db, services, registry,
        runRead: (nextName, nextArgs) => dispatch({
          name: nextName, args: nextArgs, connection, db, services
        }, depth + 1)
      }), { mode: connection.mode });
      if (raw?.isError) return raw;
      if (!raw || !Array.isArray(raw.content)) {
        return deny('Tool returned an invalid result');
      }
      let result = raw;
      if (!skipDetailFor(name) && Array.isArray(raw.content)) {
        const detail = ['summary','full'].includes(args.detail) ? args.detail : undefined;
        result = { ...raw, content: raw.content.map(part => {
          if (part?.type !== 'text' || typeof part.text !== 'string') return part;
          let value;
          try { value = JSON.parse(part.text); } catch { return part; }
          return { ...part, text: JSON.stringify(readDetail(value, {
            detail, fields: typeof args.fields === 'string' ? args.fields : undefined
          })) };
        }) };
      }
      if (jsonBytes(result) <= MAX_INLINE_BYTES) return result;
      // Never clip provider output or store content before it passes service redaction.
      if (typeof connection.resultScope !== 'string' || !connection.resultScope ||
          typeof db?.putScopedResult !== 'function' ||
          result.content.some(part => part?.type !== 'text')) {
        return deny('Result exceeds 8 KB and cannot be securely stored for this connection.');
      }
      let safeValue = result;
      if (result.content.length === 1) {
        try { safeValue = JSON.parse(result.content[0].text); } catch { /* shaped wrapper */ }
      }
      const body = splitResult(safeValue);
      if (!body || !Number.isSafeInteger(body.totalBytes) || body.totalBytes < 0) {
        return deny('Result cannot be securely stored for this connection.');
      }
      const records = Array.isArray(safeValue) ? safeValue.length :
        Array.isArray(safeValue?.data) ? safeValue.data.length :
          Array.isArray(safeValue?.accounts) ? safeValue.accounts.length : 1;
      const handle = 'res_' + randomBytes(18).toString('base64url');
      const summary = 'Saved ' + records + ' result record(s) from ' + name +
        ', ' + body.totalBytes + ' bytes (scoped connection only)';
      const page = resultPage(body, 0);
      if (!page || typeof page !== 'object' || Array.isArray(page)) {
        return deny('Result cannot be securely paged for this connection.');
      }
      const answer = { handle, summary, totalBytes: body.totalBytes, records, expiresInHours: 24,
        ...page };
      if (jsonBytes(answer) > MAX_INLINE_BYTES) {
        return deny('Result page exceeds the allowed response size.');
      }
      await db.putScopedResult({ handle, connection: connection.resultScope, body, summary,
        expiresAt: new Date(Date.now() + 86400000) });
      return { content: [{ type: 'text', text: JSON.stringify(answer) }] };
    } catch (error) {
      // The service adapter may return a scrubbed error only; raw exceptions never escape.
      let safe = null;
      try { safe = await formatError(error, { mode: connection.mode }); } catch { /* deny */ }
      if (safe?.isError && Array.isArray(safe.content)) return safe;
      return deny('Could not read account details; check server setup');
    }
  }
  return Object.freeze({ dispatch });
}
