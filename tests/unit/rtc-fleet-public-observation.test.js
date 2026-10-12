// Public mode is a deployment observation only, never credential-backed acceptance.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parsePinnedFleetInventory, REQUIRED_RTC_SERVERS } from '../../packages/cli/src/fleet-probe.js';

const script = readFileSync('scripts/probe-rtc-fleet.mjs', 'utf8');
const inventory = readFileSync('docs/rtc-fleet-origins.json', 'utf8');

describe('CI RTC public observation is intentionally weaker than D-4 TEST acceptance', () => {
  it('reads only reviewed pinned public origins and preserves unconfigured servers', () => {
    const hosts = parsePinnedFleetInventory(inventory);
    expect(Object.keys(hosts).sort()).toEqual(['github', 'google-workspace', 'stripe']);
    expect(REQUIRED_RTC_SERVERS.filter(name => !Object.hasOwn(hosts, name)).sort())
      .toEqual(['neon', 'vercel']);
    expect(script).toContain('const origins = publicObserve ? pinned :');
    expect(script).toContain('const tests = authorized ? parseReadTests');
  });
  it('cannot load remote TEST passes or authorize under --public-observe', () => {
    expect(script).toContain("const authorized = process.argv[2] === '--authorized-read-only'");
    expect(script).toContain("const publicObserve = process.argv[2] === '--public-observe'");
    expect(script).toContain('authorize: authorized ?');
    expect(script).toContain('process.exitCode = publicObserve ? 0');
    const denied = spawnSync(process.execPath, ['scripts/probe-rtc-fleet.mjs', '--public-observe', '--authorized-read-only'], {
      encoding: 'utf8', timeout: 3000,
      env: { ...process.env, RTC_FLEET_READ_TESTS: 'not JSON' }
    });
    expect(denied.status).toBe(2);
    expect(denied.stdout).toBe('');
    expect(denied.stderr).not.toContain('not JSON');
  });
  it('refuses a malformed pinned inventory instead of accepting generic hosts', () => {
    expect(() => parsePinnedFleetInventory('{"version":1,"servers":{"stripe":"http://localhost"}}')).toThrow();
  });
});
