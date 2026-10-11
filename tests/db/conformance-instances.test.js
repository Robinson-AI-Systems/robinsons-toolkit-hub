import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openIsolatedSchema } from './isolated-schema.js';
import { startFakeServer } from '../../packages/conformance/fake-server/server.js';
import { verifyTwoInstanceRateLimit } from '../../packages/conformance/src/rate-limit.js';
import { runConformance } from '../../packages/conformance/src/run.js';

const instanceFile = fileURLToPath(new URL('../../packages/conformance/fake-server/instance.js', import.meta.url));
async function launch(db, passes, mode, limit) {
  const child = spawn(process.execPath, [instanceFile], { stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, RTC_TEST_PASSES_JSON: JSON.stringify(passes),
      RTC_TEST_LIMIT: String(limit), RTC_TEST_MODE: mode, RTC_TEST_DB_URL: db.url, RTC_TEST_SCHEMA: db.schema } });
  const url = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('RTC fake instance startup timed out')), 8000);
    child.once('error', (e) => { clearTimeout(timer); reject(e); });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error('RTC fake child exited ' + code)); });
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('\n')) { clearTimeout(timer); resolve(output.split('\n')[0]); }
    });
  });
  return { url, async close() {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
  } };
}

describe('RTC shared limit across two actual server processes', () => {
  it('atomic Postgres passes, per-process memory definitely overallows', async () => {
    const db = await openIsolatedSchema();
    const local = await startFakeServer();
    const running = [];
    try {
      const memory = await Promise.all([
        launch(db, local.passes, 'memory', 12), launch(db, local.passes, 'memory', 12)
      ]);
      running.push(...memory);
      await expect(verifyTwoInstanceRateLimit({
        urls: memory.map((x) => x.url), pass: local.passes.full, limit: 12
      })).rejects.toThrow(/§2: shared rate limit/);
      const shared = await Promise.all([
        launch(db, local.passes, 'postgres', 12), launch(db, local.passes, 'postgres', 12)
      ]);
      running.push(...shared);
      const report = await runConformance({ url: local.url, passes: local.passes, oauth: local.oauth,
        instances: { urls: shared.map((x) => x.url), pass: local.passes.full, limit: 12 } });
      expect(report.checks.filter((x) => !x.ok)).toEqual([]);
      expect(report.ok).toBe(true);
    } finally {
      await Promise.all(running.map((x) => x.close()));
      await local.close();
      await db.close();
    }
  });
});
