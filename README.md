# BrowserScope

BrowserScope is a local-first browser observability extension. It records only explicitly
permitted, privacy-minimized evidence and presents an investigation timeline, provenance graph,
and evidence-backed explanations. It is not an antivirus or a browser-wide activity recorder by
default.

## Status

Phase 1 (project foundation) is complete. The extension intentionally ships no browser-analysis
features yet. The architecture and implementation boundaries are documented in [`docs/`](docs/).

## Development

Requirements: Node.js 24.14+, pnpm 11.9+.

```sh
pnpm install
pnpm check
pnpm dev
```

Build a loadable Chromium extension with `pnpm build:chrome`. The generated artifact is in
`.output/chrome-mv3`; use `pnpm test:e2e` after installing Playwright Chromium.

## Privacy and permissions

The initial manifest requests only `storage`, which does not expose browsing data. Broader host,
network, cookie, navigation, download, or debugging permissions will be added only with their
corresponding tested feature, just-in-time permission UX, and architecture review.

## Quality gates

`pnpm check` runs formatting, linting, strict type-checking, unit tests, and a packaged-manifest
integration check. GitHub Actions runs Chromium/Firefox builds and a separate extension-load test.
