import { describe, it, expect } from 'vitest';
import { startFakeServer } from '../../conformance/fake-server/server.js';
import { checkAgent } from '../src/agent-check.js';

describe('D-4 TEST-only real-agent verification', () => {
  it.each(['live','production','preview','sandbox',null])(
    'refuses mode %s before any provider tool or metadata call', async mode => {
      const fake = await startFakeServer();
      const originalFetch = globalThis.fetch;
      let observedTools = 0;
      const pass = fake.passes.readOnly;
      try {
        globalThis.fetch = async (url, init) => {
          const path = new URL(url).pathname;
          if (path.startsWith('/api/tools/')) observedTools++;
          if (path === '/api/whoami') {
            const identity = { profile:'read_only' };
            if (mode !== null) identity.mode = mode;
            return new Response(JSON.stringify({ok:true,result:identity}), {
              headers:{'content-type':'application/json'}
            });
          }
          return originalFetch(url,init);
        };
        let printed = '';
        const exit = await checkAgent({
          server:'fake', readTool:'fake_read_record', passEnv:'TEMP_TEST_PASS',
          env:{ RTOOL_SERVERS:'fake='+fake.url, TEMP_TEST_PASS:pass },
          write: value => { printed = value; }
        });
        expect(exit).toBe(1);
        expect(JSON.parse(printed)).toMatchObject({
          ok:false,code:'test_mode_required'
        });
        expect(printed).not.toContain(pass);
        expect(observedTools).toBe(0);
        expect(fake.state.changes).toHaveLength(0);
      } finally {
        globalThis.fetch = originalFetch;
        await fake.close();
      }
    }
  );
  it('accepts an actual reported TEST identity while withholding real-route certification', async () => {
    const fake=await startFakeServer();
    try {
      let printed='';
      const exit=await checkAgent({
        server:'fake',readTool:'fake_read_record',passEnv:'TEMP_TEST_PASS',
        env:{RTOOL_SERVERS:'fake='+fake.url,TEMP_TEST_PASS:fake.passes.readOnly},
        write:value=>{printed=value;}
      });
      const result=JSON.parse(printed);
      expect(exit).toBe(0);
      expect(result).toMatchObject({ok:true,route:'direct',code:'verified'});
      expect(result.checks).toContain('test_mode');
      expect(printed).not.toContain(fake.passes.readOnly);
      expect(fake.state.changes).toHaveLength(0);
    } finally { await fake.close(); }
  });
});
