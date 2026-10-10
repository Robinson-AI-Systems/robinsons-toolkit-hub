// The docs check (DRIFT-PROTOCOL B minimum) and the work-index validator really fail when they should.
import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requiredDocs } from '../../scripts/check-docs-updated.mjs';

const CARD = 'a PR card or docs/pr-cards/work-index.json';

describe('check-docs-updated', () => {
  it('requires STATUS and a card when api/, packages/ or scripts/ change', () => {
    expect(requiredDocs(['scripts/x.mjs'])).toEqual(['docs/STATUS.md', CARD]);
    expect(requiredDocs(['packages/conformance/src/run.js', 'docs/STATUS.md'])).toEqual([CARD]);
    expect(requiredDocs(['api/relay/github.js', 'docs/STATUS.md', 'docs/pr-cards/D-3.md'])).toEqual([]);
  });
  it('does not count the README or the validator as a card, and ignores docs-only PRs', () => {
    expect(requiredDocs(['packages/x/a.js', 'docs/STATUS.md', 'docs/pr-cards/README.md'])).toEqual([CARD]);
    expect(requiredDocs(['docs/PLAN.md', 'tests/unit/x.test.js'])).toEqual([]);
  });
  it('a contract change always needs a DECISIONS entry, even with the exception line', () => {
    expect(requiredDocs(['docs/CONTRACT.md'])).toEqual(['docs/DECISIONS.md']);
    expect(requiredDocs(['docs/CONTRACT.md', 'docs/DECISIONS.md'])).toEqual([]);
    expect(requiredDocs(['docs/CONTRACT.md'], 'Docs-update: not needed — wording only')).toEqual(['docs/DECISIONS.md']);
  });
  it('accepts an explicit code exception with a real reason only', () => {
    expect(requiredDocs(['scripts/x.mjs'], 'Docs-update: not needed — formatting only change')).toEqual([]);
    expect(requiredDocs(['scripts/x.mjs'], 'Docs-update: not needed — x')).not.toEqual([]);
  });
});

describe('docs/pr-cards/validate-index.py', () => {
  // Runs the real validator on a copy of docs/ so a broken index can be planted without touching the repository.
  function runOn(mutate) {
    const dir = mkdtempSync(join(tmpdir(), 'hub-index-'));
    try {
      cpSync('docs', join(dir, 'docs'), { recursive: true });
      for (const f of ['AGENTS.md', 'README.md']) cpSync(f, join(dir, f));
      const indexPath = join(dir, 'docs/pr-cards/work-index.json');
      const index = JSON.parse(readFileSync(indexPath, 'utf8'));
      mutate(index);
      writeFileSync(indexPath, JSON.stringify(index, null, 2));
      return spawnSync('python3', [join(dir, 'docs/pr-cards/validate-index.py')], { cwd: dir, encoding: 'utf8' });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  it('passes on the repository index', () => {
    const res = spawnSync('python3', ['docs/pr-cards/validate-index.py'], { encoding: 'utf8' });
    expect(res.status, res.stdout + res.stderr).toBe(0);
    expect(res.stdout).toMatch(/work-index OK/);
  });
  it('fails a missing prerequisite, a dependency cycle and a lost acceptance unit', () => {
    const missing = runOn((ix) => { ix.cards.find((c) => c.id === 'K-2').dependencies.push('K-99'); });
    expect(missing.status).toBe(1);
    expect(missing.stdout).toMatch(/K-2: missing prerequisite K-99/);
    const cycle = runOn((ix) => { ix.cards.find((c) => c.id === 'K-0').dependencies.push('K-2'); });
    expect(cycle.status).toBe(1);
    expect(cycle.stdout).toMatch(/dependency cycle/);
    const lost = runOn((ix) => { ix.cards = ix.cards.filter((c) => c.id !== 'K-0'); });
    expect(lost.status).toBe(1);
    expect(lost.stdout).toMatch(/missing=\['K-0'\]/);
  });
});
