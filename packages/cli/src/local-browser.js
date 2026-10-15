// L-3 opt-in local Playwright Chromium. Never exposed by hosted Hub/relay.
// A fresh incognito headless browser is launched only after local owner
// configuration; it cannot reuse the owner browser's cookies or profile.
import {constants} from 'node:fs';
import {open,realpath,link,unlink} from 'node:fs/promises';
import {basename,dirname,isAbsolute,resolve,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ToolError} from './http.js';
const fail=(message='Local browser operation refused')=>{
 throw new ToolError(message,-32602);
};
const MAX_PNG=512*1024,MAX_TEXT=4096,MAX_LINKS=20;
const URL_MAX=1600,ORIGINS_MAX=8;
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.getPrototypeOf(value)===Object.prototype;
const ascii=value=>typeof value==='string'&&!/[\x00-\x1f\x7f]/.test(value);
const loopback=new Set(['localhost','127.0.0.1','[::1]']);
function origin(value){
 if(!ascii(value)||value.length>180||value.length<10)fail();
 let url;
 try{url=new URL(value);}catch{fail();}
 if(url.origin!==value||url.username||url.password||url.pathname!=='/'||
   url.search||url.hash||
   !(url.protocol==='https:'||
      (url.protocol==='http:'&&loopback.has(url.hostname))))fail();
 return url.origin;
}
export function configuredLocalBrowser(env=process.env) {
 const raw=env?.RTOOL_BROWSER_ALLOWED_ORIGINS;
 if(!ascii(raw)||raw.length>1450||!raw)return null;
 try {
  const origins=raw.split(',');
  if(origins.length<1||origins.length>ORIGINS_MAX)return null;
  const result=origins.map(value=>origin(value));
  if(new Set(result).size!==result.length)return null;
  return Object.freeze(result);
 }catch{return null;}
}
export function playwrightInstalled({resolvePackage=()=>import.meta.resolve('playwright')}={}) {
 try{return typeof resolvePackage()==='string';}
 catch{return false;}
}
const tools=[
 ['status','Inspect configured exact browser origins without opening a page.',{},[],true],
 ['visit','Read a bounded title and text from one owner-allowed origin.',
  {url:{type:'string',minLength:12,maxLength:URL_MAX},
   timeoutMs:{type:'integer',minimum:1000,maximum:15000}},['url'],true],
 ['links','List at most 20 exact-origin links from one allowed page.',
  {url:{type:'string',minLength:12,maxLength:URL_MAX},
   timeoutMs:{type:'integer',minimum:1000,maximum:15000}},['url'],true],
 ['screenshot','Capture one allowed page into a new private approved-root PNG file, never return image bytes.',
  {url:{type:'string',minLength:12,maxLength:URL_MAX},
   timeoutMs:{type:'integer',minimum:1000,maximum:15000},
   root:{type:'integer',minimum:0},
   path:{type:'string',minLength:1,maxLength:1024},
   confirm:{type:'boolean',const:true}},['url','path','confirm'],false]
];
export const LOCAL_BROWSER_TOOLS=Object.freeze(tools.map(([suffix,description,properties,required,readOnly])=>
 Object.freeze({name:'local.browser_'+suffix,description,
  inputSchema:{type:'object',properties,required,additionalProperties:false},
  annotations:{readOnlyHint:readOnly,destructiveHint:false,
   idempotentHint:false,openWorldHint:true}})));
function checkedPageURL(value,origins) {
 if(!ascii(value)||value.length>URL_MAX||!value)fail();
 let url;
 try{url=new URL(value);}catch{fail();}
 if(url.username||url.password||!origins.includes(url.origin)||
   !['https:','http:'].includes(url.protocol))fail('Browser URL is not an approved exact origin');
 return url.toString();
}
const checkedArgs=(name,args,roots)=>{
 if(!plain(args))fail();
 const keys=name==='local.browser_status'?[]:
   name==='local.browser_screenshot'?['url','timeoutMs','root','path','confirm']:
   ['url','timeoutMs'];
 if(Object.keys(args).some(k=>!keys.includes(k)))fail();
 if(name==='local.browser_status')return {timeoutMs:0};
 const timeoutMs=args.timeoutMs??10000;
 if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>15000)fail();
 if(name!=='local.browser_screenshot'){
   if(args.path!==undefined||args.root!==undefined||args.confirm!==undefined)fail();
 }else{
   if(args.confirm!==true||typeof args.path!=='string'||
     !Number.isInteger(args.root??0)||args.root<0||
     (args.root??0)>=roots.length)fail();
 }
 return {timeoutMs,root:args.root??0};
};
function scopedRelativePath(value){
 if(!ascii(value)||!value||value.length>1024||isAbsolute(value)||
   value.includes('\\')||/^[A-Za-z]:/.test(value))fail();
 const parts=value.split('/');
 if(parts.some(p=>!p||p==='.'||p==='..'||p.toLowerCase()==='.git'||
   p.startsWith('.rtool-')))fail();
 if(!value.toLowerCase().endsWith('.png'))fail();
 return value;
}
const within=(root,target)=>target===root||target.startsWith(root+sep);
export async function saveLocalBrowserImage(roots,args,bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length>MAX_PNG||bytes.length<8||
   bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')fail();
 const index=args.root??0;
 if(!Number.isInteger(index)||index<0||index>=roots.length)fail();
 const rel=scopedRelativePath(args.path),root=roots[index];
 let parent;
 try{parent=await realpath(resolve(root,dirname(rel)));}
 catch{fail();}
 if(!within(root,parent))fail();
 const target=resolve(parent,basename(rel)),staging=resolve(parent,
   '.rtool-browser-'+randomBytes(16).toString('hex'));
 if(!within(root,target))fail();
 let handle,staged=false;
 try{
   handle=await open(staging,constants.O_CREAT|constants.O_EXCL|
     constants.O_NOFOLLOW|constants.O_WRONLY,0o600);
   staged=true;await handle.writeFile(bytes);await handle.sync();
   await handle.close();handle=null;
   // Link is atomic create-only: never clobber an existing owner file.
   await link(staging,target);await unlink(staging);staged=false;
 }catch{fail();}
 finally{if(handle)await handle.close();if(staged)await unlink(staging).catch(()=>{});}
 return {stored:true,root:index,path:rel,bytes:bytes.length};
}
export async function launchLocalChromium() {
 // No install or background fetch. The owner must install Playwright and
 // its matching Chromium locally before this capability is advertised.
 let installed;
 try{installed=await import('playwright');}
 catch{fail('Playwright is not installed locally');}
 const chromium=installed.chromium;
 if(!chromium||typeof chromium.launch!=='function')fail();
 return chromium.launch({headless:true,args:[
   '--disable-background-networking','--no-first-run','--no-default-browser-check'
 ]});
}
function viewport(){return {width:1024,height:768};}
export async function guardedVisit(launch,target,origins,timeoutMs,
 {includeLinks=false,screenshot=false}={}){
 let browser,context;
 let blocked=false,blockedWebSockets=0;
 try{
  browser=await launch();
  context=await browser.newContext({
   serviceWorkers:'block',acceptDownloads:false,permissions:[],
   ignoreHTTPSErrors:false,javaScriptEnabled:true,
   viewport:viewport(),deviceScaleFactor:1
  });
  context.setDefaultTimeout(timeoutMs);
  context.setDefaultNavigationTimeout(timeoutMs);
  await context.route('**/*',async route=>{
   let approved=false;
   try{const request=route.request();
    approved=['GET','HEAD'].includes(request.method())&&
      origins.includes(new URL(request.url()).origin);}
   catch{approved=false;}
   if(!approved){blocked=true;await route.abort('blockedbyclient');}
   else await route.continue();
  });
  if(typeof context.routeWebSocket!=='function')fail();
  await context.routeWebSocket('**/*',async websocket=>{
   blockedWebSockets++;await websocket.close();
  });
  const page=await context.newPage();
  context.on('page',other=>{
   if(other!==page)other.close().catch(()=>{});
  });
  const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:timeoutMs});
  const finalUrl=page.url();
  if(!origins.includes(new URL(finalUrl).origin)||blocked)
   fail('Browser refused a disallowed navigation or subresource origin');
  const status=response?.status?.();
  if(!Number.isInteger(status)||status<200||status>=400)fail();
  const title=(await page.title()).slice(0,160);
  const result={url:finalUrl,title,status,blockedWebSockets,localOnly:true};
  if(screenshot){
   const image=await page.screenshot({type:'png',fullPage:false,
     animations:'disabled',timeout:timeoutMs});
   if(!Buffer.isBuffer(image)||image.length>MAX_PNG)fail();
   return {...result,image};
  }
  const details=await page.evaluate(()=>({
   text:(document.body?.innerText??'').slice(0,4096),
   links:Array.from(document.querySelectorAll('a[href]')).slice(0,100)
    .map(anchor=>({url:anchor.href,text:(anchor.textContent??'').slice(0,120)}))
  }));
  if(!plain(details)||typeof details.text!=='string'||!Array.isArray(details.links))fail();
  if(includeLinks) {
   const links=details.links.filter(item=>{
    if(!plain(item)||typeof item.url!=='string')return false;
    try{return origins.includes(new URL(item.url).origin);}
    catch{return false;}
   }).slice(0,MAX_LINKS).map(item=>({
    url:item.url,text:typeof item.text==='string'?item.text.slice(0,120):''
   }));
   return {...result,links,hasMore:details.links.length>MAX_LINKS};
  }
  return {...result,text:details.text.slice(0,MAX_TEXT)};
 }catch(error){
  if(error instanceof ToolError)throw error;
  fail('Local browser navigation refused or unavailable');
 }finally{
  if(context)await context.close().catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
 }
}
export async function invokeLocalBrowser(name,roots,args={},
 {env=process.env,launch=launchLocalChromium,
 save=saveLocalBrowserImage}={}){
 const origins=configuredLocalBrowser(env);
 if(!origins)fail('Local browser origin allowlist not configured');
 if(!LOCAL_BROWSER_TOOLS.some(x=>x.name===name))fail();
 const options=checkedArgs(name,args,roots);
 if(name==='local.browser_status')
  return {available:true,origins:[...origins],localOnly:true,
   freshContextPerRequest:true,serviceWorkers:'block',webSockets:'blocked'};
 const target=checkedPageURL(args.url,origins);
 if(name==='local.browser_screenshot')
  scopedRelativePath(args.path);
 const result=await guardedVisit(launch,target,origins,options.timeoutMs,{
  includeLinks:name==='local.browser_links',
  screenshot:name==='local.browser_screenshot'
 });
 if(name!=='local.browser_screenshot')return result;
 const stored=await save(roots,{root:options.root,path:args.path},result.image);
 return {url:result.url,title:result.title,status:result.status,localOnly:true,
  ...stored};
}
