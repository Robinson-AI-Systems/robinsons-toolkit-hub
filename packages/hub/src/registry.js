import {isIP} from 'node:net';

// A staged origin is NOT a trusted network target. H-2's guarded transport
// must pin/reject connection-time DNS results before making any HTTP request.
const slug=/^[a-z][a-z0-9_]{1,59}$/;
const label='[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const publicHost=new RegExp('^(?:'+label+'\\.){2,}'+label+'$');
const privateSuffix=/\.(?:local|localhost|internal|test|example|invalid|arpa|lan|home)$/;
function owner(ownerId,ownerVerified) {
  if (ownerVerified!==true || typeof ownerId!=='string' ||
    !/^[A-Za-z0-9:_-]{1,120}$/.test(ownerId))
    throw new Error('Independent verified owner required');
}
export function validateStagedOrigin(origin) {
  if (typeof origin!=='string' || origin.length>255) throw new TypeError('Invalid HTTPS origin');
  let url;
  try { url=new URL(origin); } catch { throw new TypeError('Invalid HTTPS origin'); }
  if (url.protocol!=='https:' || url.origin!==origin || url.port || url.username ||
    url.password || url.hash || url.search || url.pathname!=='/' ||
    isIP(url.hostname) || !publicHost.test(url.hostname) || privateSuffix.test(url.hostname) ||
    url.hostname.includes('xn--'))
    throw new TypeError('Public canonical HTTPS DNS origin required');
  return url.origin;
}
function manifestMetadata(manifest,name,prefix) {
  if (!manifest || typeof manifest!=='object' || Array.isArray(manifest) ||
    manifest.rtc!==1 || manifest.server!==name || manifest.prefix!==prefix ||
    !Array.isArray(manifest.modes) || !manifest.modes.includes('test') ||
    !Array.isArray(manifest.profiles) || !manifest.profiles.includes('read_only') ||
    !manifest.counts || !['tools','writes','money'].every(k=>
      Number.isSafeInteger(manifest.counts[k]) && manifest.counts[k]>=0))
    throw new TypeError('Invalid RTC 1 manifest claim');
  return {tools:manifest.counts.tools,writes:manifest.counts.writes,money:manifest.counts.money};
}
export async function stageHubServer(db,{ownerId,name,prefix,origin,manifest},
  {ownerVerified=false}={}) {
  owner(ownerId,ownerVerified);
  if (!slug.test(name||'') || !slug.test(prefix||'') ||
    name==='hub' || prefix==='hub')
    throw new TypeError('Invalid server identity');
  const safeOrigin=validateStagedOrigin(origin);
  const counts=manifestMetadata(manifest,name,prefix);
  // No remote request and no accepted status: manifest claims remain untrusted.
  await db.query(`INSERT INTO hub_servers
    (name,owner_id,prefix,origin,claimed_rtc,claimed_counts,state)
    VALUES($1,$2,$3,$4,1,$5::jsonb,'pending')`,
  [name,ownerId,prefix,safeOrigin,JSON.stringify(counts)]);
  return {name,prefix,origin:safeOrigin,state:'pending',verified:false,callable:false};
}
export async function listStagedServers(db,ownerId,{ownerVerified=false}={}) {
  owner(ownerId,ownerVerified);
  const {rows}=await db.query(`SELECT name,prefix,origin,state,claimed_counts
    FROM hub_servers WHERE owner_id=$1 ORDER BY name LIMIT 100`,[ownerId]);
  return rows.map(r=>({name:r.name,prefix:r.prefix,origin:r.origin,
    state:r.state,counts:r.claimed_counts,verified:false,callable:false}));
}
export async function disableStagedServer(db,{ownerId,name},{ownerVerified=false}={}) {
  owner(ownerId,ownerVerified);
  if (!slug.test(name||'')) throw new TypeError('Invalid server name');
  const result=await db.query(`UPDATE hub_servers
    SET state='disabled',updated_at=now()
    WHERE name=$1 AND owner_id=$2 AND state IN ('pending','active')`,[name,ownerId]);
  return result.rowCount===1;
}
