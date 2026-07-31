# BrowserScope — Product Assessment and Architecture Decisions

**Status:** design baseline, implementation intentionally deferred  
**Scope:** Chromium MV3 first (Chrome, Edge, Brave, Opera); Firefox is a separately tested target, not a promise inherited from Chromium.

## Executive decision

BrowserScope should be built as a **local-first, user-initiated web-behaviour inspector**, not a continuous “monitor everything” extension. Passive mode collects only low-cost, browser-observable metadata for the active, opted-in site. A deep scan is explicit, time-bounded, visibly active, and progressively requests capability permissions. This is the only design consistent with the performance and privacy claims.

The product must say **observed**, **not observed**, or **not inspectable**. It must never turn a lack of telemetry into a safety claim.

### Selected technology choices

| Decision | Alternatives considered | Choice and reason |
|---|---|---|
| Extension platform | Chromium-only; cross-browser WebExtensions | Chromium MV3 baseline plus a capability adapter for Firefox. The requested browser set is Chromium-heavy, but Firefox has meaningful API differences. |
| Framework | Plasmo; WXT; hand-rolled Vite | **WXT + React + TypeScript**. Plasmo is capable, but WXT has explicit multi-browser/MV2/MV3 targets and a small browser-API abstraction. This reduces the Firefox-later migration cost without hiding browser capability differences. |
| Main UI | Popup only; side panel only; popup + side panel | **Small action popup + inspectable side panel**. A popup is appropriate for a decision and launch action; persistent, searchable evidence is not. Chromium side panel is a progressive enhancement, with a tab fallback. |
| Network collection | `webRequest`; Chrome debugger/CDP; page monkey-patching | **`webRequest` metadata first**. It is lower-risk and works without debugging attachment. Debugger/CDP is an optional, per-tab advanced mode only, because it is conspicuous, intrusive, and not portable. |
| Runtime sensing | Main-world hooks; DOM-only; DevTools protocol | **Isolated-world DOM observer + a minimal, immutable main-world probe when the user starts deep scan.** The probe emits a strict, redacted event schema. It is advisory, not a security boundary. |
| Persistence | `chrome.storage` only; IndexedDB; cloud | **IndexedDB for event data, `storage.local` for preferences/session checkpoint.** Event streams exceed configuration storage; no cloud sync by default. |
| AI | Remote chat by default; local rules only; hybrid | **Deterministic evidence explanations by default; opt-in remote AI as a separate export pipeline.** AI never receives raw page content, cookies, storage values, or request bodies by default. |

Official platform constraints underpin these choices: MV3 service workers are terminated when idle and must persist state; MV3 prohibits remotely hosted executable code; `webRequest` observes request lifecycle but not all final headers and no response stream; and content scripts run in an isolated world. [Chrome MV3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) [service-worker lifecycle](https://developer.chrome.com/docs/extensions/get-started/tutorial/service-worker-events) [webRequest](https://developer.chrome.com/docs/extensions/reference/api/webRequest) [MDN content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)

## Feasibility ledger

“Possible” means observable within declared permission, capability, browser, and collection-window boundaries. It does not mean complete or infallible.

| Requested area | Decision | Exact boundary / replacement |
|---|---|---|
| “Analyze any website” | **Partially possible** | Extensions cannot run on browser UI, extension pages, some store/account/restricted domains, or domains blocked by enterprise policy. They also need host access. Show `Not inspectable` with a reason. Do not claim universal coverage. |
| “No performance impact” | **Impossible** | Observation consumes CPU, memory, and I/O. Enforce budgets instead: passive ≤1 ms main-thread work per sampled batch, no full source parsing; deep scan has a user-visible cap and backpressure. |
| HTML, DOM, forms, visible meta, iframe attributes | **Possible, scoped** | Observe the current document after injection. Cross-origin frame DOM needs separately granted host access and may still be unavailable for restricted frames. Do not collect form values or keystrokes. |
| External script URLs, inline-script hashes, library hints | **Possible** | Hash source *locally* only after user starts deep scan; never execute or upload it. A library identification is a confidence-labelled heuristic, not proof of a vulnerable version. |
| Security headers / CSP / permissions policy | **Possible with host access** | Read response headers exposed through `webRequest`; retain a normalized allowlist. Header visibility and details vary by browser. Never synthesize a “valid CSP” score from presence alone; evaluate directives and report coverage. |
| Full certificates / “valid TLS” | **Not cross-browser reliable** | `https:` is observable. Chrome has newer security-info exposure, but certificate-chain validation, enterprise roots, and UI verdicts are browser-owned and inconsistent. Report `HTTPS observed` and, where a supported API yields it, connection state—not “certificate is safe.” |
| All fetch/XHR/WebSocket/SSE connections | **Partially possible** | Network metadata and redirect events are observable with permissions. Response bodies are not exposed by Chrome `webRequest`; WebSocket frame contents must not be captured. Count/lifecycle URLs are sufficient for this product. |
| Request/response bodies | **Rejected** | Capturing bodies is privacy-dangerous and Chrome `webRequest` is not a response-body API. Deep CDP body retrieval would expose credentials and is not cross-browser. Collect URL origin, resource type, status, size when available, and redacted header facts only. |
| `eval`, `Function`, clipboard, workers, `window.open`, service-worker registration | **Partially possible** | A main-world probe can hook some APIs from its injection point onward. It misses activity before injection, native/internal paths, saved references, other realms, and deliberate evasion. Mark such events `instrumented` and never call their absence proof. Dynamic imports are reported as module-resource observations, not as definitive `import()` calls. |
| Permission prompts / camera / microphone / geolocation | **Partially possible** | Observe calls made after probe installation and optionally query supported page permission states. The extension cannot reliably observe every browser/OS prompt, existing grant, or user decision. Record `API invoked` separately from `permission granted`. |
| Storage, IndexedDB, Cache Storage usage | **Partially possible** | Obtain local/session storage keys from the current permitted frame; use instrumentation for storage mutations. IndexedDB and Cache Storage may be inspected only on demand and only as metadata (database/cache names, counts, approximate bytes where support permits). No values or records are harvested. |
| Cookies including HttpOnly | **Possible only with `cookies` + host permissions** | `chrome.cookies` can expose cookie metadata, including HttpOnly, to a privileged extension. Values are intentionally excluded from persistence and UI. Partitioned cookies must retain partition context. [Chrome cookies](https://developer.chrome.com/docs/extensions/reference/api/cookies) |
| Fingerprinting detection | **Heuristic only** | Canvas/WebGL/audio/font/device API use is common and not inherently tracking. Detect multi-signal patterns in a time window; report evidence and confidence, never an accusation. |
| Malware / suspicious / recently registered / country verdicts | **Optional remote enrichment** | Browser APIs do not contain WHOIS age, registrar, IP geolocation, threat intelligence, or intent. Offline mode omits them. A consented provider receives a minimized registrable domain or URL hash only, with source/time shown. No automatic “malicious” verdict without a named feed. |
| Explain why behaviour occurred | **Not deterministically possible** | Code observation reveals *what happened*, not business intent. Explanations must use bounded language: “commonly used for”, “consistent with”, and named observed evidence. “Because” requires direct source, documentation, or user-visible context. |
| Extension risk analysis | **Defer / reduce scope** | Do not inspect other extensions by default. A browser may expose limited management metadata only with a very broad, alarming permission; it cannot safely supply their code/traffic analysis. MVP analyzes BrowserScope’s own requested permissions and explains them. |
| “Everything in real time” timeline | **Partially possible** | The timeline is a best-effort event ledger for the observation window, not a browser audit log. It begins at passive activation or deep-scan start and has explicit retention/caps. |

## Requirements removed or changed

- Remove “valid CSP” as a score input. Replace with **CSP coverage analysis**: presence, unsafe directives, nonce/hash use, report-only status, and whether a header or meta policy was seen.
- Remove individual `Device Memory`, `Hardware Concurrency`, and Battery API findings. They are weak, browser-variable signals. Fold them into a high-confidence fingerprinting pattern only when multiple independent signals are observed.
- Remove raw source, cookie value, request body, and storage-value displays from the core product. They are disproportionate privacy risk and add little end-user value.
- Replace “known libraries” with **recognized library signature, version if unambiguous, source of match, and confidence**.
- Replace “risk score” as the primary display with a **posture summary** and separable evidence categories. A single score falsely implies precision.
- Replace automatic site-wide deep monitoring with per-tab scan sessions. No scanning in incognito unless the user separately enables it.
- Make AI chat an explicit opt-in feature, initially limited to a redacted evidence bundle and retrieval from packaged security guidance.

## Refined feature catalogue

The original list mixed user outcomes, low-level implementation techniques, and fields unavailable to ordinary extensions. The catalogue below is the product contract; individual browser APIs are implementation details, not promised evidence sources.

| Release band | Kept feature | Boundaries |
|---|---|---|
| MVP | Page identity, transport/header posture, CSP/permissions-policy analysis, scripts/iframes/forms metadata | No content/values; a form finding is structural metadata only. |
| MVP | Request lifecycle, redirect-chain, third-party, resource-type, and transfer-size summaries | URL metadata only; counts/bytes are “when observable”; no packet/body inspection. |
| MVP | Evidence drawer, filterable timeline, local search, score explanations, deletion and redacted export | Timeline begins at collection start and records gaps. |
| 1.5 | Cookie attribute list, partition context, cookie-change event | Requires separate cookie + host permission; values are discarded before storage. |
| 1.5 | DOM mutation summaries, hidden-frame/element structural facts, worker/service-worker registration facts | Scan-window only; no text, HTML, credentials, or cross-origin frame DOM without access. |
| 2.0 | Instrumented API-use events: clipboard, permissions, popup, download, WebAssembly, selected fingerprinting primitives | Best-effort hooks, no parameters/data, clear `instrumented` limitation. |
| 2.0 | Offline rule packs, optional reputation and optional AI question-answering | Provider consent/redacted data preview required; offline mode retains all core functionality. |
| Deferred research | Debugger/CDP details, Firefox response filtering, extension-management metadata | Feature-specific threat model and browser-specific disclosure required. |

The following are intentionally **not product features**: robots/sitemap/OpenGraph/structured-data crawling (SEO metadata has negligible security value), generic “known CDN” warnings (context, not risk), raw source browsing, message/payload capture, a separate battery/device-memory finding, and automatic “should I trust it?” verdicts. They create noise, privacy exposure, or unjustified certainty.

## Permission model

The extension starts with `storage`, `activeTab`, and the action UI only. It requests capabilities just in time, explaining each purpose. Chrome supports optional permissions specifically for progressive capability grants. [Chrome permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions)

| Capability | Permissions | When requested | Default |
|---|---|---|---|
| Current-page manual scan | `activeTab`, `scripting` | User clicks Scan | allowed for the current tab only |
| Passive site metadata | optional host grant for selected sites | User enables a site/allowlist | off |
| Network metadata | `webRequest` + matching optional hosts | User enables Network in a scan | off |
| Cookie metadata | `cookies` + matching optional hosts | User opens Cookie scan | off |
| Persistent side panel | `sidePanel` where supported | first use | off |
| Advanced CDP inspection | `debugger` + host access | explicit per-tab Advanced attach | off; separately explained |
| Remote enrichment / AI | network endpoint host | after data-preview consent | off |

Never request `<all_urls>` at install. Offer an all-sites mode only after onboarding explains its warning and impact. Permission revocation must stop collectors and purge in-memory data immediately.

## Security and privacy principles

1. Treat pages and main-world messages as hostile input. Validate every message with versioned schemas; never trust object prototypes or page-provided labels.
2. Keep sensitive data out of event payloads by construction: URL query fragments, cookie values, storage values, form values, WebSocket frames, clipboard contents, and response bodies are not eligible fields.
3. Use registrable-domain and path templates for display; provide a per-session “show full URLs locally” switch that never changes export/AI redaction.
4. Do not use remote executable rules, models, or plugins. MV3 requires executable code to ship with the extension package. [Chrome MV3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
5. Sign and version non-executable rule data, use rollback protection, and surface its publisher/date. Offline builds use packaged rules only.

## Go/no-go gates before implementation

1. Confirm the store-permission copy for each target browser.
2. Build a capability matrix against supported browser versions and test real restricted pages.
3. Threat-model the main-world probe and redaction boundary.
4. Validate performance budgets on heavy news, commerce, SPA, and video pages.
5. Obtain legal/privacy review before any remote reputation, AI, or telemetry endpoint is enabled.
