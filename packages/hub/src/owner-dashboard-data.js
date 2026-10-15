// H-4 owner-only, read-only inventory assembled from the existing H-1/H-2/H-3
// SQL authority. A row here is NOT independent provider acceptance.
import {listHubPassScopes} from './identity.js';
import {listOwnerOAuthFamilies} from './oauth.js';
import {listOwnerGrantReadiness} from './grant-lifecycle.js';
import {inspectOwnerServiceScope,listOwnerServiceAreaAudit} from './owner-service-scope.js';
import {listOwnerProfileAudit} from './service-profile-policy.js';
import {summarizeHubReadiness} from './owner-readiness.js';

const owners=/^[A-Za-z0-9:_-]{1,120}$/;
const validTabs=new Set(['overview','scopes','audit','readiness']);
export function checkedDashboardSelection(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
   Object.keys(input).some(k=>!['tab','page'].includes(k)))
   throw new TypeError('Invalid owner dashboard selection');
 const tab=input.tab??'overview',raw=input.page??'0';
 if(!validTabs.has(tab)||typeof raw!=='string'||!/^(0|[1-9]|[1-9][0-9])$/.test(raw))
   throw new TypeError('Invalid dashboard tab or page');
 return {tab,page:Number(raw)};
}
function errorMarker(){return {state:'unavailable',rows:[]};}
function compactPasses(rows){
 return rows.slice(0,8).map(item=>({
   id:item.id,state:item.state,mode:item.mode,profile:item.profile,
   expiresAt:item.expiresAt,serverNames:item.serverNames,
   serviceAreas:item.serviceAreas,serviceProfiles:item.serviceProfiles
 }));
}
function compactFamilies(rows){
 return rows.slice(0,8).map(item=>({
   id:item.id,clientId:item.clientId,mode:item.mode,profile:item.profile,
   serverNames:item.serverNames,serviceAreas:item.serviceAreas,
   serviceProfiles:item.serviceProfiles,refreshExpiresAt:item.refreshExpiresAt
 }));
}
function compactGrants(rows){
 return rows.slice(0,8).map(item=>({
   id:item.id,callerKind:item.callerKind,callerId:item.callerId,
   server:item.server,state:item.state,areas:item.areas,
   expiresAt:item.expiresAt,providerIdentityStillValid:'not_rechecked'
 }));
}
async function independently(read){
 try{
   const rows=await read();
   return {state:'readable',rows};
 }catch{return errorMarker();}
}
export async function readOwnerDashboard(db,ownerId,settings,selection,
 {passes=listHubPassScopes,families=listOwnerOAuthFamilies,
 grants=listOwnerGrantReadiness,inspect=inspectOwnerServiceScope,
 areasAudit=listOwnerServiceAreaAudit,profilesAudit=listOwnerProfileAudit,
 readiness=summarizeHubReadiness}={}){
 if(!owners.test(ownerId||''))throw new TypeError('Invalid owner');
 const {tab,page}=checkedDashboardSelection(selection);
 if(tab==='overview'){
   // Partial storage/migration outages are visible in their own section,
   // not silently represented as zero accounts or a successful setup.
   const [a,b,c]=await Promise.all([
     independently(()=>passes(db,ownerId,{ownerVerified:true})),
     independently(()=>families(db,ownerId,{ownerVerified:true})),
     independently(()=>grants(db,ownerId,{ownerVerified:true,limit:60}))
   ]);
   return {tab,parts:{
     passes:{state:a.state,rows:compactPasses(a.rows)},
     families:{state:b.state,rows:compactFamilies(b.rows)},
     grants:{state:c.state,rows:compactGrants(c.rows)}
   },notice:'Source metadata, not verified external RTC provider acceptance'};
 }
 if(tab==='readiness'){
   try{
     const r=await readiness(db,ownerId,settings);
     return {tab,state:'readable',readiness:{
       schemaReady:Boolean(r.schemaReady),installedTables:Number(r.installedTables),
       grantsKeyReady:Boolean(r.grantsKeyReady),resultsKeyReady:Boolean(r.resultsKeyReady),
       servers:Number(r.servers),stagedGrants:Number(r.stagedGrants),
       activeServers:Number(r.activeServers),verifiedGrants:Number(r.verifiedGrants),
       readyServices:Number(r.readyServices)
     },externalAcceptance:'unverified'};
   }catch{return {tab,state:'unavailable',readiness:null,externalAcceptance:'unverified'};}
 }
 if(tab==='audit'){
   const [a,b]=await Promise.all([
     independently(()=>areasAudit(db,ownerId,{ownerVerified:true,limit:20})),
     independently(()=>profilesAudit(db,ownerId,{ownerVerified:true,limit:20}))
   ]);
   return {tab,parts:{
     areas:{state:a.state,rows:a.rows.map(x=>({
       at:x.at,kind:x.kind,callerId:x.callerId,server:x.server,
       areas:x.areas,affectedSessions:x.affectedSessions,
       purgedHandles:x.purgedHandles
     }))},
     profiles:{state:b.state,rows:b.rows.map(x=>({
       at:x.at,kind:x.kind,callerId:x.callerId,server:x.server,
       profile:x.profile,affectedSessions:x.affectedSessions,
       purgedHandles:x.purgedHandles
     }))}
   }};
 }
 const grantState=await independently(()=>grants(db,ownerId,
   {ownerVerified:true,limit:60}));
 if(grantState.state!=='readable')
   return {tab,state:'unavailable',rows:[],page,next:null};
 const seen=new Set(),scoped=[];
 for(const entry of grantState.rows){
   if(entry.state!=='verified_locally')continue;
   const key=[entry.callerKind,entry.callerId,entry.server].join(':');
   if(seen.has(key))continue;
   seen.add(key);
   scoped.push(entry);
 }
 const begin=page*10;
 const entries=scoped.slice(begin,begin+10);
 const rows=await Promise.all(entries.map(async item=>{
   try{
     const x=await inspect(db,{ownerId,callerKind:item.callerKind,
       callerId:item.callerId,serverName:item.server},{ownerVerified:true});
     return {kind:item.callerKind,callerId:item.callerId,server:item.server,
       grantId:item.id,available:Boolean(x.available),callable:Boolean(x.callable),
       profile:x.profile??'disabled',authorizedAreas:x.available?
         [...x.authorizedAreas]:[],grantAreas:x.available?[...x.grantAreas]:[],
       callerAreaLimit:x.available?x.callerAreaLimit:null,
       callerProfileLimit:x.available?x.callerProfileLimit:null,
       expiresAt:x.available?x.expiresAt:null,inspection:'current_sql'};
   }catch{
     return {kind:item.callerKind,callerId:item.callerId,server:item.server,
       grantId:item.id,available:false,callable:false,inspection:'unavailable'};
   }
 }));
 return {tab,state:'readable',rows,page,next:begin+10<scoped.length?page+1:null,
   truncatedRoster:grantState.rows.length>=60,
   externalAcceptance:'unverified'};
}
