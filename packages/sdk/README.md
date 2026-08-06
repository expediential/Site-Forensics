# BrowserScope SDK

`@browserscope/sdk` contains browser-agnostic contracts and kernel primitives. It has no imports
from browser extension APIs, DOM APIs, WXT, React, or UI packages.

## Public modules

- `@browserscope/sdk`: stable package entry point.
- `@browserscope/sdk/errors`: typed, JSON-safe kernel errors.
- `@browserscope/sdk/types`: JSON boundary types.
- `@browserscope/sdk/utilities`: deterministic JSON validation and serialization.
- `@browserscope/sdk/events`: immutable events, schema registry, migrations, canonical JSON codec,
  and deterministic SHA-256 hashes.

Events are created from a registered schema, copied and deeply frozen, then hashed from canonical
evidence content. Hashes intentionally exclude `createdAt`, because record-creation time is
transient and must not change evidence identity. Schema upgrades produce a new immutable in-memory
event while retaining the original record and its hash. A type's category is fixed across schema
versions, so an upgrade cannot silently change its semantic family.

The finding, collector, analyzer, timeline, risk, permission, message, storage, and logging
contracts will be added as their own tested Phase 2 subsystems. Nothing in this package is a browser
feature or a runtime collector.

## Development

Run `pnpm --filter @browserscope/sdk test` for unit tests plus a built-package integration test.
