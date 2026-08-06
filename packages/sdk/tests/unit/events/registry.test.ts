import { describe, expect, it } from 'vitest';

import {
  EventSchemaRegistry,
  KernelError,
  unwrapEventValidation,
  validateEventType,
  validateEventVersion,
} from '../../../src/index.js';
import { recordSchemaV1, recordSchemaV2 } from '../../support/event-fixtures.js';

describe('EventSchemaRegistry', () => {
  it('discovers schema versions in deterministic order', () => {
    const registry = new EventSchemaRegistry();
    registry.register(recordSchemaV2);
    registry.register(recordSchemaV1);

    expect(registry.getLatest(recordSchemaV1.type)).toBe(recordSchemaV2);
    expect(registry.list().map((schema) => schema.version)).toEqual([1, 2]);
  });

  it('rejects duplicate schema identities and absent schema lookup', () => {
    const registry = new EventSchemaRegistry();
    registry.register(recordSchemaV1);

    expect(() => registry.register(recordSchemaV1)).toThrow(KernelError);
    expect(() =>
      registry.require(
        unwrapEventValidation(validateEventType('test.unknown')),
        unwrapEventValidation(validateEventVersion(1)),
      ),
    ).toThrow(KernelError);
  });

  it('rejects malformed runtime schema descriptors before registration', () => {
    const malformedSchema = {
      ...recordSchemaV1,
      validatePayload: 'not a validator',
    } as unknown as typeof recordSchemaV1;

    expect(() => new EventSchemaRegistry().register(malformedSchema)).toThrow(KernelError);
  });

  it('keeps an event type in the same category across compatible schema versions', () => {
    const incompatibleSchema = {
      ...recordSchemaV2,
      category: 'storage' as const,
    } as unknown as typeof recordSchemaV2;
    const registry = new EventSchemaRegistry();
    registry.register(recordSchemaV1);

    expect(() => registry.register(incompatibleSchema)).toThrow(KernelError);
  });
});
