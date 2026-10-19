import {readHubResult} from './results.js';
import {readRtcResult} from './rtc-results.js';
// RTC pages use current scoped TEST/LIVE grants. Legacy H-1 handles keep
// their original TEST/read-only policy and separate encrypted storage.
export async function handleHubResult(req,res,{withDb,authorize,
 readRtc=readRtcResult,readLegacy=readHubResult}) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET') return res.status(405).json({ok:false,error:{code:'method_not_allowed'}});
  const handle=req.query?.handle,page=req.query?.page??'0';
  if(typeof handle!=='string'||!(/^[A-Za-z0-9_-]{43}$/.test(handle)||/^rtc_[A-Za-z0-9_-]{43}$/.test(handle))||
    !/^(0|[1-9]|1[0-5])$/.test(String(page))||Array.isArray(page))
    return res.status(400).json({ok:false,error:{code:'invalid_args'}});
  try {
    return await withDb(async(db,settings)=>{
      const state=await authorize(db,settings,req.headers?.authorization,'pass');
      if(!state) return res.status(401).json({ok:false,error:{code:'permission'}});
      if(state.retryAfter){
        res.setHeader('Retry-After',String(state.retryAfter));
        return res.status(429).json({ok:false,error:{code:'rate_limited'}});
      }
      const actor=state.actor,rtc=handle.startsWith('rtc_');
      const gateway=Array.isArray(actor?.areas)&&actor.areas.includes('gateway');
      const scopedRtc=gateway&&['test','live'].includes(actor?.mode)&&
        ['read_only','everyday','full'].includes(actor?.profile)&&
        !(actor.allowWrites===true&&actor.profile==='read_only');
      const scopedLegacy=gateway&&actor?.mode==='test'&&actor.allowWrites!==true;
      if(rtc?!scopedRtc:!scopedLegacy)
        return res.status(403).json({ok:false,error:{code:'outside_scope'}});
      const result=rtc ?
        await readRtc(db,actor,handle,Number(page),settings) :
        await readLegacy(db,actor,handle,Number(page),settings);
      return result?res.status(200).json({ok:true,result}):
        res.status(404).json({ok:false,error:{code:'not_found'}});
    });
  }catch{return res.status(503).json({ok:false,error:{code:'service_error'}});}
}
