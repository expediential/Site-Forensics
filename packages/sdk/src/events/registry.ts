import { KernelError } from '../errors/index.js';

import { validateEvent } from './event.js';
import { assertEventSchema, type AnyEventSchema, type EventSchema } from './schema.js';
import type { BaseEvent, EventType, EventVersion } from './types.js';
import {
  type EventValidationResult,
  validateEventType,
  validateEventVersion,
} from './validation.js';

/** Runtime registry for versioned event schemas. */
export class EventSchemaRegistry {
  readonly #schemas = new Map<EventType, Map<EventVersion, AnyEventSchema>>();

  /** Registers a schema once for its `(type, version)` pair. */
  public register<TSchema extends AnyEventSchema>(schema: TSchema): TSchema {
    assertEventSchema(schema);
    const schemasForType =
      this.#schemas.get(schema.type) ?? new Map<EventVersion, AnyEventSchema>();

    const existingCategory = schemasForType.values().next().value?.category;
    if (existingCategory !== undefined && existingCategory !== schema.category) {
      throw new KernelError(
        'EVENT_SCHEMA_CONFLICT',
        'Event category must remain stable across schema versions of the same type.',
        {
          type: schema.type,
          existingCategory,
          category: schema.category,
        },
      );
    }

    if (schemasForType.has(schema.version)) {
      throw new KernelError(
        'EVENT_SCHEMA_CONFLICT',
        'Schema is already registered for this event type and version.',
        {
          type: schema.type,
          version: schema.version,
        },
      );
    }

    schemasForType.set(schema.version, schema);
    this.#schemas.set(schema.type, schemasForType);
    return schema;
  }

  /** Looks up an exact schema version without throwing for an unknown type. */
  public get(type: EventType, version: EventVersion): AnyEventSchema | undefined {
    return this.#schemas.get(type)?.get(version);
  }

  /** Returns the highest registered schema version for a type. */
  public getLatest(type: EventType): AnyEventSchema | undefined {
    const schemasForType = this.#schemas.get(type);
    if (schemasForType === undefined) {
      return undefined;
    }

    let latest: AnyEventSchema | undefined;
    for (const schema of schemasForType.values()) {
      if (latest === undefined || schema.version > latest.version) {
        latest = schema;
      }
    }

    return latest;
  }

  /** Returns registered schemas in deterministic type/version order. */
  public list(): readonly AnyEventSchema[] {
    return [...this.#schemas.values()]
      .flatMap((schemasForType) => [...schemasForType.values()])
      .sort((left, right) =>
        left.type === right.type ? left.version - right.version : left.type < right.type ? -1 : 1,
      );
  }

  /** Validates untrusted serialized event data using its embedded type and schema version. */
  public validate(value: unknown): EventValidationResult<BaseEvent> {
    if (value === null || typeof value !== 'object') {
      return failure('invalid_event', 'Event must be an object before schema lookup.');
    }

    const candidate = value as { readonly type?: unknown; readonly schemaVersion?: unknown };
    const type = validateEventType(candidate.type);
    const version = validateEventVersion(candidate.schemaVersion);

    if (!type.success || !version.success) {
      return {
        success: false,
        issues: [
          ...(type.success
            ? []
            : type.issues.map((issue) => ({ ...issue, path: ['type', ...issue.path] }))),
          ...(version.success
            ? []
            : version.issues.map((issue) => ({
                ...issue,
                path: ['schemaVersion', ...issue.path],
              }))),
        ],
      };
    }

    const schema = this.get(type.value, version.value);
    if (schema === undefined) {
      return failure(
        'unknown_event_schema',
        `No schema is registered for ${type.value} version ${version.value}.`,
      );
    }

    return validateEvent(schema, value);
  }

  /** Returns an exact schema or throws a typed error when the schema is absent. */
  public require(type: EventType, version: EventVersion): AnyEventSchema {
    const schema = this.get(type, version);
    if (schema === undefined) {
      throw new KernelError('EVENT_SCHEMA_NOT_FOUND', 'Event schema is not registered.', {
        type,
        version,
      });
    }

    return schema;
  }
}

/** Creates a schema registry from a fixed schema collection. */
export function createEventSchemaRegistry(schemas: readonly EventSchema[]): EventSchemaRegistry {
  const registry = new EventSchemaRegistry();
  for (const schema of schemas) {
    registry.register(schema);
  }

  return registry;
}

function failure(code: string, message: string): EventValidationResult<BaseEvent> {
  return { success: false, issues: [{ path: [], code, message }] };
}
