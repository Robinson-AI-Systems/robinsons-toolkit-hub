// Disposable Postgres proof of the *adapter contract*, not a migration or live service adoption.
// Two independent pools share the same schema to model separate serverless processes.
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
import {openIsolatedSchema} from './isolated-schema.js';
import {createOneTimeSecretStore} from '../../packages/core/src/one-time-secrets.js';
import {evaluateLogin} from '../../packages/core/src/oauth.js';
import {createGuardedMcpDispatcher} from '../../packages/core/src/mcp-dispatch.js';

let isolated,alpha,beta;
const key=randomBytes(32);
const aad=({id,account,mode,kind})=>
  ['stripe-once',id,account||'',mode||'',kind].join('/');

beforeAll(async()=>{
  isolated=await openIsolatedSchema();
  await isolated.query(`
    CREATE TABLE core_once (
      id text PRIMARY KEY, account text, mode text NOT NULL, kind text NOT NULL,
      ciphertext text NOT NULL, expires_at timestamptz NOT NULL
    );
    CREATE TABLE core_login_attempt (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ip text NOT NULL, attempted_at timestamptz NOT NULL DEFAULT now(),
      succeeded boolean NOT NULL DEFAULT false
    );
    CREATE TABLE core_result (
      handle text PRIMARY KEY, connection text NOT NULL,
      body jsonb NOT NULL, expires_at timestamptz NOT NULL
    );
    CREATE INDEX core_login_ip_time ON core_login_attempt(ip,attempted_at);
    CREATE INDEX core_result_scope ON core_result(connection,expires_at);
  `);
  alpha=isolated.pool();beta=isolated.pool();
});
afterAll(async()=>{await isolated?.close();});

function oneTime(pool) {
  const db={
    addOneTimeSecret:async row=>pool.query(
      'INSERT INTO core_once(id,account,mode,kind,ciphertext,expires_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [row.id,row.account,row.mode,row.kind,row.ciphertext,row.expiresAt]),
    consumeOneTimeSecret:async id=>{
      // One DELETE..RETURNING is atomic across connections, unlike SELECT then DELETE.
      const result=await pool.query(
        'DELETE FROM core_once WHERE id=$1 AND expires_at > now() RETURNING *',[id]);
      return result.rows[0]||null;
    }
  };
  return createOneTimeSecretStore({db,encryptionKey:key,contextFor:aad,
    setupPathFor:id=>'/api/stripe/setup?show='+id,
    accountFromRow:row=>row.account});
}
function login(pool) {
  return {
    recordLoginAttempt:async ip=>{
      const res=await pool.query(
        'INSERT INTO core_login_attempt(ip) VALUES ($1) RETURNING id',[ip]);
      return res.rows[0].id;
    },
    countRecentFailedLogins:async(ip,minutes)=>{
      const res=await pool.query(
        `SELECT count(*)::int AS count FROM core_login_attempt
         WHERE ip=$1 AND succeeded=false
           AND attempted_at > now() - ($2::int * interval '1 minute')`,[ip,minutes]);
      return res.rows[0].count;
    },
    markLoginAttemptSucceeded:async id=>pool.query(
      'UPDATE core_login_attempt SET succeeded=true WHERE id=$1',[id])
  };
}
describe('core durable service-adapter contract (isolated Postgres)',()=>{
  it('single-use secret can be claimed exactly once across two pools under concurrency',async()=>{
    const a=oneTime(alpha),b=oneTime(beta);
    const {id,setupPath}=await a.issue({account:'tenant-a',mode:'test',
      kind:'setup',secret:'synthetic-fixture-string'});
    expect(setupPath).toBe('/api/stripe/setup?show='+id);
    const rows=await isolated.query('SELECT ciphertext FROM core_once WHERE id=$1',[id]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].ciphertext).toMatch(/^v1\./);
    expect(rows.rows[0].ciphertext).not.toContain('synthetic-fixture-string');
    const outcomes=await Promise.all(Array.from({length:20},(_,i)=>
      (i%2?a:b).consume(id)));
    expect(outcomes.filter(x=>x!==null)).toEqual(['synthetic-fixture-string']);
    expect(await b.consume(id)).toBeNull();
    expect((await isolated.query('SELECT id FROM core_once WHERE id=$1',[id])).rowCount).toBe(0);
  });
  it('expired rows and altered account/AAD refuse without plaintext fallback',async()=>{
    const a=oneTime(alpha),b=oneTime(beta);
    const old=await a.issue({account:'tenant-a',kind:'api',secret:'expired-fixture'});
    await isolated.query("UPDATE core_once SET expires_at=now()-interval '1 second' WHERE id=$1",[old.id]);
    expect(await b.consume(old.id)).toBeNull();
    const wrong=await a.issue({account:'tenant-a',kind:'api',secret:'bound-fixture'});
    await isolated.query('UPDATE core_once SET account=$2 WHERE id=$1',[wrong.id,'tenant-b']);
    await expect(b.consume(wrong.id)).rejects.toThrow(/Unable to decrypt/);
    expect(await a.consume(wrong.id)).toBeNull();
  });
  it('shared login history is enforced across independent pools and expires after window',async()=>{
    const ip='198.51.100.42',expected='fixture-login-string';
    for(let i=0;i<5;i++){
      const result=await evaluateLogin({ip,supplied:'wrong',expected,
        store:i%2?login(alpha):login(beta)});
      expect(result.status).toBe('wrong');
      expect(result.attemptsLeft).toBe(4-i);
    }
    const sixth=await evaluateLogin({ip,supplied:'wrong',expected,store:login(alpha)});
    expect(sixth.status).toBe('locked');
    const barred=await evaluateLogin({ip,supplied:expected,expected,store:login(beta)});
    expect(barred.status).toBe('locked');
    expect((await isolated.query(
      'SELECT count(*)::int AS n FROM core_login_attempt WHERE ip=$1 AND succeeded=true',[ip]
    )).rows[0].n).toBe(0);
    await isolated.query(
      "UPDATE core_login_attempt SET attempted_at=now()-interval '16 minutes' WHERE ip=$1",[ip]);
    expect(await evaluateLogin({ip,supplied:expected,expected,store:login(beta)}))
      .toEqual({status:'ok'});
  });
  it('large scoped results survive another pool and cannot be queried as another account',async()=>{
    const handler=vi.fn(async()=>({data:[{value:'X'.repeat(11000)}]}));
    const dispatcher=createGuardedMcpDispatcher({
      registry:{tools:[{name:'fixture_read',writes:false}],handlers:{fixture_read:handler}},
      authorizeTool:async tool=>tool.writes===false,
      shapeResult:value=>({content:[{type:'text',text:JSON.stringify(value)}]}),
      readDetail:value=>value,
      splitResult:value=>({value,totalBytes:Buffer.byteLength(JSON.stringify(value))}),
      resultPage:()=>({offset:0,nextOffset:null}),
      formatError:()=>null
    });
    const persist={
      putScopedResult:async row=>alpha.query(
        'INSERT INTO core_result(handle,connection,body,expires_at) VALUES ($1,$2,$3,$4)',
        [row.handle,row.connection,JSON.stringify(row.body),row.expiresAt])
    };
    const reply=await dispatcher.dispatch({name:'fixture_read',connection:{
      mode:'test',profile:'read_only',resultScope:'tenant-a'
    },args:{},db:persist});
    expect(reply.isError).not.toBe(true);
    const handle=JSON.parse(reply.content[0].text).handle;
    const fetch=(connection)=>beta.query(
      'SELECT body FROM core_result WHERE handle=$1 AND connection=$2 AND expires_at>now()',
      [handle,connection]);
    expect((await fetch('tenant-b')).rows).toHaveLength(0);
    const allowed=await fetch('tenant-a');
    expect(allowed.rows).toHaveLength(1);
    expect(allowed.rows[0].body.value.data[0].value).toHaveLength(11000);
    await isolated.query("UPDATE core_result SET expires_at=now()-interval '1 second' WHERE handle=$1",[handle]);
    expect((await fetch('tenant-a')).rows).toHaveLength(0);
    expect(handler).toHaveBeenCalledTimes(1);
  });
  it('refuses to claim result success if durable storage rejects the write',async()=>{
    const dispatcher=createGuardedMcpDispatcher({
      registry:{tools:[{name:'fixture_read',writes:false}],handlers:{
        fixture_read:async()=>({value:'Y'.repeat(12000)})}},
      authorizeTool:async()=>true,
      shapeResult:value=>({content:[{type:'text',text:JSON.stringify(value)}]}),
      readDetail:value=>value,
      splitResult:value=>({value,totalBytes:Buffer.byteLength(JSON.stringify(value))}),
      resultPage:()=>({offset:0,nextOffset:null}),
      formatError:()=>null
    });
    const reply=await dispatcher.dispatch({name:'fixture_read',args:{},
      connection:{mode:'test',resultScope:'tenant-a'},
      db:{putScopedResult:async()=>{throw Error('private-db-fault');}}});
    expect(reply.isError).toBe(true);
    expect(JSON.stringify(reply)).not.toContain('private-db-fault');
  });
});
