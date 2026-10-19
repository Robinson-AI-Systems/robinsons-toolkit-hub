import {it,expect,vi} from 'vitest';
import {handleOwnerConnectService,connectRtcService,availableServiceCallers,registerDiscoveredService} from '../src/owner-connect-service.js';
const owner='synthetic-owner',hubOrigin='https://hub.example.org';
const id='11111111-1111-4111-8111-111111111111';
const grantId='22222222-2222-4222-8222-222222222222';
const pass='rtc_pass_'+('fake'.repeat(10)+'abc');
const service={origin:'https://provider.example.org',server:'independent-service',prefix:'independent',rtc:1,
 tools:7,writes:2,money:0,modes:['test','live'],profiles:['read_only','everyday','full'],areas:['reports','workspace']};
const selection=(extra={})=>({origin:service.origin,server:service.server,prefix:service.prefix,
 callerKind:'oauth',callerId:id,mode:'live',profile:'read_only',areas:['reports'],pass,...extra});
const caller=(extra={})=>({id,kind:'oauth',mode:'live',profile:'full',allowWrites:true,areas:['gateway'],
 serverNames:null,serviceProfiles:{},serviceAreas:{},...extra});
function setup({existing=[],slots=[],current=caller(),discovered=service}={}){
 const db={query:vi.fn(async sql=>({rows:sql.includes('FROM hub_servers WHERE')?existing:slots}))};
 const deps={ownerVerified:true,discover:vi.fn(async()=>discovered),callers:vi.fn(async()=>[current]),
 inspect:vi.fn(async()=>({identityVerified:true})),stage:vi.fn(async()=>({state:'pending'})),
 grant:vi.fn(async()=>({id:grantId})),activate:vi.fn(async()=>({state:'verified_live',server:service.server}))};
 return {db,deps};
}
function http(body,{method='POST',origin=hubOrigin,...deps}={}){
 const res={code:null,body:null,headers:{},setHeader(k,v){this.headers[k]=v;},
 status(c){this.code=c;return this;},send(b){this.body=b;return this;}};
 const common={env:{HUB_PUBLIC_ORIGIN:hubOrigin,HUB_OWNER_ID:owner},
 withDb:vi.fn(fn=>fn({},{})),verify:vi.fn(async()=>({approved:true})),
 discover:vi.fn(async()=>service),callers:vi.fn(async()=>[caller()]),
 register:vi.fn(async()=>({state:'pending'})),
 connect:vi.fn(async()=>({server:service.server,state:'verified_live',mode:'live',profile:'read_only',areas:['reports']})),...deps};
 return {res,deps:common,invoke:()=>handleOwnerConnectService({method,body,
 headers:{origin,'content-type':'application/x-www-form-urlencoded'}},res,common)};
}
it('discovers any service without a provider credential and registers public metadata only and offers explicit connections',async()=>{
 const h=http({action:'discover',origin:service.origin,password:'synthetic-owner-auth'});
 await h.invoke();expect(h.res.code).toBe(200);expect(h.deps.discover).toHaveBeenCalledWith(service.origin);
 expect(h.deps.connect).not.toHaveBeenCalled();expect(h.deps.register).toHaveBeenCalledWith({},owner,service,{ownerVerified:true});expect(h.res.body).toContain(service.server);
 expect(h.res.body).toContain('value="live"');expect(h.res.body).toContain('value="oauth:'+id+'"');
 expect(h.res.body).not.toContain('google-workspace');expect(h.res.body).not.toContain(pass);
 expect(h.res.body).toContain('Public metadata is not authorization');
});
it('public GET needs no owner lookup; empty caller view creates no grant',async()=>{
 const h=http(undefined,{method:'GET'});await h.invoke();expect(h.res.code).toBe(200);
 expect(h.deps.withDb).not.toHaveBeenCalled();expect(h.res.body).toContain('Discover service');
 const empty=http({action:'discover',origin:service.origin,password:'synthetic-owner-auth'},
 {callers:vi.fn(async()=>[])});await empty.invoke();expect(empty.res.body).toContain('No current Hub connection');
 expect(empty.deps.connect).not.toHaveBeenCalled();
});
it('requires same-origin and independently approved owner before network discovery',async()=>{
 for(const args of [{origin:'https://foreign.example.org'},{verify:vi.fn(async()=>({approved:false}))},
 {verify:vi.fn(async()=>({approved:false,retryAfter:900}))}]){
  const h=http({action:'discover',origin:service.origin,password:'synthetic-owner-auth'},args);
  await h.invoke();expect([403,401,429]).toContain(h.res.code);expect(h.deps.discover).not.toHaveBeenCalled();
 }
});
it('rejects arbitrary URLs, invalid choices, duplicates and undeclared fields before owner or network work',async()=>{
 const good={action:'connect',origin:service.origin,server:service.server,prefix:service.prefix,
 caller:'oauth:'+id,mode:'live',profile:'read_only',areas:'reports',service_pass:pass,password:'synthetic-owner-auth'};
 for(const patch of [{origin:'http://localhost'},{origin:service.origin+'/api/private'},
  {caller:'oauth:foreign:extra'},{areas:'reports,reports'},{profile:'full'},{mode:'production'},
  {arbitrary:'value'},{service_pass:'wrong'}]){
  const h=http({...good,...patch});await h.invoke();expect(h.res.code).toBe(400);
  expect(h.deps.verify).not.toHaveBeenCalled();expect(h.deps.connect).not.toHaveBeenCalled();
 }
});
it('connect submit reauthenticates and supplies exact chosen scope, never echoes credentials',async()=>{
 const h=http({action:'connect',origin:service.origin,server:service.server,prefix:service.prefix,
 caller:'oauth:'+id,mode:'live',profile:'read_only',areas:'reports',service_pass:pass,password:'synthetic-owner-auth'});
 await h.invoke();expect(h.res.code).toBe(200);expect(h.deps.connect).toHaveBeenCalledWith({}, {},owner,
  selection({writeAck:undefined}),{ownerVerified:true});expect(h.res.body).not.toContain(pass);
 expect(h.res.body).not.toContain('synthetic-owner-auth');
});
it('provider errors and partially staged failures are sanitized without automatic replay',async()=>{
 const h=http({action:'connect',origin:service.origin,server:service.server,prefix:service.prefix,
 caller:'oauth:'+id,mode:'live',profile:'read_only',areas:'reports',service_pass:pass,password:'synthetic-owner-auth'},
 {connect:vi.fn(async()=>{throw Error(pass);})});await h.invoke();expect(h.res.code).toBe(503);
 expect(h.res.body).not.toContain(pass);expect(h.deps.connect).toHaveBeenCalledTimes(1);
 expect(h.res.body).toContain('Check the registry and staged grants before retrying');
});
it.each(['test','live'])('binds discovered %s authorization only to the selected caller through existing activation',async mode=>{
 const {db,deps}=setup({current:caller({mode})});deps.activate.mockResolvedValue({server:service.server,state:'verified_'+mode});
 const out=await connectRtcService(db,{},owner,selection({mode}),deps);
 expect(out.state).toBe('verified_'+mode);expect(deps.inspect).toHaveBeenCalledWith({origin:service.origin,
 name:service.server,prefix:service.prefix,areas:['reports'],pass,profile:'read_only',mode});
 expect(deps.grant).toHaveBeenCalledWith(db,expect.objectContaining({callerKind:'oauth',callerId:id,serverName:service.server,
 profile:'read_only',mode,pass,ttlSeconds:mode==='live'?3600:86400}),{ownerVerified:true,settings:{}});
 expect(deps.activate).toHaveBeenCalledWith(db,{ownerId:owner,id:grantId},{},{ownerVerified:true});
});
it('does not forward credentials for another caller, disabled service or narrowed profile/areas',async()=>{
 for(const current of [caller({id:grantId}),caller({mode:'test'}),caller({serverNames:['other-service']}),
  caller({serviceProfiles:{[service.server]:'disabled'}}),caller({serviceAreas:{[service.server]:['workspace']}})]){
  const {db,deps}=setup({current});await expect(connectRtcService(db,{},owner,selection(),deps)).rejects.toThrow();
  expect(deps.discover).not.toHaveBeenCalled();expect(deps.inspect).not.toHaveBeenCalled();expect(deps.grant).not.toHaveBeenCalled();
 }
});
it('refuses changed manifest identity/scope and registered origin conflicts before forwarding the credential',async()=>{
 for(const discovered of [{...service,server:'foreign'},{...service,prefix:'wrong'},
 {...service,modes:['test']},{...service,areas:['workspace']}]){
  const {db,deps}=setup({discovered});await expect(connectRtcService(db,{},owner,selection(),deps)).rejects.toThrow();
  expect(deps.inspect).not.toHaveBeenCalled();expect(deps.grant).not.toHaveBeenCalled();
 }
 const {db,deps}=setup({existing:[{origin:'https://wrong.example.org',prefix:service.prefix,state:'active'}]});
 await expect(connectRtcService(db,{},owner,selection(),deps)).rejects.toThrow();expect(deps.inspect).not.toHaveBeenCalled();
});
it('preserves active and staged grants and refuses failure before activation without implicit renewal',async()=>{
 const old=setup({slots:[{id:grantId}]});await expect(connectRtcService(old.db,{},owner,selection(),old.deps)).rejects.toThrow(/renewal/);
 expect(old.deps.inspect).not.toHaveBeenCalled();expect(old.deps.grant).not.toHaveBeenCalled();
 const bad=setup();bad.deps.inspect.mockRejectedValue(Error('provider refused'));
 await expect(connectRtcService(bad.db,{},owner,selection(),bad.deps)).rejects.toThrow();expect(bad.deps.stage).not.toHaveBeenCalled();
 const failed=setup();failed.deps.activate.mockRejectedValue(Error('staged not activated'));
 await expect(connectRtcService(failed.db,{},owner,selection(),failed.deps)).rejects.toThrow();
 expect(failed.deps.grant).toHaveBeenCalledTimes(1);expect(failed.deps.activate).toHaveBeenCalledTimes(1);
});
it('requires explicit write acknowledgment without silently downgrading or upgrading a provider profile',async()=>{
 const {db,deps}=setup();await expect(connectRtcService(db,{},owner,selection({profile:'full'}),deps)).rejects.toThrow();
 deps.activate.mockResolvedValue({server:service.server,state:'verified_live'});
 await connectRtcService(db,{},owner,selection({profile:'full',writeAck:'I_AUTHORIZE'}),deps);
 expect(deps.inspect.mock.calls[0][0].profile).toBe('full');expect(deps.grant.mock.calls[0][1].profile).toBe('full');
});
it('caller inventory requires independent owner before touching either store',async()=>{
 const db={query:vi.fn()};await expect(availableServiceCallers(db,owner)).rejects.toThrow();expect(db.query).not.toHaveBeenCalled();
});

it('discovery stages public metadata once, reuses matching registration and refuses identity substitution',async()=>{
 const a=setup();await registerDiscoveredService(a.db,owner,service,{ownerVerified:true,stage:a.deps.stage});
 expect(a.deps.stage).toHaveBeenCalledTimes(1);
 const b=setup({existing:[{origin:service.origin,prefix:service.prefix,state:'active'}]});
 await registerDiscoveredService(b.db,owner,service,{ownerVerified:true,stage:b.deps.stage});
 expect(b.deps.stage).not.toHaveBeenCalled();
 const c=setup({existing:[{origin:'https://foreign.example.org',prefix:service.prefix,state:'active'}]});
 await expect(registerDiscoveredService(c.db,owner,service,{ownerVerified:true,stage:c.deps.stage})).rejects.toThrow();
 expect(c.deps.stage).not.toHaveBeenCalled();
});

it('rejects a nonwriting full/everyday caller before public discovery or credential forwarding',async()=>{
 for(const allowWrites of [false,undefined])for(const profile of ['full','everyday']){
  const {db,deps}=setup({current:caller({profile,allowWrites})});
  await expect(connectRtcService(db,{},owner,selection({profile,writeAck:'I_AUTHORIZE'}),deps)).rejects.toThrow();
  expect(deps.discover).not.toHaveBeenCalled();expect(deps.inspect).not.toHaveBeenCalled();expect(deps.grant).not.toHaveBeenCalled();
 }
});
