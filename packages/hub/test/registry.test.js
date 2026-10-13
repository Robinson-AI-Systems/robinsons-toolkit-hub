import {it,expect,vi} from 'vitest';
import {validateStagedOrigin,stageHubServer,listStagedServers,disableStagedServer} from '../src/registry.js';
const manifest={rtc:1,server:'stripe',prefix:'stripe',modes:['test'],
  profiles:['read_only'],counts:{tools:20,writes:3,money:1}};
const registration={ownerId:'owner1',name:'stripe',prefix:'stripe',
  origin:'https://stripe-mcp-psi.vercel.app',manifest};
it('refuses private, ambiguous and attacker-controlled origins',()=>{
  for(const value of ['http://example.com','https://127.0.0.1','https://localhost',
    'https://foo.local','https://sub.internal','https://evil.example.com@service.vercel.app',
    'https://service.vercel.app/path','https://service.vercel.app?x=1',
    'https://service.vercel.app#x','https://service.vercel.app:1234',
    'https://xn--evil.vercel.app','https://service.vercel.app.','https://service..vercel.app',
    'https://service.vercel.app/','https://user:pass@service.vercel.app',
    'https://10.0.0.1','https://[::1]']) {
    expect(()=>validateStagedOrigin(value),value).toThrow();
  }
  expect(validateStagedOrigin(registration.origin)).toBe(registration.origin);
});
it('only stages owner-verified RTC 1 claims as noncallable',async()=>{
  const query=vi.fn(async()=>({rows:[],rowCount:1})),db={query};
  await expect(stageHubServer(db,registration)).rejects.toThrow();
  expect(query).not.toHaveBeenCalled();
  const stage=await stageHubServer(db,registration,{ownerVerified:true});
  expect(stage).toMatchObject({state:'pending',verified:false,callable:false});
  expect(query.mock.calls[0][0]).toContain("'pending'");
  for(const bad of [{...registration,manifest:{...manifest,rtc:0}},
    {...registration,manifest:{...manifest,prefix:'github'}},
    {...registration,manifest:{...manifest,counts:{tools:-1,writes:0,money:0}}},
    {...registration,name:'hub'}, {...registration,origin:'https://foo.local'}]) {
    await expect(stageHubServer(db,bad,{ownerVerified:true})).rejects.toThrow();
  }
  expect(query).toHaveBeenCalledTimes(1);
});
it('isolates owner listings and disables only owned pending rows',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[{name:'stripe',prefix:'stripe',
    origin:registration.origin,state:'pending',claimed_counts:manifest.counts}]})
    .mockResolvedValueOnce({rowCount:1}).mockResolvedValueOnce({rowCount:0});
  const db={query};
  await expect(listStagedServers(db,'owner1')).rejects.toThrow();
  const entries=await listStagedServers(db,'owner1',{ownerVerified:true});
  expect(entries[0]).toMatchObject({name:'stripe',verified:false,callable:false});
  expect(query.mock.calls[0][1]).toEqual(['owner1']);
  expect(await disableStagedServer(db,{ownerId:'owner1',name:'stripe'},
    {ownerVerified:true})).toBe(true);
  expect(await disableStagedServer(db,{ownerId:'owner2',name:'stripe'},
    {ownerVerified:true})).toBe(false);
  expect(query.mock.calls[2][1]).toEqual(['stripe','owner2']);
});
