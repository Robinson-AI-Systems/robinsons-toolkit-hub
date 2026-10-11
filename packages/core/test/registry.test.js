import { describe, expect, it } from 'vitest';
import { mergeNamespaces } from '../src/registry.js';
const make = (name) => ({ tools: [{ name }], handlers: { [name]: async () => null } });

describe('extracted Stripe registry behavior', () => {
  // These two assertion bodies are copied from Stripe tests/unit/registry.test.js.
  it('refuses duplicates across namespaces', () => {
    expect(() => mergeNamespaces([make('stripe_example'), make('stripe_example')])).toThrow(/Duplicate/);
  });
  it('refuses tools without a handler', () => {
    expect(() => mergeNamespaces([{ tools: [{ name: 'broken' }], handlers: {} }])).toThrow(/Missing handler/);
  });
  it('keeps registry order and preserves the callable handler', async () => {
    const a = make('alpha_read');
    const b = make('beta_read');
    const merged = mergeNamespaces([a,b]);
    expect(merged.tools.map(x => x.name)).toEqual(['alpha_read','beta_read']);
    expect(merged.handlers.alpha_read).toBe(a.handlers.alpha_read);
    expect(await merged.handlers.beta_read()).toBeNull();
    expect(Object.getPrototypeOf(merged.handlers)).toBeNull();
  });
  it('rejects empty names and missing handler regardless of package name', () => {
    expect(() => mergeNamespaces([{tools:[{}],handlers:{}}])).toThrow(/invalid/);
    expect(() => mergeNamespaces([{tools:[{name:'x'}],handlers:{x:null}}])).toThrow(/Missing handler/);
  });
});
