import { describe, expect, it } from 'vitest';

import {
  KernelError,
  computeEventHash,
  createEvent,
  unwrapEventValidation,
  validateEvent,
  validateEventId,
  type BaseEventInput,
} from '../../../src/index.js';
import {
  createRecordEvent,
  createRecordInput,
  type RecordPayload,
  recordSchemaV1,
} from '../../support/event-fixtures.js';

describe('immutable events', () => {
  it('deeply freezes independent event copies and keeps transient createdAt out of the hash', () => {
    const mutablePayload = { label: 'captured' };
    const input = createRecordInput({ payload: mutablePayload });
    const first = createEvent(recordSchemaV1, input);
    const second = createEvent(
      recordSchemaV1,
      createRecordInput({
        metadata: { nested: { a: 1, z: 2 }, origin: 'test' },
        createdAt: createRecordInput().timestamp,
      }),
    );

    mutablePayload.label = 'changed after creation';

    expect(first.payload.label).toBe('captured');
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.payload)).toBe(true);
    expect(Object.isFrozen(first.metadata.nested)).toBe(true);
    expect(first.hash).toBe(second.hash);
  });

  it('rejects malformed payloads before an event is created', () => {
    const invalidInput = {
      ...createRecordInput(),
      payload: { label: 7 },
    } as unknown as BaseEventInput<RecordPayload>;

    expect(() => createEvent(recordSchemaV1, invalidInput)).toThrow(KernelError);
  });

  it('rejects self and duplicate references without embedding referenced event data', () => {
    const event = createRecordEvent();
    const parentEventId = unwrapEventValidation(validateEventId('evt_parent_0001'));
    const result = validateEvent(recordSchemaV1, {
      ...event,
      references: [
        { eventId: event.id, relation: 'related_to' },
        { eventId: parentEventId, relation: 'related_to' },
        { eventId: parentEventId, relation: 'related_to' },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(['self_event_reference', 'duplicate_event_reference']),
      );
    }
  });

  it('uses the canonical evidence fields to calculate a stable SHA-256 hash', () => {
    const event = createRecordEvent();
    expect(computeEventHash(event)).toBe(event.hash);
    expect(event.hash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });
});
