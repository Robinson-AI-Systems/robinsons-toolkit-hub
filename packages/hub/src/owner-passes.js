import { issueHubPass, revokeHubPass, narrowHubPassServers,
  listHubPassScopes } from './identity.js';
import {narrowHubPassServiceAreas,parseServiceAreas} from './service-area-policy.js';
import { parseOwnerServerSelection } from './server-selection.js';
import { escapeHtml, formFields, htmlHeaders, publicHubOrigin,
  verifyOwnerLogin } from './owner-login.js';

function page(content) {
  return '<!doctype html><html lang="en"><meta charset="utf-8">' +
    '<title>Toolkit Hub owner passes</title><main><h1>Hub connection passes</h1>' +
    '<p>These passes access only the Hub in read-only TEST mode. ' +
    'Upstream service passes must be issued and scoped independently.</p>' +
    content + '</main></html>';
}
function passForm() {
  return page('<form method="POST" action="/api/owner/passes">' +
    '<input type="hidden" name="action" value="issue">' +
    '<label>Owner passphrase <input type="password" name="password" ' +
    'autocomplete="current-password" required></label>' +
    '<label>Authorized RTC servers (registered names, comma separated) ' +
    '<input name="servers" maxlength="1300" required></label>' +
    '<p>This pass cannot discover or call other servers, even if additional ' +
    'upstream grants are configured. Every selected service still needs its ' +
    'separate verified TEST read-only grant.</p>' +
    '<button type="submit">Create one-day read-only TEST pass</button></form>' +
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
function scopeDisplay(rows) {
  const items=rows.map(row=>'<li><code>'+escapeHtml(row.id)+'</code> '+
    escapeHtml(row.state)+'; '+escapeHtml(row.profile)+' '+escapeHtml(row.mode)+
    '; servers: '+escapeHtml(row.serverNames===null ?
      '(legacy: exact caller grants only)' : row.serverNames.join(', '))+
    '; areas: '+escapeHtml(row.areas.join(', '))+
    '; service area limits: '+escapeHtml(JSON.stringify(row.serviceAreas??{}))+
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
  narrowAreas = narrowHubPassServiceAreas } = {}) {
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
  if (!fields || !['issue', 'revoke', 'narrow', 'narrow_areas', 'list'].includes(fields.action) ||
    typeof fields.password !== 'string' || fields.password.length === 0 ||
    (['revoke','narrow','narrow_areas'].includes(fields.action) && !uuid.test(fields.id || '')))
    return res.status(400).send('Invalid request');
  const selected = ['issue','narrow'].includes(fields.action) ?
    parseOwnerServerSelection(fields.servers) : null;
  if (['issue','narrow'].includes(fields.action) && !selected)
    return res.status(400).send('Select 1–20 registered RTC servers');
  const areas=fields.action==='narrow_areas'?parseServiceAreas(fields.areas):null;
  if(fields.action==='narrow_areas' &&
    (!/^[a-z][a-z0-9_]{1,59}$/.test(fields.server||'')||!areas))
    return res.status(400).send('Select one canonical service and 1–32 areas');
  try {
    return await withDb(async (db, settings) => {
      const decision = await verify(db, req, fields.password, { env });
      if (!decision.approved) {
        if (decision.retryAfter) res.setHeader('Retry-After', String(decision.retryAfter));
        return res.status(decision.retryAfter ? 429 : 401).send('Owner verification denied');
      }
      if (fields.action === 'list') {
        const rows=await list(db,env.HUB_OWNER_ID,{ownerVerified:true});
        return res.status(200).send(scopeDisplay(rows));
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
        allowWrites: false,
        ttlSeconds: 86400
      }, { ownerVerified: true, pepper: settings.pepper });
      return res.status(201).send(passDisplay(issued));
    });
  } catch {
    return res.status(503).send('Hub owner pass setup unavailable');
  }
}
