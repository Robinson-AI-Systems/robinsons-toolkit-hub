// Verify literal original assertion bodies, not just case titles or expect counts.
// The snapshots are exact upstream Git blobs; imports/fixtures are never executed here.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = [
  { original:'docs/audits/upstream/oauth-core.test.js', actual:'packages/core/test/oauth.test.js',
    sha:'fb3a616a02f775f94a9d5b9f06caff465dc1f712', titles:[
      'generates unpredictable-looking tokens and returns stable hashes, never plaintext',
      'requires S256 PKCE with a properly sized verifier, rejects plain or absent PKCE',
      'accepts HTTPS and localhost redirects, rejects insecure external and open redirect forms',
      'does not trust caller-controlled forwarded-for or accept missing IP as a bypass',
      'locks an address after five wrong attempts for fifteen minutes',
      'refuses missing passphrase configuration'
    ] },
  { original:'docs/audits/upstream/registry.test.js', actual:'packages/core/test/registry.test.js',
    sha:'249c16a15a9b26a43ef3378c0c94e59644da2f23', titles:[
      'refuses duplicates across namespaces', 'refuses tools without a handler'
    ] }
];
export function gitBlobSha(text) {
  return createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0'+text).digest('hex');
}
export function assertionBodies(text, name='suite.js') {
  const sf=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  if(sf.parseDiagnostics.length) throw new Error('Unparseable assertion suite: '+name);
  const printer=ts.createPrinter({removeComments:true});
  const found=new Map();
  function visit(node){
    if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&
      node.expression.text==='it'&&ts.isStringLiteral(node.arguments[0])&&
      node.arguments[1]&&(ts.isArrowFunction(node.arguments[1])||
        ts.isFunctionExpression(node.arguments[1]))) {
      const title=node.arguments[0].text;
      if(found.has(title))throw new Error('Duplicate original assertion: '+title);
      found.set(title,printer.printNode(ts.EmitHint.Unspecified,node.arguments[1].body,sf));
    }
    ts.forEachChild(node,visit);
  }
  visit(sf);
  return found;
}
export function verifyOriginalAssertionBodies(dir=root) {
  let checked=0;
  for(const entry of sources) {
    const upstream=readFileSync(resolve(dir,entry.original),'utf8');
    const local=readFileSync(resolve(dir,entry.actual),'utf8');
    if(gitBlobSha(upstream)!==entry.sha)throw new Error('Upstream snapshot changed: '+entry.original);
    const expected=assertionBodies(upstream,entry.original);
    const actual=assertionBodies(local,entry.actual);
    for(const title of entry.titles) {
      if(!expected.has(title)||!actual.has(title)||
        expected.get(title)!==actual.get(title))throw new Error('Original assertion body mismatch: '+title);
      checked++;
    }
  }
  if(checked!==8)throw new Error('Incomplete original assertion bodies');
  return checked;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log('Exact original assertion bodies:',verifyOriginalAssertionBodies());
}
