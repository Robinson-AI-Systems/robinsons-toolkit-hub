// H-3 OAuth read-result pages. The original RTC1 pass-backed result table
// and handle flow remain unchanged. No provider bearer is ever stored here.
import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import {listActorUpstreamOauth} from './upstream-oauth-connections.js';
import {serverNamePattern} from './server-name.js';

const handlePattern=/^rtc_[A-Za-z0-9_-]{43}$/;
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const digest=(pepper,value)=>createHmac('sha256',pepper).update(value).digest('hex');
function settingsFor(actor,settings){
 if(!actor||!uuid.test(actor.id||'')||!actor.ownerId||
    typeof actor.clientId!=='string'||!actor.clientId||
    !['test','live'].includes(actor.mode)||!actor.areas?.includes('gateway')||
    actor.profile==='read_only'&&actor.allowWrites===true)
  throw Error('Invalid OAuth result reader');
 const keyString=settings?.resultsKey,pepper=settings?.pepper;
 if(typeof keyString!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(keyString)||
    typeof pepper!=='string'||pepper.length<32)
  throw Error('OAuth results vault unavailable');
 const key=Buffer.from(keyString,'base64url');
 if(key.length!==32||key.toString('base64url')!==keyString)
  throw Error('OAuth results vault unavailable');
 const caller=actor.ownerId+'\0'+actor.id;
 return {key,pepper,caller};
}
function fingerprint(c,pepper){
 return digest(pepper,JSON.stringify([c.id,c.name,c.origin,c.mode,c.profile,c.areas,c.family]));
}
function binding(caller,c){
 if(!uuid.test(c?.id||'')||!serverNamePattern.test(c.name||''))
  throw Error('Invalid OAuth handle binding');
 return Buffer.from([caller,c.id,c.name].join('\0'),'utf8');
}
async function current(db,actor,id){
 const rows=await listActorUpstreamOauth(db,actor);
 const found=rows.find(c=>c.id===id)??null;
 // An expired original provider credential cannot authorize disclosure of
 // an already-stored page. Refresh or re-consent through the normal issuer.
 return found&&Number.isFinite(new Date(found.expiresAt).getTime())&&
   new Date(found.expiresAt).getTime()>Date.now()?found:null;
}
export async function pruneExpiredOauthResults(db,{limit=100}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)
  throw new TypeError('Invalid OAuth result cleanup limit');
 const x=await db.query(`WITH expired AS (
 SELECT handle_digest FROM hub_upstream_oauth_result_handles
 WHERE expires_at<=now() ORDER BY expires_at,handle_digest LIMIT $1
 ) DELETE FROM hub_upstream_oauth_result_handles current USING expired
 WHERE current.handle_digest=expired.handle_digest`,[limit]);
 return x.rowCount;
}
export async function storeOauthResult(db,actor,connectionId,service,value,settings){
 const {key,pepper,caller}=settingsFor(actor,settings);
 if(!uuid.test(connectionId||'')||!serverNamePattern.test(service||''))
  throw Error('Invalid OAuth result ownership');
 const owned=await current(db,actor,connectionId);
 if(!owned||owned.name!==service)
  throw Error('OAuth result connection revoked or changed');
 const json=JSON.stringify(value);
 if(typeof json!=='string')throw Error('Invalid OAuth result value');
 const plain=Buffer.from(json,'utf8');
 if(plain.length<1||plain.length>65536)
  throw Error('OAuth result exceeds storage bound');
 await pruneExpiredOauthResults(db);
 const handle='rtc_'+randomBytes(32).toString('base64url');
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
 cipher.setAAD(binding(caller,owned));
 const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
 // INSERT rechecks current caller/connection authorization in SQL after
 // the payload is sealed; a revocation between lookup and store refuses.
 const stored=await db.query(`INSERT INTO hub_upstream_oauth_result_handles
 (handle_digest,owner_id,caller_digest,connection_id,server_name,
 scope_digest,ciphertext,nonce,tag,plain_bytes,expires_at)
 SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()+interval '1 hour'
 FROM hub_upstream_oauth_connections c
 JOIN hub_oauth_sessions s ON s.owner_id=c.owner_id AND s.family_id=c.caller_family
 WHERE c.id=$4 AND c.owner_id=$2 AND c.service_name=$5
 AND c.revoked_at IS NULL AND s.id=$11 AND s.revoked_at IS NULL
 AND s.access_expires_at>now() AND s.refresh_expires_at>now()
 AND c.mode=s.mode
 RETURNING handle_digest`,
 [digest(pepper,handle),actor.ownerId,digest(pepper,caller),
  connectionId,service,fingerprint(owned,pepper),encrypted,nonce,
  cipher.getAuthTag(),plain.length,actor.id]);
 if(stored.rowCount!==1)throw Error('OAuth result caller revoked before storage');
 return {handle,bytes:plain.length,pages:Math.ceil(plain.length/4096),readTool:'hub_result_read'};
}
export async function readOauthResult(db,actor,handle,page,settings){
 const {key,pepper,caller}=settingsFor(actor,settings);
 if(!handlePattern.test(handle||'')||!Number.isInteger(page)||page<0||page>15)
  return null;
 const {rows}=await db.query(`SELECT connection_id,server_name,scope_digest,
 ciphertext,nonce,tag,plain_bytes FROM hub_upstream_oauth_result_handles
 WHERE handle_digest=$1 AND owner_id=$2 AND caller_digest=$3 AND expires_at>now()`,
 [digest(pepper,handle),actor.ownerId,digest(pepper,caller)]);
 const row=rows[0];if(!row)return null;
 const owned=await current(db,actor,row.connection_id);
 if(!owned||owned.name!==row.server_name||
    fingerprint(owned,pepper)!==row.scope_digest)
  return null;
 const cipher=createDecipheriv('aes-256-gcm',key,row.nonce);
 cipher.setAAD(binding(caller,owned));
 cipher.setAuthTag(row.tag);
 const plain=Buffer.concat([cipher.update(row.ciphertext),cipher.final()]);
 if(plain.length!==row.plain_bytes||plain.length>65536)
  throw Error('OAuth result integrity failure');
 const pages=Math.ceil(plain.length/4096);
 if(page>=pages)return null;
 return {encoding:'base64url',data:plain.subarray(page*4096,
  Math.min((page+1)*4096,plain.length)).toString('base64url'),
  page,pages,bytes:plain.length,next:page+1<pages?page+1:null};
}
