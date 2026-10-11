import { describe, expect, it } from 'vitest';
import { generateRelayKeys, sealRequest, openRequest,
  sealReply, openReply, exportRelayPublicKey, importRelayPublicKey } from '../src/crypto.js';

describe('RTC encrypted relay envelopes', () => {
  const pass = 'rtc_pass_' + 'R'.repeat(43);
  it('seals a pass, tool and reply key with X25519 and authenticates both directions', () => {
    const keys = generateRelayKeys();
    const serialized = exportRelayPublicKey(keys.publicKey);
    const sealed = sealRequest({ publicKey: importRelayPublicKey(serialized),
      server: 'stripe', tool: 'stripe_read_customer', args: { id: 'fake-123' }, pass });
    const text = JSON.stringify(sealed.request);
    expect(text).not.toContain(pass);
    expect(text).not.toContain('stripe_read_customer');
    expect(text).not.toContain('fake-123');
    expect(text).not.toContain(sealed.replyKey.toString('base64url'));
    const opened = openRequest(sealed.request, keys.privateKey);
    expect(opened).toMatchObject({ server: 'stripe', tool: 'stripe_read_customer', pass,
      args: { id: 'fake-123' } });
    expect(opened.replyKey.equals(sealed.replyKey)).toBe(true);
    const response = sealReply(sealed.id, opened.replyKey, { ok: true, result: { found: 1 } });
    expect(JSON.stringify(response)).not.toContain(pass);
    expect(openReply(response, sealed.id, sealed.replyKey)).toMatchObject({ ok: true });
    expect(() => openReply(response, 'wrong-id', sealed.replyKey)).toThrow();
  });
  it('fails closed for wrong key, tamper, old/future timestamp and invalid pass', () => {
    const keys = generateRelayKeys();
    const other = generateRelayKeys();
    const now = Date.now();
    const sealed = sealRequest({ publicKey: keys.publicKey, server: 'one',
      tool: 'one_read', args: {}, pass, now });
    expect(() => openRequest(sealed.request, other.privateKey, now)).toThrow();
    const altered = { ...sealed.request, ciphertext:
      sealed.request.ciphertext.replace(/^./, (x) => x === 'A' ? 'B' : 'A') };
    expect(() => openRequest(altered, keys.privateKey, now)).toThrow();
    expect(() => openRequest(sealed.request, keys.privateKey, now + 301000)).toThrow(/stale/);
    expect(() => openRequest(sealed.request, keys.privateKey, now - 301000)).toThrow(/future/);
    expect(() => sealRequest({ publicKey: keys.publicKey, server: 'one',
      tool: 'one_read', pass: 'invalid' })).toThrow();
  });
});
