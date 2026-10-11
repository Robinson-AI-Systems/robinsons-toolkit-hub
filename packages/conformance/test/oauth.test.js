import { describe, expect, it } from 'vitest';
import { startFakeServer } from '../fake-server/server.js';
import { verifyRefreshSettings } from '../src/oauth.js';

describe('OAuth refresh conformance', () => {
  it('preserves profile, listing, allowed areas, mode and account', async () => {
    const f = await startFakeServer();
    try {
      expect(await verifyRefreshSettings(f.oauth)).toEqual({ preserved: true });
    } finally { await f.close(); }
  });
  it('catches a refresh that widens access to full/live', async () => {
    const f = await startFakeServer({ faults: ['refresh-drops-settings'] });
    try {
      await expect(verifyRefreshSettings(f.oauth)).rejects.toThrow(/§2: OAuth refresh changed profile/);
    } finally { await f.close(); }
  });
});
