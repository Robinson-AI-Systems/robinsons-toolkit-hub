// Adapted dispatch parity: explicit handlers, immutable scoped result metadata,
// and re-authorization on nested calls. Synthetic only; service owns redaction.
import {describe,it,expect,vi} from 'vitest';
import {createGuardedMcpDispatcher} from '../src/mcp-dispatch.js';

const parsed=result=>JSON.parse(result.content[0].text);
const text=value=>({content:[{type:'text',text:JSON.stringify(value)}]});
function fixture({handlers,tools,page=()=>({offset:0,nextOffset:null}),
  policy=()=>true,redact=value=>value,resultScope='connection-a'}={}){
  const read=vi.fn(async()=>text({data:[{value:'short'}]}));
  const registry={tools:tools||[{name:'fixture_read',writes:false}],
    handlers:handlers||{fixture_read:read}};
  const db={putScopedResult:vi.fn(async()=>{})};
  const shapeResult=vi.fn(async value=>redact(value));
  const readDetail=vi.fn(value=>value);
  const splitResult=vi.fn(value=>({value,totalBytes:Buffer.byteLength(
    JSON.stringify(value),'utf8')}));
  const resultPage=vi.fn(page);
  const authorizeTool=vi.fn(async(tool,connection)=>policy(tool,connection));
  const dispatcher=createGuardedMcpDispatcher({registry,shapeResult,readDetail,
    splitResult,resultPage,authorizeTool,formatError:()=>null});
  const connection={mode:'test',profile:'full',resultScope};
  const call=(name='fixture_read',args={})=>dispatcher.dispatch({
    name,args,connection,db,services:{}});
  return {registry,db,read,shapeResult,readDetail,splitResult,resultPage,
    authorizeTool,dispatcher,connection,call};
}
const longValue=()=>({data:[{blob:'x'.repeat(10000)}]});

describe('portable MCP dispatcher source adapter integrity',()=>{
  it('refuses a listed tool with a handler inherited from the prototype',async()=>{
    const inherited=vi.fn(async()=>text({private:'should-not-run'}));
    const handlers=Object.create({fixture_read:inherited});
    const f=fixture({handlers});
    const result=await f.call();
    expect(result.isError).toBe(true);
    expect(parsed(result)).toBe('Tool unavailable');
    expect(f.authorizeTool).toHaveBeenCalledTimes(1);
    expect(inherited).not.toHaveBeenCalled();
  });
  it('refuses Object.prototype names even if metadata accidentally lists them',async()=>{
    const f=fixture({tools:[{name:'constructor'},{name:'toString'}],
      handlers:{}});
    for(const name of ['constructor','toString']){
      const result=await f.call(name);
      expect(result.isError).toBe(true);
      expect(parsed(result)).toBe('Tool unavailable');
    }
    expect(f.db.putScopedResult).not.toHaveBeenCalled();
  });
  it('preserves explicit own handlers and successful small responses',async()=>{
    const f=fixture();
    expect(parsed(await f.call())).toEqual({data:[{value:'short'}]});
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(f.db.putScopedResult).not.toHaveBeenCalled();
  });
  it('refuses paging adapters that overwrite any core-issued identity or audit metadata',async()=>{
    for(const [key,value] of Object.entries({handle:'res_forged',summary:'false',
      totalBytes:0,records:999,expiresInHours:9999})){
      const f=fixture({handlers:{fixture_read:async()=>text(longValue())},
        page:()=>({offset:0,nextOffset:null,[key]:value})});
      const result=await f.call();
      expect(result.isError).toBe(true);
      expect(parsed(result)).toMatch(/protected handle metadata/);
      expect(f.db.putScopedResult).not.toHaveBeenCalled();
    }
  });
  it('saves redacted oversized content with a core-generated handle and scoped retrieval owner',async()=>{
    const secret='synthetic-sensitive-private-fixture';
    const f=fixture({handlers:{fixture_read:async()=>text({
      data:[{blob:'x'.repeat(10000),privateField:secret}]})},
      redact:result=>({content:result.content.map(part=>({
        ...part,text:part.text.replaceAll(secret,'[REDACTED]')
      }))})});
    const answer=parsed(await f.call());
    expect(answer.handle).toMatch(/^res_[A-Za-z0-9_-]+$/);
    expect(answer.summary).toContain('fixture_read');
    expect(answer.records).toBe(1);
    expect(answer.expiresInHours).toBe(24);
    expect(answer).toHaveProperty('offset',0);
    expect(JSON.stringify(answer)).not.toContain(secret);
    expect(f.db.putScopedResult).toHaveBeenCalledTimes(1);
    const stored=f.db.putScopedResult.mock.calls[0][0];
    expect(stored.connection).toBe('connection-a');
    expect(stored.handle).toBe(answer.handle);
    expect(stored.summary).toBe(answer.summary);
    expect(stored.body.value.data[0].privateField).toBe('[REDACTED]');
    expect(JSON.stringify(stored)).not.toContain(secret);
  });
  it('does not fabricate a durable handle if storage is unavailable or unscoped',async()=>{
    const f=fixture({handlers:{fixture_read:async()=>text(longValue())}});
    f.db.putScopedResult.mockRejectedValueOnce(new Error('private storage failure'));
    const result=await f.call();
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private storage failure');
    const unavailable=fixture({handlers:{fixture_read:async()=>text(longValue())},
      resultScope:''});
    const denied=await unavailable.call();
    expect(denied.isError).toBe(true);
    expect(unavailable.db.putScopedResult).not.toHaveBeenCalled();
  });
  it('refuses a page too large for the compact response before persistence',async()=>{
    const f=fixture({handlers:{fixture_read:async()=>text(longValue())},
      page:()=>({offset:0,value:'x'.repeat(9000)})});
    const result=await f.call();
    expect(result.isError).toBe(true);
    expect(parsed(result)).toMatch(/exceeds the allowed response size/);
    expect(f.db.putScopedResult).not.toHaveBeenCalled();
  });
  it('rechecks authorization on nested dispatch with the same identity and no privilege escalation',async()=>{
    const privateFn=vi.fn(async()=>text({secret:'private'}));
    const f=fixture({
      tools:[{name:'fixture_read',writes:false},{name:'owner_only',writes:true}],
      handlers:{
        fixture_read:async(_args,ctx)=>ctx.runRead('owner_only',{}),
        owner_only:privateFn
      },
      policy:(tool,connection)=>tool.writes!==true && connection.profile==='full'
    });
    const result=await f.call();
    expect(result.isError).toBe(true);
    expect(parsed(result)).toMatch(/unavailable for this connection/);
    expect(privateFn).not.toHaveBeenCalled();
    expect(f.authorizeTool).toHaveBeenCalledTimes(2);
  });
  it('fails closed when the server result page adapter does not return an object',async()=>{
    for(const page of [null,42,'bad',[]]){
      const f=fixture({handlers:{fixture_read:async()=>text(longValue())},
        page:()=>page});
      expect((await f.call()).isError).toBe(true);
      expect(f.db.putScopedResult).not.toHaveBeenCalled();
    }
  });
});
