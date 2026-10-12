import {describe,it,expect,vi} from 'vitest';
import {createGuardedMcpDispatcher} from '../src/mcp-dispatch.js';
function setup({ skipDetailFor = () => false }={}) {
  const read=vi.fn(async()=>({value:'safe'}));
  const tools=[{name:'x_read',writes:false,profiles:['read_only']}];
  const registry={tools,handlers:{x_read:read}};
  const authorizeTool=vi.fn(async (tool,c)=>tool.writes===false&&
    tool.profiles.includes(c.profile));
  const dispatcher=createGuardedMcpDispatcher({registry,authorizeTool,skipDetailFor,
    shapeResult:async raw=>({content:[{type:'text',text:JSON.stringify(raw)}]}),
    readDetail:vi.fn(value=>value),splitResult:()=>({totalBytes:20,value:{}}),
    resultPage:()=>({offset:0}),formatError:()=>null});
  const run=(name='x_read')=>dispatcher.dispatch({name,args:{},connection:{
    profile:'read_only',mode:'test',resultScope:'scope1'},db:{putScopedResult:vi.fn()}});
  return {registry,tools,read,authorizeTool,run};
}
describe('K-3 frozen provider handler across asynchronous authorization',()=>{
  it('uses the original own handler when an authorization hook replaces the registry handler',async()=>{
    const h=setup(); const malicious=vi.fn(async()=>({value:'changed'}));
    h.authorizeTool.mockImplementationOnce(async (_tool)=>{
      h.registry.handlers.x_read=malicious;
      return true;
    });
    const result=await h.run();
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({value:'safe'});
    expect(h.read).toHaveBeenCalledOnce();
    expect(malicious).not.toHaveBeenCalled();
  });
  it('refuses getter-backed handler slots without invoking code',async()=>{
    const h=setup(); let count=0;
    Object.defineProperty(h.registry.handlers,'x_read',{configurable:true,get(){
      count++; return h.read;
    }});
    const outcome=await h.run();
    expect(outcome.isError).toBe(true);
    expect(count).toBe(0);
    expect(h.read).not.toHaveBeenCalled();
    expect(h.authorizeTool).not.toHaveBeenCalled();
  });
  it('does not trust late mutation of metadata or source registry name',async()=>{
    const h=setup();const changed=vi.fn(async()=>({value:'changed'}));
    h.authorizeTool.mockImplementationOnce(async tool=>{
      h.tools[0].writes=true;
      h.tools[0].profiles=['full'];
      h.registry.handlers.x_read=changed;
      h.registry.tools=[{name:'x_read',writes:true,profiles:['full']}];
      return tool.writes===false;
    });
    const outcome=await h.run();
    expect(outcome.isError).toBeUndefined();
    expect(h.read).toHaveBeenCalledOnce();
    expect(changed).not.toHaveBeenCalled();
  });
  it('evaluates detail-exemption guard before any handler, never after provider side effects',async()=>{
    const unsafe=vi.fn(()=>{throw Error('private detailed policy');});
    const h=setup({skipDetailFor:unsafe});
    const outcome=await h.run();
    expect(outcome.isError).toBe(true);
    expect(JSON.stringify(outcome)).not.toContain('private detailed policy');
    expect(h.read).not.toHaveBeenCalled();
    expect(h.authorizeTool).not.toHaveBeenCalled();
    expect(unsafe).toHaveBeenCalledOnce();
  });
  it('refuses non-Boolean detail-exemption outcomes before provider call',async()=>{
    for (const value of [null,{},'yes',0]) {
      const h=setup({skipDetailFor:()=>value});
      expect((await h.run()).isError).toBe(true);
      expect(h.read).not.toHaveBeenCalled();
    }
  });
  it('preserves valid Boolean detail-exemption flags across async permission changes',async()=>{
    let permitted=false;
    const skip=vi.fn(()=>permitted);
    const h=setup({skipDetailFor:skip});
    h.authorizeTool.mockImplementationOnce(async()=>{
      permitted=true;
      return true;
    });
    const output=await h.run();
    expect(output.isError).toBeUndefined();
    expect(h.read).toHaveBeenCalledOnce();
    expect(skip).toHaveBeenCalledOnce();
  });
});
