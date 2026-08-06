import { describe, expect, it } from 'vitest';

import { EventMigrationRegistry, EventSchemaRegistry, KernelError } from '../../../src/index.js';
import { createRecordEvent, recordSchemaV1, recordSchemaV2 } from '../../support/event-fixtures.js';

describe('EventMigrationRegistry', () => {
  it('migrates through a deterministic schema chain without mutating the original event', () => {
    const schemas = new EventSchemaRegistry();
    schemas.register(recordSchemaV1);
    schemas.register(recordSchemaV2);
    const migrations = new EventMigrationRegistry();
    migrations.register({
      type: recordSchemaV1.type,
      fromVersion: recordSchemaV1.version,
      toVersion: recordSchemaV2.version,
      migrate(event) {
        const label = event.payload.label;
        if (typeof label !== 'string') {
          throw new Error('Invalid version 1 record payload.');
        }

        return {
          payload: { label, sequence: 0 },
          metadata: { migration: 'v2' },
          references: event.references,
        };
      },
    });
    const original = createRecordEvent();

    const migrated = migrations.migrateToLatest(original, schemas);

    expect(migrated.original).toBe(original);
    expect(migrated.event.schemaVersion).toBe(recordSchemaV2.version);
    expect(migrated.event.payload).toEqual({ label: 'captured', sequence: 0 });
    expect(migrated.event.hash).not.toBe(original.hash);
    expect(migrated.appliedVersions).toEqual([recordSchemaV2.version]);
    expect(original.schemaVersion).toBe(recordSchemaV1.version);
  });

  it('fails closed when a required migration is absent', () => {
    const schemas = new EventSchemaRegistry();
    schemas.register(recordSchemaV1);
    schemas.register(recordSchemaV2);

    expect(() =>
      new EventMigrationRegistry().migrateToLatest(createRecordEvent(), schemas),
    ).toThrow(KernelError);
  });

  it('rejects a migration whose output does not satisfy its destination schema', () => {
    const schemas = new EventSchemaRegistry();
    schemas.register(recordSchemaV1);
    schemas.register(recordSchemaV2);
    const migrations = new EventMigrationRegistry();
    migrations.register({
      type: recordSchemaV1.type,
      fromVersion: recordSchemaV1.version,
      toVersion: recordSchemaV2.version,
      migrate(event) {
        return {
          payload: event.payload,
          metadata: event.metadata,
          references: event.references,
        };
      },
    });

    expect(() => migrations.migrateToLatest(createRecordEvent(), schemas)).toThrow(KernelError);
  });
});
