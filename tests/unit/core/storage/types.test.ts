import { describe, expect, it } from 'vitest';

import { StorageError, createInvestigationId } from '@/core/storage';

describe('storage identifiers', () => {
  it('accepts portable investigation IDs and rejects invalid storage partitions', () => {
    expect(createInvestigationId('inv_storage_0001')).toBe('inv_storage_0001');
    expect(() => createInvestigationId('storage_0001')).toThrow(StorageError);
  });
});
