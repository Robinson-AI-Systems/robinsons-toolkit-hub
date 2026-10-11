import { describe, expect, it } from 'vitest';
import { startFakeServer } from '../fake-server/server.js';
import { runConformance } from '../src/run.js';

describe('RTC conformance reference', () => {
  it('passes every available probe against the correct fake', async () => {
    const f = await startFakeServer();
    try {
      const report = await runConformance({ url: f.url, passes: f.passes });
      expect(report.checks.map((x) => x.name)).toContain('manifest.openapi');
      expect(report.checks.filter((x) => !x.ok)).toEqual([]);
      expect(report.ok).toBe(true);
    } finally { await f.close(); }
  });
});
