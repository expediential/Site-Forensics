import { KernelError } from '../errors/index.js';
import { isJsonObject } from '../utilities/index.js';
import type { JsonObject } from '../types/index.js';

import {
  eventCategories,
  eventConfidences,
  eventReferenceRelations,
  eventSeverities,
  eventSources,
  type EventCategory,
  type EventConfidence,
  type EventHash,
  type EventId,
  type EventReferenceRelation,
  type EventSeverity,
  type EventSource,
  type EventTimestamp,
  type EventType,
  type EventVersion,
} from './types.js';

/** A precise validation failure suitable for UI-safe diagnostics and tests. */
export interface EventValidationIssue {
  readonly path: readonly string[];
  readonly code: string;
  readonly message: string;
}

/** Result of runtime event validation without exception-driven control flow. */
export type EventValidationResult<TValue> =
  | { readonly success: true; readonly value: TValue }
  | { readonly success: false; readonly issues: readonly EventValidationIssue[] };

/** Converts a validation result into a typed SDK error for public creation/import APIs. */
export function unwrapEventValidation<TValue>(result: EventValidationResult<TValue>): TValue {
  if (result.success) {
    return result.value;
  }

  throw new KernelError('EVENT_VALIDATION_FAILED', 'Event validation failed.', {
    issues: result.issues.map((issue) => ({
      path: [...issue.path],
      code: issue.code,
      message: issue.message,
    })),
  });
}

/** Validates and brands an event ID without generating global runtime state. */
export function validateEventId(value: unknown): EventValidationResult<EventId> {
  return validateStringPattern(
    value,
    /^evt_[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/u,
    'event ID',
    (value) => value as EventId,
  );
}

/** Validates and brands a dotted event type identifier. */
export function validateEventType(value: unknown): EventValidationResult<EventType> {
  return validateStringPattern(
    value,
    /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u,
    'event type',
    (value) => value as EventType,
  );
}

/** Validates and brands a positive integer event schema version. */
export function validateEventVersion(value: unknown): EventValidationResult<EventVersion> {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1) {
    return success(value as EventVersion);
  }

  return failure(
    [],
    'invalid_event_version',
    'Event schema version must be a positive safe integer.',
  );
}

/** Validates a canonical ISO-8601 UTC timestamp. */
export function validateEventTimestamp(value: unknown): EventValidationResult<EventTimestamp> {
  if (typeof value !== 'string') {
    return failure([], 'invalid_timestamp', 'Event timestamp must be an ISO-8601 UTC string.');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    return failure(
      [],
      'invalid_timestamp',
      'Event timestamp must be a canonical ISO-8601 UTC string.',
    );
  }

  return success(value as EventTimestamp);
}

/** Validates and brands a SHA-256 event hash. */
export function validateEventHash(value: unknown): EventValidationResult<EventHash> {
  return validateStringPattern(
    value,
    /^sha256:[a-f0-9]{64}$/u,
    'event hash',
    (value) => value as EventHash,
  );
}

/** Validates a closed set of architecture-defined event enum values. */
export function validateEventCategory(value: unknown): EventValidationResult<EventCategory> {
  return validateEnum(value, eventCategories, 'event category');
}

/** Validates a closed set of trusted producer classes. */
export function validateEventSource(value: unknown): EventValidationResult<EventSource> {
  return validateEnum(value, eventSources, 'event source');
}

/** Validates a closed set of evidence severity values. */
export function validateEventSeverity(value: unknown): EventValidationResult<EventSeverity> {
  return validateEnum(value, eventSeverities, 'event severity');
}

/** Validates a closed set of evidence confidence values. */
export function validateEventConfidence(value: unknown): EventValidationResult<EventConfidence> {
  return validateEnum(value, eventConfidences, 'event confidence');
}

/** Validates a closed set of event reference relationship values. */
export function validateEventReferenceRelation(
  value: unknown,
): EventValidationResult<EventReferenceRelation> {
  return validateEnum(value, eventReferenceRelations, 'event reference relation');
}

/** Validates a JSON-safe event payload or metadata object. */
export function validateEventObject(value: unknown): EventValidationResult<JsonObject> {
  if (isJsonObject(value)) {
    return success(value);
  }

  return failure(
    [],
    'invalid_event_object',
    'Event payload and metadata must be plain JSON objects.',
  );
}

function validateStringPattern<TValue extends string>(
  value: unknown,
  pattern: RegExp,
  label: string,
  brand: (value: string) => TValue,
): EventValidationResult<TValue> {
  if (typeof value === 'string' && pattern.test(value)) {
    return success(brand(value));
  }

  return failure([], `invalid_${label.replaceAll(' ', '_')}`, `Invalid ${label}.`);
}

function validateEnum<TValue extends string>(
  value: unknown,
  allowedValues: readonly TValue[],
  label: string,
): EventValidationResult<TValue> {
  if (typeof value === 'string' && allowedValues.includes(value as TValue)) {
    return success(value as TValue);
  }

  return failure([], `invalid_${label.replaceAll(' ', '_')}`, `Invalid ${label}.`);
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
