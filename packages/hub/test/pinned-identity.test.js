import {EventEmitter} from 'node:events';
import {it,expect,vi} from 'vitest';
import {inspectScopedRtcIdentity} from '../src/pinned-identity.js';
import {pinnedRtcJsonGet} from '../src/pinned-contract.js';

const origin='https://stripe-mcp-psi.vercel.app';
const input={origin,name:'stripe',prefix:'stripe',
  areas:['billing'],pass:'rtc_pass_'+('A'.repeat(43))};
const manifest={rtc:1,server:'stripe',prefix:'stripe',modes:['test'],
  profiles:['read_only'],counts:{tools:5,writes:1,money:0}};
function transport({who={ok:true,result:{profile:'read_only',mode:'test',
  areas:['billing'],allowWrites:false}},rtc=manifest}={}) {
  const calls=[];
  return {calls,lookup:(_host,_opts,done)=>done(null,[{family:4,address:'8.8.8.8'}]),
    request:(opts,onResponse)=>{
      calls.push(opts);
      const req=new EventEmitter();
      req.setTimeout=vi.fn();
      req.destroy=vi.fn();
      req.end=()=>opts.lookup(opts.hostname,{},err=>{
        if(err){queueMicrotask(()=>req.emit('error',err));return;}
        queueMicrotask(()=>{
          const res=new EventEmitter();
          res.statusCode=200;
          res.headers={'content-type':'application/json'};
          res.resume=vi.fn();
          onResponse(res);
          res.emit('data',Buffer.from(JSON.stringify(opts.path==='/api/contract'?rtc:who)));
          res.emit('end');
        });
      });
      return req;
    }};
}
it('denies arbitrary paths, credential on public contract, or uncredentialed identity',async()=>{
  const t=transport();
  for(const [path,pass] of [['/api/other',undefined],['/api/contract',input.pass],
    ['/api/whoami',undefined],['/api/whoami','invalid']])
    await expect(pinnedRtcJsonGet(origin,path,{...t,pass})).rejects.toThrow();
  expect(t.calls).toHaveLength(0);
});
it('re-pins both contract and whoami, only sends the upstream pass to whoami',async()=>{
  const t=transport();
  const result=await inspectScopedRtcIdentity(input,t);
  expect(result).toEqual({server:'stripe',prefix:'stripe',mode:'test',
    profile:'read_only',allowWrites:false,areas:['billing'],identityVerified:true,callable:false});
  expect(t.calls.map(x=>x.path)).toEqual(['/api/contract','/api/whoami']);
  expect(t.calls[0].headers).not.toHaveProperty('authorization');
  expect(t.calls[1].headers.authorization).toBe('Bearer '+input.pass);
  expect(t.calls.every(x=>x.agent===false&&x.rejectUnauthorized===true)).toBe(true);
  expect(JSON.stringify(result)).not.toContain(input.pass);
});
it('denies absent/mismatched mode, profile, area and insecure identity',async()=>{
  for(const who of [{ok:false,error:{code:'pass_revoked'}},
    {ok:true,result:{mode:'live',profile:'read_only',areas:['billing']}},
    {ok:true,result:{mode:'test',profile:'full',areas:['billing']}},
    {ok:true,result:{mode:'test',profile:'read_only',areas:['other']}},
    {ok:true,result:{mode:'test',profile:'read_only',areas:['billing'],allow_writes:true}}]) {
    await expect(inspectScopedRtcIdentity(input,transport({who}))).rejects.toThrow();
  }
  await expect(inspectScopedRtcIdentity(input,transport({rtc:{...manifest,rtc:0}})))
    .rejects.toThrow();
});
it('does not issue any remote request for malformed grant or areas',async()=>{
  for(const variant of [{...input,areas:[]},{...input,areas:['billing','billing']},
    {...input,areas:['BILLING']},{...input,pass:'wrong'}]) {
    const t=transport();
    await expect(inspectScopedRtcIdentity(variant,t)).rejects.toThrow();
    expect(t.calls).toHaveLength(0);
  }
});
it('accepts Workspace all-areas TEST grants while rejecting null for unrelated providers',async()=>{
 const w={origin:'https://google-workspace-mcp-chris-projects-de6cd1bf.vercel.app',
  name:'google-workspace-mcp',prefix:'workspace',
  areas:['mail','files'],pass:input.pass};
 const who={ok:true,result:{profile:'read_only',mode:'test',
  allow_writes:false,areas:null}};
 const t=transport({who,rtc:{...manifest,server:w.name,prefix:w.prefix}});
 const result=await inspectScopedRtcIdentity(w,t);
 expect(result).toMatchObject({server:w.name,profile:'read_only',
  areas:['mail','files'],identityVerified:true,callable:false});
 expect(t.calls.map(c=>c.path)).toEqual(['/api/contract','/api/whoami']);
 await expect(inspectScopedRtcIdentity(input,transport({who}))).rejects.toThrow();
});

it('verifies original preview/production whoami only against its equivalent Hub environment',async()=>{
 for(const [providerMode,mode] of [['preview','test'],['production','live']]){
  const who={ok:true,result:{profile:'read_only',mode:providerMode,areas:['billing'],allowWrites:false}};
  const rtc={...manifest,modes:['preview','production']};
  const good=transport({who,rtc});
  expect(await inspectScopedRtcIdentity({...input,mode},good)).toMatchObject({mode,identityVerified:true});
  expect(good.calls).toHaveLength(2);
  await expect(inspectScopedRtcIdentity({...input,mode:mode==='test'?'live':'test'},transport({who,rtc}))).rejects.toThrow();
 }
 const denied=transport({rtc:{...manifest,modes:['production']}});
 await expect(inspectScopedRtcIdentity(input,denied)).rejects.toThrow();
 expect(denied.calls.map(c=>c.path)).toEqual(['/api/contract']);
});
