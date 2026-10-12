// Literal source search under an owner-opted-in canonical local root.
// No external grep process, regex execution, symlink traversal or network.
import { constants } from 'node:fs';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { ToolError } from './http.js';

const MAX_MATCHES = 25;
const MAX_FILES = 400;
const MAX_DIRS = 200;
const MAX_BYTES = 512 * 1024;
const PER_FILE = 64 * 1024;
const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', 'build',
  'coverage', '.venv', '__pycache__', '.ssh', '.aws']);
const ALLOWED = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.md', '.txt', '.py', '.yml', '.yaml', '.css', '.html',
  '.sh', '.toml', '.sql', '.go', '.rs', '.java', '.xml']);
const safe = (root, path) => path === root || path.startsWith(root + sep);
const refuse = () => { throw new ToolError('Local source search refused', -32602); };

export const LOCAL_FILE_SEARCH_TOOL = Object.freeze({
  name: 'local.file_search',
  description: 'Bounded literal source text search in an approved folder (skips symlinks and common private/dependency paths).',
  inputSchema: {
    type: 'object', additionalProperties: false,
    properties: {
      root: { type: 'integer', minimum: 0 },
      path: { type: 'string' },
      query: { type: 'string', minLength: 1, maxLength: 100 },
      limit: { type: 'integer', minimum: 1, maximum: 25 }
    },
    required: ['query']
  },
  annotations: { readOnlyHint: true, destructiveHint: false,
    idempotentHint: true, openWorldHint: false }
});
function skipName(name, directory) {
  if (name.startsWith('.') || IGNORED.has(name) || name === '.env' || name.startsWith('.env.') ||
      name === '.npmrc' || name.startsWith('.rtool-create-')) return true;
  if (directory) return name.startsWith('.');
  return !ALLOWED.has(extname(name).toLowerCase());
}

async function readSource(path) {
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await file.stat();
    if (!info.isFile()) return null;
    if (info.size > PER_FILE) return { skipped: 'size-limit' };
    const raw = await file.readFile();
    if (raw.length > PER_FILE) return { skipped: 'size-limit' };
    const body = new TextDecoder('utf-8', { fatal: true }).decode(raw);
    if (body.includes('\0')) return null;
    return { body, bytes: raw.length };
  } catch { return null; }
  finally { if (file) await file.close(); }
}

export async function searchLocalSources({ root, dir, query, limit = 20 }) {
  if (typeof query !== 'string' || !query.trim() || query.length > 100 ||
      !Number.isInteger(limit) || limit < 1 || limit > MAX_MATCHES) refuse();
  if (!(await stat(dir)).isDirectory()) refuse();
  const matches = [], needle = query.toLowerCase();
  const queue = [dir];
  let dirs = 0, files = 0, bytes = 0, truncated = false;
  search: while (queue.length) {
    if (++dirs > MAX_DIRS) { truncated = true; break; }
    const current = queue.shift();
    let names;
    try { names = await readdir(current, { withFileTypes: true }); }
    catch { truncated = true; continue; }
    names.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of names) {
      const directory = entry.isDirectory();
      if (entry.isSymbolicLink() || skipName(entry.name, directory)) continue;
      const path = join(current, entry.name);
      let canonical;
      try { canonical = await realpath(path); }
      catch { continue; }
      if (!safe(root, canonical)) continue;
      if (directory) {
        queue.push(canonical);
        continue;
      }
      if (!entry.isFile()) continue;
      if (++files > MAX_FILES || bytes >= MAX_BYTES) {
        truncated = true; break search;
      }
      const data = await readSource(canonical);
      if (!data) continue;
      if (data.skipped) { truncated = true; continue; }
      if (bytes + data.bytes > MAX_BYTES) { truncated = true; break search; }
      bytes += data.bytes;
      const lines = data.body.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].toLowerCase().includes(needle)) continue;
        if (matches.length >= limit) { truncated = true; break search; }
        const preview = lines[i].slice(0, 100);
        matches.push({ path: relative(root, canonical).split(sep).join('/'),
          line: i + 1, preview });
      }
    }
  }
  if (queue.length) truncated = true;
  return { matches, truncated, scannedFiles: Math.min(files, MAX_FILES),
    scannedBytes: bytes };
}
