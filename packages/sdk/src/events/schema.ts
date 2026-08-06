import { KernelError } from '../errors/index.js';

import {
  type EventValidationIssue,
  type EventValidationResult,
  validateEventCategory,
  validateEventType,
  validateEventVersion,
} from './validation.js';
import type {
  EventCategory,
  EventMetadata,
  EventPayload,
  EventType,
  EventVersion,
} from './types.js';

/** Runtime contract for one version of one portable event type. */
export interface EventSchema<
  TPayload extends EventPayload = EventPayload,
  TMetadata extends EventMetadata = EventMetadata,
> {
  /** Stable dotted type identifier. */
  readonly type: EventType;
  /** Architecture-defined event family. */
  readonly category: EventCategory;
  /** Version understood by this exact schema. */
  readonly version: EventVersion;
  /** Validates and narrows untrusted payload input. */
  readonly validatePayload: (value: unknown) => EventValidationResult<TPayload>;
  /** Validates and narrows metadata when a type needs stronger guarantees than JSON safety. */
  readonly validateMetadata?: (value: unknown) => EventValidationResult<TMetadata>;
}

/** A schema may be registered only once per `(type, version)` pair. */
export type AnyEventSchema = EventSchema<EventPayload, EventMetadata>;

/** Throws a typed error unless a runtime schema descriptor is safe to register or execute. */
export function assertEventSchema(value: unknown): asserts value is AnyEventSchema {
  if (
    value === null ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throwInvalidSchema([
      {
        path: [],
        code: 'invalid_event_schema',
        message: 'Event schema must be a plain object.',
      },
    ]);
  }

  const schema = value as {
    readonly type?: unknown;
    readonly category?: unknown;
    readonly version?: unknown;
    readonly validatePayload?: unknown;
    readonly validateMetadata?: unknown;
  };
  const results = [
    withPath(validateEventType(schema.type), 'type'),
    withPath(validateEventCategory(schema.category), 'category'),
    withPath(validateEventVersion(schema.version), 'version'),
  ];
  const issues = results.flatMap((result) => (result.success ? [] : result.issues));

  if (typeof schema.validatePayload !== 'function') {
    issues.push({
      path: ['validatePayload'],
      code: 'invalid_schema_validator',
      message: 'Event schema must provide a payload validator function.',
    });
  }

  if (schema.validateMetadata !== undefined && typeof schema.validateMetadata !== 'function') {
    issues.push({
      path: ['validateMetadata'],
      code: 'invalid_schema_validator',
      message: 'Event schema metadata validator must be a function when present.',
    });
  }

  if (issues.length > 0) {
    throwInvalidSchema(issues);
  }
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

function throwInvalidSchema(issues: readonly EventValidationIssue[]): never {
  throw new KernelError('EVENT_SCHEMA_INVALID', 'Event schema is invalid.', {
    issues: issues.map((issue) => ({
      path: [...issue.path],
      code: issue.code,
      message: issue.message,
    })),
  });
}
