# Contributing to BrowserScope

Read the architecture documents in [`docs/`](docs/) before proposing implementation changes. The
event ledger, privacy boundary, capability model, and evidence provenance are non-negotiable
contracts unless a documented browser/API blocker is discovered.

## Before opening a pull request

1. Keep changes focused on one roadmap slice.
2. Add unit and integration tests for every behavioural change.
3. Run `pnpm check`; run `pnpm test:e2e` for extension-surface changes.
4. Document any new browser permission, data field, event kind, or remote flow.
5. Do not add remote executable code, raw sensitive browser data, or broad permissions for future
   convenience.

## Code standards

TypeScript is strict. Prefer small composable modules, schema-validated boundaries, and evidence
references over implicit state. Do not use `any` at trust boundaries. User annotations and AI output
are derived data; neither can modify primary evidence.
