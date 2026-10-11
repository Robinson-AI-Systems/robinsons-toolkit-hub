import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { startFakeServer } from '../../conformance/fake-server/server.js';
import { generateSdk } from '../src/sdk.js';

describe('generated SDK is usable by typed consumers', () => {
  it('compiles real generated .d.ts with strict TypeScript and rejects invalid field types', async () => {
    const fake = await startFakeServer();
    const root = await mkdtemp(join(tmpdir(), 'rtool-ts-'));
    try {
      const pass = fake.passes.full;
      const env = { ['RTOOL_' + 'PASS_SAMPLE']: pass };
      const dir = join(root, 'sample-sdk');
      const report = await generateSdk({
        servers: new Map([['sample', fake.url]]), env, name: 'sample', dest: dir
      });
      expect(report.count).toBe(4);
      expect(report.areas).toContain('testing');
      const declarations = await readFile(join(dir, 'testing.d.ts'), 'utf8');
      expect(declarations).not.toContain(pass);
      expect(declarations).toMatch(/fake_read_record/);
      await writeFile(join(dir, 'consumer.ts'), [
        "import { fake_read_record, fake_delete_record } from './testing.js';",
        "const one = fake_read_record({ detail: 'full', fields: ['value'] });",
        "const two = fake_delete_record({ dryRun: true });",
        'void one; void two;',
        '// @ts-expect-error fields must be strings',
        "fake_read_record({ fields: [42] });",
        '// @ts-expect-error dryRun must be boolean',
        "fake_delete_record({ dryRun: 'yes' });"
      ].join('\n') + '\n');
      const binary = resolve('node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
      const check = spawnSync(binary, ['--noEmit', '--strict', '--skipLibCheck',
        '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
        join(dir, 'consumer.ts')], { encoding: 'utf8', timeout: 15000 });
      expect(check.error).toBeUndefined();
      expect(check.status, check.stdout + '\n' + check.stderr).toBe(0);
    } finally {
      await fake.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
