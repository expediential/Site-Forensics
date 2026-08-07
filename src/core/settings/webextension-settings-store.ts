import type { BrowserScopeSettings } from './types';
import { SettingsError } from './errors';
import type { SettingsStore } from './settings-manager';

const settingsStorageKey = 'browserscope.settings';

/** Promise-based subset shared by Chromium MV3 and Firefox WebExtension storage areas. */
export interface WebExtensionStorageArea {
  readonly get: (keys: string) => Promise<Record<string, unknown>>;
  readonly set: (items: Record<string, unknown>) => Promise<void>;
}

/** Adapts a WebExtension `storage.local` area to the settings persistence contract. */
export class WebExtensionSettingsStore implements SettingsStore {
  readonly #storageArea: WebExtensionStorageArea;

  public constructor(storageArea: WebExtensionStorageArea) {
    this.#storageArea = storageArea;
  }

  public async read(): Promise<unknown> {
    try {
      return (await this.#storageArea.get(settingsStorageKey))[settingsStorageKey];
    } catch (error) {
      throw unavailable(error);
    }
  }

  public async write(value: BrowserScopeSettings): Promise<void> {
    try {
      await this.#storageArea.set({ [settingsStorageKey]: value });
    } catch (error) {
      throw unavailable(error);
    }
  }
}

function unavailable(error: unknown): SettingsError {
  return new SettingsError(
    'SETTINGS_STORAGE_UNAVAILABLE',
    'Local extension storage is unavailable.',
    {
      name: error instanceof Error ? error.name : 'UnknownError',
    },
  );
}
