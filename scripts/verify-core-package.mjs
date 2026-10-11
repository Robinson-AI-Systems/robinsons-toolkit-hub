// Package-boundary gate for the private K-3 core. Does not publish or fetch dependencies.
// This is intentionally stricter than npm's files filter: every shipped module is reviewed.
import {readFileSync, readdirSync, lstatSync, realpathSync} from 'node:fs';
import {resolve, join, relative, dirname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {builtinModules} from 'node:module';

const builtins=new Set(builtinModules.map(s=>s.replace(/^node:/,'')));
const text=(root,path)=>readFileSync(join(root,path),'utf8');
const inside=(parent,target)=>target.startsWith(parent+sep);
const validSubpath=/^\.\/[a-z][a-z0-9-]*$/;
const validTarget=/^\.\/src\/[a-z][a-z0-9-]*\.js$/;

function walkSources(dir,root,files=[]) {
  for(const entry of readdirSync(dir,{withFileTypes:true})) {
    const abs=join(dir,entry.name);
    // No symlink inside a distributable security package, even when the target is inside.
    if(entry.isSymbolicLink() || !entry.isFile() && !entry.isDirectory()) {
      throw new Error('Non-regular core source entry: '+relative(root,abs));
    }
    if(entry.isDirectory())walkSources(abs,root,files);
    else files.push(abs);
  }
  return files;
}

export function verifyCorePackage(root, {requirePrivate=true}={}) {
  const pkg=JSON.parse(text(root,'package.json'));
  if(pkg.name!=='robinson-mcp-core'||pkg.type!=='module'||
     (requirePrivate&&pkg.private!==true)||!/^\d+\.\d+\.\d+$/.test(pkg.version)) {
    throw new Error('Core package identity, private state, ESM and version are required');
  }
  if(JSON.stringify(pkg.files)!==JSON.stringify(['src/'])||
     pkg.scripts||pkg.bin||Object.keys(pkg.dependencies||{}).length||
     Object.keys(pkg.optionalDependencies||{}).length) {
    throw new Error('Core may ship only source modules without install scripts or runtime dependencies');
  }
  const exports=pkg.exports;
  if(!exports||typeof exports!=='object'||Array.isArray(exports)||!Object.keys(exports).length) {
    throw new Error('Core requires explicit public subpath exports');
  }
  const src=realpathSync(join(root,'src'));
  if(!inside(realpathSync(root),src)) throw new Error('Core source escapes package root');
  const seen=new Set();
  for(const [name,dest] of Object.entries(exports)) {
    if(!validSubpath.test(name)||!validTarget.test(dest)) {
      throw new Error('Unsafe core export subpath or target: '+name);
    }
    const abs=resolve(root,dest),rel=relative(root,abs);
    if(lstatSync(abs).isSymbolicLink()||!lstatSync(abs).isFile()||
      !inside(src,realpathSync(abs))||seen.has(rel)) {
      throw new Error('Unsafe or duplicate core export: '+name);
    }
    seen.add(rel);
  }
  const all=walkSources(src,root).sort();
  if(all.length!==seen.size) throw new Error('Unreviewed/unexported source module in core');
  for(const abs of all) {
    const rel=relative(root,abs);
    if(!seen.has(rel)||!rel.endsWith('.js')) {
      throw new Error('Unreviewed core source: '+rel);
    }
    const code=readFileSync(abs,'utf8');
    if(/\bimport\s*\(|\brequire\s*\(/.test(code)) {
      throw new Error('Dynamic import or require is forbidden in core: '+rel);
    }
    // Static import/export declarations are the only allowed module dependencies.
    const refs=[...code.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^\n;'"]*?\s+from\s+)?['"]([^'"]+)['"]/g)]
      .map(match=>match[1]);
    for(const spec of refs) {
      if(spec.startsWith('node:')) {
        if(!builtins.has(spec.slice(5)))throw new Error('Unknown Node builtin in '+rel);
      } else if(spec.startsWith('./')) {
        const target=resolve(dirname(abs),spec);
        if(!inside(src,target)||!seen.has(relative(root,target))) {
          throw new Error('Core import crosses its public source boundary: '+rel);
        }
      } else throw new Error('Provider, workspace or remote dependency forbidden: '+rel);
    }
  }
  return Object.freeze({name:pkg.name,version:pkg.version,modules:Object.freeze([...seen].sort())});
}

const isMain=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain) {
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'../packages/core');
  try {
    const proof=verifyCorePackage(root);
    console.log('Private core package boundary verified: '+proof.modules.length+' modules');
  } catch (error) {
    console.error('Core package boundary failed: '+error.message);
    process.exitCode=1;
  }
}
