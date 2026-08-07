import type { JsonObject } from '@browserscope/sdk/types';

/** Stable settings failure codes for UI-safe recovery messaging. */
export type SettingsErrorCode =
  'SETTINGS_INVALID' | 'SETTINGS_STORAGE_UNAVAILABLE' | 'SETTINGS_UNSUPPORTED_VERSION';

/** Serializable error raised by the settings boundary. */
export class SettingsError extends Error {
  public readonly code: SettingsErrorCode;
  public readonly details: JsonObject;

  public constructor(code: SettingsErrorCode, message: string, details: JsonObject = {}) {
    super(message);
    this.name = 'SettingsError';
    this.code = code;
    this.details = details;
  }
}
