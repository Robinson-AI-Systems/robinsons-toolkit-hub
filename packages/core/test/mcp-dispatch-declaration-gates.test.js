import {describe,it,expect,vi} from 'vitest';
import {createGuardedMcpDispatcher} from '../src/mcp-dispatch.js';
function harness() {
  const item={name:'stripe_read',writes:false,profiles:['read_only'],inputSchema:{type:'object',properties:{}}};
  const handler=vi.fn(async()=>({value:'ok'}));
  const registry={tools:[item],handlers:{stripe_read:handler}};
  const authorizeTool=vi.fn(async(t)=>t.writes===false&&t.profiles.includes('read_only'));
  const formatError=vi.fn(()=>null);
  const d=createGuardedMcpDispatcher({registry,authorizeTool,formatError,
    shapeResult:async raw=>raw?.isError?raw:{content:[{type:'text',text:JSON.stringify(raw)}]},
    readDetail:x=>x,splitResult:x=>({totalBytes:Buffer.byteLength(JSON.stringify(x)),value:x}),
    resultPage:()=>({offset:0})});
  const run=(name='stripe_read')=>d.dispatch({name,args:{},connection:{
    profile:'read_only',mode:'test',resultScope:'tenant-a'},db:{putScopedResult:vi.fn(async()=>{})}});
  return {item,handler,registry,authorizeTool,formatError,run};
}
describe('K-3 portable dispatcher metadata/error safety',()=>{
  it('authorizes a detached declaration even when the registry mutates across an await',async()=>{
    const h=harness();
    h.authorizeTool.mockImplementationOnce(async item=>{
      h.item.writes=true;
      h.item.profiles.splice(0,1,'full');
      return item.writes===false&&item.profiles.includes('read_only');
    });
    const result=await h.run();
    expect(result.isError).toBeUndefined();
    expect(h.handler).toHaveBeenCalledOnce();
    expect(h.authorizeTool.mock.calls[0][0]).toMatchObject({
      writes:false,profiles:['read_only']
    });
    expect(Object.isFrozen(h.authorizeTool.mock.calls[0][0])).toBe(true);
    expect(h.item).toMatchObject({writes:true,profiles:['full']});
  });
  it('refuses executable metadata getters without invoking them or executing a handler',async()=>{
    const h=harness();let invoked=0;
    Object.defineProperty(h.item,'name',{enumerable:true,get(){invoked++;return 'stripe_read';}});
    const result=await h.run();
    expect(result.isError).toBe(true);
    expect(invoked).toBe(0);
    expect(h.handler).not.toHaveBeenCalled();
    expect(h.authorizeTool).not.toHaveBeenCalled();
  });
  it('refuses inherited/active and descriptor-only executable handlers',async()=>{
    const h=harness();let invoked=0;
    Object.defineProperty(h.registry.handlers,'stripe_read',{
      enumerable:true,configurable:true,get(){invoked++;return h.handler;}
    });
    const result=await h.run();
    expect(result.isError).toBe(true);
    expect(invoked).toBe(0);
    expect(h.handler).not.toHaveBeenCalled();
  });
  it('refuses coerced and non-RTC tool names before any policy/handler code',async()=>{
    const h=harness();let invoked=0;
    for(const name of [{toString(){invoked++;return 'stripe_read';}},
      'stripe/read','__proto__','stripe_read?confirm=true', 'stripe_read'.repeat(30)]) {
      const result=await h.run(name);
      expect(result.isError).toBe(true);
    }
    expect(invoked).toBe(0);
    expect(h.authorizeTool).not.toHaveBeenCalled();
    expect(h.handler).not.toHaveBeenCalled();
  });
  it('caps provider-shaped errors at 8 KiB rather than returning giant error data',async()=>{
    const h=harness();
    h.handler.mockImplementationOnce(async()=>({isError:true,content:[{
      type:'text',text:'private oversized diagnostic '+ 'X'.repeat(10000)
    }]}));
    const result=await h.run();
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private oversized diagnostic');
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(8192);
  });
  it('bounds service-error formatting too and never leaks raw provider exceptions',async()=>{
    const h=harness();
    h.handler.mockRejectedValueOnce(Error('private-provider-error'));
    h.formatError.mockReturnValueOnce({isError:true,content:[{
      type:'text',text:'private formatted error '+ 'Y'.repeat(10000)
    }]});
    const result=await h.run();
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/private formatted error|private-provider-error/);
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(8192);
  });
});
