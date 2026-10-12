import { describe, expect, it, vi } from 'vitest';
import { probeRtcFleet } from '../src/fleet-probe.js';

const first = 'https://rtc-a.example.org';
const second = 'https://rtc-b.example.org';
function reply(prefix, server) {
  return new Response(JSON.stringify({ rtc: 1, prefix, server }), {
    headers: { 'content-type': 'application/json' }
  });
}
const pick = (result, name) => result.checks.find(c => c.server === name);
describe('RTC deployed origin and service-identity collision preflight', () => {
  it('blocks duplicate fixed origins before any protected read, not merely at final acceptance', async () => {
    const authorize = vi.fn(async () => true);
    const fetchImpl = vi.fn(async () => reply('shared', 'same-service'));
    const result = await probeRtcFleet({ origins: {stripe:first,github:first},
      fetchImpl, authorize });
    for (const name of ['stripe','github']) {
      expect(pick(result,name)).toMatchObject({ state:'blocked',
        reason:'duplicate_deployed_origin', authenticatedReadOnly:false,
        direct:false, fullAcceptance:false });
    }
    expect(authorize).not.toHaveBeenCalled();
    expect(result.allAccepted).toBe(false);
  });
  it('rejects unrelated servers claiming an identical tool prefix across different URLs', async () => {
    const authorize = vi.fn(async () => true);
    const result = await probeRtcFleet({ origins: { stripe:first, github:second },
      fetchImpl:async url=>reply('collision',url.startsWith(first)?'alpha':'beta'),
      authorize });
    expect(pick(result,'stripe').reason).toBe('rtc_prefix_identity_collision');
    expect(pick(result,'github').reason).toBe('rtc_prefix_identity_collision');
    expect(authorize).not.toHaveBeenCalled();
  });
  it('allows distinct prefixes and retains each service independent authenticated-read result', async () => {
    const authorize = vi.fn(async name => name === 'stripe');
    const result = await probeRtcFleet({ origins: { stripe:first, github:second },
      fetchImpl:async url=>url.startsWith(first)?reply('alpha','service-alpha'):
        reply('beta','service-beta'), authorize });
    expect(pick(result,'stripe')).toMatchObject({state:'ready',direct:true,relay:false,
      sandbox:false,revocation:false,fullAcceptance:false});
    expect(pick(result,'github')).toMatchObject({state:'unverified',direct:false});
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(result.allAccepted).toBe(false);
  });
  it('permits two origins for one declared server prefix, without falsely certifying any route', async () => {
    const authorize = vi.fn(async () => false);
    const result = await probeRtcFleet({ origins: {stripe:first,github:second},
      fetchImpl:async()=>reply('same','server-one'),authorize });
    expect(pick(result,'stripe').reason).toBe('read_only_auth_unverified');
    expect(pick(result,'github').reason).toBe('read_only_auth_unverified');
    expect(authorize).toHaveBeenCalledTimes(2);
  });
  it('never performs authenticated reads for a collision even if a manifest arrived last', async () => {
    const authorize=vi.fn(async()=>true);
    const result=await probeRtcFleet({origins:{stripe:first,github:second},
      fetchImpl:async url=>reply('x',url.startsWith(first)?'one':'two'),
      authorize});
    expect(result.checks.filter(c=>c.authenticatedReadOnly)).toEqual([]);
    expect(authorize).not.toHaveBeenCalled();
  });
});
