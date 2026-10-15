import {it,expect} from 'vitest';
import {ownerServiceProfiles,limitedServiceProfile,
 narrowPassServiceProfile,narrowOAuthServiceProfile,
 listOwnerProfileAudit} from '../src/service-profile-policy.js';
const example={ownerId:'owner',id:'00000000-0000-4000-8000-000000000001',
 serverName:'stripe',profile:'disabled'};
it('caller service ceiling can only reduce the original grant and caller profile',()=>{
 expect(limitedServiceProfile('read_only','full',null,'stripe')).toBe('read_only');
 expect(limitedServiceProfile('read_only','full',
   {stripe:'disabled'},'stripe')).toBeNull();
 expect(limitedServiceProfile('full','everyday',
   {stripe:'read_only'},'stripe')).toBe('read_only');
 expect(limitedServiceProfile('everyday','full',
   {stripe:'everyday'},'stripe')).toBe('everyday');
 expect(limitedServiceProfile('full','full',
   {stripe:'disabled'},'workspace')).toBe('full');
 expect(ownerServiceProfiles({workspace:'disabled',stripe:'read_only'}))
  .toEqual({stripe:'read_only',workspace:'disabled'});
 for(const malformed of [[1],{'..':'disabled'},{stripe:'writer'},
   {stripe:null},{stripe:1},{stripe:'DISABLED'}])
  expect(()=>ownerServiceProfiles(malformed)).toThrow();
 expect(()=>limitedServiceProfile('write','full',null,'stripe')).toThrow();
});
it('never invokes SQL without an exact independently verified owner/profile',async()=>{
 const db={query:()=>{throw Error('Unverified scope reached SQL');}};
 for(const fn of [narrowPassServiceProfile,narrowOAuthServiceProfile]){
  await expect(fn(db,example)).rejects.toThrow();
  for(const altered of [{id:'oops'},{ownerId:'other owner'},
    {serverName:'../stripe'},{profile:'live'},{profile:'full'},
    {profile:''}]) {
   // Full is valid only as a conceptual ceiling but the verified
   // upstream read_only grant SQL later refuses any widening request.
   if(altered.profile==='full')continue;
   await expect(fn(db,{...example,...altered},{ownerVerified:true}))
    .rejects.toThrow();
  }
 }
 await expect(listOwnerProfileAudit(db,'owner')).rejects.toThrow();
 await expect(listOwnerProfileAudit(db,'owner',
  {ownerVerified:true,limit:1000})).rejects.toThrow();
});
