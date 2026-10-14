import {escapeHtml,formFields,htmlHeaders,publicHubOrigin,
  verifyOwnerLogin} from './owner-login.js';
import {stageHubServer,listStagedServers,disableStagedServer,
  retireHubServerAndGrants} from './registry.js';
import {probeStagedRtcContract} from './pinned-contract.js';

const slug=/^[a-z][a-z0-9_]{1,59}$/;
function page(contents) {
  return '<!doctype html><html lang="en"><meta charset="utf-8">'+
    '<title>Toolkit Hub RTC registry</title><main><h1>RTC server setup</h1>'+
    '<p>Servers are staged pending and cannot route tools or credentials. '+
    'Connection-time public DNS and TLS probing is not authenticated upstream acceptance.</p>'+
    contents+'</main></html>';
}
function forms() {
  return page('<form method="POST" action="/api/owner/servers">'+
    '<input type="hidden" name="action" value="stage">'+
    '<label>Server name <input name="name" maxlength="60" required></label>'+
    '<label>RTC prefix <input name="prefix" maxlength="60" required></label>'+
    '<label>Exact HTTPS origin <input name="origin" maxlength="255" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">Verify and stage (not activate)</button></form>'+
    '<form method="POST" action="/api/owner/servers">'+
    '<input type="hidden" name="action" value="list">'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">List owned staged services</button></form>'+
    '<form method="POST" action="/api/owner/servers">'+
    '<input type="hidden" name="action" value="disable">'+
    '<label>Server name <input name="name" maxlength="60" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">Disable pending server</button></form>'+
    '<form method="POST" action="/api/owner/servers">'+
    '<input type="hidden" name="action" value="retire">'+
    '<label>Exact RTC server name <input name="name" maxlength="60" required></label>'+
    '<label>Type RETIRE to revoke all service TEST grants '+
    '<input name="confirm" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">Permanently retire TEST service and revoke grants</button></form>');
}
function listing(rows) {
  return page('<p>Owner-only staging metadata, at most 100 entries.</p><ul>'+
    rows.map(row=>'<li><code>'+escapeHtml(row.name)+'</code> ('+
      escapeHtml(row.prefix)+') ' +escapeHtml(row.origin)+
      ' — '+escapeHtml(row.state)+'; callable: no</li>').join('')+'</ul>');
}
function validated(fields) {
  if (!fields || !['stage','list','disable','retire'].includes(fields.action)||
    typeof fields.password!=='string'||!fields.password||
    fields.password.length>256) return false;
  if (fields.action==='list') return true;
  if(!slug.test(fields.name||'')) return false;
  if(fields.action==='disable')return true;
  if(fields.action==='retire')return fields.confirm==='RETIRE';
  return slug.test(fields.prefix||'')&&typeof fields.origin==='string'&&
    fields.origin.length>=8&&fields.origin.length<=255;
}

export async function handleOwnerServers(req,res,{withDb,env=process.env,
  verify=verifyOwnerLogin,probe=probeStagedRtcContract,stage=stageHubServer,
  list=listStagedServers,disable=disableStagedServer,
  retire=retireHubServerAndGrants}={}) {
  htmlHeaders(res);
  res.setHeader('Pragma','no-cache');
  if(!['GET','POST'].includes(req.method)) {
    res.setHeader('Allow','GET, POST');
    return res.status(405).send('Method not allowed');
  }
  try {publicHubOrigin(env);}
  catch {return res.status(503).send('Hub owner setup unavailable');}
  if(req.method==='GET') return res.status(200).send(forms());
  if(!String(req.headers?.['content-type']||'').startsWith(
    'application/x-www-form-urlencoded'))
    return res.status(415).send('Unsupported content type');
  const fields=formFields(req);
  if(!validated(fields)) return res.status(400).send('Invalid request');
  try {
    return await withDb(async(db)=>{
      const decision=await verify(db,req,fields.password,{env});
      if(!decision.approved) {
        if(decision.retryAfter)
          res.setHeader('Retry-After',String(decision.retryAfter));
        return res.status(decision.retryAfter?429:401).send('Owner verification denied');
      }
      const ownerId=env.HUB_OWNER_ID;
      if(fields.action==='list') return res.status(200).send(listing(
        await list(db,ownerId,{ownerVerified:true})));
      if(fields.action==='disable') {
        const disabled=await disable(db,{ownerId,name:fields.name},
          {ownerVerified:true});
        return res.status(disabled?200:404).send(disabled?
          'Pending server disabled; no tools were activated.' : 'Pending server unavailable.');
      }
      if(fields.action==='retire') {
        const retired=await retire(db,{ownerId,name:fields.name},
          {ownerVerified:true});
        return res.status(retired?200:404).send(retired?
          'RTC TEST service disabled; '+retired.revokedCount+
          ' remaining scoped grants revoked. No provider call was made.' :
          'Owned RTC service unavailable.');
      }
      // The browser cannot supply count/version facts; validate public RTC1
      // metadata over the pinned-origin socket before persisting a claim.
      const checked=await probe(fields.origin,{name:fields.name,prefix:fields.prefix});
      await stage(db,{ownerId,name:fields.name,prefix:fields.prefix,
        origin:fields.origin,manifest:{rtc:1,server:fields.name,
          prefix:fields.prefix,modes:['test'],profiles:['read_only'],
          counts:{tools:checked.tools,writes:checked.writes,money:checked.money}}},
      {ownerVerified:true});
      return res.status(201).send(page('<p>RTC server staged pending only. '+
        'No routing, credential or live authorization was enabled.</p>'));
    });
  } catch {
    return res.status(503).send('RTC registry stage unavailable; nothing activated.');
  }
}
