# BrowserScope — Product Requirements Document

**Version:** 0.1  
**Product position:** a local-first evidence viewer that helps people understand browser-visible site behaviour. It is not an antivirus, a guarantee of safety, or a replacement for browser protections.

## Problem and target users

People can see a lock icon and a permission prompt, but cannot readily understand which third parties were contacted, which browser APIs were used, or what evidence led to a concern. Existing developer tools expose raw detail; reputation products turn uncertainty into a simplistic verdict.

Primary users are privacy-conscious everyday users and technically literate users who need a readable account of a single page session. Secondary users are analysts who want exportable, redacted evidence. The product does not target endpoint malware investigation or enterprise fleet management in v1.

## Goals

1. Explain observable site behaviour in plain language, tied to a timestamped evidence item.
2. Keep passive inspection bounded and local; make deeper collection explicit.
3. Help users distinguish normal integration behaviour from concrete unsafe configuration.
4. Make uncertainty, collection scope, permission state, and unsupported features visible.
5. Provide an export that is safe to share by default.

## Non-goals

- Detecting all malicious sites or guaranteeing that a site is safe.
- Capturing user content, credentials, messages, form input, cookie values, response bodies, or WebSocket data.
- Blocking traffic, changing pages, or acting as an ad/tracker blocker.
- Analysing operating-system security, browser binaries, or other extensions’ code.
- Silent all-history monitoring, fingerprinting users, or cloud collection by default.

## Product principles

- **Evidence before narrative.** Every finding has at least one evidence reference, observation source, scope, and confidence.
- **Least privilege.** Capabilities are optional and per-site/per-tab where possible.
- **Calm language.** “Observed clipboard read API call” is better than “site steals clipboard.”
- **Honest gaps.** “Not captured: scan began after navigation” is a first-class state.
- **Local by default.** Remote features are separated, previewed, and reversible.

## Core journeys

### 1. Quick check

The user opens the action popup. It shows the canonical site name, collection state, four posture cards (transport, policy, third parties, runtime), and the one primary action: **Scan this page**. The result is a neutral summary with the number of findings and explicit coverage: e.g., “Network metadata observed for 42 seconds; no response bodies collected.”

### 2. Deep inspection

The user selects Deep scan and accepts only the required capability cards. A session starts, a discreet in-page indicator is optional, and the side panel opens. The live timeline fills with normalized events. The user can pause or stop; stopping freezes the session and removes probe listeners.

### 3. Understand a finding

The user selects “Opens a cross-site WebSocket.” The detail view states the event, the domain, time, source (`network`), evidence links, why it might matter, benign common uses, limitations, and the exact rule that raised it. It never infers a motive from the connection alone.

### 4. Share safely

The user exports a session. The preview shows which identifiers are redacted. The default export contains event types, registrable domains, coarse times, headers reduced to allowlisted security facts, rule versions, and no secrets. Full local URLs require a separate confirmation and are never offered to remote AI.

### 5. Ask a question (opt-in)

The user enables AI, sees the redacted evidence bundle, provider, retention statement, and cost/connection implications, then asks a question. The response links only to event IDs/rule IDs in that bundle and may reply “insufficient evidence.”

## MVP requirements

| ID | Requirement | Priority | Acceptance outcome |
|---|---|---|---|
| PRD-01 | Per-tab manual scan sessions | Must | A session has a clear start, stop, status, scope, and discard control. |
| PRD-02 | Passive posture collection | Must | With appropriate site access, collect document URL/origin, top-level HTTPS state, response security headers, script/iframe/link metadata, and network counts within budgets. |
| PRD-03 | Evidence-led findings | Must | Every surfaced finding links to immutable evidence IDs and a human-readable limitation. |
| PRD-04 | Network and third-party summary | Must | Group requests by registrable domain/resource type; show redirects, status class, and bytes when observable. |
| PRD-05 | Cookie metadata panel | Should | On consent, show attributes but never cookie values. |
| PRD-06 | Runtime event panel | Should | Deep scan observes bounded DOM mutations and selected API-use events from scan start. |
| PRD-07 | Timeline/search | Must | Search works over event text, type, domain, finding, and time range without sending data off-device. |
| PRD-08 | Explainable posture | Must | No binary “safe”; category scores explain weights and uncertainty. |
| PRD-09 | Data controls and export | Must | Local retention, deletion, redacted JSON export, and AI/enrichment disclosure are available. |
| PRD-10 | Accessibility/theme | Must | Keyboard operation, reduced-motion support, AA contrast, dark/light/system themes. |

## Success measures and guardrails

| Measure | Target | Guardrail |
|---|---|---|
| Scan start to usable summary | < 1.5 s on a median page | Never block page loading. |
| Passive overhead | < 1% CPU averaged over 30 s on test corpus | Stop/degrade collector when budget exceeds threshold. |
| Evidence coverage | 100% of findings reference evidence | Findings without evidence are discarded. |
| Sensitive-data exports | 0 by default | Automated redaction tests must pass. |
| Permission conversion | measured locally/opt-in telemetry only | No dark patterns or bundled all-sites grant. |
| False certainty | 0 “safe/clean/valid” safety claims | Copy review gate. |

## Release criteria

MVP ships only when Chromium capability tests, privacy tests, redaction tests, browser-store permission review, keyboard flows, and a page-performance corpus pass. Firefox is released only after its own compatibility suite passes; it is not enabled merely because the UI renders.
