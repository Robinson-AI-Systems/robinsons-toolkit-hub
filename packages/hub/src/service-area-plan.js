// H-4: independently owner-approved, all-or-nothing multi-service reductions.
// Provider grants and service-owned permissions are never modified.
import {parseInitialServiceAreas,validServiceAreas,
 narrowHubPassServiceAreas,narrowOAuthFamilyServiceAreas} from './service-area-policy.js';
import {inspectOwnerServiceScope} from './owner-service-scope.js';
const service=/^[a-z][a-z0-9_]{1,59}$/;
const owner=/^[A-Za-z0-9:_-]{1,120}$/;
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const refuse=()=>{throw new TypeError('Invalid service-area reduction plan');};
export function checkedOwnerServiceAreaPlan(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
   ![Object.prototype,null].includes(Object.getPrototypeOf(value)))refuse();
 const entries=Object.entries(value);
 if(!entries.length||entries.length>10||entries.some(([name,areas])=>
   !service.test(name)||!validServiceAreas(areas)))refuse();
 return Object.freeze(Object.fromEntries(entries.sort(([a],[b])=>a.localeCompare(b))
   .map(([name,areas])=>[name,Object.freeze([...areas])])));
}
export function parseOwnerServiceAreaPlan(raw){
 if(typeof raw!=='string'||!raw||Buffer.byteLength(raw,'utf8')>2048)refuse();
 const entries=raw.split(',');
 if(entries.length<1||entries.length>10)refuse();
 const names=entries.map(entry=>{
   const at=entry.indexOf(':');
   if(at<1||at!==entry.lastIndexOf(':'))refuse();
   const name=entry.slice(0,at);
   if(!service.test(name))refuse();
   return name;
 });
 return checkedOwnerServiceAreaPlan(parseInitialServiceAreas(raw,names));
}
function verify(input,ownerVerified){
 if(ownerVerified!==true||!input||!owner.test(input.ownerId||'')||
   !uuid.test(input.id||'')||!['pass','oauth'].includes(input.callerKind))
   throw new Error('Independently verified owner scope required');
 return checkedOwnerServiceAreaPlan(input.plan);
}
export async function previewOwnerServiceAreaPlan(db,input,{ownerVerified=false,
 inspect=inspectOwnerServiceScope}={}){
 const plan=verify(input,ownerVerified),scopes=[];
 for(const [serverName,areas] of Object.entries(plan)){
   const current=await inspect(db,{ownerId:input.ownerId,
     callerKind:input.callerKind,callerId:input.id,serverName},
     {ownerVerified:true});
   const available=current?.available===true&&current.callable===true&&
     Array.isArray(current.authorizedAreas)&&
     areas.every(area=>current.authorizedAreas.includes(area));
   scopes.push({server:serverName,available,
     before:current?.available===true?[...current.authorizedAreas]:[],
     after:[...areas]});
 }
 return {canApply:scopes.every(scope=>scope.available),scopes,
   requiresFreshOwnerApproval:true,transactional:true};
}
/**
 * Every existing SQL guard, audit and result-handle invalidation runs on the
 * same acquired PostgreSQL client. A refusal or exception rolls back every
 * step, not merely the policy update. Independent fresh owner approval is
 * required; an earlier preview never authorizes any transaction.
 */
export async function executeOwnerServiceAreaPlan(db,input,
 {ownerVerified=false,narrowPass=narrowHubPassServiceAreas,
 narrowOAuth=narrowOAuthFamilyServiceAreas}={}){
 const plan=verify(input,ownerVerified);
 if(!db||typeof db.query!=='function')refuse();
 let active=false;
 try{
   await db.query('BEGIN');
   active=true;
   for(const [serverName,areas] of Object.entries(plan)){
     const narrow=input.callerKind==='pass'?narrowPass:narrowOAuth;
     const result=await narrow(db,{ownerId:input.ownerId,id:input.id,
       serverName,areas:[...areas]},{ownerVerified:true});
     if(result?.updated!==true){
       await db.query('ROLLBACK');
       active=false;
       return {updated:false,services:[],atomic:true,
         explanation:'Scope changed or operation would widen permissions'};
     }
   }
   await db.query('COMMIT');
   active=false;
   return {updated:true,services:Object.keys(plan),atomic:true};
 }catch(error){
   if(active){
     try{await db.query('ROLLBACK');}
     catch(rollbackError){throw new AggregateError([error,rollbackError],
       'Unable to verify atomic policy rollback');}
   }
   throw error;
 }
}
