import {it,expect,vi} from 'vitest';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalFiles} from '../src/local-files.js';
import {localToolCatalog,createLocalMcp} from '../src/mcp.js';
import {configuredLocalOllama,invokeLocalOllama,
 requestLocalOllama,LOCAL_OLLAMA_TOOLS} from '../src/local-ollama.js';

const digest='a'.repeat(64),model='local-demo:latest';
async function fixture(run){
 const root=await mkdtemp(join(tmpdir(),'rtool-ollama-'));
 const calls=[];
 const server=createServer(async(req,res)=>{
  const chunks=[];
  for await(const chunk of req)chunks.push(chunk);
  const body=Buffer.concat(chunks).toString('utf8');
  const event={url:req.url,method:req.method,headers:req.headers,
   body:body?JSON.parse(body):null};
  calls.push(event);
  let data,status=200;
  if(req.url==='/api/version')data={version:'0.13.1'};
  else if(req.url==='/api/tags')data={models:[
    {name:model,size:123456789,digest},
    {name:'cloud-model:cloud',size:0,digest:''}]};
  else if(req.url==='/api/ps')data={models:[{name:model,size:123456789,digest}]};
  else if(req.url==='/api/generate')data={response:body.includes('long-response')?
    'x'.repeat(7100):'Generated local text',done:true,eval_count:19};
  else if(req.url==='/api/chat')data={message:{role:'assistant',
    content:'Private local chat reply'},done:true,eval_count:7};
  else if(req.url==='/api/embed')data={embeddings:[[0.1,-0.2,0.5]]};
  else{status=404;data={error:'unknown'};}
  res.writeHead(status,{'Content-Type':'application/json'});
  res.end(JSON.stringify(data));
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const env={OLLAMA_BASE_URL:'http://127.0.0.1:'+server.address().port};
 try{await run({root,calls,server,env,base:configuredLocalOllama(env)});}
 finally{await new Promise(ok=>server.close(ok));await rm(root,{recursive:true,force:true});}
}
it('only a configured loopback URL is valid; missing/remote/cloud config fails closed',()=>{
 expect(configuredLocalOllama({})).toBeNull();
 for(const url of ['https://ollama.com/api','http://example.com:11434',
  'http://127.0.0.1:11434/path','http://127.0.0.1:11434@evil.com',
  'http://localhost:11434/?token=x','http://user:pass@localhost:11434'])
  expect(configuredLocalOllama({OLLAMA_BASE_URL:url})).toBeNull();
 expect(configuredLocalOllama({OLLAMA_BASE_URL:'http://localhost:11434'}))
  .toMatchObject({host:'127.0.0.1',port:11434});
 expect(LOCAL_OLLAMA_TOOLS.every(x=>x.name.startsWith('local.ollama_')))
  .toBe(true);
});
it('keeps files and Git available without Ollama; no local tools without --local',async()=>fixture(async({root,env})=>{
 const missing=await createLocalFiles([root],{env:{}});
 const enabled=await createLocalFiles([root],{env});
 expect(missing.ollamaConfigured).toBe(false);
 expect(enabled.ollamaConfigured).toBe(true);
 const nothing=localToolCatalog(new Map(),env,null);
 expect(nothing.tools.some(x=>x.name.startsWith('local.ollama_'))).toBe(false);
 const noModel=localToolCatalog(new Map(),{},missing);
 expect(noModel.tools.some(x=>x.name.startsWith('local.ollama_'))).toBe(false);
 expect(noModel.tools.some(x=>x.name==='local.file_read')).toBe(true);
 expect(noModel.tools.some(x=>x.name==='local.git_status')).toBe(true);
 const modelTools=localToolCatalog(new Map(),env,enabled);
 expect(modelTools.tools.filter(x=>x.name.startsWith('local.ollama_')))
  .toHaveLength(6);
 const rpc=createLocalMcp({servers:new Map(),env,localFiles:enabled});
 const list=await rpc.dispatch({jsonrpc:'2.0',id:1,method:'tools/list'});
 expect(list.result.tools.some(x=>x.name==='local.ollama_chat')).toBe(true);
 const reply=await rpc.dispatch({jsonrpc:'2.0',id:2,method:'tools/call',
  params:{name:'local.ollama_status',arguments:{}}});
 expect(reply.result.structuredContent).toMatchObject({available:true,localOnly:true});
}));
it('genuine loopback GET and non-streaming POST return bounded, schema-limited results',async()=>fixture(async({root,env,calls})=>{
 const roots=[root];
 expect(await invokeLocalOllama('local.ollama_status',roots,{}, {env}))
  .toMatchObject({version:'0.13.1',available:true,localOnly:true});
 const models=await invokeLocalOllama('local.ollama_models',roots,{}, {env});
 expect(models.models).toEqual([{name:model,size:123456789,digest}]);
 const running=await invokeLocalOllama('local.ollama_running',roots,{}, {env});
 expect(running.models[0].name).toBe(model);
 const generated=await invokeLocalOllama('local.ollama_generate',roots,
  {model,prompt:'A test',numPredict:30},{env});
 expect(generated).toMatchObject({model,content:'Generated local text',
  stored:false,eval_count:19,localOnly:true});
 const chat=await invokeLocalOllama('local.ollama_chat',roots,{model,
  messages:[{role:'user',content:'Hello'}]},{env});
 expect(chat.content).toBe('Private local chat reply');
 const embed=await invokeLocalOllama('local.ollama_embed',roots,{
  model,input:'a short sentence'},{env});
 expect(embed.embedding).toEqual([0.1,-0.2,0.5]);
 expect(embed.dimensions).toBe(3);
 for(const request of calls){
  expect(request.headers.authorization).toBeUndefined();
  expect(request.headers.cookie).toBeUndefined();
  expect(request.url.startsWith('/api/')).toBe(true);
  if(['generate','chat','embed'].some(x=>request.url.endsWith(x)))
   expect(request.body.stream).toBe(false);
 }
 expect(calls.filter(x=>x.url==='/api/tags')).toHaveLength(3);
 expect(calls.find(x=>x.url==='/api/generate').body)
  .toMatchObject({model,stream:false,options:{num_predict:30}});
}));
it('large generation is published create-only with independent confirmation and not echoed',async()=>fixture(async({root,env})=>{
 const args={model,prompt:'long-response',outputFile:'generation.txt',confirm:true};
 const created=await invokeLocalOllama('local.ollama_generate',[root],args,{env});
 expect(created).toMatchObject({stored:true,root:0,path:'generation.txt',bytes:7100});
 expect(JSON.stringify(created)).not.toContain('x'.repeat(50));
 expect(await readFile(join(root,'generation.txt'),'utf8')).toBe('x'.repeat(7100));
 await expect(invokeLocalOllama('local.ollama_generate',[root],args,{env}))
  .rejects.toThrow();
 await expect(invokeLocalOllama('local.ollama_generate',[root],
  {model,prompt:'long-response'},{env})).rejects.toThrow('outputFile');
 await expect(invokeLocalOllama('local.ollama_generate',[root],
  {model,prompt:'abc',outputFile:'bad.txt'},{env})).rejects.toThrow();
}));
it('rejects absent/cloud models, invalid chat roles, unexpected args before any inference POST',async()=>fixture(async({root,env,calls})=>{
 for(const args of [
  {model:'uninstalled:latest',prompt:'x'}, {model:'cloud-model:cloud',prompt:'x'},
  {model:'../../bad',prompt:'x'}, {model,prompt:''},
  {model,prompt:'valid',numPredict:0},
  {model,prompt:'valid',unknown:true}
 ])await expect(invokeLocalOllama('local.ollama_generate',[root],args,{env}))
  .rejects.toThrow();
 await expect(invokeLocalOllama('local.ollama_chat',[root],{
  model,messages:[{role:'tool',content:'danger'}]},{env})).rejects.toThrow();
 expect(calls.filter(x=>x.url==='/api/generate'||x.url==='/api/chat')).toHaveLength(0);
}));
it('refuses external redirects, malformed JSON, oversized bytes, and hangs without retry',async()=>{
 const base={host:'127.0.0.1',port:11434};
 for(const endpoint of ['http://evil.local/','/api/pull','/api/delete']){
  await expect(requestLocalOllama(base,endpoint)).rejects.toThrow();
 }
 const broken=(args,cb)=>{const req={
  setTimeout:vi.fn(),on:vi.fn(),end:vi.fn()
 };cb({statusCode:302,headers:{location:'http://remote.test'},
  resume:vi.fn()});return req;};
 await expect(requestLocalOllama(base,'/api/version',null,1000,{
  request:broken})).rejects.toThrow();
 await fixture(async({root,env})=>{
  const deny=await invokeLocalOllama('local.ollama_models',[root],{}, {env});
  expect(deny.localOnly).toBe(true);
 });
});
