import {describe,expect,it,vi} from 'vitest';
import {createMcpBearerAuthenticator} from '../src/mcp-auth.js';
const token='A'.repeat(40),origin='https://guarded.example.test';
const req={headers:{authorization:'Bearer '+token}};
function res(){
  return {statusCode:200,headers:{},body:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(c){this.statusCode=c;return this;},
    send(v){this.body=JSON.parse(v);return this;}};
}
function fixture(claims){
  const getAccessToken=vi.fn(async()=>({id:'fixture-account',access_secret:'never-return'}));
  const projectConnection=vi.fn(async()=>claims);
  return {authenticate:createMcpBearerAuthenticator({getAccessToken,projectConnection,
    env:{PUBLIC_BASE_URL:origin}}),getAccessToken,projectConnection};
}
describe('service projection isolation before MCP dispatch',()=>{
  it('keeps ordinary source-compatible flat claims unchanged',async()=>{
    const expected={clientId:'client',stripeAccount:'acct_fixture',mode:'test',
      profile:'read_only',listing:'compact',resultScope:'scope'};
    const f=fixture(expected),answer=res();
    const claims=await f.authenticate(req,answer);
    expect(claims).toEqual(expected);
    expect(Object.isFrozen(claims)).toBe(true);
    expect(claims).not.toBe(expected);
    expect(answer.statusCode).toBe(200);
    expect(JSON.stringify(claims)).not.toContain('never-return');
  });
  it('copies nested service claims to immutable, detached data with no token leak',async()=>{
    const original={tenant:'fixture',permissions:{areas:['read','describe'],limited:true}};
    const f=fixture(original),claims=await f.authenticate(req,res());
    expect(claims).toEqual(original);
    expect(Object.isFrozen(claims)).toBe(true);
    expect(Object.isFrozen(claims.permissions)).toBe(true);
    expect(Object.isFrozen(claims.permissions.areas)).toBe(true);
    original.permissions.areas.push('write');
    expect(claims.permissions.areas).toEqual(['read','describe']);
  });
  it('fails closed for direct and nested bearer echoes or credential-named fields',async()=>{
    for(const claims of [{bearer:token},{account:'x',note:'prefix-'+token},
      {account:'x',nested:{access_token:'redacted'}},{account:'x',refreshSecret:'x'},
      {account:'x',authorization:'Bearer other'}]){
      const f=fixture(claims),response=res();
      expect(await f.authenticate(req,response)).toBeNull();
      expect(response.statusCode).toBe(401);
      expect(response.body).toEqual({error:'invalid_token'});
      expect(JSON.stringify(response)).not.toContain(token);
      expect(f.getAccessToken).toHaveBeenCalledTimes(1);
    }
  });
  it('refuses accessor and inherited properties without evaluating the getter',async()=>{
    const getter=vi.fn(()=>token);
    const value={account:'x'};
    Object.defineProperty(value,'private', {enumerable:true,get:getter});
    const f=fixture(value),answer=res();
    expect(await f.authenticate(req,answer)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    const inherited=Object.create({profile:'full'});
    inherited.account='x';
    expect(await fixture(inherited).authenticate(req,res())).toBeNull();
  });
  it('rejects cycles, functions, exotic identities and oversized values',async()=>{
    const cyclic={account:'x'};cyclic.self=cyclic;
    const oversized={account:'x',metadata:'x'.repeat(9000)};
    const withFn={account:'x',callback:()=>{}};
    const withDate={account:'x',createdAt:new Date()};
    const sparse={account:'x',rights:Array(2)};
    for(const value of [cyclic,oversized,withFn,withDate,sparse]){
      const answer=res();
      expect(await fixture(value).authenticate(req,answer)).toBeNull();
      expect(answer.statusCode).toBe(401);
    }
  });
});
