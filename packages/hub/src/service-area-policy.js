// H-4: an extra, caller-owned least-privilege filter on a separately
// issued service grant. The sealed provider TEST pass, its original RTC areas,
// profile and encryption AAD never change when its caller removes an area.
// Per-service policy is resolved from CURRENT SQL for every discovery/read.
const area=/^[a-z][a-z0-9_]{0,59}$/;
const service=/^[a-z][a-z0-9_]{1,59}$/;
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ownerId=/^[A-Za-z0-9:_-]{1,120}$/;
export function parseServiceAreas(raw) {
  if(typeof raw!=='string'||raw.length>2048)return null;
  const values=raw.split(',');
  return validServiceAreas(values)?values:null;
}
export function validServiceAreas(values) {
  return Array.isArray(values)&&values.length>=1&&values.length<=32&&
    values.every(a=>typeof a==='string'&&area.test(a))&&
    new Set(values).size===values.length;
}
export function effectiveServiceAreas(grantAreas,policy,serverName) {
  if(!validServiceAreas(grantAreas)||!service.test(serverName||''))
    throw new TypeError('Invalid RTC service grant scope');
  if(policy===null||policy===undefined)return [...grantAreas];
  if(!policy||typeof policy!=='object'||Array.isArray(policy)||
     Object.getPrototypeOf(policy)!==Object.prototype)
    throw new TypeError('Invalid caller policy');
  const selected=Object.hasOwn(policy,serverName)?policy[serverName]:null;
  if(selected===null)return [...grantAreas];
  if(!validServiceAreas(selected))
    throw new TypeError('Invalid caller service area policy');
  return grantAreas.filter(a=>selected.includes(a));
}
function verifiedScope(input,ownerVerified) {
  if(ownerVerified!==true||!ownerId.test(input?.ownerId||'')||
     !uuid.test(input?.id||'')||!service.test(input?.serverName||'')||
     !validServiceAreas(input?.areas))
    throw new TypeError('Independently verified narrow-only RTC area policy required');
}
export async function narrowHubPassServiceAreas(db,input,{ownerVerified=false}={}) {
  verifiedScope(input,ownerVerified);
  const {ownerId:owner,id,serverName:name,areas}=input;
  // Atomic SQL: the pass row is locked/rechecked, an independently verified
  // original grant is required, previous stored result handles are erased,
  // and the nonsecret owner audit is committed with the restriction.
  const {rows}=await db.query(`WITH reduced AS (
    UPDATE hub_callers c SET service_area_policy=jsonb_set(
      COALESCE(c.service_area_policy,'{}'::jsonb),ARRAY[$3]::text[],
      to_jsonb($4::text[]),true)
    WHERE c.id=$1 AND c.owner_id=$2 AND c.revoked_at IS NULL
      AND c.expires_at>now() AND c.mode='test' AND c.allow_writes=FALSE
      AND (c.allowed_servers IS NULL OR $3=ANY(c.allowed_servers))
      AND (c.service_area_policy IS NULL OR
        NOT (c.service_area_policy ? $3) OR
        c.service_area_policy->$3 @> to_jsonb($4::text[]))
      AND EXISTS (SELECT 1 FROM hub_server_grants g
        JOIN hub_servers s ON s.name=g.server_name AND s.owner_id=g.owner_id
        WHERE g.caller_kind='pass' AND g.caller_id=c.id
          AND g.owner_id=$2 AND g.server_name=$3 AND s.state='active'
          AND g.revoked_at IS NULL AND g.expires_at>now()
          AND g.verified_at IS NOT NULL AND g.mode='test'
          AND g.profile='read_only'
          AND $4::text[] <@ COALESCE(g.area_ceiling,g.areas))
    RETURNING c.id
  ), invalidated AS (
    DELETE FROM hub_rtc_result_handles h USING hub_server_grants g
    WHERE g.id=h.grant_id AND g.owner_id=$2 AND g.caller_kind='pass'
      AND g.caller_id=$1 AND g.server_name=$3
      AND EXISTS(SELECT 1 FROM reduced)
    RETURNING h.handle_digest
  )
  INSERT INTO hub_caller_service_area_audit
    (owner_id,caller_kind,caller_id,server_name,areas,affected_sessions,purged_handles)
  SELECT $2,'pass',$1,$3,$4::text[],1,(SELECT count(*) FROM invalidated)
  FROM reduced RETURNING id`,[id,owner,name,areas]);
  return {updated:rows.length===1,serverName:name,
    areas:rows.length===1?[...areas]:null};
}
export async function narrowOAuthFamilyServiceAreas(db,input,{ownerVerified=false}={}) {
  verifiedScope(input,ownerVerified);
  const {ownerId:owner,id,serverName:name,areas}=input;
  // The family is the revocation and scope unit, not an individual rotating
  // bearer. Check all generations and rewrite them together; SQL's updated
  // row predicate also prevents a racing change from reinstating old areas.
  const {rows}=await db.query(`WITH family AS (
    SELECT s.family_id FROM hub_oauth_sessions s
    WHERE s.id=$1 AND s.owner_id=$2 AND s.revoked_at IS NULL
      AND s.refresh_expires_at>now() AND s.mode='test'
      AND (s.allowed_servers IS NULL OR $3=ANY(s.allowed_servers))
      AND NOT EXISTS (SELECT 1 FROM hub_oauth_sessions conflict
        WHERE conflict.family_id=s.family_id
          AND (conflict.owner_id<>$2 OR conflict.revoked_at IS NOT NULL
            OR conflict.service_area_policy IS DISTINCT FROM s.service_area_policy))
      AND EXISTS (SELECT 1 FROM hub_server_grants g
        JOIN hub_oauth_sessions origin ON origin.id=g.caller_id
        JOIN hub_servers server ON server.name=g.server_name
          AND server.owner_id=g.owner_id
        WHERE origin.family_id=s.family_id AND g.owner_id=$2
          AND g.caller_kind='oauth' AND g.server_name=$3
          AND server.state='active' AND g.revoked_at IS NULL
          AND g.expires_at>now() AND g.verified_at IS NOT NULL
          AND g.mode='test' AND g.profile='read_only'
          AND $4::text[] <@ COALESCE(g.area_ceiling,g.areas))
  ), reduced AS (
    UPDATE hub_oauth_sessions s SET service_area_policy=jsonb_set(
      COALESCE(s.service_area_policy,'{}'::jsonb),ARRAY[$3]::text[],
      to_jsonb($4::text[]),true)
    WHERE s.family_id IN (SELECT family_id FROM family)
      AND s.owner_id=$2 AND s.revoked_at IS NULL
      AND (s.service_area_policy IS NULL OR
        NOT (s.service_area_policy ? $3) OR
        s.service_area_policy->$3 @> to_jsonb($4::text[]))
    RETURNING s.id
  ), invalidated AS (
    DELETE FROM hub_rtc_result_handles h USING hub_server_grants g
    WHERE g.id=h.grant_id AND g.owner_id=$2 AND g.caller_kind='oauth'
      AND g.server_name=$3 AND EXISTS(SELECT 1 FROM reduced)
      AND g.caller_id IN (SELECT id FROM hub_oauth_sessions
        WHERE family_id IN (SELECT family_id FROM family))
    RETURNING h.handle_digest
  )
  INSERT INTO hub_caller_service_area_audit
    (owner_id,caller_kind,caller_id,server_name,areas,affected_sessions,purged_handles)
  SELECT $2,'oauth',$1,$3,$4::text[],
    (SELECT count(*) FROM reduced),(SELECT count(*) FROM invalidated)
  FROM family WHERE EXISTS(SELECT 1 FROM reduced)
  RETURNING id`,[id,owner,name,areas]);
  return {updated:rows.length===1,serverName:name,
    areas:rows.length===1?[...areas]:null};
}
// Owner-only metadata formatter. Never return a service pass, Hub bearer,
// HMAC digest or encrypted grant material. A malformed stored scope fails
// closed rather than being silently presented as a wide default.
export function sanitizedServicePolicy(value) {
  if(value===null||value===undefined)return {};
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new TypeError('Malformed service area policy');
  const keys=Object.keys(value);
  if(keys.length>20||keys.some(k=>!service.test(k)||!validServiceAreas(value[k])))
    throw new TypeError('Malformed service area policy');
  return Object.fromEntries(keys.sort().map(k=>[k,[...value[k]]]));
}

/** Initial owner restrictions: server:area|area,other:area. */
export function parseInitialServiceAreas(raw,serverNames) {
 if(raw===undefined||raw===null||raw==='')return null;
 if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>2048||
   !Array.isArray(serverNames)||serverNames.length<1||serverNames.length>20)
   throw new TypeError('Invalid initial RTC service areas');
 const permitted=new Set(serverNames),entries=raw.split(','),result={};
 if(entries.length<1||entries.length>20)
   throw new TypeError('Too many initial RTC service areas');
 for(const entry of entries){
   const pivot=entry.indexOf(':');
   if(pivot<1||pivot!==entry.lastIndexOf(':'))
     throw new TypeError('Malformed initial RTC service area');
   const name=entry.slice(0,pivot),areas=entry.slice(pivot+1).split('|');
   if(!service.test(name)||!permitted.has(name)||
     Object.hasOwn(result,name)||!validServiceAreas(areas))
     throw new TypeError('Unregistered, duplicate or invalid RTC service area');
   result[name]=areas;
 }
 return result;
}
export function checkedInitialServiceAreas(value,serverNames) {
 if(value===undefined||value===null)return null;
 const checked=sanitizedServicePolicy(value);
 if(!Array.isArray(serverNames)||serverNames.length<1||
   Object.keys(checked).some(name=>!serverNames.includes(name)))
   throw new TypeError('Initial service areas must be owner-selected and scoped');
 return Object.keys(checked).length?checked:null;
}
