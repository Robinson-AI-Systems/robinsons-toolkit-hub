import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalFiles } from '../src/local-files.js';
import { createLocalMcp } from '../src/mcp.js';

async function fixture(action) {
  const base = await mkdtemp(join(tmpdir(), 'rtool-create-'));
  const root = join(base, 'allowed');
  try {
    await mkdir(root);
    await mkdir(join(root, 'nested'));
    await mkdir(join(base, 'outside'));
    await symlink(join(base, 'outside'), join(root, 'escape'));
    const localFiles = await createLocalFiles([root]);
    const mcp = createLocalMcp({ servers: new Map(), env: {}, localFiles });
    return await action({ base, root, mcp });
  } finally { await rm(base, { recursive: true, force: true }); }
}
const call = (mcp, args) => mcp.dispatch({ jsonrpc: '2.0', id: 3,
  method: 'tools/call', params: { name: 'local.file_create', arguments: args } });
describe('confirmed local file creation', () => {
  it('creates new files only with explicit confirmation, never overwrites and never returns content', async () =>
    fixture(async ({ root, mcp }) => {
      const blocked = await call(mcp, { path: 'nested/new.txt', content: 'hello' });
      expect(blocked.result.isError).toBe(true);
      expect(await readdir(join(root, 'nested'))).toEqual([]);
      const created = await call(mcp, { path: 'nested/new.txt', content: 'hello', confirm: true });
      expect(created.result.structuredContent).toEqual({
        created: true, root: 0, path: 'nested/new.txt', bytes: 5
      });
      expect(JSON.stringify(created)).not.toContain('hello');
      expect(await readFile(join(root, 'nested/new.txt'), 'utf8')).toBe('hello');
      const duplicate = await call(mcp, { path: 'nested/new.txt', content: 'changed', confirm: true });
      expect(duplicate.result.isError).toBe(true);
      expect(await readFile(join(root, 'nested/new.txt'), 'utf8')).toBe('hello');
    }));
  it('refuses traversal, out-of-root symlink, Git metadata, ambiguous paths and invalid root', async () =>
    fixture(async ({ root, base, mcp }) => {
      const cases = [
        { path: '../outside/hijack', content: 'x', confirm: true },
        { path: 'escape/hijack', content: 'x', confirm: true },
        { path: '.git/config', content: 'x', confirm: true },
        { path: '.GIT/config', content: 'x', confirm: true },
        { path: 'nested/no.txt', content: 'x', root: 2, confirm: true },
        { path: 'nested\\escape.txt', content: 'x', confirm: true },
        { path: '/tmp/hijack', content: 'x', confirm: true },
        { path: 'missing/hijack', content: 'x', confirm: true }
      ];
      for (const options of cases) {
        expect((await call(mcp, options)).result.isError).toBe(true);
      }
      expect(await readdir(join(base, 'outside'))).toEqual([]);
      expect(await readdir(join(root, 'nested'))).toEqual([]);
    }));
  it('refuses oversize UTF-8 bytes and keeps read-only tools separate', async () =>
    fixture(async ({ root, mcp }) => {
      expect((await call(mcp, { path: 'large', content: '😇'.repeat(5000), confirm: true }))
        .result.isError).toBe(true);
      expect(await readdir(join(root, 'nested'))).toEqual([]);
      const tools = (await mcp.dispatch({ jsonrpc: '2.0', id: 4, method: 'tools/list' })).result.tools;
      const writing = tools.find((tool) => tool.name === 'local.file_create');
      expect(writing.annotations.readOnlyHint).toBe(false);
      expect(writing.annotations.destructiveHint).toBe(false);
      const made = await call(mcp, { path: 'empty.txt', content: '', confirm: true });
      expect(made.result.structuredContent.bytes).toBe(0);
    }));
});
