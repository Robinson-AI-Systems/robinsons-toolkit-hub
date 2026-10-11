import {describe,expect,it} from 'vitest';
import {isToolAllowed,visibleTools,profileCounts,publicToolInfo} from
  '../../src/core/profiles.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import home from '../../api/index.js';
const setup=()=>{
  let calls=0;
  return {
    registry:{tools:[
      {name:'r_all',writes:false,profiles:['read_only','everyday','full'],inputSchema:{type:'object'}},
      {name:'r_owner',writes:false,profiles:['full'],inputSchema:{type:'object'}},
      {name:'w_everyday',writes:true,profiles:['everyday','full'],inputSchema:{type:'object'}},
      {name:'w_admin',writes:true,profiles:['full'],inputSchema:{type:'object'}}
    ],handlers:{
      r_all:async()=>{calls++;return {content:[{type:'text',text:'{"ok":true}'}]};},
      r_owner:async()=>{calls++;return {content:[{type:'text',text:'{"ok":true}'}]};},
      w_everyday:async()=>{calls++;return {content:[{type:'text',text:'{"ok":true}'}]};},
      w_admin:async()=>{calls++;return {content:[{type:'text',text:'{"ok":true}'}]};}
    }},
    count:()=>calls
  };
};
describe('B-6 profile metadata, name-call and homepage counts',()=>{
  it('read_only never sees money/destructive tools, even when enablement is requested',()=>{
    const {registry}=setup();
    expect(visibleTools(registry,'read_only',{allowWrites:true}).map(x=>x.name)).toEqual(['r_all']);
    expect(isToolAllowed(registry.tools[2],'read_only',{allowWrites:true})).toBe(false);
    expect(visibleTools(registry,'everyday',{allowWrites:true}).map(x=>x.name))
      .toEqual(['r_all','w_everyday']);
    expect(visibleTools(registry,'full',{allowWrites:true}).map(x=>x.name))
      .toEqual(['r_all','r_owner','w_everyday','w_admin']);
  });
  it('current MCP remains read-only even on an everyday or full connection',()=>{
    const {registry}=setup();
    expect(visibleTools(registry,'full').map(x=>x.name)).toEqual(['r_all','r_owner']);
    expect(visibleTools(registry,'everyday').map(x=>x.name)).toEqual(['r_all']);
    expect(profileCounts(registry)).toEqual({read_only:1,everyday:1,full:2});
  });
  it('refuses undeclared/invalid profiles and tools missing explicit writes metadata',()=>{
    expect(isToolAllowed({name:'unclassified',profiles:['full']},'full')).toBe(false);
    expect(isToolAllowed({name:'fake',writes:false,profiles:['full']},'admin')).toBe(false);
    expect(isToolAllowed({name:'fake',writes:false,profiles:'full'},'full')).toBe(false);
    expect(visibleTools(null,'full')).toEqual([]);
  });
  it('never publishes internal capability metadata with listed tools',()=>{
    const tool={name:'read',writes:false,profiles:['read_only'],description:'safe'};
    expect(publicToolInfo(tool)).toMatchObject({name:'read',description:'safe',
      annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true}});
    expect(publicToolInfo(tool)).not.toHaveProperty('writes');
    expect(tool.writes).toBe(false);
  });
  it('hidden tools cannot be invoked by guessing their exact registered names',async()=>{
    const fixture=setup(),db={};
    const tryCall=(name,profile)=>dispatchReadOnlyTool({
      registry:fixture.registry,name,connection:{mode:'test',profile},db,args:{confirm:true}
    });
    expect((await tryCall('r_owner','read_only')).isError).toBe(true);
    expect((await tryCall('w_admin','full')).isError).toBe(true);
    expect((await tryCall('w_everyday','everyday')).isError).toBe(true);
    expect(fixture.count()).toBe(0);
    const response=await tryCall('r_owner','full');
    expect(response.isError).toBeUndefined();
    expect(fixture.count()).toBe(1);
  });
  it('home endpoint publishes true currently usable counts for each profile',()=>{
    let body;
    const res={setHeader:()=>{},status:(code)=>{expect(code).toBe(200);return res;},
      json:value=>{body=value;return res;}};
    home({},res);
    expect(body.profileToolCounts).toEqual({read_only:88,everyday:89,full:92});
    expect(body.tools).toBe(184);
  });
});
