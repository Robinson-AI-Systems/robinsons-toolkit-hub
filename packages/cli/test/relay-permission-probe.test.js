import { describe, it, expect } from 'vitest';
import { githubCommentTransport } from '../src/relay.js';
import { relayPermissionProbe } from '../../../scripts/relay-permission-probe.mjs';

const repo = 'Robinson-AI-Systems/robinsons-toolkit-relay';
const token = 'isolated-fixture-token';
const env = { RELAY_REPOSITORY: repo, RELAY_GITHUB_TOKEN: token,
  RELAY_BINDINGS: JSON.stringify({ 17: { actorId: 9876, server: 'custom-rtc' } }) };
const authorized = ['--issue', '17', '--authorized-relay-test'];
function fixture(overrides = {}) {
  const seen = [];
  const fetchImpl = async (url, init) => {
    const path = url.slice(('https://api.github.com/repos/' + repo).length);
    const method = init.method;
    seen.push({ path, method, auth: init.headers.authorization,
      body: init.body && JSON.parse(init.body).body });
    const key = method + ' ' + path;
    if (overrides[key] === 'throw') throw new Error('secret must stay hidden');
    if (typeof overrides[key] === 'number') return new Response('', { status: overrides[key] });
    if (method === 'DELETE') return new Response(null, { status: 204 });
    const body = {
      'GET ': { full_name: repo, private: true },
      'GET /issues/17': { number: 17, state: 'open', locked: false },
      'POST /issues/17/comments': { id: 299 }
    }[key];
    return Response.json(overrides[key] || body);
  };
  return { seen, transportFactory: options => githubCommentTransport({ ...options, fetchImpl }) };
}
describe('D-4 private encrypted relay scope probe', () => {
  it('checks private repo, existing issue and post/delete without generating a runnable request', async () => {
    const mock = fixture();
    let output = '';
    const status = await relayPermissionProbe({ args: authorized, env, ...mock,
      write: s => { output += s; } });
    expect(status).toBe(0);
    expect(JSON.parse(output)).toMatchObject({ ok: true, leastPrivilegeVerified: false,
      commentCreate: true, commentDelete: true });
    expect(mock.seen.map(x => x.method)).toEqual(['GET', 'GET', 'POST', 'DELETE']);
    expect(mock.seen.every(x => x.auth === 'Bearer ' + token)).toBe(true);
    const body = mock.seen[2].body;
    expect(body).toMatch(/^rtc:transport-probe:v1:[a-f0-9]{32}$/);
    expect(body).not.toMatch(/^rtc:v1:(request|reply):/);
    expect(output).not.toContain(token);
    expect(output).not.toContain(body);
  });
  it('requires an approved bound issue before any network access', async () => {
    for (const [args, patch] of [
      [['--issue', '17'], {}], [authorized, { RELAY_BINDINGS: '{}' }],
      [['--issue', '18', '--authorized-relay-test'], {}],
      [authorized, { RELAY_GITHUB_TOKEN: '' }],
      [authorized, { RELAY_BINDINGS: '{"17":{"actorId":0,"server":"custom-rtc"}}' }]
    ]) {
      const mock = fixture(); let output = '';
      expect(await relayPermissionProbe({ args, env: { ...env, ...patch }, ...mock,
        write: s => { output += s; } })).toBe(1);
      expect(mock.seen).toHaveLength(0);
      expect(JSON.parse(output).ok).toBe(false);
    }
  });
  it('refuses non-private, closed, locked and PR issue targets without posting', async () => {
    for (const changed of [
      { 'GET ': { full_name: repo, private: false } },
      { 'GET ': { full_name: 'outsider/repo', private: true } },
      { 'GET /issues/17': { number: 17, state: 'closed', locked: false } },
      { 'GET /issues/17': { number: 17, state: 'open', locked: true } },
      { 'GET /issues/17': { number: 17, state: 'open', locked: false, pull_request: {} } }
    ]) {
      const mock = fixture(changed); let output = '';
      expect(await relayPermissionProbe({ args: authorized, env, ...mock,
        write: s => { output += s; } })).toBe(1);
      expect(mock.seen.map(x => x.method)).not.toContain('POST');
      expect(JSON.parse(output).ok).toBe(false);
    }
  });
  it('reports partial transport permission and cleanup denial as a failure', async () => {
    for (const changed of [
      { 'POST /issues/17/comments': 403 },
      { 'POST /issues/17/comments': { id: -1 } },
      { 'DELETE /issues/comments/299': 403 },
      { 'DELETE /issues/comments/299': 'throw' }
    ]) {
      const mock = fixture(changed); let output = '';
      expect(await relayPermissionProbe({ args: authorized, env, ...mock,
        write: s => { output += s; } })).toBe(1);
      expect(JSON.parse(output).code).toBe('transport_probe_failed_or_cleanup_required');
      expect(output).not.toContain(token);
    }
  });
});
