import { describe, expect, it } from 'vitest';

import { EventSchemaRegistry, KernelError, jsonEventCodec } from '../../../src/index.js';
import { createRecordEvent, recordSchemaV1 } from '../../support/event-fixtures.js';

describe('jsonEventCodec', () => {
  it('round-trips a canonical event through portable JSON', () => {
    const schemas = new EventSchemaRegistry();
    schemas.register(recordSchemaV1);
    const event = createRecordEvent();

    const serialized = jsonEventCodec.serialize(event, schemas);
    const deserialized = jsonEventCodec.deserialize(serialized, schemas);

    expect(serialized).toBe(jsonEventCodec.serialize(deserialized, schemas));
    expect(deserialized).toEqual(event);
    expect(Object.isFrozen(deserialized)).toBe(true);
  });

  it('rejects tampered content when the stored hash no longer matches', () => {
    const schemas = new EventSchemaRegistry();
    schemas.register(recordSchemaV1);
    const event = createRecordEvent();
    const tampered = JSON.parse(jsonEventCodec.serialize(event, schemas)) as {
      payload: { label: string };
    };
    tampered.payload.label = 'altered';

    expect(() => jsonEventCodec.deserialize(JSON.stringify(tampered), schemas)).toThrow(
      KernelError,
    );
  });
});
