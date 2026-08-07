import { describe, expect, it } from 'vitest';

import {
  SettingsManager,
  WebExtensionSettingsStore,
  type BrowserScopeSettings,
} from '@/core/settings';

describe('WebExtensionSettingsStore integration', () => {
  it('persists versioned settings through a WebExtension-compatible local storage area', async () => {
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

    await manager.update({ retentionPolicy: 'immediate' });

    await expect(manager.load()).resolves.toEqual({
      schemaVersion: 1,
      retentionPolicy: 'immediate',
    } satisfies BrowserScopeSettings);
  });
});
