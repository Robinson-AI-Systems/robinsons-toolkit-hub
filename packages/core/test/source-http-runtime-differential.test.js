// Directly execute the reviewed original Stripe HTTP runtime beside the byte-identical
// package helper. Endpoint authorization and provider storage remain service-owned.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gitBlobSha } from '../../../scripts/check-original-assertion-bodies.mjs';
import * as source from '../../../docs/audits/upstream/runtime/http.js';
import * as core from '../src/http.js';

const capture = fn => {
  try { return { value: fn() }; }
  catch (error) { return { error: error.name, message: error.message }; }
};
function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(n) { this.statusCode = n; return this; },
    send(body) { this.body = body; return this; }
  };
}
function snapshot(r) { return { status: r.statusCode, headers: r.headers, body: r.body }; }
const fixtures = [
  { method: 'GET', query: { value: 'ok', extra: '<script>' }, headers: {} },
  { method: 'GET', headers: {} },
  { method: 'POST', body: { nested: { x: 1 } }, headers: { 'content-type': 'application/json' } },
  { method: 'POST', body: '{"one":1,"two":false}', headers: { 'content-type': 'application/json' } },
  { method: 'POST', body: 'a=1&b=two+words', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
  { method: 'POST', body: '[1,2]', headers: { 'content-type': 'application/json' } },
  { method: 'POST', body: '{"a":1} trailing', headers: { 'content-type': 'application/json' } },
  { method: 'POST', body: '{"a":1}', headers: { 'content-type': 'text/plain' } },
  { method: 'POST', body: null, headers: { 'content-type': 'application/json' } },
  { method: 'POST', body: 'a'.repeat(16385), headers: { 'content-type': 'application/json' } },
  { method: 'POST', body: { x: 1 }, headers: {} },
  { method: 'POST', body: ['one'], headers: { 'content-type': 'application/json' } }
];

describe('K-3 original Stripe HTTP utility runtime differential', () => {
  it('rejects an altered upstream Git blob rather than trusting a mock', () => {
    const file = fileURLToPath(new URL('../../../docs/audits/upstream/runtime/http.js', import.meta.url));
    expect(gitBlobSha(readFileSync(file, 'utf8')))
      .toBe('1b2078afb1bccbb576bfb493c623067871866b7f');
  });
  it('matches configured issuer parsing, including credentials, ports and hostile host forms', () => {
    const origins = [
      'https://safe.example.test', 'https://safe.example.test/',
      'https://safe.example.test:8443', 'https://safe.example.test/path',
      'https://safe.example.test/?query=1', 'https://safe.example.test/#fragment',
      'https://user:pass@safe.example.test', 'http://safe.example.test',
      'javascript:alert(1)', '//safe.example.test', '', 'not an origin'
    ];
    for (const value of origins) {
      const env = { PUBLIC_BASE_URL: value };
      expect(capture(() => core.publicOrigin(env)))
        .toEqual(capture(() => source.publicOrigin(env)));
    }
    for (const env of [{}, { PUBLIC_BASE_URL: undefined }, { PUBLIC_BASE_URL: 'https://safe.example.test' }]) {
      expect(capture(() => core.publicOrigin(env)))
        .toEqual(capture(() => source.publicOrigin(env)));
    }
  });
  it('retains identical parsed values, rejections and errors for all input media', () => {
    for (const request of fixtures) {
      expect(capture(() => core.paramsOf(request)))
        .toEqual(capture(() => source.paramsOf(request)));
    }
    for (const body of ['', '{}', '{"a":true}', '{"a":', '[]', 'null', 'a=1&a=2']) {
      for (const type of ['application/json', 'application/x-www-form-urlencoded', 'text/plain']) {
        const request = { method: 'POST', body, headers: { 'content-type': type } };
        expect(capture(() => core.paramsOf(request)))
          .toEqual(capture(() => source.paramsOf(request)));
      }
    }
  });
  it('keeps exact JSON and HTML text, security headers and status codes', () => {
    const values = [{ ok: true, nested: ['a', 1] }, { error: 'invalid_request' }, 'plain'];
    for (const contentType of ['application/json; charset=utf-8', 'text/plain']) {
      for (const value of values) {
        const a = response(), b = response();
        core.send(a, 422, value, contentType);
        source.send(b, 422, value, contentType);
        expect(snapshot(a)).toEqual(snapshot(b));
        expect(a.headers['Cache-Control']).toBe('no-store');
        expect(a.headers['X-Content-Type-Options']).toBe('nosniff');
      }
    }
    for (const value of [undefined, null, '', '<img onerror="alert(1)">', '\"&<>\'', 42]) {
      expect(core.escapeHtml(value)).toBe(source.escapeHtml(value));
    }
  });
  it('preserves 405, Allow header and permitted-method response invariants', () => {
    for (const methods of [['GET'], ['POST'], ['GET', 'POST']]) {
      for (const method of ['GET', 'POST', 'DELETE', 'PUT']) {
        const a = response(), b = response(), req = { method };
        expect(core.only(a, req, methods)).toBe(source.only(b, req, methods));
        expect(snapshot(a)).toEqual(snapshot(b));
        if (!methods.includes(method)) {
          expect(a.statusCode).toBe(405);
          expect(JSON.parse(a.body)).toEqual({ error: 'method_not_allowed' });
        }
      }
    }
  });
});
