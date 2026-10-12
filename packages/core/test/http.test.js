import { describe, expect, it } from 'vitest';
import { publicOrigin, send, escapeHtml, paramsOf, only, incomingBodyWithinLimit, MAX_HTTP_BODY_BYTES } from '../src/http.js';

function response() {
  const headers = {};
  const res = { statusCode: null, body: null,
    setHeader(key, value) { headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; } };
  return { res, headers };
}
describe('extracted HTTP security utilities', () => {
  it('accepts only configured HTTPS origins, never caller Host headers', () => {
    expect(publicOrigin({ PUBLIC_BASE_URL:'https://example.test/' })).toBe('https://example.test');
    for (const value of ['http://example.test','https://u:p@example.test',
      'https://example.test/path','https://example.test/?x=1',
      'https://example.test/#frag','not a url']) {
      expect(() => publicOrigin({ PUBLIC_BASE_URL:value })).toThrow(/HTTPS origin/);
    }
    expect(() => publicOrigin({})).toThrow(/HTTPS origin/);
  });
  it('writes no-store, nosniff, correct JSON/string responses', () => {
    const {res,headers} = response();
    send(res,200,{value:'ok'});
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({value:'ok'});
    expect(headers['Cache-Control']).toBe('no-store');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Content-Type']).toMatch(/application\/json/);
    send(res,201,'a & b','text/plain');
    expect(res.body).toBe('a & b');
  });
  it('HTML-escapes untrusted account names and reflects no markup', () => {
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');
    expect(escapeHtml(null)).toBe('');
  });
  it('parses GET, JSON and form inputs without accepting arrays or invalid bodies', () => {
    expect(paramsOf({method:'GET',query:{x:'y'}})).toEqual({x:'y'});
    expect(paramsOf({method:'POST',headers:{'content-type':'application/json'},body:'{"x":1}'})).toEqual({x:1});
    expect(paramsOf({method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'a=1&b=2'})).toEqual({a:'1',b:'2'});
    for(const body of ['[1,2]','{} trailing','']) {
      expect(() => paramsOf({method:'POST',headers:{'content-type':'application/json'},body})).toThrow();
    }
    expect(() => paramsOf({method:'POST',headers:{'content-type':'application/json'},body:'a'.repeat(16385)})).toThrow(/Invalid/);
  });
  it('refuses unallowed methods with 405 and Allow header', () => {
    const {res,headers}=response();
    expect(only(res,{method:'DELETE'},['GET','POST'])).toBe(false);
    expect(res.statusCode).toBe(405);
    expect(headers.Allow).toBe('GET, POST');
    expect(JSON.parse(res.body)).toEqual({error:'method_not_allowed'});
    expect(only(res,{method:'GET'},['GET'])).toBe(true);
  });
});

describe('current-source HTTP byte-limit safety and Vercel pre-parsing', () => {
  it('checks the exact wire bytes when raw evidence exists and refuses contradictory lengths', () => {
    const raw = '{"amount":1}';
    const mk = (headers,rawBody) => ({method:'POST',headers,rawBody,body:{amount:1}});
    expect(incomingBodyWithinLimit(mk({'content-length':String(Buffer.byteLength(raw))},raw))).toBe(true);
    expect(incomingBodyWithinLimit(mk({'content-length':'2'},raw))).toBe(false);
    for (const length of ['0002','-1','1.5','NaN','9007199254740992',String(MAX_HTTP_BODY_BYTES+1)]) {
      expect(incomingBodyWithinLimit(mk({'content-length':length},raw))).toBe(false);
    }
    expect(incomingBodyWithinLimit(mk({},Buffer.alloc(MAX_HTTP_BODY_BYTES+1)))).toBe(false);
    expect(incomingBodyWithinLimit(mk({'content-length':'0'},Buffer.alloc(0)))).toBe(true);
  });
  it('refuses missing exact byte evidence on a pre-parsed POST and preserves GET', () => {
    expect(incomingBodyWithinLimit({method:'POST',body:{a:1},headers:{}})).toBe(false);
    expect(incomingBodyWithinLimit({method:'POST',body:{a:1},headers:{'content-length':'7'}})).toBe(true);
    expect(incomingBodyWithinLimit({method:'GET',body:{a:1},headers:{}})).toBe(true);
    expect(incomingBodyWithinLimit({method:'POST',body:'a'.repeat(MAX_HTTP_BODY_BYTES+1),headers:{}})).toBe(false);
  });
  it('also caps parsed JSON objects and rejects cyclic or executable serialization', () => {
    const req = body => ({method:'POST',body,headers:{'content-type':'application/json'}});
    expect(paramsOf(req({amount:1}))).toEqual({amount:1});
    expect(() => paramsOf(req({big:'x'.repeat(MAX_HTTP_BODY_BYTES)}))).toThrow(/Invalid request body/);
    const cycle={};cycle.self=cycle;
    expect(() => paramsOf(req(cycle))).toThrow(/Invalid request body/);
    expect(() => paramsOf(req({toJSON(){throw new Error('private marker');}}))).toThrow(/Invalid request body/);
  });
});
