import {
  createEvent,
  unwrapEventValidation,
  validateEventId,
  validateEventObject,
  validateEventTimestamp,
  validateEventType,
  validateEventVersion,
  type BaseEvent,
  type BaseEventInput,
  type EventMetadata,
  type EventPayload,
  type EventSchema,
  type EventValidationResult,
} from '@browserscope/sdk/events';

export interface StorageEventPayload extends EventPayload {
  readonly label: string;
}

const storageEventType = unwrapEventValidation(validateEventType('test.storage_record'));
const storageEventVersion = unwrapEventValidation(validateEventVersion(1));

export const storageEventSchema: EventSchema<StorageEventPayload> = {
  type: storageEventType,
  category: 'system',
  version: storageEventVersion,
  validatePayload(value: unknown): EventValidationResult<StorageEventPayload> {
    const eventObject = validateEventObject(value);
    if (eventObject.success && typeof eventObject.value.label === 'string') {
      return { success: true, value: eventObject.value as StorageEventPayload };
    }

    return {
      success: false,
      issues: [
        { path: [], code: 'invalid_storage_test_payload', message: 'A string label is required.' },
      ],
    };
  },
};

export function createStorageTestEvent(
  suffix: string,
  label = `event-${suffix}`,
): BaseEvent<StorageEventPayload, EventMetadata> {
  const input: BaseEventInput<StorageEventPayload, EventMetadata> = {
    id: unwrapEventValidation(validateEventId(`evt_storage_${suffix}`)),
    schemaVersion: storageEventVersion,
    timestamp: unwrapEventValidation(validateEventTimestamp('2026-08-07T12:00:00.000Z')),
    source: 'system',
    category: 'system',
    type: storageEventType,
    severity: 'info',
    confidence: 'high',
    payload: { label },
    metadata: { fixture: 'storage' },
    references: [],
    createdAt: unwrapEventValidation(validateEventTimestamp('2026-08-07T12:00:01.000Z')),
  };
  return createEvent(storageEventSchema, input);
}
