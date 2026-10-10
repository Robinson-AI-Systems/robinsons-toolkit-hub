// Planted values are assembled at run time so this file itself never contains a key-shaped string.
// Shape copied from Robinson-AI-Systems/neon-mcp tests/unit/check-secrets.test.js @ d396fb4; hub rules per card K-0.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanFiles, scanText } from '../../scripts/check-secrets.mjs';

const labels = (text) => scanText(text).map((f) => f.label);
const A = (n) => 'a7Q9'.repeat(Math.ceil(n / 4)).slice(0, n);

describe('secret scan: planted hub secrets fail', () => {
  it('a pass in any variable that carries one', () => {
    expect(labels('RTOOL_PASS_STRIPE' + '=' + A(40))).toEqual(['secret assignment']);
    expect(labels('export RTC_PASS' + '="' + A(32) + '"')).toEqual(['secret assignment']);
    expect(labels('HUB_PASS' + ': ' + A(24))).toEqual(['secret assignment']);
  });
  it('a pass sent as a bearer header', () => {
    expect(labels('curl -H "Authorization: ' + 'Bearer ' + A(43) + '"')).toEqual(['bearer token']);
  });
  it('a relay private key (PEM block or variable) and the relay webhook secret', () => {
    expect(labels('-----BEGIN ' + 'PRIVATE KEY-----')).toEqual(['private key']);
    expect(labels('-----BEGIN ' + 'OPENSSH PRIVATE KEY-----')).toEqual(['private key']);
    expect(labels('RELAY_PRIVATE_KEY' + '=' + A(44))).toEqual(['secret assignment']);
    expect(labels('RELAY_WEBHOOK_SECRET' + '=' + A(32))).toEqual(['secret assignment']);
  });
  it('GitHub tokens of every kind', () => {
    for (const p of ['ghp', 'gho', 'ghu', 'ghs', 'ghr']) expect(labels(p + '_' + A(36))).toEqual(['GitHub token']);
    expect(labels('github' + '_pat_' + A(40))).toEqual(['GitHub token']);
    expect(labels('GH_TOKEN' + '=' + A(40))).toEqual(['secret assignment']);
  });
  it('the service keys of the servers behind the hub', () => {
    expect(labels('sk' + '_live_' + A(24))).toEqual(['Stripe live key']);
    expect(labels('sk' + '_live_FAKE' + A(20))).toEqual(['Stripe live key']); // never allowed, even "fake"
    expect(labels('rk' + '_test_' + A(24))).toEqual(['Stripe test key']);
    expect(labels('whsec' + '_' + A(32))).toEqual(['webhook secret']);
    expect(labels('napi' + '_' + A(64))).toEqual(['Neon API key']);
    expect(labels('npg' + '_' + A(12))).toEqual(['Neon role password']);
    expect(labels('vcp' + '_' + A(24))).toEqual(['Vercel token']);
    expect(labels('GOCSPX' + '-' + A(28))).toEqual(['Google client secret']);
    expect(labels('AIza' + A(35))).toEqual(['Google API key']);
  });
  it('encryption keys, passphrases, remote database URLs and infrastructure IDs', () => {
    expect(labels('TOKEN_ENCRYPTION_KEY' + '=' + A(44))).toEqual(['secret assignment']);
    expect(labels('ADMIN_PASSPHRASE' + '=' + A(20))).toEqual(['secret assignment']);
    expect(labels('postgresql' + '://u:p' + '@' + 'db.example' + '.org/hub')).toEqual(['database URL with password']);
    expect(labels('prj' + '_' + A(28))).toEqual(['Vercel ID']);
    expect(labels('ep-' + 'quiet-river-' + 'a1b2c3d4')).toEqual(['Neon endpoint ID']);
  });
  it('reports file, line and only the first 6 characters', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hub-secret-'));
    try {
      writeFileSync(join(dir, 'planted.txt'), 'line one\ntoken ' + 'ghp' + '_' + A(40) + '\n');
      const [hit] = scanFiles(['planted.txt'], { root: dir });
      expect(hit).toEqual({ path: 'planted.txt', label: 'GitHub token', line: 2, start: 'ghp_a7' });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('secret scan: fakes, references and local values pass', () => {
  it('FAKE values in every rule that allows them', () => {
    expect(scanText('RTOOL_PASS_STRIPE=FAKE' + A(30) + ' Authorization: Bearer FAKE' + A(30))).toEqual([]);
    expect(scanText('ghp_FAKE' + A(36) + ' ghs_FAKE' + A(36) + ' github_pat_FAKE' + A(36))).toEqual([]);
    expect(scanText('-----BEGIN FAKE PRIVATE KEY----- sk_test_FAKE' + A(20) + ' napi_FAKE' + A(30))).toEqual([]);
    expect(scanText('vcp_FAKE' + A(24) + ' whsec_FAKE' + A(20) + ' prj_FAKE' + A(24))).toEqual([]);
  });
  it('references and placeholders, not values', () => {
    expect(scanText('RTC_PASS=$RTC_PASS_FROM_SETUP_PAGE RTOOL_PASS_X=${{ env.Y_SOMETHING_LONG }}')).toEqual([]);
    expect(scanText('Authorization: Bearer <pass>  `RTOOL_PASS_<NAME>`  Bearer token')).toEqual([]);
    expect(scanText('format: postgresql://user:password@host/db (placeholder host)')).toEqual([]);
    expect(scanText('DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres')).toEqual([]);
    expect(scanText('postgresql://postgres:ci-only-not-a-secret@127.0.0.1:5432/postgres')).toEqual([]);
  });
});

describe('secret scan: the command', () => {
  it('fails (exit 1) on a planted file without echoing the value, and passes on this repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hub-secret-cli-'));
    try {
      const planted = join(dir, 'planted.env');
      writeFileSync(planted, 'RTOOL_PASS_NEON' + '=' + A(48) + '\n');
      let status = 0;
      let stderr = '';
      try { execFileSync(process.execPath, ['scripts/check-secrets.mjs', '--file', planted], { stdio: 'pipe' }); }
      catch (e) { status = e.status; stderr = String(e.stderr); }
      expect(status).toBe(1);
      expect(stderr).toMatch(/secret assignment/);
      expect(stderr).not.toContain(A(48));
      expect(execFileSync(process.execPath, ['scripts/check-secrets.mjs'], { encoding: 'utf8' })).toMatch(/Secret scan passed/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
