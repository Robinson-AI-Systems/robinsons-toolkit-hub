// Transport-free RTC MCP dispatch. The source server owns authentication, profile policy,
// provider error redaction, result filtering, durable scoped results and SDK transport.
import { randomBytes } from 'node:crypto';

const deny = message => ({ isError: true, content: [{ type: 'text', text: message }] });
const jsonBytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
const MAX_INLINE_BYTES = 8192;
const MAX_NESTED_READS = 8;

function safeDispatchArgs(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return false;
  try {
    const prototype = Object.getPrototypeOf(args);
    if (prototype !== Object.prototype && prototype !== null ||
        Object.getOwnPropertySymbols(args).length) return false;
    // The HTTP/MCP boundary uses JSON data records. A local plugin must not
    // smuggle active getters, inherited control flags or executable objects.
    for (const [key, field] of Object.entries(Object.getOwnPropertyDescriptors(args))) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype' ||
          !field.enumerable || !Object.hasOwn(field, 'value')) return false;
    }
    return isInertJsonData(args);
  } catch { return false; }
}


export function isInertJsonData(value, seen = new WeakSet(), depth = 0) {
  // Adapter-produced page data is serialized and returned to callers; reject
  // executable toJSON/getters, custom prototypes and cycles before spreading it.
  if (depth > 16) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  try {
    if (seen.has(value)) return false;
    seen.add(value);
    const array = Array.isArray(value);
    const proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) return false;
    if (Object.getOwnPropertySymbols(value).length) return false;
    if (array) {
      if (value.length > 2048) return false;
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (Object.keys(descriptors).length !== value.length + 1) return false;
      for (let i = 0; i < value.length; i++) {
        const descriptor = descriptors[i];
        if (!descriptor || !Object.hasOwn(descriptor, 'value') ||
            !isInertJsonData(descriptor.value, seen, depth + 1)) return false;
      }
    } else {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (Object.keys(descriptors).length > 2048) return false;
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (['__proto__', 'constructor', 'prototype', 'toJSON'].includes(key) ||
            !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') ||
            !isInertJsonData(descriptor.value, seen, depth + 1)) return false;
      }
    }
    return true;
  } catch { return false; }
}

// Preserve validated caller intent across asynchronous authorization and execution.
function snapshotDispatchArgs(args) {
  const value = structuredClone(args);
  function freeze(node) {
    if (node !== null && typeof node === 'object') {
      for (const child of Object.values(node)) freeze(child);
      Object.freeze(node);
    }
    return node;
  }
  return freeze(value);
}

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
        !safeDispatchArgs(args)) {
      return deny('Tool unavailable for this connection');
    }
    // Capture both request and service-projected identity before the first await.
    // Authorization, handler execution and scoped persistence must share one tenant.
    let safeArgs, safeConnection;
    try {
      if (!isInertJsonData(connection) ||
          ![Object.prototype, null].includes(Object.getPrototypeOf(connection))) {
        throw new TypeError('Unsafe connection identity');
      }
      safeArgs = snapshotDispatchArgs(args);
      safeConnection = snapshotDispatchArgs(connection);
    } catch { return deny('Tool unavailable for this connection'); }
    const item = registry.tools.find(t => t.name === name);
    let permitted = false;
    try { permitted = !!item && (await authorizeTool(item, safeConnection)) === true; }
    catch { permitted = false; }
    if (!permitted) return deny('Tool unavailable for this connection');
    // runRead is a privileged convenience, never a route to execute a write.
    // Fail closed when a nested tool lacks an explicit read declaration.
    if (depth > 0 && item.writes !== false) {
      return deny('Nested calls may only invoke explicitly declared read tools');
    }
    // Metadata alone cannot authorize inherited Object.prototype functions.
    // An executable handler must be an explicitly registered own property.
    const handler = Object.hasOwn(registry.handlers, name) ?
      registry.handlers[name] : undefined;
    if (typeof handler !== 'function') return deny('Tool unavailable');
    try {
      const raw = await shapeResult(await handler(safeArgs, {
        connection: safeConnection, connectionId: safeConnection.resultScope, db, services, registry,
        runRead: (nextName, nextArgs) => dispatch({
          name: nextName, args: nextArgs, connection: safeConnection, db, services
        }, depth + 1)
      }), { mode: safeConnection.mode });
      // Adapter objects may contain active toJSON/getters. Never serialize,
      // return, or page them before proving that all fields are inert JSON.
      if (!isInertJsonData(raw)) return deny('Tool returned an invalid result');
      if (raw?.isError) return raw;
      if (!raw || !Array.isArray(raw.content)) {
        return deny('Tool returned an invalid result');
      }
      let result = raw;
      if (!skipDetailFor(name) && Array.isArray(raw.content)) {
        const detail = ['summary','full'].includes(safeArgs.detail) ? safeArgs.detail : undefined;
        result = { ...raw, content: raw.content.map(part => {
          if (part?.type !== 'text' || typeof part.text !== 'string') return part;
          let value;
          try { value = JSON.parse(part.text); } catch { return part; }
          const projected = readDetail(value, {
            detail, fields: typeof safeArgs.fields === 'string' ? safeArgs.fields : undefined
          });
          if (!isInertJsonData(projected)) throw new TypeError('Unsafe detail projection');
          return { ...part, text: JSON.stringify(projected) };
        }) };
      }
      // readDetail may replace text with adapter-produced objects; validate
      // the completed response as well, before JSON.stringify or storage.
      if (!isInertJsonData(result)) return deny('Tool returned an invalid result');
      if (jsonBytes(result) <= MAX_INLINE_BYTES) return result;
      // Never clip provider output or store content before it passes service redaction.
      if (typeof safeConnection.resultScope !== 'string' || !safeConnection.resultScope ||
          typeof db?.putScopedResult !== 'function' ||
          result.content.some(part => part?.type !== 'text')) {
        return deny('Result exceeds 8 KB and cannot be securely stored for this connection.');
      }
      let safeValue = result;
      if (result.content.length === 1) {
        try { safeValue = JSON.parse(result.content[0].text); } catch { /* shaped wrapper */ }
      }
      // Service pagination is privileged, but its returned objects are not
      // trusted metadata or mutable references for durable scoped storage.
      // Snapshot before invoking the page adapter so late provider mutation
      // cannot change the data that was authorized for this connection.
      let body = splitResult(safeValue);
      if (!isInertJsonData(body) || !body || Array.isArray(body)) {
        return deny('Result cannot be securely stored for this connection.');
      }
      body=snapshotDispatchArgs(body);
      if (!Number.isSafeInteger(body.totalBytes) || body.totalBytes < 0) {
        return deny('Result cannot be securely stored for this connection.');
      }
      const records = Array.isArray(safeValue) ? safeValue.length :
        Array.isArray(safeValue?.data) ? safeValue.data.length :
          Array.isArray(safeValue?.accounts) ? safeValue.accounts.length : 1;
      const handle = 'res_' + randomBytes(18).toString('base64url');
      const summary = 'Saved ' + records + ' result record(s) from ' + name +
        ', ' + body.totalBytes + ' bytes (scoped connection only)';
      let page = resultPage(body, 0);
      if (!page || typeof page !== 'object' || Array.isArray(page) ||
          !isInertJsonData(page)) {
        return deny('Result cannot be securely paged for this connection.');
      }
      // The returned page must not change after the protected metadata check.
      page=snapshotDispatchArgs(page);
      // A paging adapter may append page data, but may never replace the core's
      // scoped handle, immutable byte count, retention or audit summary.
      if (['handle','summary','totalBytes','records','expiresInHours'].some(key =>
        Object.hasOwn(page,key))) {
        return deny('Result page attempted to replace protected handle metadata.');
      }
      const answer = { handle, summary, totalBytes: body.totalBytes, records, expiresInHours: 24,
        ...page };
      if (jsonBytes(answer) > MAX_INLINE_BYTES) {
        return deny('Result page exceeds the allowed response size.');
      }
      await db.putScopedResult({ handle, connection: safeConnection.resultScope, body, summary,
        expiresAt: new Date(Date.now() + 86400000) });
      return { content: [{ type: 'text', text: JSON.stringify(answer) }] };
    } catch (error) {
      // The service adapter may return a scrubbed error only; raw exceptions never escape.
      let safe = null;
      try { safe = await formatError(error, { mode: safeConnection.mode }); } catch { /* deny */ }
      if (isInertJsonData(safe) && safe?.isError && Array.isArray(safe.content)) return safe;
      return deny('Could not read account details; check server setup');
    }
  }
  return Object.freeze({ dispatch });
}
