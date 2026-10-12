import {describe,it,expect,vi} from 'vitest';
import {startFakeServer} from '../../conformance/fake-server/server.js';
import {checkRevokedPass,parseRevocationArgs} from '../src/revocation-check.js';
const read=async()=>'{ "servers": {} }';
describe('D-4 explicit revoked TEST pass acceptance',()=>{
  it('demands real explicit pass_revoked 401 from custom RTC host',async()=>{
    const fake=await startFakeServer();
    try {
      let output='';
      const env={RTOOL_SERVERS:'fake='+fake.url,TEST_REVOKED_PASS:fake.passes.revoked};
      const result=await checkRevokedPass({server:'fake',passEnv:'TEST_REVOKED_PASS',
        env,reader:read,write:x=>{output=x;}});
      expect(result).toBe(0);
      expect(JSON.parse(output)).toMatchObject({
        state:'ready',revocationVerified:true,route:'direct',httpStatus:401,fullAcceptance:false
      });
      expect(output).not.toContain(fake.passes.revoked);
      expect(fake.state.changes).toHaveLength(0);
    } finally {await fake.close();}
  });
  it('refuses a valid, expired or unknown credential as revocation evidence',async()=>{
    const fake=await startFakeServer();
    try {
      for(const pass of [fake.passes.readOnly, fake.passes.expired,
        'rtc_pass_'+'Z'.repeat(43)]) {
        let output='';
        expect(await checkRevokedPass({server:'fake',passEnv:'TEST_PASS',
          env:{RTOOL_SERVERS:'fake='+fake.url,TEST_PASS:pass},reader:read,
          write:x=>{output=x;}})).toBe(1);
        expect(JSON.parse(output).revocationVerified).toBe(false);
        expect(output).not.toContain(pass);
      }
    } finally {await fake.close();}
  });
  it('refuses impersonated revocation on an HTML login or proxy 401',async()=>{
    const fake=await startFakeServer();
    try {
      const env={RTOOL_SERVERS:'fake='+fake.url,TEST_PASS:fake.passes.revoked};
      for(const response of [
        new Response('login',{status:401,headers:{'content-type':'text/html'}}),
        new Response(JSON.stringify({ok:false,error:{code:'permission'}}),
          {status:401,headers:{'content-type':'application/json'}}),
        new Response(JSON.stringify({ok:false,error:{code:'pass_revoked'}}),
          {status:403,headers:{'content-type':'application/json'}}),
        new Response(JSON.stringify({ok:true,result:{profile:'read_only'}}),
          {headers:{'content-type':'application/json'}})
      ]) {
        let output='';
        expect(await checkRevokedPass({server:'fake',passEnv:'TEST_PASS',env,reader:read,
          fetchImpl:async()=>response,write:x=>{output=x;}})).toBe(1);
        expect(JSON.parse(output).revocationVerified).toBe(false);
      }
    } finally {await fake.close();}
  });
  it('guards off-loopback targets behind owner opt-in and never sends a missing pass',async()=>{
    const real='https://example.org';const network=vi.fn(async()=>{throw Error('secret');});
    let output='';
    expect(await checkRevokedPass({server:'stripe',passEnv:'REV_PASS',
      env:{RTOOL_SERVERS:'stripe='+real,REV_PASS:'rtc_pass_'+'A'.repeat(43)},
      reader:read,fetchImpl:network,write:x=>{output=x;}})).toBe(1);
    expect(JSON.parse(output)).toMatchObject({state:'blocked',reason:'owner_authorization_required'});
    expect(network).not.toHaveBeenCalled();
    expect(await checkRevokedPass({server:'stripe',passEnv:'REV_PASS',
      authorizedRealRun:true,env:{RTOOL_SERVERS:'stripe='+real},reader:read,
      fetchImpl:network,write:x=>{output=x;}})).toBe(1);
    expect(network).not.toHaveBeenCalled();
  });
  it('never lets CLI positional pass values or duplicate options enter the invocation',()=>{
    expect(parseRevocationArgs(['--server','stripe','--pass-env','TEMP_PASS',
      '--authorized-revoked-test'])).toEqual({
        server:'stripe',passEnv:'TEMP_PASS',authorizedRealRun:true
      });
    expect(()=>parseRevocationArgs(['--server','stripe','--pass','rawvalue'])).toThrow();
    expect(()=>parseRevocationArgs(['--server','stripe','--pass-env','TEMP_PASS',
      '--server','github'])).toThrow();
    expect(()=>parseRevocationArgs(['--server','stripe','--pass-env','bad_env'])).toThrow();
  });
});
