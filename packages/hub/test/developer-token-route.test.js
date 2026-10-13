import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {createHmac} from 'node:crypto';
const mocks=vi.hoisted(()=>({query:vi.fn(),exchange:vi.fn(),rotate:vi.fn()}));
vi.mock('../src/runtime.js',()=>({withHubDb:fn=>fn({query:mocks.query},{pepper:process.env.HUB_TOKEN_PEPPER})}));
vi.mock('../src/oauth.js',()=>({exchangeOAuthCode:mocks.exchange,rotateOAuthRefresh:mocks.rotate}));
import handler from '../../../api/oauth/token.js';
const client='c'.repeat(43),secret='s'.repeat(43),origin='https://hub.example';let previous;
const response=()=>({statusCode:0,setHeader(){},status(n){this.statusCode=n;return this;},json(value){this.value=value;return this;}});
beforeEach(()=>{
 previous={HUB_TOKEN_PEPPER:process.env.HUB_TOKEN_PEPPER,HUB_PUBLIC_ORIGIN:process.env.HUB_PUBLIC_ORIGIN};
 process.env.HUB_TOKEN_PEPPER='synthetic-token-route-pepper-never-live';process.env.HUB_PUBLIC_ORIGIN=origin;
 mocks.query.mockImplementation(async(sql,args)=>({rows:sql.includes('secret_digest')?(args[1]===createHmac('sha256',process.env.HUB_TOKEN_PEPPER).update(secret).digest('hex')?[{}]:[]):sql.includes('hub_developer_clients')?(args[0]===client?[{}]:[]):[{hits:1}]}));
 mocks.rotate.mockReset().mockResolvedValue({access_token:'FAKE_ACCESS_TOKEN',refresh_token:'FAKE_REFRESH_TOKEN',token_type:'Bearer',expires_in:3600});
 mocks.exchange.mockReset();
});
afterEach(()=>{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
it('requires dynamic client authentication for both JSON and form refresh requests',async()=>{
 for(const type of ['application/json','application/x-www-form-urlencoded']){
  for(const supplied of [undefined,'wrong']){const body={grant_type:'refresh_token',client_id:client,refresh_token:'FAKE_REFRESH',resource:origin+'/api/mcp',...(supplied?{client_secret:supplied}:{})};const res=response();await handler({method:'POST',headers:{'content-type':type},body},res);expect(res.statusCode).toBe(401);}
 }
 expect(mocks.rotate).not.toHaveBeenCalled();
});
it('accepts the exact dynamic client and resource without breaking public-client form OAuth',async()=>{
 for(const [id,extra]of [[client,{client_secret:secret,resource:origin+'/api/mcp'}],['legacy-public-client',{}]]){
  const res=response();await handler({method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:{grant_type:'refresh_token',client_id:id,refresh_token:'FAKE_REFRESH',...extra}},res);expect(res.statusCode).toBe(200);
 }
 expect(mocks.rotate).toHaveBeenCalledTimes(2);
});
