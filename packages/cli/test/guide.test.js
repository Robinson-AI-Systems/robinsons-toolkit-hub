import {describe,it,expect,vi} from 'vitest';
import {runGuidedSetting,validateGuidedSetting,launchOwnerGuideBrowser} from '../src/guide.js';
import {runCLI} from '../src/commands.js';

const server={name:'one',url:'https://standalone.example.com',pass:'fixture-pass'};
const readMeta=name=>({ok:true,result:{name,writes:false,money:false,destructive:false,
  annotations:{readOnlyHint:true,destructiveHint:false}}});
const guide={setting:'Enable audit history',url:'https://dashboard.vendor.com/settings/audit',
  steps:[{n:1,action:'Open Settings',target:'Security'},{n:2,action:'Enable',target:'Audit history',value:'On'}],
  expected:'Audit enabled',verifyWith:{tool:'example_read_setting',args:{key:'audit'},field:'state.enabled',equals:true}};
function harness(overrides={}){
  const calls=[],events=[],approval=vi.fn(async()=>true),done=vi.fn(async()=>true);
  const close=vi.fn(async()=>{}),browser=vi.fn(async(url)=>{events.push(['browser',url]);return {close};});
  const request=vi.fn(async(_server,path,opts)=>{
    calls.push({path,opts});
    if(!opts)return readMeta(path.split('/').at(-1));
    if(path.endsWith('_where_is_setting'))return {ok:true,result:structuredClone(guide)};
    return {ok:true,result:{state:{enabled:true}}};
  });
  return {calls,events,approval,done,close,browser,request,
    run:()=>runGuidedSetting({server,setting:'audit',manifest:async()=>({rtc:1,prefix:'example'}),
      request,browser,approve:approval,done,write:x=>events.push(['display',x]),...overrides})};
}
describe('L-4 visible owner-driven setting guide',()=>{
 it('approves each manual step, never types/clicks, then verifies an exact read-only provider response',async()=>{
   const f=harness(),result=await f.run();
   expect(result).toEqual({status:'verified',reason:null,stepsApproved:2,verified:true});
   expect(f.approval).toHaveBeenCalledTimes(3);
   expect(f.done).toHaveBeenCalledTimes(2);
   expect(f.calls.filter(c=>c.opts).map(c=>c.path)).toEqual([
     '/api/tools/example_where_is_setting','/api/tools/example_read_setting']);
   expect(f.calls[1].opts.args).toEqual({query:'audit'});
   expect(f.calls[3].opts.args).toEqual({key:'audit'});
   expect(f.browser).toHaveBeenCalledWith(guide.url);
   expect(f.close).toHaveBeenCalledTimes(1);
   expect(JSON.stringify(f.events)).not.toContain('fixture-pass');
 });
 it('cancellation at origin or a later step prevents subsequent reads and closes any open window',async()=>{
   let f=harness({approve:vi.fn(async()=>false)});
   expect(await f.run()).toEqual({status:'cancelled',stepsApproved:0,verified:false});
   expect(f.browser).not.toHaveBeenCalled();
   expect(f.calls.filter(c=>c.opts)).toHaveLength(1);
   f=harness({approve:vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false)});
   expect((await f.run()).status).toBe('cancelled');
   expect(f.done).toHaveBeenCalledTimes(1);
   expect(f.calls.filter(c=>c.opts)).toHaveLength(1);
   expect(f.close).toHaveBeenCalledTimes(1);
 });
 it('owner acknowledgment is necessary before the next step or provider readback',async()=>{
   const f=harness({done:vi.fn(async()=>false)});
   expect((await f.run()).status).toBe('cancelled');
   expect(f.calls.filter(c=>c.opts)).toHaveLength(1);
   expect(f.close).toHaveBeenCalledTimes(1);
 });
 it('does not claim verified from missing readback, wrong field or provider refusal',async()=>{
   for(const changed of [
     {...guide,verifyWith:undefined},
     {...guide,verifyWith:{...guide.verifyWith,field:'state.absent'}},
   ]){
     const f=harness({request:vi.fn(async(_s,path,opts)=>
       !opts?readMeta(path.split('/').at(-1)):
       path.endsWith('_where_is_setting')?{ok:true,result:changed}:{ok:true,result:{state:{enabled:true}}})});
     const result=await f.run();expect(result.status).toBe('unverified');expect(result.verified).toBe(false);
     expect(f.close).toHaveBeenCalledTimes(1);
   }
   const f=harness({request:vi.fn(async(_s,path,opts)=>{
     if(!opts)return readMeta(path.split('/').at(-1));
     if(path.endsWith('_where_is_setting'))return {ok:true,result:guide};
     throw Error('no read authority');
   })});
   expect((await f.run()).status).toBe('unverified');
 });
 it('never invokes a verifier whose real metadata is write, money or destructive',async()=>{
   for(const mark of [{writes:true},{money:true},{destructive:true},{annotations:{readOnlyHint:false,destructiveHint:false}}]){
     let calls=0;
     const f=harness({request:vi.fn(async(_s,path,opts)=>{
       if(path.endsWith('_where_is_setting'))return opts?{ok:true,result:guide}:readMeta('example_where_is_setting');
       if(!opts)return {ok:true,result:{...readMeta('example_read_setting').result,...mark}};
       calls++;throw Error('unsafe write reached');
     })});
     expect((await f.run()).status).toBe('unverified');
     expect(calls).toBe(0);
   }
 });
 it('rejects untrusted nonpublic links, bad steps, secrets and verifier selector before browser launch',async()=>{
   const bad=[
     {...guide,url:'http://127.0.0.1/admin'},
     {...guide,url:'https://localhost/secret'},
     {...guide,url:'https://dashboard.vendor.com:444/audit'},
     {...guide,url:'https://person:password@dashboard.vendor.com/audit'},
     {...guide,steps:[{n:2,action:'Skip',target:'none'}]},
     {...guide,steps:[{n:1,action:'Click\u001b[31m',target:'Security'}]},
     {...guide,steps:[{n:1,action:'Enter',target:'Password',value:'example'}]},
     {...guide,verifyWith:{tool:'example_update_setting',args:{},field:'state.enabled',equals:{ok:true}}},
     {...guide,verifyWith:{tool:'other_read_secret',args:{},field:'state.enabled',equals:true}}
   ];
   for(const data of bad)expect(()=>validateGuidedSetting(data,'example')).toThrow();
 });
 it('headed Playwright browser has a fresh context; failed launch closes resources',async()=>{
   const close=vi.fn(async()=>{});
   const page={goto:vi.fn(async()=>{})};
   const context={newPage:vi.fn(async()=>page),close};
   const browser={newContext:vi.fn(async()=>context),close};
   const launch=vi.fn(async()=>browser);
   const session=await launchOwnerGuideBrowser('https://dashboard.vendor.com',{load:async()=>({chromium:{launch}})});
   expect(launch.mock.calls[0][0].headless).toBe(false);
   expect(context.newPage).toHaveBeenCalledOnce();expect(page.goto).toHaveBeenCalledOnce();
   await session.close();expect(close).toHaveBeenCalledTimes(2);
   await expect(launchOwnerGuideBrowser('https://dashboard.vendor.com',{load:async()=>{throw Error('unavailable');}}))
     .rejects.toThrow('Visible owner browser unavailable');
 });
 it('CLI routes guide to a named standalone server; cancelled and unverified get distinct exit codes',async()=>{
   const reader=async()=>JSON.stringify({servers:{one:server.url}});
   const output={text:'',write(s){this.text+=s;}};
   const err={write:vi.fn()};
   const keychain={get:async()=>null};
   let called;
   const guideRunner=async value=>{called=value;return {status:'verified',verified:true};};
   expect(await runCLI(['guide','one','audit'],{env:{RTOOL_PASS_ONE:server.pass},
     reader,out:output,err,keychain,guideRunner})).toBe(0);
   expect(called.server.pass).toBe(server.pass);
   expect(called.setting).toBe('audit');
   expect(output.text).toContain('"verified": true');
   for(const [state,code] of [['unverified',3],['cancelled',2]]){
     expect(await runCLI(['guide','one','audit'],{env:{RTOOL_PASS_ONE:server.pass},
       reader,out:output,err,keychain,guideRunner:async()=>({status:state})})).toBe(code);
   }
   expect(await runCLI(['guide','one'],{env:{RTOOL_PASS_ONE:server.pass},
     reader,out:output,err,keychain,guideRunner})).toBe(4);
 });
});
