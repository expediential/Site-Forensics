import {
  createEvent,
  unwrapEventValidation,
  validateEventId,
  validateEventObject,
  validateEventTimestamp,
  validateEventType,
  validateEventVersion,
  type BaseEventInput,
  type EventMetadata,
  type EventPayload,
  type EventSchema,
  type EventValidationResult,
} from '../../src/events/index.js';

export interface RecordPayload extends EventPayload {
  readonly label: string;
}

export interface VersionTwoRecordPayload extends EventPayload {
  readonly label: string;
  readonly sequence: number;
}

const recordType = unwrapEventValidation(validateEventType('test.record'));
const versionOne = unwrapEventValidation(validateEventVersion(1));
const versionTwo = unwrapEventValidation(validateEventVersion(2));

export const recordSchemaV1: EventSchema<RecordPayload> = {
  type: recordType,
  category: 'system',
  version: versionOne,
  validatePayload(value: unknown): EventValidationResult<RecordPayload> {
    if (isRecordPayload(value)) {
      return { success: true, value };
    }

    return {
      success: false,
      issues: [
        {
          path: [],
          code: 'invalid_record_payload',
          message: 'Record payload requires a string label.',
        },
      ],
    };
  },
};

export const recordSchemaV2: EventSchema<VersionTwoRecordPayload> = {
  type: recordType,
  category: 'system',
  version: versionTwo,
  validatePayload(value: unknown): EventValidationResult<VersionTwoRecordPayload> {
    if (isVersionTwoRecordPayload(value)) {
      return { success: true, value };
    }

    return {
      success: false,
      issues: [
        {
          path: [],
          code: 'invalid_record_payload_v2',
          message: 'Version 2 record payload requires label and sequence.',
        },
      ],
    };
  },
};

export function createRecordInput(
  overrides: Partial<BaseEventInput<RecordPayload, EventMetadata>> = {},
): BaseEventInput<RecordPayload, EventMetadata> {
  return {
    id: unwrapEventValidation(validateEventId('evt_record_0001')),
    schemaVersion: versionOne,
    timestamp: unwrapEventValidation(validateEventTimestamp('2026-08-06T12:00:00.000Z')),
    source: 'system',
    category: 'system',
    type: recordType,
    severity: 'info',
    confidence: 'high',
    payload: { label: 'captured' },
    metadata: { origin: 'test', nested: { z: 2, a: 1 } },
    references: [],
    createdAt: unwrapEventValidation(validateEventTimestamp('2026-08-06T12:00:01.000Z')),
    ...overrides,
  };
}

export function createRecordEvent(overrides: Partial<BaseEventInput<RecordPayload>> = {}) {
  return createEvent(recordSchemaV1, createRecordInput(overrides));
}

function isRecordPayload(value: unknown): value is RecordPayload {
  const eventObject = validateEventObject(value);
  return eventObject.success && typeof eventObject.value.label === 'string';
}

function isVersionTwoRecordPayload(value: unknown): value is VersionTwoRecordPayload {
  const eventObject = validateEventObject(value);
  return (
    eventObject.success &&
    typeof eventObject.value.label === 'string' &&
    typeof eventObject.value.sequence === 'number' &&
    Number.isSafeInteger(eventObject.value.sequence)
  );
}
