import { it, expect, vi } from 'vitest';
import { startFakeServer } from '../../conformance/fake-server/server.js';
import { checkAgent, parseAgentCheck } from '../src/agent-check.js';
it('verifies real local reads without printing credentials or result data', async () => {
  const fake = await startFakeServer();
  try {
    const run = async (pass = fake.passes.readOnly, extra = {}) => {
      let printed = '';
      const exit = await checkAgent({ server: 'fake', readTool: 'fake_read_record', passEnv: 'TEST_PASS',
        env: { RTOOL_SERVERS: 'fake=' + fake.url, TEST_PASS: pass },
        write: text => { printed += text; }, ...extra });
      expect(printed).not.toContain(pass); expect(printed).not.toContain('original');
      return { exit, report: JSON.parse(printed) };
    };
    expect((await run()).report).toMatchObject({ ok: true, route: 'direct', code: 'verified' });
    expect((await run(fake.passes.full)).report.code).toBe('read_only_pass_required');
    expect((await run(fake.passes.readOnly, { readTool: 'fake_write_record' })).report.code).toBe('read_only_tool_required');
    expect((await run(fake.passes.readOnly, { expectRoute: 'relay' })).report.code).toBe('route_mismatch');
    expect((await run(fake.passes.revoked)).exit).toBe(1);
    expect(fake.state.changes).toHaveLength(0);
  } finally { await fake.close(); }
});
it('refuses external targets and missing passes before any fetch', async () => {
  const fake = await startFakeServer();
  try {
    let printed = '';
    expect(await checkAgent({ server: 'fake', readTool: 'fake_read_record', passEnv: 'TEST_PASS',
      env: { RTOOL_SERVERS: 'fake=https://example.test', TEST_PASS: fake.passes.readOnly },
      write: value => { printed = value; } })).toBe(1);
    expect(JSON.parse(printed).code).toBe('owner_authorization_required');
    expect(await checkAgent({ server: 'fake', readTool: 'fake_read_record', passEnv: 'TEST_PASS',
      env: {}, write: value => { printed = value; } })).toBe(1);
    expect(JSON.parse(printed).code).toBe('missing_test_pass');
  } finally { await fake.close(); }
});
it('accepts only env-name credential options and explicit route expectations', () => {
  expect(parseAgentCheck(['--server', 'fake', '--read-tool', 'fake_read_record', '--pass-env', 'TEST_PASS']))
    .toEqual({ server: 'fake', readTool: 'fake_read_record', passEnv: 'TEST_PASS' });
  expect(() => parseAgentCheck(['--pass', 'secret'])).toThrow();
  expect(() => parseAgentCheck(['--server', 'fake', '--server', 'fake'])).toThrow();
});

it('accepts a registered read with a manifest prefix that already ends in underscore', async () => {
  const fake = await startFakeServer();
  const originalFetch = globalThis.fetch;
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args) => {
    const response = await originalFetch(...args);
    if (new URL(args[0]).pathname !== '/api/contract') return response;
    const json = await response.json();
    return new Response(JSON.stringify({ ...json, prefix: 'fake_' }), {
      status: response.status, headers: { 'content-type': 'application/json' }
    });
  });
  try {
    let text = '';
    const code = await checkAgent({
      server: 'fake', readTool: 'fake_read_record', passEnv: 'TEST_PASS',
      env: { RTOOL_SERVERS: 'fake=' + fake.url, TEST_PASS: fake.passes.readOnly },
      write: value => { text = value; }
    });
    expect(code).toBe(0);
    expect(JSON.parse(text)).toMatchObject({ ok: true, code: 'verified', route: 'direct' });
    expect(fake.state.changes).toHaveLength(0);
  } finally { spy.mockRestore(); await fake.close(); }
});
