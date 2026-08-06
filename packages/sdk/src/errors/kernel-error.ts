import type { JsonObject } from '../types/index.js';

/** Stable error codes used by SDK consumers to make recovery decisions. */
export type KernelErrorCode =
  | 'EVENT_HASH_MISMATCH'
  | 'EVENT_IMPORT_INVALID'
  | 'EVENT_MIGRATION_INVALID'
  | 'EVENT_MIGRATION_NOT_FOUND'
  | 'EVENT_SCHEMA_CONFLICT'
  | 'EVENT_SCHEMA_INVALID'
  | 'EVENT_SCHEMA_NOT_FOUND'
  | 'EVENT_VALIDATION_FAILED'
  | 'INVALID_JSON_VALUE'
  | 'UNSUPPORTED_SCHEMA_VERSION';

/**
 * A serializable SDK error. BrowserScope code must use the error code rather than matching
 * presentation text.
 */
export class KernelError extends Error {
  public readonly code: KernelErrorCode;
  public readonly details: JsonObject;

  public constructor(code: KernelErrorCode, message: string, details: JsonObject = {}) {
    super(message);
    this.name = 'KernelError';
    this.code = code;
    this.details = details;
  }

  /** Returns only JSON-safe error data suitable for logs or structured transport. */
  public toJSON(): JsonObject {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
