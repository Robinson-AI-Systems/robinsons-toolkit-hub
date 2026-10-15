import {it,expect} from 'vitest';
import {replacementScopeAllowed,completeActiveGrantActivation,
  cancelStagedGrant,listGrantLifecycleAudit,
  reclaimExpiredStagedGrants,listOwnerGrantReadiness,
  revokeOwnerVerifiedGrant} from '../src/grant-lifecycle.js';
const staged={id:'00000000-0000-4000-8000-000000000001',
  owner_id:'owner',server_name:'stripe',areas:['billing']};
it('a renewal can only preserve or narrow a separately verified area scope',()=>{
 expect(replacementScopeAllowed(['billing'],['billing','reports'])).toBe(true);
 expect(replacementScopeAllowed(['billing','reports'],['billing'])).toBe(false);
 expect(replacementScopeAllowed([],['billing'])).toBe(false);
 expect(replacementScopeAllowed(['billing','billing'],['billing'])).toBe(false);
 expect(replacementScopeAllowed(['../bad'],['billing'])).toBe(false);
});
it('refuses missing owner verification and invalid staged scope before SQL',async()=>{
 const db={query:()=>{throw Error('no SQL expected');}};
 await expect(completeActiveGrantActivation(db,{ownerId:'owner',id:staged.id,
  staged,recheckCaller:async()=>{}},{})).rejects.toThrow();
 await expect(completeActiveGrantActivation(db,{ownerId:'owner',id:'wrong',
  staged,recheckCaller:async()=>{}},{ownerVerified:true})).rejects.toThrow();
 await expect(cancelStagedGrant(db,{ownerId:'owner',id:'wrong'},
  {ownerVerified:true})).rejects.toThrow();
 await expect(listGrantLifecycleAudit(db,'owner',{ownerVerified:true,limit:0}))
  .rejects.toThrow();
});

it('bounded owner lifecycle maintenance refuses unverified or too broad access',async()=>{
 const db={query:()=>{throw Error('No SQL should be issued');}};
 await expect(reclaimExpiredStagedGrants(db,'owner')).rejects.toThrow();
 await expect(reclaimExpiredStagedGrants(db,'owner',{ownerVerified:true,limit:0}))
  .rejects.toThrow();
 await expect(listOwnerGrantReadiness(db,'owner',{ownerVerified:true,limit:101}))
  .rejects.toThrow();
});

it('owner grant revocation requires exact owner authentication and UUID',async()=>{
 const db={query:()=>{throw Error('No SQL');}};
 await expect(revokeOwnerVerifiedGrant(db,{ownerId:'owner',
   id:staged.id})).rejects.toThrow();
 await expect(revokeOwnerVerifiedGrant(db,{ownerId:'owner',
   id:'invalid'},{ownerVerified:true})).rejects.toThrow();
});
