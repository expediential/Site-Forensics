# BrowserScope Settings Manager

`SettingsManager` owns the versioned, validated local preference snapshot. Its only current user
setting is the retention policy: immediate discard, 24 hours, 7 days, or 30 days. The default is
24 hours.

Settings are read from and written to a `SettingsStore`. `WebExtensionSettingsStore` adapts the
promise-based `storage.local` interface used by Chromium MV3 and Firefox. Corrupt or unsupported
persisted values fail closed; they are never silently reset or broadened.

Provider, AI, theme, permission-grant, and collection settings are intentionally absent until their
own privacy-reviewed modules exist.
