import { describe, expect, it } from 'vitest';
import { publicOrigin, send, escapeHtml, paramsOf, only,
  incomingBodyWithinLimit, MAX_HTTP_BODY_BYTES } from '../src/http.js';

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
  it('bounds framework-preparsed requests in the reviewed current Stripe HTTP leaf', () => {
    expect(MAX_HTTP_BODY_BYTES).toBe(16384);
    const oversized={method:'POST',headers:{'content-type':'application/json',
      'content-length':'9'},body:{content:'x'.repeat(16385)}};
    expect(incomingBodyWithinLimit(oversized)).toBe(false);
    expect(() => paramsOf(oversized)).toThrow(/Invalid request body/);
    expect(incomingBodyWithinLimit({method:'POST',headers:{},body:{ok:true}})).toBe(false);
    expect(incomingBodyWithinLimit({method:'POST',
      headers:{'content-length':'11'},rawBody:'{"ok":true}',body:{ok:true}})).toBe(true);
    expect(incomingBodyWithinLimit({method:'POST',
      headers:{'content-length':'4','content-type':'application/json'},
      rawBody:'12345',body:'12345'})).toBe(false);
    const cyclic={};cyclic.loop=cyclic;
    expect(() => paramsOf({method:'POST',headers:{},body:cyclic})).toThrow(/Invalid request body/);
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
