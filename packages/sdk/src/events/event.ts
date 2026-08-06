import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';

import {
  cloneJsonValue,
  deepFreezeJson,
  isJsonObject,
  stableStringify,
} from '../utilities/index.js';
import type { JsonObject } from '../types/index.js';

import { assertEventSchema, type EventSchema } from './schema.js';
import type {
  BaseEvent,
  BaseEventInput,
  EventHash,
  EventMetadata,
  EventPayload,
  EventReference,
} from './types.js';
import {
  type EventValidationIssue,
  type EventValidationResult,
  unwrapEventValidation,
  validateEventCategory,
  validateEventConfidence,
  validateEventHash,
  validateEventId,
  validateEventObject,
  validateEventReferenceRelation,
  validateEventSeverity,
  validateEventSource,
  validateEventTimestamp,
  validateEventType,
  validateEventVersion,
} from './validation.js';

const eventFields = [
  'id',
  'schemaVersion',
  'timestamp',
  'source',
  'category',
  'type',
  'severity',
  'confidence',
  'payload',
  'metadata',
  'references',
  'hash',
  'createdAt',
] as const;

/** Creates an immutable event with a deterministic SHA-256 content hash. */
export function createEvent<
  TPayload extends EventPayload,
  TMetadata extends EventMetadata = EventMetadata,
>(
  schema: EventSchema<TPayload, TMetadata>,
  input: BaseEventInput<TPayload, TMetadata>,
): BaseEvent<TPayload, TMetadata> {
  assertEventSchema(schema);
  const validatedInput = unwrapEventValidation(validateEventInput(schema, input));
  const eventWithoutHash = {
    ...validatedInput,
    payload: cloneJsonValue(validatedInput.payload),
    metadata: cloneJsonValue(validatedInput.metadata),
    references: validatedInput.references.map((reference) => ({ ...reference })),
  };
  const hash = computeEventHash(eventWithoutHash);
  const event = { ...eventWithoutHash, hash };

  return deepFreezeJson(event as unknown as JsonObject) as unknown as BaseEvent<
    TPayload,
    TMetadata
  >;
}

/** Validates a serialized or untrusted event against a specific registered schema. */
export function validateEvent<
  TPayload extends EventPayload,
  TMetadata extends EventMetadata = EventMetadata,
>(
  schema: EventSchema<TPayload, TMetadata>,
  value: unknown,
): EventValidationResult<BaseEvent<TPayload, TMetadata>> {
  if (!isJsonObject(value)) {
    return failure([], 'invalid_event', 'Event must be a plain JSON object.');
  }

  const unexpectedField = Object.keys(value).find((key) => !eventFields.includes(key as never));
  if (unexpectedField !== undefined) {
    return failure(
      [unexpectedField],
      'unexpected_event_field',
      'Event contains an unsupported field.',
    );
  }

  const missingField = eventFields.find((field) => !(field in value));
  if (missingField !== undefined) {
    return failure([missingField], 'missing_event_field', 'Event is missing a required field.');
  }

  const id = validateEventId(value.id);
  const schemaVersion = validateEventVersion(value.schemaVersion);
  const timestamp = validateEventTimestamp(value.timestamp);
  const source = validateEventSource(value.source);
  const category = validateEventCategory(value.category);
  const type = validateEventType(value.type);
  const severity = validateEventSeverity(value.severity);
  const confidence = validateEventConfidence(value.confidence);
  const payload = schema.validatePayload(value.payload);
  const metadata = schema.validateMetadata?.(value.metadata) ?? validateEventObject(value.metadata);
  const references = validateEventReferences(value.references, id.success ? id.value : undefined);
  const hash = validateEventHash(value.hash);
  const createdAt = validateEventTimestamp(value.createdAt);

  const results = [
    withPath(id, 'id'),
    withPath(schemaVersion, 'schemaVersion'),
    withPath(timestamp, 'timestamp'),
    withPath(source, 'source'),
    withPath(category, 'category'),
    withPath(type, 'type'),
    withPath(severity, 'severity'),
    withPath(confidence, 'confidence'),
    withPath(payload, 'payload'),
    withPath(metadata, 'metadata'),
    withPath(references, 'references'),
    withPath(hash, 'hash'),
    withPath(createdAt, 'createdAt'),
  ];
  const issues = results.flatMap((result) => (result.success ? [] : result.issues));

  if (issues.length > 0) {
    return { success: false, issues };
  }

  if (
    unwrapEventValidation(type) !== schema.type ||
    unwrapEventValidation(category) !== schema.category ||
    unwrapEventValidation(schemaVersion) !== schema.version
  ) {
    return failure(
      [],
      'schema_identity_mismatch',
      'Event type, category, or schema version does not match the selected schema.',
    );
  }

  const event = {
    id: unwrapEventValidation(id),
    schemaVersion: unwrapEventValidation(schemaVersion),
    timestamp: unwrapEventValidation(timestamp),
    source: unwrapEventValidation(source),
    category: unwrapEventValidation(category),
    type: unwrapEventValidation(type),
    severity: unwrapEventValidation(severity),
    confidence: unwrapEventValidation(confidence),
    payload: unwrapEventValidation(payload),
    metadata: unwrapEventValidation(metadata) as TMetadata,
    references: unwrapEventValidation(references),
    hash: unwrapEventValidation(hash),
    createdAt: unwrapEventValidation(createdAt),
  } as BaseEvent<TPayload, TMetadata>;

  const expectedHash = computeEventHash(event);
  if (expectedHash !== event.hash) {
    return failure(
      ['hash'],
      'event_hash_mismatch',
      'Event hash does not match canonical event content.',
    );
  }

  return success(
    deepFreezeJson(cloneJsonValue(event as unknown as JsonObject)) as unknown as BaseEvent<
      TPayload,
      TMetadata
    >,
  );
}

/** Computes a SHA-256 hash of canonical evidence content, excluding creation-time and hash fields. */
export function computeEventHash(event: Omit<BaseEvent, 'hash'> | BaseEvent): EventHash {
  const canonicalContent = stableStringify({
    id: event.id,
    schemaVersion: event.schemaVersion,
    timestamp: event.timestamp,
    source: event.source,
    category: event.category,
    type: event.type,
    severity: event.severity,
    confidence: event.confidence,
    payload: event.payload as EventPayload,
    metadata: event.metadata as EventMetadata,
    references: event.references.map((reference) => ({
      eventId: reference.eventId,
      relation: reference.relation,
    })),
  });

  return `sha256:${bytesToHex(sha256(utf8ToBytes(canonicalContent)))}` as EventHash;
}

function validateEventInput<
  TPayload extends EventPayload,
  TMetadata extends EventMetadata = EventMetadata,
>(
  schema: EventSchema<TPayload, TMetadata>,
  input: BaseEventInput<TPayload, TMetadata>,
): EventValidationResult<BaseEventInput<TPayload, TMetadata>> {
  const candidate = {
    ...input,
    hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  };
  const validated = validateEvent(schema, {
    ...candidate,
    hash: computeEventHash(candidate as Omit<BaseEvent, 'hash'>),
  });

  if (!validated.success) {
    return validated;
  }

  const { hash, ...validatedInput } = validated.value;
  void hash;
  return success(validatedInput as BaseEventInput<TPayload, TMetadata>);
}

function validateEventReferences(
  value: unknown,
  eventId: EventReference['eventId'] | undefined,
): EventValidationResult<readonly EventReference[]> {
  if (!Array.isArray(value)) {
    return failure([], 'invalid_event_references', 'Event references must be an array.');
  }

  const seenReferences = new Set<string>();
  const references: EventReference[] = [];
  const issues: EventValidationIssue[] = [];

  for (const [index, entry] of value.entries()) {
    if (!isJsonObject(entry)) {
      issues.push({
        path: [String(index)],
        code: 'invalid_event_reference',
        message: 'Event reference must be a plain JSON object.',
      });
      continue;
    }

    const referencedEventId = validateEventId(entry.eventId);
    const relation = validateEventReferenceRelation(entry.relation);
    const unexpectedKeys = Object.keys(entry).filter(
      (key) => key !== 'eventId' && key !== 'relation',
    );

    if (unexpectedKeys.length > 0 || Object.keys(entry).length !== 2) {
      issues.push({
        path: [String(index)],
        code: 'invalid_event_reference_fields',
        message: 'Event reference must include only eventId and relation.',
      });
      continue;
    }

    if (!referencedEventId.success || !relation.success) {
      issues.push(
        ...(referencedEventId.success
          ? []
          : referencedEventId.issues.map((issue) => ({
              ...issue,
              path: [String(index), ...issue.path],
            }))),
        ...(relation.success
          ? []
          : relation.issues.map((issue) => ({ ...issue, path: [String(index), ...issue.path] }))),
      );
      continue;
    }

    if (eventId !== undefined && referencedEventId.value === eventId) {
      issues.push({
        path: [String(index), 'eventId'],
        code: 'self_event_reference',
        message: 'Event cannot reference itself.',
      });
      continue;
    }

    const referenceKey = `${referencedEventId.value}:${relation.value}`;
    if (seenReferences.has(referenceKey)) {
      issues.push({
        path: [String(index)],
        code: 'duplicate_event_reference',
        message: 'Event references must not duplicate an event ID and relation pair.',
      });
      continue;
    }

    seenReferences.add(referenceKey);
    references.push({ eventId: referencedEventId.value, relation: relation.value });
  }

  return issues.length > 0 ? { success: false, issues } : success(references);
}

function withPath<TValue>(
  result: EventValidationResult<TValue>,
  rootPath: string,
): EventValidationResult<TValue> {
  if (result.success) {
    return result;
  }

  return {
    success: false,
    issues: result.issues.map((issue) => ({ ...issue, path: [rootPath, ...issue.path] })),
  };
}

function success<TValue>(value: TValue): EventValidationResult<TValue> {
  return { success: true, value };
}

function failure<TValue>(
  path: readonly string[],
  code: string,
  message: string,
): EventValidationResult<TValue> {
  return { success: false, issues: [{ path, code, message }] };
}
