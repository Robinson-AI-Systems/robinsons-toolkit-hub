// Guards the CI rules in AGENTS.md: read-only token, no secrets, no pull_request_target, one aggregate gate.
// Copied from Robinson-AI-Systems/neon-mcp tests/unit/ci-workflow.test.js @ d396fb4.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const text = readFileSync('.github/workflows/ci.yml', 'utf8').split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
const wf = parse(text);

describe('.github/workflows/ci.yml', () => {
  it('runs on pull requests and pushes to main, never pull_request_target', () => {
    expect(Object.keys(wf.on).sort()).toEqual(['pull_request', 'push']);
    expect(wf.on.push.branches).toEqual(['main']);
    expect(text).not.toMatch(/pull_request_target/);
  });
  it('has a read-only token and uses no repository secrets', () => {
    expect(wf.permissions).toEqual({ contents: 'read' });
    expect(text).not.toMatch(/secrets\./);
  });
  it('runs every job on Node 24 with npm ci from the committed lockfile', () => {
    for (const [name, job] of Object.entries(wf.jobs)) {
      if (name === 'ci') continue;
      const steps = job.steps.map((s) => s.uses || s.run);
      expect(job.steps.find((s) => s.uses?.startsWith('actions/setup-node')).with['node-version']).toBe(24);
      expect(steps.some((s) => /^npm ci\b/.test(s))).toBe(true);
    }
  });
  it('the aggregate ci job always runs, needs every job and requires each to be success', () => {
    const jobs = Object.keys(wf.jobs).filter((n) => n !== 'ci');
    expect(jobs.sort()).toEqual(['check', 'db', 'stripe-source-owner-http', 'stripe-source-sql', 'unit']);
    expect(wf.jobs.ci.if).toBe('always()');
    expect([...wf.jobs.ci.needs].sort()).toEqual(jobs);
    const script = wf.jobs.ci.steps.map((s) => s.run).join('\n');
    for (const j of jobs) {
      const resultVariable = j.replaceAll("-", "_").toUpperCase();
      expect(script).toContain('test "$' + resultVariable + '" = success');
    }
  });
  it('pins real Stripe source and refuses unavailable source SQL evidence', () => {
    const job = wf.jobs['stripe-source-sql'];
    expect(job.services.postgres.image).toBe('public.ecr.aws/docker/library/postgres:17');
    const checkout = job.steps.find(s => s.uses?.startsWith('actions/checkout') &&
      s.with?.path === 'source-stripe');
    expect(checkout.with.repository).toBe('Robinson-AI-Systems/stripe-mcp');
    expect(checkout.with.ref).toMatch(/^[0-9a-f]{40}$/);
    expect(checkout.with['persist-credentials']).toBe(false);
    const compare = job.steps.find(s => typeof s.run === 'string' && s.run.includes('git rev-parse HEAD'));
    expect(compare.run).toContain(checkout.with.ref);
    const suite = job.steps.find(s => typeof s.run === 'string' && s.run.includes('npm run test:db'));
    for (const path of [
      'tests/db/oauth-persistent.test.js', 'tests/db/oauth.test.js',
      'tests/db/money-owner-approval.test.js', 'tests/db/money-reservation.test.js',
      'tests/db/owner-money-limit.test.js'
    ]) expect(suite.run).toContain(path);
    expect(suite.env.TEST_DATABASE_URL).toContain('@127.0.0.1:5432/');
  });
  it('runs original Stripe owner HTTP suites without substituting a fake hub owner session', () => {
    const job = wf.jobs['stripe-source-owner-http'];
    const checkout = job.steps.find(s => s.uses?.startsWith('actions/checkout') &&
      s.with?.path === 'source-stripe');
    const sqlCheckout = wf.jobs['stripe-source-sql'].steps.find(s =>
      s.uses?.startsWith('actions/checkout') && s.with?.path === 'source-stripe');
    expect(checkout.with.repository).toBe('Robinson-AI-Systems/stripe-mcp');
    expect(checkout.with.ref).toBe(sqlCheckout.with.ref);
    expect(checkout.with['persist-credentials']).toBe(false);
    expect(job.steps.find(s => typeof s.run === 'string' &&
      s.run.includes('git rev-parse HEAD')).run).toContain(checkout.with.ref);
    const suites = job.steps.find(s => typeof s.run === 'string' && s.run.includes('vitest run')).run;
    for (const suite of [
      'tests/unit/oauth-handlers.test.js', 'tests/unit/money-owner-approval.test.js',
      'tests/unit/owner-money-limit.test.js', 'tests/unit/setup-page.test.js'
    ]) expect(suites).toContain(suite);
    expect(job.services).toBeUndefined();
  });
  it('observes only fixed public RTC hosts with no pass or secrets and cannot certify a service', () => {
    const job = wf.jobs.check;
    const step = job.steps.find(s => s.name?.startsWith('Observe deployed RTC fleet'));
    expect(step.run).toBe('node scripts/probe-rtc-fleet.mjs --public-observe');
    expect(step.env).toBeUndefined();
    expect(step.continue_on_error).toBeUndefined();
    expect(job.permissions).toBeUndefined();
    expect(text).not.toMatch(/RTC_FLEET_READ_TESTS|RTC_FLEET_ORIGINS/);
    expect(wf.jobs.ci.needs).toContain('check');
  });
  it('the database job uses a throwaway localhost Postgres service', () => {
    expect(wf.jobs.db.services.postgres.image).toBe('public.ecr.aws/docker/library/postgres:17');
    expect(wf.jobs.db.steps.at(-1).env.TEST_DATABASE_URL).toMatch(/@127\.0\.0\.1:5432\//);
  });
});
