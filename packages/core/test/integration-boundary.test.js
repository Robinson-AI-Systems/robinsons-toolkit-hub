// End-to-end private-core composition without an SDK, provider, server repository or live secret.
// The service fixture owns accounts, SQL-equivalent policy hooks and money approval.
import {describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createOAuthProtocolHandlers} from '../src/oauth-protocol.js';
import {createMcpBearerAuthenticator} from '../src/mcp-auth.js';
import {createGuardedMcpDispatcher} from '../src/mcp-dispatch.js';
import {defineWrite} from '../src/write.js';
import {hashToken} from '../src/oauth.js';

const origin='https://fixture.example.test';
const callback='https://agent.example.test/callback';
const verifier='v'.repeat(43);
const challenge=createHash('sha256').update(verifier).digest('base64url');
const parse=reply=>JSON.parse(reply.content[0].text);
const response=()=>({
  statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},
  send(v){this.body=JSON.parse(v);return this;}
});
const request=(body,method='POST')=>({method,headers:{'content-type':'application/json'},body});
async function post(handler,body) {
  const res=response();
  await handler(request(body),res);
  return res;
}
function setup() {
  const clients=new Map(),codes=new Map(),access=new Map(),refresh=new Map();
  const effects=[],audits=[],stored=[];
  let ownerApproval=false;
  const db={
    createOAuthClient:async({clientId,clientSecret,redirectUris})=>{
      clients.set(clientId,{client_id:clientId,client_secret_hash:hashToken(clientSecret),
        redirect_uris:redirectUris});
    },
    getOAuthClient:async id=>clients.get(id),
    consumeAuthCode:async code=>{const row=codes.get(code);codes.delete(code);return row;},
    createAccessToken:async row=>{access.set(row.accessToken,row);refresh.set(row.refreshToken,row);},
    rotateRefreshToken:async({refreshToken,clientId,accessToken,newRefreshToken})=>{
      const row=refresh.get(refreshToken);
      if(!row||row.clientId!==clientId)return null;
      refresh.delete(refreshToken);access.delete(row.accessToken);
      const next={...row,accessToken,refreshToken:newRefreshToken};
      access.set(accessToken,next);refresh.set(newRefreshToken,next);
      return next;
    },
    recordChange:async row=>{audits.push(row);return audits.length;},
    putScopedResult:async row=>{stored.push(row);}
  };
  const protocol=createOAuthProtocolHandlers({db,env:{PUBLIC_BASE_URL:origin},
    buildAccessRow:({accessToken,refreshToken,clientId,grant})=>({
      accessToken,refreshToken,clientId,tenant:grant.tenant,profile:grant.profile,
      mode:grant.mode,listing:grant.listing
    })});
  const authenticate=createMcpBearerAuthenticator({
    env:{PUBLIC_BASE_URL:origin},
    getAccessToken:async token=>access.get(token),
    projectConnection:async row=>row.mode==='test'&&row.tenant?{
      tenant:row.tenant,profile:row.profile,mode:row.mode,listing:row.listing,
      resultScope:row.tenant
    }:null
  });
  const read=vi.fn(async()=>({data:[{name:'ok'}]}));
  const write=defineWrite({
    name:'fixture_money_out',accountOf:conn=>conn.tenant,idempotencyPrefix:'fixture_',
    read:async()=>({balance:100}),summarize:async()=> 'Test debit',
    prepare:async()=>({previewLine:'Debit 5 test cents',amountCents:5,
      currency:'usd',direction:'out'}),
    beforeApply:async()=>({accepted:ownerApproval,reason:'Separate owner approval required'}),
    apply:async()=>{effects.push('debit');},
    readAfter:async()=>({balance:95}),
    verify:async(before,after)=>after.balance===before.balance-5,
    idempotency:()=> 'fixture_request_1'
  });
  const registry={tools:[{name:'fixture_read',writes:false},{...write.tool}],
    handlers:{fixture_read:read,fixture_money_out:write.handler}};
  const dispatcher=createGuardedMcpDispatcher({
    registry,authorizeTool:async(tool,conn)=>tool.writes!==true?
      ['read_only','full'].includes(conn.profile):conn.profile==='full',
    shapeResult:async value=>value?.content?value:{
      content:[{type:'text',text:JSON.stringify(value)}]},
    readDetail:value=>value,
    splitResult:value=>({totalBytes:Buffer.byteLength(JSON.stringify(value)),value}),
    resultPage:()=>({offset:0,nextOffset:null}),
    formatError:()=>null
  });
  async function issue(profile='read_only',tenant='tenant-a') {
    const created=await post(protocol.register,{redirect_uris:[callback]});
    expect(created.statusCode).toBe(201);
    const client=created.body;
    const code='authcode-'+codes.size+'-'+profile;
    codes.set(code,{client_id:client.client_id,redirect_uri:callback,
      code_challenge:challenge,code_challenge_method:'S256',
      profile,tenant,mode:'test',listing:'compact'});
    const credentials={client_id:client.client_id,client_secret:client.client_secret,
      resource:origin+'/api/mcp'};
    const issued=await post(protocol.token,{...credentials,grant_type:'authorization_code',
      code,code_verifier:verifier,redirect_uri:callback});
    expect(issued.statusCode).toBe(200);
    return {client,credentials,issued:issued.body};
  }
  async function identity(token) {
    const res=response();
    const conn=await authenticate({headers:{authorization:'Bearer '+token}},res);
    return {conn,res};
  }
  async function call(token,name,args={}) {
    const {conn,res}=await identity(token);
    if (!conn) return {res,reply:null};
    return {res,reply:await dispatcher.dispatch({name,args,connection:conn,
      db,services:{}})};
  }
  return {db,protocol,authenticate,dispatcher,issue,identity,call,read,effects,audits,
    stored,access,refresh,setApproval:value=>{ownerApproval=value;}};
}

describe('private core integration across service-owned boundaries',()=>{
  it('issues a scoped OAuth pass, authenticates it, and runs only authorized reads',async()=>{
    const f=setup(),{issued}=await f.issue();
    const {conn,res}=await f.identity(issued.access_token);
    expect(res.body).toBeNull();
    expect(conn).toEqual({tenant:'tenant-a',profile:'read_only',mode:'test',
      listing:'compact',resultScope:'tenant-a'});
    expect(JSON.stringify(conn)).not.toContain(issued.access_token);
    expect(parse((await f.call(issued.access_token,'fixture_read')).reply)).toEqual({
      data:[{name:'ok'}]});
    const denied=await f.call(issued.access_token,'fixture_money_out',{confirm:true});
    expect(denied.reply.isError).toBe(true);
    expect(f.effects).toEqual([]);
    expect(f.audits).toEqual([]);
    expect(f.read).toHaveBeenCalledTimes(1);
  });
  it('rotates refresh credentials without losing the tenant/profile or reviving the old pass',async()=>{
    const f=setup(),{issued,credentials}=await f.issue('full','tenant-b');
    const rotated=await post(f.protocol.token,{...credentials,
      grant_type:'refresh_token',refresh_token:issued.refresh_token});
    expect(rotated.statusCode).toBe(200);
    expect((await f.identity(issued.access_token)).conn).toBeNull();
    expect((await f.identity(issued.refresh_token)).conn).toBeNull();
    expect((await f.identity(rotated.body.access_token)).conn).toMatchObject({
      tenant:'tenant-b',profile:'full',listing:'compact',mode:'test'});
    const replay=await post(f.protocol.token,{...credentials,grant_type:'refresh_token',
      refresh_token:issued.refresh_token});
    expect(replay.statusCode).toBe(400);
    expect(replay.body.error).toBe('invalid_grant');
    expect(f.effects).toHaveLength(0);
  });
  it('rejects revoked auth before dispatch and leaves handler and audit unchanged',async()=>{
    const f=setup(),{issued}=await f.issue();
    f.access.delete(issued.access_token);
    const denied=await f.call(issued.access_token,'fixture_read');
    expect(denied.reply).toBeNull();
    expect(denied.res.statusCode).toBe(401);
    expect(denied.res.body.error).toBe('invalid_token');
    expect(f.read).not.toHaveBeenCalled();
    expect(f.audits).toHaveLength(0);
  });
  it('requires independent owner approval even with full profile and confirm true',async()=>{
    const f=setup(),{issued}=await f.issue('full');
    const denied=await f.call(issued.access_token,'fixture_money_out',{confirm:true});
    expect(parse(denied.reply)).toMatchObject({done:false,
      error:'Separate owner approval required'});
    expect(f.effects).toHaveLength(0);
    expect(f.audits).toHaveLength(0);
    f.setApproval(true);
    const done=await f.call(issued.access_token,'fixture_money_out',{confirm:true});
    expect(parse(done.reply)).toMatchObject({done:true,confirmed:true});
    expect(f.effects).toEqual(['debit']);
    expect(f.audits).toHaveLength(2);
    expect(f.audits[0]).toMatchObject({account:'tenant-a',dryRun:true});
    expect(f.audits[1]).toMatchObject({account:'tenant-a',dryRun:false,
      amountCents:5,direction:'out'});
  });
  it('uses authenticated scope for oversized results and denies missing durable storage',async()=>{
    const f=setup(),{issued}=await f.issue();
    f.read.mockResolvedValue({data:[{value:'x'.repeat(12000)}]});
    const result=await f.call(issued.access_token,'fixture_read');
    const summary=parse(result.reply);
    expect(summary.handle).toMatch(/^res_[A-Za-z0-9_-]{24}$/);
    expect(f.stored).toHaveLength(1);
    expect(f.stored[0].connection).toBe('tenant-a');
    expect(f.stored[0].body.value.data[0].value).toHaveLength(12000);
    const {conn}=await f.identity(issued.access_token);
    const failed=await f.dispatcher.dispatch({name:'fixture_read',args:{},connection:conn,
      db:{},services:{}});
    expect(failed.isError).toBe(true);
    expect(JSON.stringify(failed)).not.toContain('x'.repeat(200));
  });
});
