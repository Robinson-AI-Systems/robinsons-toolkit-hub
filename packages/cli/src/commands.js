// rtool's direct HTTPS commands. No hub required; every write uses the server's guard.
import { open } from 'node:fs/promises';
import { loadServers, displayServers, RouteError } from './config.js';
import { ToolError, httpRequest, errorCodeOf } from './http.js';
import { selectServer, byName, send, requirePass } from './dispatch.js';

const usage = [
  'rtool servers',
  'rtool whoami <server>',
  'rtool tools [server] [search words]',
  'rtool describe <server.tool|prefixed_tool>',
  'rtool call <server.tool|prefixed_tool> [--args JSON] [--dry-run] [--confirm] [--fields a,b] [--detail summary|full] [--out FILE]',
  'rtool batch <server> --args JSON',
  'rtool result <server> <handle> [--out FILE]'
].join('\n');
const optionsWithValue = new Set(['--args', '--fields', '--detail', '--out', '--area', '--limit']);
const flags = new Set(['--dry-run', '--confirm']);

function parseOptions(words) {
  const args = [];
  const options = {};
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (flags.has(word)) {
      if (options[word]) throw new ToolError('Duplicate flag ' + word);
      options[word] = true;
    } else if (optionsWithValue.has(word)) {
      if (options[word] !== undefined || !words[i + 1] || words[i + 1].startsWith('--')) {
        throw new ToolError('Option ' + word + ' needs one value');
      }
      options[word] = words[++i];
    } else if (word.startsWith('--')) throw new ToolError('Unknown option: ' + word);
    else args.push(word);
  }
  return { args, options };
}
function parseJson(text, fallback = {}) {
  if (!text) return fallback;
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('not an object');
    return obj;
  } catch { throw new ToolError('Arguments must be one JSON object'); }
}
function ensureCount(items, amount, syntax) {
  if (items.length !== amount) throw new ToolError('Usage: ' + syntax);
}
function summaryOf(data) {
  if (data?.handle) return 'Saved result handle ' + data.handle +
    (data.summary ? ' (' + data.summary + ')' : '');
  if (data?.result?.needsConfirmation) return data.result.summary || 'Confirmation required';
  const result = data?.result ?? data;
  if (typeof result === 'string') return result.slice(0, 160);
  if (Array.isArray(result)) return result.length + ' items';
  if (result && typeof result === 'object') return Object.keys(result).slice(0, 5).join(', ') || 'empty';
  return String(result);
}
async function output(data, opts, write) {
  const content = JSON.stringify(data, null, 2) + '\n';
  if (opts['--out']) {
    const path = opts['--out'];
    let f;
    try {
      f = await open(path, 'wx', 0o600);
      await f.writeFile(content, 'utf8');
      write('Saved to ' + path + ' — ' + summaryOf(data) + '\n');
    } catch {
      throw new ToolError('Could not write output file; provide a new writable path');
    } finally {
      if (f) await f.close();
    }
    return;
  }
  if (content.length <= 8192) write(content);
  else write(summaryOf(data) + '\n');
}
async function directTools(servers, env, names, options, write) {
  const query = names.slice(1).join(' ').trim();
  const requested = servers.has(names[0]) ? [names[0]] : [...servers.keys()];
  const search = servers.has(names[0]) ? query : names.join(' ');
  const limit = options['--limit'] === undefined ? 20 : Number(options['--limit']);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ToolError('--limit must be 1–100');
  let attempted = 0;
  for (const name of requested) {
    const server = byName(servers, env, name);
    if (!server.pass) continue; // missing credentials disable only this server
    const params = new URLSearchParams({ limit: String(limit) });
    if (search) params.set('q', search);
    if (options['--area']) params.set('area', options['--area']);
    const data = await send(server, '/api/tools?' + params.toString());
    for (const t of data?.result?.tools || []) write(name + ' ' + t.name + ' — ' + t.description + '\n');
    attempted++;
  }
  if (!attempted) throw new RouteError('No configured server with a pass can list tools');
}
function commandPass(server) {
  return requirePass(server); // fail before contacting a server if unavailable
}
export async function runCLI(argv = [], { env = process.env, out = process.stdout, err = process.stderr,
  reader } = {}) {
  const write = (value) => out.write(value);
  const warning = (value) => err.write(value);
  try {
    const [command, ...words] = argv;
    if (!command || command === 'help' || command === '--help') {
      write(usage + '\n'); return 0;
    }
    const servers = await loadServers(env, reader);
    if (command === 'servers') {
      ensureCount(words, 0, 'rtool servers');
      await output({ servers: displayServers(servers, env) }, {}, write);
      return 0;
    }
    const { args, options } = parseOptions(words);
    if (command === 'whoami') {
      if (args.length > 1 || (args.length === 0 && servers.size !== 1))
        throw new ToolError('Specify exactly one server for whoami');
      const name = args[0] || servers.keys().next().value;
      const server = byName(servers, env, name);
      await output(await send(server, '/api/whoami'), options, write);
      return 0;
    }
    if (command === 'tools') {
      await directTools(servers, env, args, options, write);
      return 0;
    }
    if (command === 'describe') {
      ensureCount(args, 1, 'rtool describe <tool>');
      const server = await selectServer(servers, env, args[0]);
      await output(await send(server, '/api/tools/' + encodeURIComponent(server.tool)), options, write);
      return 0;
    }
    if (command === 'call') {
      ensureCount(args, 1, 'rtool call <tool> [options]');
      const server = await selectServer(servers, env, args[0]);
      const input = parseJson(options['--args']);
      if (options['--dry-run']) input.dryRun = true;
      if (options['--confirm']) input.confirm = true;
      if (options['--fields']) input.fields = options['--fields'].split(',').filter(Boolean);
      if (options['--detail']) {
        if (!['summary', 'full'].includes(options['--detail'])) throw new ToolError('Invalid detail mode');
        input.detail = options['--detail'];
      }
      const data = await send(server, '/api/tools/' + encodeURIComponent(server.tool),
        { method: 'POST', args: input });
      await output(data, options, write);
      return data?.result?.needsConfirmation ? 2 : 0;
    }
    if (command === 'batch') {
      ensureCount(args, 1, 'rtool batch <server> --args JSON');
      const server = byName(servers, env, args[0]);
      const input = parseJson(options['--args']);
      if (!Array.isArray(input.calls) || input.calls.length > 10)
        throw new ToolError('Batch needs a calls array of at most ten operations');
      await output(await send(server, '/api/tools/_batch',
        { method: 'POST', args: input }), options, write);
      return 0;
    }
    if (command === 'result') {
      ensureCount(args, 2, 'rtool result <server> <handle>');
      if (!/^[a-zA-Z0-9_-]{1,256}$/.test(args[1])) throw new ToolError('Invalid result handle');
      const server = byName(servers, env, args[0]);
      await output(await send(server, '/api/results/' + encodeURIComponent(args[1])), options, write);
      return 0;
    }
    throw new ToolError('Unknown command. Supported:\n' + usage);
  } catch (e) {
    const message = e instanceof ToolError || e instanceof RouteError ? e.message :
      'Unexpected CLI failure (credentials and request details hidden)';
    warning(message + '\n');
    return e.exitCode || 4;
  }
}
