import { withHubDb } from '../../packages/hub/src/runtime.js';
import { registerOwnerClient, formFields, htmlHeaders,
  publicHubOrigin } from '../../packages/hub/src/owner-login.js';
export default async function handler(req,res) {
  htmlHeaders(res);
  if (req.method==='GET') return res.status(200).send(
    '<!doctype html><html lang="en"><meta charset="utf-8"><title>Hub client registration</title>'+
    '<h1>Register a trusted Hub OAuth client</h1><form method="POST" action="/api/oauth/clients">'+
    '<label>Client ID <input name="client_id" required></label>'+
    '<label>Exact redirect URI <input name="redirect_uri" required></label>'+
    '<label>Owner passphrase <input name="password" type="password" required></label>'+
    '<button type="submit">Register</button></form></html>');
  if (req.method!=='POST') return res.status(405).send('Method not allowed');
  const input=formFields(req);
  if (!input) return res.status(400).send('Invalid request');
  try {
    publicHubOrigin();
    return await withHubDb(async db=>{
      const result=await registerOwnerClient(db,req,input);
      if (result.retryAfter) res.setHeader('Retry-After',String(result.retryAfter));
      return res.status(result.status).send(result.status===201 ?
        'Trusted client registered' : 'Registration denied');
    });
  } catch { return res.status(503).send('Owner setup unavailable'); }
}
