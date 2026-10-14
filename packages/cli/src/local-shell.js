// Local-only, opt-in non-interpreting command door. No arbitrary executables or shells.
import { constants } from 'node:fs';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import { sep } from 'node:path';
import { ToolError } from './http.js';
import { inspectLocalGit } from './local-git.js';

const MAX_FILE = 64 * 1024;
const MAX_OUTPUT = 4096;
const MAX_LINES = 40;
const MAX_MATCHES = 25;
const GIT = Object.freeze({
  'git status': 'local.git_status',
  'git diff': 'local.git_diff',
  'git log': 'local.git_log'
});
const SIMPLE = new Set(['ls', 'cat', ...Object.keys(GIT)]);
const CONFIRMED = new Set(['grep', 'head', 'tail', 'wc']);
const refuse = () => { throw new ToolError('Local command refused', -32602); };

export const LOCAL_SHELL_TOOL = Object.freeze({
  name: 'local.shell_run',
  description: 'Run a bounded read command in an owner-enabled folder, with confirmation for extra commands. No shell, user options, sudo or arbitrary executables.',
  inputSchema: { type: 'object', additionalProperties: false,
    properties: {
      root: { type: 'integer', minimum: 0 },
      path: { type: 'string', maxLength: 1024 },
      command: { type: 'string', enum: [...SIMPLE, ...CONFIRMED] },
      query: { type: 'string', minLength: 1, maxLength: 100 },
      lines: { type: 'integer', minimum: 1, maximum: MAX_LINES },
      confirm: { type: 'boolean' }
    }, required: ['command'] },
  annotations: { readOnlyHint: true, destructiveHint: false,
    idempotentHint: true, openWorldHint: false }
});
function validate(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args) ||
      Object.keys(args).some((key) =>
        !['root', 'path', 'command', 'query', 'lines', 'confirm'].includes(key)) ||
      !(SIMPLE.has(args.command) || CONFIRMED.has(args.command)) ||
      (CONFIRMED.has(args.command) && args.confirm !== true) ||
      (args.confirm !== undefined && typeof args.confirm !== 'boolean') ||
      (args.query !== undefined && args.command !== 'grep') ||
      (args.command === 'grep' &&
        (typeof args.query !== 'string' || !args.query ||
          args.query.length > 100)) ||
      (args.lines !== undefined && !['head', 'tail'].includes(args.command)) ||
      (args.lines !== undefined &&
        (!Number.isInteger(args.lines) || args.lines < 1 || args.lines > MAX_LINES))) refuse();
}
function capped(value) {
  if (Buffer.byteLength(value, 'utf8') > MAX_OUTPUT) refuse();
  return value;
}
async function readFile(root, path, max) {
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await file.stat();
    if (!info.isFile() || info.size > max) refuse();
    const canonical = await realpath(path);
    if (canonical !== root && !canonical.startsWith(root + sep)) refuse();
    const current = await stat(canonical);
    if (info.ino !== current.ino || info.dev !== current.dev) refuse();
    const bytes = await file.readFile();
    if (bytes.length > max) refuse();
    const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (value.includes('\0')) refuse();
    return { value, bytes: bytes.length };
  } catch { refuse(); }
  finally { if (file) await file.close().catch(() => {}); }
}

export async function runLocalShell({ root, path, relative, args }) {
  validate(args);
  const command = args.command;
  try {
    if (Object.hasOwn(GIT, command)) {
      if (relative) refuse();
      const result = await inspectLocalGit(GIT[command], root);
      return { command, output: capped(result.output), exitCode: 0, incomplete: false };
    }
    if (command === 'ls') {
      if (!(await stat(path)).isDirectory()) refuse();
      const entries = (await readdir(path, { withFileTypes: true }))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (entries.length > 100) refuse();
      return { command, output: capped(entries.map((entry) => entry.name +
        (entry.isDirectory() ? '/' : entry.isSymbolicLink() ? '@' : '')).join('\n')),
      exitCode: 0, incomplete: false };
    }
    if (!relative || !(await stat(path)).isFile()) refuse();
    const { value, bytes } = await readFile(root, path,
      command === 'cat' ? MAX_OUTPUT : MAX_FILE);
    if (command === 'cat')
      return { command, output: capped(value), exitCode: 0, incomplete: false };
    const rows = value.split(/\r?\n/);
    if (rows.at(-1) === '') rows.pop();
    if (command === 'wc') {
      const words = value.trim() ? value.trim().split(/\s+/u).length : 0;
      return { command, output: [rows.length, words, bytes].join(' '),
        exitCode: 0, incomplete: false };
    }
    if (command === 'head' || command === 'tail') {
      const limit = args.lines ?? 10;
      const selected = command === 'head' ? rows.slice(0, limit) : rows.slice(-limit);
      return { command, output: capped(selected.join('\n')),
        exitCode: 0, incomplete: false };
    }
    if (command === 'grep') {
      const found = [];
      let incomplete = false;
      for (let i = 0; i < rows.length; i++) {
        if (!rows[i].includes(args.query)) continue;
        if (found.length === MAX_MATCHES) { incomplete = true; break; }
        found.push((i + 1) + ':' + rows[i]);
      }
      return { command, output: capped(found.join('\n')),
        exitCode: 0, incomplete };
    }
    refuse();
  } catch (error) {
    if (error instanceof ToolError) throw error;
    refuse();
  }
}
