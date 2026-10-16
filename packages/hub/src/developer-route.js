import {withHubDb} from './runtime.js';
import {ownerRecovery} from './owner-recovery.js';
import {takeBudget} from './limits.js';
import {htmlHeaders,formFields} from './owner-login.js';
import {registerDeveloperClient,developerHandoff,ownerSetup} from './developer-handoff.js';
export function developerRoute(kind){return async(req,res)=>{
 htmlHeaders(res);
 if(kind==='register'&&req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 try{return await withHubDb(async(db,settings)=>{
  const limit=await takeBudget(db,{scope:'developer-'+kind+':'+(req.socket?.remoteAddress||'unknown'),pepper:settings.pepper,max:kind==='connect'?60:10,seconds:900});
  if(!limit.allowed){res.setHeader('Retry-After',String(limit.retryAfter));return res.status(429).json({error:'rate_limited'});}
  if((kind==='setup'||kind==='recover')&&req.method==='POST')req={...req,body:formFields(req)};
  const result=kind==='register'?await registerDeveloperClient(db,req.body):kind==='setup'?await ownerSetup(db,req):kind==='recover'?await ownerRecovery(db,req):await developerHandoff(db,req);
  if(result.json){res.setHeader('Content-Type','application/json');return res.status(result.status).json(result.json);}
  return res.status(result.status).send(result.html);
 });}catch{return res.status(503).json({error:'developer_connection_unavailable'});}
};}
