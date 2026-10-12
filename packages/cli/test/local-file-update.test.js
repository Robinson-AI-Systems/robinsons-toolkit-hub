import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalFiles } from '../src/local-files.js';
import { createLocalMcp } from '../src/mcp.js';

async function withMcp(action) {
  const base = await mkdtemp(join(tmpdir(), 'rtool-file-update-'));
  const root = join(base, 'approved');
  try {
    await mkdir(root);
    await mkdir(join(root, '.git'));
    await writeFile(join(root, 'original.txt'), 'before\n');
    await writeFile(join(root, '.git', 'config'), 'protected\n');
    await writeFile(join(base, 'external.txt'), 'outside\n');
    await symlink(join(base, 'external.txt'), join(root, 'escape.txt'));
    const mcp = createLocalMcp({ servers: new Map(), env: {},
      localFiles: await createLocalFiles([root]) });
    return await action({ root, base, mcp });
  } finally { await rm(base, { recursive: true, force: true }); }
}
const call = (mcp, name, args) => mcp.dispatch({ jsonrpc: '2.0', id: 1,
  method: 'tools/call', params: { name, arguments: args } });
const update = (mcp, args) => call(mcp, 'local.file_update', args);
const hash = (mcp, path = 'original.txt') => call(mcp, 'local.file_hash', { path });

describe('confirmed SHA-256 conditional local file update', () => {
  it('hashes locally and publishes a confirmed complete update without temporary artifacts', async () =>
    withMcp(async ({ root, mcp }) => {
      const before = (await hash(mcp)).result.structuredContent.sha256;
      const result = await update(mcp, { path: 'original.txt', content: 'after\n',
        expectedSha256: before, confirm: true });
      expect(result.result.structuredContent.updated).toBe(true);
      expect(await readFile(join(root, 'original.txt'), 'utf8')).toBe('after\n');
      const later = (await hash(mcp)).result.structuredContent.sha256;
      expect(later).not.toBe(before);
      expect(result.result.structuredContent.sha256).toBe(later);
      const names = await readdir(root);
      expect(names.some((n) => n.includes('.rtool-update-') || n.endsWith('.rtool-lock'))).toBe(false);
      expect(JSON.stringify(result)).not.toContain('after\n');
    }));
  it('rejects missing confirmation, stale hashes and a cooperative in-progress lock', async () =>
    withMcp(async ({ root, mcp }) => {
      const expectedSha256 = (await hash(mcp)).result.structuredContent.sha256;
      expect((await update(mcp, { path: 'original.txt', content: 'bad',
        expectedSha256 })).result.isError).toBe(true);
      await writeFile(join(root, 'original.txt'), 'changed by another editor');
      expect((await update(mcp, { path: 'original.txt', content: 'stale',
        expectedSha256, confirm: true })).result.isError).toBe(true);
      const current = (await hash(mcp)).result.structuredContent.sha256;
      await writeFile(join(root, 'original.txt.rtool-lock'), 'busy');
      expect((await update(mcp, { path: 'original.txt', content: 'locked',
        expectedSha256: current, confirm: true })).result.isError).toBe(true);
      expect(await readFile(join(root, 'original.txt'), 'utf8')).toBe('changed by another editor');
    }));
  it('refuses outside symlinks, git metadata paths, unknown roots, and oversized writes', async () =>
    withMcp(async ({ root, base, mcp }) => {
      const sha = (await hash(mcp)).result.structuredContent.sha256;
      for (const opts of [
        { path: 'escape.txt', content: 'x' },
        { path: '.git/config', content: 'x' },
        { path: '../external.txt', content: 'x' },
        { path: 'original.txt', content: 'x', root: 3 },
        { path: 'original.txt', content: 'x'.repeat(16385) },
        { path: 'missing.txt', content: 'x' }
      ]) {
        const result = await update(mcp, { expectedSha256: sha, confirm: true, ...opts });
        expect(result.result.isError).toBe(true);
      }
      expect(await readFile(join(root, '.git', 'config'), 'utf8')).toBe('protected\n');
      expect(await readFile(join(base, 'external.txt'), 'utf8')).toBe('outside\n');
      expect(await readFile(join(root, 'original.txt'), 'utf8')).toBe('before\n');
    }));
});
