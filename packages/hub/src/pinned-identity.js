import {rtcMode} from './rtc-mode.js';
import {pinnedRtcJsonGet,probeStagedRtcContract} from './pinned-contract.js';

const validArea=/^[a-z][a-z0-9_]{0,59}$/;
const profiles=new Set(['read_only','everyday','full']);
/**
 * Inspect the ORIGINAL provider-issued pass through hostname-verifying,
 * socket-time DNS-pinned RTC HTTPS. This never elevates a stored credential.
 * Strict profile/mode agreement is deliberate: a broad issuer credential
 * cannot be mislabeled by the Hub as a narrower one.
 */
export async function inspectScopedRtcIdentity(input,transport={}) {
  const {origin,name,prefix,areas,pass,profile='read_only',mode='test'}=input||{};
  if(!profiles.has(profile)||!['test','live'].includes(mode)||
    !Array.isArray(areas)||areas.length===0||areas.length>32||
    areas.some(a=>typeof a!=='string'||!validArea.test(a))||
    new Set(areas).size!==areas.length||
    typeof pass!=='string'||!/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(pass))
    throw new TypeError('Invalid scoped RTC credential inspection inputs');
  // Public contract is uncredentialed; the provider whoami is from the exact
  // independently issued credential. No mutation or provider tool call.
  const contract=await probeStagedRtcContract(origin,{name,prefix,mode},transport);
  if(!contract.modes.includes(mode))throw Error('RTC environment is not advertised');
  const value=await pinnedRtcJsonGet(origin,'/api/whoami',{...transport,pass});
  const who=value?.result;
  const writable=profile!=='read_only';
  if(value?.ok!==true||!who||who.profile!==profile||rtcMode(who.mode)!==mode||
    (Object.hasOwn(who,'allowWrites')&&Object.hasOwn(who,'allow_writes')&&
     who.allowWrites!==who.allow_writes)||
    (writable && who.allowWrites!==true && who.allow_writes!==true)||
    (!writable && (who.allowWrites===true||who.allow_writes===true))||
    !(Array.isArray(who.areas)||
      (who.areas===null&&name==='google-workspace-mcp'&&
       profile==='read_only'&&mode==='test'))||
    (Array.isArray(who.areas)&&areas.some(a=>!who.areas.includes(a))))
    throw new Error('Upstream scoped RTC credential identity refused');
  return {server:name,prefix,mode,profile,allowWrites:writable,
    areas:[...areas],identityVerified:true,callable:false};
}
