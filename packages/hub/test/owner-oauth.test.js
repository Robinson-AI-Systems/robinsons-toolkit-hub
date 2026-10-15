import {it,expect,vi} from 'vitest';
import {handleOwnerOAuth} from '../src/owner-oauth.js';

const env={HUB_PUBLIC_ORIGIN:'https://hub.example',HUB_OWNER_ID:'owner-a',
  HUB_TOKEN_PEPPER:'test-only-nonproduction-long-secret-pepper'};
const id='00000000-0000-4000-8000-000000000001';
function response() {
  return {headers:{},statusCode:0,html:'',
    setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.statusCode=n;return this;},
    send(v){this.html=v;return this;}};
}
async function send(method,body,changes={}) {
  const res=response();
  const verify=vi.fn(async(db,req,password)=>({
    approved:password==='synthetic-owner-passphrase',retryAfter:0
  }));
  await handleOwnerOAuth({method,body,headers:{
    'content-type':'application/x-www-form-urlencoded'
  },socket:{remoteAddress:'127.0.0.1'}},res,{
    withDb:async fn=>fn({}),verify,
    list:vi.fn(async()=>[]),revoke:vi.fn(async()=>true),env,...changes
  });
  return {res,verify};
}
it('keeps owner actions password-gated and no-store',async()=>{
 const {res}=await send('GET');
 expect(res.statusCode).toBe(200);
 expect(res.headers['Cache-Control']).toBe('no-store');
 expect(res.headers['Content-Security-Policy']).toContain("default-src 'none'");
 expect(res.html).toContain('Revoke entire connection family');
 expect(res.html).not.toContain('token_value');
 const list=vi.fn(async()=>[]);
 expect((await send('POST','action=list&password=wrong',{list})).res.statusCode).toBe(401);
 expect(list).not.toHaveBeenCalled();
 expect((await send('POST','action=list&password=synthetic-owner-passphrase',{list})).res.statusCode)
  .toBe(200);
 expect(list).toHaveBeenCalledWith({},'owner-a',{ownerVerified:true});
});
it('lists redacted and escaped owner family metadata only',async()=>{
 const list=vi.fn(async()=>[{id,clientId:'<script>',mode:'test',
   profile:'read_only',serverNames:['stripe','<img>'],areas:['gateway'],
   refreshExpiresAt:'tomorrow'}]);
 const {res}=await send('POST','action=list&password=synthetic-owner-passphrase',{list});
 expect(res.statusCode).toBe(200);
 expect(res.html).toContain('&lt;script&gt;');
 expect(res.html).toContain('&lt;img&gt;');
 expect(res.html).not.toContain('<script>');
 expect(res.html).not.toContain('access_token');
 expect(res.html).not.toContain('refresh_token');
});
it('revokes only after verified owner and canonical session ID',async()=>{
 const revoke=vi.fn(async()=>true);
 expect((await send('POST','action=revoke&password=wrong&id='+id,{revoke})).res.statusCode)
  .toBe(401);
 expect((await send('POST','action=revoke&password=synthetic-owner-passphrase&id=bad',
  {revoke})).res.statusCode).toBe(400);
 expect(revoke).not.toHaveBeenCalled();
 const {res}=await send('POST','action=revoke&password=synthetic-owner-passphrase&id='+id,
  {revoke});
 expect(res.statusCode).toBe(200);
 expect(revoke).toHaveBeenCalledWith({},{ownerId:'owner-a',sessionId:id},
  {ownerVerified:true});
 expect((await send('POST','action=revoke&password=synthetic-owner-passphrase&id='+id,
  {revoke:async()=>false})).res.statusCode).toBe(404);
});
it('rejects duplicate fields, method, missing origin, unsupported type and lockout',async()=>{
 expect((await send('POST','action=list&action=revoke&password=x')).res.statusCode)
  .toBe(400);
 expect((await send('DELETE')).res.statusCode).toBe(405);
 expect((await send('GET',null,{env:{...env,HUB_PUBLIC_ORIGIN:'http://hub.example'}}))
  .res.statusCode).toBe(503);
 const lock=await send('POST','action=list&password=wrong',{
  verify:vi.fn(async()=>({approved:false,retryAfter:24}))});
 expect(lock.res.statusCode).toBe(429);
 expect(lock.res.headers['Retry-After']).toBe('24');
});

it('owner can only one-way narrow an exact OAuth family after password verification',async()=>{
 const narrow=vi.fn(async()=>({updated:true,serverNames:['stripe']}));
 const valid='action=narrow&password=synthetic-owner-passphrase&id='+id+'&servers=stripe';
 expect((await send('POST',valid.replace('synthetic-owner-passphrase','wrong'),
   {narrow})).res.statusCode).toBe(401);
 for(const body of [
   valid.replace(id,'invalid'),
   valid.replace('&servers=stripe',''),
   valid.replace('servers=stripe','servers=Stripe'),
   valid.replace('servers=stripe','servers=stripe%2Cstripe')
 ])expect((await send('POST',body,{narrow})).res.statusCode).toBe(400);
 expect(narrow).not.toHaveBeenCalled();
 const ok=(await send('POST',valid,{narrow})).res;
 expect(ok.statusCode).toBe(200);
 expect(narrow).toHaveBeenCalledWith({},{ownerId:'owner-a',
  sessionId:id,serverNames:['stripe']},{ownerVerified:true});
 expect((await send('POST',valid,{narrow:async()=>({updated:false})}))
  .res.statusCode).toBe(404);
 const {res}=await send('GET');
 expect(res.html).toContain('Permanently narrow this family');
});

it('OAuth family profile ceilings are owner verified and show sanitized history',async()=>{
 const narrowProfile=vi.fn(async()=>({updated:true,profile:'disabled'}));
 const params='action=narrow_profile&password=synthetic-owner-passphrase&id='+id+
  '&server=workspace&profile=disabled';
 expect((await send('POST',params.replace('synthetic-owner-passphrase','wrong'),
  {narrowProfile})).res.statusCode).toBe(401);
 for(const invalid of [params.replace('profile=disabled','profile=full'),
  params.replace('server=workspace','server=..'),params.replace(id,'bad')])
  expect((await send('POST',invalid,{narrowProfile})).res.statusCode).toBe(400);
 expect((await send('POST',params,{narrowProfile})).res.statusCode).toBe(200);
 expect(narrowProfile).toHaveBeenCalledWith({},{
  ownerId:'owner-a',id,serverName:'workspace',profile:'disabled'
 },{ownerVerified:true});
 const profileAudit=vi.fn(async()=>[{
  at:'today',kind:'oauth',callerId:id,server:'<img>',
  profile:'disabled',purgedHandles:1
 }]);
 const {res}=await send('POST',
  'action=profile_audit&password=synthetic-owner-passphrase',{profileAudit});
 expect(res.statusCode).toBe(200);
 expect(res.html).not.toContain('<img>');
 expect(profileAudit).toHaveBeenCalledWith({},'owner-a',{ownerVerified:true});
});
