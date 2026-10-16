import {pinnedRtcJsonGet,probeStagedRtcContract} from './pinned-contract.js';

const validArea=/^[a-z][a-z0-9_]{0,59}$/;
export async function inspectScopedRtcIdentity(input,transport={}) {
  const {origin,name,prefix,areas,pass}=input||{};
  if(!Array.isArray(areas)||areas.length===0||areas.length>32||
    areas.some(a=>typeof a!=='string'||!validArea.test(a))||
    new Set(areas).size!==areas.length||
    typeof pass!=='string'||!/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(pass))
    throw new TypeError('Invalid TEST grant inspection inputs');
  // Public contract is uncredentialed; both requests independently pin
  // the socket's DNS answer, with original hostname-bound TLS each time.
  await probeStagedRtcContract(origin,{name,prefix},transport);
  const value=await pinnedRtcJsonGet(origin,'/api/whoami',{...transport,pass});
  const who=value?.result;
  if(value?.ok!==true||!who||who.profile!=='read_only'||
    who.mode!=='test'||who.allowWrites===true||who.allow_writes===true||
    !((who.areas===null&&name==='google-workspace-mcp')||Array.isArray(who.areas))||
    (Array.isArray(who.areas)&&areas.some(a=>!who.areas.includes(a))))
    throw new Error('Upstream TEST read_only grant identity refused');
  // Workspace RTC issues all-areas passes with areas:null; an explicit Hub
  // grant remains a narrower, selected area list and read_only TEST only.
  // Never leak upstream whoami account identifiers, credentials or profile
  // extras into registry, logs or UI. This is still NOT activation.
  return {server:name,prefix,mode:'test',profile:'read_only',
    areas:[...areas],identityVerified:true,callable:false};
}
