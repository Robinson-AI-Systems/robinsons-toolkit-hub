// K-3 private-package isolation proof. No real network, credentials or service SDK.
// npm pack and offline install must both work outside the hub workspace.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function exec(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, npm_config_offline: 'true', npm_config_audit: 'false',
      npm_config_fund: 'false', NODE_OPTIONS: '' }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    // Avoid dumping environment, machine state or future pass-bearing stderr.
    throw new Error('Offline core package consumer command failed (' +
      command.split(/[\\/]/).at(-1) + ', exit ' + result.status + ')');
  }
  return result.stdout.trim();
}

describe('K-3 packed core portable consumer', () => {
  it('packs only allowlisted source, installs offline, imports without sibling packages or secrets', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rt-core-isolated-'));
    try {
      const contents = JSON.parse(exec(npm, [
        'pack', '--workspace', 'packages/core', '--json',
        '--ignore-scripts', '--pack-destination', tmp
      ], root))[0];
      expect(contents.name).toBe('robinson-mcp-core');
      const packed = contents.files.map(f => f.path).sort();
      expect(packed).toEqual([
        'package.json', 'src/crypto.js', 'src/http.js', 'src/mcp-auth.js', 'src/oauth.js',
        'src/profiles.js', 'src/registry.js', 'src/write-contract-check.js'
      ].sort());
      expect(contents.entryCount).toBe(packed.length);
      const consumer = join(tmp, 'consumer');
      mkdirSync(consumer);
      exec(npm, ['install', '--no-save', '--package-lock=false', '--ignore-scripts',
        '--offline', '--no-audit', '--no-fund', join(tmp, contents.filename)], consumer);
      const code = `
        const [oauth, crypto, http, registry, profiles, write, auth] = await Promise.all([
          import('robinson-mcp-core/oauth'),
          import('robinson-mcp-core/crypto'),
          import('robinson-mcp-core/http'),
          import('robinson-mcp-core/registry'),
          import('robinson-mcp-core/profiles'),
          import('robinson-mcp-core/write-contract-check'),
          import('robinson-mcp-core/mcp-auth')
        ]);
        if (typeof oauth.randomToken(12) !== 'string') throw Error('oauth');
        if (typeof crypto.encryptSecret !== 'function') throw Error('crypto');
        if (http.publicOrigin({ PUBLIC_BASE_URL: 'https://example.test' }) !== 'https://example.test') throw Error('http');
        if (registry.mergeNamespaces([{ tools:[{name:'fake_read'}],handlers:{fake_read:()=>1} }]).tools.length !== 1) throw Error('registry');
        if (!profiles.isToolAllowed({name:'fake_read',writes:false,profiles:['read_only']},'read_only')) throw Error('profiles');
        if (typeof auth.createMcpBearerAuthenticator !== 'function') throw Error('auth');
        if (write.validateWriteDeclarations([{name:'fake_read',writes:false}]).length) throw Error('write');
        for(const banned of ['robinson-mcp-core/oauth-handlers', 'robinson-mcp-core/mcp-server']) {
          try { await import(banned); throw Error('unexpected export: ' + banned); }
          catch(e) { if(e.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw e; }
        }
        console.log('clean-core-consumer-ok');
      `;
      const result = exec(process.execPath, ['--input-type=module', '-e', code], consumer);
      expect(result).toBe('clean-core-consumer-ok');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
