import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyRelayIngress } from '../../../scripts/relay-webhook-probe.mjs';

const origin = 'https://relay.example.test';
const secret = 'synthetic-owner-secret-not-from-real-environment-123';
const env = { RELAY_REPOSITORY: 'owner/private-relay', RELAY_WEBHOOK_SECRET: secret,
  RELAY_EXPECTED_INGRESS_ORIGIN: origin,
  RELAY_INGRESS_TEST_URL: origin + '/api/relay/github' };

function fixture(replyFor) {
  const seen = [];
  return { seen, fetchImpl: async (url, options) => {
    const data = JSON.parse(options.body.toString());
    const digest = createHmac('sha256', secret).update(options.body).digest('hex');
    const signed = options.headers['x-hub-signature-256'] === 'sha256=' + digest;
    seen.push({ url: String(url), options, signed, data });
    const reply = replyFor ? replyFor({ signed, options }) :
      (signed ? [202, 'ignored'] : [401, 'invalid_signature']);
    return Response.json({ code: reply[1] }, { status: reply[0] });
  } };
}

async function run(options) {
  let output = '';
  const exit = await verifyRelayIngress({
    args: ['--authorized-ingress-test'], env,
    write: value => { output += value; }, ...options
  });
  return { exit, report: JSON.parse(output), output };
}

describe('D-4 safe signed Vercel webhook ingress verification', () => {
  it('proves signed harmless event is ignored and corrupted signature denied', async () => {
    const mock = fixture();
    const x = await run(mock);
    expect(x.exit).toBe(0);
    expect(x.report).toMatchObject({ ok: true, code: 'signed_ingress_verified', rtcCalls: 0 });
    expect(mock.seen.map(v => v.signed)).toEqual([true, false]);
    for (const event of mock.seen) {
      expect(event.data).toMatchObject({ action: 'edited', issue: { number: 0 } });
      expect(event.options.method).toBe('POST');
      expect(event.options.redirect).toBe('error');
      expect(event.options.headers['x-github-event']).toBe('issue_comment');
      expect(x.output).not.toContain(secret);
      expect(x.output).not.toContain(event.options.headers['x-hub-signature-256']);
    }
  });
  it('rejects unsigned admission, fake accepted signatures and protected ingress HTML', async () => {
    for (const replyFor of [
      () => [202, 'ignored'],
      ({ signed }) => signed ? [401, 'unauthorized'] : [401, 'invalid_signature'],
      ({ signed }) => signed ? [202, 'ignored'] : [200, 'ok'],
      () => [503, 'relay_not_configured']
    ]) {
      const x = await run(fixture(replyFor));
      expect(x.exit).toBe(1);
      expect(x.report.ok).toBe(false);
    }
    const x = await run({ fetchImpl: async () => new Response('<html>SSO</html>', { status: 401 }) });
    expect(x.exit).toBe(1);
    expect(x.report.code).toBe('ingress_unreachable_or_unverified');
  });
  it('requires explicit approval and locked expected HTTPS route before network access', async () => {
    for (const patch of [
      { args: [] }, { env: { ...env, RELAY_WEBHOOK_SECRET: '' } },
      { env: { ...env, RELAY_INGRESS_TEST_URL: 'http://relay.example.test/api/relay/github' } },
      { env: { ...env, RELAY_INGRESS_TEST_URL: origin + '/api/relay/cleanup' } },
      { env: { ...env, RELAY_INGRESS_TEST_URL: origin + '/api/relay/github?other=token' } },
      { env: { ...env, RELAY_INGRESS_TEST_URL: 'https://wrong.example.test/api/relay/github' } },
      { env: { ...env, RELAY_INGRESS_TEST_URL: origin + '/api/relay/github#fragment' } },
      { env: { ...env, RELAY_INGRESS_TEST_URL: origin + '/api/relay/github?x-vercel-protection-bypass=short' } }
    ]) {
      const mock = fixture();
      const x = await run({ ...mock, ...patch });
      expect(x.exit).toBe(1);
      expect(mock.seen).toHaveLength(0);
    }
  });
  it('does not report a protected bypass value, even when used', async () => {
    const token = 'synthetic-public-test-bypass-token-' + 'x'.repeat(32);
    const mock = fixture();
    const x = await run({ ...mock, env: { ...env,
      RELAY_INGRESS_TEST_URL: env.RELAY_INGRESS_TEST_URL + '?x-vercel-protection-bypass=' + token } });
    expect(x.exit).toBe(0);
    expect(mock.seen).toHaveLength(2);
    expect(x.output).not.toContain(token);
  });
});
