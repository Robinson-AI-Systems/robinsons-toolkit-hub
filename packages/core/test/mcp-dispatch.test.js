import {describe,it,expect,vi} from 'vitest';
import {createGuardedMcpDispatcher} from '../src/mcp-dispatch.js';
const parse=result=>JSON.parse(result.content[0].text);
function fixture({ payload = {value:'safe'}, scope = 'scope-a' } = {}) {
  const handlers={
    example_read:vi.fn(async()=>payload),
    restricted_read:vi.fn(async()=>({secret:'not-visible'}))
  };
  const registry={tools:[
    {name:'example_read',writes:false},
    {name:'restricted_read',writes:false}
  ], handlers};
  const authorizeTool=vi.fn((tool,conn)=>conn.profile==='read_only' &&
    tool.name==='example_read');
  const shapeResult=vi.fn(result=>result?.content ? result :
    {content:[{type:'text',text:JSON.stringify(result)}]});
  const readDetail=vi.fn((value,{detail,fields})=>
    detail==='summary' && fields ? {value:value.value,fields} : value);
  const splitResult=vi.fn(value=>({totalBytes:Buffer.byteLength(JSON.stringify(value)),value}));
  const resultPage=vi.fn(()=>({offset:0,nextOffset:null}));
  const formatError=vi.fn(()=>null);
  const dispatcher=createGuardedMcpDispatcher({registry,authorizeTool,
    shapeResult,readDetail,splitResult,resultPage,formatError});
  const db={putScopedResult:vi.fn(async()=>{})};
  const connection={profile:'read_only',mode:'test',resultScope:scope};
  const dispatch=(name='example_read',args={},override={})=>
    dispatcher.dispatch({name,args,connection,db,...override});
  return {dispatcher,handlers,registry,authorizeTool,shapeResult,readDetail,
    splitResult,resultPage,formatError,db,connection,dispatch};
}
describe('transport-independent MCP dispatch adapter',()=>{
  it('calls exactly the authorized tool under trusted connection, with projected detail',async()=>{
    const f=fixture();
    const a=await f.dispatch('example_read',{detail:'summary',fields:'value'});
    expect(parse(a)).toEqual({value:'safe',fields:'value'});
    expect(f.handlers.example_read).toHaveBeenCalledTimes(1);
    expect(f.authorizeTool).toHaveBeenCalledWith(f.registry.tools[0],f.connection);
    expect(f.db.putScopedResult).not.toHaveBeenCalled();
  });
  it('refuses missing identity, invalid args, unknown and denied tools before handler call',async()=>{
    const f=fixture();
    expect((await f.dispatch('restricted_read')).isError).toBe(true);
    expect((await f.dispatch('unknown')).isError).toBe(true);
    expect((await f.dispatch('example_read',[])).isError).toBe(true);
    expect((await f.dispatch('example_read',{}, {connection:null})).isError).toBe(true);
    expect(f.handlers.example_read).not.toHaveBeenCalled();
    expect(f.handlers.restricted_read).not.toHaveBeenCalled();
  });
  it('refuses untrusted argument descriptors before policy, handler or storage',async()=>{
    const f=fixture();
    let getterCalls=0;
    const accessor={};
    Object.defineProperty(accessor,'detail',{enumerable:true,get(){getterCalls++;throw Error('private control');}});
    const inherited=Object.create({confirm:true});
    const symbol={};symbol[Symbol('private')]=true;
    const malicious=[
      accessor,inherited,symbol,{constructor:'Object'},{prototype:{}},
      new Proxy({}, {getPrototypeOf(){throw Error('private proxy')}})
    ];
    for(const args of malicious){
      const result=await f.dispatch('example_read',args);
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).not.toMatch(/private control|private proxy/);
    }
    expect(getterCalls).toBe(0);
    expect(f.authorizeTool).not.toHaveBeenCalled();
    expect(f.handlers.example_read).not.toHaveBeenCalled();
    expect(f.db.putScopedResult).not.toHaveBeenCalled();
    const nullRecord=Object.assign(Object.create(null),{detail:'summary',fields:'value'});
    expect((await f.dispatch('example_read',nullRecord)).isError).toBeUndefined();
    expect(f.handlers.example_read).toHaveBeenCalledTimes(1);
  });
  it('refuses nested executable and cyclic argument JSON before policy or handlers',async()=>{
    const f=fixture();let getterCalls=0;
    const nested={confirm:true,payload:{}};
    Object.defineProperty(nested.payload,'id',{enumerable:true,get(){getterCalls++;return 'private';}});
    const cyclic={confirm:true};cyclic.detail=cyclic;
    for (const args of [nested,cyclic,{detail:{toJSON(){return 'private';}}},
      {items:[1,undefined]},{items:[new Date()]}]) {
      expect((await f.dispatch('example_read',args)).isError).toBe(true);
    }
    expect(getterCalls).toBe(0);
    expect(f.authorizeTool).not.toHaveBeenCalled();
    expect(f.handlers.example_read).not.toHaveBeenCalled();
  });
  it('fails closed when injected policy throws or handler is missing',async()=>{
    const f=fixture();
    f.authorizeTool.mockImplementationOnce(()=>{throw new Error('private-policy-error');});
    expect((await f.dispatch()).isError).toBe(true);
    f.registry.handlers.example_read=undefined;
    expect((await f.dispatch()).content[0].text).toBe('Tool unavailable');
  });
  it('does not permit an indirect runRead to bypass connection policy',async()=>{
    const f=fixture();
    f.handlers.example_read.mockImplementationOnce(async(_args,ctx)=>
      ctx.runRead('restricted_read',{confirm:true,connection:{profile:'full'}}));
    const v=await f.dispatch();
    expect(v.isError).toBe(true);
    expect(f.handlers.restricted_read).not.toHaveBeenCalled();
  });
  it('uses explicit durable scope for large results, never silently truncates',async()=>{
    const f=fixture({payload:{value:'A'.repeat(10000)}});
    const v=await f.dispatch();
    expect(v.isError).toBeUndefined();
    expect(parse(v)).toMatchObject({records:1,expiresInHours:24});
    expect(parse(v).handle).toMatch(/^res_[A-Za-z0-9_-]{24}$/);
    expect(f.db.putScopedResult).toHaveBeenCalledTimes(1);
    expect(f.db.putScopedResult.mock.calls[0][0]).toMatchObject({
      connection:'scope-a',body:{totalBytes:10012}});
    expect(f.handlers.example_read).toHaveBeenCalledTimes(1);
  });
  it('rejects oversized results when scoped persistence is not available',async()=>{
    const f=fixture({payload:{value:'B'.repeat(10000)},scope:null});
    expect((await f.dispatch()).content[0].text).toMatch(/securely stored/);
    expect(f.db.putScopedResult).not.toHaveBeenCalled();
  });
  it('stores only service-shaped/redacted bytes, never the raw secret',async()=>{
    const f=fixture({payload:{safe:'C'.repeat(10000),privateCredential:'not-for-consumers'}});
    f.shapeResult.mockImplementationOnce(raw=>({
      content:[{type:'text',text:JSON.stringify({safe:raw.safe})}]
    }));
    const v=await f.dispatch();
    expect(v.isError).toBeUndefined();
    expect(JSON.stringify(f.db.putScopedResult.mock.calls[0][0])).not.toContain('not-for-consumers');
  });
  it('does not fabricate provider success for a handler or persistence failure',async()=>{
    const f=fixture();
    f.handlers.example_read.mockRejectedValueOnce(new Error('private provider detail'));
    const a=await f.dispatch();
    expect(a.isError).toBe(true);
    expect(JSON.stringify(a)).not.toContain('private provider detail');
    const big=fixture({payload:{value:'X'.repeat(12000)}});
    big.db.putScopedResult.mockRejectedValueOnce(new Error('private-db-message'));
    const v=await big.dispatch();
    expect(v.isError).toBe(true);
    expect(JSON.stringify(v)).not.toContain('private-db-message');
  });
  it('rejects active shaped responses before serialization, return or storage',async()=>{
    let getterCalls=0,serializerCalls=0;
    const poison=[
      ()=>{const raw={content:[]};Object.defineProperty(raw.content,'0',{
        configurable:true,enumerable:true,get(){getterCalls++;throw Error('private getter');}});
        raw.content.length=1;return raw;},
      ()=>({content:[{type:'text',text:'{}',toJSON(){serializerCalls++;throw Error('private serializer');}}]}),
      ()=>({content:[Object.create({type:'text'})]}),
      ()=>{const raw={content:[]};raw.content.push(raw);return raw;}
    ];
    for(const create of poison){
      const f=fixture();
      f.shapeResult.mockImplementationOnce(create);
      const v=await f.dispatch();
      expect(v.isError).toBe(true);
      expect(JSON.stringify(v)).not.toMatch(/private getter|private serializer/);
      expect(f.db.putScopedResult).not.toHaveBeenCalled();
    }
    expect(getterCalls).toBe(0);
    expect(serializerCalls).toBe(0);
  });
  it('rejects unsafe detail projections and formatted errors without executing them',async()=>{
    let callbacks=0;
    const f=fixture();
    f.readDetail.mockImplementationOnce(()=>({toJSON(){callbacks++;throw Error('secret');}}));
    expect((await f.dispatch()).isError).toBe(true);
    expect(callbacks).toBe(0);
    expect(f.db.putScopedResult).not.toHaveBeenCalled();
    const error=fixture();
    error.handlers.example_read.mockRejectedValueOnce(Error('private source detail'));
    error.formatError.mockImplementationOnce(()=>({isError:true,content:[{
      type:'text',get text(){callbacks++;return 'private';}
    }]}));
    const result=await error.dispatch();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Could not read account details/);
    expect(callbacks).toBe(0);
    expect(error.db.putScopedResult).not.toHaveBeenCalled();
  });
  it('returns inert service-shaped errors without changing their status',async()=>{
    const f=fixture();
    f.shapeResult.mockImplementationOnce(()=>({
      isError:true,content:[{type:'text',text:'Service rejected operation'}]
    }));
    expect(await f.dispatch()).toEqual({
      isError:true,content:[{type:'text',text:'Service rejected operation'}]
    });
  });
  it('requires policy, redaction and result storage adapters on construction',()=>{
    const f=fixture();
    expect(()=>createGuardedMcpDispatcher({registry:f.registry})).toThrow(/adapters/);
    expect(()=>createGuardedMcpDispatcher({})).toThrow(/adapters/);
  });
});
