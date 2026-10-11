// K-3: run original Stripe OAuth HTTP protocol through a disposable Postgres
// contract adapter shared by independent pools. NOT the Stripe production schema.
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {openIsolatedSchema} from './isolated-schema.js';
import {createOAuthHandlers} from '../../docs/audits/upstream/runtime/oauth-handlers.js';
import {hashToken} from '../../docs/audits/upstream/runtime/oauth.js';
import {createMcpBearerAuthenticator} from '../../packages/core/src/mcp-auth.js';
const env={PUBLIC_BASE_URL:'https://source-fixture.example.test',
  [['ADMIN','PASSPHRASE'].join('_')]:'offline-not-a-real-passphrase'};
const clientCallback='https://client.example.test/cb';
const verifier='a'.repeat(43);
const challenge=createHash('sha256').update(verifier).digest('base64url');
const resource=env.PUBLIC_BASE_URL+'/api/mcp';
let isolated,alpha,beta;
beforeAll(async()=>{
  isolated=await openIsolatedSchema();
  await isolated.query(`
    CREATE TABLE oauth_client_fixture(
      client_id text PRIMARY KEY,client_secret_hash text NOT NULL,
      redirect_uris jsonb NOT NULL,client_name text
    );
    CREATE TABLE oauth_code_fixture(
      code_hash text PRIMARY KEY,client_id text NOT NULL,redirect_uri text NOT NULL,
      code_challenge text NOT NULL,code_challenge_method text NOT NULL,
      stripe_account text NOT NULL,mode text NOT NULL,profile text NOT NULL,
      listing text NOT NULL,expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
    );
    CREATE TABLE oauth_token_fixture(
      access_hash text PRIMARY KEY,refresh_hash text UNIQUE NOT NULL,
      client_id text NOT NULL,stripe_account text NOT NULL,mode text NOT NULL,
      profile text NOT NULL,listing text NOT NULL,result_scope text NOT NULL,
      expires_at timestamptz NOT NULL,revoked boolean NOT NULL DEFAULT false
    );
    CREATE TABLE login_fixture(
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,ip text NOT NULL,
      attempted_at timestamptz NOT NULL DEFAULT now(),succeeded boolean NOT NULL DEFAULT false
    );
  `);
  alpha=isolated.pool();beta=isolated.pool();
});
afterAll(async()=>{await isolated?.close();});
const accessRow=row=>row?({
  client_id:row.client_id,stripe_account:row.stripe_account,mode:row.mode,
  profile:row.profile,listing:row.listing,result_scope:row.result_scope
}):null;
function db(pool){
  return {
    async createOAuthClient({clientId,clientSecret,redirectUris,clientName}){
      await pool.query(`INSERT INTO oauth_client_fixture VALUES($1,$2,$3,$4)`,
        [clientId,hashToken(clientSecret),JSON.stringify(redirectUris),clientName]);
    },
    async getOAuthClient(id){
      return (await pool.query('SELECT * FROM oauth_client_fixture WHERE client_id=$1',[id])).rows[0]||null;
    },
    async createAuthCode({code,clientId,redirectUri,codeChallenge,codeChallengeMethod,
      stripeAccount,mode,profile,listing}){
      await pool.query(`INSERT INTO oauth_code_fixture
        (code_hash,client_id,redirect_uri,code_challenge,code_challenge_method,stripe_account,mode,profile,listing)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [hashToken(code),clientId,redirectUri,codeChallenge,codeChallengeMethod,
        stripeAccount,mode,profile,listing]);
    },
    async consumeAuthCode(code){
      const result=await pool.query(`DELETE FROM oauth_code_fixture
        WHERE code_hash=$1 AND expires_at>now() RETURNING *`,[hashToken(code)]);
      return result.rows[0]||null;
    },
    async createAccessToken({accessToken,refreshToken,clientId,stripeAccount,mode,profile,listing}){
      await pool.query(`INSERT INTO oauth_token_fixture
        (access_hash,refresh_hash,client_id,stripe_account,mode,profile,listing,result_scope,expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '1 hour')`,
        [hashToken(accessToken),hashToken(refreshToken),clientId,
          stripeAccount,mode,profile,listing,randomUUID()]);
    },
    async getAccessToken(token){
      const result=await pool.query(`SELECT * FROM oauth_token_fixture
        WHERE access_hash=$1 AND expires_at>now() AND NOT revoked`,[hashToken(token)]);
      return accessRow(result.rows[0]);
    },
    async rotateRefreshToken({refreshToken,clientId,accessToken,newRefreshToken}){
      const result=await pool.query(`UPDATE oauth_token_fixture
        SET access_hash=$3,refresh_hash=$4,expires_at=now()+interval '1 hour'
        WHERE refresh_hash=$1 AND client_id=$2 AND NOT revoked
        RETURNING client_id,stripe_account,mode,profile,listing`,
        [hashToken(refreshToken),clientId,hashToken(accessToken),hashToken(newRefreshToken)]);
      return result.rows[0]||null;
    },
    async listStripeAccounts(){return [{id:'acct_fixture',label:'Fixture',live_enabled:false}];},
    async recordLoginAttempt(ip){
      const result=await pool.query('INSERT INTO login_fixture(ip) VALUES($1) RETURNING id',[ip]);
      return result.rows[0].id;
    },
    async markLoginAttemptSucceeded(id){
      await pool.query('UPDATE login_fixture SET succeeded=true WHERE id=$1',[id]);
    },
    async countRecentFailedLogins(ip,minutes){
      const result=await pool.query(`SELECT count(*)::int AS n FROM login_fixture
        WHERE ip=$1 AND NOT succeeded AND attempted_at>now()-($2::int*interval '1 minute')`,
        [ip,minutes]);return result.rows[0].n;
    },
    async revokeAccessToken(token){
      await pool.query('UPDATE oauth_token_fixture SET revoked=true WHERE access_hash=$1',
        [hashToken(token)]);
    }
  };
}
function req(method,body={},headers={},ip='198.51.100.201'){
  return {method,body:method==='GET'?undefined:body,
    query:method==='GET'?body:undefined,headers,socket:{remoteAddress:ip}};
}
function res(){return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this;},
  status(s){this.statusCode=s;return this;},
  send(value){this.body=value;return this;},
  json(value){this.body=JSON.stringify(value);return this;},
  end(){return this;}};}
async function call(fn,request){const response=res();await fn(request,response);return response;}
const json=r=>JSON.parse(r.body);
async function client(handlers){
  const result=await call(handlers.register,req('POST',{redirect_uris:[clientCallback]}));
  expect(result.statusCode).toBe(201);return json(result);
}
const authorizeArgs=c=>({client_id:c.client_id,redirect_uri:clientCallback,
  response_type:'code',code_challenge:challenge,code_challenge_method:'S256',
  resource,stripe_account:'acct_fixture',mode:'test',profile:'read_only',listing:'compact'});
describe('original source OAuth HTTP handlers against shared Postgres adapter',()=>{
  it('authorization issued in pool A can only be redeemed once by pool B',async()=>{
    const sourceA=createOAuthHandlers({db:db(alpha),env}),sourceB=createOAuthHandlers({db:db(beta),env});
    const c=await client(sourceA),p=authorizeArgs(c);
    const accepted=await call(sourceA.authorize,req('POST',{...p,passphrase:env.ADMIN_PASSPHRASE}));
    expect(accepted.statusCode).toBe(302);
    const code=new URL(accepted.headers.Location).searchParams.get('code');
    const grant={grant_type:'authorization_code',client_id:c.client_id,client_secret:c.client_secret,
      redirect_uri:clientCallback,code,code_verifier:verifier,resource};
    const attempts=await Promise.all([call(sourceA.token,req('POST',grant)),
      call(sourceB.token,req('POST',grant))]);
    expect(attempts.map(x=>x.statusCode).sort()).toEqual([200,400]);
    const winner=json(attempts.find(x=>x.statusCode===200));
    expect(await db(beta).getAccessToken(winner.access_token)).toMatchObject({
      stripe_account:'acct_fixture',mode:'test',profile:'read_only',listing:'compact'});
    const refresh={grant_type:'refresh_token',client_id:c.client_id,
      client_secret:c.client_secret,refresh_token:winner.refresh_token,resource};
    const rotate=await Promise.all([call(sourceA.token,req('POST',refresh)),
      call(sourceB.token,req('POST',refresh))]);
    expect(rotate.map(x=>x.statusCode).sort()).toEqual([200,400]);
    const newPair=json(rotate.find(x=>x.statusCode===200));
    expect(await db(alpha).getAccessToken(winner.access_token)).toBeNull();
    expect(await db(beta).getAccessToken(newPair.access_token)).toMatchObject({
      stripe_account:'acct_fixture',profile:'read_only',listing:'compact'});
    const authenticate=createMcpBearerAuthenticator({
      env,getAccessToken:token=>db(beta).getAccessToken(token),
      projectConnection:row=>row?.mode==='test'&&row.profile==='read_only'?{
        stripeAccount:row.stripe_account,profile:row.profile,mode:row.mode,
        listing:row.listing,resultScope:row.result_scope}:null
    });
    expect(await authenticate(req('POST',{},{
      authorization:'Bearer '+newPair.access_token}),res())).toMatchObject({
      stripeAccount:'acct_fixture',profile:'read_only'});
    await db(alpha).revokeAccessToken(newPair.access_token);
    const denied=res();
    expect(await authenticate(req('POST',{},{
      authorization:'Bearer '+newPair.access_token}),denied)).toBeNull();
    expect(denied.statusCode).toBe(401);
  });
  it('original source refuses LIVE settings even after valid owner fixture login',async()=>{
    const h=createOAuthHandlers({db:db(beta),env}),c=await client(h);
    const answer=await call(h.authorize,req('POST',{
      ...authorizeArgs(c),mode:'live',passphrase:env.ADMIN_PASSPHRASE},{} ,'198.51.100.203'));
    expect(answer.statusCode).toBe(400);
    expect((await isolated.query("SELECT count(*)::int AS n FROM oauth_code_fixture WHERE mode='live'"))
      .rows[0].n).toBe(0);
  });
  it('source login lockout is shared across two Postgres pools',async()=>{
    const a=createOAuthHandlers({db:db(alpha),env}),b=createOAuthHandlers({db:db(beta),env});
    const c=await client(a),p=authorizeArgs(c),ip='198.51.100.204';
    for(let i=0;i<5;i++){
      const result=await call(i%2?a.authorize:b.authorize,
        req('POST',{...p,passphrase:'invalid-fixture-value'}, {},ip));
      expect(result.statusCode).toBe(401);
    }
    const barred=await call(b.authorize,req('POST',{...p,passphrase:env.ADMIN_PASSPHRASE},{},ip));
    expect(barred.statusCode).toBe(429);
  });
});
