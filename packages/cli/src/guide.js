// Local, owner-operated RTC §11 setting guide. Never a hosted Hub or relay tool.
// Provider steps are DISPLAY DATA, not selectors, browser scripts or write arguments.
import {createInterface} from 'node:readline/promises';
import {isIP} from 'node:net';
import {ToolError} from './http.js';
import {contract} from './http.js';
import {send} from './dispatch.js';

const fail=message=>{throw new ToolError(message);};
const own=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Object.getPrototypeOf(value)===Object.prototype;
const simple=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&
  !/[\x00-\x1f\x7f\u001b]/.test(value)&&
  !/rtc_pass_[A-Za-z0-9_-]{43}|(?:sk|rk)_live_[A-Za-z0-9]{12,}/.test(value);
const field=/^[a-zA-Z][a-zA-Z0-9_]{0,39}(?:\.[a-zA-Z][a-zA-Z0-9_]{0,39}){0,4}$/;
const tool=/^[a-z][a-z0-9_]{2,119}$/;
function checkedUrl(raw) {
  if(!simple(raw,1600))fail('Setting guide returned an unsafe URL');
  let url;
  try{url=new URL(raw);}catch{fail('Setting guide URL is invalid');}
  const hostname=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||
    url.hash||isIP(hostname)||!hostname.includes('.')||hostname==='localhost'||
    hostname.endsWith('.localhost')||hostname.endsWith('.local')||
    hostname.endsWith('.internal')||hostname.endsWith('.test')||
    hostname.endsWith('.example')||hostname.endsWith('.invalid'))
    fail('Setting guide requires a public HTTPS browser origin');
  return url.href;
}
function verifySelector(raw,prefix){
  if(raw===undefined)return null;
  if(!own(raw)||Object.keys(raw).some(k=>!['tool','args','field','equals'].includes(k))||
    !tool.test(raw.tool||'')||!raw.tool.startsWith(prefix+'_')||
    !own(raw.args)||!field.test(raw.field||'')||!Object.hasOwn(raw,'equals')||
    ![null,'string','boolean','number'].includes(raw.equals===null?null:typeof raw.equals)||
    typeof raw.equals==='number'&&!Number.isFinite(raw.equals)||
    typeof raw.equals==='string'&&!simple(raw.equals,120)||
    JSON.stringify(raw.args).length>1800)
    fail('Setting guide returned an invalid readback selector');
  // Blocks caller-controlled prototype manipulation and object coercion.
  if(Object.keys(raw.args).some(k=>!simple(k,80)||['__proto__','constructor','prototype'].includes(k)))
    fail('Setting guide returned unsafe readback arguments');
  return {tool:raw.tool,args:raw.args,field:raw.field,equals:raw.equals};
}
export function validateGuidedSetting(value,prefix){
  if(!own(value)||Object.keys(value).some(k=>!['setting','url','steps','expected','verifyWith'].includes(k))||
    !simple(value.setting,160)||!simple(value.expected,320)||!Array.isArray(value.steps)||
    value.steps.length<1||value.steps.length>20||!/^[a-z][a-z0-9_]{0,59}$/.test(prefix))
    fail('RTC owner setting guide is not a bounded §11 object');
  const url=checkedUrl(value.url);
  const steps=value.steps.map((s,index)=>{
    if(!own(s)||Object.keys(s).some(k=>!['n','action','target','value'].includes(k))||
      s.n!==index+1||!simple(s.action,220)||!simple(s.target,220)||
      (s.value!==undefined&&(!simple(s.value,220)||
        /password|passphrase|secret|token|one.time|2fa|mfa|otp|credential/i.test(s.target))))
      fail('Setting guide contains unsafe or out-of-order steps');
    return {n:s.n,action:s.action,target:s.target,...(s.value===undefined?{}:{value:s.value})};
  });
  return {setting:value.setting,url,steps,expected:value.expected,
    verifyWith:verifySelector(value.verifyWith,prefix)};
}
function unwrap(response){
  if(!response||response.ok!==true||!own(response.result))
    fail('RTC service did not return a structured setting guide');
  return response.result;
}
export async function launchOwnerGuideBrowser(url,{load=()=>import('playwright')}={}){
  let browser,context;
  try{
    const pkg=await load();
    if(typeof pkg?.chromium?.launch!=='function')
      fail('Install Playwright Chromium locally before using a guided browser');
    browser=await pkg.chromium.launch({headless:false,
      args:['--no-first-run','--no-default-browser-check']});
    context=await browser.newContext({acceptDownloads:false,permissions:[],
      ignoreHTTPSErrors:false,serviceWorkers:'block'});
    const page=await context.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:12000});
    // Never inspect DOM, type, click, screenshot, persist browser profile, or
    // replay steps. The owner alone operates this temporary visible window.
    return {close:async()=>{await context.close();await browser.close();}};
  }catch(error){
    if(context)await context.close().catch(()=>{});
    if(browser)await browser.close().catch(()=>{});
    if(error instanceof ToolError)throw error;
    fail('Visible owner browser unavailable; no step was executed by rtool');
  }
}
export async function askOwner(message,{input=process.stdin,output=process.stderr}={}){
  if(!input.isTTY||!output.isTTY)
    fail('Guided settings require an interactive local terminal');
  const rl=createInterface({input,output,terminal:true,historySize:0});
  try{
    const answer=(await rl.question(message+' [y/N]: ')).trim().toLowerCase();
    return answer==='y'||answer==='yes';
  }finally{rl.close();}
}
export async function ownerStepDone(message,{input=process.stdin,output=process.stderr}={}){
  if(!input.isTTY||!output.isTTY)
    fail('Guided settings require an interactive local terminal');
  const rl=createInterface({input,output,terminal:true,historySize:0});
  try{
    const answer=(await rl.question(message+' (type done or cancel): ')).trim().toLowerCase();
    return answer==='done';
  }finally{rl.close();}
}
function checkedReadTool(metadata,name){
  const value=metadata?.result??metadata;
  return own(value)&&value.name===name&&value.writes===false&&value.money===false&&
    value.destructive===false&&value.annotations?.readOnlyHint===true&&
    value.annotations?.destructiveHint===false;
}
function fieldValue(data,path){
  let value=data;
  for(const key of path.split('.')){
    if(!own(value)||!Object.hasOwn(value,key))return {found:false};
    value=value[key];
  }
  return {found:true,value};
}
export async function runGuidedSetting({server,setting,
  request=send,manifest=contract,browser=launchOwnerGuideBrowser,
  approve=askOwner,done=ownerStepDone,write=()=>{}}){
  if(!simple(setting,120)||!server||!server.pass)
    fail('A named RTC server, pass and bounded setting are required');
  const info=await manifest(server.url,server.pass,server.fallback);
  if(!info||info.rtc!==1||!/^[a-z][a-z0-9_]{0,59}$/.test(info.prefix||''))
    fail('RTC 1 setting guide needs an independently conformant server');
  const guideName=info.prefix+'_where_is_setting';
  // Metadata validation precedes even the guide read. A fake readOnlyHint
  // never bypasses the server's own authorization and read-only guard.
  const guideMeta=await request(server,'/api/tools/'+guideName);
  if(!checkedReadTool(guideMeta,guideName))
    fail('Service does not advertise a safe guided-settings read');
  const details=await request(server,'/api/tools/'+guideName,{
    method:'POST',args:{query:setting}});
  const guide=validateGuidedSetting(unwrap(details),info.prefix);
  write('Setting: '+guide.setting+'\nWebsite: '+new URL(guide.url).origin+
    '\nExpected: '+guide.expected+'\n');
  if(!await approve('Open this exact website in an isolated visible browser?'))
    return {status:'cancelled',stepsApproved:0,verified:false};
  let session,approved=0;
  try{
    session=await browser(guide.url);
    for(const step of guide.steps){
      const display='Step '+step.n+': '+step.action+' — '+step.target+
        (step.value===undefined?'':' (value: '+step.value+')');
      write(display+'\n');
      if(!await approve('Approve this step?'))
        return {status:'cancelled',stepsApproved:approved,verified:false};
      approved++;
      if(!await done('Complete step '+step.n+' yourself in the visible browser'))
        return {status:'cancelled',stepsApproved:approved,verified:false};
    }
    // Readback is optional under §11, and its absence is NOT proof of success.
    if(!guide.verifyWith)
      return {status:'unverified',reason:'no_service_readback',stepsApproved:approved,verified:false};
    const select=guide.verifyWith;
    let checked=false;
    try{
      const meta=await request(server,'/api/tools/'+select.tool);
      if(checkedReadTool(meta,select.tool)){
        const response=await request(server,'/api/tools/'+select.tool,{
          method:'POST',args:select.args});
        const found=fieldValue(response?.result,select.field);
        checked=found.found&&Object.is(found.value,select.equals);
      }
    }catch{
      // Preserve the truth: a failed readback cannot declare the owner action done.
    }
    return {status:checked?'verified':'unverified',reason:checked?null:'readback_not_confirmed',
      stepsApproved:approved,verified:checked};
  }finally{
    if(session)await session.close();
  }
}
