import { describe, expect, it } from 'vitest';

import { KernelError } from '../../src/index.js';

describe('KernelError', () => {
  it('preserves machine-readable context through JSON serialization', () => {
    const error = new KernelError('UNSUPPORTED_SCHEMA_VERSION', 'Unsupported schema.', {
      received: 2,
      supported: 1,
    });

    expect(error.toJSON()).toEqual({
      name: 'KernelError',
      code: 'UNSUPPORTED_SCHEMA_VERSION',
      message: 'Unsupported schema.',
      details: { received: 2, supported: 1 },
    });
  });
});
