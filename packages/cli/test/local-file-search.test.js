import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLocalFiles } from '../src/local-files.js';
import { createLocalMcp } from '../src/mcp.js';

async function fixture(action) {
  const home = await mkdtemp(join(tmpdir(), 'rtool-src-search-'));
  const root = join(home, 'approved');
  try {
    await mkdir(root);
    await mkdir(join(root, 'src'));
    await mkdir(join(root, 'node_modules'));
    await writeFile(join(root, 'src', 'a.ts'), 'first MATCH\nsecond match\nnope\n');
    await writeFile(join(root, 'src', 'b.js'), 'another match\n');
    await writeFile(join(root, '.env'), 'MATCH_PRIVATE_TOKEN');
    await writeFile(join(root, 'node_modules', 'hidden.js'), 'match-dependency');
    await writeFile(join(home, 'outside.md'), 'match-outside');
    await symlink(join(home, 'outside.md'), join(root, 'src', 'outside.md'));
    await symlink(home, join(root, 'outside-dir'));
    const mcp = createLocalMcp({ servers: new Map(), env: {},
      localFiles: await createLocalFiles([root]) });
    return await action({ root, mcp });
  } finally { await rm(home, { recursive: true, force: true }); }
}
function search(mcp, args) {
  return mcp.dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'local.file_search', arguments: args } });
}
describe('bounded local source search', () => {
  it('finds only approved literal source matches without following symlinks or hidden paths', async () =>
    fixture(async ({ mcp }) => {
      const result = await search(mcp, { query: 'match' });
      expect(result.result.isError).not.toBe(true);
      const hits = result.result.structuredContent;
      expect(hits.matches.map((m) => [m.path, m.line])).toEqual([
        ['src/a.ts', 1], ['src/a.ts', 2], ['src/b.js', 1]
      ]);
      expect(hits.truncated).toBe(false);
      const output = JSON.stringify(result);
      expect(output).not.toContain('MATCH_PRIVATE_TOKEN');
      expect(output).not.toContain('match-outside');
      expect(output).not.toContain('match-dependency');
    }));
  it('reports incomplete search when match count or file size exceeds limits', async () =>
    fixture(async ({ mcp, root }) => {
      const capped = (await search(mcp, { query: 'match', limit: 1 }))
        .result.structuredContent;
      expect(capped.matches).toHaveLength(1);
      expect(capped.truncated).toBe(true);
      await writeFile(join(root, 'src', 'very-large.js'), 'match\n'.repeat(15000));
      const big = (await search(mcp, { query: 'match' })).result.structuredContent;
      expect(big.truncated).toBe(true);
      expect(big.matches).toHaveLength(3);
    }));
  it('rejects unsafe roots, traversals, empty queries and oversized limits', async () =>
    fixture(async ({ mcp }) => {
      for (const args of [
        { query: '' }, { query: 'x', root: 4 }, { query: 'x', path: '../outside' },
        { query: 'x', path: 'outside-dir' }, { query: 'x', limit: 1000 },
        { query: 'x'.repeat(101) }
      ]) expect((await search(mcp, args)).result.isError).toBe(true);
      const tools = (await mcp.dispatch({ jsonrpc: '2.0', id: 2, method: 'tools/list' }))
        .result.tools;
      expect(tools.find((t) => t.name === 'local.file_search').annotations.readOnlyHint).toBe(true);
    }));
});
