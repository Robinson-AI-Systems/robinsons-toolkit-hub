// RTC1 permits two equivalent environment vocabularies. Only the provider
// boundary accepts aliases; Hub caller/grant storage stays test/live.
export function rtcMode(value){
 if(value==='test'||value==='preview')return 'test';
 if(value==='live'||value==='production')return 'live';
 throw new TypeError('Unknown RTC environment');
}
export function rtcModes(values){
 if(!Array.isArray(values)||values.length<1||values.length>2)
  throw new TypeError('Invalid RTC environment list');
 const result=values.map(rtcMode);
 // Two labels for the same environment would lose the exact owner choice.
 if(new Set(result).size!==result.length)throw new TypeError('Ambiguous RTC environment mapping');
 return result;
}
