import {inspectScopedRtcIdentity} from './pinned-identity.js';
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
async function checkCaller(db,{ownerId,callerKind,callerId}) {
  const sql=callerKind==='pass' ?
    `SELECT id,owner_id,profile,allowed_areas AS areas,mode,allow_writes
       FROM hub_callers WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL
       AND expires_at>now()` :
    `SELECT id,owner_id,profile,areas,mode,FALSE AS allow_writes
       FROM hub_oauth_sessions s WHERE id=$1 AND owner_id=$2
       AND revoked_at IS NULL AND access_expires_at>now()
       AND NOT EXISTS(SELECT 1 FROM hub_oauth_sessions compromised
         WHERE compromised.family_id=s.family_id AND compromised.revoked_at IS NOT NULL)`;
  const {rows}=await db.query(sql,[callerId,ownerId]);
  const a=rows[0];
  if(!a||a.profile!=='read_only'||a.mode!=='test'||a.allow_writes===true||
    !Array.isArray(a.areas)||!a.areas.includes('gateway')) throw new Error('Caller scope refuses grant');
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
  await checkCaller(db,{ownerId,callerKind,callerId});
  const host=await db.query(`SELECT state FROM hub_servers WHERE name=$1 AND owner_id=$2`,
    [serverName,ownerId]);
  if(host.rows.length!==1||host.rows[0].state!=='pending')
    throw new Error('Only owned pending services can stage grants');
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
    areas:[...areas],mode:'test',state:'staged',callable:false};
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
    expires_at,revoked_at FROM hub_server_grants
    WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100`,[ownerId]);
  return rows.map(r=>({id:r.id,server:r.server_name,callerKind:r.caller_kind,
    callerId:r.caller_id,areas:r.areas,expiresAt:r.expires_at,
    revoked:r.revoked_at!==null,callable:false}));
}
// Never expose this from owner HTML, tools or logs. H-3 may invoke it only
// after a separately verified, enabled origin and exact live caller scope.
export async function resolveActiveCallerGrant(db,{actor,serverName},settings) {
  if(!actor||actor.mode!=='test'||actor.profile!=='read_only'||actor.allowWrites===true||
    !actor.areas?.includes('gateway')||!namePattern.test(serverName||''))
    return null;
  const secret=key(settings);
  const {rows}=await db.query(`SELECT g.* FROM hub_server_grants g
    JOIN hub_servers s ON s.name=g.server_name AND s.owner_id=g.owner_id
    WHERE g.owner_id=$1 AND g.caller_id=$2 AND g.caller_kind=$3 AND g.server_name=$4
      AND g.revoked_at IS NULL AND g.expires_at>now() AND s.state='active'
      AND g.verified_at IS NOT NULL
      AND (
        (g.caller_kind='pass' AND EXISTS(
          SELECT 1 FROM hub_callers c WHERE c.id=g.caller_id
          AND c.owner_id=g.owner_id AND c.revoked_at IS NULL AND c.expires_at>now()
          AND c.profile='read_only' AND c.mode='test' AND c.allow_writes=FALSE
          AND 'gateway'=ANY(c.allowed_areas)))
        OR (g.caller_kind='oauth' AND EXISTS(
          SELECT 1 FROM hub_oauth_sessions o WHERE o.id=g.caller_id
          AND o.owner_id=g.owner_id AND o.revoked_at IS NULL
          AND o.access_expires_at>now() AND o.profile='read_only' AND o.mode='test'
          AND 'gateway'=ANY(o.areas)
          AND NOT EXISTS(SELECT 1 FROM hub_oauth_sessions compromised
            WHERE compromised.family_id=o.family_id AND compromised.revoked_at IS NOT NULL)))
      )`,
  [actor.ownerId,actor.id,actor.clientId?'oauth':'pass',serverName]);
  const row=rows[0];
  if(!row) return null;
  const decipher=createDecipheriv('aes-256-gcm',secret,row.nonce);
  decipher.setAAD(audience(row));
  decipher.setAuthTag(row.tag);
  const pass=Buffer.concat([decipher.update(row.ciphertext),decipher.final()]).toString('utf8');
  if(!passPattern.test(pass)) throw new Error('Invalid encrypted upstream credential');
  return {pass,grantId:row.id,areas:[...row.areas],profile:row.profile,mode:row.mode};
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
  await checkCaller(db,{ownerId,callerKind:row.caller_kind,callerId:row.caller_id});
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
  await checkCaller(db,{ownerId,callerKind:row.caller_kind,callerId:row.caller_id});
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
