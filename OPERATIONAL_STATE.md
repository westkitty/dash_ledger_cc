# Operational State: Dash Ledger

<!-- operational-state:metadata
{
  "schema_version": 1,
  "project_id": "dash-ledger-cc",
  "project_name": "Dash Ledger",
  "project_root": ".",
  "artifact_path": ".",
  "state_revision": 3,
  "last_updated": "2026-09-09",
  "current_baseline": {
    "identity": "main@78c065fb8118b0a611dab294ea125268415b9218",
    "state": "implemented-unverified",
    "last_verified": "2026-09-09"
  },
  "scope_boundaries": [
    "Canonical westkitty/dash_ledger_cc repository only",
    "GitHub Pages delivery and canonical application behavior",
    "Isolated synthetic UI/UX demo lab under #/ux-lab"
  ],
  "linked_parent_state": null
}
-->

## 1. Project Identity and Scope

- **Project ID:** `dash-ledger-cc`
- **Purpose:** Local-first, mobile-first DoorDash work ledger with trustworthy mileage, earnings, expense, receipt, backup, recovery, weekly, and yearly records.
- **Project type:** Static Vite + React + TypeScript + Dexie PWA.
- **Primary root or artifact:** repository root (`westkitty/dash_ledger_cc`).
- **Target environment:** HTTPS static hosting; mobile Safari / iPhone Home Screen is an explicit test target; ordinary modern mobile and desktop browsers remain supported.
- **Canonical authority:** `main` in `westkitty/dash_ledger_cc`.
- **Governed scope:** Canonical app source, build/deployment configuration, user-path evidence, and the isolated UI/UX demo lab.
- **Explicitly not governed:** legacy `westkitty/DASH_LEDGER` and `westkitty/dash_ledger_grok` implementations except as recovery/import sources.

## 2. Current Baseline

- **Primary artifact:** `main@78c065fb8118b0a611dab294ea125268415b9218`.
- **Baseline state:** Four synthetic UI/UX redesign demos and a five-position comparison switcher are merged to canonical `main`; Pages deployment from this main revision has started but live delivery of this revision remains unverified.
- **Source/build/install identity:** Bun 1.3.12; Node pinned by `.nvmrc`; `bun.lock` is authoritative.
- **Active default user route:** the Desk (`#/`).
- **Demo entry route:** canonical UI with switcher is `#/?demo=1`; concepts are `#/ux-lab/1?demo=1` through `#/ux-lab/4?demo=1`.
- **Delivery state:** `.github/workflows/pages.yml` builds and deploys generated `dist/` from canonical `main`.
- **Last verified baseline:** 2026-09-09.

## 3. Artifact Contract

Dash Ledger must remain a static, local-first PWA. Deployment may publish only the generated `dist/` app over HTTPS. Deployment must not introduce an account system, backend, telemetry, remote database, runtime CDN dependency, committed `dist/`, or any mutation of browser-held user data. GitHub Pages delivery must preserve the existing relative-base/hash-routing/PWA model and must not replace the existing read-only CI workflow.

The UI/UX lab is a demonstration surface only. It must use synthetic fixtures/local component state and must remain structurally outside `LedgerProvider`, so entering `#/ux-lab/*` never constructs the canonical ledger store or reads/writes production IndexedDB data. The normal app must remain unchanged when comparison mode is not explicitly entered.

## 4. Active Invariants

- **INV-001 — Local data ownership:** authoritative user records remain in browser IndexedDB; deployment never reads, uploads, migrates, clears, or resets them.
- **INV-002 — No backend/telemetry:** ordinary app use remains serverless after static asset delivery, with no analytics or remote application API.
- **INV-003 — Reproducible build:** `bun install --frozen-lockfile` and the declared Bun/Node toolchain remain the build contract.
- **INV-004 — Portable static routing:** existing `base: './'`, hash routing, relative PWA scope/start URL, and static-host portability remain unchanged unless direct deployment evidence proves a bounded correction is required.
- **INV-005 — CI separation:** `.github/workflows/ci.yml` stays read-only and continues validation independently; deployment gets only the GitHub Pages permissions it requires.
- **INV-006 — Deploy from canonical main:** only `main` may publish the Greyson test build by default; pull requests must not publish production Pages state.
- **INV-007 — User-data rollback boundary:** code rollback means redeploying code; never delete IndexedDB as a deployment rollback mechanism.
- **INV-008 — UX lab isolation:** `#/ux-lab/*` renders outside `LedgerProvider`; synthetic lab data must never use canonical database/store/repository code.
- **INV-009 — Normal UI remains normal:** the comparison switcher is opt-in on the canonical app via `?demo=1`; ordinary `#/` does not show demo chrome.

## 5. Verified Working Behavior

- **VER-001:** Canonical source passed the completed release gate: 252/252 tests, extreme-timezone test reruns, typecheck, lint, build, and production runtime journeys before the UX demo integration.
- **VER-002:** Production PWA shell and IndexedDB data continued working after the preview server was stopped during the release gate.
- **VER-003:** The repository has a reproducible clean-clone build contract and a read-only GitHub Actions CI workflow.
- **VER-004:** Current source includes iPhone/PWA affordances: `viewport-fit=cover`, Apple web-app metadata, Apple touch icon, portrait manifest, safe-area handling, and feature-detected browser APIs.
- **VER-005:** Pages workflow is installed on canonical `main` and has successfully run its clean-runner bootstrap/typecheck path previously.
- **VER-006:** PR #2 for the five-mode demo switcher was mergeable; PR CI on head `b6cd15aacca3ed889166f47b6785bc27e770e9ec` passed typecheck, lint, unit/integration tests, and both extreme-timezone Vitest jobs before merge. Production build was still running at the merge snapshot.

## 6. Known Not Working

No confirmed defect is recorded for the demo switcher or Pages delivery at this revision.

## 7. Implemented but Unverified

- **UNV-001:** Physical iPhone/Safari Add to Home Screen behavior, real iOS Web Share/download delivery, storage eviction behavior, and Safari-specific IndexedDB timing remain device-unverified.
- **UNV-002:** Live Pages delivery of `main@78c065fb8118b0a611dab294ea125268415b9218` is in progress and not yet verified from the live origin.
- **UNV-003:** Five-mode comparison behavior exists in source: Current + Reach Desk + Resolve + Week as a story + Year at a glance. Live Pages switching and mobile touch layout remain unverified on the deployed origin.

## 8. Unknown or Evidence-Stale State

- **UNK-001:** Exact live-origin behavior for the newly merged demo revision is unknown until the current Pages run completes and the live route is exercised.

## 9. Pending Work

- **PND-001:** Confirm the Pages run for the current main revision completes successfully.
- **PND-002:** Smoke-test `#/?demo=1` on the live Pages origin and verify Current / 1 / 2 / 3 / 4 switching.
- **PND-003:** Verify a lab route does not open or mutate the canonical IndexedDB on the live build.
- **PND-004:** Verify the comparison selector on Greyson's iPhone/Safari viewport and confirm the ordinary `#/` route remains free of demo chrome.

## 10. Active Decisions, Defaults, and Prohibitions

- **DEC-001:** GitHub Pages is the preferred zero-backend Greyson test delivery path.
- **DEC-002:** Keep the existing portable `base: './'`; do not change Vite/PWA routing merely to satisfy provider convention without observed failure.
- **DEC-003:** Pages deployment is a separate workflow; do not grant write permissions to the existing validation CI.
- **DEC-004:** Publish generated `dist/` only; never commit `dist/` or create a `gh-pages` source branch for this path.
- **DEC-005:** No custom domain, authentication layer, TestFlight/native wrapper, or backend is part of this test delivery path.
- **DEC-006:** The four redesigns are demo concepts, not production data migrations. Preserve synthetic/local-state behavior until a concept is deliberately selected for production implementation.
- **DEC-007:** The five-mode selector is for explicit comparison sessions; do not expose it during ordinary use without `?demo=1`.

## 11. Validation and Evidence Matrix

| ID | Claim or behavior | State | Evidence | Validation method | Artifact/revision | Last checked | Recheck trigger |
|---|---|---|---|---|---|---|---|
| VER-001 | Canonical application regression suite/build was green before UX lab merge | verified | Release gate + CI records | tests/typecheck/lint/build | pre-demo main | 2026-09-09 | application/config change |
| VER-002 | PWA shell/data operate offline | verified | Release gate runtime | server-down reload + IndexedDB write | pre-demo main | 2026-09-09 | PWA config change |
| VER-006 | Demo integration typechecks/lints/tests across normal + extreme timezones | partially-verified | PR CI run 34387366243 | GitHub-hosted runners | b6cd15a | 2026-09-09 | demo source change |
| UNV-002 | Current main Pages deployment | implemented-unverified | Deploy GitHub Pages run 34387448570 queued/started | successful deploy + live origin | main@78c065f | 2026-09-09 | run completion |
| UNV-003 | Five-position switcher works on live Pages | implemented-unverified | source + PR CI | live route interaction | main@78c065f | 2026-09-09 | deployment completion |
| UNV-001 | Physical iPhone installed-web-app journey | implemented-unverified | source portability audit only | real Safari + Add to Home Screen | current main | 2026-09-09 | first iPhone field test |

## 12. Current Change Scope and Impact Radius

- **Allowed to change for the demo comparison milestone:** `src/ux-lab/**`, the bounded root switch in `src/main.tsx`, lab documentation/evidence, and `OPERATIONAL_STATE.md`.
- **Must remain unchanged without a separate production redesign decision:** domain/data model, canonical database identity, backup formats, import/recovery semantics, ordinary production route behavior, `vite.config.ts`, `bun.lock`, and Pages/CI security boundaries.
- **Potentially affected behavior:** root render selection, lab routing, comparison navigation, bottom-edge mobile overlay, production build size, and Pages delivery.
- **Mandatory checks:** typecheck, lint, tests, build, hash-route switching, ordinary `#/` without demo chrome, live Pages smoke test, and lab IndexedDB isolation.
- **Repair class:** bounded UI demo integration; not a production redesign adoption.

## 13. Compact Revision Log

### Revision 3 — 2026-09-09

- **Artifact/source identity:** `main@78c065fb8118b0a611dab294ea125268415b9218`.
- **State deltas:** Integrated the four-concept synthetic UI/UX lab and added an opt-in five-position comparison selector (Current + concepts 1–4). Added explicit lab-isolation and normal-route invariants.
- **New evidence:** PR #2 CI passed typecheck, lint, unit/integration tests, and both extreme-timezone jobs before merge; Pages and main CI runs started from the merge commit.
- **Validation not performed:** live Pages interaction, deployed lab IndexedDB isolation, and physical iPhone comparison session remain unverified.

### Revision 2 — 2026-09-09

- **Artifact/source identity:** `main@a4f5a981421b423959ee0a638a8a07faf9d71795`.
- **State deltas:** Added dedicated GitHub Pages workflow; first Actions run started automatically. No application code or existing CI changed.
- **New evidence:** Clean runner checkout/setup/frozen install and typecheck succeeded; remaining build/deploy steps were still executing at that snapshot.
- **Validation not performed:** Live Pages URL and physical iPhone installation remained unverified.

### Revision 1 — 2026-09-09

- **Artifact/source identity:** `main@fe5ba57b95b82e2fe23e33a6b69ddbf57645e4c1`.
- **State deltas:** Initialized operational state for the GitHub Pages/Greyson iPhone test deployment task.
- **New evidence:** Confirmed canonical repo identity, current build/PWA configuration, existing read-only CI, and connector limitation around Pages settings.
- **Validation not performed:** No live GitHub Pages deployment or physical iPhone installation had yet been observed.
