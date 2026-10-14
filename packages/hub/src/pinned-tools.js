import {pinnedRtcJsonGet} from './pinned-contract.js';
import {ownsRtcToolName} from './rtc-prefix.js';

const prefixPattern=/^[a-z][a-z0-9_]{1,59}$/;
const areaPattern=/^[a-z][a-z0-9_]{0,59}$/;
const toolPattern=/^[a-z][a-z0-9_]{2,119}$/;
const readOnly={writes:false,money:false,destructive:false};
function expectTarget(target) {
  if(!target||!prefixPattern.test(target.prefix||'')||
    !Array.isArray(target.areas)||target.areas.length===0||
    target.areas.length>32||new Set(target.areas).size!==target.areas.length||
    target.areas.some(a=>!areaPattern.test(a)))throw new TypeError('Invalid scoped RTC target');
}
function withinScope(tool,target,withSchema) {
  if(!tool||typeof tool!=='object'||Array.isArray(tool)||
    !toolPattern.test(tool.name||'')||
    !ownsRtcToolName(target.prefix,tool.name)||
    typeof tool.description!=='string'||tool.description.length>160||
    !areaPattern.test(tool.area||'')||
    !Array.isArray(tool.profiles)||!tool.profiles.includes('read_only')||
    tool.profiles.some(p=>!['read_only','everyday','full'].includes(p)))
    throw new Error('RTC tool metadata or canonical prefix refused');
  // An upstream grant may expose several areas; every advertised entry must
  // still be narrowed to the Hub's exact separately approved grant areas.
  if(!target.areas.includes(tool.area))return null;
  if(Object.keys(readOnly).some(k=>tool[k]!==false)||
    tool.annotations?.readOnlyHint!==true)return null;
  const selected={name:tool.name,description:tool.description,area:tool.area,
    profiles:['read_only'],writes:false,money:false,destructive:false,
    annotations:{readOnlyHint:true}};
  if(withSchema) {
    if(!tool.inputSchema||typeof tool.inputSchema!=='object'||
      Array.isArray(tool.inputSchema))throw new Error('RTC input schema refused');
    selected.inputSchema=tool.inputSchema;
  }
  if(Buffer.byteLength(JSON.stringify(selected),'utf8')>(withSchema?16384:2048))
    throw new Error('RTC tool metadata exceeds safe bound');
  return selected;
}
function validateResponse(data) {
  if(!data||typeof data!=='object'||data.ok!==true||
    !data.result||typeof data.result!=='object')
    throw new Error('RTC metadata request refused');
  return data.result;
}
// This module performs only authenticated GET reads under the sealed RTC
// read_only pass. It cannot execute a tool or forward a Hub bearer.
export async function searchPinnedRtcTools(target,{query='',area,limit=10}={},transport={}) {
  expectTarget(target);
  if(typeof query!=='string'||query.length>120||
    !Number.isInteger(limit)||limit<1||limit>20||
    (area!==undefined&&(!areaPattern.test(area)||!target.areas.includes(area))))
    throw new TypeError('Outside RTC search scope');
  const params=new URLSearchParams({q:query,limit:String(limit)});
  if(area)params.set('area',area);
  const data=validateResponse(await pinnedRtcJsonGet(target.origin,
    '/api/tools?'+params.toString(),{...transport,pass:target.pass}));
  if(!Array.isArray(data.tools)||data.tools.length>limit)
    throw new Error('RTC search result count refused');
  const tools=data.tools.map(t=>withinScope(t,target,false)).filter(Boolean);
  return {tools,next:null,incomplete:data.next!==null&&data.next!==undefined};
}
export async function describePinnedRtcTool(target,name,transport={}) {
  expectTarget(target);
  if(!toolPattern.test(name||'')||!ownsRtcToolName(target.prefix,name))
    throw new TypeError('Tool is not owned by target RTC prefix');
  const data=validateResponse(await pinnedRtcJsonGet(target.origin,
    '/api/tools/'+name,{...transport,pass:target.pass}));
  const result=withinScope(data,target,true);
  if(!result||result.name!==name)
    throw new Error('RTC read-only tool schema not authorized');
  return result;
}
