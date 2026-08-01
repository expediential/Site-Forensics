# BrowserScope — Local Data, Event, Timeline, and Risk Models

## 1. Local database

Database: `browserscope-v1` in IndexedDB. Encryption at rest is provided by the OS/browser profile; BrowserScope must not claim additional cryptographic protection. Secrets are excluded rather than “encrypted later.”

| Store            | Key                         | Important fields / indexes                                                       | Retention                 |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| `sessions`       | `sessionId`                 | tab/document/origin, state, capability snapshot, start/end, coverage             | policy-bound              |
| `events`         | `[sessionId, sequence]`     | kind, source, monotonic time, wall time, domain, frame, privacy class, payload   | policy-bound              |
| `findings`       | `findingId`                 | session, rule/version, severity, confidence, status, evidence IDs                | policy-bound              |
| `artifacts`      | `artifactId`                | hashed script identity, normalized header/security facts, source reference       | policy-bound              |
| `requestState`   | `[sessionId, requestId]`    | transient redirect/lifecycle join state                                          | delete on terminal/freeze |
| `aggregates`     | `sessionId`                 | domain counts, category posture, timeline buckets, coverage                      | policy-bound              |
| `preferences`    | key                         | retention, grants, theme, redaction, providers                                   | until changed             |
| `rulePacks`      | `[packId, version]`         | signed data, verification/status                                                 | until removed             |
| `exports`        | exportId                    | manifest only; no duplicate event copy                                           | 24h max                   |
| `investigations` | `investigationId`           | immutable scope descriptor, recorder state, clock/coverage manifest, ledger root | policy-bound              |
| `graphNodes`     | `[investigationId, nodeId]` | typed entity projection, first/last evidence IDs, safe label                     | regenerated               |
| `graphEdges`     | `[investigationId, edgeId]` | typed relationship, source/target, basis, confidence, evidence IDs               | regenerated               |
| `annotations`    | `annotationId`              | user pin/bookmark/comment, target event/node/edge, created time                  | policy-bound              |

Migrations are append-only and transactional. A failed migration leaves the prior DB untouched and disables collection with a recoverable diagnostic; it never drops user data automatically.

### Investigation descriptor and ledger integrity

```text
Investigation = {
  id, state: armed | recording | paused | frozen | deleted,
  scope: current_tab | site_workspace | selected_tabs | browser_wide_lab,
  target: { tabIds, allowedOrigins, includeSubframes },
  requestedCapabilities, grantedCapabilities,
  startedAt, stoppedAt, retentionPolicy,
  rulePackManifest, collectorManifest,
  coverageSummary, ledgerCheckpoint
}
```

Each append batch records the previous batch hash, canonical event-byte hash, resulting hash, sequence range, and writer version. On freeze, the system saves an application-generated **integrity manifest** (hashes, not a cryptographic claim about hostile local actors). Edits are never made to event records. User comments, tags, bookmarks, and false-positive dispositions are annotations that reference events; they do not change evidence.

## 2. Event model

```ts
// Conceptual contract, not implementation code.
EventEnvelope = {
  id: UUID;
  schemaVersion: 1;
  sessionId: UUID;
  sequence: bigint;
  observedAt: ISO8601;
  monotonicMs: number;
  source: 'browser-navigation' | 'browser-network' | 'browser-cookie' | 'browser-download' | 'content-dom' |
          'main-probe' | 'system' | 'user';
  observationKind: 'direct' | 'instrumented' | 'derived' | 'user-annotated';
  evidenceGrade: 'direct' | 'derived' | 'heuristic' | 'user-asserted';
  privacyClass: 'public-metadata' | 'sensitive-metadata';
  frame: { documentId?: string; frameId?: number; origin?: CanonicalOrigin };
  kind: EventKind;
  payload: EventPayload;       // discriminated, field-allowlisted
  sourceEventId?: string;
  dedupeKey: string;
}
```

`url` is intentionally not a raw URL field. The payload receives `resourceRef = { scheme, registrableDomain, pathTemplate?, sessionSaltedUrlHash }`; queries, fragments, credential syntax, cookie/storage/body values, filenames, and page text are rejected at the ingestion gate. `tabId`, `windowId`, and `frameId` are stored only when supplied by the relevant source. Browser IDs are local-session references, not globally meaningful identifiers.

Event kinds are intentionally behavioural, not raw logs:

| Family          | Kinds                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System          | `session_started`, `permission_changed`, `coverage_gap`, `collector_overflow`, `session_frozen`                                                                  |
| Investigation   | `investigation_armed`, `recording_started`, `recording_paused`, `recording_resumed`, `recording_stopped`, `integrity_verified`                                   |
| Browser context | `tab_created`, `tab_closed`, `tab_activated`, `navigation_started`, `navigation_committed`, `navigation_completed`, `navigation_failed`, `history_state_updated` |
| Document        | `document_loaded`, `security_headers_observed`, `csp_policy_observed`, `iframe_observed`, `form_metadata_observed`, `script_resource_observed`                   |
| Network         | `request_started`, `request_redirected`, `response_headers_observed`, `request_completed`, `request_failed`, `connection_opened`                                 |
| Storage         | `cookie_metadata_observed`, `cookie_changed`, `web_storage_key_changed`, `indexeddb_metadata_observed`, `cache_metadata_observed`                                |
| Runtime         | `dom_mutation_summary`, `api_invoked`, `worker_created`, `service_worker_registered`, `download_initiated`, `permission_api_queried`                             |
| Analysis        | `finding_created`, `finding_resolved`, `posture_recomputed`, `ai_bundle_created`, `ai_answer_received`                                                           |

`api_invoked` carries an enum such as `clipboard_read`, `geolocation_get_current_position`, `notification_request_permission`, `window_open`, `webassembly_instantiate`, or `webgl_context`. It never carries arguments, return values, stack traces, text, or binary data.

### Event capability vocabulary

No event name implies unsupported observation. Each kind declares one of four support classes:

| Class               | Meaning                                                       | Example                                                        |
| ------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| `BROWSER_DIRECT`    | Browser API reports the fact for selected scope               | navigation committed; network redirect; cookie metadata change |
| `DOCUMENT_DIRECT`   | Permitted content observer reads document lifecycle/structure | DOMContentLoaded; iframe element added                         |
| `PROBE_BEST_EFFORT` | Main-world hook sees an API invocation after injection        | `navigator.clipboard.readText` invocation                      |
| `DERIVED_PATTERN`   | Analyzer joins evidence; it is not an independent event       | likely OAuth redirect sequence; fingerprinting pattern         |

The event details panel renders the support class, collector, capability needed, start-time coverage, and known blind spots. A missing `PROBE_BEST_EFFORT` event is never a negative signal.

## 3. Evidence and timeline

An Evidence object is a stable pointer to one or more event IDs plus a capture statement:

```text
Evidence: id, eventIds[], observation window, source/evidence grade,
capability prerequisite, redaction level, capture limitation, integrity hash
```

The timeline is a derived projection, not a second source of truth.

```text
TimelineEntry: id, sessionId, start/end sequence, display time,
group key, headline template, evidenceIds[], importance,
expanded event count, coverage badge
```

Aggregation rules:

- Network requests group by domain + resource type in 1-second buckets; redirects remain a linked chain.
- Repeated mutation/API events collapse within a 500 ms window but preserve count and first/last event IDs.
- Findings appear at the timestamp of their first supporting evidence, not the later rule-evaluation time.
- `coverage_gap` entries are never collapsed under normal events and visually span their affected window.

### Evidence graph

The graph is a read model built from events, not a separate fact store or a Neo4j dependency. Nodes have safe, typed identities:

```text
Investigation | Window | Tab | Document | Frame | Origin | Resource | Request |
CookieMetadata | StorageContainer | Script | Worker | PermissionAPI | Download |
Finding | Annotation | CoverageGap
```

Edges are similarly constrained: `contains`, `navigated_to`, `embedded`, `requested`, `redirected_to`, `set_metadata`, `registered`, `created`, `invoked`, `supports`, `derived_from`, `related_by_time`, and `annotated_by`. Each edge has `basis`, `confidence`, `evidenceIds`, `firstSequence`, and `lastSequence`. Only `direct-reference` edges may be phrased as a direct relationship. `related_by_time` is visually distinct and never used as a risk-rule trigger by itself.

## 4. Risk/posture engine

### Model

Use independent categories: **Transport & policy**, **Privacy exposure**, **Runtime behaviour**, and **Third-party surface**. Each category produces `(posture 0–100, coverage 0–100, evidence list)`, where 100 means stronger observed posture, not certainty of safety.

```text
categoryPosture = clamp(50 + Σ bounded(weight × confidence × applicability), 0, 100)
overallPosture  = weightedMean(categoryPosture, categoryCoverage)
overallCoverage = weightedMean(categoryCoverage)
```

The UI leads with category cards and says, for example, “Privacy posture: 58 / evidence coverage: 72%.” It must never display a red/green binary trust verdict.

### Inputs and safeguards

| Signal                                       | Example contribution                | Safeguard                                                                    |
| -------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| HTTPS observed                               | modest positive transport fact      | never call it a valid certificate verdict                                    |
| Effective CSP has restrictive script sources | positive policy fact                | account for report-only/meta vs header; no blanket CSP bonus                 |
| Mixed content response                       | substantial negative transport fact | direct browser evidence required                                             |
| Third-party count/domain diversity           | neutral-to-caution privacy context  | no penalty for known payment/identity provider alone                         |
| API call after deep-scan start               | contextual runtime fact             | absence is not a positive; invocation is not malicious intent                |
| Multi-signal fingerprinting pattern          | caution                             | requires ≥3 independent direct signals + temporal correlation                |
| Named threat feed match                      | critical alert                      | optional provider, feed/source/time must be shown; expired feed cannot alert |

Weights are versioned data reviewed by security and UX. They have reason codes, test fixtures, min/max impact, and an expiry date. Rules cannot change category weights outside predeclared bounds. An explanation names the signal and may state uncertainty; it must not assign motive.

## 5. AI subsystem

### Layers

1. **Deterministic explanation templates (default):** evidence-led copy from rule IDs and an offline glossary.
2. **Optional local model adapter (future):** only if the model runs entirely on-device and a capability review confirms resource budgets.
3. **Optional remote AI:** consented question-answering over a Redacted Evidence Bundle (REB).

### Redacted Evidence Bundle

REB contains app/rule versions, browser capability state, category aggregates, finding IDs/explanations, event types, registrable domains, coarse timestamps, and raw evidence IDs. It excludes prohibited fields from FR-06 by schema, strips query/fragment, collapses IP/country data to stated provider result, and does not include user questions in future product analytics.

Remote AI requests use an allowlisted provider endpoint, no browsing-history batch, no tool execution, and a provider contract specifying retention/training posture. The system prompt requires evidence IDs, prohibits security verdicts beyond evidence, and directs the model to state insufficiency. The UI shows exactly the serialized REB before send and can delete a cached answer.
