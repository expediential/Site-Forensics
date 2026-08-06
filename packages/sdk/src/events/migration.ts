import { KernelError } from '../errors/index.js';

import { createEvent } from './event.js';
import type { EventSchemaRegistry } from './registry.js';
import type {
  BaseEvent,
  EventMetadata,
  EventPayload,
  EventReference,
  EventType,
  EventVersion,
} from './types.js';

/** JSON-safe data a migration may replace while preserving event identity and observation context. */
export interface EventMigrationOutput {
  readonly payload: EventPayload;
  readonly metadata: EventMetadata;
  readonly references: readonly EventReference[];
}

/** A deterministic one-way upgrade between two schema versions of the same event type. */
export interface EventMigration {
  readonly type: EventType;
  readonly fromVersion: EventVersion;
  readonly toVersion: EventVersion;
  readonly migrate: (event: BaseEvent) => EventMigrationOutput;
}

/** Result of upgrading an event while preserving the original immutable record. */
export interface MigratedEvent {
  readonly original: BaseEvent;
  readonly event: BaseEvent;
  readonly appliedVersions: readonly EventVersion[];
}

/** Registry of deterministic schema migrations. */
export class EventMigrationRegistry {
  readonly #migrations = new Map<EventType, Map<EventVersion, EventMigration>>();

  /** Registers exactly one forward migration from each `(type, fromVersion)` pair. */
  public register(migration: EventMigration): EventMigration {
    if (migration.toVersion <= migration.fromVersion) {
      throw new KernelError(
        'EVENT_MIGRATION_INVALID',
        'Event migration target version must be greater than its source version.',
        {
          type: migration.type,
          fromVersion: migration.fromVersion,
          toVersion: migration.toVersion,
        },
      );
    }

    const migrationsForType =
      this.#migrations.get(migration.type) ?? new Map<EventVersion, EventMigration>();
    if (migrationsForType.has(migration.fromVersion)) {
      throw new KernelError(
        'EVENT_SCHEMA_CONFLICT',
        'Migration is already registered from this version.',
        {
          type: migration.type,
          fromVersion: migration.fromVersion,
        },
      );
    }

    migrationsForType.set(migration.fromVersion, migration);
    this.#migrations.set(migration.type, migrationsForType);
    return migration;
  }

  /** Returns an exact forward migration without throwing when no path exists. */
  public get(type: EventType, fromVersion: EventVersion): EventMigration | undefined {
    return this.#migrations.get(type)?.get(fromVersion);
  }

  /** Upgrades an event to the highest registered schema version using a deterministic migration chain. */
  public migrateToLatest(event: BaseEvent, schemas: EventSchemaRegistry): MigratedEvent {
    const latestSchema = schemas.getLatest(event.type);
    if (latestSchema === undefined) {
      throw new KernelError(
        'EVENT_SCHEMA_NOT_FOUND',
        'Cannot migrate an event without a registered schema.',
        {
          type: event.type,
        },
      );
    }

    let migrated = event;
    const appliedVersions: EventVersion[] = [];

    while (migrated.schemaVersion < latestSchema.version) {
      const migration = this.get(migrated.type, migrated.schemaVersion);
      if (migration === undefined) {
        throw new KernelError(
          'EVENT_MIGRATION_NOT_FOUND',
          'No deterministic migration path is registered.',
          {
            type: migrated.type,
            fromVersion: migrated.schemaVersion,
            targetVersion: latestSchema.version,
          },
        );
      }

      const targetSchema = schemas.require(migrated.type, migration.toVersion);
      const output = migration.migrate(migrated);
      migrated = createEvent(targetSchema, {
        id: migrated.id,
        schemaVersion: targetSchema.version,
        timestamp: migrated.timestamp,
        source: migrated.source,
        category: migrated.category,
        type: migrated.type,
        severity: migrated.severity,
        confidence: migrated.confidence,
        payload: output.payload,
        metadata: output.metadata,
        references: output.references,
        createdAt: migrated.createdAt,
      });
      appliedVersions.push(targetSchema.version);
    }

    return { original: event, event: migrated, appliedVersions };
  }
}
