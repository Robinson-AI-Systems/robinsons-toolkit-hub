import { it, expect } from 'vitest';
import { startFakeServer } from '../../conformance/fake-server/server.js';
import { createForwarder, validateServerUrl, boundedJson } from '../src/forward.js';
it('enforces fixed origins and bounded responses', async () => {
  for (const value of ['http://example.com', 'https://example.com/path',
    'https://user:password@example.com', 'https://example.com?token=value', 'https://localhost'])
    expect(() => validateServerUrl(value)).toThrow();
  expect(validateServerUrl('https://example.com')).toBe('https://example.com');
  await expect(boundedJson(new Response('too much'), 2)).rejects.toThrow('result_cap');
});
it('calls real RTC guarded tools and preserves server refusal', async () => {
  const fake = await startFakeServer();
  try {
    const forward = createForwarder({ servers: { fake: fake.url }, allowLoopback: true });
    const request = { server: 'fake', tool: 'fake_read_record', args: {}, pass: fake.passes.full };
    expect((await forward(request)).ok).toBe(true);
    expect((await forward({ ...request, server: 'other' })).error.code).toBe('outside_scope');
    expect((await forward({ ...request, tool: '../../redirect' })).error.code).toBe('outside_scope');
    expect((await forward({ ...request, tool: 'fake_delete_record' })).result.needsConfirmation).toBe(true);
    expect((await forward({ ...request, tool: 'fake_write_record', args: { confirm: true },
      pass: fake.passes.readOnly })).error.code).toBe('refused_by_guard');
    expect((await forward({ ...request, pass: fake.passes.revoked })).error.code).toBe('pass_revoked');
  } finally { await fake.close(); }
});
