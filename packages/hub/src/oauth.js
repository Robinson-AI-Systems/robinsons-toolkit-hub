import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { digestPass } from './identity.js';
const codePattern = /^[A-Za-z0-9_-]{43}$/;
const allowedProfile = new Set(['read_only','everyday','full']);
function token() { return randomBytes(32).toString('base64url'); }
function verified(value) {
  if (value !== true) throw new Error('Independent verified owner login required');
}
function redirectValid(text) {
  try {
    const u = new URL(text);
    return !u.username && !u.password && !u.hash && !u.search &&
      ((u.protocol === 'https:' && u.hostname !== 'localhost') ||
       (u.protocol === 'http:' && ['127.0.0.1','[::1]'].includes(u.hostname)));
  } catch { return false; }
}
function checkScope(input) {
  if (!allowedProfile.has(input.profile) || !['test','live'].includes(input.mode) ||
    !Array.isArray(input.areas) || input.areas.length > 32 ||
    input.areas.some(x=>!(/^[a-z][a-z0-9_]{0,59}$/).test(x))) throw new TypeError('Invalid OAuth scope');
  if (input.mode === 'live') throw new TypeError('Live OAuth access is not owner-authorized');
}
export async function registerOAuthClient(db, { ownerId, clientId, redirectUri }, { ownerVerified=false } = {}) {
  verified(ownerVerified);
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(clientId || '') ||
    !/^[A-Za-z0-9:_-]{1,120}$/.test(ownerId || '') || !redirectValid(redirectUri))
    throw new TypeError('Invalid trusted OAuth client');
  await db.query(`INSERT INTO hub_oauth_clients(client_id,owner_id,redirect_uri)
    VALUES($1,$2,$3)`,[clientId,ownerId,redirectUri]);
}
export async function issueOAuthCode(db, input, { pepper, ownerVerified=false } = {}) {
  verified(ownerVerified);
  checkScope(input);
  if (!codePattern.test(input.challenge || '')) throw new TypeError('PKCE S256 challenge required');
  const found = await db.query(`SELECT 1 FROM hub_oauth_clients
    WHERE client_id=$1 AND owner_id=$2 AND redirect_uri=$3`,
  [input.clientId,input.ownerId,input.redirectUri]);
  if (!found.rows.length) throw new Error('Client redirect not owner-authorized');
  const code = token();
  await db.query(`INSERT INTO hub_oauth_codes
    (code_digest,client_id,owner_id,redirect_uri,challenge,profile,areas,mode,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '5 minutes')`,
  [digestPass(code,pepper),input.clientId,input.ownerId,input.redirectUri,input.challenge,
    input.profile,[...new Set(input.areas)],input.mode]);
  return code; // one time, only to the verified owner's exact registered redirect
}
function pkce(verifier) {
  if (typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128 ||
    !/^[a-zA-Z0-9._~-]+$/.test(verifier)) return null;
  return createHash('sha256').update(verifier).digest('base64url');
}
async function storeSession(db, row, pepper, familyId=randomUUID()) {
  const access = token(), refresh = token();
  await db.query(`INSERT INTO hub_oauth_sessions
    (id,family_id,owner_id,client_id,access_digest,refresh_digest,profile,areas,mode,
      access_expires_at,refresh_expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '1 hour',now()+interval '30 days')`,
  [randomUUID(),familyId,row.owner_id,row.client_id,digestPass(access,pepper),
    digestPass(refresh,pepper),row.profile,row.areas,row.mode]);
  return { access_token:access, refresh_token:refresh, token_type:'Bearer', expires_in:3600 };
}
export async function exchangeOAuthCode(db, input, { pepper }={}) {
  const challenge = pkce(input?.verifier);
  if (!challenge || !codePattern.test(input?.code || '')) return null;
  // Single-use claim; even a wrong verifier burns the guessed code. No refresh defaults.
  const used=await db.query(`UPDATE hub_oauth_codes SET consumed_at=now()
    WHERE code_digest=$1 AND client_id=$2 AND redirect_uri=$3
    AND consumed_at IS NULL AND expires_at>now()
    RETURNING owner_id,client_id,profile,areas,mode,challenge`,
  [digestPass(input.code,pepper),input.clientId,input.redirectUri]);
  if (used.rows.length !== 1 || used.rows[0].challenge !== challenge) return null;
  return storeSession(db,used.rows[0],pepper);
}
export async function rotateOAuthRefresh(db, input, { pepper }={}) {
  if (!codePattern.test(input?.refreshToken || '')) return null;
  const used=await db.query(`UPDATE hub_oauth_sessions SET refresh_used_at=now()
    WHERE refresh_digest=$1 AND client_id=$2 AND refresh_used_at IS NULL
    AND revoked_at IS NULL AND refresh_expires_at>now()
    RETURNING owner_id,client_id,profile,areas,mode,family_id`,
  [digestPass(input.refreshToken,pepper),input.clientId]);
  if (!used.rows.length) return null;
  return storeSession(db,used.rows[0],pepper,used.rows[0].family_id);
}
export async function authenticateOAuth(db, accessToken, { pepper }={}) {
  if (!codePattern.test(accessToken || '')) return null;
  const result=await db.query(`SELECT s.id,s.owner_id,s.client_id,s.profile,s.areas,s.mode
    FROM hub_oauth_sessions s
    WHERE s.access_digest=$1 AND s.revoked_at IS NULL AND s.access_expires_at>now()
    AND NOT EXISTS(SELECT 1 FROM hub_oauth_sessions revoked WHERE
      revoked.family_id=s.family_id AND revoked.revoked_at IS NOT NULL)`,
  [digestPass(accessToken,pepper)]);
  const row=result.rows[0];
  return row? Object.freeze({id:row.id,ownerId:row.owner_id,clientId:row.client_id,
    profile:row.profile,areas:Object.freeze([...row.areas]),mode:row.mode,allowWrites:false}):null;
}
export async function revokeOAuthFamily(db, { ownerId, sessionId }, { ownerVerified=false }={}) {
  verified(ownerVerified);
  const result=await db.query(`UPDATE hub_oauth_sessions SET revoked_at=now()
    WHERE family_id IN (SELECT family_id FROM hub_oauth_sessions WHERE id=$1 AND owner_id=$2)
    AND revoked_at IS NULL`,[sessionId,ownerId]);
  return result.rowCount > 0;
}
