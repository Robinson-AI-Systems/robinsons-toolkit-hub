import { exchangeOAuthCode, rotateOAuthRefresh } from '../../packages/hub/src/oauth.js';
import { withHubDb } from '../../packages/hub/src/runtime.js';
import { takeBudget } from '../../packages/hub/src/limits.js';
function safeForm(req) {
  if (typeof req.body==='string' && Buffer.byteLength(req.body)<=4096)
    return new URLSearchParams(req.body);
  if (req.body && typeof req.body==='object' && !Array.isArray(req.body) &&
    Object.getPrototypeOf(req.body)===Object.prototype) {
    const items=Object.entries(req.body);
    if (items.length<=8 && items.every(([k,v])=>k.length<=40 &&
      typeof v==='string' && v.length<=1024)) return new URLSearchParams(items);
  }
  return null;
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
  if (!String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded'))
    return res.status(415).json({error:'unsupported_media_type'});
  const form=safeForm(req);
  if (!form) return res.status(400).json({error:'invalid_request'});
  const grant=form.get('grant_type'),clientId=form.get('client_id');
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(clientId||'') ||
    !['authorization_code','refresh_token'].includes(grant))
    return res.status(400).json({error:'invalid_request'});
  try {
    return await withHubDb(async(db,settings)=>{
      const limit=await takeBudget(db,{scope:'oauth-token:'+clientId,pepper:settings.pepper,max:30});
      if (!limit.allowed) {
        res.setHeader('Retry-After',String(limit.retryAfter));
        return res.status(429).json({error:'rate_limited'});
      }
      const tokens=grant==='authorization_code' ?
        await exchangeOAuthCode(db,{code:form.get('code'),verifier:form.get('code_verifier'),
          clientId,redirectUri:form.get('redirect_uri')},settings) :
        await rotateOAuthRefresh(db,{refreshToken:form.get('refresh_token'),clientId},settings);
      return tokens? res.status(200).json(tokens) : res.status(400).json({error:'invalid_grant'});
    });
  } catch { return res.status(503).json({error:'temporarily_unavailable'}); }
}
