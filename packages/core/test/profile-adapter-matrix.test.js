// This is an isolated portable-to-service policy contract fixture, not a
// replacement for authenticated per-service scopes, billing or owner consent.
import { describe, expect, it, vi } from 'vitest';
import { isToolAllowed, visibleTools, publicToolInfo } from '../src/profiles.js';
import { createGuardedMcpDispatcher } from '../src/mcp-dispatch.js';

const response=value=>({content:[{type:'text',text:JSON.stringify(value)}]});
function fixture() {
  const read=vi.fn(async()=>response({visible:true}));
  const protectedRead=vi.fn(async()=>response({secret:false}));
  const write=vi.fn(async()=>response({changed:true}));
  const tools=[
    {name:'public_read',writes:false,profiles:['read_only','everyday','full'],area:'catalog'},
    {name:'owner_read',writes:false,profiles:['full'],area:'accounts'},
    {name:'account_write',writes:true,profiles:['full'],area:'payments'}
  ];
  const registry={tools,handlers:{public_read:read,owner_read:protectedRead,account_write:write}};
  const dispatcher=createGuardedMcpDispatcher({
    registry,
    // Real adopting servers must authenticate claims AND apply their own policy.
    // The fixture deliberately does not grant any write, even with confirm.
    authorizeTool:(tool,connection)=>isToolAllowed(tool,connection.profile,{allowWrites:false}),
    shapeResult:async value=>value,
    readDetail:value=>value,
    splitResult:value=>({totalBytes:Buffer.byteLength(JSON.stringify(value))}),
    resultPage:()=>({data:[]}),
    formatError:()=>({isError:true,content:[{type:'text',text:'redacted'}]})
  });
  const call=(name,profile='read_only',args={})=>dispatcher.dispatch({
    name,args,connection:{profile,mode:'test',resultScope:'scope-fixture'},db:{}
  });
  return {tools,registry,call,read,protectedRead,write};
}
describe('source profile / adapted dispatch matrix',()=>{
  it('preserves source read-only and full-profile visible subsets',()=>{
    const f=fixture();
    expect(visibleTools(f.registry,'read_only',{allowWrites:true}).map(t=>t.name))
      .toEqual(['public_read']);
    expect(visibleTools(f.registry,'full',{allowWrites:false}).map(t=>t.name))
      .toEqual(['public_read','owner_read']);
    expect(visibleTools(f.registry,'full',{allowWrites:true}).map(t=>t.name))
      .toEqual(['public_read','owner_read','account_write']);
  });
  it('refuses guessed owner names and never executes a hidden handler',async()=>{
    const f=fixture();
    const denied=await f.call('owner_read','read_only',{profile:'full',confirm:true});
    expect(denied.isError).toBe(true);
    expect(f.protectedRead).not.toHaveBeenCalled();
    expect((await f.call('owner_read','full')).isError).toBeUndefined();
    expect(f.protectedRead).toHaveBeenCalledTimes(1);
  });
  it('does not interpret a caller confirm or a full profile as independent money consent',async()=>{
    const f=fixture();
    for(const profile of ['read_only','everyday','full']) {
      const denied=await f.call('account_write',profile,{confirm:true,dryRun:false});
      expect(denied.isError).toBe(true);
    }
    expect(f.write).not.toHaveBeenCalled();
  });
  it('refuses malformed or undisclosed tool-profile metadata before any invocation',async()=>{
    const f=fixture();
    for(const tool of [{name:'undefined_write',profiles:['full']},
      {name:'wrong_shape',writes:false,profiles:'full'},
      {name:'fake',writes:'false',profiles:['full']}]) {
      expect(isToolAllowed(tool,'full',{allowWrites:true})).toBe(false);
    }
    expect(isToolAllowed(f.tools[0],'admin')).toBe(false);
    expect(visibleTools(null,'full')).toEqual([]);
    expect(f.read).not.toHaveBeenCalled();
  });
  it('publishes only public metadata without internal eligibility fields',()=>{
    const f=fixture();
    const info=publicToolInfo(f.tools[1]);
    expect(info.name).toBe('owner_read');
    expect(info).not.toHaveProperty('profiles');
    expect(info).not.toHaveProperty('writes');
    expect(info).not.toHaveProperty('area');
    expect(info.annotations.readOnlyHint).toBe(true);
    expect(f.tools[1].profiles).toEqual(['full']);
  });
  it('does not authorize inherited or nonfunction handlers with registered metadata',async()=>{
    const f=fixture();
    const denied=await f.call('toString','full');
    expect(denied.isError).toBe(true);
    expect(f.read).not.toHaveBeenCalled();
    expect(f.write).not.toHaveBeenCalled();
  });
});
