import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
const handleFormat=/^[A-Za-z0-9_-]{43}$/;
const pageBytes=4096;
function configuration(settings) {
  if(typeof settings?.pepper!=='string'||settings.pepper.length<32||
    typeof settings?.resultsKey!=='string'||!handleFormat.test(settings.resultsKey))
    throw new Error('Hub result encryption unavailable');
  const key=Buffer.from(settings.resultsKey,'base64url');
  if(key.length!==32||key.toString('base64url')!==settings.resultsKey)
    throw new Error('Hub result encryption unavailable');
  return {key,pepper:settings.pepper};
}
function hash(pepper,text) {
  return createHmac('sha256',pepper).update(text).digest('hex');
}
function callerScope(actor) {
  if(!actor||typeof actor.ownerId!=='string'||!actor.ownerId||
    typeof actor.id!=='string'||!actor.id||actor.mode!=='test'||
    actor.allowWrites===true||!Array.isArray(actor.areas)||!actor.areas.includes('gateway'))
    throw new Error('Out of Hub result scope');
  return actor.ownerId+'\u0000'+actor.id;
}
export async function storeHubResult(db,actor,result,settings,{ttlSeconds=86400}={}) {
  const {key,pepper}=configuration(settings),scope=callerScope(actor);
  if(!Number.isInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>86400)
    throw new TypeError('Invalid TTL');
  let serialized;
  try {serialized=JSON.stringify(result);}catch {throw new TypeError('Invalid JSON');}
  if(typeof serialized!=='string') throw new TypeError('Invalid JSON');
  const plain=Buffer.from(serialized,'utf8');
  if(!plain.length||plain.length>65536) throw new RangeError('Result exceeds 64 KiB');
  const handle=randomBytes(32).toString('base64url'),nonce=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,nonce);
  cipher.setAAD(Buffer.from(scope));
  const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
  await db.query('INSERT INTO hub_result_handles (handle_digest,owner_id,caller_digest,'+
    'ciphertext,nonce,tag,plain_bytes,expires_at) VALUES '+
    "($1,$2,$3,$4,$5,$6,$7,now()+$8::INTEGER*interval '1 second')",
    [hash(pepper,handle),actor.ownerId,hash(pepper,scope),ciphertext,nonce,
      cipher.getAuthTag(),plain.length,ttlSeconds]);
  return {handle,bytes:plain.length,pages:Math.ceil(plain.length/pageBytes)};
}
export async function readHubResult(db,actor,handle,page,settings) {
  const {key,pepper}=configuration(settings),scope=callerScope(actor);
  if(typeof handle!=='string'||!handleFormat.test(handle)||
    !Number.isInteger(page)||page<0||page>15) return null;
  const {rows}=await db.query('SELECT ciphertext,nonce,tag,plain_bytes '+
    'FROM hub_result_handles WHERE handle_digest=$1 AND owner_id=$2 '+
    'AND caller_digest=$3 AND expires_at>now()',
  [hash(pepper,handle),actor.ownerId,hash(pepper,scope)]);
  const row=rows[0];
  if(!row) return null;
  if(!Buffer.isBuffer(row.ciphertext)||!Buffer.isBuffer(row.nonce)||
    row.nonce.length!==12||!Buffer.isBuffer(row.tag)||row.tag.length!==16||
    !Number.isInteger(row.plain_bytes)||row.plain_bytes<1||row.plain_bytes>65536)
    throw new Error('Invalid encrypted result');
  const cipher=createDecipheriv('aes-256-gcm',key,row.nonce);
  cipher.setAAD(Buffer.from(scope));cipher.setAuthTag(row.tag);
  const plain=Buffer.concat([cipher.update(row.ciphertext),cipher.final()]);
  if(plain.length!==row.plain_bytes) throw new Error('Result integrity mismatch');
  const pages=Math.ceil(plain.length/pageBytes);
  if(page>=pages) return null;
  return {encoding:'base64url',
    data:plain.subarray(page*pageBytes,Math.min((page+1)*pageBytes,plain.length))
      .toString('base64url'),
    page,pages,bytes:plain.length,next:page+1<pages?page+1:null};
}
