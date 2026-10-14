import {listOwnerOAuthFamilies,revokeOwnerOAuthFamily} from './oauth.js';
import {escapeHtml,formFields,htmlHeaders,publicHubOrigin,
  verifyOwnerLogin} from './owner-login.js';

const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function page(content) {
  return '<!doctype html><html lang="en"><meta charset="utf-8">'+
    '<title>Toolkit Hub OAuth connections</title>'+
    '<main><h1>Owner OAuth connection families</h1>'+
    '<p>TEST, read-only Hub connections only. Each upstream provider still '+
    'requires its own independently issued RTC TEST grant.</p>'+content+
    '</main></html>';
}
function form() {
  return page('<form method="POST" action="/api/owner/oauth">'+
    '<input type="hidden" name="action" value="list">'+
    '<label>Owner passphrase <input type="password" name="password" '+
      'autocomplete="current-password" required></label>'+
    '<button type="submit">Review active connection families</button></form>'+
    '<form method="POST" action="/api/owner/oauth">'+
    '<input type="hidden" name="action" value="revoke">'+
    '<label>Connection session ID <input name="id" maxlength="36" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" '+
      'autocomplete="current-password" required></label>'+
    '<p>Irreversible: ends all access and refresh tokens in the family. '+
    'Previously issued RTC result pages are deleted. To connect again, '+
    'use new owner-approved OAuth PKCE authorization and new scoped grants.</p>'+
    '<button type="submit">Revoke entire connection family</button></form>');
}
function display(rows) {
  return page('<h2>Active family metadata (max 30)</h2>'+
    '<p>No access tokens, refresh tokens, HMAC digests or upstream passes are displayed.</p>'+
    '<ul>'+rows.map(row=>'<li>Session <code>'+escapeHtml(row.id)+'</code>; client '+
      escapeHtml(row.clientId)+'; '+escapeHtml(row.mode)+'/'+escapeHtml(row.profile)+
      '; servers '+escapeHtml(row.serverNames===null ?
        '(legacy: exact caller grants only)' : row.serverNames.join(', '))+
      '; areas '+escapeHtml(row.areas.join(', '))+
      '; refresh expiry '+escapeHtml(String(row.refreshExpiresAt))+'</li>').join('')+
    '</ul>');
}
export async function handleOwnerOAuth(req,res,{withDb,env=process.env,
  verify=verifyOwnerLogin,list=listOwnerOAuthFamilies,
  revoke=revokeOwnerOAuthFamily}={}) {
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
  if(!fields||!['list','revoke'].includes(fields.action)||
     typeof fields.password!=='string'||!fields.password||
     fields.password.length>256||
     (fields.action==='revoke'&&!uuid.test(fields.id||'')))
    return res.status(400).send('Invalid request');
  try {
    return await withDb(async db=>{
      const decision=await verify(db,req,fields.password,{env});
      if(!decision.approved) {
        if(decision.retryAfter)res.setHeader('Retry-After',String(decision.retryAfter));
        return res.status(decision.retryAfter?429:401).send('Owner verification denied');
      }
      if(fields.action==='list') return res.status(200).send(
        display(await list(db,env.HUB_OWNER_ID,{ownerVerified:true})));
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
