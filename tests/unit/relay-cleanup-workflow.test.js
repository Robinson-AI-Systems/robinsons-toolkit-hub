import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
it('hourly cleanup stays owner gated with no GitHub token permissions', () => {
  const text = readFileSync('.github/workflows/relay-cleanup.yml', 'utf8');
  const workflow = parse(text);
  expect(workflow.on.schedule[0].cron).toBe('17 * * * *');
  expect(workflow.permissions).toEqual({});
  expect(workflow.jobs.cleanup.if).toContain("vars.RELAY_CLEANUP_URL != ''");
  expect(text).not.toContain('actions/checkout');
  expect(workflow.jobs.cleanup.steps[0].with['node-version']).toBe(24);
  const source = text.split("node --input-type=module - <<'NODE'\n")[1].split('          NODE')[0];
  expect(spawnSync(process.execPath, ['--input-type=module', '--check'], { input: source }).status).toBe(0);
  expect(text).toContain("redirect: 'error'");
  expect(text).not.toContain('console.log(secret)');
});
