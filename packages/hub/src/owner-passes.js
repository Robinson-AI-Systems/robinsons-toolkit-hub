import {serverNamePattern} from './server-name.js';
import {parseOwnerServiceAreaPlan,previewOwnerServiceAreaPlan,
 executeOwnerServiceAreaPlan} from './service-area-plan.js';
import { issueHubPass, revokeHubPass, narrowHubPassServers,
  listHubPassScopes } from './identity.js';
import {parseInitialServiceProfiles,narrowPassServiceProfile,listOwnerProfileAudit} from './service-profile-policy.js';
import {inspectOwnerServiceScope,listOwnerServiceAreaAudit} from './owner-service-scope.js';
import {narrowHubPassServiceAreas,parseServiceAreas,parseInitialServiceAreas} from './service-area-policy.js';
import { parseOwnerServerSelection } from './server-selection.js';
import { escapeHtml, formFields, htmlHeaders, publicHubOrigin,
  verifyOwnerLogin } from './owner-login.js';

function page(content) {
  return '<!doctype html><html lang="en"><meta charset="utf-8">' +
    '<title>Toolkit Hub owner passes</title><main><h1>Hub connection passes</h1>' +
    '<p>These passes access only the Hub in read-only TEST mode. ' +
    'Upstream service passes must be issued and scoped independently.</p>' +
    '<p><a href="/api/owner/dashboard">Open private owner control center</a></p>' +
    content + '</main></html>';
}
function passForm() {
  return page('<form method="POST" action="/api/owner/passes">' +
    '<input type="hidden" name="action" value="issue">' +
    '<label>Owner passphrase <input type="password" name="password" ' +
    'autocomplete="current-password" required></label>' +
    '<label>Authorized RTC servers (registered names, comma separated) ' +
    '<input name="servers" maxlength="1300" required></label>' +
    '<label>Optional initial service profiles, e.g. stripe=read_only,neon=disabled ' +
    '<input name="profiles" maxlength="1300"></label>'+
    '<label>Optional initial RTC areas (stripe:billing|reports,workspace:drive) '+
    '<input name="service_areas" maxlength="2048"></label>' +
    '<p>Any chosen disabled service is unavailable from first issuance. ' +
    'All permitted services remain limited by independent read_only RTC passes.</p>' +
    '<p>This pass cannot discover or call other servers, even if additional ' +
    'upstream grants are configured. Every selected service still needs its ' +
    'separate verified TEST read-only grant.</p>' +
    '<button type="submit">Create one-day read-only TEST pass</button></form>' +
    '<form method="POST" action="/api/owner/passes">' +
    '<label>Hub pass ID <input name="id" maxlength="36" required></label>' +
    '<label>Reduced areas for 1-10 selected services (stripe:billing|reports,workspace:drive) '+
    '<input name="area_plan" maxlength="2048" required></label>' +
    '<label>Owner passphrase <input type="password" name="password" required></label>' +
    '<button name="action" value="preview_area_plan">Preview only</button>' +
    '<button name="action" value="narrow_area_plan">Permanently narrow all</button>' +
    '<p>Atomic: either every reduction commits or none.</p></form>' +
    '<form method="POST" action="/api/owner/passes">' +
    '<input type="hidden" name="action" value="list">' +
    '<label>Owner passphrase <input type="password" name="password" ' +
    'autocomplete="current-password" required></label>' +
    '<button type="submit">Review pass scopes</button></form>' +
    '<form method="POST" action="/api/owner/passes">' +
    '<input type="hidden" name="action" value="narrow">' +
    '<label>Existing pass identifier <input name="id" maxlength="36" required></label>' +
    '<label>Reduced RTC server names, comma separated ' +
    '<input name="servers" maxlength="1300" required></label>' +
    '<label>Owner passphrase <input type="password" name="password" ' +
    'autocomplete="current-password" required></label>' +
    '<p>Restriction is permanent for this pass. Existing grants cannot expand ' +
    'the narrowed list. Reissue a new pass for new permissions.</p>' +
    '<button type="submit">Permanently narrow this pass</button></form>' +
    '<form method="POST" action="/api/owner/passes">' +
    '<input type="hidden" name="action" value="narrow_areas">' +
    '<label>Existing pass ID <input name="id" maxlength="36" required></label>' +
    '<label>One authorized RTC server <input name="server" maxlength="60" required></label>' +
    '<label>Reduced provider areas <input name="areas" maxlength="2048" required></label>' +
    '<label>Owner passphrase <input type="password" name="password" required></label>' +
    '<p>This permanently restricts the pass at this service, without changing ' +
    'its independently issued read-only service pass. Cached RTC result pages ' +
    'for this service are deleted immediately.</p>' +
    '<button type="submit">Reduce this pass service areas</button></form>' +
    '<form method="POST" action="/api/owner/passes">' +
    '<input type="hidden" name="action" value="narrow_profile">' +
    '<label>Pass ID <input name="id" maxlength="36" required></label>' +
    '<label>Registered RTC service <input name="server" maxlength="60" required></label>' +
    '<label>New ceiling (read_only or disabled) ' +
    '<select name="profile"><option value="read_only">Read only</option>' +
    '<option value="disabled">Disable this service permanently</option></select></label>' +
    '<label>Owner passphrase <input type="password" name="password" required></label>' +
    '<p>One-way reduction; disabled connections cannot be re-enabled or read ' +
    'prior encrypted result pages without a NEW owner-approved connection.</p>' +
    '<button type="submit">Permanently narrow service profile</button></form>' +
    '<form method="POST" action="/api/owner/passes">' +
    '<input type="hidden" name="action" value="inspect_service">' +
    '<label>Pass ID <input name="id" maxlength="36" required></label>' +
    '<label>RTC server <input name="server" maxlength="60" required></label>' +
    '<label>Owner passphrase <input type="password" name="password" required></label>' +
    '<button type="submit">Inspect current effective service scope</button></form>' +
    '<form method="POST" action="/api/owner/passes">' +
    '<input type="hidden" name="action" value="audit">' +
    '<label>Owner passphrase <input type="password" name="password" required></label>' +
    '<button type="submit">Review service area policy audit</button></form>' +
    '<form method="POST" action="/api/owner/passes">' +
    '<input type="hidden" name="action" value="profile_audit">' +
    '<label>Owner passphrase <input type="password" name="password" required></label>' +
    '<button type="submit">Review service-profile restrictions</button></form>' +
    '<form method="POST" action="/api/owner/passes">' +
    '<input type="hidden" name="action" value="revoke">' +
    '<label>Pass identifier <input name="id" maxlength="36" required></label>' +
    '<label>Owner passphrase <input type="password" name="password" ' +
    'autocomplete="current-password" required></label>' +
    '<button type="submit">Revoke pass now</button></form>');
}
function passDisplay(result) {
  return page('<h2>One-time connection pass</h2>' +
    '<p>Copy this directly into your secure client credential manager. ' +
    'It will never be shown again. Do not put it in chat, tickets or logs.</p>' +
    '<label>Pass <textarea rows="2" cols="80" readonly>' +
    escapeHtml(result.pass) + '</textarea></label>' +
    '<p>Identifier for revocation: <code>' + escapeHtml(result.id) + '</code></p>');
}
function ownerScopeDetail(info) {
  return page('<h2>Current RTC service scope (metadata only)</h2><p>'+
    'Service '+escapeHtml(info.server)+'; callable '+String(info.callable)+
    '; profile '+escapeHtml(info.profile??'unavailable')+
    '; permanent profile ceiling '+escapeHtml(info.callerProfileLimit??'unset')+
    '; provider areas '+escapeHtml((info.originalAreas??[]).join(', '))+
    '; already narrowed grant '+escapeHtml((info.grantAreas??[]).join(', '))+
    '; connection policy '+escapeHtml((info.callerAreaLimit??[]).join(', '))+
    '; currently authorized '+escapeHtml((info.authorizedAreas??[]).join(', '))+
    '</p><p>No provider pass, token, ciphertext or live call was used.</p>');
}
function ownerAuditDetail(rows) {
  return page('<h2>Recent owner RTC service-area reductions</h2><ul>'+
    rows.map(r=>'<li>'+escapeHtml(String(r.at))+' '+escapeHtml(r.kind)+
      ' '+escapeHtml(r.callerId)+' / '+escapeHtml(r.server)+
      ': '+escapeHtml(r.areas.join(', '))+'; prior pages purged '+
      escapeHtml(String(r.purgedHandles))+'</li>').join('')+'</ul>');
}
function ownerProfileAuditDetail(rows){
 return page('<h2>Permanent RTC service-profile changes</h2><ul>'+
   rows.map(row=>'<li>'+escapeHtml(String(row.at))+' '+escapeHtml(row.kind)+
   ' '+escapeHtml(row.callerId)+' / '+escapeHtml(row.server)+
   ': '+escapeHtml(row.profile)+'; invalidated pages '+
   escapeHtml(String(row.purgedHandles))+'</li>').join('')+'</ul>');
}
function ownerAreaPlanPreview(value){
  const rows=value.scopes.map(item=>'<li>'+escapeHtml(item.server)+
    ': '+escapeHtml(item.before.join(', '))+' to '+
    escapeHtml(item.after.join(', '))+
    '; eligible: '+escapeHtml(String(item.available))+'</li>').join('');
  return page('<h2>Multi-service area preview</h2>'+
    '<p>No permissions changed. Eligible: '+escapeHtml(String(value.canApply))+
    '. Submit a new narrow_area_plan owner confirmation to apply.</p>'+
    '<ul>'+rows+'</ul>');
}
function scopeDisplay(rows) {
  const items=rows.map(row=>'<li><code>'+escapeHtml(row.id)+'</code> '+
    escapeHtml(row.state)+'; '+escapeHtml(row.profile)+' '+escapeHtml(row.mode)+
    '; servers: '+escapeHtml(row.serverNames===null ?
      '(legacy: exact caller grants only)' : row.serverNames.join(', '))+
    '; areas: '+escapeHtml(row.areas.join(', '))+
    '; service area limits: '+escapeHtml(JSON.stringify(row.serviceAreas??{}))+
    '; service profile ceilings: '+escapeHtml(JSON.stringify(row.serviceProfiles??{}))+
    '; expires: '+escapeHtml(String(row.expiresAt))+'</li>').join('');
  return page('<h2>Owner-only Hub pass scopes</h2>'+
    '<p>Stored metadata only; no bearer tokens, pass digests or RTC credentials.</p>'+
    '<ul>'+items+'</ul>');
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// An independently verified owner is the only issuer. No bearer, OAuth
// session, caller argument, provider service or AI can mint or broaden passes.
export async function handleOwnerPasses(req, res, { withDb, env = process.env,
  verify = verifyOwnerLogin, issue = issueHubPass, revoke = revokeHubPass,
  narrow = narrowHubPassServers, list = listHubPassScopes,
  narrowAreas = narrowHubPassServiceAreas,
  previewAreaPlan = previewOwnerServiceAreaPlan,
  executeAreaPlan = executeOwnerServiceAreaPlan,
  narrowProfile = narrowPassServiceProfile,profileAudit = listOwnerProfileAudit,
  inspectService = inspectOwnerServiceScope,auditAreas = listOwnerServiceAreaAudit } = {}) {
  htmlHeaders(res);
  res.setHeader('Pragma', 'no-cache');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).send('Method not allowed');
  }
  try { publicHubOrigin(env); }
  catch { return res.status(503).send('Hub owner setup unavailable'); }
  if (req.method === 'GET') return res.status(200).send(passForm());
  if (!String(req.headers?.['content-type'] || '').startsWith('application/x-www-form-urlencoded'))
    return res.status(415).send('Unsupported content type');
  const fields = formFields(req);
  if (!fields || !['issue', 'revoke', 'narrow', 'narrow_areas', 'narrow_profile', 'list', 'inspect_service', 'audit', 'profile_audit','preview_area_plan','narrow_area_plan'].includes(fields.action) ||
    typeof fields.password !== 'string' || fields.password.length === 0 ||
    (['revoke','narrow','narrow_areas','narrow_profile','inspect_service','preview_area_plan','narrow_area_plan'].includes(fields.action) && !uuid.test(fields.id || '')))
    return res.status(400).send('Invalid request');
  const selected = ['issue','narrow'].includes(fields.action) ?
    parseOwnerServerSelection(fields.servers) : null;
  if (['issue','narrow'].includes(fields.action) && !selected)
    return res.status(400).send('Select 1–20 registered RTC servers');
  let initialProfiles=null,initialAreas=null;
  try {
    if(fields.action==='issue'){
      initialProfiles=parseInitialServiceProfiles(fields.profiles,selected);
      initialAreas=parseInitialServiceAreas(fields.service_areas,selected);
    }
  }catch{return res.status(400).send('Invalid initial RTC service restrictions');}
  const areas=fields.action==='narrow_areas'?parseServiceAreas(fields.areas):null;
  let areaPlan=null;
  if(['preview_area_plan','narrow_area_plan'].includes(fields.action)){
    try{areaPlan=parseOwnerServiceAreaPlan(fields.area_plan);}
    catch{return res.status(400).send('Invalid multi-service area restrictions');}
  }
  if(fields.action==='narrow_profile'&&
    (!serverNamePattern.test(fields.server||'')||
      !['read_only','disabled'].includes(fields.profile)))
    return res.status(400).send('Invalid permanent service-profile restriction');
  if(fields.action==='inspect_service' &&
    !serverNamePattern.test(fields.server||''))
    return res.status(400).send('Invalid RTC service');
  if(fields.action==='narrow_areas' &&
    (!serverNamePattern.test(fields.server||'')||!areas))
    return res.status(400).send('Select one canonical service and 1–32 areas');
  try {
    return await withDb(async (db, settings) => {
      const decision = await verify(db, req, fields.password, { env });
      if (!decision.approved) {
        if (decision.retryAfter) res.setHeader('Retry-After', String(decision.retryAfter));
        return res.status(decision.retryAfter ? 429 : 401).send('Owner verification denied');
      }
      if(areaPlan){
        const input={ownerId:env.HUB_OWNER_ID,callerKind:'pass',
          id:fields.id,plan:areaPlan};
        if(fields.action==='preview_area_plan')
          return res.status(200).send(ownerAreaPlanPreview(await previewAreaPlan(
            db,input,{ownerVerified:true})));
        const outcome=await executeAreaPlan(db,input,{ownerVerified:true});
        return res.status(outcome.updated?200:404).send(outcome.updated?
          'All selected service areas permanently narrowed; old result pages invalidated.' :
          'No change committed: one or more service reductions were refused.');
      }
      if(fields.action==='profile_audit')
        return res.status(200).send(ownerProfileAuditDetail(await profileAudit(db,
          env.HUB_OWNER_ID,{ownerVerified:true})));
      if(fields.action==='audit')
        return res.status(200).send(ownerAuditDetail(await auditAreas(db,
          env.HUB_OWNER_ID,{ownerVerified:true})));
      if(fields.action==='inspect_service')
        return res.status(200).send(ownerScopeDetail(await inspectService(db,{
          ownerId:env.HUB_OWNER_ID,callerKind:'pass',
          callerId:fields.id,serverName:fields.server},{ownerVerified:true})));
      if (fields.action === 'list') {
        const rows=await list(db,env.HUB_OWNER_ID,{ownerVerified:true});
        return res.status(200).send(scopeDisplay(rows));
      }
      if(fields.action==='narrow_profile'){
        const result=await narrowProfile(db,{ownerId:env.HUB_OWNER_ID,id:fields.id,
          serverName:fields.server,profile:fields.profile},{ownerVerified:true});
        return res.status(result.updated?200:404).send(result.updated?
          'Service profile permanently narrowed, prior RTC pages invalidated.' :
          'Pass or service unavailable, or the request would widen permissions.');
      }
      if(fields.action==='narrow_areas') {
        const result=await narrowAreas(db,{ownerId:env.HUB_OWNER_ID,id:fields.id,
          serverName:fields.server,areas},{ownerVerified:true});
        return res.status(result.updated?200:404).send(result.updated?
          'Pass service areas permanently reduced and old RTC pages invalidated.' :
          'Pass/service unavailable or request would expand permissions.');
      }
      if (fields.action === 'narrow') {
        const result=await narrow(db,{ownerId:env.HUB_OWNER_ID,
          id:fields.id,serverNames:selected},{ownerVerified:true});
        return res.status(result.updated?200:404).send(result.updated ?
          'Hub pass permanently narrowed to selected servers.' :
          'Pass unavailable or selection would widen its permissions.');
      }
      if (fields.action === 'revoke') {
        const revoked = await revoke(db, fields.id, env.HUB_OWNER_ID,
          { ownerVerified: true });
        return res.status(revoked ? 200 : 404).send(revoked ?
          'Hub pass revoked.' : 'Pass not found or already revoked.');
      }
      const issued = await issue(db, {
        ownerId: env.HUB_OWNER_ID,
        profile: 'read_only',
        mode: 'test',
        areas: ['gateway'],
        serverNames: selected,
        ...(initialProfiles?{serviceProfiles:initialProfiles}:{}),
        ...(initialAreas?{serviceAreas:initialAreas}:{}),
        allowWrites: false,
        ttlSeconds: 86400
      }, { ownerVerified: true, pepper: settings.pepper });
      return res.status(201).send(passDisplay(issued));
    });
  } catch {
    return res.status(503).send('Hub owner pass setup unavailable');
  }
}
