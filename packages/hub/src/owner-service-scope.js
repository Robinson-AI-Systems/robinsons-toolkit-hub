// H-4 owner-only scope inspector and immutable area-policy audit readback.
// No upstream credential, bearer, ciphertext, tool parameters or provider
// result may appear in this UI or the returned record.
import {limitedServiceProfile,ownerServiceProfiles} from './service-profile-policy.js';
import {effectiveGrantAreas} from './grants.js';
import {effectiveServiceAreas,sanitizedServicePolicy} from './service-area-policy.js';
const owner=/^[A-Za-z0-9:_-]{1,120}$/;
const id=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const server=/^[a-z][a-z0-9_]{1,59}$/;
function authorized(ownerId,verified) {
  if(verified!==true||!owner.test(ownerId||''))
    throw new Error('Independent owner authentication required');
}
export async function inspectOwnerServiceScope(db,{ownerId,callerKind,callerId,serverName},
 {ownerVerified=false}={}) {
  authorized(ownerId,ownerVerified);
  if(!['pass','oauth'].includes(callerKind)||!id.test(callerId||'')||
     !server.test(serverName||''))
    throw new TypeError('Invalid caller service selector');
  // Query CURRENT owner-scoped database rows, not the actor supplied in a
  // now-stale session or UI. A missing/retired upstream grant is never
  // presented as callable. The selected client must still be TEST-only.
  const passSQL=`SELECT g.id,g.areas,g.area_ceiling,g.profile,g.mode,
    c.service_area_policy AS policy,
    to_jsonb(c)->'service_profile_policy' AS profile_policy,c.profile AS caller_profile,
    g.expires_at,s.name AS server_name
    FROM hub_callers c JOIN hub_server_grants g
      ON g.caller_id=c.id AND g.owner_id=c.owner_id AND g.caller_kind='pass'
    JOIN hub_servers s ON s.name=g.server_name AND s.owner_id=g.owner_id
    WHERE c.owner_id=$1 AND c.id=$2 AND s.name=$3 AND s.state='active'
      AND c.mode='test' AND c.allow_writes=FALSE
      AND c.revoked_at IS NULL AND c.expires_at>now()
      AND (c.allowed_servers IS NULL OR $3=ANY(c.allowed_servers))
      AND g.revoked_at IS NULL AND g.expires_at>now()
      AND g.verified_at IS NOT NULL AND g.mode='test' AND g.profile='read_only'
    LIMIT 2`;
  const oauthSQL=`SELECT g.id,g.areas,g.area_ceiling,g.profile,g.mode,
    s.service_area_policy AS policy,
    to_jsonb(s)->'service_profile_policy' AS profile_policy,s.profile AS caller_profile,
    g.expires_at,server.name AS server_name
    FROM hub_oauth_sessions s JOIN hub_oauth_sessions initial
      ON initial.family_id=s.family_id AND initial.owner_id=s.owner_id
    JOIN hub_server_grants g ON g.caller_id=initial.id
      AND g.owner_id=s.owner_id AND g.caller_kind='oauth'
    JOIN hub_servers server ON server.name=g.server_name
      AND server.owner_id=g.owner_id
    WHERE s.owner_id=$1 AND s.id=$2 AND server.name=$3
      AND s.revoked_at IS NULL AND s.refresh_expires_at>now()
      AND s.mode='test' AND 'gateway'=ANY(s.areas)
      AND s.profile IN ('read_only','everyday','full')
      AND (s.allowed_servers IS NULL OR $3=ANY(s.allowed_servers))
      AND initial.revoked_at IS NULL
      AND (initial.service_area_policy IS NOT DISTINCT FROM s.service_area_policy)
      AND ((to_jsonb(initial)->'service_profile_policy') IS NOT DISTINCT FROM
        (to_jsonb(s)->'service_profile_policy'))
      AND NOT EXISTS(SELECT 1 FROM hub_oauth_sessions bad
        WHERE bad.family_id=s.family_id AND
          (bad.revoked_at IS NOT NULL
           OR bad.service_area_policy IS DISTINCT FROM s.service_area_policy
           OR (to_jsonb(bad)->'service_profile_policy') IS DISTINCT FROM
           (to_jsonb(s)->'service_profile_policy')))
      AND server.state='active' AND g.revoked_at IS NULL
      AND g.expires_at>now() AND g.verified_at IS NOT NULL
      AND g.profile='read_only' AND g.mode='test'
    LIMIT 2`;
  const {rows}=await db.query(callerKind==='pass'?passSQL:oauthSQL,
    [ownerId,callerId,serverName]);
  // Refuse ambiguous multiple live grants rather than claiming a false
  // permission. Production uniqueness also enforces this invariant.
  if(rows.length!==1)return {available:false,server:serverName,
    callable:false,explanation:'No uniquely verified active TEST grant'};
  const row=rows[0];
  const original=[...row.areas];
  const grantEffective=effectiveGrantAreas(row);
  const policy=sanitizedServicePolicy(row.policy);
  const effective=effectiveServiceAreas(grantEffective,policy,row.server_name);
  const chosen=limitedServiceProfile(row.profile,row.caller_profile,
    row.profile_policy,row.server_name);
  const profileLimits=ownerServiceProfiles(row.profile_policy);
  return {available:true,server:row.server_name,
    callable:effective.length>0&&chosen!==null,profile:chosen??'disabled',mode:'test',
    callerProfileLimit:profileLimits[serverName]??null,
    grantId:row.id,originalAreas:original,grantAreas:grantEffective,
    callerAreaLimit:policy[serverName]??null,authorizedAreas:effective,
    expiresAt:row.expires_at};
}
/**
 * Metadata-only evidence of owner reductions. Bounded newest-first reads
 * expose the kind of caller, selected service and areas only to the owner.
 * Counts describe local invalidation, not provider read acceptance.
 */
export async function listOwnerServiceAreaAudit(db,ownerId,{ownerVerified=false,
 limit=30}={}) {
  authorized(ownerId,ownerVerified);
  if(!Number.isInteger(limit)||limit<1||limit>50)
    throw new TypeError('Invalid owner audit bound');
  const {rows}=await db.query(`SELECT id,occurred_at,caller_kind,caller_id,
      server_name,areas,affected_sessions,purged_handles
    FROM hub_caller_service_area_audit
    WHERE owner_id=$1 ORDER BY id DESC LIMIT $2`,[ownerId,limit]);
  return rows.map(row=>({
    id:String(row.id),at:row.occurred_at,kind:row.caller_kind,
    callerId:row.caller_id,server:row.server_name,
    areas:[...row.areas],affectedSessions:Number(row.affected_sessions),
    purgedHandles:Number(row.purged_handles)
  }));
}
