import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { startFakeServer } from '../../conformance/fake-server/server.js';
import { createLocalMcp, serveLocalStdio } from '../src/mcp.js';
import { runCLI } from '../src/commands.js';

const message = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params });
const setup = async () => {
  const a = await startFakeServer();
  const b = await startFakeServer();
  const env = {
    RTOOL_SERVERS: 'one=' + a.url + ',two=' + b.url,
    ['RTOOL_' + 'PASS_ONE']: a.passes.full,
    ['RTOOL_' + 'PASS_TWO']: b.passes.readOnly
  };
  const servers = new Map([['one', a.url], ['two', b.url]]);
  return { a, b, env, servers, async close() { await a.close(); await b.close(); } };
};
describe('local rtool stdio MCP', () => {
  it('negotiates MCP, lists a compact broker for two standalone servers and calls real tools', async () => {
    const fixture = await setup();
    try {
      const mcp = createLocalMcp(fixture);
      const initialized = await mcp.dispatch(message(1, 'initialize', {
        protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'unit', version: '1' }
      }));
      expect(initialized.result.protocolVersion).toBe('2025-11-25');
      expect(initialized.result.capabilities.tools).toBeDefined();
      expect((await mcp.dispatch(message(2, 'ping'))).result).toEqual({});
      const list = (await mcp.dispatch(message(3, 'tools/list'))).result.tools;
      expect(list).toHaveLength(12);
      expect(list.map((x) => x.name)).toContain('one_call');
      expect(list.map((x) => x.name)).toContain('two_call');
      expect(JSON.stringify(list).length / 4).toBeLessThan(5000);
      const search = await mcp.dispatch(message(4, 'tools/call', { name: 'one_search',
        arguments: { q: 'read_record' } }));
      expect(search.result.structuredContent.result.tools[0].name).toBe('fake_read_record');
      const described = await mcp.dispatch(message(5, 'tools/call', {
        name: 'two_describe', arguments: { tool: 'fake_read_record' } }));
      expect(described.result.structuredContent.result.name).toBe('fake_read_record');
      const preview = await mcp.dispatch(message(6, 'tools/call', {
        name: 'one_call', arguments: { tool: 'fake_delete_record', args: {} } }));
      expect(preview.result.structuredContent.result.needsConfirmation).toBe(true);
      expect(fixture.a.state.value).toBe('original');
      const done = await mcp.dispatch(message(7, 'tools/call', {
        name: 'one_call', arguments: { tool: 'fake_delete_record', confirm: true } }));
      expect(done.result.structuredContent.result.logged.id).toBeTypeOf('string');
      expect(fixture.a.state.value).toBe('deleted');
      const refused = await mcp.dispatch(message(8, 'tools/call', {
        name: 'two_call', arguments: { tool: 'fake_write_record', confirm: true } }));
      expect(refused.result.isError).toBe(true);
      expect(fixture.b.state.value).toBe('original');
      const batch = await mcp.dispatch(message(9, 'tools/call', {
        name: 'one_batch', arguments: { calls: [{ name: 'fake_read_record', args: {} }] } }));
      expect(batch.result.structuredContent.ok).toBe(true);
      const badBatch = await mcp.dispatch(message(10, 'tools/call', {
        name: 'one_batch', arguments: { calls: [{ name: 'fake_delete_record' }] } }));
      expect(badBatch.result.isError).toBe(true);
      expect((await mcp.dispatch(message(11, 'methods/not_real'))).error.code).toBe(-32601);
    } finally { await fixture.close(); }
  });
  it('speaks line-delimited JSON-RPC with no stdout logs or notification replies', async () => {
    const fixture = await setup();
    const input = new PassThrough();
    let output = '', stderr = '';
    const out = { write: (chunk) => { output += chunk; } };
    const err = { write: (chunk) => { stderr += chunk; } };
    try {
      const run = runCLI(['mcp'], { env: fixture.env, out, err, input });
      input.write(JSON.stringify(message(1, 'initialize')) + '\n');
      input.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      input.write(JSON.stringify(message(2, 'tools/list')) + '\n');
      input.write(JSON.stringify(message(3, 'tools/call', {
        name: 'two_whoami', arguments: {} })) + '\n');
      input.write('not a JSON message\n');
      input.end();
      expect(await run).toBe(0);
      const lines = output.trim().split('\n').map((s) => JSON.parse(s));
      expect(lines).toHaveLength(4);
      expect(lines.map((x) => x.id)).toEqual([1, 2, 3, null]);
      expect(lines[1].result.tools).toHaveLength(12);
      expect(lines[2].result.structuredContent.result.profile).toBe('read_only');
      expect(lines[3].error.code).toBe(-32700);
      expect(output).not.toContain(fixture.a.passes.full);
      expect(output).not.toContain(fixture.b.passes.readOnly);
      expect(stderr).toBe('');
    } finally { await fixture.close(); }
  });
  it('missing pass disables only that server, never widens permissions', async () => {
    const fixture = await setup();
    try {
      const env = { ...fixture.env };
      delete env['RTOOL_' + 'PASS_TWO'];
      const mcp = createLocalMcp({ servers: fixture.servers, env });
      const tools = (await mcp.dispatch(message(1, 'tools/list'))).result.tools;
      expect(tools).toHaveLength(6);
      expect(tools.some((x) => x.name.startsWith('two_'))).toBe(false);
      expect((await mcp.dispatch(message(2, 'tools/call', {
        name: 'two_call', arguments: { tool: 'fake_read_record' } } )).error.code).toBe(-32602);
    } finally { await fixture.close(); }
  });
});
