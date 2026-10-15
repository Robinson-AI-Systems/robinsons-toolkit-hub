import {escapeHtml,formFields,htmlHeaders,publicHubOrigin,
  verifyOwnerLogin} from './owner-login.js';
import {activateVerifiedCallerGrant} from './grants.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function form() {
  return '<!doctype html><html lang="en"><meta charset="utf-8">'+
    '<title>RTC TEST connection verification</title><main>'+
    '<h1>Verify one scoped RTC TEST grant</h1>'+
    '<p>This also verifies independently issued replacement grants on '+
    'already active services. A successful replacement atomically retires '+
    'the previous grant and invalidates its encrypted result pages; a '+
    'failed provider probe never retires a working grant.</p>'+
    '<p>This probes only RTC contract and whoami over DNS-pinned HTTPS. '+
    'It never performs a provider tool call, broadens a pass or deploys code.</p>'+
    '<form method="POST" action="/api/owner/verify-grant">'+
    '<label>Exact staged grant ID <input name="id" maxlength="36" required></label>'+
    '<label>Owner passphrase <input type="password" name="password" required></label>'+
    '<button type="submit">Verify TEST grant</button></form></main>';
}
export async function handleVerifyGrant(req,res,{withDb,env=process.env,
  verify=verifyOwnerLogin,activate=activateVerifiedCallerGrant}={}) {
  htmlHeaders(res);
  if(!['GET','POST'].includes(req.method))return res.status(405).send('Method not allowed');
  try {publicHubOrigin(env);}
  catch {return res.status(503).send('Hub owner setup unavailable');}
  if(req.method==='GET')return res.status(200).send(form());
  if(!String(req.headers?.['content-type']||'').startsWith(
    'application/x-www-form-urlencoded'))return res.status(415).send('Unsupported content type');
  const body=formFields(req);
  if(!body||!uuid.test(body.id||'')||typeof body.password!=='string'||!body.password||
    body.password.length>256)return res.status(400).send('Invalid request');
  try {
    return await withDb(async(db,settings)=>{
      const verdict=await verify(db,req,body.password,{env});
      if(!verdict.approved) {
        if(verdict.retryAfter)res.setHeader('Retry-After',String(verdict.retryAfter));
        return res.status(verdict.retryAfter?429:401).send('Owner verification denied');
      }
      const checked=await activate(db,{ownerId:env.HUB_OWNER_ID,id:body.id},
        settings,{ownerVerified:true});
      return res.status(200).send('Verified TEST grant for '+
        escapeHtml(checked.server)+
        '. Registry activation does not enable provider routing or live authorization.');
    });
  } catch {return res.status(503).send(
    'Scoped TEST grant verification refused or unavailable.');}
}
