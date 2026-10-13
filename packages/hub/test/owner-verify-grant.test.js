import {it,expect,vi} from 'vitest';
import {handleVerifyGrant} from '../src/owner-verify-grant.js';
const id='00000000-0000-4000-8000-000000000001';
const env={HUB_PUBLIC_ORIGIN:'https://hub.example',HUB_OWNER_ID:'owner-a'};
function res(){return {code:0,text:'',headers:{},setHeader(k,v){this.headers[k]=v;return this;},
 status(c){this.code=c;return this;},send(t){this.text=t;return this;}};}
async function call(body,more={},method='POST') {
 const r=res(),activate=vi.fn(async()=>({server:'<stripe>'}));
 await handleVerifyGrant({method,body,headers:{
  'content-type':'application/x-www-form-urlencoded'},socket:{remoteAddress:'127.0.0.1'}},
  r,{env,withDb:async cb=>cb({},{}),
  verify:async(_db,_req,password)=>({approved:password==='synthetic-owner-auth'}),
  activate,...more});
 return {r,activate};
}
it('verifies owner before any activation and escapes server result',async()=>{
 const denied=await call('id='+id+'&password=wrong');
 expect(denied.r.code).toBe(401);
 expect(denied.activate).not.toHaveBeenCalled();
 const good=await call('id='+id+'&password=synthetic-owner-auth');
 expect(good.r.code).toBe(200);
 expect(good.r.text).toContain('&lt;stripe&gt;');
 expect(good.activate).toHaveBeenCalledWith({},{ownerId:'owner-a',id},
   {},{ownerVerified:true});
 expect(good.r.headers['Cache-Control']).toBe('no-store');
});
it('rejects invalid, duplicate and unauthenticated input without activation',async()=>{
 expect((await call('id=bad&password=x')).r.code).toBe(400);
 expect((await call('id='+id+'&id='+id+'&password=x')).r.code).toBe(400);
 expect((await call(null,{},'DELETE')).r.code).toBe(405);
 expect((await call(null,{},'GET')).r.code).toBe(200);
 const locked=await call('id='+id+'&password=x',{verify:async()=>({
  approved:false,retryAfter:45})});
 expect(locked.r.code).toBe(429);
 expect(locked.r.headers['Retry-After']).toBe('45');
 const failed=await call('id='+id+'&password=synthetic-owner-auth',{
  activate:async()=>{throw new Error('should not leak provider failure');}});
 expect(failed.r.code).toBe(503);
 expect(failed.r.text).not.toContain('provider failure');
});
