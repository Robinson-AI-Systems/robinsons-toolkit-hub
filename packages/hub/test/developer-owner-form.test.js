import {it,expect,vi} from 'vitest';
import {parse} from 'node:querystring';
import {createHash} from 'node:crypto';
const mocks=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('../src/runtime.js',()=>({withHubDb:fn=>fn({query:mocks.query},{pepper:'synthetic-form-test-pepper-never-live'})}));
import {developerRoute} from '../src/developer-route.js';
it('keeps browser form fields through the real setup route without touching credentials on invalid input',async()=>{
 const previous={...process.env};const setup='f'.repeat(43);
 process.env.HUB_OWNER_ID='synthetic-owner';delete process.env.HUB_OWNER_SCRYPT;
 process.env.HUB_OWNER_SETUP_HASH=createHash('sha256').update(setup).digest('hex');
 process.env.HUB_OWNER_SETUP_EXPIRES=new Date(Date.now()+600000).toISOString();
 mocks.query.mockImplementation(async sql=>({rows:sql.includes('hub_request_limits')?[{hits:1}]:[]}));
 const res={setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;},send(v){this.body=v;return this;}};
 try{
  await developerRoute('setup')({method:'POST',body:parse(new URLSearchParams({setup_token:setup,password:'x',confirmation:'x'}).toString()),socket:{remoteAddress:'127.0.0.1'}},res);
  expect(res.code).toBe(400);expect(res.body).toContain('matching passphrases');
  expect(mocks.query.mock.calls.some(([sql])=>sql.includes('INSERT INTO hub_owner_credentials'))).toBe(false);
 }finally{for(const name of ['HUB_OWNER_ID','HUB_OWNER_SCRYPT','HUB_OWNER_SETUP_HASH','HUB_OWNER_SETUP_EXPIRES']){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}}
});
