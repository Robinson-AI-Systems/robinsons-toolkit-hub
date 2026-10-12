// Portable single-use encrypted-secret persistence; the server owns AAD, route and row mappings.
// Existing service ciphertext MUST be consumed with the identical AAD and key, never reinterpreted.
import { randomBytes } from 'node:crypto';
import { encryptSecret, decryptSecret } from './crypto.js';

// A service chooses the route shape, but must link to this newly issued secret.
// Never normalize a service-provided setup link to another path/authority.
function safeSetupPath(path, id) {
  if (typeof path !== 'string' || !/^\/(?!\/)[^\s#]*$/.test(path) || !path.includes(id)) {
    return false;
  }
  const pathname = path.split('?')[0];
  if (pathname.includes('\\') || pathname.includes('//') ||
      /%(?:2e|2f|5c)/i.test(pathname) ||
      pathname.split('/').some(segment => segment === '.' || segment === '..')) {
    return false;
  }
  try {
    const url = new URL(path, 'https://core.invalid');
    if (url.origin !== 'https://core.invalid' || url.pathname !== pathname) return false;
    // The issued identifier must be an entire route segment or an entire query
    // value. A prefix/suffix/key-name hit is not a usable one-time reveal URL.
    // Multiple matches also make the service's selector ambiguous.
    const pathMatches = pathname.split('/').filter(segment => segment === id).length;
    const queryEntries = [...url.searchParams.entries()];
    const queryMatches = queryEntries.filter(([, value]) => value === id);
    // A single matching value inside two values of the same parameter is not
    // an unambiguous service selector (URLSearchParams.get picks the first).
    // Decode names before comparison, so %73how and show cannot bypass it.
    if (queryMatches.some(([key]) => url.searchParams.getAll(key).length !== 1)) {
      return false;
    }
    return pathMatches + queryMatches.length === 1;
  } catch { return false; }
}

// SQL must consume atomically, but a returned row must not be executable or
// silently refer to another secret. Normalize own data descriptors before AAD.
function consumedRow(row, id) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(row)) ||
      Object.getOwnPropertySymbols(row).length) {
    throw new TypeError('Invalid consumed secret binding');
  }
  const plain=Object.create(null);
  for (const [key, field] of Object.entries(Object.getOwnPropertyDescriptors(row))) {
    if (['__proto__','constructor','prototype'].includes(key) ||
        !field.enumerable || !Object.hasOwn(field,'value')) {
      throw new TypeError('Invalid consumed secret binding');
    }
    plain[key]=field.value;
  }
  if ((plain.id !== undefined && plain.id !== id) ||
      typeof plain.ciphertext !== 'string' || !plain.ciphertext.startsWith('v1.') ||
      !['test','live'].includes(plain.mode) ||
      typeof plain.kind !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(plain.kind)) {
    throw new TypeError('Invalid consumed secret binding');
  }
  return Object.freeze(plain);
}

// Defensive second-line expiry guard for source SQL rows that include an
// expiration. The service must still atomically consume only unexpired rows:
// absence of a timestamp here is NOT proof that its SQL policy ran.
function assertConsumedExpiry(row, now) {
  const names=['expiresAt','expires_at'].filter(name=>Object.hasOwn(row,name));
  if (!names.length) return;
  const clock=now();
  if (!Number.isSafeInteger(clock) || clock<0 || clock>8640000000000000) {
    throw new TypeError('Invalid consumed secret clock');
  }
  let expected=null;
  for (const name of names) {
    let stamp;
    try { stamp=Date.prototype.getTime.call(row[name]); }
    catch { throw new TypeError('Invalid consumed secret expiry'); }
    if (!Number.isSafeInteger(stamp) || stamp<=clock ||
        expected!==null && stamp!==expected) {
      throw new TypeError('Expired or inconsistent consumed secret expiry');
    }
    expected=stamp;
  }
}

export function createOneTimeSecretStore({ db, encryptionKey, contextFor, setupPathFor, accountFromRow,
  now = Date.now }) {
  if (typeof db?.addOneTimeSecret !== 'function' || typeof db?.consumeOneTimeSecret !== 'function' ||
      typeof contextFor !== 'function' || typeof setupPathFor !== 'function' ||
      typeof accountFromRow !== 'function' || typeof now !== 'function') {
    throw new TypeError('Durable atomic store and service-specific bindings are required');
  }
  if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) {
    throw new TypeError('Explicit 32-byte encryption key required');
  }
  // Never retain an alias to an owner-owned mutable Buffer. Key rotation is a
  // new authenticated store instance, not mutation of an active key handle.
  const key=Buffer.from(encryptionKey);
  return Object.freeze({
    async issue({ account = null, mode = 'test', kind, secret }) {
      if (typeof kind !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(kind) ||
          typeof secret !== 'string' || !secret) {
        throw new TypeError('Secret type and value are required');
      }
      if ((account !== null && (typeof account !== 'string' ||
          !account.trim() || account.length > 256 || /[\x00-\x1f\x7f]/.test(account))) ||
          !['test', 'live'].includes(mode)) {
        throw new TypeError('Valid service account and test/live mode are required');
      }
      const clock = now();
      if (!Number.isSafeInteger(clock) || clock < 0 || clock > 8640000000000000 - 600000) {
        throw new TypeError('Valid issuance clock required');
      }
      const id = randomBytes(24).toString('base64url');
      const bound = Object.freeze({ id, account, mode, kind });
      const aad = contextFor(bound);
      const path = setupPathFor(id);
      if (typeof aad !== 'string' || !aad || !safeSetupPath(path, id)) {
        throw new TypeError('A service-bound encryption context and relative setup route are required');
      }
      const ciphertext = encryptSecret(secret, { aad, key });
      await db.addOneTimeSecret({ ...bound, ciphertext, expiresAt: new Date(clock + 600000) });
      return { id, setupPath: path };
    },
    async consume(id) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(id)) return null;
      // The durable store must atomically consume only an unexpired row.
      const returned = await db.consumeOneTimeSecret(id);
      if (!returned) return null;
      const row = consumedRow(returned,id);
      assertConsumedExpiry(row, now);
      const account = accountFromRow(row);
      if (account !== null && (typeof account !== 'string' ||
          !account.trim() || account.length > 256 || /[\x00-\x1f\x7f]/.test(account))) {
        throw new TypeError('Invalid consumed secret account');
      }
      const aad = contextFor(Object.freeze({ id, account, mode:row.mode, kind:row.kind }));
      if (typeof aad !== 'string' || !aad) throw new TypeError('Invalid consumed secret context');
      return decryptSecret(row.ciphertext, { aad, key });
    }
  });
}
