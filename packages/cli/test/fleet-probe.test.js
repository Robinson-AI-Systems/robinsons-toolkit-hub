import { describe, it, expect, vi } from 'vitest';
import { REQUIRED_RTC_SERVERS, parseFleetOrigins, parseReadTests, probeRtcFleet } from '../src/fleet-probe.js';
const origin = 'https://stripe-mcp-psi.vercel.app';
const manifest = { rtc: 1, server: 'stripe', prefix: 'stripe' };
const respond = (body, status = 200, type = 'application/json') =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status, headers: { 'content-type': type }
  });
const probe = (fetchImpl, opts = {}) => probeRtcFleet({ origins: { stripe: origin }, fetchImpl, ...opts });
describe('standing RTC fleet deployment acceptance', () => {
  it('keeps every mandatory custom server in the snapshot and never certifies untested routes', async () => {
    const fetchImpl = vi.fn(async () => respond(manifest));
    const result = await probe(fetchImpl);
    expect(result.checks.map(c => c.server)).toEqual([...REQUIRED_RTC_SERVERS].sort());
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(origin + '/api/contract', {
      method: 'GET', redirect: 'error', headers: { accept: 'application/json' }, signal: expect.any(AbortSignal)
    });
    expect(result.checks.find(c => c.server === 'stripe')).toMatchObject({
      contract: true, state: 'unverified', authenticatedReadOnly: false,
      direct: false, relay: false, sandbox: false, revocation: false, fullAcceptance: false
    });
    expect(result.checks.find(c => c.server === 'neon')).toMatchObject({
      state: 'unverified', reason: 'no_verified_origin'
    });
    expect(result.allAccepted).toBe(false);
  });
  it.each([
    [403, 'blocked', 'access_protected'],
    [401, 'blocked', 'access_protected'],
    [404, 'unavailable', 'http_error'],
    [503, 'unavailable', 'http_error']
  ])('does not count HTTP %s as RTC reachability', async (status, state, reason) => {
    const result = await probe(async () => respond({}, status));
    expect(result.checks.find(c => c.server === 'stripe')).toMatchObject({ state, reason, httpStatus: status });
  });
  it('does not promote rtc:0 or a misleading JSON success response', async () => {
    const zero = await probe(async () => respond({ ...manifest, rtc: 0 }));
    expect(zero.checks.find(c => c.server === 'stripe')).toMatchObject({
      state: 'blocked', advertisedRtc: 0, contract: false
    });
    const html = await probe(async () => respond('<html>login</html>', 200, 'text/html'));
    expect(html.checks.find(c => c.server === 'stripe').state).toBe('blocked');
    const oversize = await probe(async () => respond('x'.repeat(34000)));
    expect(oversize.checks.find(c => c.server === 'stripe').reason).toBe('invalid_or_oversized_manifest');
    const failed = await probe(async () => { throw new Error('secret text'); });
    expect(JSON.stringify(failed)).not.toContain('secret');
    expect(failed.checks.find(c => c.server === 'stripe').state).toBe('unavailable');
  });
  it('only marks the specific authenticated direct read as ready, not whole-route acceptance', async () => {
    const authorize = vi.fn(async () => true);
    const result = await probe(async () => respond(manifest), { authorize });
    expect(authorize).toHaveBeenCalledWith('stripe', origin, manifest);
    expect(result.checks.find(c => c.server === 'stripe')).toMatchObject({
      state: 'ready', authenticatedReadOnly: true, direct: true,
      relay: false, sandbox: false, revocation: false, fullAcceptance: false
    });
    expect(result.allAccepted).toBe(false);
    const denied = await probe(async () => respond(manifest), { authorize: async () => { throw new Error('token'); } });
    expect(JSON.stringify(denied)).not.toContain('token');
    expect(denied.checks.find(c => c.server === 'stripe').state).toBe('unverified');
  });
  it('only accepts pinned public HTTPS origins; rejects credentials, queries and internal targets', () => {
    expect(parseFleetOrigins(JSON.stringify({stripe:origin}))).toEqual({stripe:origin});
    for (const bad of ['http://example.org','https://127.0.0.1','https://169.254.169.254',
      'https://localhost','https://example.org/path','https://example.org/?pass=bad',
      'https://x:y@example.org', 'https://[::1]']) {
      expect(() => parseFleetOrigins(JSON.stringify({stripe:bad}))).toThrow();
    }
    expect(() => parseFleetOrigins('[]')).toThrow();
    expect(() => parseFleetOrigins('{"../bad":"https://ok.org"}')).toThrow();
  });
  it('never accepts raw pass bytes or unsolicited read-test settings', () => {
    expect(parseReadTests('{"stripe":{"readTool":"stripe_admin_overview","passEnv":"READ_ONLY_PASS"}}'))
      .toEqual({stripe:{readTool:'stripe_admin_overview',passEnv:'READ_ONLY_PASS'}});
    for (const bad of ['{"stripe":{"readTool":"stripe_read","pass":"rtc_pass_unsafe"}}',
      '{"stripe":{"readTool":"stripe_read","passEnv":"test-bad"}}',
      '{"stripe":{"readTool":"../bad","passEnv":"GOOD"}}',
      '{"stripe":{"readTool":"stripe_read"}}']) {
      expect(() => parseReadTests(bad)).toThrow();
    }
  });
});
