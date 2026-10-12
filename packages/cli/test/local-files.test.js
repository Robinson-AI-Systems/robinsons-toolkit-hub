import { describe, expect, it } from 'vitest';
import { createLocalFiles } from '../src/local-files.js';
import { createLocalMcp } from '../src/mcp.js';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { runCLI } from '../src/commands.js';

describe('local file grants', () => {
  it('refuses empty grant lists', async () => {
    await expect(createLocalFiles([])).rejects.toThrow();
  });
});

async function withRoot(action) {
  const base = await mkdtemp(join(tmpdir(), 'rtool-l1-'));
  const folder = join(base, 'approved');
  try {
    await mkdir(folder);
    await writeFile(join(folder, 'readme.txt'), 'sample text');
    await writeFile(join(folder, 'oversized.txt'), 'a'.repeat(4097));
    await writeFile(join(base, 'private.txt'), 'outside content');
    await symlink(join(base, 'private.txt'), join(folder, 'link'));
    return await action({ base, folder });
  } finally { await rm(base, { recursive: true, force: true }); }
}
const message = (name, args = {}) => ({
  jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args }
});
async function localMcp(folder) {
  return createLocalMcp({ servers: new Map(), env: {}, localFiles: await createLocalFiles([folder]) });
}

describe('folder-scoped local MCP reads', () => {
  it('is absent without opt-in and offers only three read-only tools with opt-in', async () =>
    withRoot(async ({ folder }) => {
      const absent = createLocalMcp({ servers: new Map(), env: {} });
      expect((await absent.dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).result.tools).toHaveLength(0);
      const mcp = await localMcp(folder);
      const list = (await mcp.dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).result.tools;
      expect(list.filter((tool) => tool.name.startsWith('local.file_')).map((tool) => tool.name)).toEqual(['local.file_list', 'local.file_stat', 'local.file_read', 'local.file_search', 'local.file_create']);
      expect(list.filter((tool) => tool.name !== 'local.file_create').every((tool) => tool.annotations.readOnlyHint)).toBe(true);
      expect(list.find((tool) => tool.name === 'local.file_create').annotations.readOnlyHint).toBe(false);
    }));

  it('reads safe content and denies escapes and oversized file reads', async () =>
    withRoot(async ({ folder }) => {
      const mcp = await localMcp(folder);
      expect((await mcp.dispatch(message('local.file_read', { path: 'readme.txt' })))
        .result.structuredContent.content).toBe('sample text');
      expect((await mcp.dispatch(message('local.file_stat', { path: 'readme.txt' })))
        .result.structuredContent.bytes).toBe(11);
      expect((await mcp.dispatch(message('local.file_list')))
        .result.structuredContent.entries.some((entry) => entry.name === 'readme.txt')).toBe(true);
      for (const path of ['../private.txt', 'link', 'oversized.txt']) {
        const result = await mcp.dispatch(message('local.file_read', { path }));
        expect(result.result.isError).toBe(true);
        expect(JSON.stringify(result)).not.toContain('outside content');
      }
      expect((await mcp.dispatch(message('local.file_read', { path: 'readme.txt', root: 2 })))
        .result.isError).toBe(true);
    }));

  it('rejects repeated or missing local grants', async () =>
    withRoot(async ({ folder }) => {
      await expect(createLocalFiles([folder, folder])).rejects.toThrow();
      await expect(createLocalFiles([join(folder, 'not-found')])).rejects.toThrow();
    }));
});

describe('rtool MCP local CLI integration', () => {
  it('starts the real stdio door with three local tools and no remote server', async () =>
    withRoot(async ({ folder }) => {
      const input = new PassThrough();
      let out = '', err = '';
      const running = runCLI(['mcp', '--local', folder], {
        env: {}, reader: async () => {
          const failure = new Error('no config');
          failure.code = 'ENOENT';
          throw failure;
        }, input,
        out: { write: (value) => { out += value; } },
        err: { write: (value) => { err += value; } }
      });
      input.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n');
      expect(await running).toBe(0);
      expect(JSON.parse(out).result.tools).toHaveLength(8);
      expect(err).toBe('');
    }));
});
