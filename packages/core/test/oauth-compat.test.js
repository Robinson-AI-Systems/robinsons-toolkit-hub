// Source OAuth protocol behavior with deliberately separate service grant/account policy.
// These are in-memory adapter tests, not SQL lockout or owner UI certification.
import {describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createOAuthProtocolHandlers} from '../src/oauth-protocol.js';
import {createMcpBearerAuthenticator} from '../src/mcp-auth.js';
import {hashToken} from '../src/oauth.js';

const origin='https://compat.example.test', callback='https://agent.example.test/cb';
const verifier='v'.repeat(43),challenge=createHash('sha256').update(verifier).digest('base64url');
const response=()=>({statusCode:200,body:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(c){this.statusCode=c;return this;},
  send(v){this.body=JSON.parse(v);return this;}});
async function post(handler,body){
  const res=response();
  await handler({method:'POST',body,headers:{'content-type':'application/json'}},res);
  return res;
}
function fixture(){
  const clients=new Map(),codes=new Map(),tokens=new Map(),refresh=new Map();
  const db={
    createOAuthClient:vi.fn(async row=>{clients.set(row.clientId,{
      client_id:row.clientId,client_secret_hash:hashToken(row.clientSecret),
      redirect_uris:row.redirectUris
    });}),
    getOAuthClient:vi.fn(async id=>clients.get(id)),
    consumeAuthCode:vi.fn(async code=>{
      const row=codes.get(code);codes.delete(code);return row;
    }),
    createAccessToken:vi.fn(async row=>{
      tokens.set(row.accessToken,row);refresh.set(row.refreshToken,row);
    }),
    rotateRefreshToken:vi.fn(async({refreshToken,clientId,accessToken,newRefreshToken})=>{
      const previous=refresh.get(refreshToken);
      if(!previous||previous.clientId!==clientId)return null;
      refresh.delete(refreshToken);tokens.delete(previous.accessToken);
      const next={...previous,accessToken,refreshToken:newRefreshToken};
      refresh.set(newRefreshToken,next);tokens.set(accessToken,next);return next;
    })
  };
  const buildAccessRow=vi.fn(({accessToken,refreshToken,clientId,grant})=>{
    if(grant.mode!=='test'||!['read_only','full'].includes(grant.profile)||
      typeof grant.account!=='string'||!grant.account)return null;
    return {accessToken,refreshToken,clientId,account:grant.account,
      mode:grant.mode,profile:grant.profile,listing:grant.listing,
      resultScope:grant.resultScope};
  });
  const h=createOAuthProtocolHandlers({db,env:{PUBLIC_BASE_URL:origin},buildAccessRow});
  const auth=createMcpBearerAuthenticator({
    env:{PUBLIC_BASE_URL:origin},
    getAccessToken:async token=>tokens.get(token),
    projectConnection:row=>row.mode==='test'&&
      ['read_only','full'].includes(row.profile)&&row.account&&row.resultScope?
      {account:row.account,mode:row.mode,profile:row.profile,
        listing:row.listing,resultScope:row.resultScope}:null
  });
  const register=async()=>{
    const res=await post(h.register,{redirect_uris:[callback]});
    expect(res.statusCode).toBe(201);return res.body;
  };
  const grant=(client,overrides={})=>{
    const code='code-'+(codes.size+1)+'-'+Math.random().toString(36).slice(2);
    codes.set(code,{client_id:client.client_id,redirect_uri:callback,
      code_challenge:challenge,code_challenge_method:'S256',
      account:'acct_fixture',mode:'test',profile:'full',listing:'compact',
      resultScope:'scope-1',...overrides});
    return code;
  };
  const credentials=client=>({client_id:client.client_id,client_secret:client.client_secret,
    resource:origin+'/api/mcp'});
  const exchange=(client,code,extra={})=>post(h.token,{...credentials(client),
    grant_type:'authorization_code',code,code_verifier:verifier,
    redirect_uri:callback,...extra});
  const identify=async token=>{
    const res=response();
    const claims=await auth({headers:{authorization:'Bearer '+token}},res);
    return {claims,res};
  };
  return {h,db,clients,codes,tokens,refresh,buildAccessRow,register,grant,credentials,exchange,identify};
}
describe('adapted OAuth source compatibility and issued-token identity',()=>{
  it('preserves owner-selected account, mode, profile, listing and scope through refresh',async()=>{
    const f=fixture(),client=await f.register();
    const issued=await f.exchange(client,f.grant(client));
    expect(issued.statusCode).toBe(200);
    expect(issued.body.token_type).toBe('Bearer');
    expect(issued.body.expires_in).toBe(3600);
    const original=(await f.identify(issued.body.access_token)).claims;
    expect(original).toEqual({account:'acct_fixture',mode:'test',profile:'full',
      listing:'compact',resultScope:'scope-1'});
    expect(JSON.stringify(original)).not.toContain(issued.body.access_token);
    const next=await post(f.h.token,{...f.credentials(client),grant_type:'refresh_token',
      refresh_token:issued.body.refresh_token});
    expect(next.statusCode).toBe(200);
    expect((await f.identify(issued.body.access_token)).claims).toBeNull();
    expect((await f.identify(next.body.access_token)).claims).toEqual(original);
    const replay=await post(f.h.token,{...f.credentials(client),grant_type:'refresh_token',
      refresh_token:issued.body.refresh_token});
    expect(replay.statusCode).toBe(400);
    expect(replay.body.error).toBe('invalid_grant');
  });
  it('refuses live, invalid profile and absent account at service claim boundary',async()=>{
    const f=fixture(),client=await f.register();
    for(const claims of [{mode:'live'},{profile:'operator'},{account:''}]){
      const res=await f.exchange(client,f.grant(client,claims));
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('invalid_grant');
    }
    expect(f.db.createAccessToken).not.toHaveBeenCalled();
  });
  it('rejects mapper attempts to change issued tokens or authenticated client identity',async()=>{
    const f=fixture(),client=await f.register();
    for(const changed of [{accessToken:'different'}, {refreshToken:'different'},
      {clientId:'another-client'}]){
      f.buildAccessRow.mockImplementationOnce(({accessToken,refreshToken,clientId,grant})=>({
        accessToken,refreshToken,clientId,account:grant.account,...changed
      }));
      const res=await f.exchange(client,f.grant(client));
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('invalid_grant');
    }
    expect(f.db.createAccessToken).not.toHaveBeenCalled();
  });
  it('does not report refresh success for mismatched or missing durable rotation evidence',async()=>{
    const f=fixture(),client=await f.register();
    const issued=await f.exchange(client,f.grant(client));
    for(const mismatch of [true,{accessToken:'wrong',refreshToken:'wrong',
      clientId:client.client_id},{accessToken:'wrong',refreshToken:'wrong',
      clientId:'other'}]){
      f.db.rotateRefreshToken.mockResolvedValueOnce(mismatch);
      const res=await post(f.h.token,{...f.credentials(client),grant_type:'refresh_token',
        refresh_token:issued.body.refresh_token});
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('invalid_grant');
    }
  });
  it('refuses cross-client refresh, wrong resource and wrong PKCE before successful access',async()=>{
    const f=fixture(),a=await f.register(),b=await f.register();
    const code=f.grant(a);
    expect((await f.exchange(a,code,{resource:'https://attacker.example.test/api/mcp'}))
      .body.error).toBe('invalid_target');
    expect(f.codes.has(code)).toBe(true);
    expect((await f.exchange(a,code,{code_verifier:'bad'})).body.error).toBe('invalid_grant');
    const issued=await f.exchange(a,f.grant(a));
    const wrong=await post(f.h.token,{...f.credentials(b),grant_type:'refresh_token',
      refresh_token:issued.body.refresh_token});
    expect(wrong.statusCode).toBe(400);
    expect(f.refresh.size).toBe(1);
  });
  it('fails closed on durable token write failure and never returns an unpersisted pass',async()=>{
    const f=fixture(),client=await f.register();
    f.db.createAccessToken.mockRejectedValueOnce(new Error('isolated storage outage'));
    await expect(f.exchange(client,f.grant(client))).rejects.toThrow(/storage outage/);
    expect(f.tokens.size).toBe(0);
  });
  it('rejects missing SQL adapter methods and insecure route overrides on initialization',()=>{
    const f=fixture();
    const valid={...f.db};
    delete valid.consumeAuthCode;
    expect(()=>createOAuthProtocolHandlers({db:valid,env:{PUBLIC_BASE_URL:origin},
      buildAccessRow:()=>({})})).toThrow(/Durable OAuth/);
    expect(()=>createOAuthProtocolHandlers({db:f.db,env:{PUBLIC_BASE_URL:origin},
      paths:{mcp:'https://elsewhere',authorize:'/oauth/authorize',token:'/oauth/token',
        register:'/oauth/register'},buildAccessRow:()=>({})})).toThrow(/local OAuth route/);
  });
});
