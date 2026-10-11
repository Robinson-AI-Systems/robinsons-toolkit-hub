import { describe, expect, it } from 'vitest';
import { startFakeServer } from '../fake-server/server.js';
import { runConformance } from '../src/run.js';
const cases = {
  'no-manifest': 'manifest',
  'write-ignores-dry-run': 'writes',
  'read-only-pass-can-write': 'passes.read_only',
  'key-in-result': 'safety',
  'oversize-without-handle': 'reads',
  'unprefixed-tool': 'catalog',
  'bad-error-envelope': 'safety',
  'refresh-drops-settings': 'oauth.refresh_settings'
};
describe('deliberate RTC violations', () => {
  for (const [fault, check] of Object.entries(cases)) {
    it(fault + ' fails ' + check + ' rather than passing silently', async () => {
      const f = await startFakeServer({ faults: [fault] });
      try {
        const result = await runConformance({ url: f.url, passes: f.passes, oauth: f.oauth });
        expect(result.ok).toBe(false);
        const failures = result.checks.filter((x) => !x.ok && !x.skipped);
        expect(failures.map((x) => x.name)).toEqual([check]);
        expect(failures[0].message).toMatch(/§[1-9]/);
      } finally { await f.close(); }
    });
  }
});
