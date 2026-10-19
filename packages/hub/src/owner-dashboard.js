// H-4 owner-only control center. No bearer or RTC grant secret is exposed.
// A dashboard view is NOT proof that a hosted provider has accepted a pass.
import {escapeHtml,formFields,htmlHeaders,publicHubOrigin,
 verifyOwnerLogin} from './owner-login.js';
import {renderReadinessSummary} from './owner-readiness.js';
import {readOwnerDashboard,checkedDashboardSelection} from './owner-dashboard-data.js';

const e=value=>escapeHtml(value??'');
const showList=a=>Array.isArray(a)?a.map(e).join(', '):'legacy exact-caller grants';
const link=(href,label)=>'<a href="'+href+'">'+e(label)+'</a>';
function frame(title,body){
 return '<!doctype html><html lang="en"><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width, initial-scale=1">'+
  '<title>'+e(title)+'</title><main><h1>'+e(title)+'</h1>'+
  '<p>Verified-owner TEST management only. Source metadata is not a real '+
  'RTC provider read, hosted deployment check or financial authorization.</p>'+
  '<nav aria-label="Owner actions">'+
  link('/api/owner/connect-service','Connect a service')+' | '+
  link('/api/owner/passes','Manage Hub passes')+' | '+
  link('/api/owner/oauth','Manage OAuth families')+' | '+
  link('/api/owner/grants','Manage service grants')+' | '+
  link('/api/owner/servers','Manage server registry')+' | '+
  link('/api/owner/readiness','Connection readiness')+' | '+
  link('/api/owner/changes','Recent routed read history')+
  '</nav>'+body+'</main></html>';
}
function requestForm(){
 return '<form method="POST" action="/api/owner/dashboard">'+
  '<label>View <select name="tab">'+
  '<option value="overview">Passes, OAuth and grants</option>'+
  '<option value="scopes">Effective caller/service permissions</option>'+
  '<option value="audit">Permanent restriction audit</option>'+
  '<option value="readiness">Service connection readiness</option>'+
  '</select></label>'+
  '<label>Scope page (0–99) <input name="page" value="0" inputmode="numeric" '+
  'maxlength="2"></label>'+
  '<label>Owner passphrase <input name="password" type="password" '+
  'autocomplete="current-password" maxlength="256" required></label>'+
  '<button type="submit">Show private owner inventory</button></form>';
}
function detail(items){
 return '<ul>'+items.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
}
function state(part){
 return part?.state==='readable'?'':('<p>Unavailable: this section has not been '+
  'validated against the current database schema or settings.</p>');
}
function empty(rows){
 return !rows.length?'<p>No rows in this bounded owner view. This does not '+
  'prove that the provider has no other records.</p>':'';
}
function passRows(part){
 if(part.state!=='readable')return state(part);
 return empty(part.rows)+detail(part.rows.map(item=>
  '<details><summary>Pass '+e(item.id)+' — '+e(item.state)+'</summary>'+
  '<p>TEST mode: '+e(item.mode)+'; profile: '+e(item.profile)+
  '; expires: '+e(String(item.expiresAt))+'</p>'+
  '<p>Selected services: '+showList(item.serverNames)+'</p>'+
  '<p>Service area limits: '+e(JSON.stringify(item.serviceAreas??{}))+'</p>'+
  '<p>Profile ceilings: '+e(JSON.stringify(item.serviceProfiles??{}))+'</p>'+
  '<p>Use Manage Hub passes for one-way reductions or immediate revocation.</p>'+
  '</details>'));
}
function familyRows(part){
 if(part.state!=='readable')return state(part);
 return empty(part.rows)+detail(part.rows.map(item=>
  '<details><summary>OAuth family '+e(item.id)+'</summary>'+
  '<p>Client '+e(item.clientId)+'; mode '+e(item.mode)+
  '; profile '+e(item.profile)+'; refresh expires '+e(String(item.refreshExpiresAt))+'</p>'+
  '<p>Selected servers: '+showList(item.serverNames)+'</p>'+
  '<p>Service area limits: '+e(JSON.stringify(item.serviceAreas??{}))+'</p>'+
  '<p>Service profile ceilings: '+e(JSON.stringify(item.serviceProfiles??{}))+'</p>'+
  '<p>Use Manage OAuth families for permanent changes/revocation.</p>'+
  '</details>'));
}
function grantRows(part){
 if(part.state!=='readable')return state(part);
 return empty(part.rows)+detail(part.rows.map(item=>
  '<details><summary>'+e(item.server)+' — '+e(item.state)+'</summary>'+
  '<p>Grant '+e(item.id)+'; '+e(item.callerKind)+' caller '+e(item.callerId)+'</p>'+
  '<p>Verified local areas: '+showList(item.areas)+
  '; expires '+e(String(item.expiresAt))+'</p>'+
  '<p>Service-issued credential status has NOT been rechecked at provider.</p>'+
  '</details>'));
}
function overview(data){
 const {passes,families,grants}=data.parts;
 return '<h2>Passes (eight most recent)</h2>'+passRows(passes)+
  '<h2>OAuth families (eight most recent)</h2>'+familyRows(families)+
  '<h2>Scoped grants (eight most recent)</h2>'+grantRows(grants)+
  '<p>These are bounded samples, not an exhaustive account listing. '+
  'Scope view rechecks current SQL authorization independently.</p>';
}
// These forms POST to the EXISTING independently password-verified routes.
// Never reuse the dashboard password, mint approval, or embed credentials.
function actionForm(kind,id,server,action,fields,button){
 const dest=kind==='pass'?'/api/owner/passes':'/api/owner/oauth';
 let body='<form method="POST" action="'+dest+'">'+
  '<input type="hidden" name="action" value="'+e(action)+'">'+
  '<input type="hidden" name="id" value="'+e(id)+'">';
 if(server)body+='<input type="hidden" name="server" value="'+e(server)+'">';
 for(const field of fields){
  body+='<label>'+e(field.label)+' <input name="'+e(field.name)+
   '" maxlength="'+(field.max??2048)+'" required></label>';
 }
 return body+'<label>Owner passphrase (new independent approval) '+
  '<input type="password" name="password" autocomplete="current-password" '+
  'required></label><button type="submit">'+e(button)+'</button></form>';
}
function scopeRows(data){
 if(data.state!=='readable')return '<h2>Current effective RTC permissions</h2>'+
   '<p>Current authorization unavailable. No server is presumed usable.</p>';
 const content=data.rows.map(item=>{
  const head='<details><summary>'+e(item.kind)+' '+e(item.server)+
   ' — '+e(item.callerId)+'</summary>';
  if(item.inspection==='unavailable'||!item.available)
    return head+'<p>Current verified scoped grant unavailable. No action implied.</p></details>';
  const base='<p>Local grant '+e(item.grantId)+'; actual TEST provider '+
    'authentication remains UNVERIFIED.</p>'+
    '<p>Current profile: '+e(item.profile)+
    '; effective authorized areas: '+showList(item.authorizedAreas)+
    '; grant area ceiling: '+showList(item.grantAreas)+
    '; prior area filter: '+showList(item.callerAreaLimit)+
    '; profile ceiling: '+e(item.callerProfileLimit??'unrestricted_by_hub')+'</p>';
  const areas=actionForm(item.kind,item.callerId,item.server,
    'narrow_areas',[{label:'Retain only these areas (comma-separated)',
      name:'areas'}],'Permanently reduce one service');
  const profile=actionForm(item.kind,item.callerId,item.server,
    'narrow_profile',[{label:'New profile: read_only or disabled',
      name:'profile',max:9}],'Permanently reduce profile');
  const bulk=actionForm(item.kind,item.callerId,null,
    'preview_area_plan',[{label:'Preview multi-service plan (e.g. stripe:billing|reports)',
      name:'area_plan'}],'Preview all-service reduction');
  return head+base+'<p>Every operation rechecks live owner and grant permissions. '+
    'No action can widen TEST/read_only or restore removed areas.</p>'+
    areas+profile+bulk+'</details>';
 });
 return '<h2>Current effective RTC permissions (page '+e(data.page)+')</h2>'+
  '<p>Only verified local grants from a bounded newest-first roster. '+
  'Provider identity and live deployment remain unverified.</p>'+
  empty(data.rows)+detail(content)+
  (data.next!==null?'<p>More available: submit Scope page '+e(data.next)+
   ' with independent owner login.</p>':'')+
  (data.truncatedRoster?'<p>At least 60 local grants exist. The displayed '+
   'roster is incomplete; no hidden service is certified.</p>':'');
}
function auditRows(part,type){
 if(part.state!=='readable')return state(part);
 return empty(part.rows)+detail(part.rows.map(row=>
  e(String(row.at))+' — '+e(row.kind)+' '+e(row.callerId)+
  ' / '+e(row.server)+' reduced to '+(type==='areas'?
    showList(row.areas):e(row.profile))+
  '; affected sessions '+e(row.affectedSessions)+
  '; invalidated pages '+e(row.purgedHandles)));
}
function audits(data){
 return '<h2>Area reductions (most recent 20)</h2>'+
  auditRows(data.parts.areas,'areas')+
  '<h2>Profile reductions (most recent 20)</h2>'+
  auditRows(data.parts.profiles,'profiles')+
  '<p>Hub-owned SQL audit only. It does not attest to provider-side reads.</p>';
}
function readiness(data){
 if(data.state!=='readable'||!data.readiness)
  return '<h2>Readiness unavailable</h2><p>No acceptance inferred.</p>';
 return '<h2>Hub readiness (metadata only)</h2>'+renderReadinessSummary(data.readiness);
}
export function renderOwnerDashboard(data) {
 const view=data.tab==='overview'?overview(data):
  data.tab==='scopes'?scopeRows(data):
  data.tab==='audit'?audits(data):readiness(data);
 const html=frame('Robinson Toolkit Hub owner control center',view+
  '<p>No tokens, provider API keys, ciphertext or raw credentials are returned.</p>'+
  '<p>For another view, reopen the owner dashboard and authenticate afresh.</p>');
 if(Buffer.byteLength(html,'utf8')>65536)
  throw new Error('Bounded owner dashboard response exceeded');
 return html;
}
export async function handleOwnerDashboard(req,res,
 {withDb,env=process.env,verify=verifyOwnerLogin,
 read=readOwnerDashboard}={}){
 htmlHeaders(res);
 res.setHeader('Pragma','no-cache');
 if(!['GET','POST'].includes(req.method)){
   res.setHeader('Allow','GET, POST');
   return res.status(405).send('Method not allowed');
 }
 try{publicHubOrigin(env);}
 catch{return res.status(503).send('Owner dashboard unavailable');}
 if(req.method==='GET')
   return res.status(200).send(frame('Robinson Toolkit Hub owner control center',
     requestForm()+'<p>Every private view requires an independent owner login. '+
     'Nothing is queried until you submit.</p>'));
 if(!String(req.headers?.['content-type']||'').startsWith(
    'application/x-www-form-urlencoded'))
   return res.status(415).send('Unsupported content type');
 const fields=formFields(req);
 if(!fields||Object.keys(fields).some(k=>!['tab','page','password'].includes(k))||
   typeof fields.password!=='string'||!fields.password||
   fields.password.length>256)return res.status(400).send('Invalid request');
 let selection;
 try{selection=checkedDashboardSelection({tab:fields.tab,page:fields.page});}
 catch{return res.status(400).send('Invalid owner dashboard selection');}
 try{
   return await withDb(async(db,settings)=>{
     const approved=await verify(db,req,fields.password,{env});
     if(!approved.approved){
       if(approved.retryAfter)res.setHeader('Retry-After',String(approved.retryAfter));
       return res.status(approved.retryAfter?429:401).send('Owner verification denied');
     }
     const data=await read(db,env.HUB_OWNER_ID,settings,selection);
     return res.status(200).send(renderOwnerDashboard(data));
   });
 }catch{return res.status(503).send('Owner dashboard snapshot unavailable');}
}
