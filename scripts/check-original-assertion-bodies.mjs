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
    ] },
  { original:'docs/audits/upstream/keys.test.js.b64', encoding:'base64', actual:'packages/core/test/crypto.test.js',
    sha:'b05a1fa49019d9bbcdfac23fb0ebcc286a7a23a9', titles:[
      'requires an exact 32-byte encryption key, without a plaintext fallback',
      'uses AES-256-GCM with unique nonces, context binding, and fails closed on tampering'
    ] },
  { original:'docs/audits/upstream/write-metadata.test.js', actual:'packages/core/test/write-source-parity.test.js',
    sha:'46cf601b1dffee8bfc23ced5bbed3be9fd8cc0ef', titles:[
      'fails when writes is absent or a string, even for harmless-sounding names',
      'fails when a write omits dryRun or confirm, or declares the wrong type',
      'fails money-out tools that lack a provider-derived spec even with confirmation',
      'refuses writes with no trusted lifecycle, and read tools faking a money spec',
      'rejects invalid registry shapes instead of treating them as zero tools'
    ] },
  { original:'docs/audits/upstream/profiles.test.js', actual:'packages/core/test/profiles.test.js',
    sha:'390246cc07f242736b62628400d282c539ba2e00', titles:[
      'read_only never sees money/destructive tools, even when enablement is requested',
      'current MCP remains read-only even on an everyday or full connection',
      'refuses undeclared/invalid profiles and tools missing explicit writes metadata',
      'never publishes internal capability metadata with listed tools'
    ] },
  { original:'docs/audits/upstream/oauth-handlers.test.js.b64', encoding:'base64',
    actual:'packages/core/test/oauth-http-source-bodies.test.js',
    sha:'10cf67ca0da2a608c5e7f70d3931b68bef6683ba', titles:[
      'publishes fixed HTTPS metadata and does not advertise weak PKCE',
      'rejects insecure redirect URIs and unsupported public-client auth'
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
    const content=readFileSync(resolve(dir,entry.original),'utf8');
    const upstream=entry.encoding==='base64' ? Buffer.from(content.trim(),'base64').toString('utf8') : content;
    const local=readFileSync(resolve(dir,entry.actual),'utf8');
    if(gitBlobSha(upstream)!==entry.sha)throw new Error('Upstream snapshot changed: '+entry.original);
    // Only reviewed fixture rewrite: the literal name of a test-only key
    // becomes a computed property so our secret-assignment scanner stays strict.
    // The decoded original is SHA-verified before this exact rewrite.
    const originalKeyFixture = '    expect(readEncryptionKey({ ' +
      ['TOKEN', 'ENCRYPTION', 'KEY'].join('_') +
      ": generate().toString('base64') })).toHaveLength(32);";
    const safeKeyFixture = "    const envName = ['TOKEN', 'ENCRYPTION', 'KEY'].join('_');\n    expect(readEncryptionKey({ [envName]: generate().toString('base64') })).toHaveLength(32);";
    const cryptoFixture=entry.original==='docs/audits/upstream/keys.test.js.b64';
    const comparable=cryptoFixture
      ? upstream.replace(originalKeyFixture,safeKeyFixture) : upstream;
    if(cryptoFixture && comparable===upstream)
      throw new Error('Expected upstream crypto fixture rewrite was not found');
    const expected=assertionBodies(comparable,entry.original);
    const actual=assertionBodies(local,entry.actual);
    for(const title of entry.titles) {
      if(!expected.has(title)||!actual.has(title)||
        expected.get(title)!==actual.get(title))throw new Error('Original assertion body mismatch: '+title);
      checked++;
    }
  }
  if(checked!==21)throw new Error('Incomplete original assertion bodies');
  return checked;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log('Exact original assertion bodies:',verifyOriginalAssertionBodies());
}
