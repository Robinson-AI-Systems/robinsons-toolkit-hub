import { describe, expect, it } from 'vitest';
import { isToolAllowed, visibleTools, profileCounts, publicToolInfo } from '../src/profiles.js';
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

describe('extracted profile visibility functions (same Stripe assertion bodies)', () => {
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
});
