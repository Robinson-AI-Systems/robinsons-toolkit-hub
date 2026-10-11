import { expect, it } from 'vitest';
import { startFakeServer } from '../fake-server/server.js';
import { runConformance } from '../src/run.js';

it('missing role passes are reported as skipped, not silently passing', async () => {
  const f = await startFakeServer();
  try {
    const result = await runConformance({ url: f.url, passes: { full: f.passes.full } });
    expect(result.ok).toBe(false);
    for (const name of ['passes.read_only', 'passes.expired', 'passes.revoked',
      'oauth.refresh_settings', 'limits.two_instance']) {
      expect(result.checks.find((x) => x.name === name)).toMatchObject({ ok: false, skipped: true });
    }
    expect(result.checks.find((x) => x.name === 'manifest').ok).toBe(true);
  } finally { await f.close(); }
});
