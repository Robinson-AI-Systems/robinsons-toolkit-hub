import {EventEmitter} from 'node:events';
import {it,expect,vi} from 'vitest';
import {publicIpv4,choosePublicIpv4,probeStagedRtcContract} from '../src/pinned-contract.js';

const origin='https://stripe-mcp-psi.vercel.app';
const identity={name:'stripe',prefix:'stripe'};
const manifest={rtc:1,server:'stripe',prefix:'stripe',
  modes:['test'],profiles:['read_only'],
  counts:{tools:3,writes:1,money:0}};
function simulatedTransport({address='8.8.8.8',answers,status=200,mime='application/json',
  body=manifest}={}) {
  const observations={requestCalls:0,connected:0,lookups:0,options:null};
  const lookup=vi.fn((_hostname,options,callback)=>{
    observations.lookups++;
    expect(options).toEqual({all:true,family:4});
    callback(null,answers??[{address,family:4}]);
  });
  const request=vi.fn((options,onResponse)=>{
    observations.requestCalls++;
    observations.options=options;
    const req=new EventEmitter();
    req.setTimeout=vi.fn();
    req.destroy=vi.fn();
    req.end=()=>{
      options.lookup(options.hostname,{},err=>{
        if(err) {queueMicrotask(()=>req.emit('error',err));return;}
        observations.connected++;
        queueMicrotask(()=>{
          const response=new EventEmitter();
          response.statusCode=status;
          response.headers={'content-type':mime};
          response.resume=vi.fn();
          onResponse(response);
          if(status===200&&mime.startsWith('application/json')) {
            response.emit('data',Buffer.from(
              typeof body==='string'?body:JSON.stringify(body)));
            response.emit('end');
          }
        });
      });
    };
    return req;
  });
  return {lookup,request,observations};
}
it('rejects loopback, private, metadata, test-net, CGNAT and reserved IPs',()=>{
  for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','172.31.255.255',
    '192.168.1.1','169.254.169.254','100.64.0.1','100.127.255.255',
    '192.0.2.1','198.51.100.8','203.0.113.50','198.18.1.1',
    '0.1.2.3','224.0.0.1','255.255.255.255','::ffff:127.0.0.1']) {
    expect(publicIpv4(ip),ip).toBe(false);
  }
  for(const ip of ['1.1.1.1','8.8.8.8','100.63.255.255','172.32.0.1',
    '198.17.255.255','223.255.255.254'])
    expect(publicIpv4(ip),ip).toBe(true);
});
it('pins a single public address and refuses mixed public/private answers',()=>{
  expect(choosePublicIpv4([{address:'8.8.8.8',family:4}])).toBe('8.8.8.8');
  for(const rows of [[],[{address:'8.8.8.8',family:4},
    {address:'127.0.0.1',family:4}],[{address:'::1',family:6}],
    [{address:'8.8.8.8',family:6}],Array(33).fill({address:'8.8.8.8',family:4})])
    expect(()=>choosePublicIpv4(rows)).toThrow();
});
it('checks DNS at connection time and keeps original hostname for TLS',async()=>{
  const t=simulatedTransport();
  const output=await probeStagedRtcContract(origin,identity,t);
  expect(output).toMatchObject({rtc:1,server:'stripe',callable:false,
    networkVerified:true});
  expect(t.observations).toMatchObject({requestCalls:1,lookups:1,connected:1});
  expect(t.observations.options).toMatchObject({hostname:'stripe-mcp-psi.vercel.app',
    port:443,method:'GET',path:'/api/contract',agent:false,
    rejectUnauthorized:true,protocol:'https:'});
  expect(t.observations.options.headers).not.toHaveProperty('authorization');
});
it('refuses invalid origins before DNS or network',async()=>{
  const t=simulatedTransport();
  for(const value of ['http://service.example.org','https://localhost',
    'https://127.0.0.1','https://stripe-mcp-psi.vercel.app/other'])
    await expect(probeStagedRtcContract(value,identity,t)).rejects.toThrow();
  expect(t.observations.requestCalls).toBe(0);
});
it('rejects rebinding to private or mixed DNS before socket establishment',async()=>{
  for(const answers of [[{address:'169.254.169.254',family:4}],
    [{address:'8.8.8.8',family:4},{address:'10.0.0.3',family:4}]]) {
    const t=simulatedTransport({answers});
    await expect(probeStagedRtcContract(origin,identity,t)).rejects.toThrow();
    expect(t.observations.connected).toBe(0);
  }
});
it('refuses redirects, unexpected content, identity or scope mismatches',async()=>{
  for(const setup of [{status:302,mime:'text/plain'},
    {status:200,mime:'text/html'},{body:{...manifest,rtc:0}},
    {body:{...manifest,prefix:'other'}},{body:{...manifest,profiles:['full']}},
    {body:'invalid-json'}]) {
    const t=simulatedTransport(setup);
    await expect(probeStagedRtcContract(origin,identity,t)).rejects.toThrow();
  }
});

it('pins the real canonical Workspace RTC manifest name but not a spoofed alias',async()=>{
 const canonical={name:'google-workspace-mcp',prefix:'workspace'};
 const body={...manifest,server:'google-workspace-mcp',prefix:'workspace'};
 const origin='https://google-workspace-mcp-five.vercel.app';
 const safe=simulatedTransport({body});
 const checked=await probeStagedRtcContract(origin,canonical,safe);
 expect(checked).toMatchObject({server:canonical.name,prefix:'workspace',
  rtc:1,networkVerified:true,callable:false});
 expect(safe.observations.options.hostname).toBe('google-workspace-mcp-five.vercel.app');
 const mismatched=simulatedTransport({body:{...body,server:'google_workspace_mcp'}});
 await expect(probeStagedRtcContract(origin,canonical,mismatched)).rejects.toThrow();
});
