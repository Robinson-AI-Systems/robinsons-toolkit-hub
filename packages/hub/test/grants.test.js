import {it,expect,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
import {stageCallerGrant,revokeCallerGrant,listCallerGrants,resolveActiveCallerGrant}
  from '../src/grants.js';
const settings={grantsKey:randomBytes(32).toString('base64url')};
const input={ownerId:'owner-a',serverName:'stripe',callerKind:'pass',
  callerId:'00000000-0000-4000-8000-000000000001',areas:['billing'],
  pass:'rtc_pass_'+randomBytes(32).toString('base64url'),ttlSeconds:300};
it('requires independent owner confirmation and a separate valid key',async()=>{
  const db={query:vi.fn()};
  await expect(stageCallerGrant(db,input,{settings})).rejects.toThrow();
  await expect(stageCallerGrant(db,{...input,areas:[]},
    {settings,ownerVerified:true})).rejects.toThrow();
  await expect(stageCallerGrant(db,{...input,pass:'hub-pass'},
    {settings,ownerVerified:true})).rejects.toThrow();
  await expect(stageCallerGrant(db,input,{settings:{},ownerVerified:true})).rejects.toThrow();
  expect(db.query).not.toHaveBeenCalled();
});
it('encrypts an independent TEST read-only service credential without elevating a writer',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[{profile:'read_only',mode:'test',
    allow_writes:false,areas:['gateway']}]})
    .mockResolvedValueOnce({rows:[{state:'pending'}]})
    .mockResolvedValueOnce({rowCount:1});
  const result=await stageCallerGrant({query},input,{settings,ownerVerified:true});
  expect(result).toMatchObject({state:'staged',callable:false});
  expect(query.mock.calls[2][1][10].toString('utf8')).not.toContain(input.pass);
  expect(query.mock.calls[2][1][13]).toBe(300);
  const bad={query:vi.fn().mockResolvedValue({rows:[{profile:'full',mode:'test',
    allow_writes:true,areas:['gateway']}]})};
  await expect(stageCallerGrant(bad,input,{settings,ownerVerified:true})).rejects.toThrow();
  expect(bad.query).toHaveBeenCalledTimes(2);
});
it('owner grant inspection does not disclose credentials',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[{id:input.callerId,
    server_name:'stripe',caller_kind:'pass',caller_id:input.callerId,
    areas:['billing'],expires_at:new Date(),revoked_at:null}]})
    .mockResolvedValueOnce({rowCount:1});
  const rows=await listCallerGrants({query},'owner-a',{ownerVerified:true});
  expect(JSON.stringify(rows)).not.toContain('rtc_pass_');
  expect(rows[0].callable).toBe(false);
  expect(await revokeCallerGrant({query},{ownerId:'owner-a',id:input.callerId},
    {ownerVerified:true})).toBe(true);
  expect(await resolveActiveCallerGrant({query:vi.fn().mockResolvedValue({rows:[]})},
    {actor:{id:input.callerId,ownerId:'owner-a',areas:['gateway'],mode:'test',
      profile:'read_only',allowWrites:false},serverName:'stripe'},settings)).toBeNull();
});
