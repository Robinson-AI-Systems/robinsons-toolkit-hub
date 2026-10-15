import {it,expect,vi} from 'vitest';
import {handleOwnerDashboard,renderOwnerDashboard}
  from '../src/owner-dashboard.js';
import {readOwnerDashboard,checkedDashboardSelection}
  from '../src/owner-dashboard-data.js';

const env={HUB_PUBLIC_ORIGIN:'https://hub.example.com',HUB_OWNER_ID:'owner-a',
 HUB_TOKEN_PEPPER:'synthetic-test-pepper-not-real-credentials'};
const id='00000000-0000-4000-8000-000000000002';
function response(){
 return {headers:{},statusCode:0,html:'',
   setHeader(k,v){this.headers[k]=v;return this;},
   status(n){this.statusCode=n;return this;},
   send(html){this.html=html;return this;}};
}
async function send(method,body,changes={}){
 const res=response(),verify=vi.fn(async(_db,_req,password)=>({
   approved:password==='correct-owner-passphrase',retryAfter:0}));
 const read=vi.fn(async()=>({tab:'overview',parts:{
   passes:{state:'readable',rows:[]},
   families:{state:'readable',rows:[]},
   grants:{state:'readable',rows:[]}
 }}));
 await handleOwnerDashboard({method,body,headers:{
   'content-type':'application/x-www-form-urlencoded'
 },socket:{remoteAddress:'127.0.0.1'}},res,{
  withDb:async fn=>fn({query:vi.fn()},{}),verify,read,env,...changes});
 return {res,verify,read};
}
it('no private reads on GET, refusals or malformed selection; passphrase not echoed',async()=>{
 const get=await send('GET');
 expect(get.res.statusCode).toBe(200);
 expect(get.res.html).toContain('name="password"');
 expect(get.res.html).toContain('name="tab"');
 expect(get.res.headers['Cache-Control']).toBe('no-store');
 expect(get.res.headers['Content-Security-Policy']).toContain("default-src 'none'");
 expect(get.verify).not.toHaveBeenCalled();
 expect(get.read).not.toHaveBeenCalled();
 for(const body of [
   'tab=unknown&password=correct-owner-passphrase',
   'tab=overview&page=100&password=correct-owner-passphrase',
   'tab=overview&page=-1&password=correct-owner-passphrase',
   'tab=overview&tab=scopes&password=correct-owner-passphrase',
   'tab=scopes&password=correct-owner-passphrase&ownerId=other'
 ]){
   const response=await send('POST',body);
   expect(response.res.statusCode).toBe(400);
   expect(response.verify).not.toHaveBeenCalled();
 }
 const refused=await send('POST','tab=scopes&password=wrong');
 expect(refused.res.statusCode).toBe(401);
 expect(refused.read).not.toHaveBeenCalled();
 const good=await send('POST','tab=overview&password=correct-owner-passphrase');
 expect(good.res.statusCode).toBe(200);
 expect(good.read).toHaveBeenCalledWith({},'owner-a',{},{
   tab:'overview',page:0});
 expect(good.res.html).not.toContain('correct-owner-passphrase');
});
it('owner snapshot projects only safe fields and reports partial database failures',async()=>{
 const source={
   passes:vi.fn(async()=>[{id,state:'active',profile:'read_only',mode:'test',
     serverNames:['stripe'],serviceAreas:{stripe:['billing']},
     serviceProfiles:{stripe:'read_only'},expiresAt:'soon',
     pass:'never-expose',pass_digest:'hidden'}]),
   families:vi.fn(async()=>{throw Error('missing schema detail');}),
   grants:vi.fn(async()=>[{id:'g1',callerId:id,callerKind:'pass',
     server:'stripe',state:'verified_locally',areas:['billing'],
     expiresAt:'tomorrow',ciphertext:'sensitive'}])
 };
 const data=await readOwnerDashboard({},'owner-a',{},{
   tab:'overview',page:0},source);
 expect(data.parts.passes.state).toBe('readable');
 expect(data.parts.families.state).toBe('unavailable');
 expect(data.parts.grants.state).toBe('readable');
 const html=renderOwnerDashboard(data);
 expect(html).toContain('billing');
 expect(html).toContain('Unavailable');
 for(const secret of ['never-expose','pass_digest','sensitive'])
   expect(html).not.toContain(secret);
 expect(source.passes).toHaveBeenCalledWith({},'owner-a',{ownerVerified:true});
 expect(source.grants).toHaveBeenCalledWith({},'owner-a',{
   ownerVerified:true,limit:60});
});
it('scope page inspects current owner SQL and delegates destructive actions to verified routes',async()=>{
 const grants=vi.fn(async()=>[{
   id:'grant-1',callerKind:'pass',callerId:id,server:'stripe',
   state:'verified_locally',areas:['billing','reports']
 },{id:'grant-2',callerKind:'pass',callerId:id,server:'stripe',
   state:'replacement_awaiting_verification'}]);
 const inspect=vi.fn(async()=>({
   available:true,callable:true,profile:'read_only',
   authorizedAreas:['billing'],grantAreas:['billing','reports'],
   callerAreaLimit:['billing'],callerProfileLimit:null,
   expiresAt:'soon',ciphertext:'never-serialize'
 }));
 const data=await readOwnerDashboard({},'owner-a',{},{
   tab:'scopes',page:0},{grants,inspect});
 expect(inspect).toHaveBeenCalledTimes(1);
 expect(inspect).toHaveBeenCalledWith({},{
   ownerId:'owner-a',callerKind:'pass',callerId:id,serverName:'stripe'},
   {ownerVerified:true});
 const html=renderOwnerDashboard(data);
 expect(html).toContain('action="/api/owner/passes"');
 expect(html).toContain('name="action" value="narrow_areas"');
 expect(html).toContain('name="action" value="narrow_profile"');
 expect(html).toContain('name="action" value="preview_area_plan"');
 expect(html).toContain('new independent approval');
 expect(html).toContain('provider');
 expect(html).not.toContain('never-serialize');
 expect(html).not.toContain('<script');
});
it('dashboard refuses HTML injection, keeps exact matching owner and bound selectors',async()=>{
 const malicious='<img src=x onerror=alert(1)>';
 const data={tab:'overview',parts:{
   passes:{state:'readable',rows:[{
     id,profile:'read_only',mode:'test',state:'active',serverNames:[malicious],
     serviceAreas:{stripe:['billing']},serviceProfiles:{},expiresAt:'tomorrow'
   }]},
   families:{state:'readable',rows:[]},
   grants:{state:'readable',rows:[]}
 }};
 const html=renderOwnerDashboard(data);
 expect(html).toContain('&lt;img');
 expect(html).not.toContain('<img');
 expect(()=>checkedDashboardSelection({tab:'overview',page:'999'})).toThrow();
 expect(()=>checkedDashboardSelection({tab:'readiness',page:'0',owner:'other'})).toThrow();
});
it('grants visibility and local readiness never certify provider TEST acceptance',async()=>{
 const state=await readOwnerDashboard({},'owner-a',{},{
   tab:'readiness',page:0},{readiness:async()=>({
     schemaReady:true,installedTables:4,grantsKeyReady:true,resultsKeyReady:true,
     servers:2,stagedGrants:2,activeServers:2,verifiedGrants:2,readyServices:2
   })});
 expect(state.externalAcceptance).toBe('unverified');
 const html=renderOwnerDashboard(state);
 expect(html).toContain('UNVERIFIED');
 expect(html).toContain('Active services with verified grants');
 expect(html).not.toContain('provider accepted');
});
