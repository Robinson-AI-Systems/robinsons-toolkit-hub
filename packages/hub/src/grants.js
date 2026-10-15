import {completeActiveGrantActivation,replacementScopeAllowed} from './grant-lifecycle.js';
import {limitedServiceProfile} from './service-profile-policy.js';
import {effectiveServiceAreas} from './service-area-policy.js';
import {inspectScopedRtcIdentity} from './pinned-identity.js';
import {allowedByHubPass} from './server-selection.js';
import {validateStagedOrigin} from './registry.js';
import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';

const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const passPattern=/^rtc_pass_[A-Za-z0-9_-]{43}$/;
const namePattern=/^[a-z][a-z0-9_]{1,59}$/;
const areaPattern=/^[a-z][a-z0-9_]{0,59}$/;
function key(settings) {
  const raw=settings?.grantsKey;
  if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw))
    throw new Error('Independent Hub grants encryption key not configured');
  const bytes=Buffer.from(raw,'base64url');
  if(bytes.length!==32||bytes.toString('base64url')!==raw)
    throw new Error('Invalid Hub grants encryption key');
  return bytes;
}
function audience(row) {
  // Authenticated encryption binds all security-relevant grant selectors.
  return Buffer.from(JSON.stringify([row.id,row.owner_id,row.server_name,
    row.caller_kind,row.caller_id,row.profile,row.mode,row.areas]),'utf8');
}
function owner(ownerId,ownerVerified) {
  if(ownerVerified!==true||typeof ownerId!=='string'||
    !/^[A-Za-z0-9:_-]{1,120}$/.test(ownerId))
    throw new Error('Independent owner verification required');
}
function validAreas(value) {
  return Array.isArray(value)&&value.length>=1&&value.length<=32&&
    value.every(x=>typeof x==='string'&&areaPattern.test(x)) &&
    new Set(value).size===value.length;
}
// A provider service grant is never re-encrypted or widened by a Hub area ceiling.
export function effectiveGrantAreas(row) {
  if(!row||!validAreas(row.areas))throw new TypeError('Invalid provider grant areas');
  if(row.area_ceiling===null||row.area_ceiling===undefined)
    return [...row.areas];
  if(!validAreas(row.area_ceiling))throw new TypeError('Invalid RTC area ceiling');
  return row.areas.filter(area=>row.area_ceiling.includes(area));
}
// Applying a pass/OAuth-specific ceiling is an additional intersection,
// never a replacement for the provider's independent RTC permission.
export function authorizedGrantAreas(row) {
  return effectiveServiceAreas(effectiveGrantAreas(row),
    row.caller_area_policy??null,row.server_name);
}
async function checkCaller(db,{ownerId,callerKind,callerId,serverName}) {
  const sql=callerKind==='pass' ?
    `SELECT id,owner_id,profile,allowed_areas AS areas,mode,allow_writes
       ,to_jsonb(hub_callers)->'allowed_servers' AS allowed_servers
       FROM hub_callers WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL
       AND expires_at>now()` :
    `SELECT id,owner_id,profile,areas,mode,FALSE AS allow_writes,
        to_jsonb(s)->'allowed_servers' AS allowed_servers
       FROM hub_oauth_sessions s WHERE id=$1 AND owner_id=$2
       AND revoked_at IS NULL
       AND (s.access_expires_at>now() OR EXISTS (
         SELECT 1 FROM hub_oauth_sessions current
         WHERE current.family_id=s.family_id AND current.owner_id=s.owner_id
           AND current.client_id=s.client_id AND current.profile=s.profile
           AND current.mode=s.mode AND current.areas=s.areas
           AND (to_jsonb(current)->'allowed_servers') IS NOT DISTINCT FROM
               (to_jsonb(s)->'allowed_servers')
           AND (to_jsonb(current)->'service_area_policy') IS NOT DISTINCT FROM
               (to_jsonb(s)->'service_area_policy')
           AND current.revoked_at IS NULL
           AND current.access_expires_at>now() AND current.refresh_expires_at>now()
       ))
       AND NOT EXISTS(SELECT 1 FROM hub_oauth_sessions compromised
         WHERE compromised.family_id=s.family_id AND compromised.revoked_at IS NOT NULL)`;
  const {rows}=await db.query(sql,[callerId,ownerId]);
  const a=rows[0];
  if(!a||!['read_only','everyday','full'].includes(a.profile)||a.mode!=='test'||a.allow_writes===true||
    !Array.isArray(a.areas)||!a.areas.includes('gateway')||
    (Array.isArray(a.allowed_servers) &&
      !a.allowed_servers.includes(serverName)))
    throw new Error('Caller scope refuses grant');
}
export async function stageCallerGrant(db,input,{ownerVerified=false,settings}={}) {
  const {ownerId,serverName,callerKind,callerId,areas,pass,ttlSeconds}=input||{};
  owner(ownerId,ownerVerified);
  if(!namePattern.test(serverName||'')||!['pass','oauth'].includes(callerKind)||
    !idPattern.test(callerId||'')||!validAreas(areas)||
    !passPattern.test(pass||'')||!Number.isInteger(ttlSeconds)||
    ttlSeconds<60||ttlSeconds>30*86400)
    throw new TypeError('Invalid separately scoped TEST grant');
  const secret=key(settings);
  await checkCaller(db,{ownerId,callerKind,callerId,serverName});
  const host=await db.query(`SELECT state FROM hub_servers
    WHERE name=$1 AND owner_id=$2`,[serverName,ownerId]);
  if(host.rows.length!==1||!['pending','active'].includes(host.rows[0].state))
    throw new Error('Only owned pending or active RTC services can stage grants');
  if(host.rows[0].state==='active') {
    // An existing caller may renew only to the same or narrower effective
    // provider areas. Another caller can independently receive its own
    // separately issued TEST/read_only pass on an already active service.
    const {rows}=await db.query(`SELECT areas,
      to_jsonb(hub_server_grants)->'area_ceiling' AS area_ceiling
      FROM hub_server_grants WHERE owner_id=$1 AND server_name=$2
       AND caller_kind=$3 AND caller_id=$4
       AND revoked_at IS NULL AND verified_at IS NOT NULL
       AND expires_at>now() LIMIT 2`,
      [ownerId,serverName,callerKind,callerId]);
    if(rows.length>1||rows.length===1&&!replacementScopeAllowed(areas,
       rows[0].area_ceiling??rows[0].areas))
      throw new Error('Renewal cannot expand independently verified RTC areas');
  }
  const row={id:randomUUID(),owner_id:ownerId,server_name:serverName,caller_kind:callerKind,
    caller_id:callerId,profile:'read_only',mode:'test',areas:[...areas]};
  const nonce=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',secret,nonce);
  cipher.setAAD(audience(row));
  const ciphertext=Buffer.concat([cipher.update(pass,'utf8'),cipher.final()]);
  await db.query(`INSERT INTO hub_server_grants
    (id,owner_id,server_name,caller_kind,caller_id,pass_caller_id,oauth_session_id,
     profile,mode,areas,ciphertext,nonce,tag,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,'read_only','test',$8,$9,$10,$11,
      now()+$12::integer*interval '1 second')`,[
    row.id,ownerId,serverName,callerKind,callerId,callerKind==='pass'?callerId:null,
    callerKind==='oauth'?callerId:null,row.areas,ciphertext,nonce,cipher.getAuthTag(),ttlSeconds
  ]);
  return {id:row.id,server:serverName,callerKind,callerId,profile:'read_only',
    areas:[...areas],mode:'test',state:'staged',callable:false,
    activationRequired:true,serverAlreadyActive:host.rows[0].state==='active'};
}
/**
 * Verified owner can only remove effective areas of one exact grant.
 * PostgreSQL conditionally locks the grant, purges prior encrypted result
 * pages and inserts a durable policy audit atomically or refuses everything.
 */
export async function narrowCallerGrantAreas(db,{ownerId,id,areas},
 {ownerVerified=false}={}) {
  owner(ownerId,ownerVerified);
  if(!idPattern.test(id||'')||!validAreas(areas))
    throw new TypeError('Invalid grant ceiling request');
  const {rows}=await db.query(`WITH tightened AS (
     UPDATE hub_server_grants g SET area_ceiling=$3::text[]
     WHERE g.id=$1 AND g.owner_id=$2 AND g.revoked_at IS NULL
       AND g.expires_at>now() AND $3::text[] <@ g.areas
       AND (g.area_ceiling IS NULL OR $3::text[] <@ g.area_ceiling)
     RETURNING g.id
    ), invalidated AS (
     DELETE FROM hub_rtc_result_handles h USING tightened t
      WHERE h.grant_id=t.id RETURNING h.handle_digest
    )
    INSERT INTO hub_grant_scope_audit(grant_id,owner_id,action,areas)
     SELECT t.id,$2,'area_narrow',$3::text[] FROM tightened t
    RETURNING grant_id`,[id,ownerId,areas]);
  return rows.length===1 ? {updated:true,areas:[...areas]} :
    {updated:false,areas:null};
}
export async function revokeCallerGrant(db,{ownerId,id},{ownerVerified=false}={}) {
  owner(ownerId,ownerVerified);
  if(!idPattern.test(id||'')) throw new TypeError('Invalid grant identifier');
  const {rowCount}=await db.query(`UPDATE hub_server_grants SET revoked_at=now()
    WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL`,[id,ownerId]);
  return rowCount===1;
}
export async function listCallerGrants(db,ownerId,{ownerVerified=false}={}) {
  owner(ownerId,ownerVerified);
  const {rows}=await db.query(`SELECT id,server_name,caller_kind,caller_id,areas,
    to_jsonb(hub_server_grants)->'area_ceiling' AS area_ceiling,
    to_jsonb(hub_server_grants)->'verified_at' AS verified_at,
    expires_at,revoked_at FROM hub_server_grants
    WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100`,[ownerId]);
  return rows.map(r=>({id:r.id,server:r.server_name,callerKind:r.caller_kind,
    callerId:r.caller_id,areas:effectiveGrantAreas(r),originalAreas:[...r.areas],
    expiresAt:r.expires_at,verified:r.verified_at!=null,
    revoked:r.revoked_at!==null,callable:false}));
}
// Never expose this from owner HTML, tools or logs. H-3 may invoke it only
// after a separately verified, enabled origin and exact live caller scope.
export async function resolveActiveCallerGrant(db,{actor,serverName},settings) {
  if(!actor||actor.mode!=='test'||!['read_only','everyday','full'].includes(actor.profile)||actor.allowWrites===true||
    !actor.areas?.includes('gateway')||!namePattern.test(serverName||'')||
    !allowedByHubPass(actor,serverName))
    return null;
  const secret=key(settings);
  const {rows}=await db.query(`SELECT g.*,s.origin AS target_origin,s.prefix AS target_prefix,
    CASE WHEN g.caller_kind='pass' THEN
      (SELECT to_jsonb(c)->'service_area_policy' FROM hub_callers c WHERE c.id=$2)
    ELSE (SELECT to_jsonb(o)->'service_area_policy'
      FROM hub_oauth_sessions o WHERE o.id=$2) END AS caller_area_policy,
    CASE WHEN g.caller_kind='pass' THEN
      (SELECT to_jsonb(c)->'service_profile_policy' FROM hub_callers c WHERE c.id=$2)
    ELSE (SELECT to_jsonb(o)->'service_profile_policy'
      FROM hub_oauth_sessions o WHERE o.id=$2) END AS caller_profile_policy
    FROM hub_server_grants g
    JOIN hub_servers s ON s.name=g.server_name AND s.owner_id=g.owner_id
    WHERE g.owner_id=$1 AND g.caller_kind=$3
      AND (g.caller_id=$2 OR (g.caller_kind='oauth' AND EXISTS (
        SELECT 1 FROM hub_oauth_sessions fresh
        JOIN hub_oauth_sessions initial ON initial.family_id=fresh.family_id
        WHERE fresh.id=$2 AND initial.id=g.caller_id
        AND fresh.owner_id=g.owner_id AND initial.owner_id=g.owner_id
        AND fresh.client_id=initial.client_id AND fresh.profile=initial.profile
        AND fresh.areas=initial.areas AND fresh.mode=initial.mode
        AND (to_jsonb(fresh)->'allowed_servers') IS NOT DISTINCT FROM
            (to_jsonb(initial)->'allowed_servers')
        AND (to_jsonb(fresh)->'service_area_policy') IS NOT DISTINCT FROM
            (to_jsonb(initial)->'service_area_policy')
        AND (to_jsonb(fresh)->'service_profile_policy') IS NOT DISTINCT FROM
            (to_jsonb(initial)->'service_profile_policy')
        AND (to_jsonb(fresh)->'service_profile_policy') IS NOT DISTINCT FROM
            (to_jsonb(initial)->'service_profile_policy')
        AND fresh.mode='test' AND fresh.revoked_at IS NULL
        AND initial.revoked_at IS NULL AND fresh.access_expires_at>now()
        AND NOT EXISTS(SELECT 1 FROM hub_oauth_sessions compromised
          WHERE compromised.family_id=fresh.family_id AND compromised.revoked_at IS NOT NULL)))) AND g.server_name=$4
      AND g.revoked_at IS NULL AND g.expires_at>now() AND s.state='active'
      AND g.verified_at IS NOT NULL AND g.profile='read_only' AND g.mode='test'
      AND (
        (g.caller_kind='pass' AND EXISTS(
          SELECT 1 FROM hub_callers c WHERE c.id=g.caller_id
          AND c.owner_id=g.owner_id AND c.revoked_at IS NULL AND c.expires_at>now()
          AND c.profile IN ('read_only','everyday','full') AND c.mode='test' AND c.allow_writes=FALSE
          AND (NULLIF(to_jsonb(c)->'allowed_servers','null'::jsonb) IS NULL OR
            to_jsonb(c)->'allowed_servers' ? s.name)
          AND 'gateway'=ANY(c.allowed_areas)))
        OR (g.caller_kind='oauth' AND EXISTS(
          SELECT 1 FROM hub_oauth_sessions o WHERE o.id=$2
          AND o.owner_id=g.owner_id AND o.revoked_at IS NULL
          AND o.access_expires_at>now() AND o.profile IN ('read_only','everyday','full') AND o.mode='test'
          AND 'gateway'=ANY(o.areas)
          AND (NULLIF(to_jsonb(o)->'allowed_servers','null'::jsonb) IS NULL
            OR to_jsonb(o)->'allowed_servers' ? s.name)
          AND NOT EXISTS(SELECT 1 FROM hub_oauth_sessions compromised
            WHERE compromised.family_id=o.family_id AND compromised.revoked_at IS NOT NULL)))
      )`,
  [actor.ownerId,actor.id,actor.clientId?'oauth':'pass',serverName]);
  const row=rows[0];
  if(!row) return null;
  const limitedAreas=authorizedGrantAreas(row);
  const selectedProfile=limitedServiceProfile(row.profile,actor.profile,
    row.caller_profile_policy,row.server_name);
  if(!limitedAreas.length||!selectedProfile)return null;
  // Never dispatch a credential toward a changed or malformed registry target.
  const origin=validateStagedOrigin(row.target_origin);
  if(!namePattern.test(row.target_prefix||'')) throw new Error('Invalid active service prefix');
  const decipher=createDecipheriv('aes-256-gcm',secret,row.nonce);
  decipher.setAAD(audience(row));
  decipher.setAuthTag(row.tag);
  const pass=Buffer.concat([decipher.update(row.ciphertext),decipher.final()]).toString('utf8');
  if(!passPattern.test(pass)) throw new Error('Invalid encrypted upstream credential');
  return {pass,grantId:row.id,origin,prefix:row.target_prefix,server:serverName,
    areas:limitedAreas,profile:selectedProfile,mode:row.mode};
}


/**
 * Grant-filtered, metadata-only target selection. A full TEST developer
 * principal may select a separately issued read_only service grant, never
 * broaden it. The active grant resolver must still run before any request,
 * independently rechecking expiry and revocation.
 */
export async function listEligibleRtcTargets(db,actor,{limit=20}={}) {
  if(!actor||actor.mode!=='test'||actor.allowWrites===true||
    !['read_only','everyday','full'].includes(actor.profile)||
    !Array.isArray(actor.areas)||!actor.areas.includes('gateway')||
    typeof actor.ownerId!=='string'||!actor.ownerId||
    typeof actor.id!=='string'||!actor.id||
    !Number.isInteger(limit)||limit<1||limit>100) return [];
  const callerKind=actor.clientId?'oauth':'pass';
  const {rows}=await db.query(`SELECT s.name,s.prefix,s.origin,s.claimed_counts,g.areas,
           to_jsonb(g)->'area_ceiling' AS area_ceiling,
           g.id AS grant_id,g.verified_at,
           CASE WHEN g.caller_kind='pass' THEN
             (SELECT to_jsonb(c)->'service_area_policy' FROM hub_callers c WHERE c.id=$2)
           ELSE (SELECT to_jsonb(o)->'service_area_policy'
             FROM hub_oauth_sessions o WHERE o.id=$2) END AS caller_area_policy,
           CASE WHEN g.caller_kind='pass' THEN
             (SELECT to_jsonb(c)->'service_profile_policy' FROM hub_callers c WHERE c.id=$2)
           ELSE (SELECT to_jsonb(o)->'service_profile_policy'
             FROM hub_oauth_sessions o WHERE o.id=$2) END AS caller_profile_policy,
           g.profile AS grant_profile,g.server_name
    FROM hub_servers s JOIN hub_server_grants g
      ON g.server_name=s.name AND g.owner_id=s.owner_id
    WHERE s.owner_id=$1 AND g.caller_kind=$3
      AND (g.caller_id=$2 OR (g.caller_kind='oauth' AND EXISTS(
        SELECT 1 FROM hub_oauth_sessions fresh
        JOIN hub_oauth_sessions initial ON initial.family_id=fresh.family_id
        WHERE fresh.id=$2 AND initial.id=g.caller_id
          AND fresh.owner_id=g.owner_id AND initial.owner_id=g.owner_id
          AND fresh.client_id=initial.client_id AND fresh.profile=initial.profile
          AND fresh.areas=initial.areas AND fresh.mode=initial.mode
          AND (to_jsonb(fresh)->'allowed_servers') IS NOT DISTINCT FROM
              (to_jsonb(initial)->'allowed_servers')
        AND (to_jsonb(fresh)->'service_area_policy') IS NOT DISTINCT FROM
            (to_jsonb(initial)->'service_area_policy')
          AND fresh.mode='test' AND fresh.revoked_at IS NULL
          AND initial.revoked_at IS NULL AND fresh.access_expires_at>now()
          AND NOT EXISTS(SELECT 1 FROM hub_oauth_sessions compromised
            WHERE compromised.family_id=fresh.family_id AND compromised.revoked_at IS NOT NULL))))
      AND s.state='active' AND g.verified_at IS NOT NULL
      AND g.revoked_at IS NULL AND g.expires_at>now()
      AND g.profile='read_only' AND g.mode='test'
      AND (
        (g.caller_kind='pass' AND EXISTS(
          SELECT 1 FROM hub_callers c WHERE c.id=g.caller_id
          AND c.owner_id=g.owner_id AND c.revoked_at IS NULL AND c.expires_at>now()
          AND c.profile IN ('read_only','everyday','full')
          AND c.mode='test' AND c.allow_writes=FALSE
          AND (NULLIF(to_jsonb(c)->'allowed_servers','null'::jsonb) IS NULL OR
            to_jsonb(c)->'allowed_servers' ? s.name)
          AND 'gateway'=ANY(c.allowed_areas)))
        OR (g.caller_kind='oauth' AND EXISTS(
          SELECT 1 FROM hub_oauth_sessions o WHERE o.id=$2
          AND o.owner_id=g.owner_id AND o.revoked_at IS NULL AND o.access_expires_at>now()
          AND o.profile IN ('read_only','everyday','full') AND o.mode='test'
          AND 'gateway'=ANY(o.areas)
          AND (NULLIF(to_jsonb(o)->'allowed_servers','null'::jsonb) IS NULL
            OR to_jsonb(o)->'allowed_servers' ? s.name)
          AND NOT EXISTS(SELECT 1 FROM hub_oauth_sessions compromised
            WHERE compromised.family_id=o.family_id AND compromised.revoked_at IS NOT NULL)))
      )
      AND ($5::text[] IS NULL OR s.name=ANY($5))
    ORDER BY s.name LIMIT $4`,[actor.ownerId,actor.id,callerKind,limit,
      Array.isArray(actor.serverNames) ? actor.serverNames : null]);
  return rows.map(row=>({name:row.name,prefix:row.prefix,
    claimedCounts:row.claimed_counts,areas:authorizedGrantAreas(row),
    effectiveProfile:limitedServiceProfile(row.grant_profile,actor.profile,
      row.caller_profile_policy,row.server_name),
    // Private cursor scope inputs only: never shown to callers in the
    // Hub namespace/search result or sent to an upstream provider.
    grantId:row.grant_id,origin:row.origin,
    verifiedAt:row.verified_at?.toISOString?.()??String(row.verified_at??''),
    state:'active',readOnlyGrant:true})).filter(row=>row.areas.length>0 && row.effectiveProfile!==null);
}

export async function activateVerifiedCallerGrant(db,{ownerId,id},settings,
  {ownerVerified=false,inspect=inspectScopedRtcIdentity}={}) {
  owner(ownerId,ownerVerified);
  if(!idPattern.test(id||''))throw new TypeError('Invalid grant identity');
  const result=await db.query(`SELECT g.*,s.origin,s.prefix,s.state
    FROM hub_server_grants g
    JOIN hub_servers s ON s.name=g.server_name AND s.owner_id=g.owner_id
    WHERE g.id=$1 AND g.owner_id=$2 AND g.revoked_at IS NULL
      AND g.expires_at>now() AND s.state IN ('pending','active')`,[id,ownerId]);
  const row=result.rows[0];
  if(!row) throw new Error('Owned pending TEST grant unavailable');
  await checkCaller(db,{ownerId,callerKind:row.caller_kind,callerId:row.caller_id,
    serverName:row.server_name});
  const decipher=createDecipheriv('aes-256-gcm',key(settings),row.nonce);
  decipher.setAAD(audience(row));
  decipher.setAuthTag(row.tag);
  const pass=Buffer.concat([
    decipher.update(row.ciphertext),decipher.final()]).toString('utf8');
  if(!passPattern.test(pass)) throw new Error('Invalid sealed TEST grant');
  // No persist/activation unless a true pinned contract + pass-specific
  // whoami response proves the exact scope. Tests inject only local fakes.
  const verified=await inspect({origin:row.origin,name:row.server_name,
    prefix:row.prefix,areas:[...row.areas],pass});
  if(!verified?.identityVerified||verified.callable!==false||
    verified.server!==row.server_name||verified.prefix!==row.prefix||
    verified.mode!=='test'||verified.profile!=='read_only'||
    !Array.isArray(verified.areas)||row.areas.some(a=>!verified.areas.includes(a)))
    throw new Error('Scoped RTC identity not verified');
  await checkCaller(db,{ownerId,callerKind:row.caller_kind,callerId:row.caller_id,
    serverName:row.server_name});
  if(row.state==='active')return completeActiveGrantActivation(db,
    {ownerId,id,staged:row,recheckCaller:()=>checkCaller(db,{
      ownerId,callerKind:row.caller_kind,callerId:row.caller_id,
      serverName:row.server_name})},{ownerVerified:true});
  const accepted=await db.query(`UPDATE hub_server_grants g
    SET verified_at=now() FROM hub_servers s
    WHERE g.id=$1 AND g.owner_id=$2 AND g.server_name=s.name
      AND s.owner_id=g.owner_id AND s.state IN ('pending','active')
      AND g.revoked_at IS NULL AND g.expires_at>now()
    RETURNING g.id`,[id,ownerId]);
  if(accepted.rowCount!==1) throw new Error('Grant changed during inspection');
  await db.query(`UPDATE hub_servers SET state='active',updated_at=now()
    WHERE name=$1 AND owner_id=$2 AND state='pending'`,
    [row.server_name,ownerId]);
  const final=await db.query(`SELECT state FROM hub_servers
    WHERE name=$1 AND owner_id=$2`,[row.server_name,ownerId]);
  if(final.rows[0]?.state!=='active')
    throw new Error('Server disabled during grant inspection');
  return {id,server:row.server_name,state:'verified_test',
    registryActive:true,providerRoutingEnabled:false};
}
