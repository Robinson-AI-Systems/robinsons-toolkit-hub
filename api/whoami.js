import { withHubDb, hubActor } from '../packages/hub/src/runtime.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method!=='GET') return res.status(405).json({ok:false,error:{code:'method_not_allowed'}});
  try {
    return await withHubDb(async(db,settings)=>{
      const state=await hubActor(db,settings,req.headers.authorization,'pass');
      if (!state) return res.status(401).json({ok:false,error:{code:'permission'}});
      if (state.retryAfter) {
        res.setHeader('Retry-After',String(state.retryAfter));
        return res.status(429).json({ok:false,error:{code:'rate_limited'}});
      }
      const {profile,mode,areas}=state.actor;
      return res.status(200).json({ok:true,result:{profile,mode,areas,allowWrites:false}});
    });
  } catch { return res.status(503).json({ok:false,error:{code:'unavailable'}}); }
}
