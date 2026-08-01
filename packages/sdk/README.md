# BrowserScope SDK

`@browserscope/sdk` contains browser-agnostic contracts and kernel primitives. It has no imports
from browser extension APIs, DOM APIs, WXT, React, or UI packages.

## Public modules

- `@browserscope/sdk`: stable package entry point.
- `@browserscope/sdk/errors`: typed, JSON-safe kernel errors.
- `@browserscope/sdk/types`: JSON boundary types.
- `@browserscope/sdk/utilities`: deterministic JSON validation and serialization.

The event, finding, collector, analyzer, timeline, risk, permission, message, storage, and logging
contracts will be added as their own tested Phase 2 subsystems. Nothing in this package is a browser
feature or a runtime collector.

## Development

Run `pnpm --filter @browserscope/sdk test` for unit tests plus a built-package integration test.
