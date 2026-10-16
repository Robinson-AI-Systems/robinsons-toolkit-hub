import {createHash,createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {takeBudget} from './limits.js';
import {escapeHtml} from './owner-login.js';

// A verified Vercel project administrator must first set the production-only,
// sensitive HUB_OWNER_RECOVERY_CODE. The user enters that same code in this
// no-store HTTPS form; neither the passphrase nor the code enters Git, chat or
// the database. The existing verifier stays valid until a successful rotation.
const codePattern=/^[A-Za-z0-9_-]{43}$/;
const ownerPattern=/^[A-Za-z0-9:_-]{1,120}$/;
const hash=value=>createHash('sha256').update(value).digest();
const page=(status,message)=>({status,html:'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hub owner recovery</title><h1>Hub owner recovery</h1><p>'+escapeHtml(message)+'</p></html>'});
function configured(env,now) {
 const expires=Date.parse(env.HUB_OWNER_RECOVERY_EXPIRES||'');
 return !env.HUB_OWNER_SCRYPT && ownerPattern.test(env.HUB_OWNER_ID||'') &&
  typeof env.HUB_TOKEN_PEPPER==='string' && env.HUB_TOKEN_PEPPER.length>=32 &&
  codePattern.test(env.HUB_OWNER_RECOVERY_CODE||'') &&
  Number.isFinite(expires) && expires>now && expires-now<=72*60*60*1000;
}
export async function ownerRecovery(db,req,{env=process.env,now=()=>Date.now(),budget=takeBudget}={}){
 if(!configured(env,now()))return page(503,'Hub owner recovery is not enabled or has expired.');
 if(req.method==='GET'){
  // Vercel Deployment Protection may append a short-lived access query
  // parameter. GET is read-only: ignore all query keys without reading,
  // reflecting or treating them as recovery authority.
  return {status:200,html:'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset Hub owner passphrase</title><main><h1>Reset Hub owner passphrase</h1><p>Enter the one-time recovery code you saved privately in your Vercel project. Never send the code or passphrase through chat.</p><form method="POST" action="/api/owner/recover"><label>One-time recovery code <input type="password" name="recovery_code" autocomplete="off" required minlength="43" maxlength="43"></label><label>New passphrase <input type="password" name="password" autocomplete="new-password" required minlength="12" maxlength="256"></label><label>Confirm new passphrase <input type="password" name="confirmation" autocomplete="new-password" required minlength="12" maxlength="256"></label><button type="submit">Save new passphrase</button></form></main></html>'};
 }
 if(req.method!=='POST')return page(405,'Method not allowed.');
 const input=req.body;
 if(!input||typeof input!=='object'||Array.isArray(input)||
  Object.keys(input).some(key=>!['recovery_code','password','confirmation'].includes(key))||
  typeof input.password!=='string'||input.password.length<12||input.password.length>256||
  input.password!==input.confirmation||typeof input.recovery_code!=='string'||
  !codePattern.test(input.recovery_code))
  return page(400,'Enter a valid recovery code and matching passphrases of 12–256 characters.');
 // Owner-global budget, in addition to the route's per-transport-peer budget.
 // A guessed code must never cause a credential update.
 const attempts=await budget(db,{scope:'owner-recovery:'+env.HUB_OWNER_ID,
  pepper:env.HUB_TOKEN_PEPPER,max:5,seconds:900});
 if(!attempts.allowed)return page(429,'Too many attempts. Try again later.');
 if(!timingSafeEqual(hash(input.recovery_code),hash(env.HUB_OWNER_RECOVERY_CODE)))
  return page(403,'Recovery code not accepted.');
 const salt=randomBytes(16);
 const digest=scryptSync(input.password,salt,32,{N:16384,r:8,p:1,maxmem:32*1024*1024});
 const verifier='s1.'+salt.toString('base64url')+'.'+digest.toString('base64url');
 // A token can be consumed once, even with concurrent requests. The recovery
 // ledger and credential replacement commit atomically; failures roll back.
 const consumed=createHmac('sha256',env.HUB_TOKEN_PEPPER)
  .update('owner-recovery\0'+env.HUB_OWNER_ID+'\0'+input.recovery_code).digest('hex');
 await db.query('BEGIN');
 try {
  const used=await db.query(`INSERT INTO hub_owner_recovery_uses(owner_id,code_digest)
   SELECT owner_id,$2 FROM hub_owner_credentials WHERE owner_id=$1
   ON CONFLICT DO NOTHING RETURNING owner_id`,[env.HUB_OWNER_ID,consumed]);
  if(used.rows.length!==1){
   await db.query('ROLLBACK');return page(409,'Recovery code already used or owner is unavailable.');
  }
  const changed=await db.query(`UPDATE hub_owner_credentials SET verifier=$2
   WHERE owner_id=$1 RETURNING owner_id`,[env.HUB_OWNER_ID,verifier]);
  if(changed.rows.length!==1)throw new Error('Owner credential unavailable');
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}
 return page(200,'New Hub owner passphrase saved. Return to the Hub owner setup form.');
}
