// H-4 owner-verified onboarding and renewal of independently issued RTC
// TEST/read_only service grants for ALREADY active registered services.
// The external identity probe is completed before opening any transaction.
// Actual provider passes remain sealed in their original grant records.
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ownerPattern=/^[A-Za-z0-9:_-]{1,120}$/;
const area=/^[a-z][a-z0-9_]{0,59}$/;
const service=/^[a-z][a-z0-9_]{1,59}$/;
function verified(ownerId,ownerVerified) {
 if(!ownerPattern.test(ownerId||'')||ownerVerified!==true)
   throw new Error('Independently verified owner required');
}
function validGrantAreas(values) {
 return Array.isArray(values)&&values.length>=1&&values.length<=32&&
  values.every(x=>typeof x==='string'&&area.test(x))&&
  new Set(values).size===values.length;
}
export function replacementScopeAllowed(next,prior) {
 if(!validGrantAreas(next)||!validGrantAreas(prior))return false;
 return next.every(x=>prior.includes(x));
}
/**
 * The staged pass has ALREADY passed a DNS/TLS pinned RTC contract+whoami
 * TEST/read_only inspection. Recheck everything in one transaction on one
 * pooled pg Client, then retire old grant, purge handles and activate new
 * grant atomically. Other callers see EITHER old OR new, never a gap.
 */
export async function completeActiveGrantActivation(db,{ownerId,id,staged,
 recheckCaller},{ownerVerified=false}={}) {
 verified(ownerId,ownerVerified);
 if(!uuid.test(id||'')||staged?.id!==id||staged?.owner_id!==ownerId||
   !service.test(staged.server_name||'')||!validGrantAreas(staged.areas)||
   typeof recheckCaller!=='function')
   throw new TypeError('Invalid independently checked staged grant');
 let begun=false;
 try {
  await db.query('BEGIN');begun=true;
  const {rows}=await db.query(`SELECT g.*,s.state,s.origin,s.prefix
   FROM hub_server_grants g JOIN hub_servers s
     ON s.name=g.server_name AND s.owner_id=g.owner_id
   WHERE g.id=$1 AND g.owner_id=$2
   FOR UPDATE OF g,s`,[id,ownerId]);
  const current=rows[0];
  if(!current||current.owner_id!==staged.owner_id||
     current.server_name!==staged.server_name||
     current.caller_kind!==staged.caller_kind||
     current.caller_id!==staged.caller_id||
     current.profile!=='read_only'||current.mode!=='test'||
     current.state!=='active'||current.origin!==staged.origin||
     current.prefix!==staged.prefix||
     current.revoked_at!==null||current.verified_at!==null||
     new Date(current.expires_at).getTime()<=Date.now()||
     !replacementScopeAllowed(staged.areas,current.areas))
   throw new Error('TEST grant or approved RTC origin changed during inspection');
  await recheckCaller();
  // Old verified row is locked AFTER the service row, ensuring no two
  // competing owner renewals can both claim an old grant as active.
  const old=await db.query(`SELECT id,areas,
    to_jsonb(hub_server_grants)->'area_ceiling' AS area_ceiling,
    expires_at
    FROM hub_server_grants WHERE owner_id=$1 AND server_name=$2
      AND caller_kind=$3 AND caller_id=$4 AND id<>$5
      AND verified_at IS NOT NULL AND revoked_at IS NULL
    FOR UPDATE`,[ownerId,current.server_name,current.caller_kind,
     current.caller_id,id]);
  if(old.rows.length>1)
   throw new Error('Multiple active grants violate service identity boundary');
  const prior=old.rows[0];
  const priorAreas=prior?prior.area_ceiling??prior.areas:null;
  if(prior&&new Date(prior.expires_at).getTime()>Date.now()&&
     !replacementScopeAllowed(current.areas,priorAreas))
   throw new Error('Service credential renewal cannot restore removed areas');
  let purged=0,retired=null;
  if(prior){
   const gone=await db.query(`UPDATE hub_server_grants
     SET revoked_at=now() WHERE id=$1 AND owner_id=$2
       AND revoked_at IS NULL RETURNING id`,[prior.id,ownerId]);
   if(gone.rowCount!==1)throw new Error('Old scoped grant changed');
   retired=prior.id;
   const removed=await db.query(`DELETE FROM hub_rtc_result_handles
     WHERE grant_id=$1 RETURNING handle_digest`,[prior.id]);
   purged=removed.rowCount;
  }
  // This verification is the last write. If the unique active index, audit
  // table or any other check fails, the ROLLBACK restores the original
  // callable grant AND all of its previously stored encrypted result pages.
  const accepted=await db.query(`UPDATE hub_server_grants SET verified_at=now()
    WHERE id=$1 AND owner_id=$2 AND verified_at IS NULL
      AND revoked_at IS NULL AND expires_at>now()
    RETURNING id`,[id,ownerId]);
  if(accepted.rowCount!==1)throw new Error('Staged grant no longer activatable');
  const record=await db.query(`INSERT INTO hub_grant_lifecycle_audit
    (owner_id,server_name,caller_kind,caller_id,staged_grant_id,
     retired_grant_id,action,purged_handles,areas)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [ownerId,current.server_name,current.caller_kind,current.caller_id,id,
     retired,retired?'renewal':'additional_caller',purged,current.areas]);
  if(record.rows.length!==1)throw new Error('Missing credential lifecycle audit');
  await db.query('COMMIT');begun=false;
  return {id,server:current.server_name,state:'verified_test',
   registryActive:true,providerRoutingEnabled:false,
   replaced:retired,purgedHandles:purged,action:retired?'renewal':'additional_caller'};
 }catch(err){
  if(begun)try{await db.query('ROLLBACK');}catch{
   throw new Error('Grant renewal rollback unavailable');
  }
  throw err;
 }
}
/** Owner can cancel only a nonverified staged grant, never revoke a currently
 * working credential through this staging-cancellation action. */
export async function cancelStagedGrant(db,{ownerId,id},{ownerVerified=false}={}) {
 verified(ownerId,ownerVerified);
 if(!uuid.test(id||''))throw new TypeError('Invalid staged grant ID');
 const {rows}=await db.query(`WITH canceled AS (
   UPDATE hub_server_grants SET revoked_at=now()
   WHERE id=$1 AND owner_id=$2 AND verified_at IS NULL
     AND revoked_at IS NULL RETURNING id,server_name,caller_kind,caller_id,areas
 ), recorded AS (
   INSERT INTO hub_grant_lifecycle_audit
    (owner_id,server_name,caller_kind,caller_id,staged_grant_id,
     action,purged_handles,areas)
   SELECT $2,c.server_name,c.caller_kind,c.caller_id,c.id,
    'cancel_staged',0,c.areas FROM canceled c RETURNING id
 )
 SELECT id FROM recorded`,[id,ownerId]);
 return rows.length===1;
}
/**
 * Owner-private short history. The log never contains pass bytes, hashes,
 * ciphertext, remote requests or tools/args. Caller-specific records are
 * metadata useful for spotting expired, canceled and rotated grants.
 */
export async function listGrantLifecycleAudit(db,ownerId,
 {ownerVerified=false,limit=30}={}) {
 verified(ownerId,ownerVerified);
 if(!Number.isInteger(limit)||limit<1||limit>50)
   throw new TypeError('Invalid audit window');
 const {rows}=await db.query(`SELECT id,occurred_at,server_name,caller_kind,
   caller_id,staged_grant_id,retired_grant_id,action,areas,purged_handles
   FROM hub_grant_lifecycle_audit WHERE owner_id=$1
   ORDER BY id DESC LIMIT $2`,[ownerId,limit]);
 return rows.map(r=>({id:String(r.id),at:r.occurred_at,server:r.server_name,
   callerKind:r.caller_kind,callerId:r.caller_id,stagedId:r.staged_grant_id,
   retiredId:r.retired_grant_id,action:r.action,areas:[...r.areas],
   purgedHandles:Number(r.purged_handles)}));
}
