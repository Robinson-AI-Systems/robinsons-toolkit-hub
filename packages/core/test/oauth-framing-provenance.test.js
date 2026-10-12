import {describe,it,expect,vi} from 'vitest';
import {createOAuthProtocolHandlers,oauthTransportBodyWithinLimit,
  MAX_OAUTH_BODY_BYTES} from '../src/oauth-protocol.js';

function harness() {
  const db={
    createOAuthClient:vi.fn(async()=>{}),getOAuthClient:vi.fn(async()=>null),
    consumeAuthCode:vi.fn(async()=>null),createAccessToken:vi.fn(async()=>{}),
    rotateRefreshToken:vi.fn(async()=>null)
  };
  const endpoints=createOAuthProtocolHandlers({db,
    env:{PUBLIC_BASE_URL:'https://source.example.test'},
    buildAccessRow:()=>({})});
  return {db,endpoints};
}
function response(){
  return {statusCode:200,headers:{},body:null,
    setHeader(key,value){this.headers[key]=value;return this;},
    status(value){this.statusCode=value;return this;},
    send(value){this.body=value;return this;}};
}
const base=()=>({method:'POST',headers:{'content-type':'application/json'},
  body:{redirect_uris:['https://agent.example.test/cb']}});
async function register(endpoints,request){
  const res=response();await endpoints.register(request,res);
  return {status:res.statusCode,body:JSON.parse(res.body)};
}

describe('portable OAuth verified HTTP framing provenance',()=>{
  it('accepts ordinary pre-parsed registrations and exact raw evidence',async()=>{
    const {db,endpoints}=harness();
    expect((await register(endpoints,base())).status).toBe(201);
    expect(db.createOAuthClient).toHaveBeenCalledTimes(1);
    const raw=JSON.stringify(base().body);
    const req={...base(),rawBody:Buffer.from(raw),headers:{
      'content-type':'application/json','content-length':String(Buffer.byteLength(raw))},
      rawHeaders:['Content-Type','application/json','Content-Length',String(Buffer.byteLength(raw))]};
    expect(oauthTransportBodyWithinLimit(req)).toBe(true);
    expect((await register(endpoints,req)).status).toBe(201);
    expect(db.createOAuthClient).toHaveBeenCalledTimes(2);
  });
  it('refuses contradictory, duplicated, case-mismatched and accessor framing before SQL',async()=>{
    const {db,endpoints}=harness();
    let getters=0;
    const contentLengthGetter=base();
    Object.defineProperty(contentLengthGetter.headers,'content-length',{
      enumerable:true,get(){getters++;return '2';}});
    const contentTypeGetter=base();
    Object.defineProperty(contentTypeGetter.headers,'content-type',{
      enumerable:true,get(){getters++;return 'application/json';}});
    const bodyGetter=base();
    Object.defineProperty(bodyGetter,'body',{get(){getters++;return {};}});
    const rawGetter=base();
    Object.defineProperty(rawGetter,'rawBody',{get(){getters++;return '{}';}});
    const bad=[
      contentLengthGetter,contentTypeGetter,bodyGetter,rawGetter,
      {...base(),headers:{...base().headers,'Content-Length':'1'}},
      {...base(),headers:{...base().headers,'content-length':'2','transfer-encoding':'chunked'}},
      {...base(),headers:{...base().headers,'content-length':'2'},
        rawHeaders:['Content-Length','2','content-length','2','Content-Type','application/json']},
      {...base(),headers:{...base().headers,'content-length':'2'},
        rawHeaders:['Content-Length','3','Content-Type','application/json']},
      {...base(),rawHeaders:['Content-Type','application/json','Content-Length','3']},
      {...base(),headers:{...base().headers,'content-length':'02'}},
      {...base(),headers:{...base().headers,'content-length':String(MAX_OAUTH_BODY_BYTES+1)}}
    ];
    for (const req of bad) {
      const r=await register(endpoints,req);
      expect(r).toMatchObject({status:400,body:{error:'invalid_client_metadata'}});
    }
    expect(getters).toBe(0);
    expect(db.createOAuthClient).not.toHaveBeenCalled();
    expect(db.getOAuthClient).not.toHaveBeenCalled();
  });
  it('does not treat framework-preparsed semantic size as authentic wire length',()=>{
    const req=base();
    expect(oauthTransportBodyWithinLimit(req)).toBe(false);
    const raw=JSON.stringify(req.body);
    req.rawBody=raw;
    expect(oauthTransportBodyWithinLimit(req)).toBe(true);
    req.headers['content-length']=String(Buffer.byteLength(raw)+1);
    expect(oauthTransportBodyWithinLimit(req)).toBe(false);
  });
});
