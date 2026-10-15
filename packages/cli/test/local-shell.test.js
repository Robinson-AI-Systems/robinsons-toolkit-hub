import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLocalFiles } from '../src/local-files.js';
import { createLocalMcp } from '../src/mcp.js';

const git = promisify(execFile);
async function fixture(action) {
  const base = await mkdtemp(join(tmpdir(), 'rtool-shell-'));
  const root = join(base, 'approved');
  try {
    await mkdir(root);
    await writeFile(join(root, 'sample.txt'), 'alpha\nbeta\nalpha gamma\n');
    await writeFile(join(root, 'huge.txt'), 'x'.repeat(65537));
    await writeFile(join(root, 'large.txt'), 'Y'.repeat(5000));
    await writeFile(join(base, 'secret.txt'), 'outside secret');
    await symlink(join(base, 'secret.txt'), join(root, 'escape.txt'));
    await mkdir(join(root, 'nested'));
    await symlink(base, join(root, 'nested', 'escape'));
    await git('git', ['init', '-q', root]);
    await git('git', ['-C', root, 'config', 'user.name', 'Test Author']);
    await git('git', ['-C', root, 'config', 'user.email', 'test@example.invalid']);
    await git('git', ['-C', root, 'add', 'sample.txt']);
    await git('git', ['-C', root, 'commit', '-qm', 'Local command test']);
    const mcp = createLocalMcp({
      servers: new Map(), env: {}, localFiles: await createLocalFiles([root])
    });
    return await action({ base, root, mcp });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}
const request = (args) => ({
  jsonrpc: '2.0', id: 1, method: 'tools/call',
  params: { name: 'local.shell_run', arguments: args }
});
const call = (mcp, args) => mcp.dispatch(request(args));
const data = (result) => result.result.structuredContent;
const denied = (result) => result.result.isError === true;

describe('opt-in non-interpreting local command tool', () => {
  it('is absent by default, exposed only after a local root is explicitly enabled', async () =>
    fixture(async ({ mcp }) => {
      const absent = createLocalMcp({ servers: new Map(), env: {} });
      expect((await absent.dispatch({
        jsonrpc: '2.0', id: 1, method: 'tools/list'
      })).result.tools).toEqual([]);
      const tools = (await mcp.dispatch({
        jsonrpc: '2.0', id: 1, method: 'tools/list'
      })).result.tools;
      const shell = tools.filter((tool) => tool.name.startsWith('local.shell_'));
      expect(shell).toHaveLength(4);
      expect(shell.find(x=>x.name==='local.shell_run').annotations).toMatchObject({
        readOnlyHint: true, destructiveHint: false, openWorldHint: false
      });
      expect(shell.find(x=>x.name==='local.shell_run').inputSchema.additionalProperties).toBe(false);
    }));

  it('runs only the safe base commands without confirmation', async () =>
    fixture(async ({ mcp }) => {
      expect(data(await call(mcp, { command: 'ls' })).output).toContain('sample.txt');
      expect(data(await call(mcp, { command: 'cat', path: 'sample.txt' })).output)
        .toBe('alpha\nbeta\nalpha gamma\n');
      expect(data(await call(mcp, { command: 'git log' })).output)
        .toContain('Local command test');
      expect(data(await call(mcp, { command: 'git status' })).exitCode).toBe(0);
      expect(data(await call(mcp, { command: 'git diff' })).exitCode).toBe(0);
      expect(denied(await call(mcp, { command: 'git status', path: 'nested' }))).toBe(true);
    }));

  it('requires confirm:true for additional bounded read-only commands', async () =>
    fixture(async ({ mcp }) => {
      for (const command of ['grep', 'head', 'tail', 'wc']) {
        const basic = { command, path: 'sample.txt',
          ...(command === 'grep' ? { query: 'alpha' } : {}) };
        expect(denied(await call(mcp, basic))).toBe(true);
        expect(denied(await call(mcp, { ...basic, confirm: false }))).toBe(true);
      }
      expect(data(await call(mcp, {
        command: 'grep', path: 'sample.txt', query: 'alpha', confirm: true
      })).output).toBe('1:alpha\n3:alpha gamma');
      expect(data(await call(mcp, {
        command: 'head', path: 'sample.txt', lines: 2, confirm: true
      })).output).toBe('alpha\nbeta');
      expect(data(await call(mcp, {
        command: 'tail', path: 'sample.txt', lines: 1, confirm: true
      })).output).toBe('alpha gamma');
      expect(data(await call(mcp, {
        command: 'wc', path: 'sample.txt', confirm: true
      })).output).toBe('3 4 23');
    }));

  it('rejects traversal, symlinks, unknown roots, executable/option injection and unsafe types', async () =>
    fixture(async ({ mcp }) => {
      for (const args of [
        { command: 'cat', path: '../secret.txt' },
        { command: 'cat', path: '/etc/passwd' },
        { command: 'cat', path: 'escape.txt' },
        { command: 'cat', path: 'nested/escape/secret.txt' },
        { command: 'cat', path: 'sample.txt', root: 42 },
        { command: 'cat', path: 'sample.txt', flags: ['-n'] },
        { command: 'git status --porcelain=v2', confirm: true },
        { command: 'git push', confirm: true },
        { command: 'sudo', confirm: true },
        { command: 'cat; whoami', confirm: true },
        { command: 'bash', confirm: true },
        { command: '/bin/sh', confirm: true },
        { command: 'head', path: 'sample.txt', lines: 0, confirm: true },
        { command: 'head', path: 'sample.txt', lines: 41, confirm: true },
        { command: 'grep', path: 'sample.txt', confirm: true },
        { command: 'grep', path: 'sample.txt', query: 'alpha', confirm: 'true' }
      ]) {
        const result = await call(mcp, args);
        expect(denied(result)).toBe(true);
        expect(JSON.stringify(result)).not.toContain('outside secret');
      }
    }));

  it('fails closed on output cap, binary data and large files without partial data leaks', async () =>
    fixture(async ({ root, mcp }) => {
      await writeFile(join(root, 'binary.txt'), Buffer.from([0, 255, 0]));
      for (const args of [
        { command: 'cat', path: 'large.txt' },
        { command: 'cat', path: 'binary.txt' },
        { command: 'head', path: 'huge.txt', confirm: true },
        { command: 'head', path: 'large.txt', confirm: true },
        { command: 'grep', path: 'large.txt', query: 'Y', confirm: true }
      ]) expect(denied(await call(mcp, args))).toBe(true);
    }));
});
