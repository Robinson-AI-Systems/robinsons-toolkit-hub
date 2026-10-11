import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
it('hourly cleanup stays owner gated with no GitHub token permissions', () => {
  const text = readFileSync('.github/workflows/relay-cleanup.yml', 'utf8');
  const workflow = parse(text);
  expect(workflow.on.schedule[0].cron).toBe('17 * * * *');
  expect(workflow.permissions).toEqual({});
  expect(workflow.jobs.cleanup.if).toContain("vars.RELAY_CLEANUP_URL != ''");
  expect(text).not.toContain('actions/checkout');
  expect(text).toContain("redirect: 'error'");
  expect(text).not.toContain('console.log(secret)');
});
