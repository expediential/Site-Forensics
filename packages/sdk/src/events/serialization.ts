import { KernelError } from '../errors/index.js';
import { stableStringify } from '../utilities/index.js';
import type { JsonObject } from '../types/index.js';

import type { EventSchemaRegistry } from './registry.js';
import type { BaseEvent } from './types.js';

/** Portable event codec boundary; compression and encryption can wrap this codec in the future. */
export interface EventSerializationCodec {
  readonly contentType: string;
  readonly serialize: (event: BaseEvent, schemas: EventSchemaRegistry) => string;
  readonly deserialize: (serialized: string, schemas: EventSchemaRegistry) => BaseEvent;
}

/** Canonical JSON codec for portable, hash-verified event exports and imports. */
export const jsonEventCodec: EventSerializationCodec = {
  contentType: 'application/vnd.browserscope.event+json;version=1',
  serialize(event, schemas) {
    const validated = schemas.validate(event);
    if (!validated.success) {
      throw new KernelError('EVENT_VALIDATION_FAILED', 'Cannot serialize an invalid event.', {
        issues: validated.issues.map((issue) => ({
          path: [...issue.path],
          code: issue.code,
          message: issue.message,
        })),
      });
    }

    return stableStringify(validated.value as unknown as JsonObject);
  },
  deserialize(serialized, schemas) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized) as unknown;
    } catch {
      throw new KernelError('EVENT_IMPORT_INVALID', 'Event import is not valid JSON.');
    }

    const validated = schemas.validate(parsed);
    if (!validated.success) {
      const includesHashMismatch = validated.issues.some(
        (issue) => issue.code === 'event_hash_mismatch',
      );
      throw new KernelError(
        includesHashMismatch ? 'EVENT_HASH_MISMATCH' : 'EVENT_IMPORT_INVALID',
        includesHashMismatch
          ? 'Imported event hash does not match its content.'
          : 'Imported event is invalid.',
        {
          issues: validated.issues.map((issue) => ({
            path: [...issue.path],
            code: issue.code,
            message: issue.message,
          })),
        },
      );
    }

    return validated.value;
  },
};
