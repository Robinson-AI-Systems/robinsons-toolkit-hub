import {it,expect} from 'vitest';
import {saveDeveloperCheckpoint,restoreDeveloperCheckpoint} from '../src/developer-checkpoint.js';
const record={version:1,status:'connected',profile:'full',origin:'https://custom.example',clientId:'c'.repeat(43),clientSecret:'s'.repeat(43),accessToken:'a'.repeat(43),refreshToken:'r'.repeat(43),expiresAt:1};
function vault(){const records=new Map();return {records,getOAuth:async n=>records.get(n)||null,setOAuth:async(n,r)=>records.set(n,structuredClone(r))};}
it('restores after runner destruction without returning tokens',async()=>{
 const first=vault();await first.setOAuth('custom',record);let external;
 const saved=await saveDeveloperCheckpoint({vault:first,names:['custom'],save:async v=>{external=v;}});
 const second=vault();const result=await restoreDeveloperCheckpoint({vault:second,load:async()=>external,origins:{custom:record.origin}});
 expect(saved).toEqual({saved:['custom']});expect(result).toEqual({restored:['custom'],existing:[]});
 expect(await second.getOAuth('custom')).toEqual(record);expect(JSON.stringify(result)).not.toContain(record.refreshToken);
});
it('never overwrites an already rotated local credential with an older checkpoint',async()=>{
 const v=vault();await v.setOAuth('custom',{...record,refreshToken:'n'.repeat(43)});
 const result=await restoreDeveloperCheckpoint({vault:v,load:async()=>JSON.stringify({version:1,runner:'repo-management',records:{custom:record}}),origins:{custom:record.origin}});
 expect(result.existing).toEqual(['custom']);expect((await v.getOAuth('custom')).refreshToken).toBe('n'.repeat(43));
});
it('rejects foreign origins, pending requests and unsafe aliases before restoration',async()=>{
 for(const records of [{custom:{...record,origin:'https://foreign.example'}},{custom:{...record,status:'pending'}},{'../escape':record}]){
  const v=vault();await expect(restoreDeveloperCheckpoint({vault:v,load:async()=>JSON.stringify({version:1,runner:'repo-management',records}),origins:{custom:record.origin}})).rejects.toThrow();expect(v.records.size).toBe(0);
 }
});
it('redacts storage failures and does not report a failed save as durable',async()=>{
 const v=vault();await v.setOAuth('custom',record);
 await expect(saveDeveloperCheckpoint({vault:v,names:['custom'],save:async()=>{throw Error(record.refreshToken);}})).rejects.toThrow('save failed');
});
