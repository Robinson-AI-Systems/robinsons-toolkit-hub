// Owner-opted-in local filesystem door: read-only by default, explicit confirmation for create-only writes.
// Never used by hosted Hub/relay.
import { constants } from 'node:fs';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';
import { ToolError } from './http.js';
import { inspectLocalGit } from './local-git.js';
import { createConfirmedLocalFile, LOCAL_FILE_CREATE_TOOL } from './local-file-create.js';

const MAX_READ = 4096;
const MAX_ENTRIES = 100;
const SAFE_LENGTH = 1024;
const bad = (message) => { throw new ToolError(message, -32602); };
const inside = (root, target) => target === root || target.startsWith(root + sep);
const kindOf = (entry) => entry.isDirectory() ? 'directory' :
  entry.isFile() ? 'file' : entry.isSymbolicLink() ? 'symlink' : 'other';

export const LOCAL_FILE_TOOLS = Object.freeze([
  { name: 'local.file_list', description: 'List at most 100 entries inside one explicitly enabled local folder.',
    inputSchema: { type: 'object', additionalProperties: false,
      properties: { root: { type: 'integer', minimum: 0 }, path: { type: 'string' } } } },
  { name: 'local.file_stat', description: 'Read metadata of a file or folder inside one explicitly enabled local folder.',
    inputSchema: { type: 'object', additionalProperties: false,
      properties: { root: { type: 'integer', minimum: 0 }, path: { type: 'string' } } } },
  { name: 'local.file_read', description: 'Read UTF-8 file content up to 4096 bytes; larger or binary files are refused.',
    inputSchema: { type: 'object', additionalProperties: false,
      properties: { root: { type: 'integer', minimum: 0 }, path: { type: 'string' } } } }
].map((tool) => Object.freeze({ ...tool, annotations: {
  readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false
} })).concat(LOCAL_FILE_CREATE_TOOL));

function relativeInput(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > SAFE_LENGTH || value.includes('\0') ||
      isAbsolute(value) || /^[a-zA-Z]:/.test(value) || value.startsWith('\\\\') ||
      value.split(/[\\/]/).some((part) => part === '..')) {
    bad('Local file path must be relative, with no parent traversal');
  }
  return value;
}
export async function createLocalFiles(folders) {
  if (!Array.isArray(folders) || !folders.length || folders.length > 8 ||
      folders.some((f) => typeof f !== 'string' || !f.trim())) {
    bad('Local file access requires 1–8 explicitly enabled folders');
  }
  const roots = [];
  for (const folder of folders) {
    let canonical;
    try {
      canonical = await realpath(folder);
      if (!(await stat(canonical)).isDirectory()) bad('Local root must be a directory');
    } catch { bad('Local root must be an existing accessible directory'); }
    if (roots.includes(canonical)) bad('Duplicate local folder');
    roots.push(canonical);
  }
  const access = async (args = {}) => {
    if (!args || typeof args !== 'object' || Array.isArray(args)) bad('Local arguments must be an object');
    const rootIndex = args.root === undefined ? 0 : args.root;
    if (!Number.isInteger(rootIndex) || rootIndex < 0 || rootIndex >= roots.length) bad('Unknown local root');
    const relative = relativeInput(args.path);
    const root = roots[rootIndex];
    let path;
    try { path = await realpath(resolve(root, relative)); }
    catch { bad('Local path does not exist or is inaccessible'); }
    if (!inside(root, path)) bad('Local path is outside enabled folder');
    return { path, rootIndex, relative };
  };
  const invoke = async (name, args = {}) => {
    if (name === 'local.file_create') return createConfirmedLocalFile(roots, args);
    const { path, rootIndex, relative } = await access(args);
    try {
      if (name.startsWith('local.git_')) {
        if (relative) bad('Git inspection uses only the exact enabled folder');
        return await inspectLocalGit(name, path);
      }
      if (name === 'local.file_list') {
        if (!(await stat(path)).isDirectory()) bad('Local path is not a directory');
        const entries = (await readdir(path, { withFileTypes: true }))
          .map((item) => ({ name: item.name, kind: kindOf(item) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return { root: rootIndex, path: relative, entries: entries.slice(0, MAX_ENTRIES),
          hasMore: entries.length > MAX_ENTRIES };
      }
      if (name === 'local.file_stat') {
        const info = await stat(path);
        return { root: rootIndex, path: relative,
          type: info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other',
          bytes: info.size };
      }
      if (name === 'local.file_read') {
        const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          if (!(await handle.stat()).isFile()) bad('Local read requires a regular file');
          const bytes = Buffer.alloc(MAX_READ + 1);
          const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
          if (bytesRead > MAX_READ) bad('Local file exceeds 4096-byte read cap');
          let content;
          try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, bytesRead)); }
          catch { bad('Local file is not valid UTF-8'); }
          if (content.includes('\0')) bad('Local binary file content refused');
          return { root: rootIndex, path: relative, bytes: bytesRead, content };
        } finally { await handle.close(); }
      }
      bad('Unknown local file tool');
    } catch (error) {
      if (error instanceof ToolError) throw error;
      bad('Local file operation failed');
    }
  };
  return Object.freeze({ roots: Object.freeze([...roots]), invoke });
}
