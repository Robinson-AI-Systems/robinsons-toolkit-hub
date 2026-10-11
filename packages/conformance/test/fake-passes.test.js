import { describe, expect, it } from 'vitest';
import { startFakeServer } from '../fake-server/server.js';
import { runConformance } from '../src/run.js';

describe('RTC conformance reference', () => {
  it('passes every available probe against the correct fake', async () => {
    const f = await startFakeServer();
    try {
      const report = await runConformance({ url: f.url, passes: f.passes });
      expect(report.checks.map((x) => x.name)).toContain('manifest.openapi');
      expect(report.checks.filter((x) => !x.ok && !x.skipped)).toEqual([]);
      expect(report.checks.find((x) => x.name === 'oauth.refresh_settings')).toMatchObject({ skipped: true, ok: false });
      expect(report.checks.find((x) => x.name === 'limits.two_instance')).toMatchObject({ skipped: true, ok: false });
      expect(report.ok).toBe(false);
    } finally { await f.close(); }
  });
});
