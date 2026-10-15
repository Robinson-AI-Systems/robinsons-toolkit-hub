import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalFiles } from '../src/local-files.js';
import { createLocalMcp } from '../src/mcp.js';

const git = promisify(execFile);
async function fixture(action) {
  const base = await mkdtemp(join(tmpdir(), 'rtool-git-'));
  const root = join(base, 'approved');
  try {
    await mkdir(root);
    await git('git', ['init', '-q', root]);
    await git('git', ['-C', root, 'config', 'user.name', 'Test Author']);
    await git('git', ['-C', root, 'config', 'user.email', 'test@example.invalid']);
    await writeFile(join(root, 'item.txt'), 'initial');
    await git('git', ['-C', root, 'add', 'item.txt']);
    await git('git', ['-C', root, 'commit', '-qm', 'Approved sample commit']);
    const localFiles = await createLocalFiles([root]);
    const mcp = createLocalMcp({ servers: new Map(), env: {}, localFiles });
    return await action({ base, root, mcp });
  } finally { await rm(base, { recursive: true, force: true }); }
}
const call = async (mcp, name, argumentsValue = {}) =>
  mcp.dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name, arguments: argumentsValue } });
describe('owner-enabled bounded local Git inspections', () => {
  it('inspects fixed Git status, diff and recent log, without accepting command parameters', async () =>
    fixture(async ({ root, mcp }) => {
      const tools = (await mcp.dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).result.tools;
      expect(tools.filter((tool) => tool.name.startsWith('local.git_'))).toHaveLength(7);
      expect(tools.filter((tool) => tool.name.startsWith('local.git_'))
        .every((tool) => tool.annotations.readOnlyHint)).toBe(true);
      expect((await call(mcp, 'local.git_log')).result.structuredContent.output)
        .toContain('Approved sample commit');
      await writeFile(join(root, 'item.txt'), 'modified');
      expect((await call(mcp, 'local.git_status')).result.structuredContent.output).toContain('item.txt');
      expect((await call(mcp, 'local.git_diff')).result.structuredContent.output).toContain('item.txt');
      expect((await call(mcp, 'local.git_log', { path: 'subdir' })).result.isError).toBe(true);
    }));
  it('refuses Git metadata outside the granted root and makes no remote requests', async () =>
    fixture(async ({ base, root, mcp }) => {
      const outside = join(base, 'not-approved');
      await mkdir(outside);
      await symlink(join(root, '.git'), join(outside, '.git'));
      const unrelatedMcp = createLocalMcp({ servers: new Map(), env: {},
        localFiles: await createLocalFiles([outside]) });
      expect((await call(unrelatedMcp, 'local.git_status')).result.isError).toBe(true);
      expect((await call(mcp, 'local.git_log', { root: 99 })).result.isError).toBe(true);
    }));
  it('refuses unbounded commit output instead of truncating response', async () =>
    fixture(async ({ root, mcp }) => {
      await git('git', ['-C', root, 'commit', '--allow-empty', '-qm', 'Z'.repeat(5000)]);
      const result = await call(mcp, 'local.git_log');
      expect(result.result.isError).toBe(true);
    }));
});
