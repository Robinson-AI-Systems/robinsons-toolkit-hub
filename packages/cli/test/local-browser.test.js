import {it,expect,vi} from 'vitest';
import {mkdtemp,mkdir,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalFiles} from '../src/local-files.js';
import {createLocalMcp,localToolCatalog} from '../src/mcp.js';
import {configuredLocalBrowser,playwrightInstalled,guardedVisit,
 invokeLocalBrowser,saveLocalBrowserImage} from '../src/local-browser.js';
const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),
 Buffer.alloc(123,1)]);
const env={RTOOL_BROWSER_ALLOWED_ORIGINS:'https://docs.example.com,https://demo.example.com'};
async function fixture(run){
 const root=await mkdtemp(join(tmpdir(),'rtool-browser-'));
 try{await run({root,env});}
 finally{await rm(root,{recursive:true,force:true});}
}
function fakeBrowser({url='https://docs.example.com/',title='Docs example',
 subresource=null,websocket=false,failAt=null,body='Safe read-only docs'}={}){
 const calls=[],contexts=[],browsers=[];
 const page={
  goto:vi.fn(async target=>{
   calls.push(['goto',target]);
   if(failAt==='goto')throw Error('Navigation refused');
   const route=contexts.at(-1).routeHandler;
   const make=url=>({
    request:()=>({url:()=>url}),
    continue:async()=>{calls.push(['continue',url]);},
    abort:async()=>{calls.push(['abort',url]);}
   });
   await route(make(target));
   if(subresource)await route(make(subresource));
   if(websocket)await contexts.at(-1).wsHandler({
     close:async()=>{calls.push(['websocket-blocked']);}
   });
   return {status:()=>200};
  }),
  url:vi.fn(()=>url),
  title:vi.fn(async()=>title),
  evaluate:vi.fn(async()=>({text:body,links:[
   {url:'https://docs.example.com/guide',text:'Guide'},
   {url:'https://evil.test/leak',text:'Evil link'}
  ]})),
  screenshot:vi.fn(async()=>png)
 };
 const context={
  setDefaultTimeout:vi.fn(),setDefaultNavigationTimeout:vi.fn(),
  route:vi.fn(async(_pattern,fn)=>{context.routeHandler=fn;}),
  routeWebSocket:vi.fn(async(_pattern,fn)=>{context.wsHandler=fn;}),
  newPage:vi.fn(async()=>page),on:vi.fn(),
  close:vi.fn(async()=>{calls.push(['context-closed']);})
 };
 const browser={
  newContext:vi.fn(async options=>{
    calls.push(['context-options',options]);
    contexts.push(context);return context;
  }),
  close:vi.fn(async()=>{calls.push(['browser-closed']);})
 };
 browsers.push(browser);
 return {launch:vi.fn(async()=>browser),browser,context,page,calls,
   contexts,browsers};
}
it('only an explicit exact HTTPS origin or independently configured loopback HTTP is allowed',()=>{
 expect(configuredLocalBrowser({})).toBeNull();
 for(const v of [
  'https://*.example.com','https://docs.example.com/path',
  'https://docs.example.com/','https://docs.example.com,https://docs.example.com',
  'http://public.example.com','ftp://example.com',
  'https://user:pass@docs.example.com','file:///tmp/',
  'https://docs.example.com?x=1'
 ]) expect(configuredLocalBrowser({RTOOL_BROWSER_ALLOWED_ORIGINS:v})).toBeNull();
 expect(configuredLocalBrowser(env)).toEqual([
  'https://docs.example.com','https://demo.example.com']);
 expect(configuredLocalBrowser({RTOOL_BROWSER_ALLOWED_ORIGINS:'http://127.0.0.1:3000'}))
  .toEqual(['http://127.0.0.1:3000']);
 expect(playwrightInstalled({resolvePackage:()=>{throw Error('not installed');}})).toBe(false);
 expect(playwrightInstalled({resolvePackage:()=>'/node_modules/playwright/index.mjs'})).toBe(true);
});
it('local browser only appears when roots, owner origins and Playwright are all explicitly configured',async()=>fixture(async({root})=>{
 const none=localToolCatalog(new Map(),env,null);
 expect(none.tools.some(t=>t.name.startsWith('local.browser_'))).toBe(false);
 const disabled=await createLocalFiles([root],{env,browserAvailable:false});
 expect(disabled.browserConfigured).toBe(false);
 const noAllow=await createLocalFiles([root],{env:{},browserAvailable:true});
 expect(noAllow.browserConfigured).toBe(false);
 for(const local of [disabled,noAllow]){
  const tools=localToolCatalog(new Map(),env,local).tools;
  expect(tools.some(t=>t.name.startsWith('local.browser_'))).toBe(false);
  expect(tools.some(t=>t.name==='local.file_read')).toBe(true);
  expect(tools.some(t=>t.name==='local.git_status')).toBe(true);
 }
 const available=await createLocalFiles([root],{env,browserAvailable:true});
 expect(available.browserConfigured).toBe(true);
 const rpc=createLocalMcp({env,servers:new Map(),localFiles:available});
 const list=await rpc.dispatch({jsonrpc:'2.0',id:1,method:'tools/list'});
 expect(list.result.tools.filter(x=>x.name.startsWith('local.browser_'))).toHaveLength(4);
 const status=await rpc.dispatch({jsonrpc:'2.0',id:2,method:'tools/call',
  params:{name:'local.browser_status',arguments:{}}});
 expect(status.result.structuredContent).toMatchObject({localOnly:true,
  freshContextPerRequest:true,serviceWorkers:'block'});
}));
it('fresh incognito context routes every subresource and blocks websockets before navigation',async()=>{
 const fake=fakeBrowser({websocket:true});
 const result=await guardedVisit(fake.launch,'https://docs.example.com/',
  ['https://docs.example.com'],10000);
 expect(result).toMatchObject({title:'Docs example',text:'Safe read-only docs',
  localOnly:true,blockedWebSockets:1});
 const options=fake.calls.find(x=>x[0]==='context-options')[1];
 expect(options).toMatchObject({serviceWorkers:'block',acceptDownloads:false,
  permissions:[],ignoreHTTPSErrors:false});
 expect(fake.context.route).toHaveBeenCalledBefore(fake.page.goto);
 expect(fake.context.routeWebSocket).toHaveBeenCalledBefore(fake.page.goto);
 expect(fake.calls).toContainEqual(['websocket-blocked']);
 expect(fake.calls.slice(-2)).toEqual([['context-closed'],['browser-closed']]);
});
it('refuses both cross-origin subresources and redirected navigation; always closes resources',async()=>{
 for(const options of [
  {subresource:'https://evil.test/tracker.js'},
  {url:'https://evil.test/final'},
  {failAt:'goto'}
 ]){
  const fake=fakeBrowser(options);
  await expect(guardedVisit(fake.launch,'https://docs.example.com/',
   ['https://docs.example.com'],2000)).rejects.toThrow();
  expect(fake.calls.slice(-2)).toEqual([['context-closed'],['browser-closed']]);
  if(options.subresource)expect(fake.calls).toContainEqual(['abort',options.subresource]);
 }
});
it('extracts only allowed same-origin links and does not return foreign navigation suggestions',async()=>fixture(async({root,env})=>{
 const fake=fakeBrowser();
 const result=await invokeLocalBrowser('local.browser_links',[root],{
  url:'https://docs.example.com/'},{env,launch:fake.launch});
 expect(result.links).toEqual([{url:'https://docs.example.com/guide',text:'Guide'}]);
 expect(JSON.stringify(result)).not.toContain('evil.test');
 for(const url of ['https://evil.test','file:///etc/passwd',
  'https://user:secret@docs.example.com/']){
  await expect(invokeLocalBrowser('local.browser_visit',[root],{url},
   {env,launch:fake.launch})).rejects.toThrow();
 }
 expect(fake.launch).toHaveBeenCalledTimes(1);
}));
it('confirmed screenshot saves PNG once in owner root, never echoes bytes or overwrites',async()=>fixture(async({root,env})=>{
 const fake=fakeBrowser();
 await mkdir(join(root,'shots'));
 const args={url:'https://docs.example.com/',path:'shots/page.png',confirm:true};
 const result=await invokeLocalBrowser('local.browser_screenshot',[root],args,{
  env,launch:fake.launch});
 expect(result).toMatchObject({stored:true,path:'shots/page.png',
  root:0,bytes:png.length,title:'Docs example'});
 expect(await readFile(join(root,'shots/page.png'))).toEqual(png);
 expect(JSON.stringify(result)).not.toContain('89504e47');
 await expect(invokeLocalBrowser('local.browser_screenshot',[root],args,{
  env,launch:fake.launch})).rejects.toThrow();
 await expect(invokeLocalBrowser('local.browser_screenshot',[root],{
  ...args,confirm:false},{env,launch:fake.launch})).rejects.toThrow();
 const outside=await mkdtemp(join(tmpdir(),'rtool-browser-outside-'));
 try{
  await symlink(outside,join(root,'escape'));
  await expect(saveLocalBrowserImage([root],{path:'escape/no.png'},png))
   .rejects.toThrow();
 }finally{await rm(outside,{recursive:true,force:true});}
 for(const path of ['../escape.png','.git/config.png','foo\\bar.png','shots/page.jpg']){
  await expect(saveLocalBrowserImage([root],{path},png)).rejects.toThrow();
 }
}));
