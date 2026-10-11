import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakeServer } from '../../conformance/fake-server/server.js';
import { runCLI } from '../src/commands.js';

function terminal() {
  let stdout = '';
  let stderr = '';
  return { out: { write: (s) => { stdout += s; } }, err: { write: (s) => { stderr += s; } },
    text: () => stdout, error: () => stderr };
}
describe('rtool direct commands against real RTC HTTP fake', () => {
  it('lists, describes, reads, guards writes and preserves the server pass', async () => {
    const f = await startFakeServer();
    const env = { RTOOL_SERVERS: 'one=' + f.url, RTOOL_PASS_ONE: f.passes.full };
    const term = terminal();
    const run = (args) => runCLI(args, { env, out: term.out, err: term.err });
    try {
      expect(await run(['servers'])).toBe(0);
      expect(term.text()).toContain('"passConfigured": true');
      expect(term.text()).not.toContain(f.passes.full);
      expect(await run(['whoami', 'one'])).toBe(0);
      expect(await run(['tools', 'one', 'record'])).toBe(0);
      expect(term.text()).toContain('fake_read_record');
      expect(await run(['describe', 'fake_read_record'])).toBe(0);
      expect(await run(['call', 'fake_read_record', '--fields', 'value'])).toBe(0);
      expect(await run(['call', 'fake_delete_record'])).toBe(2);
      expect(f.state.value).toBe('original');
      expect(await run(['call', 'fake_delete_record', '--dry-run', '--confirm'])).toBe(0);
      expect(f.state.value).toBe('original');
      expect(await run(['call', 'fake_write_record', '--args', '{"value":"yes"}'])).toBe(0);
      expect(f.state.value).toBe('yes');
      expect(await run(['batch', 'one', '--args', '{"calls":[{"name":"fake_read_record","args":{}}]}'])).toBe(0);
      expect(await run(['batch', 'one', '--args', '{"calls":[{"name":"fake_delete_record","args":{}}]}'])).toBe(3);
    } finally { await f.close(); }
  });
  it('writes large results to a new restricted file, leaving the output short', async () => {
    const f = await startFakeServer();
    const dir = mkdtempSync(join(tmpdir(), 'rtool-out-'));
    const term = terminal();
    const env = { RTOOL_SERVERS: 'one=' + f.url, RTOOL_PASS_ONE: f.passes.full };
    try {
      const path = join(dir, 'result.json');
      expect(await runCLI(['call', 'fake_read_record', '--detail', 'full', '--out', path],
        { env, out: term.out, err: term.err })).toBe(0);
      const big = JSON.parse(readFileSync(path, 'utf8'));
      expect(big.result.payload.length).toBe(9000);
      expect((statSync(path).mode & 0o777)).toBe(0o600);
      expect(term.text().length).toBeLessThan(300);
      const response = await fetch(f.url + '/api/tools/fake_read_record', {
        method: 'POST', headers: { authorization: 'Bearer ' + f.passes.full,
          'content-type': 'application/json' }, body: JSON.stringify({ detail: 'full' }) });
      const handle = (await response.json()).handle;
      expect(await runCLI(['result', 'one', handle], { env, out: term.out, err: term.err })).toBe(0);
      expect(await runCLI(['call', 'fake_read_record', '--detail', 'full', '--out', path],
        { env, out: term.out, err: term.err })).toBe(4);
    } finally { await f.close(); rmSync(dir, { force: true, recursive: true }); }
  });
  it('maps expired/refused/unroutable to stable exit codes', async () => {
    const f = await startFakeServer();
    try {
      const env = { RTOOL_SERVERS: 'one=' + f.url, RTOOL_PASS_ONE: f.passes.expired };
      expect(await runCLI(['whoami', 'one'], { env, ...terminal() })).toBe(5);
      env.RTOOL_PASS_ONE = f.passes.readOnly;
      const t = terminal();
      expect(await runCLI(['call', 'fake_write_record'], { env, out: t.out, err: t.err })).toBe(3);
      expect(await runCLI(['call', 'unknown_read'], { env, out: t.out, err: t.err })).toBe(6);
      expect(t.error()).not.toContain(f.passes.readOnly);
    } finally { await f.close(); }
  });
});
