# BrowserScope — UX Design and Delivery Roadmap

## 1. Information architecture

```text
Action popup
  Site identity + collection scope
  Four posture cards + coverage
  Primary: Scan this page / View active scan
  Secondary: Data controls, settings

Inspector (side panel where supported; full tab fallback)
  Overview | Timeline | Evidence graph | Security | Privacy | Behaviour
  Search and filters
  Finding detail drawer
  Export / AI (opt-in) / delete controls
```

The popup deliberately does not contain every section. It answers “what can I know now?” and gives one next action. The inspector serves the evidence workflow. Chromium's Side Panel API is MV3/Chrome 114+; browsers without a suitable panel use an extension tab without losing functionality. [Chrome Side Panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)

## 2. Screen behaviour

### States that must be designed, not hidden

| State                         | UI response                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| No site permission            | Explain the exact host access needed; offer the smallest grant.                                                    |
| Restricted/unsupported page   | `This page cannot be inspected by extensions` plus browser-provided reason where known; no misleading empty score. |
| Passive only                  | Show what was and was not collected; Deep scan is a capability-expanding action.                                   |
| Deep scan live                | Live timer, pause/stop, event rate, collector health, and an unobtrusive active indicator.                         |
| Late scan                     | Show “Events before HH:MM:SS are not covered.”                                                                     |
| Overflow                      | Show a coverage gap and which collector was sampled/stopped.                                                       |
| No findings                   | “No configured findings in the observed window,” never “safe.”                                                     |
| AI disabled/offline           | Deterministic explanations remain available; explain no data leaves device.                                        |
| Investigation armed/recording | Prominent scope chip, elapsed time, capabilities, coverage health, pause/stop; “recording” never means complete.   |
| Investigation frozen          | Immutable ledger badge, rule/collector versions, replay action, export and delete.                                 |
| Evidence replay               | Play/pause/speed/cursor controls alter only the local projection; UI states plainly that pages are not replayed.   |

### Visual language

Use quiet neutrals and one semantic accent per category. Red denotes a direct high-severity evidence-backed condition (e.g., named feed match), amber denotes caution/context, blue/gray denotes information, and green is reserved for a concrete configuration fact—not trust. Motion is short, optional, and never hides changing security state. Use plain labels before technical terminology; progressive disclosure puts raw evidence behind an “Evidence” disclosure.

### Accessibility and content rules

- A posture card has text (“Privacy posture 58, coverage 72%”), not color alone.
- Timeline is a semantic ordered list with keyboard navigation and an alternate compact table.
- Charts expose a data table and screen-reader summary.
- Every finding follows: **Observed → why it may matter → common benign use → limits → evidence**.
- Copy forbids “clean,” “safe,” “virus,” “stealing,” or causal claims without direct evidence.

### Timeline-first investigation flow

1. The popup shows one primary action: **Start investigation**. The default scope is Current tab and the panel makes extra capabilities opt-in.
2. The recording header is compact: scope, duration, source health, stop. It does not show a running risk score as if it were a verdict.
3. The timeline is the landing view: ordered event clusters, unmissable gaps, filters for direct/instrumented/derived evidence, and evidence expansion.
4. Selecting an event opens a drawer with raw-safe metadata, source/capability/coverage, relationships, related findings, and user pin/comment controls.
5. The graph is an alternate, queryable relationship projection; its default is a focused neighborhood around the selected event, not an unreadable global hairball.
6. On Stop, a review screen explains what was recorded, what was not, and which conclusions are derived. “Replay” opens the frozen local ledger at time zero.

Search, zoom, grouping, filters, bookmarks, pins, comments, related events, time ranges, multi-tab view, and export belong to the inspector—not the popup. Comments are local annotations; bookmarks/pins never alter evidence or score.

## 3. Phased roadmap

| Phase                     | Scope                                                                                                                                                                                    | Explicit exclusions / exit gate                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Foundations           | WXT/TS/React project, capability adapter, schema contracts, IndexedDB/migrations, permission UX, test harness, design tokens                                                             | No collectors until threat-model and redaction tests are approved.                                                                                |
| 1 — Trustworthy MVP       | Current-tab manual scan; document/security-header/script/iframe metadata; network metadata; local events/findings; popup + inspector tab; timeline/search; data deletion/redacted export | No cookie values, no main-world probe, no reputation/AI, no all-sites default. Ship only after Chrome/Edge performance and restricted-page tests. |
| 1.5 — Consent-based depth | Cookie metadata, per-site passive mode, side-panel progressive enhancement, DOM summary observer, posture coverage, retention settings                                                   | No debugger/CDP; no remote service. Revalidate permissions/store copy.                                                                            |
| 2.0 — Advanced evidence   | Time-bounded main-world runtime probe, IndexedDB/cache metadata summaries, signed rule packs, optional domain reputation, optional remote AI with REB preview, Firefox capability build  | CDP remains experimental behind explicit Advanced mode. Firefox release requires separate parity matrix, not full feature parity.                 |
| Later research            | Enterprise policy deployment, local on-device model, analyst export format, debugger/CDP investigation mode                                                                              | Requires fresh privacy/security review, user research, and target-browser compatibility testing.                                                  |

## 4. Implementation sequence

Each feature is complete only with schema, permission decision, unit/integration/E2E tests, accessible UI copy, telemetry/privacy impact statement, documentation, and performance measurement:

1. Capability/permission/session foundation.
2. URL canonicalization, redaction, IndexedDB events and retention.
3. Passive document + response-security-header collection.
4. Network lifecycle metadata and third-party aggregation.
5. Evidence/finding engine and posture cards.
6. Inspector timeline, search, deletion, redacted export.
7. Cookie metadata as an explicitly granted feature.
8. Deep-scan DOM/runtime probe, one narrowly scoped API family at a time.
9. Optional enrichment, then optional AI.

This order makes the first usable release auditable before it becomes more invasive.
