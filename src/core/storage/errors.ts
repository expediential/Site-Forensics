import type { JsonObject } from '@browserscope/sdk/types';

/** Stable storage failure codes for recoverable recorder diagnostics. */
export type StorageErrorCode =
  | 'DATABASE_BLOCKED'
  | 'DATABASE_OPEN_FAILED'
  | 'DATABASE_TRANSACTION_FAILED'
  | 'EVENT_ALREADY_EXISTS'
  | 'EVENT_INVALID'
  | 'INVESTIGATION_FROZEN'
  | 'INVESTIGATION_NOT_FOUND'
  | 'INVALID_APPEND_BATCH'
  | 'INVALID_INVESTIGATION_ID'
  | 'INVALID_READ_PAGE';

/** Serializable error raised by the local persistence boundary. */
export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public readonly details: JsonObject;

  public constructor(code: StorageErrorCode, message: string, details: JsonObject = {}) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.details = details;
  }
}
