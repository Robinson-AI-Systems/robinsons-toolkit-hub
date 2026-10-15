import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { digestPass } from './identity.js';
import { serverSelection } from './server-selection.js';
import {checkedInitialServiceProfiles,ownerServiceProfiles} from './service-profile-policy.js';
import {sanitizedServicePolicy,checkedInitialServiceAreas} from './service-area-policy.js';
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
  const selected = serverSelection(input.serverNames);
  const policies=checkedInitialServiceProfiles(input.serviceProfiles,selected);
  const areaPolicy=checkedInitialServiceAreas(input.serviceAreas,selected);
  if (selected) {
    const owned = await db.query("SELECT name FROM hub_servers WHERE owner_id=$1 AND name=ANY($2::text[])",
      [input.ownerId, selected]);
    const names = new Set(owned.rows.map(x => x.name));
    if (selected.some(x => !names.has(x)))
      throw new Error('Selected RTC server must be registered to this owner');
  }
  const code = token();
  if(selected&&areaPolicy){
    // Missing OAuth-code migration 018 must refuse restricted issuance.
    const extra=policies?',service_profile_policy':'';
    await db.query(`INSERT INTO hub_oauth_codes
      (code_digest,client_id,owner_id,redirect_uri,challenge,profile,
       areas,mode,expires_at,allowed_servers,service_area_policy${extra})
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,
       now()+interval '5 minutes',$9,$10${policies?',$11':''})`,
      [digestPass(code,pepper),input.clientId,input.ownerId,input.redirectUri,
       input.challenge,input.profile,[...new Set(input.areas)],input.mode,
       selected,areaPolicy,...(policies?[policies]:[])]);
  }else if(selected&&policies){
    // Consent persists exact profile ceilings in its single-use code.
    // Absent migration 017 denies consent rather than minting a wider token.
    await db.query(`INSERT INTO hub_oauth_codes
      (code_digest,client_id,owner_id,redirect_uri,challenge,profile,areas,
       mode,expires_at,allowed_servers,service_profile_policy)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '5 minutes',$9,$10)`,
      [digestPass(code,pepper),input.clientId,input.ownerId,input.redirectUri,
       input.challenge,input.profile,[...new Set(input.areas)],input.mode,
       selected,policies]);
  } else if (selected) {
    // A missing migration refuses selected owner consent, never drops scope.
    await db.query(`INSERT INTO hub_oauth_codes
      (code_digest,client_id,owner_id,redirect_uri,challenge,profile,
       areas,mode,expires_at,allowed_servers)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '5 minutes',$9)`,
    [digestPass(code,pepper),input.clientId,input.ownerId,input.redirectUri,
      input.challenge,input.profile,[...new Set(input.areas)],input.mode,selected]);
  } else await db.query(`INSERT INTO hub_oauth_codes
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
async function storeSession(db,row,pepper,familyId=randomUUID()){
  const access=token(),refresh=token();
  const selected=serverSelection(row.allowed_servers);
  const identity=[randomUUID(),familyId,row.owner_id,row.client_id,
    digestPass(access,pepper),digestPass(refresh,pepper),row.profile,row.areas,row.mode];
  const columns=[],extra=[];
  if(selected){columns.push('allowed_servers');extra.push(selected);}
  // Immutable one-way family policies persist into EVERY refresh generation.
  // Untouched legacy sessions still work before additive columns are installed.
  if(row.service_area_policy!=null){
    columns.push('service_area_policy');extra.push(row.service_area_policy);
  }
  if(row.service_profile_policy!=null){
    columns.push('service_profile_policy');extra.push(row.service_profile_policy);
  }
  const fieldSuffix=columns.length?','+columns.join(','):'';
  const bindSuffix=extra.length?','+extra.map((_,i)=>'$'+(i+10)).join(','):'';
  await db.query(`INSERT INTO hub_oauth_sessions
    (id,family_id,owner_id,client_id,access_digest,refresh_digest,profile,areas,mode,
     access_expires_at,refresh_expires_at${fieldSuffix})
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,
     now()+interval '1 hour',now()+interval '30 days'${bindSuffix})`,
    [...identity,...extra]);
  return {access_token:access,refresh_token:refresh,
    token_type:'Bearer',expires_in:3600};
}
export async function exchangeOAuthCode(db, input, { pepper }={}) {
  const challenge = pkce(input?.verifier);
  if (!challenge || !codePattern.test(input?.code || '')) return null;
  // Single-use claim; even a wrong verifier burns the guessed code. No refresh defaults.
  const used=await db.query(`UPDATE hub_oauth_codes SET consumed_at=now()
    WHERE code_digest=$1 AND client_id=$2 AND redirect_uri=$3
    AND consumed_at IS NULL AND expires_at>now()
    RETURNING owner_id,client_id,profile,areas,mode,challenge,
      to_jsonb(hub_oauth_codes)->'allowed_servers' AS allowed_servers,
      to_jsonb(hub_oauth_codes)->'service_area_policy' AS service_area_policy,
      to_jsonb(hub_oauth_codes)->'service_profile_policy' AS service_profile_policy`,
  [digestPass(input.code,pepper),input.clientId,input.redirectUri]);
  if (used.rows.length !== 1 || used.rows[0].challenge !== challenge) return null;
  return storeSession(db,used.rows[0],pepper);
}
export async function rotateOAuthRefresh(db, input, { pepper }={}) {
  if (!codePattern.test(input?.refreshToken || '')) return null;
  const used=await db.query(`UPDATE hub_oauth_sessions SET refresh_used_at=now()
    WHERE refresh_digest=$1 AND client_id=$2 AND refresh_used_at IS NULL
    AND revoked_at IS NULL AND refresh_expires_at>now()
    RETURNING owner_id,client_id,profile,areas,mode,family_id,
      to_jsonb(hub_oauth_sessions)->'allowed_servers' AS allowed_servers,
      to_jsonb(hub_oauth_sessions)->'service_area_policy' AS service_area_policy,
      to_jsonb(hub_oauth_sessions)->'service_profile_policy' AS service_profile_policy`,
  [digestPass(input.refreshToken,pepper),input.clientId]);
  if (!used.rows.length) {
    // A second use of an already-rotated bearer is a compromised family,
    // not merely an invalid grant. Never allow an older refresh to coexist
    // with its replacements. The family query covers a concurrent rotation.
    const prior=await db.query(`SELECT family_id FROM hub_oauth_sessions
      WHERE refresh_digest=$1 AND client_id=$2 AND refresh_used_at IS NOT NULL
      LIMIT 1`,[digestPass(input.refreshToken,pepper),input.clientId]);
    if (prior.rows.length) await db.query(`UPDATE hub_oauth_sessions
      SET revoked_at=now() WHERE family_id=$1 AND revoked_at IS NULL`,
      [prior.rows[0].family_id]);
    return null;
  }
  return storeSession(db,used.rows[0],pepper,used.rows[0].family_id);
}
export async function authenticateOAuth(db, accessToken, { pepper }={}) {
  if (!codePattern.test(accessToken || '')) return null;
  const result=await db.query(`SELECT s.id,s.owner_id,s.client_id,s.profile,s.areas,s.mode
    ,to_jsonb(s)->'allowed_servers' AS allowed_servers
    FROM hub_oauth_sessions s
    WHERE s.access_digest=$1 AND s.revoked_at IS NULL AND s.access_expires_at>now()
    AND NOT EXISTS(SELECT 1 FROM hub_oauth_sessions revoked WHERE
      revoked.family_id=s.family_id AND revoked.revoked_at IS NOT NULL)`,
  [digestPass(accessToken,pepper)]);
  const row=result.rows[0];
  return row? Object.freeze({id:row.id,ownerId:row.owner_id,clientId:row.client_id,
    profile:row.profile,areas:Object.freeze([...row.areas]),mode:row.mode,allowWrites:false,
    serverNames:Array.isArray(row.allowed_servers) ?
      Object.freeze([...serverSelection(row.allowed_servers)]) : null}):null;
}
export async function revokeOAuthFamily(db, { ownerId, sessionId }, { ownerVerified=false }={}) {
  verified(ownerVerified);
  const result=await db.query(`UPDATE hub_oauth_sessions SET revoked_at=now()
    WHERE family_id IN (SELECT family_id FROM hub_oauth_sessions WHERE id=$1 AND owner_id=$2)
    AND revoked_at IS NULL`,[sessionId,ownerId]);
  return result.rowCount > 0;
}

export async function revokeOAuthToken(db, { clientId, token }, { pepper }={}) {
  // RFC7009-style revocation: possession of a valid opaque token is sufficient.
  // Never disclose whether it existed or belonged to the client.
  if (typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(clientId))
    return false;
  if (!codePattern.test(token || '')) return true;
  const hash=digestPass(token,pepper);
  const result=await db.query(`SELECT family_id FROM hub_oauth_sessions
    WHERE client_id=$1 AND (access_digest=$2 OR refresh_digest=$2) LIMIT 1`,
    [clientId,hash]);
  if (result.rows.length) await db.query(`UPDATE hub_oauth_sessions SET revoked_at=now()
    WHERE family_id=$1 AND revoked_at IS NULL`,[result.rows[0].family_id]);
  return true;
}
export async function listOwnerOAuthSessions(db, ownerId, { ownerVerified=false }={}) {
  verified(ownerVerified);
  if (!/^[A-Za-z0-9:_-]{1,120}$/.test(ownerId || ''))
    throw new TypeError('Invalid owner');
  const result=await db.query(`SELECT id,client_id,profile,areas,mode
    FROM hub_oauth_sessions WHERE owner_id=$1 AND revoked_at IS NULL
      AND access_expires_at>now() ORDER BY access_expires_at DESC LIMIT 20`,
  [ownerId]);
  return result.rows;
}

const uuidPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

// Owner-only family view; one most recent session per still-live family.
// Never include bearer digests, upstream grants or OAuth verifier material.
export async function listOwnerOAuthFamilies(db,ownerId,{ownerVerified=false}={}) {
  verified(ownerVerified);
  if(!/^[A-Za-z0-9:_-]{1,120}$/.test(ownerId||''))
    throw new TypeError('Invalid owner');
  const {rows}=await db.query(`SELECT id,family_id,client_id,profile,areas,mode,
    allowed_servers,service_area_policy,service_profile_policy,
    access_expires_at,refresh_expires_at FROM (
      SELECT s.id,s.family_id,s.client_id,s.profile,s.areas,s.mode,
        to_jsonb(s)->'allowed_servers' AS allowed_servers,
        to_jsonb(s)->'service_area_policy' AS service_area_policy,
        to_jsonb(s)->'service_profile_policy' AS service_profile_policy,
        s.access_expires_at,s.refresh_expires_at,
        row_number() OVER (PARTITION BY s.family_id
          ORDER BY s.refresh_expires_at DESC,s.access_expires_at DESC,s.id DESC) AS rank
      FROM hub_oauth_sessions s WHERE s.owner_id=$1 AND s.revoked_at IS NULL
        AND s.refresh_expires_at>now()
        AND NOT EXISTS(SELECT 1 FROM hub_oauth_sessions r
          WHERE r.family_id=s.family_id AND r.revoked_at IS NOT NULL)
    ) current WHERE rank=1 ORDER BY access_expires_at DESC,id LIMIT 30`,[ownerId]);
  return rows.map(r=>({
    id:r.id,clientId:r.client_id,profile:r.profile,mode:r.mode,
    areas:[...r.areas],serverNames:Array.isArray(r.allowed_servers) ?
      [...serverSelection(r.allowed_servers)] : null,
    serviceAreas:sanitizedServicePolicy(r.service_area_policy),
    serviceProfiles:ownerServiceProfiles(r.service_profile_policy),
    accessExpiresAt:r.access_expires_at,refreshExpiresAt:r.refresh_expires_at
  }));
}

// Unlike bearer self-revocation, this path requires an independent owner
// challenge. An audit write, full refresh-family shutdown, and deletion of
// prior RTC encrypted handles commit or roll back as one SQL statement.
export async function revokeOwnerOAuthFamily(db,{ownerId,sessionId},
 {ownerVerified=false}={}) {
  verified(ownerVerified);
  if(!/^[A-Za-z0-9:_-]{1,120}$/.test(ownerId||'')||
    !uuidPattern.test(sessionId||'')) throw new TypeError('Invalid OAuth family selector');
  const {rows}=await db.query(`WITH target AS (
      SELECT family_id FROM hub_oauth_sessions
      WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL
        AND refresh_expires_at>now()
    ), revoked AS (
      UPDATE hub_oauth_sessions s SET revoked_at=now()
      WHERE s.owner_id=$2 AND s.revoked_at IS NULL
        AND s.family_id IN (SELECT family_id FROM target)
      RETURNING s.id
    ), purged AS (
      DELETE FROM hub_rtc_result_handles h USING hub_server_grants g
      WHERE h.grant_id=g.id AND g.owner_id=$2 AND g.caller_kind='oauth'
        AND g.caller_id IN (SELECT id FROM hub_oauth_sessions
          WHERE family_id IN (SELECT family_id FROM target))
      RETURNING h.handle_digest
    )
    INSERT INTO hub_oauth_owner_audit
      (owner_id,family_id,sample_session_id,action,affected_sessions,purged_handles)
    SELECT $2,t.family_id,$1,'revoke',
      (SELECT count(*) FROM revoked),(SELECT count(*) FROM purged)
    FROM target t WHERE EXISTS(SELECT 1 FROM revoked)
    RETURNING id`,[sessionId,ownerId]);
  return rows.length===1;
}

/**
 * An independently verified owner may only permanently reduce the server
 * selection of an existing OAuth refresh family. All existing sessions
 * change in one SQL statement; concurrent owner decisions cannot restore
 * previously removed servers. Upstream encrypted RTC grants are untouched.
 */
export async function narrowOwnerOAuthFamilyServers(db,{ownerId,sessionId,serverNames},
 {ownerVerified=false}={}) {
  verified(ownerVerified);
  if(!/^[A-Za-z0-9:_-]{1,120}$/.test(ownerId||'')||
    !uuidPattern.test(sessionId||'')) throw new TypeError('Invalid OAuth family selector');
  const selected=serverSelection(serverNames,{required:true});
  const {rows}=await db.query(`WITH target AS (
      SELECT s.family_id FROM hub_oauth_sessions s
      WHERE s.id=$1 AND s.owner_id=$2 AND s.revoked_at IS NULL
        AND s.refresh_expires_at>now()
        AND (s.allowed_servers IS NULL OR
          ($3::text[] <@ s.allowed_servers
           AND cardinality($3::text[])<cardinality(s.allowed_servers)))
        AND NOT EXISTS(
          SELECT 1 FROM hub_oauth_sessions different
          WHERE different.family_id=s.family_id AND
            (different.owner_id<>s.owner_id OR different.revoked_at IS NOT NULL
             OR different.allowed_servers IS DISTINCT FROM s.allowed_servers))
        AND NOT EXISTS(
          SELECT 1 FROM unnest($3::text[]) AS choice(name)
          WHERE NOT EXISTS(SELECT 1 FROM hub_servers owned
            WHERE owned.name=choice.name AND owned.owner_id=$2))
    ), tightened AS (
      UPDATE hub_oauth_sessions s SET allowed_servers=$3::text[]
      WHERE s.family_id IN (SELECT family_id FROM target)
        AND s.owner_id=$2 AND s.revoked_at IS NULL
        AND (s.allowed_servers IS NULL OR
          ($3::text[] <@ s.allowed_servers
           AND cardinality($3::text[])<cardinality(s.allowed_servers)))
      RETURNING s.id
    ), invalidated AS (
      DELETE FROM hub_rtc_result_handles h USING hub_server_grants g
      WHERE g.id=h.grant_id AND g.owner_id=$2
        AND g.caller_kind='oauth'
        AND g.server_name<>ALL($3::text[])
        AND EXISTS(SELECT 1 FROM tightened)
        AND g.caller_id IN (SELECT id FROM hub_oauth_sessions
          WHERE family_id IN (SELECT family_id FROM target))
      RETURNING h.handle_digest
    )
    INSERT INTO hub_oauth_family_scope_audit
      (owner_id,family_id,session_id,server_names,affected_sessions,purged_handles)
    SELECT $2,t.family_id,$1,$3::text[],
      (SELECT count(*) FROM tightened),(SELECT count(*) FROM invalidated)
    FROM target t WHERE EXISTS(SELECT 1 FROM tightened)
    RETURNING id`,[sessionId,ownerId,selected]);
  return {updated:rows.length===1,serverNames:rows.length===1?[...selected]:null};
}
