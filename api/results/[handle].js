import {withHubDb,hubActor} from '../../packages/hub/src/runtime.js';
import {readHubResult} from '../../packages/hub/src/results.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET') return res.status(405).json({ok:false,error:{code:'method_not_allowed'}});
  const handle=req.query?.handle,page=req.query?.page??'0';
  if(typeof handle!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(handle)||
    !/^(0|[1-9]|1[0-5])$/.test(String(page))||Array.isArray(page))
    return res.status(400).json({ok:false,error:{code:'invalid_args'}});
  try {
    return await withHubDb(async(db,settings)=>{
      const state=await hubActor(db,settings,req.headers?.authorization,'pass');
      if(!state) return res.status(401).json({ok:false,error:{code:'permission'}});
      if(state.retryAfter){
        res.setHeader('Retry-After',String(state.retryAfter));
        return res.status(429).json({ok:false,error:{code:'rate_limited'}});
      }
      if(!state.actor||state.actor.mode!=='test'||state.actor.allowWrites===true||
        !Array.isArray(state.actor.areas)||!state.actor.areas.includes('gateway'))
        return res.status(403).json({ok:false,error:{code:'outside_scope'}});
      const result=await readHubResult(db,state.actor,handle,Number(page),settings);
      return result?res.status(200).json({ok:true,result}):
        res.status(404).json({ok:false,error:{code:'not_found'}});
    });
  }catch{return res.status(503).json({ok:false,error:{code:'service_error'}});}
}
