import {it,expect,vi} from 'vitest';
import {handleOwnerPasses} from '../src/owner-passes.js';
import {handleOwnerGrants} from '../src/owner-grants.js';
const env={HUB_PUBLIC_ORIGIN:'https://hub.example',HUB_OWNER_ID:'owner-a'};
const id='00000000-0000-4000-8000-000000000001';
const upstream='rtc_pass_'+'a'.repeat(43);
const res=()=>({code:0,html:'',headers:{},
 setHeader(k,v){this.headers[k]=v;return this;},
 status(n){this.code=n;return this;},send(value){this.html=value;return this;}});
async function submit(handler,fields,overrides={}){
 const output=res();
 await handler({method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams(fields).toString(),socket:{remoteAddress:'127.0.0.1'}},output,{
  env,withDb:async fn=>fn({}, {pepper:'synthetic-only-test-pepper'}),
  verify:vi.fn(async(db,req,password)=>({approved:password==='verified-owner'})),...overrides
 });
 return output;
}
it('read-only remains default, explicit user authorization selects full LIVE writes',async()=>{
 const issue=vi.fn(async()=>({id,pass:'one-time-secret'}));
 const base={action:'issue',password:'verified-owner',servers:'neon-mcp'};
 const defaultResult=await submit(handleOwnerPasses,base,{issue});
 expect(defaultResult.code).toBe(201);
 expect(issue.mock.calls[0][1]).toMatchObject({profile:'read_only',mode:'test',allowWrites:false});
 const write={...base,delegation_profile:'full',delegation_mode:'live',
  delegation_writes:'authorize',write_ack:'I_AUTHORIZE'};
 const enabled=await submit(handleOwnerPasses,write,{issue});
 expect(enabled.code).toBe(201);
 expect(issue.mock.calls[1][1]).toMatchObject({
  profile:'full',mode:'live',allowWrites:true,serverNames:['neon-mcp']});
 for(const invalid of [
  {...write,write_ack:''},{...write,delegation_profile:'read_only'},
  {...write,delegation_writes:'disabled'},{...write,delegation_mode:'unknown'}
 ])expect((await submit(handleOwnerPasses,invalid,{issue})).code).toBe(400);
 expect(issue).toHaveBeenCalledTimes(2);
 expect((await submit(handleOwnerPasses,{...write,password:'wrong'},{issue})).code).toBe(401);
 expect(issue).toHaveBeenCalledTimes(2);
});
it('owner service grant staging requires explicit risk ack and issuer credential',async()=>{
 const stage=vi.fn(async()=>({id}));
 const base={action:'stage',password:'verified-owner',server:'neon-mcp',
  kind:'pass',caller:id,areas:'projects',service_pass:upstream};
 const readonly=await submit(handleOwnerGrants,base,{stage});
 expect(readonly.code).toBe(201);
 expect(stage.mock.calls[0][1]).toMatchObject({
  serverName:'neon-mcp',callerId:id,areas:['projects']});
 expect(stage.mock.calls[0][1]).not.toHaveProperty('profile');
 expect(stage.mock.calls[0][1]).not.toHaveProperty('mode');
 const writable={...base,grant_profile:'full',grant_mode:'live',
  grant_risk_ack:'I_AUTHORIZE'};
 expect((await submit(handleOwnerGrants,writable,{stage})).code).toBe(201);
 expect(stage.mock.calls[1][1]).toMatchObject({profile:'full',mode:'live'});
 for(const wrong of [
  {...writable,grant_risk_ack:''}, {...writable,grant_profile:'unknown'},
  {...writable,grant_mode:'not_live'}, {...base,grant_mode:'live'},
  {...base,grant_profile:'full',grant_risk_ack:''}
 ])expect((await submit(handleOwnerGrants,wrong,{stage})).code).toBe(400);
 expect(stage).toHaveBeenCalledTimes(2);
 expect((await submit(handleOwnerGrants,{...writable,password:'wrong'},{stage})).code)
  .toBe(401);
});
