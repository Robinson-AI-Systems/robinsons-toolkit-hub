// RTC standalone multi-server MCP (2025-11-25 stdio JSON-RPC; one JSON message per line).
// Only compact schema brokers are listed, not a thousand provider tool schemas.
import { StringDecoder } from 'node:string_decoder';
import { ToolError } from './http.js';
import { byName, send } from './dispatch.js';
import { LOCAL_FILE_TOOLS } from './local-files.js';
import { LOCAL_GIT_TOOLS } from './local-git.js';
import {LOCAL_GIT_DETAIL_TOOLS} from './local-git-details.js';
import {LOCAL_SANDBOX_TOOLS} from './local-sandbox.js';

const VERSION = '2025-11-25';
const MAX_LINE = 1024 * 1024;
const MAX_INLINE = 8192;
const shape = (properties = {}, required = []) =>
  ({ type: 'object', properties, required, additionalProperties: false });
const str = (description) => ({ type: 'string', description });
const argObject = { type: 'object', description: 'Provider tool arguments' };
const callList = { type: 'array', items: shape({
  name: str('Provider-prefixed tool name'), args: argObject
}, ['name']), maxItems: 10 };
const META = [
  { suffix: 'search', description: 'Search this service tool catalog without loading all schemas.',
    inputSchema: shape({ q: str('Search words'), area: str('Optional service area'),
      limit: { type: 'integer', minimum: 1, maximum: 100 } }) },
  { suffix: 'describe', description: 'Fetch the exact schema of one provider tool.',
    inputSchema: shape({ tool: str('Provider-prefixed tool name') }, ['tool']) },
  { suffix: 'call', description: 'Call one tool through the service original safety guards.',
    inputSchema: shape({ tool: str('Provider-prefixed tool name'), args: argObject,
      dryRun: { type: 'boolean' }, confirm: { type: 'boolean' } }, ['tool']) },
  { suffix: 'batch', description: 'Submit at most ten read-only calls to this provider.',
    inputSchema: shape({ calls: callList }, ['calls']) },
  { suffix: 'result', description: 'Read an existing service-owned large-result handle.',
    inputSchema: shape({ handle: str('Result handle') }, ['handle']) },
  { suffix: 'whoami', description: 'Read account profile and authorization of this pass.',
    inputSchema: shape() }
];
const okName = /^[A-Za-z0-9_.-]{1,200}$/;
export function localToolCatalog(servers, env = process.env, localFiles = null) {
  const tools = [];
  const routes = new Map();
  for (const [name] of servers) {
    if (!env['RTOOL_PASS_' + name.toUpperCase().replaceAll('-', '_')]) continue;
    for (const meta of META) {
      const full = name + '_' + meta.suffix;
      routes.set(full, { name, action: meta.suffix });
      tools.push({ name: full, description: meta.description,
        inputSchema: meta.inputSchema, annotations: {
          readOnlyHint: !['call'].includes(meta.suffix),
          destructiveHint: false, idempotentHint: false, openWorldHint: true
        } });
    }
  }
  if (localFiles) {
    for (const tool of [...LOCAL_FILE_TOOLS, ...LOCAL_GIT_TOOLS, ...LOCAL_GIT_DETAIL_TOOLS, ...LOCAL_SANDBOX_TOOLS]) {
      routes.set(tool.name, { local: true, action: tool.name });
      tools.push(tool);
    }
  }
  if (JSON.stringify(tools).length / 4 >= 5000)
    throw new ToolError('Compact MCP tool catalog exceeds 5000 token budget');
  return { tools, routes };
}
function checkToolName(value) {
  if (typeof value !== 'string' || !okName.test(value))
    throw new ToolError('Tool name must be a safe provider-prefixed identifier', 3);
  return encodeURIComponent(value);
}
function safeResult(data) {
  const size = JSON.stringify(data).length;
  if (size > MAX_INLINE && !data?.handle)
    return { isError: true, content: [{ type: 'text',
      text: 'Service result is too large without an RTC handle' }] };
  const content = [{ type: 'text', text: JSON.stringify(data).slice(0, MAX_INLINE) }];
  return { content, ...(data && typeof data === 'object' ? { structuredContent: data } : {}) };
}
export async function invokeLocalTool({ servers, env, routes }, name, args = {}) {
  const route = routes.get(name);
  if (!route) throw new ToolError('Unknown local MCP broker tool: ' + name, -32602);
  if (route.local) {
    try {
      if (!args || typeof args !== 'object' || Array.isArray(args))
        throw new ToolError('Local arguments must be an object', -32602);
      return safeResult(await route.localFiles.invoke(route.action, args));
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text:
        error instanceof ToolError ? error.message : 'Local file operation failed' }] };
    }
  }
  const server = byName(servers, env, route.name);
  if (!args || typeof args !== 'object' || Array.isArray(args))
    throw new ToolError('Tool arguments must be an object', -32602);
  let path;
  let opts;
  switch (route.action) {
    case 'search': {
      const q = new URLSearchParams({ limit: String(args.limit || 20), listing: 'catalog' });
      if (args.q) q.set('q', String(args.q));
      if (args.area) q.set('area', String(args.area));
      path = '/api/tools?' + q.toString();
      break;
    }
    case 'describe': path = '/api/tools/' + checkToolName(args.tool); break;
    case 'call': {
      path = '/api/tools/' + checkToolName(args.tool);
      const input = args.args === undefined ? {} : args.args;
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new ToolError('Provider call arguments must be an object', -32602);
      opts = { method: 'POST', args: { ...input } };
      if (args.dryRun !== undefined) opts.args.dryRun = args.dryRun;
      if (args.confirm !== undefined) opts.args.confirm = args.confirm;
      break;
    }
    case 'batch': {
      if (!Array.isArray(args.calls) || args.calls.length > 10)
        throw new ToolError('Batch requires up to ten reads', -32602);
      path = '/api/tools/_batch';
      opts = { method: 'POST', args: { calls: args.calls } };
      break;
    }
    case 'result': {
      if (typeof args.handle !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(args.handle))
        throw new ToolError('Invalid result handle', -32602);
      path = '/api/results/' + encodeURIComponent(args.handle);
      break;
    }
    case 'whoami': path = '/api/whoami'; break;
    default: throw new ToolError('Unsupported MCP broker action', -32601);
  }
  try {
    return safeResult(await send(server, path, opts));
  } catch (e) {
    // An MCP tool failure belongs in its result (isError), not at the protocol layer.
    return { isError: true, content: [{ type: 'text', text:
      e instanceof ToolError ? e.message : 'Service unavailable or authorization refused' }] };
  }
}
function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
export function createLocalMcp({ servers = new Map(), env = process.env, localFiles = null } = {}) {
  const catalog = localToolCatalog(servers, env, localFiles);
  if (localFiles) {
    for (const route of catalog.routes.values()) {
      if (route.local) route.localFiles = localFiles;
    }
  }
  const dispatch = async (req) => {
    const id = req?.id;
    const respond = id !== undefined && id !== null;
    if (!req || req.jsonrpc !== '2.0' || typeof req.method !== 'string')
      return rpcError(id ?? null, -32600, 'Invalid JSON-RPC request');
    if (!respond) return null; // notifications never receive JSON-RPC responses
    try {
      switch (req.method) {
        case 'initialize': return { jsonrpc: '2.0', id, result: {
          protocolVersion: VERSION, capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'rtool', version: '0.1.0' } } };
        case 'ping': return { jsonrpc: '2.0', id, result: {} };
        case 'tools/list': {
          if (req.params?.cursor) return rpcError(id, -32602, 'No tool pagination cursor available');
          return { jsonrpc: '2.0', id, result: { tools: catalog.tools } };
        }
        case 'tools/call': {
          const name = req.params?.name;
          if (!catalog.routes.has(name)) return rpcError(id, -32602, 'Unknown broker tool');
          const result = await invokeLocalTool({ servers, env, routes: catalog.routes },
            name, req.params?.arguments || {});
          return { jsonrpc: '2.0', id, result };
        }
        default: return rpcError(id, -32601, 'Unknown MCP method');
      }
    } catch {
      return rpcError(id, -32603, 'Local MCP request failed (details hidden)');
    }
  };
  return { dispatch, catalog };
}
export async function serveLocalStdio({ servers, env = process.env,
  input = process.stdin, output = process.stdout, localFiles = null } = {}) {
  const server = createLocalMcp({ servers, env, localFiles });
  const decoder = new StringDecoder('utf8');
  let buffer = '';
  const emit = (message) => { if (message) output.write(JSON.stringify(message) + '\n'); };
  const processLine = async (line) => {
    if (!line.trim()) return;
    let req;
    try { req = JSON.parse(line); }
    catch { emit(rpcError(null, -32700, 'Malformed JSON')); return; }
    emit(await server.dispatch(req));
  };
  for await (const chunk of input) {
    buffer += decoder.write(chunk);
    if (buffer.length > MAX_LINE) {
      emit(rpcError(null, -32600, 'MCP message exceeds size limit'));
      buffer = ''; continue;
    }
    let pos;
    while ((pos = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, pos);
      buffer = buffer.slice(pos + 1);
      await processLine(line);
    }
  }
  buffer += decoder.end();
  if (buffer.trim()) await processLine(buffer);
}
