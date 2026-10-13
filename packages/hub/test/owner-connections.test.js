import {it,expect,vi} from 'vitest';
import {handleOwnerConnections} from '../src/owner-connections.js';
const env={HUB_PUBLIC_ORIGIN:'https://hub.example',HUB_OWNER_ID:'owner-one'};
const id='00000000-0000-4000-8000-000000000001';
function res() {return {code:0,body:'',headers:{},setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.code=n;return this;},send(v){this.body=v;return this;}};}
async function send(method,body,other={}) {
  const r=res();
  const revoke=vi.fn(async()=>true);
  await handleOwnerConnections({method,body,headers:{'content-type':'application/x-www-form-urlencoded'},
    socket:{remoteAddress:'127.0.0.1'}},r,{env,
    withDb:async cb=>cb({}),
    verify:async(db,req,pass)=>({approved:pass==='synthetic-owner-auth'}),
    list:async()=>[{id,client_id:'<script>',profile:'read_only',mode:'test'}],
    revoke,...other});
  return {r,revoke};
}
it('requires owner password before listing and escapes client metadata',async()=>{
  expect((await send('POST','action=list&password=wrong')).r.code).toBe(401);
  const {r}=await send('POST','action=list&password=synthetic-owner-auth');
  expect(r.code).toBe(200);expect(r.body).toContain('&lt;script&gt;');
  expect(r.body).not.toContain('<script>');
  expect(r.headers['Cache-Control']).toBe('no-store');
});
it('revokes the exact family only after independently verified owner login',async()=>{
  expect((await send('POST','action=revoke&password=x&id='+id)).r.code).toBe(401);
  expect((await send('POST','action=revoke&password=synthetic-owner-auth&id=bad')).r.code).toBe(400);
  const {r,revoke}=await send('POST','action=revoke&password=synthetic-owner-auth&id='+id);
  expect(r.code).toBe(200);
  expect(revoke).toHaveBeenCalledWith({}, {ownerId:'owner-one',sessionId:id},{ownerVerified:true});
});
