import { describe, expect, it, vi } from 'vitest';
import { assertDistinctCredentialSlots, loadServers, parseEnvServers, passFor,
  RouteError } from '../src/config.js';
import { parsePinnedFleetInventory, parseFleetOrigins, probeRtcFleet } from '../src/fleet-probe.js';

const a='https://service-a.example.org', b='https://service-b.example.org';
describe('credentials remain exclusive to one configured server alias', () => {
  it('refuses two environment names with one normalized pass key', () => {
    expect(()=>parseEnvServers('one-two='+a+',one_two='+b)).toThrow(RouteError);
    expect(()=>assertDistinctCredentialSlots(['one-two','one_two'])).toThrow(RouteError);
    expect(parseEnvServers('one-two='+a+',another='+b).size).toBe(2);
    expect(passFor('one-two',{RTOOL_PASS_ONE_TWO:'example'})).toBe('example');
  });
  it('refuses collisions stored on disk or introduced through environment overlays', async () => {
    const reader=async()=>JSON.stringify({servers:{'one-two':a,'one_two':b}});
    await expect(loadServers({RTOOL_SERVERS:''},reader)).rejects.toThrow(RouteError);
    const safeReader=async()=>JSON.stringify({servers:{'one-two':a}});
    await expect(loadServers({RTOOL_SERVERS:'one_two='+b},safeReader))
      .rejects.toThrow(RouteError);
    const selected=await loadServers({RTOOL_SERVERS:'one-two='+b},safeReader);
    expect(selected.get('one-two')).toBe(b);
    expect(selected.size).toBe(1);
  });
  it('refuses collisions in both reviewed and temporary fleet inventory', () => {
    const pinned={version:1,servers:{stripe:a,github:b,vercel:null,neon:null,
      'google-workspace':a, google_workspace:b}};
    expect(()=>parsePinnedFleetInventory(JSON.stringify(pinned))).toThrow(RouteError);
    expect(()=>parseFleetOrigins(JSON.stringify({'one-two':a,'one_two':b})))
      .toThrow(RouteError);
  });
  it('does not fetch or use a TEST pass for either colliding alias', async () => {
    const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({
      rtc:1,server:'shared',prefix:'shared'
    }),{headers:{'content-type':'application/json'}}));
    const authorize=vi.fn(async()=>true);
    const r=await probeRtcFleet({origins:{'google-workspace':a,google_workspace:b,
      stripe:a},fetchImpl,authorize});
    for(const name of ['google-workspace','google_workspace']) {
      expect(r.checks.find(c=>c.server===name)).toMatchObject({
        state:'blocked',reason:'credential_alias_collision',
        authenticatedReadOnly:false,direct:false,fullAcceptance:false
      });
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1); // Unrelated stripe only
    expect(authorize).toHaveBeenCalledTimes(1);
  });
});
