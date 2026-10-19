import {it,expect,vi} from 'vitest';
import {handleOwnerConnectMcp,handleOwnerMcpCallback}
 from '../src/owner-connect-mcp.js';
const env={HUB_PUBLIC_ORIGIN:'https://hub.example.org',HUB_OWNER_ID:'test_owner'};
const nonce='A'.repeat(43),state='B'.repeat(43);
const origin='https://provider.example.org';
const metadata={origin,name:'independent-mcp',prefix:'independent',
 areas:['mail','files'],profiles:['read_only','everyday','full'],
 modes:['test','live'],counts:{tools:12,writes:3,money:0}};
const response=()=>({code:0,body:null,headers:{},
 setHeader(k,v){this.headers[k]=v;return this;},
 status(c){this.code=c;return this;},send(v){this.body=v;return this;},
 end(){return this;}});
function fixtures(){
 return {env,withDb:cb=>cb({},{}),
  verify:vi.fn(async(_db,_req,pwd)=>({approved:pwd==='good-passphrase'})),
  discover:vi.fn(async()=>metadata),
  begin:vi.fn(async()=>({authorizeUrl:'https://provider.example.org/api/oauth/authorize',
   browserNonce:nonce})),
  finish:vi.fn(async()=>({server:'independent-mcp',state:'connected',
   tools:10,refreshAvailable:true})),
  list:vi.fn(async()=>[]),tools:vi.fn(async()=>({server:'independent-mcp',
    mode:'live',profile:'read_only',tools:[],incomplete:false})),
  disconnect:vi.fn(async()=>true)};
}
async function invoke(method,body,opts={}){
 const res=response(),deps={...fixtures(),...(opts.deps??{})};
 await handleOwnerConnectMcp({method,body,headers:{
  'content-type':opts.contentType??'application/x-www-form-urlencoded',origin:env.HUB_PUBLIC_ORIGIN},
  socket:{remoteAddress:'127.0.0.1'}},res,deps);
 return {res,deps};
}
it('displays discover-first form with no manual TEST pass or tenant secrets',async()=>{
 const {res}=await invoke('GET',{});
 expect(res.code).toBe(200);
 expect(res.body).toContain('Discover service and OAuth support');
 expect(res.body).toContain('Hub initiates discovery');
 expect(res.body).not.toContain('service_pass');
 expect(res.headers['Content-Security-Policy']).toContain("default-src 'none'");
});
it('checks owner password BEFORE calling remote issuer or creating a connection',async()=>{
 const body={action:'inspect',origin,password:'nope'};
 const denied=await invoke('POST',body);
 expect(denied.res.code).toBe(401);
 expect(denied.deps.discover).not.toHaveBeenCalled();
 const allowed=await invoke('POST',{...body,password:'good-passphrase'});
 expect(allowed.res.code).toBe(200);
 expect(allowed.res.body).toContain('independent-mcp');
 expect(allowed.res.body).toContain('mail');
 expect(allowed.res.body).not.toContain('Bearer');
 expect(allowed.deps.discover).toHaveBeenCalledWith(origin);
});
it('starts live scoped consent only with explicit risk acknowledgment',async()=>{
 const body={action:'start',origin,password:'good-passphrase',
  mode:'live',profile:'read_only',areas:'mail, files',scopes:'mail.read'};
 expect((await invoke('POST',body)).res.code).toBe(400);
 const {res,deps}=await invoke('POST',{...body,risk_ack:'I_AUTHORIZE'});
 expect(res.code).toBe(303);
 expect(res.headers.Location).toBe('https://provider.example.org/api/oauth/authorize');
 expect(res.headers['Set-Cookie']).toContain('HttpOnly; Secure; SameSite=Lax');
 expect(res.headers['Set-Cookie']).toContain(nonce);
 expect(deps.begin).toHaveBeenCalledWith({}, {},{
  ownerId:'test_owner',origin,hubOrigin:env.HUB_PUBLIC_ORIGIN,
  family:null,mode:'live',profile:'read_only',areas:['mail','files'],
  scopes:'mail.read',ack:true});
 expect(JSON.stringify(res)).not.toContain('good-passphrase');
});
it('rejects duplicate areas, malformed operations and unsafe requests',async()=>{
 const base={action:'start',origin,password:'good-passphrase',
  mode:'test',profile:'read_only',areas:'mail,mail',scopes:''};
 for(const bad of [base,{...base,areas:'files,bad-area'},
  {...base,areas:'mail',mode:'danger'}, {...base,areas:'mail',
   profile:'full'}, {...base,areas:'mail',risk_ack:'I_AUTHORIZE'}]){
  const {res,deps}=await invoke('POST',bad);
  expect(res.code).toBe(400);
  expect(deps.begin).not.toHaveBeenCalled();
 }
 const withUnexpected=await invoke('PATCH',{});
 expect(withUnexpected.res.code).toBe(405);
 expect((await invoke('POST',{...base,areas:'mail'},{
  contentType:'application/json'})).res.code).toBe(415);
});
it('callback demands browser-bound one-time state, never owner password or static pass',async()=>{
 const deps=fixtures(),res=response();
 const query={code:'synthetic-authorization-code',state};
 await handleOwnerMcpCallback({method:'GET',query,headers:{
  cookie:'other=x; hub_mcp_consent='+nonce}},res,deps);
 expect(res.code).toBe(200);
 expect(res.body).toContain('Connected independent-mcp');
 expect(res.body).not.toContain('synthetic-authorization-code');
 expect(res.headers['Set-Cookie']).toContain('Max-Age=0');
 expect(deps.finish).toHaveBeenCalledWith({}, {},{
  ownerId:'test_owner',hubOrigin:env.HUB_PUBLIC_ORIGIN,
  state,browser:nonce,code:'synthetic-authorization-code',issuer:null});
 const noCookie=response();
 await handleOwnerMcpCallback({method:'GET',query,headers:{}},noCookie,deps);
 expect(noCookie.code).toBe(400);
 const injected=response();
 await handleOwnerMcpCallback({method:'GET',query:{...query,redirect_uri:'https://evil.example'},
  headers:{cookie:'hub_mcp_consent='+nonce}},injected,deps);
 expect(injected.code).toBe(400);
});
it('does not leak provider error, or revoke connection without exact owner confirmation',async()=>{
 const fail=await invoke('POST',{action:'inspect',origin,password:'good-passphrase'},
  {deps:{discover:async()=>{throw Error('sensitive private account')}}});
 expect(fail.res.code).toBe(503);
 expect(fail.res.body).not.toContain('sensitive private');
 const bad=await invoke('POST',{action:'disconnect',id:'00000000-0000-4000-8000-000000000001',
  password:'good-passphrase',confirm:'YES'});
 expect(bad.res.code).toBe(400);
 expect(bad.deps.disconnect).not.toHaveBeenCalled();
});
