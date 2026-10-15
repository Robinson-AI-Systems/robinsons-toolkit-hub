import {escapeHtml,formFields,htmlHeaders,publicHubOrigin,
  verifyOwnerLogin} from './owner-login.js';
import {cancelStagedGrant,listGrantLifecycleAudit,
  reclaimExpiredStagedGrants,listOwnerGrantReadiness,
  revokeOwnerVerifiedGrant} from './grant-lifecycle.js';
import {stageCallerGrant,listCallerGrants,
  narrowCallerGrantAreas} from './grants.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slug=/^[a-z][a-z0-9_]{1,59}$/;
const area=/^[a-z][a-z0-9_]{0,59}$/;
const rtcPass=/^rtc_pass_[A-Za-z0-9_-]{43}$/;
function page(body) {
  return '<!doctype html><html lang="en"><meta charset="utf-8">'+
    '<title>Toolkit Hub RTC grants</title><main><h1>RTC upstream TEST grants</h1>'+
    '<p>Only independently issued, TEST/read_only service passes belong here. '+
    'No grant can call a pending server. Never place a pass in chat or tickets.</p>'+
    body+'</main></html>';
}
function form() {
  return page('<form method="POST" action="/api/owner/grants">'+
    '<input type="hidden" name="action" value="stage">'+
    '<label>Registered pending or active server <input name="server" maxlength="60" required></label>'+
    '<label>Caller kind (pass or oauth) <input name="kind" maxlength="5" required></label>'+
    '<label>Exact caller ID <input name="caller" maxlength="36" required></label>'+
    '<label>Allowed service areas (comma separated) <input name="areas" maxlength="2048" required></label>'+
    '<label>Independent RTC service TEST pass <input type="password" name="service_pass" '+
      'autocomplete="off" maxlength="52" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">Encrypt and stage grant (noncallable)</button></form>'+
    '<form method="POST" action="/api/owner/grants">'+
    '<input type="hidden" name="action" value="list">'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">List grant metadata</button></form>'+
    '<form method="POST" action="/api/owner/grants">'+
    '<input type="hidden" name="action" value="narrow_areas">'+
    '<label>Existing grant ID <input name="id" maxlength="36" required></label>'+
    '<label>Reduced service areas (comma separated) '+
    '<input name="areas" maxlength="2048" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<p>Cannot add areas or change the original service pass. This action is '+
    'irreversible; previously issued RTC result pages will be invalidated.</p>'+
    '<button type="submit">Permanently reduce grant areas</button></form>'+
    '<form method="POST" action="/api/owner/grants">'+
    '<input type="hidden" name="action" value="revoke">'+
    '<label>Grant ID <input name="id" maxlength="36" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">Revoke grant</button></form>'+
    '<form method="POST" action="/api/owner/grants">'+
    '<input type="hidden" name="action" value="cancel_staged">'+
    '<label>Unverified staged grant ID <input name="id" maxlength="36" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<p>Cancel a never-activated TEST pass; currently working passes cannot '+
    'be canceled here. Verification of a replacement must happen separately.</p>'+
    '<button type="submit">Cancel staged grant</button></form>'+
    '<form method="POST" action="/api/owner/grants">'+
    '<input type="hidden" name="action" value="audit">'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">Review grant onboarding and renewal audit</button></form>'+
    '<form method="POST" action="/api/owner/grants">'+
    '<input type="hidden" name="action" value="readiness">'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">Review staged, active and expired grant slots</button></form>'+
    '<form method="POST" action="/api/owner/grants">'+
    '<input type="hidden" name="action" value="reclaim_expired">'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<p>Reclaim at most 30 expired never-verified TEST grants. Does not '+
    'revoke, reverify, refresh or interrupt any verified provider credential.</p>'+
    '<button type="submit">Reclaim expired staged grants</button></form>');
}
function listing(rows) {
  return page('<p>Metadata only, at most 100; never displays pass material.</p><ul>'+
    rows.map(r=>'<li>'+escapeHtml(r.id)+' — '+escapeHtml(r.server)+
      ' ('+escapeHtml(r.callerKind)+' '+escapeHtml(r.callerId)+') '+
      escapeHtml((r.areas||[]).join(','))+' of original '+ 
      escapeHtml((r.originalAreas||r.areas||[]).join(','))+' — '+
      (r.revoked?'revoked':r.verified?'verified':'staged')+
      ', scoped TEST credential: yes</li>').join('')+'</ul>');
}
function readinessDisplay(rows) {
 return page('<h2>Grant lifecycle readiness (local metadata only)</h2>'+
   '<p>Verified locally does not mean a deployed RTC pass remains valid '+
   'upstream. Verification is separately controlled.</p><ul>'+
   rows.map(r=>'<li><code>'+escapeHtml(r.id)+'</code> '+
     escapeHtml(r.server)+' / '+escapeHtml(r.callerKind)+' '+
     escapeHtml(r.callerId)+' — '+escapeHtml(r.state)+
     '; allowed areas '+escapeHtml(r.areas.join(', '))+
     '; expires '+escapeHtml(String(r.expiresAt))+'</li>').join('')+'</ul>');
}
function auditDisplay(rows) {
  return page('<h2>Owner RTC grant onboarding/renewal history</h2>'+
    '<p>Local metadata only. No pass bytes, hashes or provider calls.</p><ul>'+
    rows.map(row=>'<li>'+escapeHtml(String(row.at))+' '+
      escapeHtml(row.action)+' '+escapeHtml(row.server)+' / '+
      escapeHtml(row.callerKind)+' '+escapeHtml(row.callerId)+
      '; areas '+escapeHtml(row.areas.join(', '))+
      '; retired '+escapeHtml(row.retiredId??'none')+
      '; deleted result pages '+escapeHtml(String(row.purgedHandles))+
      '</li>').join('')+'</ul>');
}
function parseAreas(raw) {
  if(typeof raw!=='string'||raw.length>2048) return null;
  const parts=raw.split(',');
  if(!parts.length||parts.length>32||parts.some(x=>!area.test(x))||
    new Set(parts).size!==parts.length) return null;
  return parts;
}
function validate(input) {
  if(!input||!['stage','list','revoke','narrow_areas','cancel_staged','audit','readiness','reclaim_expired'].includes(input.action)||
    typeof input.password!=='string'||!input.password||input.password.length>256)
    return null;
  if(['list','audit','readiness','reclaim_expired'].includes(input.action)) return {};
  if(input.action==='cancel_staged')return uuid.test(input.id||'')?{}:null;
  if(input.action==='revoke') return uuid.test(input.id||'')?{}:null;
  if(input.action==='narrow_areas') {
    const areas=parseAreas(input.areas);
    return uuid.test(input.id||'')&&areas?{areas}:null;
  }
  const areas=parseAreas(input.areas);
  if(!slug.test(input.server||'')||!['pass','oauth'].includes(input.kind)||
    !uuid.test(input.caller||'')||!rtcPass.test(input.service_pass||'')||!areas)
    return null;
  return {areas};
}
export async function handleOwnerGrants(req,res,{withDb,env=process.env,
  verify=verifyOwnerLogin,stage=stageCallerGrant,list=listCallerGrants,
  revoke=revokeOwnerVerifiedGrant,narrow=narrowCallerGrantAreas,
  cancel=cancelStagedGrant,history=listGrantLifecycleAudit,
  reclaim=reclaimExpiredStagedGrants,readiness=listOwnerGrantReadiness}={}) {
  htmlHeaders(res);
  res.setHeader('Pragma','no-cache');
  if(!['GET','POST'].includes(req.method)) {
    res.setHeader('Allow','GET, POST');
    return res.status(405).send('Method not allowed');
  }
  try {publicHubOrigin(env);}
  catch {return res.status(503).send('Hub owner setup unavailable');}
  if(req.method==='GET') return res.status(200).send(form());
  if(!String(req.headers?.['content-type']||'').startsWith(
    'application/x-www-form-urlencoded'))
    return res.status(415).send('Unsupported content type');
  const fields=formFields(req);
  const safe=validate(fields);
  if(!safe) return res.status(400).send('Invalid request');
  try {
    return await withDb(async(db,settings)=>{
      const verdict=await verify(db,req,fields.password,{env});
      if(!verdict.approved) {
        if(verdict.retryAfter)res.setHeader('Retry-After',String(verdict.retryAfter));
        return res.status(verdict.retryAfter?429:401).send('Owner verification denied');
      }
      if(fields.action==='readiness')
        return res.status(200).send(readinessDisplay(
          await readiness(db,env.HUB_OWNER_ID,{ownerVerified:true})));
      if(fields.action==='reclaim_expired'){
        const result=await reclaim(db,env.HUB_OWNER_ID,{ownerVerified:true});
        return res.status(200).send('Reclaimed '+result.reclaimed+
          ' expired never-verified staged TEST grants. Verified grants unchanged.');
      }
      if(fields.action==='audit')return res.status(200).send(
        auditDisplay(await history(db,env.HUB_OWNER_ID,{ownerVerified:true})));
      if(fields.action==='cancel_staged'){
        const canceled=await cancel(db,{ownerId:env.HUB_OWNER_ID,
          id:fields.id},{ownerVerified:true});
        return res.status(canceled?200:404).send(canceled?
          'Unverified TEST grant canceled; no active credential changed.' :
          'Staged grant unavailable or already verified.');
      }
      if(fields.action==='list') return res.status(200).send(listing(
        await list(db,env.HUB_OWNER_ID,{ownerVerified:true})));
      if(fields.action==='narrow_areas') {
        const result=await narrow(db,{ownerId:env.HUB_OWNER_ID,id:fields.id,
          areas:safe.areas},{ownerVerified:true});
        return res.status(result.updated?200:404).send(result.updated?
          'RTC grant areas permanently reduced; old RTC result pages invalidated.' :
          'Grant unavailable or request would expand its area scope.');
      }
      if(fields.action==='revoke') {
        const done=await revoke(db,{ownerId:env.HUB_OWNER_ID,id:fields.id},
          {ownerVerified:true});
        return res.status(done?200:404).send(done?
          'Grant revoked now. No upstream call was made.' : 'Grant unavailable.');
      }
      const staged=await stage(db,{ownerId:env.HUB_OWNER_ID,serverName:fields.server,
        callerKind:fields.kind,callerId:fields.caller,areas:safe.areas,
        pass:fields.service_pass,ttlSeconds:86400},
        {ownerVerified:true,settings});
      return res.status(201).send(page('<p>Encrypted grant staged only. '+
        'Pass bytes will not be displayed again. No routing enabled. '+
        'Open /api/owner/verify-grant and independently verify the exact '+
        'staged ID before routing can use it: <code>'+escapeHtml(staged.id)+
        '</code>. Existing verified grants remain callable until a valid '+
        'replacement is proven and atomically installed.</p>'));
    });
  } catch {return res.status(503).send(
    'RTC grant setup unavailable; no routing enabled.');}
}
