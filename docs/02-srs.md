# BrowserScope — Software Requirements Specification

## 1. System boundary

The system is a Manifest V3 browser extension with local persistence. It receives browser API events and deliberately limited page-probe events, normalizes them, runs packaged deterministic rules, and renders local UI. Optional remote services receive a separately generated redacted bundle only after informed consent.

Inputs from a page, browser event APIs, optional feeds, and AI providers are untrusted. BrowserScope has no authority to alter page behaviour in this product.

## 2. Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | The system shall create a unique scan session bound to `tabId`, top-level document ID/origin, start time, requested capabilities, and rule-set version. |
| FR-02 | The system shall reject events whose tab, document, session token, schema version, or sequence constraints do not match the active session. |
| FR-03 | The system shall normalize browser observations into immutable events with a source, evidence grade, privacy classification, and monotonic sequence number. |
| FR-04 | The system shall maintain per-session network request state keyed by browser request ID and write a terminal event on completion, error, or known redirect. |
| FR-05 | The system shall retain only an allowlist of response/request header facts: transport/security policy, content type, content length, redirect location origin, and cache fact where exposed. It shall not persist authorization, cookie, proxy-auth, or arbitrary headers. |
| FR-06 | The system shall never collect form values, typed text, clipboard contents, cookie values, URL fragments, URL query values, request bodies, response bodies, WebSocket/SSE message contents, or storage values. |
| FR-07 | The system shall store page and frame origins as canonicalized URLs; displayed and exported forms shall default to registrable domains plus path templates. |
| FR-08 | The system shall describe DOM changes by bounded metadata (operation, tag, attributes from an allowlist, visibility classification, frame, and count) and never innerHTML/text content. |
| FR-09 | The system shall explicitly record collection gaps: unsupported browser capability, missing permission, late injection, restricted URL, quota pressure, and collector shutdown. |
| FR-10 | A finding shall include stable rule ID/version, severity, confidence, evidence IDs, explanation template parameters, and supersession status. A finding with no evidence IDs shall not render. |
| FR-11 | The risk engine shall calculate independent category posture values and a confidence/coverage value. It shall not output `safe`, `malicious`, or a probability of compromise. |
| FR-12 | Search and filtering shall execute locally over the selected session; full-text indexes shall exclude sensitive fields by schema, not by UI convention. |
| FR-13 | Data deletion shall support session, site, and all-local-data scopes and shall delete associated events, findings, artifacts, indexes, and AI drafts. |
| FR-14 | Export shall pass a redaction transform, validate against an export schema, and show a deterministic data preview. |
| FR-15 | Remote enrichment and AI shall be disabled by default, separately consented, cancellable, and supplied only a versioned redacted bundle. |
| FR-16 | A remote answer shall identify the evidence IDs it used. It shall be labelled generated analysis and be stored separately from primary evidence. |
| FR-17 | The system shall not execute remotely retrieved code, rule expressions, plugin code, or model-provided instructions. |
| FR-18 | The system shall require an explicit Investigation descriptor: scope, selected tab IDs/origins, capabilities, started/ended timestamps, retention, and rule-pack versions. It shall not widen scope after start. |
| FR-19 | The system shall write an append-only event envelope before any derived finding, aggregate, graph edge, report, or AI bundle references it. Derived artifacts shall retain input event IDs and algorithm/rule versions. |
| FR-20 | The system shall classify every event as `direct`, `instrumented`, `derived`, or `user-annotated`; source completeness and late-start status shall be visible in the event and session coverage model. |
| FR-21 | The system shall maintain a causality graph as derived, typed edges with a basis (`direct-reference`, `temporal-correlation`, `rule-inference`, or `user-link`). It shall not represent temporal adjacency as causation. |
| FR-22 | The system shall implement replay as a pure read operation over a frozen investigation snapshot. Replay shall make no page, browser, provider, or AI network request. |
| FR-23 | Built-in analyzer modules shall consume normalized event batches and return schema-validated observations/finding candidates. They shall have no access to browser APIs, UI stores, raw page objects, or direct persistence. |
| FR-24 | The system shall create a `coverage_gap` event whenever a source was unavailable, permission was denied/revoked, a document was late-attached, sampling/overflow occurred, or a browser API does not support requested visibility. |

## 3. Non-functional requirements

### Security

- NFR-S1: TypeScript strict mode, no `any` at trust boundaries, schema validation using a generated runtime validator, and exhaustive event unions.
- NFR-S2: Main-world probe uses a per-document random channel token, `postMessage` origin/source checks, plain JSON serialization, and no extension secrets or API surface.
- NFR-S3: Content Security Policy for extension pages forbids remote script and unsafe eval. Dependencies are pinned and audited in CI.
- NFR-S4: Rules are declarative JSON data validated against schema; signed updates are verified before activation and cannot contain JavaScript.
- NFR-S5: All URL rendering uses text nodes and safe link construction; no page-originated HTML is inserted into the extension UI.

### Privacy

- NFR-P1: No analytics or telemetry in MVP. Crash diagnostics, if later introduced, are off by default and contain no browsing data.
- NFR-P2: Incognito collection is disabled by default, remains memory-only when enabled, and is deleted when the private session ends.
- NFR-P3: Default local session retention is 24 hours with a user setting of immediate discard, 7 days, or 30 days. Older records are purged by a scheduled bounded job.

### Performance and resilience

- NFR-R1: No synchronous/blocking `webRequest` listeners. The service worker batches event writes (maximum 250 events or 500 ms) and persists a checkpoint before yielding.
- NFR-R2: Passive mode is metadata-only, limits to 500 network records and 200 DOM summary records per document, and records an overflow event rather than dropping silently.
- NFR-R3: Deep scan samples mutation bursts, coalesces equivalent events, has per-kind rate limits, and never computes hashes/parses source on the page main thread.
- NFR-R4: The service worker must resume a session from IndexedDB/storage checkpoints after termination without relying on globals. Chrome documents that MV3 service workers are short-lived. [Chrome guidance](https://developer.chrome.com/docs/extensions/get-started/tutorial/service-worker-events)
- NFR-R5: UI lists are virtualized and timeline aggregation is done in a worker when supported.
- NFR-R6: Investigation writes use bounded append batches and a hash chain/checkpoint manifest. Integrity verification detects local corruption or accidental mutation; it is not presented as protection against a user or malware controlling the browser profile.

### Compatibility and accessibility

- NFR-C1: Chromium MV3 is the reference implementation. Feature code uses an adapter that returns `supported`, `unsupported`, or `requires-permission`; it must not silently emulate unavailable capabilities.
- NFR-C2: Firefox build must feature-detect APIs and provide a dedicated manifest/output. Content-script isolation and API differences are tested, as documented by MDN. [MDN Chrome incompatibilities](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities)
- NFR-C3: All controls have names, focus indicators, keyboard interactions, semantic headings, and reduced-motion equivalents.

## 4. Verification matrix

| Test layer | Required evidence |
|---|---|
| Unit (Vitest) | Canonicalization, redaction, rule evaluation, score bounds, schema rejection, retention, export serialization. |
| Integration | Service-worker restart recovery, permissions revoked mid-scan, redirect chains, duplicate events, quota overflow, malformed page messages. |
| Browser E2E (Playwright) | Chrome/Edge manual scan, denied/granted optional permissions, restricted-page state, accessibility keyboard flow, deletion/export. |
| Security | Prototype-pollution/fuzz tests at message boundaries; static dependency/license audit; CSP/manifest review. |
| Performance | Representative page corpus, synthetic 10k-event stream, long-lived SPA navigation, memory and CPU budgets. |
| Manual compatibility | Brave Shields interaction, Opera build smoke, Firefox capability downgrade/wording. |
