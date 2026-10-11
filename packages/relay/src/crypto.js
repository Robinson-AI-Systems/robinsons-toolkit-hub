// RTC GitHub relay envelopes. GitHub sees public key material and authenticated
// ciphertext only. All passes and symmetric reply keys remain inside encryption.
import { generateKeyPairSync, createPublicKey, diffieHellman, hkdfSync,
  createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';

const MAX_BYTES = 40 * 1024;
const WINDOW_MS = 5 * 60 * 1000;
const encoding = (value) => Buffer.from(value).toString('base64url');
const decoding = (value) => {
  if (typeof value !== 'string' || value.length > 200000 ||
      !/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('Invalid relay envelope');
  return Buffer.from(value, 'base64url');
};
const keyFor = (secret) => Buffer.from(hkdfSync('sha256', secret,
  Buffer.from('rtc-relay-v1'), Buffer.from('encrypted-request'), 32));
const aad = (id, createdAt) => Buffer.from('rtc-relay:' + id + ':' + createdAt);
const assertEnvelope = (envelope, now) => {
  if (!envelope || envelope.v !== 1 ||
    typeof envelope.id !== 'string' || !/^[0-9a-f-]{36}$/.test(envelope.id) ||
    !Number.isSafeInteger(envelope.createdAt) ||
    Math.abs(now - envelope.createdAt) > WINDOW_MS) {
    throw new Error('Invalid, stale or future relay request');
  }
};
function encrypt(key, payload, associated) {
  const bytes = Buffer.from(JSON.stringify(payload));
  if (bytes.length > MAX_BYTES) throw new Error('Relay message exceeds size cap');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(associated);
  const ct = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { iv: encoding(iv), ciphertext: encoding(ct), tag: encoding(cipher.getAuthTag()) };
}
function decrypt(key, box, associated) {
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, decoding(box.iv));
    decipher.setAAD(associated);
    decipher.setAuthTag(decoding(box.tag));
    const bytes = Buffer.concat([decipher.update(decoding(box.ciphertext)), decipher.final()]);
    if (bytes.length > MAX_BYTES) throw new Error('oversize');
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('Relay envelope authentication failed');
  }
}
export function generateRelayKeys() {
  const pair = generateKeyPairSync('x25519');
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}
export function exportRelayPublicKey(key) {
  return encoding(key.export({ format: 'der', type: 'spki' }));
}
export function importRelayPublicKey(serialized) {
  try { return createPublicKey({ key: decoding(serialized), format: 'der', type: 'spki' }); }
  catch { throw new Error('Invalid relay public key'); }
}
export function sealRequest({ publicKey, server, tool, args = {}, pass,
  now = Date.now() }) {
  if (!publicKey || typeof server !== 'string' || !/^[a-z][a-z0-9_-]{0,39}$/.test(server) ||
    typeof tool !== 'string' || !/^[A-Za-z0-9_.-]{1,200}$/.test(tool) ||
    !args || typeof args !== 'object' || Array.isArray(args) ||
    typeof pass !== 'string' || !/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(pass)) {
    throw new Error('Invalid relay request metadata or pass');
  }
  const pair = generateRelayKeys();
  const id = randomUUID();
  const replyKey = randomBytes(32);
  const shared = diffieHellman({ privateKey: pair.privateKey, publicKey });
  const plaintext = { server, tool, args, pass, replyKey: encoding(replyKey), id };
  const encrypted = encrypt(keyFor(shared), plaintext, aad(id, now));
  const request = { v: 1, id, createdAt: now, ephemeral: exportRelayPublicKey(pair.publicKey),
    ...encrypted };
  return { request, replyKey, id };
}
export function openRequest(envelope, privateKey, now = Date.now()) {
  assertEnvelope(envelope, now);
  try {
    const publicKey = importRelayPublicKey(envelope.ephemeral);
    const shared = diffieHellman({ privateKey, publicKey });
    const data = decrypt(keyFor(shared), envelope, aad(envelope.id, envelope.createdAt));
    if (!data || data.id !== envelope.id ||
      typeof data.pass !== 'string' ||
      !/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(data.pass) ||
      typeof data.server !== 'string' || typeof data.tool !== 'string' ||
      !data.args || typeof data.args !== 'object' || Array.isArray(data.args) ||
      decoding(data.replyKey).length !== 32) throw new Error('Invalid sealed payload');
    return { ...data, replyKey: decoding(data.replyKey) };
  } catch {
    throw new Error('Relay request rejected');
  }
}
export function sealReply(id, replyKey, result) {
  if (!/^[0-9a-f-]{36}$/.test(id || '') || !Buffer.isBuffer(replyKey) ||
      replyKey.length !== 32) throw new Error('Invalid reply key');
  return { v: 1, id, ...encrypt(replyKey, result, Buffer.from('rtc-reply:' + id)) };
}
export function openReply(box, id, replyKey) {
  if (!box || box.v !== 1 || box.id !== id ||
      !Buffer.isBuffer(replyKey) || replyKey.length !== 32) {
    throw new Error('Invalid relay reply identity');
  }
  return decrypt(replyKey, box, Buffer.from('rtc-reply:' + id));
}
