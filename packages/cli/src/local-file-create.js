// Owner-confirmed create-only local file output; no overwrite or shell.
import { constants } from 'node:fs';
import { link, open, realpath, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { basename, dirname, isAbsolute, resolve, sep } from 'node:path';
import { ToolError } from './http.js';

const MAX_WRITE = 16384;
const fail = () => { throw new ToolError('Local file write refused', -32602); };
const within = (root, child) => child === root || child.startsWith(root + sep);
export const LOCAL_FILE_CREATE_TOOL = Object.freeze({
  name: 'local.file_create',
  description: 'Create a new UTF-8 file in an explicitly approved local folder. Confirm required; never overwrites.',
  inputSchema: {
    type: 'object', additionalProperties: false,
    properties: {
      root: { type: 'integer', minimum: 0 },
      path: { type: 'string' },
      content: { type: 'string' },
      confirm: { type: 'boolean' }
    },
    required: ['path', 'content', 'confirm']
  },
  annotations: {
    readOnlyHint: false, destructiveHint: false,
    idempotentHint: false, openWorldHint: false
  }
});

export async function resolveLocalWriteTarget(roots, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || args.confirm !== true ||
      typeof args.content !== 'string' || typeof args.path !== 'string') fail();
  const index = args.root === undefined ? 0 : args.root;
  if (!Number.isInteger(index) || index < 0 || index >= roots.length) fail();
  const relative = args.path;
  if (!relative || relative.length > 1024 || relative.includes(String.fromCharCode(92)) || isAbsolute(relative) ||
      /^[a-zA-Z]:/.test(relative) || relative.startsWith('\\\\') ||
      /[\u0000-\u001f\u007f]/.test(relative)) fail();
  const parts = relative.split(/[\\/]/);
  if (parts.some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git')) fail();
  const root = roots[index];
  const bytes = Buffer.from(args.content, 'utf8');
  if (bytes.length > MAX_WRITE) fail();
  // Explicitly verify the canonical parent, not the nonexistent leaf.
  let parent;
  try { parent = await realpath(resolve(root, dirname(relative))); }
  catch { fail(); }
  if (!within(root, parent)) fail();
  const target = resolve(parent, basename(relative));
  if (!within(root, target)) fail();
  return { target, parent, bytes, index, relative };
}

export async function createConfirmedLocalFile(roots, args) {
  const { target, parent, bytes, index, relative } = await resolveLocalWriteTarget(roots, args);
  // Write a private staging file first. A hard link atomically publishes
  // complete content without ever replacing an existing destination.
  const staged = resolve(parent, '.rtool-create-' + randomBytes(16).toString('hex'));
  let handle, stageExists = false;
  try {
    handle = await open(staged, constants.O_WRONLY | constants.O_CREAT |
      constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    stageExists = true;
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await link(staged, target);
    await unlink(staged);
    stageExists = false;
  } catch {
    fail();
  } finally {
    if (handle) await handle.close();
    if (stageExists) await unlink(staged).catch(() => {});
  }
  return { created: true, root: index, path: relative, bytes: bytes.length };
}
