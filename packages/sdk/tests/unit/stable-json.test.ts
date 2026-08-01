import { describe, expect, it } from 'vitest';

import { KernelError, isJsonValue, stableStringify } from '../../src/index.js';

describe('stable JSON utilities', () => {
  it('serializes object keys in a deterministic order at every depth', () => {
    expect(stableStringify({ z: [true, { b: 2, a: 1 }], a: null })).toBe(
      '{"a":null,"z":[true,{"a":1,"b":2}]}',
    );
  });

  it('accepts JSON primitives and rejects non-finite numbers', () => {
    expect(isJsonValue('BrowserScope')).toBe(true);
    expect(isJsonValue(Number.NaN)).toBe(false);
    expect(isJsonValue(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('rejects cycles and throws a serializable typed error', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    expect(isJsonValue(cyclic)).toBe(false);
    expect(() => stableStringify(cyclic as never)).toThrow(KernelError);
  });
});
