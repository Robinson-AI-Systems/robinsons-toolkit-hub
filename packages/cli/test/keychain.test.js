import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { startFakeServer } from '../../conformance/fake-server/server.js';
import { nativePlan, makeKeychain, addStoredPasses, runNative } from '../src/keychain.js';
import { readHiddenPass } from '../src/input.js';
import { runCLI } from '../src/commands.js';

function terminal() {
  let output = '', errors = '';
  return { out: { write: (v) => { output += v; } },
    err: { write: (v) => { errors += v; } },
    output: () => output, errors: () => errors };
}
const alias = 'RTOOL_' + 'PASS_FAKE';
describe('secure native keychain', () => {
  it('keeps pass out of subprocess argv and environment on Linux, macOS and Windows', () => {
    const fakePass = 'rtc_pass_' + 'Z'.repeat(43);
    for (const platform of ['linux', 'darwin', 'win32']) {
      for (const action of ['store', 'lookup', 'delete']) {
        const plan = nativePlan({ platform, action, name: 'fake',
          env: { PATH: '/usr/bin', HOME: '/tmp', GITHUB_TOKEN: fakePass,
            [alias]: fakePass } });
        expect(JSON.stringify(plan)).not.toContain(fakePass);
        expect(plan.env.GITHUB_TOKEN).toBeUndefined();
        expect(plan.env[alias]).toBeUndefined();
        expect(plan.command).toMatch(/^(secret-tool|security|powershell.exe)$/);
      }
    }
    expect(() => nativePlan({ name: '../escape', action: 'store' })).toThrow();
    expect(() => nativePlan({ name: 'valid', action: 'wrong' })).toThrow();
    expect(() => nativePlan({ name: 'valid', action: 'store', platform: 'sunos' })).toThrow();
  });
  it('validates pass format and treats missing credentials as capability unavailable', async () => {
    const log = [];
    const vault = makeKeychain({ platform: 'linux', env: {},
      run: async (plan, secret) => {
        log.push({ action: plan.args[0], secret });
        if (plan.args[0] === 'lookup') return { found: false, value: null };
        return { found: true, value: '' };
      } });
    await expect(vault.set('one', 'invalid')).rejects.toThrow(/format/);
    const pass = 'rtc_pass_' + 'Q'.repeat(43);
    await vault.set('one', pass);
    expect(log[0]).toMatchObject({ action: 'store', secret: pass });
    expect(await vault.get('one')).toBe(null);
    expect(await vault.delete('one')).toBe(true);
    const failing = { get: async () => { throw new Error('unavailable'); } };
    const env = { [alias]: pass };
    const withPasses = await addStoredPasses(new Map([['fake', 'https://localhost']]), env, failing);
    expect(withPasses[alias]).toBe(pass);
  });
  it('does not print or persist the pass during OS-vault CLI login and logout', async () => {
    const f = await startFakeServer();
    const term = terminal();
    const env = { RTOOL_SERVERS: 'one=' + f.url };
    const stored = new Map();
    const vault = {
      get: async (name) => stored.get(name) || null,
      set: async (name, pass) => { stored.set(name, pass); },
      delete: async (name) => stored.delete(name)
    };
    const run = (args, passReader) => runCLI(args, {
      env, out: term.out, err: term.err, keychain: vault, passReader });
    try {
      expect(await run(['login', 'one'], async () => f.passes.full)).toBe(0);
      expect(stored.get('one')).toBe(f.passes.full);
      expect(await run(['whoami', 'one'])).toBe(0);
      expect(await run(['servers'])).toBe(0);
      expect(term.output()).toContain('passConfigured');
      expect(term.output()).not.toContain(f.passes.full);
      expect(await run(['logout', 'one'])).toBe(0);
      expect(stored.size).toBe(0);
      expect(await run(['whoami', 'one'])).toBe(6);
      expect(await run(['login', 'one'], async () => f.passes.expired)).toBe(5);
      expect(stored.size).toBe(0);
      expect(term.errors()).not.toContain(f.passes.expired);
    } finally { await f.close(); }
  });
  it('accepts a hidden stdin pass without writing the secret to terminal output', async () => {
    const stream = new PassThrough();
    let output = '';
    const promise = readHiddenPass({ input: stream, error: { write: (x) => { output += x; } } });
    stream.end('rtc_pass_' + 'N'.repeat(43) + '\n');
    const result = await promise;
    expect(result).toHaveLength(52);
    expect(output).not.toContain(result);
  });
});
