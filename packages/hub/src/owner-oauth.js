import {serverNamePattern} from './server-name.js';
import {parseOwnerServiceAreaPlan,previewOwnerServiceAreaPlan,
 executeOwnerServiceAreaPlan} from './service-area-plan.js';
import {listOwnerOAuthFamilies,revokeOwnerOAuthFamily,
  narrowOwnerOAuthFamilyServers} from './oauth.js';
import {narrowOAuthServiceProfile,listOwnerProfileAudit} from './service-profile-policy.js';
import {inspectOwnerServiceScope,listOwnerServiceAreaAudit} from './owner-service-scope.js';
import {parseServiceAreas,narrowOAuthFamilyServiceAreas} from './service-area-policy.js';
import {parseOwnerServerSelection} from './server-selection.js';
import {escapeHtml,formFields,htmlHeaders,publicHubOrigin,
  verifyOwnerLogin} from './owner-login.js';

const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function page(content) {
  return '<!doctype html><html lang="en"><meta charset="utf-8">'+
    '<title>Toolkit Hub OAuth connections</title>'+
    '<main><h1>Owner OAuth connection families</h1>'+
    '<p>TEST, read-only Hub connections only. Each upstream provider still '+
    'requires its own independently issued RTC TEST grant.</p>'+ 
    '<p><a href="/api/owner/dashboard">Open private owner control center</a></p>'+content+
    '</main></html>';
}
function form() {
  return page('<form method="POST" action="/api/owner/oauth">'+
    '<input type="hidden" name="action" value="list">'+
    '<label>Owner passphrase <input type="password" name="password" '+
      'autocomplete="current-password" required></label>'+
    '<button type="submit">Review active connection families</button></form>'+
    '<form method="POST" action="/api/owner/oauth">'+
    '<label>OAuth session ID <input name="id" maxlength="36" required></label>'+
    '<label>Reduced areas for 1-10 services (stripe:billing|reports,workspace:drive) '+
    '<input name="area_plan" maxlength="2048" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button name="action" value="preview_area_plan">Preview only</button>'+
    '<button name="action" value="narrow_area_plan">Permanently narrow whole family</button>'+
    '<p>Either every reduction commits or none.</p></form>'+
    '<form method="POST" action="/api/owner/oauth">'+
    '<input type="hidden" name="action" value="revoke">'+
    '<label>Connection session ID <input name="id" maxlength="36" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" '+
      'autocomplete="current-password" required></label>'+
    '<p>Irreversible: ends all access and refresh tokens in the family. '+
    'Previously issued RTC result pages are deleted. To connect again, '+
    'use new owner-approved OAuth PKCE authorization and new scoped grants.</p>'+
    '<button type="submit">Revoke entire connection family</button></form>'+ 
    '<form method="POST" action="/api/owner/oauth">'+
    '<input type="hidden" name="action" value="narrow">'+
    '<label>Connection session ID <input name="id" maxlength="36" required></label>'+
    '<label>Reduced RTC server names <input name="servers" maxlength="1300" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<p>One-way family restriction; previously issued RTC result pages for removed servers are invalidated.</p>'+
    '<button type="submit">Permanently narrow this family</button></form>'+
    '<form method="POST" action="/api/owner/oauth">'+
    '<input type="hidden" name="action" value="narrow_areas">'+
    '<label>Connection session ID <input name="id" maxlength="36" required></label>'+
    '<label>One authorized RTC server <input name="server" maxlength="60" required></label>'+
    '<label>Reduced provider areas <input name="areas" maxlength="2048" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<p>This irreversibly narrows the entire refresh family and removes prior '+
    'result pages for that service. New refresh tokens retain the restriction.</p>'+
    '<button type="submit">Reduce this OAuth family service areas</button></form>'+
    '<form method="POST" action="/api/owner/oauth">'+
    '<input type="hidden" name="action" value="narrow_profile">'+
    '<label>Connection session ID <input name="id" maxlength="36" required></label>'+
    '<label>RTC service <input name="server" maxlength="60" required></label>'+
    '<label>New profile ceiling <select name="profile">'+
    '<option value="read_only">Read only</option>'+
    '<option value="disabled">Permanently disable service</option></select></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<p>Every OAuth refresh generation inherits this one-way reduction; '+
    'reconnection requires fresh owner-approved PKCE and upstream TEST grant.</p>'+
    '<button type="submit">Permanently restrict entire OAuth family</button></form>'+
    '<form method="POST" action="/api/owner/oauth">'+
    '<input type="hidden" name="action" value="inspect_service">'+
    '<label>Connection session ID <input name="id" maxlength="36" required></label>'+
    '<label>RTC server <input name="server" maxlength="60" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">Inspect current effective service scope</button></form>'+
    '<form method="POST" action="/api/owner/oauth">'+
    '<input type="hidden" name="action" value="audit">'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">Review service-area policy audit</button></form>'+
    '<form method="POST" action="/api/owner/oauth">'+
    '<input type="hidden" name="action" value="profile_audit">'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">Review permanent service-profile audit</button></form>');
}
function displayAreaPlan(value) {
  return page('<h2>Multi-service OAuth area preview</h2><p>No permissions changed. '+
    'Eligible: '+escapeHtml(String(value.canApply))+
    '. Submit a new narrow_area_plan owner confirmation to apply.</p><ul>'+
    value.scopes.map(item=>'<li>'+escapeHtml(item.server)+
      ': '+escapeHtml(item.before.join(', '))+' to '+
      escapeHtml(item.after.join(', '))+'; eligible: '+
      escapeHtml(String(item.available))+'</li>').join('')+'</ul>');
}
function displayScope(result) {
  return page('<h2>Effective RTC service scope</h2><p>'+
    escapeHtml(result.server)+'; callable '+String(result.callable)+
    '; current profile '+escapeHtml(result.profile??'unavailable')+
    '; permanent profile ceiling '+escapeHtml(result.callerProfileLimit??'unset')+
    '; original areas '+
    escapeHtml((result.originalAreas??[]).join(', '))+
    '; currently authorized '+escapeHtml((result.authorizedAreas??[]).join(', '))+
    '; connection policy '+escapeHtml((result.callerAreaLimit??[]).join(', '))+
    '</p><p>Metadata only; no tokens, provider credentials or calls.</p>');
}
function displayAudit(rows) {
  return page('<h2>Service area policy reductions</h2><ul>'+
    rows.map(r=>'<li>'+escapeHtml(String(r.at))+' '+escapeHtml(r.kind)+
      ' '+escapeHtml(r.callerId)+' / '+escapeHtml(r.server)+
      ': '+escapeHtml(r.areas.join(', '))+'; pages purged '+
      escapeHtml(String(r.purgedHandles))+'</li>').join('')+'</ul>');
}
function displayProfileAudit(rows){
 return page('<h2>Permanent service-profile restrictions</h2><ul>'+
  rows.map(r=>'<li>'+escapeHtml(String(r.at))+' '+escapeHtml(r.kind)+
    ' '+escapeHtml(r.callerId)+' / '+escapeHtml(r.server)+
    ': '+escapeHtml(r.profile)+'; invalidated pages '+
    escapeHtml(String(r.purgedHandles))+'</li>').join('')+'</ul>');
}
function display(rows) {
  return page('<h2>Active family metadata (max 30)</h2>'+
    '<p>No access tokens, refresh tokens, HMAC digests or upstream passes are displayed.</p>'+
    '<ul>'+rows.map(row=>'<li>Session <code>'+escapeHtml(row.id)+'</code>; client '+
      escapeHtml(row.clientId)+'; '+escapeHtml(row.mode)+'/'+escapeHtml(row.profile)+
      '; servers '+escapeHtml(row.serverNames===null ?
        '(legacy: exact caller grants only)' : row.serverNames.join(', '))+
      '; areas '+escapeHtml(row.areas.join(', '))+
      '; service area limits '+escapeHtml(JSON.stringify(row.serviceAreas??{}))+
      '; service profile ceilings '+escapeHtml(JSON.stringify(row.serviceProfiles??{}))+
      '; refresh expiry '+escapeHtml(String(row.refreshExpiresAt))+'</li>').join('')+
    '</ul>');
}
export async function handleOwnerOAuth(req,res,{withDb,env=process.env,
  verify=verifyOwnerLogin,list=listOwnerOAuthFamilies,
  revoke=revokeOwnerOAuthFamily,
  narrow=narrowOwnerOAuthFamilyServers,narrowAreas=narrowOAuthFamilyServiceAreas,
  narrowProfile=narrowOAuthServiceProfile,profileAudit=listOwnerProfileAudit,
  previewAreaPlan=previewOwnerServiceAreaPlan,executeAreaPlan=executeOwnerServiceAreaPlan,
  inspectService=inspectOwnerServiceScope,auditAreas=listOwnerServiceAreaAudit}={}) {
  htmlHeaders(res);
  res.setHeader('Pragma','no-cache');
  if(!['GET','POST'].includes(req.method)) {
    res.setHeader('Allow','GET, POST');
    return res.status(405).send('Method not allowed');
  }
  try {publicHubOrigin(env);}
  catch {return res.status(503).send('Hub owner setup unavailable');}
  if(req.method==='GET') return res.status(200).send(form());
  if(!String(req.headers?.['content-type']||'').startsWith('application/x-www-form-urlencoded'))
    return res.status(415).send('Unsupported content type');
  const fields=formFields(req);
  if(!fields||!['list','revoke','narrow','narrow_areas','narrow_profile','inspect_service','audit','profile_audit','preview_area_plan','narrow_area_plan'].includes(fields.action)||
     typeof fields.password!=='string'||!fields.password||
     fields.password.length>256||
     (['revoke','narrow','narrow_areas','narrow_profile','inspect_service','preview_area_plan','narrow_area_plan'].includes(fields.action)&&!uuid.test(fields.id||'')))
    return res.status(400).send('Invalid request');
  const selection=fields.action==='narrow' ? parseOwnerServerSelection(fields.servers) : null;
  if(fields.action==='narrow'&&!selection)
    return res.status(400).send('Select 1–20 canonical RTC servers');
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
    return await withDb(async db=>{
      const decision=await verify(db,req,fields.password,{env});
      if(!decision.approved) {
        if(decision.retryAfter)res.setHeader('Retry-After',String(decision.retryAfter));
        return res.status(decision.retryAfter?429:401).send('Owner verification denied');
      }
      if(areaPlan){
        const input={ownerId:env.HUB_OWNER_ID,callerKind:'oauth',
          id:fields.id,plan:areaPlan};
        if(fields.action==='preview_area_plan')
          return res.status(200).send(displayAreaPlan(await previewAreaPlan(
            db,input,{ownerVerified:true})));
        const outcome=await executeAreaPlan(db,input,{ownerVerified:true});
        return res.status(outcome.updated?200:404).send(outcome.updated?
          'Entire OAuth family service areas permanently narrowed; old pages invalidated.' :
          'No change committed: one or more service reductions were refused.');
      }
      if(fields.action==='profile_audit')
        return res.status(200).send(displayProfileAudit(await profileAudit(db,
          env.HUB_OWNER_ID,{ownerVerified:true})));
      if(fields.action==='audit')
        return res.status(200).send(displayAudit(await auditAreas(db,
          env.HUB_OWNER_ID,{ownerVerified:true})));
      if(fields.action==='inspect_service')
        return res.status(200).send(displayScope(await inspectService(db,{
          ownerId:env.HUB_OWNER_ID,callerKind:'oauth',
          callerId:fields.id,serverName:fields.server},{ownerVerified:true})));
      if(fields.action==='list') return res.status(200).send(
        display(await list(db,env.HUB_OWNER_ID,{ownerVerified:true})));
      if(fields.action==='narrow_profile'){
        const result=await narrowProfile(db,{ownerId:env.HUB_OWNER_ID,
          id:fields.id,serverName:fields.server,
          profile:fields.profile},{ownerVerified:true});
        return res.status(result.updated?200:404).send(result.updated?
          'OAuth service permanently restricted across all refresh tokens.' :
          'Family/service unavailable or request would expand permissions.');
      }
      if(fields.action==='narrow_areas') {
        const result=await narrowAreas(db,{ownerId:env.HUB_OWNER_ID,
          id:fields.id,serverName:fields.server,areas},{ownerVerified:true});
        return res.status(result.updated?200:404).send(result.updated?
          'OAuth family service areas permanently reduced; old RTC pages invalidated.' :
          'Family/service unavailable or request would expand permissions.');
      }
      if(fields.action==='narrow') {
        const result=await narrow(db,{ownerId:env.HUB_OWNER_ID,
          sessionId:fields.id,serverNames:selection},{ownerVerified:true});
        return res.status(result.updated?200:404).send(result.updated?
          'OAuth family permanently narrowed; removed RTC result pages invalidated.' :
          'OAuth family unavailable or selection would widen permissions.');
      }
      const done=await revoke(db,{ownerId:env.HUB_OWNER_ID,sessionId:fields.id},
        {ownerVerified:true});
      return res.status(done?200:404).send(done?
        'OAuth connection family revoked. Prior RTC result pages invalidated.' :
        'Connection family not active or not owned.');
    });
  } catch {
    return res.status(503).send('Owner OAuth management unavailable');
  }
}
