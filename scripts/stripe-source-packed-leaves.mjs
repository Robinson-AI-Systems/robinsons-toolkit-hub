// Private K-3 package vs the original Stripe source, not a service adoption.
// Both come from distinct CI-controlled trees; no remote package, pass or provider.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const cwd=process.cwd();
const directory=mkdtempSync(join(tmpdir(),'k3-stripe-original-adopter-'));
const cmd=process.platform==='win32'?'npm.cmd':'npm';
const run=(args,workdir)=>{
  const response=spawnSync(cmd,args,{cwd:workdir,timeout:30000,encoding:'utf8',
    env:{...process.env,npm_config_offline:'true',npm_config_audit:'false',
      npm_config_fund:'false',NODE_OPTIONS:''}});
  if(response.error||response.status!==0)
    throw new Error('Private K-3 artifact operation refused');
  return response.stdout;
};
const outcome=async fn=>{
  try{return {ok:true,value:await fn()};}
  catch(error){return {ok:false,name:error?.name||'Error'};}
};
let comparisons=0;
try{
  const meta=JSON.parse(run(['pack','--workspace','packages/core','--json',
    '--ignore-scripts','--pack-destination',directory],cwd));
  assert.equal(meta.length,1);
  const manifest=meta[0];
  assert.equal(manifest.name,'robinson-mcp-core');
  assert.equal(manifest.filename,'robinson-mcp-core-0.1.0.tgz');
  assert.equal(statSync(join(directory,manifest.filename)).size,manifest.size);
  const consumer=join(directory,'consumer');
  mkdirSync(consumer);
  run(['install','--no-save','--package-lock=false','--ignore-scripts',
    '--offline','--no-audit','--no-fund',join(directory,manifest.filename)],consumer);
  const requireFromConsumer=createRequire(join(consumer,'entry.cjs'));
  const loadPacked=async subpath=>import(pathToFileURL(
    requireFromConsumer.resolve('robinson-mcp-core/'+subpath)).href);
  const loadSource=async name=>import(pathToFileURL(
    resolve(cwd,'source-stripe/src/core/'+name+'.js')).href);
  const [original,packed]=await Promise.all([
    Promise.all(['oauth','crypto','registry','write-contract-check'].map(loadSource)),
    Promise.all(['oauth','crypto','registry','write-contract-check'].map(loadPacked))]);
  const [oauth,crypto,registry,write]=original;
  const [poauth,pcrypto,pregistry,pwrite]=packed;
  const pair=async(name,left,right)=>{
    assert.deepEqual(await outcome(right),await outcome(left),
      'Original Stripe / private package compatibility mismatch: '+name);
    comparisons++;
  };
  const sample='generated-test-only-'+randomBytes(8).toString('hex');
  await pair('hashed credential',()=>oauth.hashToken(sample),
    ()=>poauth.hashToken(sample));
  await pair('matching valid credential',()=>oauth.secretsMatch(sample,sample),
    ()=>poauth.secretsMatch(sample,sample));
  await pair('denied invalid credential',()=>oauth.secretsMatch(sample,'different'),
    ()=>poauth.secretsMatch(sample,'different'));
  await pair('reject bad PKCE',()=>oauth.verifyPkce('short','short'),
    ()=>poauth.verifyPkce('short','short'));
  for(const uri of ['https://example.test/callback','http://evil.test/callback',
    'http://localhost:3000/callback']){
    await pair('redirect URI',()=>oauth.validRedirectUri(uri),
      ()=>poauth.validRedirectUri(uri));
  }
  await pair('IPv6 client isolation',()=>oauth.clientIp({
    headers:{'x-real-ip':'2001:db8:1:2:3:4:5:6'}}),
    ()=>poauth.clientIp({headers:{'x-real-ip':'2001:db8:1:2:3:4:5:6'}}));
  const loginStore=()=>({
    recordLoginAttempt:async()=>123,countRecentFailedLogins:async()=>0,
    markLoginAttemptSucceeded:async()=>{}
  });
  await pair('approved local login',()=>oauth.evaluateLogin({
    ip:'127.0.0.1',supplied:sample,expected:sample,store:loginStore()}),
    ()=>poauth.evaluateLogin({
    ip:'127.0.0.1',supplied:sample,expected:sample,store:loginStore()}));
  const key=randomBytes(32),aad='offline-adoption/test';
  const cipher=crypto.encryptSecret(sample,{key,aad});
  assert.equal(pcrypto.decryptSecret(cipher,{key,aad}),sample);
  const inverse=pcrypto.encryptSecret(sample,{key,aad});
  assert.equal(crypto.decryptSecret(inverse,{key,aad}),sample);
  comparisons+=2;
  await pair('AAD mismatch refusal',()=>crypto.decryptSecret(cipher,{key,aad:'other'}),
    ()=>pcrypto.decryptSecret(cipher,{key,aad:'other'}));
  const declaration={name:'original_read',writes:false,
    inputSchema:{type:'object',properties:{}}};
  await pair('original write metadata',()=>write.validateWriteDeclarations([
    declaration,{...declaration,name:'missing_guard',writes:true}]),
    ()=>pwrite.validateWriteDeclarations([
    declaration,{...declaration,name:'missing_guard',writes:true}]));
  const catalog=mod=>{const merged=mod.mergeNamespaces([{tools:[declaration],
    handlers:{original_read:()=>sample}}]);return {
    names:merged.tools.map(t=>t.name),returns:merged.handlers.original_read()}};
  await pair('source registry merge',()=>catalog(registry),
    ()=>catalog(pregistry));
  await pair('duplicate registry refusal',()=>catalog({
    mergeNamespaces:()=>registry.mergeNamespaces([
      {tools:[declaration],handlers:{original_read:()=>sample}},
      {tools:[declaration],handlers:{original_read:()=>sample}}])}),
    ()=>catalog({mergeNamespaces:()=>pregistry.mergeNamespaces([
      {tools:[declaration],handlers:{original_read:()=>sample}},
      {tools:[declaration],handlers:{original_read:()=>sample}}])}));
  console.log(JSON.stringify({source:'original independently pinned Stripe checkout',
    artifact:'unpublished private local tarball',originalModules:4,
    comparisons,sourceServiceAdopted:false,sqlOwnerProven:false,
    independentlyAuthenticatedMoneyConsent:false,releaseReady:false}));
}finally{rmSync(directory,{recursive:true,force:true});}
