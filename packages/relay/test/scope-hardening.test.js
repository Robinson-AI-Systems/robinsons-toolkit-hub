import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { generateRelayKeys } from '../src/crypto.js';
import { validateServerUrl, createForwarder } from '../src/forward.js';
import { relaySettings } from '../src/runtime.js';

function config() {
  return { RELAY_REPOSITORY: 'test/relay',
    RELAY_WEBHOOK_SECRET: 'FAKE_' + randomBytes(32).toString('hex'),
    RELAY_GITHUB_TOKEN: 'fixture-token',
    ['RELAY_PRIVATE_KEY']: generateRelayKeys().privateKey.export({ format: 'der',
      type: 'pkcs8' }).toString('base64'),
    RELAY_SERVERS: JSON.stringify({ rtc: 'https://example.com' }),
    RELAY_BINDINGS: JSON.stringify({ 1: { actorId: 123, server: 'rtc' } }),
    RELAY_DATABASE_URL: 'postgresql://fixture@example.com/relay?sslmode=require' };
}

describe('D-4 hosted relay fixed public network and identity scope', () => {
  it('rejects private, metadata, loopback, documentation and internal destinations', () => {
    for (const host of [
      '127.0.0.1', '127.4.5.6', '127.1', '0.0.0.0', '10.0.0.12',
      '172.16.0.1', '172.31.250.1', '192.168.42.1', '169.254.169.254',
      '100.64.0.1', '198.18.0.1', '192.0.2.1', '198.51.100.1',
      '203.0.113.1', '224.0.0.1', '255.255.255.255', '[::1]',
      '[fd00::123]', '[fe80::1]', '[::ffff:127.0.0.1]',
      'localhost', 'metadata.google.internal', 'svc.internal',
      'hidden.local', 'a.localhost', 'example.test', 'srv.invalid'
    ]) {
      expect(() => validateServerUrl('https://' + host)).toThrow();
      expect(() => relaySettings({ ...config(),
        RELAY_SERVERS: JSON.stringify({ rtc: 'https://' + host }) })).toThrow();
    }
    for (const origin of ['http://public.example.com', 'https://rtc.example.com:8443',
      'https://rtc.example.com/token', 'https://rtc.example.com?pass=test',
      'https://a@rtc.example.com', 'https://rtc.example.com/#fragment'])
      expect(() => validateServerUrl(origin)).toThrow();
    expect(validateServerUrl('https://8.8.8.8')).toBe('https://8.8.8.8');
    expect(validateServerUrl('https://rtc.example.com')).toBe('https://rtc.example.com');
  });
  it('preserves explicit local fake-service tests without granting hosted loopback', () => {
    expect(validateServerUrl('http://localhost', true)).toBe('http://localhost');
    expect(validateServerUrl('http://127.0.0.1', true)).toBe('http://127.0.0.1');
    expect(validateServerUrl('http://[::1]', true)).toBe('http://[::1]');
    expect(validateServerUrl('http://127.0.0.1:32547', true)).toBe('http://127.0.0.1:32547');
    expect(() => validateServerUrl('https://public.example.com:8443', true)).toThrow();
    expect(() => validateServerUrl('https://169.254.169.254', true)).toThrow();
    expect(() => validateServerUrl('http://10.0.0.1', true)).toThrow();
  });
  it('does not contact a server when its URL is forbidden', async () => {
    let fetches = 0;
    expect(() => createForwarder({ servers: { rtc: 'https://169.254.169.254' },
      fetchImpl: async () => { fetches++; } })).toThrow();
    expect(fetches).toBe(0);
  });
  it('requires an exact one-issue-to-actor/server pair with no extra grant keys', () => {
    const env = config();
    const okay = { 1: { actorId: 123, server: 'rtc' },
      2: { actorId: 124, server: 'rtc' } };
    expect(Object.keys(relaySettings({ ...env, RELAY_BINDINGS: JSON.stringify(okay) }).bindings))
      .toEqual(['1', '2']);
    for (const bindings of [
      { 1: { actorId: 123, server: 'rtc', allowWrites: true } },
      { 1: { actorId: 123, server: 'rtc' }, 2: { actorId: 123, server: 'rtc' } },
      { 1: { actorId: 123, server: 'rtc', pass: 'unwanted' } },
      { 1: { actorId: 123, server: 'rtc' }, 2: { actorId: 1, server: 'other' } },
      { 1: [] }, { 1: { actorId: '123', server: 'rtc' } }
    ]) expect(() => relaySettings({ ...env, RELAY_BINDINGS: JSON.stringify(bindings) })).toThrow();
  });
});
