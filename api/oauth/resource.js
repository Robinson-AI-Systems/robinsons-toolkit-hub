import { publicHubOrigin } from '../../packages/hub/src/owner-login.js';
export default function handler(req,res) {
  res.setHeader('Cache-Control','public, max-age=60');
  if (req.method!=='GET') return res.status(405).json({error:'method_not_allowed'});
  try {
    const origin=publicHubOrigin();
    return res.status(200).json({resource:origin+'/api/mcp',authorization_servers:[origin],
      bearer_methods_supported:['header']});
  } catch { return res.status(503).json({error:'hub_unavailable'}); }
}
