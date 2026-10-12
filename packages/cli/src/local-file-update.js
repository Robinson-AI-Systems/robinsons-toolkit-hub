// Confirmed optimistic local text replacement: bounded, same-folder staging,
// exact expected SHA-256, cooperative lock and atomic rename publication.
import { constants } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { open, realpath, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ToolError } from './http.js';
import { resolveLocalWriteTarget } from './local-file-create.js';

const MAX_EXISTING = 256 * 1024;
const refuse = () => { throw new ToolError('Local file update refused', -32602); };
export const LOCAL_FILE_HASH_TOOL = Object.freeze({
  name: 'local.file_hash',
  description: 'Compute the SHA-256 of an ordinary approved local file up to 256 KiB, without returning content.',
  inputSchema: { type: 'object', additionalProperties: false,
    properties: { root: { type: 'integer', minimum: 0 }, path: { type: 'string' } },
    required: ['path'] },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
});
export const LOCAL_FILE_UPDATE_TOOL = Object.freeze({
  name: 'local.file_update',
  description: 'Replace a UTF-8 file only after explicit confirmation and exact expected SHA-256 match.',
  inputSchema: { type: 'object', additionalProperties: false,
    properties: {
      root: { type: 'integer', minimum: 0 }, path: { type: 'string' },
      content: { type: 'string' }, expectedSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      confirm: { type: 'boolean' }
    }, required: ['path', 'content', 'expectedSha256', 'confirm'] },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
});

export async function hashLocalFile(path) {
  let fd;
  try {
    fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await fd.stat({ bigint: true });
    if (!info.isFile() || info.size > BigInt(MAX_EXISTING)) refuse();
    const contents = await fd.readFile();
    if (contents.length > MAX_EXISTING) refuse();
    return { sha256: createHash('sha256').update(contents).digest('hex'),
      bytes: contents.length, info };
  } catch { refuse(); }
  finally { if (fd) await fd.close(); }
}
export async function updateConfirmedLocalFile(roots, args) {
  if (typeof args?.expectedSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(args.expectedSha256)) refuse();
  const { target, parent, bytes, index, relative } =
    await resolveLocalWriteTarget(roots, args);
  let actual;
  try { actual = await realpath(target); } catch { refuse(); }
  if (actual !== target) refuse(); // No leaf symlinks, even to an approved path.
  const lockPath = target + '.rtool-lock';
  const staged = resolve(parent, '.rtool-update-' + randomBytes(16).toString('hex'));
  let lock, staging, stageExists = false;
  try {
    // A cooperative lock serializes rtool writers without silently waiting.
    lock = await open(lockPath, constants.O_WRONLY | constants.O_CREAT |
      constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const prior = await hashLocalFile(target);
    if (prior.sha256 !== args.expectedSha256) refuse();
    staging = await open(staged, constants.O_WRONLY | constants.O_CREAT |
      constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    stageExists = true;
    await staging.writeFile(bytes);
    await staging.chmod(Number(prior.info.mode & 0o777n));
    await staging.sync();
    await staging.close();
    staging = null;
    const now = await hashLocalFile(target);
    if (now.sha256 !== prior.sha256 ||
        now.info.ino !== prior.info.ino || now.info.dev !== prior.info.dev ||
        now.info.mtimeNs !== prior.info.mtimeNs) refuse();
    await rename(staged, target);
    stageExists = false;
    return { updated: true, root: index, path: relative,
      bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  } catch { refuse(); }
  finally {
    if (staging) await staging.close();
    if (stageExists) await unlink(staged).catch(() => {});
    if (lock) {
      await lock.close();
      await unlink(lockPath).catch(() => {});
    }
  }
}
