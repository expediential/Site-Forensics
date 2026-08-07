import { describe, expect, it } from 'vitest';

import {
  SettingsError,
  SettingsManager,
  WebExtensionSettingsStore,
  defaultBrowserScopeSettings,
  validateSettings,
  type BrowserScopeSettings,
} from '@/core/settings';

describe('SettingsManager', () => {
  it('returns immutable privacy-preserving defaults until settings are saved', async () => {
    const manager = new SettingsManager(new InMemorySettingsStore());

    const settings = await manager.load();

    expect(settings).toEqual(defaultBrowserScopeSettings);
    expect(Object.isFrozen(settings)).toBe(true);
  });

  it('persists validated retention changes through the configured storage boundary', async () => {
    const store = new InMemorySettingsStore();
    const manager = new SettingsManager(store);

    await expect(manager.update({ retentionPolicy: '7_days' })).resolves.toMatchObject({
      retentionPolicy: '7_days',
    });
    await expect(manager.load()).resolves.toMatchObject({ retentionPolicy: '7_days' });
  });

  it('rejects malformed persisted data and unsupported versions without silently resetting it', () => {
    expect(() => validateSettings({ schemaVersion: 2, retentionPolicy: '24_hours' })).toThrow(
      SettingsError,
    );
    expect(() => validateSettings({ schemaVersion: 1, retentionPolicy: 'forever' })).toThrow(
      SettingsError,
    );
  });

  it('adapts promise-based WebExtension local storage and surfaces storage failures', async () => {
    const records = new Map<string, unknown>();
    const storage = new WebExtensionSettingsStore({
      async get(key) {
        return { [key]: records.get(key) };
      },
      async set(items) {
        for (const [key, value] of Object.entries(items)) {
          records.set(key, value);
        }
      },
    });
    const manager = new SettingsManager(storage);

    await manager.update({ retentionPolicy: '30_days' });
    await expect(manager.load()).resolves.toMatchObject({ retentionPolicy: '30_days' });
  });
});

class InMemorySettingsStore {
  #value: BrowserScopeSettings | undefined;

  public async read(): Promise<unknown> {
    return this.#value;
  }

  public async write(value: BrowserScopeSettings): Promise<void> {
    this.#value = value;
  }
}
