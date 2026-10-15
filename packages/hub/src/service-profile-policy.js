// H-4 caller-owned per-service profile ceilings. No upstream credential,
// service grant or immutable provider envelope changes. A blocked profile is
// a permanent no-call choice for the existing pass or whole OAuth family.
const levels=Object.freeze({disabled:0,read_only:1,everyday:2,full:3});
const service=/^[a-z][a-z0-9_]{1,59}$/;
const owner=/^[A-Za-z0-9:_-]{1,120}$/;
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const own=(input,verified)=>{
 if(verified!==true||!owner.test(input?.ownerId||'')||
   !uuid.test(input?.id||'')||!service.test(input?.serverName||'')||
   !Object.hasOwn(levels,input?.profile??''))
  throw new TypeError('Verified narrow-only service-profile decision required');
};
export function ownerServiceProfiles(value) {
 if(value===null||value===undefined)return {};
 if(!value||typeof value!=='object'||Array.isArray(value))
  throw new TypeError('Malformed owner service profile policy');
 const keys=Object.keys(value);
 if(keys.length>20||keys.some(k=>!service.test(k)||!Object.hasOwn(levels,value[k])))
  throw new TypeError('Malformed owner service profile policy');
 return Object.fromEntries(keys.sort().map(k=>[k,value[k]]));
}
export function limitedServiceProfile(grantProfile,callerProfile,policy,serverName) {
 if(!Object.hasOwn(levels,grantProfile)||!Object.hasOwn(levels,callerProfile)||
    !service.test(serverName||''))
  throw new TypeError('Invalid independent RTC profile evidence');
 const stored=ownerServiceProfiles(policy);
 const ceiling=stored[serverName]??'full';
 const min=Math.min(levels[grantProfile],levels[callerProfile],levels[ceiling]);
 return min===0?null:Object.keys(levels).find(k=>levels[k]===min);
}
export async function narrowPassServiceProfile(db,input,{ownerVerified=false}={}) {
 own(input,ownerVerified);
 const {ownerId,id,serverName,profile}=input;
 // This system currently only accepts genuine read_only TEST grants.
 // A profile is a ceiling, never a request to upgrade a provider pass.
 const {rows}=await db.query(`WITH constrained AS (
   UPDATE hub_callers c SET service_profile_policy=jsonb_set(
     COALESCE(c.service_profile_policy,'{}'::jsonb),
     ARRAY[$3]::text[],to_jsonb($4::text),true)
   WHERE c.id=$1 AND c.owner_id=$2 AND c.revoked_at IS NULL
     AND c.expires_at>now() AND c.mode='test' AND c.allow_writes=FALSE
     AND (c.allowed_servers IS NULL OR $3=ANY(c.allowed_servers))
     AND $4=ANY(ARRAY['read_only','disabled']::text[])
     AND (c.service_profile_policy IS NULL OR
       NOT c.service_profile_policy ? $3 OR
       (c.service_profile_policy->>$3='read_only' AND $4='disabled'))
     AND EXISTS (SELECT 1 FROM hub_server_grants g
       JOIN hub_servers s ON s.name=g.server_name AND s.owner_id=g.owner_id
       WHERE g.caller_kind='pass' AND g.caller_id=c.id
         AND g.owner_id=$2 AND g.server_name=$3 AND s.state='active'
         AND g.verified_at IS NOT NULL AND g.revoked_at IS NULL
         AND g.expires_at>now() AND g.profile='read_only' AND g.mode='test')
   RETURNING c.id
 ), invalidated AS (
   DELETE FROM hub_rtc_result_handles h USING hub_server_grants g
   WHERE h.grant_id=g.id AND g.owner_id=$2
     AND g.caller_kind='pass' AND g.caller_id=$1
     AND g.server_name=$3 AND EXISTS(SELECT 1 FROM constrained)
   RETURNING h.handle_digest
 )
 INSERT INTO hub_caller_profile_audit
  (owner_id,caller_kind,caller_id,server_name,profile,affected_sessions,purged_handles)
 SELECT $2,'pass',$1,$3,$4,1,(SELECT count(*) FROM invalidated)
 FROM constrained RETURNING id`,[id,ownerId,serverName,profile]);
 return {updated:rows.length===1,server:serverName,
   profile:rows.length===1?profile:null};
}
export async function narrowOAuthServiceProfile(db,input,{ownerVerified=false}={}) {
 own(input,ownerVerified);
 const {ownerId,id,serverName,profile}=input;
 const {rows}=await db.query(`WITH family AS (
   SELECT s.family_id FROM hub_oauth_sessions s
   WHERE s.id=$1 AND s.owner_id=$2 AND s.revoked_at IS NULL
     AND s.refresh_expires_at>now() AND s.mode='test'
     AND (s.allowed_servers IS NULL OR $3=ANY(s.allowed_servers))
     AND $4=ANY(ARRAY['read_only','disabled']::text[])
     AND NOT EXISTS(SELECT 1 FROM hub_oauth_sessions other
       WHERE other.family_id=s.family_id
       AND (other.owner_id<>$2 OR other.revoked_at IS NOT NULL
         OR other.service_profile_policy IS DISTINCT FROM s.service_profile_policy
         OR other.service_area_policy IS DISTINCT FROM s.service_area_policy
         OR other.allowed_servers IS DISTINCT FROM s.allowed_servers))
     AND EXISTS(SELECT 1 FROM hub_server_grants g
       JOIN hub_oauth_sessions origin ON origin.id=g.caller_id
       JOIN hub_servers srv ON srv.name=g.server_name AND srv.owner_id=g.owner_id
       WHERE origin.family_id=s.family_id AND g.owner_id=$2
         AND g.caller_kind='oauth' AND g.server_name=$3
         AND srv.state='active' AND g.revoked_at IS NULL
         AND g.expires_at>now() AND g.verified_at IS NOT NULL
         AND g.profile='read_only' AND g.mode='test')
 ), constrained AS (
   UPDATE hub_oauth_sessions s SET service_profile_policy=jsonb_set(
     COALESCE(s.service_profile_policy,'{}'::jsonb),
     ARRAY[$3]::text[],to_jsonb($4::text),true)
   WHERE s.owner_id=$2 AND s.family_id IN (SELECT family_id FROM family)
     AND s.revoked_at IS NULL
     AND (s.service_profile_policy IS NULL OR
       NOT s.service_profile_policy ? $3 OR
       (s.service_profile_policy->>$3='read_only' AND $4='disabled'))
   RETURNING s.id
 ), invalidated AS (
   DELETE FROM hub_rtc_result_handles h USING hub_server_grants g
   WHERE h.grant_id=g.id AND g.owner_id=$2 AND g.caller_kind='oauth'
     AND g.server_name=$3 AND EXISTS(SELECT 1 FROM constrained)
     AND g.caller_id IN (SELECT origin.id FROM hub_oauth_sessions origin
       WHERE origin.family_id IN (SELECT family_id FROM family))
   RETURNING h.handle_digest
 )
 INSERT INTO hub_caller_profile_audit
  (owner_id,caller_kind,caller_id,server_name,profile,affected_sessions,purged_handles)
 SELECT $2,'oauth',$1,$3,$4,
   (SELECT count(*) FROM constrained),(SELECT count(*) FROM invalidated)
 FROM family WHERE EXISTS(SELECT 1 FROM constrained) RETURNING id`,
 [id,ownerId,serverName,profile]);
 return {updated:rows.length===1,server:serverName,
   profile:rows.length===1?profile:null};
}
export async function listOwnerProfileAudit(db,ownerId,{ownerVerified=false,limit=30}={}) {
 if(ownerVerified!==true||!owner.test(ownerId||'')||
   !Number.isInteger(limit)||limit<1||limit>50)
  throw new TypeError('Owner profile audit access refused');
 const {rows}=await db.query(`SELECT id,occurred_at,caller_kind,caller_id,
   server_name,profile,affected_sessions,purged_handles
   FROM hub_caller_profile_audit WHERE owner_id=$1
   ORDER BY id DESC LIMIT $2`,[ownerId,limit]);
 return rows.map(row=>({id:String(row.id),at:row.occurred_at,
   kind:row.caller_kind,callerId:row.caller_id,server:row.server_name,
   profile:row.profile,affectedSessions:Number(row.affected_sessions),
   purgedHandles:Number(row.purged_handles)}));
}
