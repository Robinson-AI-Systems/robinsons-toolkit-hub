import { escapeHtml, formFields, htmlHeaders, publicHubOrigin,
  verifyOwnerLogin } from './owner-login.js';
import { listOwnerOAuthSessions, revokeOAuthFamily } from './oauth.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function page(content) {
  return '<!doctype html><html lang="en"><meta charset="utf-8"><title>Hub OAuth connections</title>' +
    '<main><h1>Hub OAuth sessions</h1>' + content + '</main></html>';
}
function form() {
  return page('<form method="POST" action="/api/owner/connections">' +
    '<input type="hidden" name="action" value="list">' +
    '<label>Owner passphrase <input type="password" name="password" required></label>' +
    '<button type="submit">List active connections</button></form>' +
    '<form method="POST" action="/api/owner/connections">' +
    '<input type="hidden" name="action" value="revoke">' +
    '<label>Session identifier <input name="id" maxlength="36" required></label>' +
    '<label>Owner passphrase <input type="password" name="password" required></label>' +
    '<button type="submit">Revoke connection family</button></form>');
}
function rowsHtml(rows) {
  const body=rows.map(row=>'<li><code>'+escapeHtml(row.id)+'</code> ' +
    escapeHtml(row.client_id)+' — '+escapeHtml(row.profile)+' / '+
    escapeHtml(row.mode)+'</li>').join('');
  return page('<p>At most twenty unexpired sessions (several may share one token family). '+
    'Revoking any listed session invalidates its entire family.</p><ul>'+body+'</ul>');
}
export async function handleOwnerConnections(req,res,{withDb,env=process.env,
  verify=verifyOwnerLogin,list=listOwnerOAuthSessions,
  revoke=revokeOAuthFamily}={}) {
  htmlHeaders(res);
  if(!['GET','POST'].includes(req.method)) return res.status(405).send('Method not allowed');
  try { publicHubOrigin(env); }
  catch { return res.status(503).send('Hub owner setup unavailable'); }
  if(req.method==='GET') return res.status(200).send(form());
  if(!String(req.headers?.['content-type']||'').startsWith('application/x-www-form-urlencoded'))
    return res.status(415).send('Unsupported content type');
  const fields=formFields(req);
  if(!fields || !['list','revoke'].includes(fields.action) || !fields.password ||
    (fields.action==='revoke' && !uuid.test(fields.id||'')))
    return res.status(400).send('Invalid request');
  try {
    return await withDb(async db=>{
      const verdict=await verify(db,req,fields.password,{env});
      if(!verdict.approved) {
        if(verdict.retryAfter) res.setHeader('Retry-After',String(verdict.retryAfter));
        return res.status(verdict.retryAfter?429:401).send('Owner verification denied');
      }
      if(fields.action==='list') return res.status(200).send(rowsHtml(
        await list(db,env.HUB_OWNER_ID,{ownerVerified:true})));
      const done=await revoke(db,{ownerId:env.HUB_OWNER_ID,sessionId:fields.id},
        {ownerVerified:true});
      return res.status(done?200:404).send(done?
        'OAuth connection family revoked.' : 'Session not found or already revoked.');
    });
  } catch { return res.status(503).send('Hub owner connection administration unavailable'); }
}
