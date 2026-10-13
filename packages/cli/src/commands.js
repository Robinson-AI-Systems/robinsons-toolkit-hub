// rtool's direct HTTPS commands. No hub required; every write uses the server's guard.
import { open } from 'node:fs/promises';
import { loadServers, displayServers, RouteError } from './config.js';
import { ToolError } from './http.js';
import { selectServer, byName, send } from './dispatch.js';
import { toolPages, materialize } from './pages.js';
import { generateSdk } from './sdk.js';
import { routeSummary, writeAgentSetup, writeSkill, SKILL } from './setup.js';
import { makeKeychain, addStoredPasses } from './keychain.js';
import { readHiddenPass } from './input.js';
import { serveLocalStdio } from './mcp.js';
import { createLocalFiles } from './local-files.js';
import {developerConnect,nativeMcp} from './developer-client.js';
import {makeDeveloperVault} from './developer-vault.js';

const usage = [
  'rtool developer-connect <server> [--profile read_only|everyday|full]',
  'rtool developer-check <server>',
  'rtool developer-tools <server> [search words] [--args JSON]',
  'rtool developer-describe <server> <native_tool>',
  'rtool developer-call <server> <native_tool> [--args JSON] [--dry-run] [--confirm]',
  'rtool developer-logout <server> (remove local OAuth credentials)',
  'rtool servers',
  'rtool whoami <server>',
  'rtool tools [server] [search words]',
  'rtool describe <server.tool|prefixed_tool>',
  'rtool call <server.tool|prefixed_tool> [--args JSON] [--dry-run] [--confirm] [--fields a,b] [--detail summary|full] [--out FILE]',
  'rtool batch <server> --args JSON',
  'rtool result <server> <handle> [--out FILE]',
  'rtool sdk <server> [--out NEW_DIRECTORY]',
  'rtool init [--out PROJECT_DIRECTORY]',
  'rtool skill [--out PROJECT_DIRECTORY]',
  'rtool login <server> (hidden stdin, OS keychain)',
  'rtool logout <server> (remove local keychain entry)',
  'rtool mcp [--local FOLDER[,FOLDER...]] (JSON-RPC 2025-11-25 over stdio)'
].join('\n');
const optionsWithValue = new Set(['--args', '--fields', '--detail', '--out', '--area', '--limit', '--profile']);
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
    for await (const page of toolPages(server, '/api/tools?' + params.toString())) {
      for (const t of page) write(name + ' ' + t.name + ' — ' + t.description + '\n');
    }
    attempted++;
  }
  if (!attempted) throw new RouteError('No configured server with a pass can list tools');
}
export async function runCLI(argv = [], { env = process.env, out = process.stdout, err = process.stderr,
  reader, keychain, input = process.stdin, passReader = readHiddenPass } = {}) {
  const write = (value) => out.write(value);
  const warning = (value) => err.write(value);
  try {
    const [command, ...words] = argv;
    if (!command || command === 'help' || command === '--help') {
      write(usage + '\n'); return 0;
    }
    env = { ...env, relayNotice: warning };
    const servers = await loadServers(env, reader);
    const vault = keychain || makeKeychain({ env });
    if (command === 'login' || command === 'logout') {
      if (words.length !== 1) throw new ToolError('Usage: rtool ' + command + ' <server>');
      const server = byName(servers, env, words[0]);
      if (command === 'logout') {
        const removed = await vault.delete(server.name);
        write(removed ? 'Local stored pass deleted; server pass remains active until revoked\n' :
          'No local stored pass found; server pass remains active until revoked\n');
        return 0;
      }
      const pass = await passReader();
      await send({ ...server, pass }, '/api/whoami');
      await vault.set(server.name, pass);
      write('Verified pass stored in OS keychain for ' + server.name + '\n');
      return 0;
    }
    if(command.startsWith('developer-')){
      const {args,options}=parseOptions(words);
      const developerVault=env.RTOOL_DEVELOPER_VAULT_DIR?await makeDeveloperVault(env.RTOOL_DEVELOPER_VAULT_DIR):vault;
      if(!['developer-connect','developer-check','developer-tools','developer-describe','developer-call','developer-logout'].includes(command))throw new ToolError('Unknown developer command');
      const server=byName(servers,env,args[0]);
      if(typeof developerVault.getOAuth!=='function'||typeof developerVault.setOAuth!=='function')throw new RouteError('Protected OAuth credential storage unavailable');
      const base={name:server.name,origin:server.url,vault:developerVault};
      if(command==='developer-connect'){
        ensureCount(args,1,'rtool developer-connect <server> [--profile full]');
        if(Object.keys(options).some(k=>k!=='--profile'))throw new ToolError('Unexpected connect option');
        await output(await developerConnect({...base,profile:options['--profile']||'full'}),{},write);return 0;
      }
      if(command==='developer-logout'){
        ensureCount(args,1,'rtool developer-logout <server>');
        await developerVault.deleteOAuth(server.name);write('Local developer credential removed; revoke the service connection to terminate remote authority.\n');return 0;
      }
      if(options['--profile'])throw new ToolError('Profile changes require a fresh owner-authorized connection');
      if(command==='developer-check'){
        ensureCount(args,1,'rtool developer-check <server>');
        if(Object.keys(options).length)throw new ToolError('Unexpected check option');
        const initialized=await nativeMcp({...base,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'rtool-developer',version:'0.1.0'}}});
        await output({status:'passed',checks:['native_mcp_authenticated_initialize'],server:initialized.serverInfo,
          providerAcceptance:'unverified',note:'This checks the custom MCP transport. Provider reads, writes and scratch isolation require their own evidence.'},{},write);return 0;
      }
      if(command==='developer-describe'){
        ensureCount(args,2,'rtool developer-describe <server> <native_tool>');
        let cursor;for(let page=0;page<20;page++){
          const result=await nativeMcp({...base,method:'tools/list',params:cursor?{cursor}:{}});
          const tool=result.tools?.find(t=>t.name===args[1]);if(tool){await output(tool,options,write);return 0;}
          if(!result.nextCursor)break;cursor=result.nextCursor;
        }
        throw new ToolError('Native tool not available in this connection listing');
      }
      if(command==='developer-tools'){
        const result=await nativeMcp({...base,method:'tools/list',params:parseJson(options['--args'])});
        if(!Array.isArray(result.tools))throw new ToolError('Invalid native tool listing');
        const search=args.slice(1).join(' ').toLowerCase();
        const matches=result.tools.filter(t=>!search||(t.name+' '+t.description).toLowerCase().includes(search));
        await output({tools:matches.slice(0,20).map(t=>({name:t.name,description:String(t.description||'').slice(0,160),readOnly:t.annotations?.readOnlyHint===true})),
          matches:matches.length,shown:Math.min(20,matches.length),nextCursor:result.nextCursor||null,
          note:'Search to narrow a large page; use the native nextCursor in --args to continue.'},options,write);return 0;
      }
      ensureCount(args,2,'rtool developer-call <server> <native_tool> --args JSON');
      if(!/^[A-Za-z][A-Za-z0-9_.-]{0,150}$/.test(args[1]))throw new ToolError('Invalid native tool name');
      const input=parseJson(options['--args']);
      if(options['--dry-run'])input.dryRun=true;
      if(options['--confirm'])input.confirm=true;
      const result=await nativeMcp({...base,method:'tools/call',params:{name:args[1],arguments:input}});
      await output(result,options,write);return result.isError?5:0;
    }
    env = await addStoredPasses(servers, env, vault);
    if (command === 'mcp') {
      if (words.length && (words.length !== 2 || words[0] !== '--local'))
        throw new ToolError('Usage: rtool mcp [--local FOLDER[,FOLDER...]]');
      const localFiles = words.length ? await createLocalFiles(words[1].split(',')) : null;
      await serveLocalStdio({ servers, env, input, output: out, localFiles });
      return 0;
    }
    if (command === 'servers') {
      ensureCount(words, 0, 'rtool servers');
      await output({ servers: displayServers(servers, env) }, {}, write);
      return 0;
    }
    const { args, options } = parseOptions(words);
    if (command === 'sdk') {
      ensureCount(args, 1, 'rtool sdk <server> [--out NEW_DIRECTORY]');
      const report = await generateSdk({ servers, env, name: args[0], dest: options['--out'] });
      await output(report, {}, write);
      return 0;
    }
    if (command === 'init') {
      ensureCount(args, 0, 'rtool init [--out PROJECT_DIRECTORY]');
      const result = await writeAgentSetup({ dir: options['--out'], servers, env });
      await output({ ...result, routes: routeSummary(servers, env) }, {}, write);
      return 0;
    }
    if (command === 'skill') {
      ensureCount(args, 0, 'rtool skill [--out PROJECT_DIRECTORY]');
      if (!options['--out']) {
        write(SKILL); return 0;
      }
      await output({ skill: await writeSkill({ dir: options['--out'] }) }, {}, write);
      return 0;
    }
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
      await output(options['--out'] ? await materialize(server, data) : data, options, write);
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
      const data = await send(server, '/api/results/' + encodeURIComponent(args[1]));
      await output(options['--out'] ? await materialize(server, data) : data, options, write);
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
