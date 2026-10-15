import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { serverSelection } from './server-selection.js';
import {checkedInitialServiceProfiles,ownerServiceProfiles} from './service-profile-policy.js';
import {sanitizedServicePolicy} from './service-area-policy.js';

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
  const policies=checkedInitialServiceProfiles(input.serviceProfiles,selected);
  if (selected) {
    const owned = await db.query(`SELECT name FROM hub_servers
      WHERE owner_id=$1 AND name=ANY($2::text[])`, [input.ownerId, selected]);
    const names = new Set(owned.rows.map(row => row.name));
    if (selected.some(name => !names.has(name)))
      throw new Error('Selected RTC server must be registered to this owner');
  }
  const pass = 'rtc_pass_' + randomBytes(32).toString('base64url');
  const id = randomUUID();
  if(selected&&policies){
    // Missing profile SQL 017 refuses the entire selected issuance.
    await db.query(`INSERT INTO hub_callers
      (id,owner_id,pass_digest,profile,allowed_areas,mode,allow_writes,
       expires_at,allowed_servers,service_profile_policy)
      VALUES($1,$2,$3,$4,$5,$6,FALSE,
       now()+$7::INTEGER*interval '1 second',$8,$9)`,
      [id,input.ownerId,digestPass(pass,pepper),input.profile,
       [...new Set(input.areas)],input.mode,input.ttlSeconds,selected,policies]);
  } else if (selected) {
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

const ownerName=/^[A-Za-z0-9:_-]{1,120}$/;
const passId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function verifiedOwnerScope(ownerId,verified) {
  if(verified!==true||typeof ownerId!=='string'||!ownerName.test(ownerId))
    throw new Error('Verified owner approval required');
}

/**
 * Owner may only reduce an existing Hub pass's RTC server names. The UPDATE
 * condition is checked under the row lock by PostgreSQL; two concurrent owner
 * requests cannot expand each other. Durable audit is in the same statement.
 */
export async function narrowHubPassServers(db,{ownerId,id,serverNames},
 {ownerVerified=false}={}) {
  verifiedOwnerScope(ownerId,ownerVerified);
  if(typeof id!=='string'||!passId.test(id))
    throw new TypeError('Invalid Hub pass identifier');
  const names=serverSelection(serverNames,{required:true});
  const owned=await db.query(`SELECT name FROM hub_servers
    WHERE owner_id=$1 AND name=ANY($2::text[])`,[ownerId,names]);
  const found=new Set(owned.rows.map(row=>row.name));
  if(names.some(name=>!found.has(name)))
    throw new Error('Selected RTC server must be registered to this owner');
  // No reversible "set" operation: once narrowed, this owner pass can only
  // narrow again or be revoked. Audit and mutation commit or fail together.
  const {rows}=await db.query(`WITH tightened AS (
    UPDATE hub_callers SET allowed_servers=$3::text[]
    WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL AND expires_at>now()
      AND (allowed_servers IS NULL OR $3::text[] <@ allowed_servers)
    RETURNING id
   )
   INSERT INTO hub_forward_audit(caller_id,action,outcome)
     SELECT id,'hub_pass_scope_narrow','allowed' FROM tightened
   RETURNING caller_id`,[id,ownerId,names]);
  return rows.length===1 ? {updated:true,serverNames:[...names]} :
    {updated:false,serverNames:null};
}

/** Owner-private, metadata-only overview; no digest, ciphertext or bearer. */
export async function listHubPassScopes(db,ownerId,{ownerVerified=false}={}) {
  verifiedOwnerScope(ownerId,ownerVerified);
  const {rows}=await db.query(`SELECT id,profile,mode,allowed_areas,
    to_jsonb(hub_callers)->'allowed_servers' AS server_names,
    to_jsonb(hub_callers)->'service_area_policy' AS service_area_policy,
    to_jsonb(hub_callers)->'service_profile_policy' AS service_profile_policy,expires_at,
    CASE WHEN revoked_at IS NOT NULL THEN 'revoked'
      WHEN expires_at<=now() THEN 'expired' ELSE 'current' END AS state
    FROM hub_callers WHERE owner_id=$1
    ORDER BY issued_at DESC,id LIMIT 50`,[ownerId]);
  return rows.map(row=>({
    id:row.id,profile:row.profile,mode:row.mode,
    areas:[...row.allowed_areas],
    serverNames:Array.isArray(row.server_names)?
      [...serverSelection(row.server_names)]:null,
    serviceAreas:sanitizedServicePolicy(row.service_area_policy),
    serviceProfiles:ownerServiceProfiles(row.service_profile_policy),
    expiresAt:row.expires_at,state:row.state
  }));
}
