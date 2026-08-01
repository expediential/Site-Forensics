import { chromium, expect, test } from '@playwright/test';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

test('loads the packaged Manifest V3 extension', async () => {
  const extensionPath = resolve('.output/chrome-mv3');
  await access(join(extensionPath, 'manifest.json'));

  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    const serviceWorker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));

    expect(serviceWorker.url()).toMatch(/^chrome-extension:\/\/[a-z]{32}\//u);
  } finally {
    await context.close();
  }
});
