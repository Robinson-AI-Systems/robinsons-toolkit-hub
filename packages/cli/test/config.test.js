import { describe, expect, it } from 'vitest';
import { loadServers, parseEnvServers, RouteError, validateUrl } from '../src/config.js';
describe('rtool config safely chooses server routes', () => {
  it('allows HTTPS and localhost HTTP only, with no embedded secret or query', () => {
    expect(validateUrl('https://example.test')).toBe('https://example.test');
    expect(validateUrl('http://127.0.0.1:4012')).toBe('http://127.0.0.1:4012');
    for (const url of ['http://remote.example.test', 'https://name:pass@example.test',
      'https://example.test/?token=x', 'file:///tmp/file']) {
      expect(() => validateUrl(url)).toThrow(RouteError);
    }
  });
  it('rejects duplicate aliases and malformed environment values', () => {
    expect(() => parseEnvServers('one=https://example.test,one=https://example.test')).toThrow();
    expect(() => parseEnvServers('invalid value')).toThrow();
  });
  it('loads URL-only config, overrides by env, without storing or displaying pass values', async () => {
    const env = { XDG_CONFIG_HOME: '/tmp/unused', RTOOL_SERVERS: 'one=https://override.example.test',
      RTOOL_PASS_ONE: 'FAKE' + 'x'.repeat(50) };
    const reader = async () => JSON.stringify({ servers: {
      one: 'https://old.example.test', two: 'https://two.example.test' } });
    const loaded = await loadServers(env, reader);
    expect(loaded.get('one')).toBe('https://override.example.test');
    expect(loaded.get('two')).toBe('https://two.example.test');
    expect(JSON.stringify([...loaded])).not.toContain(env.RTOOL_PASS_ONE);
  });
});
