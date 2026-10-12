#!/usr/bin/env node
// Optional D-4 webhook ingress check: only inert, ignored synthetic issue_comment events.
// No RTC pass, real issue number, provider call, or raw response is ever emitted.
import { createHmac, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { boundedJson } from '../packages/relay/src/forward.js';

function testUrl(value, expectedOrigin) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      url.pathname !== '/api/relay/github' || url.origin !== expectedOrigin ||
      (url.port && url.port !== '443')) throw new Error('invalid_ingress_url');
  const params = [...url.searchParams.keys()];
  if (params.length && (params.length !== 1 || params[0] !== 'x-vercel-protection-bypass' ||
    (url.searchParams.get(params[0]) || '').length < 24)) throw new Error('invalid_ingress_url');
  return url;
}

export async function verifyRelayIngress({
  args = process.argv.slice(2), env = process.env, fetchImpl = fetch,
  write = message => process.stdout.write(message)
} = {}) {
  const fail = code => { write(JSON.stringify({ ok: false, code }) + '\n'); return 1; };
  if (args.length !== 1 || args[0] !== '--authorized-ingress-test')
    return fail('explicit_authorization_required');
  const secret = env.RELAY_WEBHOOK_SECRET;
  const repo = env.RELAY_REPOSITORY;
  let target;
  try {
    if (typeof secret !== 'string' || secret.length < 32 ||
        !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '') ||
        typeof env.RELAY_EXPECTED_INGRESS_ORIGIN !== 'string' ||
        new URL(env.RELAY_EXPECTED_INGRESS_ORIGIN).origin !== env.RELAY_EXPECTED_INGRESS_ORIGIN)
      return fail('ingress_configuration_missing');
    target = testUrl(env.RELAY_INGRESS_TEST_URL, env.RELAY_EXPECTED_INGRESS_ORIGIN);
  } catch { return fail('ingress_configuration_invalid'); }
  // Edited events are always ignored by the parser after signature verification.
  // The positive signature proves signed ingress; the negative proves rejection.
  const body = Buffer.from(JSON.stringify({
    action: 'edited', repository: { full_name: repo, private: true },
    issue: { number: 0 }
  }));
  const digest = createHmac('sha256', secret).update(body).digest('hex');
  const send = async signature => {
    const response = await fetchImpl(target, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: { 'content-type': 'application/json', 'x-github-event': 'issue_comment',
        'x-github-delivery': randomUUID(), 'x-hub-signature-256': signature },
      body
    });
    const value = await boundedJson(response, 1024);
    if (!value || typeof value.code !== 'string') throw new Error('invalid_reply');
    return { status: response.status, code: value.code };
  };
  try {
    const good = await send('sha256=' + digest);
    if (good.status !== 202 || good.code !== 'ignored') return fail('signed_ingress_unverified');
    const bad = await send('sha256=' + (digest[0] === 'a' ? 'b' : 'a') + digest.slice(1));
    if (bad.status !== 401 || bad.code !== 'invalid_signature') return fail('signature_rejection_unverified');
    write(JSON.stringify({ ok: true, code: 'signed_ingress_verified',
      harmlessEventIgnored: true, invalidSignatureRejected: true, rtcCalls: 0 }) + '\n');
    return 0;
  } catch { return fail('ingress_unreachable_or_unverified'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await verifyRelayIngress();
