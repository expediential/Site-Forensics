import { deepFreezeJson, isJsonObject } from '@browserscope/sdk/utilities';

import { SettingsError } from './errors';
import {
  defaultBrowserScopeSettings,
  retentionPolicies,
  type BrowserScopeSettings,
  type SettingsUpdate,
} from './types';

/** Minimal asynchronous persistence abstraction for settings storage. */
export interface SettingsStore {
  readonly read: () => Promise<unknown>;
  readonly write: (value: BrowserScopeSettings) => Promise<void>;
}

/** Loads, validates, updates, and freezes BrowserScope local preferences. */
export class SettingsManager {
  readonly #store: SettingsStore;

  public constructor(store: SettingsStore) {
    this.#store = store;
  }

  /** Loads persisted settings or returns immutable defaults for a first-run installation. */
  public async load(): Promise<BrowserScopeSettings> {
    const persisted = await this.#store.read();
    if (persisted === undefined) {
      return defaultBrowserScopeSettings;
    }

    return validateSettings(persisted);
  }

  /** Validates and durably saves a replacement snapshot derived from the current settings. */
  public async update(update: SettingsUpdate): Promise<BrowserScopeSettings> {
    if (!isJsonObject(update)) {
      throw new SettingsError('SETTINGS_INVALID', 'Settings update must be a plain object.');
    }

    const current = await this.load();
    const next = validateSettings({ ...current, ...update });
    await this.#store.write(next);
    return next;
  }
}

/** Validates an untrusted persisted settings value and returns a deeply immutable snapshot. */
export function validateSettings(value: unknown): BrowserScopeSettings {
  if (!isJsonObject(value)) {
    throw new SettingsError('SETTINGS_INVALID', 'Persisted settings must be a plain JSON object.');
  }

  const unexpectedField = Object.keys(value).find(
    (key) => key !== 'schemaVersion' && key !== 'retentionPolicy',
  );
  if (unexpectedField !== undefined) {
    throw new SettingsError(
      'SETTINGS_INVALID',
      'Persisted settings contain an unsupported field.',
      {
        field: unexpectedField,
      },
    );
  }

  if (value.schemaVersion !== 1) {
    throw new SettingsError(
      typeof value.schemaVersion === 'number' ? 'SETTINGS_UNSUPPORTED_VERSION' : 'SETTINGS_INVALID',
      'Persisted settings use an unsupported schema version.',
    );
  }

  if (
    typeof value.retentionPolicy !== 'string' ||
    !retentionPolicies.includes(value.retentionPolicy as (typeof retentionPolicies)[number])
  ) {
    throw new SettingsError(
      'SETTINGS_INVALID',
      'Persisted settings have an invalid retention policy.',
    );
  }

  return deepFreezeJson({
    schemaVersion: 1,
    retentionPolicy: value.retentionPolicy,
  }) as BrowserScopeSettings;
}
