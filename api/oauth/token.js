import { exchangeOAuthCode, rotateOAuthRefresh } from '../../packages/hub/src/oauth.js';
import { withHubDb } from '../../packages/hub/src/runtime.js';
import { takeBudget } from '../../packages/hub/src/limits.js';
import { parseOAuthForm } from '../../packages/hub/src/oauth-form.js';
import {developerClientValid} from '../../packages/hub/src/developer-handoff.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
  const json=String(req.headers['content-type']||'').startsWith('application/json');
  if (!json&&!String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded'))
    return res.status(415).json({error:'unsupported_media_type'});
  const body=req.body;
  const form=json?(body&&typeof body==='object'&&!Array.isArray(body)&&
    Object.getPrototypeOf(body)===Object.prototype&&Object.keys(body).length<=8&&
    Object.values(body).every(v=>typeof v==='string'&&v.length<=2048)?new URLSearchParams(body):null):parseOAuthForm(req);
  if (!form) return res.status(400).json({error:'invalid_request'});
  const grant=form.get('grant_type'),clientId=form.get('client_id');
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(clientId||'') ||
    !['authorization_code','refresh_token'].includes(grant))
    return res.status(400).json({error:'invalid_request'});
  try {
    return await withHubDb(async(db,settings)=>{
      const dynamic=(await db.query('SELECT 1 FROM hub_developer_clients WHERE client_id=$1',[clientId])).rows.length>0;
      if((json||dynamic)&&!await developerClientValid(db,clientId,form.get('client_secret')))
        return res.status(401).json({error:'invalid_client'});
      if((json||dynamic)&&form.get('resource')!==process.env.HUB_PUBLIC_ORIGIN+'/api/mcp')
        return res.status(400).json({error:'invalid_target'});
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
