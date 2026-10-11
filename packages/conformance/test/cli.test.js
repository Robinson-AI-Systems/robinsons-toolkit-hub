import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startFakeServer } from '../fake-server/server.js';
const cli = fileURLToPath(new URL('../bin/rtc-conformance.js', import.meta.url));
describe('rtc-conformance CLI', () => {
  it('rejects invalid arguments without printing a pass', () => {
    const invalid = spawnSync(process.execPath, [cli, 'http://localhost:1', '--pass-env', 'rtc_pass_' + 'X'.repeat(43)], { encoding: 'utf8' });
    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toContain('Usage:');
    expect(invalid.stderr).not.toContain('rtc_pass_');
  });
  it('exits 1 on missing role passes (skipped), with none printed', async () => {
    const f = await startFakeServer();
    try {
      // Invoke main in this process; a sync child would block the in-process HTTP server.
      const { main } = await import('../bin/rtc-conformance.js');
      const lines = [];
      const original = console.log;
      console.log = (line) => lines.push(line);
      try {
        expect(await main([f.url, '--pass-env', 'FULL_PASS'], { FULL_PASS: f.passes.full })).toBe(1);
      } finally { console.log = original; }
      expect(lines.join(' ')).toContain('SKIP passes.read_only');
      expect(lines.join(' ')).not.toContain(f.passes.full);
    } finally { await f.close(); }
  });
  it('exits 0 for full role set and 1 for a deliberately broken server', async () => {
    const { main } = await import('../bin/rtc-conformance.js');
    for (const faults of [[], ['bad-error-envelope']]) {
      const f = await startFakeServer({ faults });
      try {
        const args = [f.url, '--pass-env', 'FULL', '--read-only-pass-env', 'READ',
          '--expired-pass-env', 'EXPIRED', '--revoked-pass-env', 'REVOKED'];
        const env = { FULL: f.passes.full, READ: f.passes.readOnly,
          EXPIRED: f.passes.expired, REVOKED: f.passes.revoked };
        const original = console.log;
        console.log = () => {};
        try { expect(await main(args, env)).toBe(faults.length ? 1 : 0); }
        finally { console.log = original; }
      } finally { await f.close(); }
    }
  });
});
