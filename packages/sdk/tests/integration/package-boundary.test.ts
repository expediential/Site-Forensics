import { describe, expect, it } from 'vitest';

describe('SDK package boundary', () => {
  it('exports deterministic serialization from the built package', async () => {
    const sdk = await import('../../dist/index.js');

    expect(sdk.stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });
});
