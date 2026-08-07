# BrowserScope Storage Layer

`IndexedDbEventLedger` is the sole persistence boundary for normalized primary events. It uses
IndexedDB because MV3 service workers can be terminated at any time; no in-memory state is treated
as authoritative.

## Guarantees

- A ledger is partitioned by a validated `InvestigationId` and starts in `recording` state.
- `append` validates every event through the registered Event System schema registry, assigns a
  durable sequence, and writes the event range plus its SHA-256 checkpoint in one transaction.
- A replay of the same event ID and hash is idempotent. Reusing an ID with different evidence is
  rejected. Freezing a ledger permanently rejects later primary-event appends.
- `verify` replays event hashes and checkpoint links to reveal accidental local corruption. This is
  an integrity diagnostic, not a claim of protection from a user or malware controlling the browser
  profile.

The storage layer intentionally does not persist browser objects, DOM nodes, raw content, secrets,
or derived findings. Retention policy and session descriptors belong to their dedicated modules.
