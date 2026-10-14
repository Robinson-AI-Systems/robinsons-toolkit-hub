import {it,expect,vi} from 'vitest';
import {serverSelection,parseOwnerServerSelection,allowedByHubPass}
  from '../src/server-selection.js';
import {issueHubPass,authenticateHubPass,digestPass} from '../src/identity.js';
import {stageCallerGrant,resolveActiveCallerGrant,listEligibleRtcTargets}
  from '../src/grants.js';
import {randomBytes} from 'node:crypto';
const pepper='h4-synthetic-unit-pepper-must-be-at-least-32';
const settings={grantsKey:randomBytes(32).toString('base64url')};
const callerId='00000000-0000-4000-8000-000000000001';
const valid={ownerId:'owner-a',profile:'read_only',areas:['gateway'],
  mode:'test',allowWrites:false,ttlSeconds:3600,serverNames:['stripe']};
const servicePass='rtc_pass_'+randomBytes(32).toString('base64url');

it('permits only canonical, finite owner server selections and freezes the scope',()=>{
 expect(serverSelection(null)).toBeNull();
 expect(serverSelection([])).toEqual([]);
 const selected=serverSelection(['stripe','workspace']);
 expect(selected).toEqual(['stripe','workspace']);
 expect(Object.isFrozen(selected)).toBe(true);
 expect(parseOwnerServerSelection(' stripe, workspace ')).toEqual(['stripe','workspace']);
 expect(parseOwnerServerSelection('stripe,stripe')).toBeNull();
 for(const invalid of [[],['Stripe'],['stripe','stripe'],['../neon'],
   ['https://example.com'],[''],[1],Array(21).fill('a'),{}]){
   expect(()=>serverSelection(invalid,{required:true})).toThrow();
 }
 expect(allowedByHubPass({serverNames:['stripe']},'stripe')).toBe(true);
 expect(allowedByHubPass({serverNames:['stripe']},'workspace')).toBe(false);
 expect(allowedByHubPass({serverNames:[]},'stripe')).toBe(false);
 expect(allowedByHubPass({serverNames:null},'stripe')).toBe(true);
});
it('owner issuance verifies every selected name is owned before inserting any credential',async()=>{
 const query=vi.fn().mockResolvedValueOnce({rows:[{name:'stripe'}]});
 const db={query};
 await expect(issueHubPass(db,{...valid,serverNames:['stripe','workspace']},
   {pepper,ownerVerified:true})).rejects.toThrow('registered');
 expect(query).toHaveBeenCalledTimes(1);
 const own=vi.fn().mockResolvedValueOnce({rows:[{name:'stripe'}]})
   .mockResolvedValueOnce({rowCount:1});
 const issued=await issueHubPass({query:own},valid,{pepper,ownerVerified:true});
 expect(issued.pass).toMatch(/^rtc_pass_[A-Za-z0-9_-]{43}$/);
 expect(own).toHaveBeenCalledTimes(2);
 expect(own.mock.calls[1][0]).toContain('allowed_servers');
 expect(own.mock.calls[1][1][7]).toEqual(['stripe']);
 expect(JSON.stringify(own.mock.calls)).not.toContain(issued.pass);
 await expect(issueHubPass({query:vi.fn()},valid,{pepper})).rejects.toThrow();
});
it('authenticated pass exposes frozen server scope; legacy exact-grant source remains separate',async()=>{
 const pass='rtc_pass_'+randomBytes(32).toString('base64url');
 const row={id:callerId,owner_id:'owner-a',pass_digest:digestPass(pass,pepper),
  profile:'read_only',allowed_areas:['gateway'],mode:'test',
  allow_writes:false,allowed_servers:['stripe']};
 const query=vi.fn().mockResolvedValue({rows:[row]});
 const actor=await authenticateHubPass({query},'Bearer '+pass,{pepper});
 expect(actor.serverNames).toEqual(['stripe']);
 expect(Object.isFrozen(actor.serverNames)).toBe(true);
 expect(allowedByHubPass(actor,'workspace')).toBe(false);
 const legacy=await authenticateHubPass({query:vi.fn().mockResolvedValue({
   rows:[{...row,allowed_servers:null}]})},'Bearer '+pass,{pepper});
 expect(legacy.serverNames).toBeNull();
 await expect(authenticateHubPass({query:vi.fn().mockResolvedValue({
   rows:[{...row,allowed_servers:['../../secret']}]})},'Bearer '+pass,{pepper}))
   .rejects.toThrow();
});
it('rejects staged grants outside caller selected servers before inspecting service or ciphertext',async()=>{
 const q=vi.fn().mockResolvedValue({rows:[{profile:'read_only',mode:'test',
  allow_writes:false,areas:['gateway'],allowed_servers:['stripe']}]});
 await expect(stageCallerGrant({query:q},{
   ownerId:'owner-a',serverName:'workspace',callerKind:'pass',callerId,
   areas:['billing'],pass:servicePass,ttlSeconds:3600
 },{settings,ownerVerified:true})).rejects.toThrow('scope');
 expect(q).toHaveBeenCalledTimes(1);
});
it('federation refuses mismatched pass/server before SQL or provider metadata and SQL listing is narrowed',async()=>{
 const actor={id:callerId,ownerId:'owner-a',mode:'test',profile:'read_only',
  areas:['gateway'],allowWrites:false,serverNames:['stripe']};
 const query=vi.fn().mockResolvedValue({rows:[]});
 expect(await resolveActiveCallerGrant({query},{actor,serverName:'workspace'},settings))
   .toBeNull();
 expect(query).not.toHaveBeenCalled();
 await listEligibleRtcTargets({query},actor);
 expect(query.mock.calls[0][0]).toContain('s.name=ANY($5)');
 expect(query.mock.calls[0][1][4]).toEqual(['stripe']);
});
