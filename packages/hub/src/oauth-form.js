// Validate the complete x-www-form-urlencoded body, not merely its first
// occurrences: duplicated grant/client/secret keys cannot be interpreted
// differently by a proxy or a downstream OAuth handler.
export function parseOAuthForm(req) {
  let pairs;
  const body=req.body;
  if (typeof body==='string' && Buffer.byteLength(body,'utf8')<=4096) {
    pairs=new URLSearchParams(body);
  } else if (body && typeof body==='object' && !Array.isArray(body) &&
    [Object.prototype,null].includes(Object.getPrototypeOf(body))) {
    const entries=Object.entries(body);
    if (entries.length>8 || entries.some(([k,v]) => k.length>40 ||
      typeof v!=='string' || v.length>1024) ||
      Buffer.byteLength(JSON.stringify(body),'utf8')>4096) return null;
    pairs=new URLSearchParams(entries);
  } else return null;
  if ([...pairs].length>8) return null;
  const seen=new Set();
  for (const [key,value] of pairs) {
    if (seen.has(key) || key.length>40 || value.length>1024) return null;
    seen.add(key);
  }
  return pairs;
}
