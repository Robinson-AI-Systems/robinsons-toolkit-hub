import { revokeOAuthToken } from '../../packages/hub/src/oauth.js';
import { parseOAuthForm } from '../../packages/hub/src/oauth-form.js';
import { withHubDb } from '../../packages/hub/src/runtime.js';
import { takeBudget } from '../../packages/hub/src/limits.js';

// A client can revoke the exact bearer it owns; other clients' or random
// values return the same neutral success, without disclosing existence.
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
  if(!String(req.headers?.['content-type']||'').startsWith('application/x-www-form-urlencoded'))
    return res.status(415).json({error:'unsupported_media_type'});
  const form=parseOAuthForm(req), clientId=form?.get('client_id');
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(clientId||'') ||
    typeof form?.get('token')!=='string')
    return res.status(400).json({error:'invalid_request'});
  try {
    return await withHubDb(async (db,settings)=>{
      const budget=await takeBudget(db,{scope:'oauth-revoke:'+clientId,
        pepper:settings.pepper,max:30,seconds:60});
      if(!budget.allowed) {
        res.setHeader('Retry-After',String(budget.retryAfter));
        return res.status(429).json({error:'rate_limited'});
      }
      await revokeOAuthToken(db,{clientId,token:form.get('token')},settings);
      return res.status(200).json({});
    });
  } catch {
    return res.status(503).json({error:'temporarily_unavailable'});
  }
}
