import {createHmac,timingSafeEqual} from 'node:crypto';

const token=/^([A-Za-z0-9_-]{8,100})\.([A-Za-z0-9_-]{43})$/;
function key(settings){
 const pepper=settings?.pepper;
 if(typeof pepper!=='string'||pepper.length<32)
  throw new Error('Hub search cursor signing unavailable');
 return pepper;
}
function signature(secret,contents,scope){
 return createHmac('sha256',secret).update(JSON.stringify([contents,scope]))
  .digest('base64url');
}
export function searchCursorScope(actor,args,matching){
 return [actor.ownerId,actor.id,actor.mode,actor.profile,
  args.query,args.server??'',args.area??'',
  matching.map(t=>[t.name,t.prefix,t.areas])];
}
/** Pagination resumes by authorized service, at most three providers per page. */
export function issueSearchCursor(scope,offset,settings,{now=Date.now}={}){
 if(!Number.isInteger(offset)||offset<3||offset>99||offset%3!==0)
  throw new TypeError('Invalid service page offset');
 const contents={v:1,o:offset,e:Math.floor(now()/1000)+300};
 const encoded=Buffer.from(JSON.stringify(contents)).toString('base64url');
 return encoded+'.'+signature(key(settings),contents,scope);
}
export function openSearchCursor(value,scope,settings,{now=Date.now}={}){
 if(typeof value!=='string'||value.length>160)return null;
 const parsed=token.exec(value);
 if(!parsed)return null;
 let contents;
 try {
  const data=Buffer.from(parsed[1],'base64url');
  if(data.toString('base64url')!==parsed[1])return null;
  contents=JSON.parse(data.toString('utf8'));
 }catch{return null;}
 const seconds=Math.floor(now()/1000);
 if(!contents||Object.keys(contents).sort().join(',')!=='e,o,v'||
   contents.v!==1||!Number.isInteger(contents.o)||contents.o<3||
   contents.o>99||contents.o%3!==0||
   !Number.isInteger(contents.e)||contents.e<=seconds||
   contents.e>seconds+300)return null;
 const actual=Buffer.from(parsed[2]),expected=Buffer.from(
  signature(key(settings),contents,scope));
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))
  return null;
 return contents.o;
}
