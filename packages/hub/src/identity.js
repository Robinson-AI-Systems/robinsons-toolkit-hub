import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { serverSelection } from './server-selection.js';

// The Hub authenticates its own callers. Upstream RTC passes live in separately
// encrypted, caller-scoped grants added by H-2; never use this pass upstream.
function assertKey(pepper) {
  if (typeof pepper !== 'string' || pepper.length < 32)
    throw new Error('Hub token HMAC key must be provisioned separately');
}
export function digestPass(pass, pepper) {
  assertKey(pepper);
  if (typeof pass !== 'string') throw new TypeError('Invalid Hub token');
  return createHmac('sha256', pepper).update(pass).digest('hex');
}
export function parseBearer(header) {
  if (typeof header !== 'string' || !/^Bearer rtc_pass_[A-Za-z0-9_-]{43}$/.test(header))
    return null;
  return header.slice(7);
}
function fixedEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
function validateIssue(input) {
  if (!input || typeof input.ownerId !== 'string' || !/^[a-zA-Z0-9:_-]{1,120}$/.test(input.ownerId))
    throw new TypeError('Invalid owner identity');
  if (!['read_only','everyday','full'].includes(input.profile)) throw new TypeError('Invalid profile');
  if (!['test','live'].includes(input.mode) || (input.mode === 'live' && input.allowWrites))
    throw new TypeError('Unsafe or unsupported mode');
  if (input.allowWrites !== false) throw new TypeError('Hub-issued passes must default to no writes');
  if (!Array.isArray(input.areas) || input.areas.length > 32 ||
    input.areas.some(a => typeof a !== 'string' || !/^[a-z][a-z0-9_]{0,59}$/.test(a)))
    throw new TypeError('Invalid areas');
  if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds < 60 ||
    input.ttlSeconds > 30 * 86400) throw new TypeError('Invalid pass lifetime');
}
export async function issueHubPass(db, input, { pepper, ownerVerified = false } = {}) {
  // Only a separate authenticated owner workflow may set this server-side flag.
  // No public endpoint invokes issuance until the owner OAuth setup is complete.
  if (ownerVerified !== true) throw new Error('Verified owner approval required');
  validateIssue(input);
  // An explicit selection is additional least privilege. Legacy trusted
  // programmatic issuance retains the previous exact-caller grant gate.
  const selected = serverSelection(input.serverNames);
  if (selected) {
    const owned = await db.query(`SELECT name FROM hub_servers
      WHERE owner_id=$1 AND name=ANY($2::text[])`, [input.ownerId, selected]);
    const names = new Set(owned.rows.map(row => row.name));
    if (selected.some(name => !names.has(name)))
      throw new Error('Selected RTC server must be registered to this owner');
  }
  const pass = 'rtc_pass_' + randomBytes(32).toString('base64url');
  const id = randomUUID();
  if (selected) {
    // Fail closed if the additive migration is not installed: the selected
    // credential must never silently fall back to unrestricted legacy mode.
    await db.query(`INSERT INTO hub_callers
      (id,owner_id,pass_digest,profile,allowed_areas,mode,allow_writes,
       expires_at,allowed_servers)
      VALUES($1,$2,$3,$4,$5,$6,FALSE,
        now() + $7::INTEGER * interval '1 second',$8)`,
    [id, input.ownerId, digestPass(pass, pepper), input.profile,
      [...new Set(input.areas)], input.mode, input.ttlSeconds, selected]);
  } else {
    await db.query(`INSERT INTO hub_callers
      (id,owner_id,pass_digest,profile,allowed_areas,mode,allow_writes,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,FALSE,now() + $7::INTEGER * interval '1 second')`,
    [id, input.ownerId, digestPass(pass, pepper), input.profile, [...new Set(input.areas)],
      input.mode, input.ttlSeconds]);
  }
  return { id, pass }; // one-time in-memory return; NEVER put in logs or a chat tool result
}
export async function authenticateHubPass(db, header, { pepper } = {}) {
  const pass = parseBearer(header);
  if (!pass) return null;
  const hash = digestPass(pass, pepper);
  const { rows } = await db.query(`SELECT id,owner_id,pass_digest,profile,allowed_areas,mode,allow_writes
    ,to_jsonb(c)->'allowed_servers' AS allowed_servers
    FROM hub_callers c WHERE pass_digest=$1 AND revoked_at IS NULL AND expires_at>now()`, [hash]);
  const row = rows[0];
  if (!row || !fixedEqual(row.pass_digest,hash)) return null;
  return Object.freeze({
    id:row.id, ownerId:row.owner_id, profile:row.profile,
    areas:Object.freeze([...row.allowed_areas]), mode:row.mode, allowWrites:row.allow_writes === true,
    serverNames: Array.isArray(row.allowed_servers) ?
      Object.freeze([...serverSelection(row.allowed_servers)]) : null
  });
}
export async function revokeHubPass(db, id, ownerId, { ownerVerified = false } = {}) {
  if (!ownerVerified || !/^[0-9a-f-]{36}$/i.test(id) || !ownerId)
    throw new Error('Verified owner approval required');
  const { rowCount } = await db.query(`UPDATE hub_callers SET revoked_at=now()
    WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL`,[id,ownerId]);
  return rowCount === 1;
}
