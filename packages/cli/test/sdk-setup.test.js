import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startFakeServer } from '../../conformance/fake-server/server.js';
import { generateSdk, typeFromSchema } from '../src/sdk.js';
import { SKILL, reconcileAgentText, writeAgentSetup, writeSkill } from '../src/setup.js';
import { runCLI } from '../src/commands.js';
const terminal = () => {
  let printed = '', errors = '';
  return { out: { write: (x) => { printed += x; } },
    err: { write: (x) => { errors += x; } },
    output: () => printed, errors: () => errors };
};
describe('rtool SDK and agent setup', () => {
  it('produces a usable SDK with inferred types, no credential on disk, and real guarded calls', async () => {
    const f = await startFakeServer();
    const dir = await mkdtemp(join(tmpdir(), 'rtool-sdk-'));
    const passKey = 'RTOOL_' + 'PASS_ONE';
    const env = { RTOOL_SERVERS: 'one=' + f.url, [passKey]: f.passes.full };
    const prior = process.env[passKey];
    try {
      const dest = join(dir, 'generated');
      const term = terminal();
      expect(await runCLI(['sdk', 'one', '--out', dest],
        { env, out: term.out, err: term.err })).toBe(0);
      const source = await readFile(join(dest, '_client.js'), 'utf8');
      expect(source).not.toContain(f.passes.full);
      expect(source).not.toContain('Bearer ' + f.passes.full);
      expect((await readFile(join(dest, 'testing.d.ts'), 'utf8'))).toContain('fake_read_record');
      expect((await stat(join(dest, 'testing.js'))).isFile()).toBe(true);
      process.env[passKey] = f.passes.full;
      const functions = await import(pathToFileURL(join(dest, 'testing.js')).href);
      expect((await functions.fake_read_record({ fields: ['value'] })).result.value).toBe('original');
      const no = await functions.fake_delete_record({});
      expect(no.result.needsConfirmation).toBe(true);
      expect(f.state.value).toBe('original');
      await expect(generateSdk({ servers: new Map([['one', f.url]]), env,
        name: 'one', dest })).rejects.toThrow(/exists/);
      expect(term.output()).not.toContain(f.passes.full);
    } finally {
      if (prior === undefined) delete process.env[passKey];
      else process.env[passKey] = prior;
      await f.close(); await rm(dir, { recursive: true, force: true });
    }
  });
  it('generates strong scalar, enum, required and nested declaration shapes', () => {
    expect(typeFromSchema({ type: 'array', items: { type: 'integer' } })).toBe('Array<number>');
    expect(typeFromSchema({ enum: ['a', 'b'] })).toBe('"a" | "b"');
    expect(typeFromSchema({ type: 'object', required: ['name'],
      properties: { name: { type: 'string' }, count: { type: 'integer' } } }))
      .toContain('"name": string');
    expect(typeFromSchema({ type: 'object', properties: { query: { type: 'boolean' } } }))
      .toContain('"query"?: boolean');
  });
  it('preserves project instructions, safely replaces its own block, and refuses symlinks', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rtool-init-'));
    const env = { RTOOL_SERVERS: 'one=https://example.test' };
    const servers = new Map([['one', 'https://example.test']]);
    try {
      await writeFile(join(dir, 'AGENTS.md'), '# Existing rules\nDo not change\n');
      const first = await writeAgentSetup({ dir, servers, env });
      expect(first.changed).toBe(true);
      const text = await readFile(first.target, 'utf8');
      expect(text).toContain('Do not change');
      expect(text).toContain('one');
      expect(text).toContain('relay');
      expect((await writeAgentSetup({ dir, servers, env })).changed).toBe(false);
      expect(reconcileAgentText('<!-- RTOOL:BEGIN --> broken', 'new')).toThrow();
      const skillPath = await writeSkill({ dir });
      expect(await readFile(skillPath, 'utf8')).toBe(SKILL);
      await expect(writeSkill({ dir })).rejects.toThrow();
      const linkDir = await mkdtemp(join(tmpdir(), 'rtool-link-'));
      try {
        await symlink(first.target, join(linkDir, 'AGENTS.md'));
        await expect(writeAgentSetup({ dir: linkDir, servers, env })).rejects.toThrow(/unsafe/);
      } finally { await rm(linkDir, { recursive: true, force: true }); }
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('runs sdk, skill and init from CLI with no pass disclosure', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rtool-setup-'));
    const term = terminal();
    try {
      const env = { RTOOL_SERVERS: 'one=https://example.test' };
      expect(await runCLI(['skill'], { env, out: term.out, err: term.err })).toBe(0);
      expect(term.output()).toContain('Robinson Toolkit');
      expect(await runCLI(['init', '--out', dir], { env, out: term.out, err: term.err })).toBe(0);
      expect((await readFile(join(dir, 'AGENTS.md'), 'utf8'))).toContain('RTC');
      expect(await runCLI(['skill', '--out', dir], { env, out: term.out, err: term.err })).toBe(0);
      expect(await runCLI(['sdk', 'missing'], { env, out: term.out, err: term.err })).toBe(6);
      expect(term.errors()).not.toContain('https://example.test/');
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
