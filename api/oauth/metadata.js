import { publicHubOrigin } from '../../packages/hub/src/owner-login.js';
export default function handler(req,res) {
  res.setHeader('Cache-Control','public, max-age=60');
  if (req.method!=='GET') return res.status(405).json({error:'method_not_allowed'});
  try {
    const origin=publicHubOrigin();
    return res.status(200).json({issuer:origin,authorization_endpoint:origin+'/api/oauth/authorize',
      token_endpoint:origin+'/api/oauth/token',response_types_supported:['code'],
      grant_types_supported:['authorization_code','refresh_token'],
      code_challenge_methods_supported:['S256'],
      token_endpoint_auth_methods_supported:['none']});
  } catch { return res.status(503).json({error:'hub_unavailable'}); }
}
