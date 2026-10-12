import {describe,it,expect} from 'vitest';
import {parsePinnedFleetInventory, REQUIRED_RTC_SERVERS, probeRtcFleet} from '../src/fleet-probe.js';
const pinned = {version:1,servers:{stripe:'https://stripe-mcp-psi.vercel.app',
  github:'https://github-mcp-xi.vercel.app', vercel:null, neon:null,
  'google-workspace':'https://google-workspace-mcp-five.vercel.app'}};
describe('reviewed RTC fleet fixed-host registry',()=>{
  it('preserves mandatory custom server slots while probing only valid pinned origins', async()=>{
    const origins=parsePinnedFleetInventory(JSON.stringify(pinned));
    expect(Object.keys(origins)).toEqual(['stripe','github','google-workspace']);
    const called=[];
    const result=await probeRtcFleet({origins,fetchImpl:async url=>{
      called.push(url);
      if(url.includes('stripe')) return new Response(JSON.stringify({
        rtc:1,server:'stripe',prefix:'stripe'
      }),{headers:{'content-type':'application/json'}});
      if(url.includes('github')) return new Response(JSON.stringify({
        rtc:0,server:'github',prefix:'github'
      }),{headers:{'content-type':'application/json'}});
      return new Response('not found',{status:404});
    }});
    expect(called).toHaveLength(3);
    expect(result.checks).toHaveLength(REQUIRED_RTC_SERVERS.length);
    expect(result.checks.find(c=>c.server==='stripe').state).toBe('unverified');
    expect(result.checks.find(c=>c.server==='github').reason).toBe('rtc_1_contract_invalid');
    expect(result.checks.find(c=>c.server==='google-workspace').state).toBe('unavailable');
    expect(result.checks.find(c=>c.server==='vercel').reason).toBe('no_verified_origin');
    expect(result.checks.find(c=>c.server==='neon').reason).toBe('no_verified_origin');
  });
  it('fails closed on omitted mandatory service, extra fields, unsafe target and malformed JSON',()=>{
    const raw=(data)=>JSON.stringify(data);
    for(const modified of [
      {version:1,servers:{stripe:null}},
      {...pinned,unused:true},
      {...pinned,servers:{...pinned.servers,stripe:'https://localhost'}},
      {...pinned,servers:{...pinned.servers,github:42}},
      {...pinned,servers:{...pinned.servers,neon:'http://neon.example.org'}}
    ]) expect(()=>parsePinnedFleetInventory(raw(modified))).toThrow();
    expect(()=>parsePinnedFleetInventory('not json')).toThrow();
    expect(()=>parsePinnedFleetInventory(raw({...pinned,servers:[1,2]}))).toThrow();
  });
  it('supports new owner custom servers without weakening the fixed inventory',()=>{
    const value=parsePinnedFleetInventory(JSON.stringify({...pinned,
      servers:{...pinned.servers,'custom-new':'https://custom-new.org'}}));
    expect(value['custom-new']).toBe('https://custom-new.org');
  });
});
