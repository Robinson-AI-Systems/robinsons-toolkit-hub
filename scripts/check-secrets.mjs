// Secret and infrastructure-ID scan over every tracked (and untracked, not ignored) file.
// Shape copied from Robinson-AI-Systems/neon-mcp scripts/check-secrets.mjs @ d396fb4 and vercel-mcp's rule list;
// hub rules per card K-0: passes (by the variables and header that carry them), relay private keys and webhook
// secrets, GitHub tokens, and every service key the servers behind the hub use.
// Prints only a label, the file, the line and the first 6 characters of a match — never the whole value.
//   node scripts/check-secrets.mjs              scan every file git lists (tracked + untracked, not ignored)
//   node scripts/check-secrets.mjs --file a b   scan the named files only
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'example.com', 'example.test']);
const hasFake = (s) => /fake/i.test(s);
// A value that is a reference, not a secret: `$VAR`, `${{ … }}`, `<placeholder>`, `…`.
const isReference = (s) => /^(\$|<|\.\.\.|…)/.test(s);
const localDbUrl = (s) => /^postgres(?:ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)[:/]/.test(s);
const digit = '(?=[a-z0-9]*[0-9])[a-z0-9]{6,}';

// Variables that carry a pass or a secret anywhere in the Robinson system (CONTRACT §2, BATCH-D D1/D4, BATCH-H H2).
const SECRET_VARS = [
  'RTOOL_PASS_[A-Z0-9_]+', 'RTC_PASS', 'HUB_PASS', 'RELAY_PRIVATE_KEY', 'RELAY_WEBHOOK_SECRET', 'GITHUB_WEBHOOK_SECRET',
  'TOKEN_ENCRYPTION_KEY', 'ADMIN_PASSPHRASE', 'DATABASE_URL', 'GITHUB_TOKEN', 'GH_TOKEN', 'STRIPE_SECRET_KEY',
  'NEON_API_KEY', 'VERCEL_TOKEN', 'GOOGLE_CLIENT_SECRET'
].join('|');

// [label, pattern, allowed(match) → true when the match is an accepted fake or a reference]
const RULES = [
  ['secret assignment', new RegExp(`\\b(${SECRET_VARS})\\s*[=:]\\s*['"]?([^\\s'"\`]{16,})`, 'g'),
    (m) => hasFake(m[2]) || isReference(m[2]) || localDbUrl(m[2])],
  ['bearer token', /\bBearer\s+([A-Za-z0-9._~+/=-]{24,})/g, (m) => hasFake(m[1])],
  ['private key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g, (m) => hasFake(m[0])],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/g, (m) => hasFake(m[0])],
  ['Stripe live key', /\b(?:sk|rk)_live_[A-Za-z0-9]{12,}/g, () => false],
  ['Stripe test key', /\b(?:sk|rk)_test_[A-Za-z0-9]{12,}/g, (m) => hasFake(m[0])],
  ['webhook secret', /\bwhsec_[A-Za-z0-9+/=]{12,}/g, (m) => hasFake(m[0])],
  ['Neon API key', /\bnapi_[A-Za-z0-9]{20,}/g, (m) => hasFake(m[0])],
  ['Neon role password', /\bnpg_[A-Za-z0-9]{8,}/g, (m) => hasFake(m[0])],
  ['Vercel token', /\bvc[pikar]_[A-Za-z0-9_-]{20,}/g, (m) => hasFake(m[0])],
  ['Google client secret', /\bGOCSPX-[A-Za-z0-9_-]{20,}/g, (m) => hasFake(m[0])],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g, (m) => hasFake(m[0])],
  ['database URL with password', /postgres(?:ql)?:\/\/[^\s/@:'"`]+:[^\s/@'"`]+@(\[[^\]]+\]|[A-Za-z0-9][A-Za-z0-9.-]*)/gi,
    // A host without a dot (`host`, `db`) is a placeholder in prose, not a reachable server.
    (m) => LOCAL_HOSTS.has(m[1].toLowerCase()) || !m[1].includes('.')],
  ['Vercel ID', /\b(?:prj|team|dpl)_[A-Za-z0-9]{20,}\b/g, (m) => hasFake(m[0])],
  ['Neon endpoint ID', new RegExp(`\\bep-[a-z]+-[a-z]+-${digit}\\b`, 'g'), (m) => hasFake(m[0])]
];

export function scanText(text) {
  const found = [];
  text.split('\n').forEach((line, index) => {
    for (const [label, pattern, allowed] of RULES) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        if (allowed(match)) continue;
        found.push({ label, line: index + 1, start: match[0].slice(0, 6) });
      }
    }
  });
  return found;
}

export function scanFiles(paths, { root = '.' } = {}) {
  const failures = [];
  for (const rel of paths) {
    const full = path.resolve(root, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
    const bytes = fs.readFileSync(full);
    if (bytes.includes(0)) continue;
    for (const hit of scanText(bytes.toString('utf8'))) failures.push({ path: rel, ...hit });
  }
  return failures;
}

export function listRepoFiles(root = '.') {
  return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
}

function main() {
  const fileMode = process.argv[2] === '--file';
  const paths = fileMode ? process.argv.slice(3) : listRepoFiles();
  const failures = scanFiles(paths);
  if (failures.length) {
    for (const f of failures) console.error(`Secret scan: ${f.label} in ${f.path}:${f.line} (starts "${f.start}…")`);
    console.error(`Secret scan FAILED: ${failures.length} finding(s). Use fake values (ghp_FAKE…, RTOOL_PASS_X=FAKE…, ` +
      '-----BEGIN FAKE PRIVATE KEY-----) or a reference such as $RTC_PASS.');
    process.exitCode = 1;
  } else {
    console.log(`Secret scan passed (${paths.length} files)`);
  }
}
if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) main();
