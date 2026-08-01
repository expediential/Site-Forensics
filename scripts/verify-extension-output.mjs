import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const outputDirectory = join(process.cwd(), '.output', 'chrome-mv3');
const manifestPath = join(outputDirectory, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

assert.equal(manifest.manifest_version, 3, 'The Chrome build must be Manifest V3.');
assert.equal(manifest.name, 'BrowserScope', 'The packaged extension name must be stable.');
assert.equal(
  manifest.action?.default_title,
  'BrowserScope',
  'The action title must be configured.',
);
assert.equal(
  manifest.background?.type,
  'module',
  'The background must be an ES module service worker.',
);
assert.ok(manifest.background?.service_worker, 'The background service worker must be emitted.');
assert.deepEqual(
  manifest.permissions,
  ['storage'],
  'Phase 1 must not request broad browser permissions.',
);

console.log(`Verified Manifest V3 output: ${manifestPath}`);
