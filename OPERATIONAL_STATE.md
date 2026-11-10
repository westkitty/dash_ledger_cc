# Operational State: Dash Ledger

<!-- operational-state:metadata
{
  "schema_version": 1,
  "project_id": "dash-ledger-cc",
  "project_name": "Dash Ledger",
  "project_root": ".",
  "artifact_path": "src/db/db.ts",
  "state_revision": 4,
  "last_updated": "2026-11-10",
  "current_baseline": {
    "identity": "main@02da50acea83837c6ccec0c5f46fd9d2a0326f2b",
    "state": "implemented-unverified",
    "last_verified": "2026-09-09"
  },
  "scope_boundaries": [
    "Canonical westkitty/dash_ledger_cc repository only",
    "GitHub Pages delivery configuration and directly affected deployment evidence",
    "Explicitly approved Phase 1 field-intelligence additive data foundation, branch-only, no deployment"
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
- **Governed scope:** Canonical app source, build/deployment configuration, and user-path evidence directly affected by deployment changes.
- **Explicitly not governed:** legacy `westkitty/DASH_LEDGER` and `westkitty/dash_ledger_grok` implementations except as recovery/import sources.

## 2. Current Baseline

- **Primary artifact:** current published-source baseline `main@02da50acea83837c6ccec0c5f46fd9d2a0326f2b`; Phase 1 work is in `feat/v2-field-intelligence-phase1-20261110`, not on `main`.
- **Baseline state:** main source inspected in November 2026; earlier Pages workflow notes below are historical, not proof of present live status. Phase 1 changes are local/branch-only.
- **Source/build/install identity:** Bun 1.3.12; Node pinned by `.nvmrc`; `bun.lock` is authoritative.
- **Active default user route:** the Desk (`#/`).
- **Delivery state:** `.github/workflows/pages.yml` now builds and attempts GitHub Pages deployment from canonical `main`; live deployment remains unverified.
- **Last verified baseline:** 2026-09-09 prior release-gate evidence; 2026-11-10 separate Bun 1.3.12 Phase 1 workspace verification (not iPhone production).

## 3. Artifact Contract

Dash Ledger must remain a static, local-first PWA. Deployment may publish only the generated `dist/` app over HTTPS. Deployment must not introduce an account system, backend, telemetry, remote database, runtime CDN dependency, committed `dist/`, or any mutation of browser-held user data. GitHub Pages delivery must preserve the existing relative-base/hash-routing/PWA model and must not replace the existing read-only CI workflow.

## 4. Active Invariants

- **INV-001 — Local data ownership:** authoritative user records remain in browser IndexedDB; deployment never reads, uploads, migrates, clears, or resets them.
- **INV-002 — No backend/telemetry:** ordinary app use remains serverless after static asset delivery, with no analytics or remote application API.
- **INV-003 — Reproducible build:** `bun install --frozen-lockfile` and the declared Bun/Node toolchain remain the build contract.
- **INV-004 — Portable static routing:** existing `base: './'`, hash routing, relative PWA scope/start URL, and static-host portability remain unchanged unless direct deployment evidence proves a bounded correction is required.
- **INV-005 — CI separation:** `.github/workflows/ci.yml` stays read-only and continues validation independently; deployment gets only the GitHub Pages permissions it requires.
- **INV-006 — Deploy from canonical main:** only `main` may publish the Greyson test build by default; pull requests must not publish production Pages state.
- **INV-007 — User-data rollback boundary:** code rollback means redeploying code; never delete IndexedDB as a deployment rollback mechanism.

## 5. Verified Working Behavior

- **VER-001:** Canonical source passed the completed release gate: 252/252 tests, extreme-timezone test reruns, typecheck, lint, build, and production runtime journeys.
- **VER-002:** Production PWA shell and IndexedDB data continued working after the preview server was stopped during the release gate.
- **VER-003:** The repository has a reproducible clean-clone build contract and a read-only GitHub Actions CI workflow.
- **VER-004:** Current source includes iPhone/PWA affordances: `viewport-fit=cover`, Apple web-app metadata, Apple touch icon, portrait manifest, safe-area handling, and feature-detected browser APIs.
- **VER-005:** First Pages workflow run successfully checked out canonical main, configured Node/Bun, installed with the frozen lockfile, and completed typecheck successfully before this state snapshot.

## 6. Known Not Working

No confirmed deployment-specific defect is recorded at this revision.

## 7. Implemented but Unverified

- **UNV-001:** Physical iPhone/Safari Add to Home Screen behavior, real iOS Web Share/download delivery, storage eviction behavior, and Safari-specific IndexedDB timing remain device-unverified.
- **UNV-002:** Dedicated GitHub Pages workflow exists on `main` at `.github/workflows/pages.yml`, but its first run has not yet completed deployment.

## 8. Unknown or Evidence-Stale State

- **UNK-001:** Whether GitHub Pages is already enabled with **Source: GitHub Actions** cannot be read or changed through the current connector surface; the workflow's Configure/Deploy steps will expose this if not configured.

## 9. Pending Work

- **PND-001:** First Pages workflow run must complete build/package/configure/deploy before live delivery can be promoted to verified.
- **PND-002:** If the workflow reports Pages is not enabled, set repository **Settings → Pages → Source → GitHub Actions** and rerun the workflow.
- **PND-003:** Verify the live Pages URL, service-worker control/offline reload, navigation, persistence, and iPhone Home Screen install on Greyson's device.

## 10. Active Decisions, Defaults, and Prohibitions

- **DEC-001:** GitHub Pages is the preferred zero-backend Greyson test delivery path.
- **DEC-002:** Keep the existing portable `base: './'`; do not change Vite/PWA routing merely to satisfy provider convention without observed failure.
- **DEC-003:** Pages deployment is a separate workflow; do not grant write permissions to the existing validation CI.
- **DEC-004:** Publish generated `dist/` only; never commit `dist/` or create a `gh-pages` source branch for this path.
- **DEC-005:** No custom domain, authentication layer, TestFlight/native wrapper, or application feature change is part of this task.

## 11. Validation and Evidence Matrix

| ID | Claim or behavior | State | Evidence | Validation method | Artifact/revision | Last checked | Recheck trigger |
|---|---|---|---|---|---|---|---|
| VER-001 | Canonical application regression suite/build is green | verified | Release gate + CI records | tests/typecheck/lint/build | pre-Pages app source | 2026-09-09 | application/config change |
| VER-002 | PWA shell/data operate offline | verified | Release gate runtime | server-down reload + IndexedDB write | pre-Pages app source | 2026-09-09 | PWA config change |
| VER-005 | Pages workflow bootstrap + typecheck | verified | Actions run 34379263543 | clean GitHub runner | main@a4f5a98 | 2026-09-09 | workflow change |
| UNV-002 | GitHub Pages live deployment | implemented-unverified | `.github/workflows/pages.yml`; run in progress | successful deploy job + live URL | main@a4f5a98 | 2026-09-09 | run completion |
| UNV-001 | Physical iPhone installed-web-app journey | implemented-unverified | source portability audit only | real Safari + Add to Home Screen | current main | 2026-09-09 | first iPhone field test |
| UNK-001 | Pages source configured to GitHub Actions | unknown | connector cannot inspect Pages admin endpoint | repository Settings / workflow outcome | current repo | 2026-09-09 | Configure Pages step |

## 12. Current Change Scope and Impact Radius

- **Authorized 2026-11-10:** Phase 1 schema, runtime validators, nine new Dexie tables, additive v1→v2 migration, repository writes, v3 backup/restore and v2 compatibility, preservation regression tests, Phase 1 documentation, and this state revision on **feature branch only**.
- **Protected:** untouched production/hosted IndexedDB, canonical `main`, all existing historical records, old-format recovery, receipts/images, CSV/tax binder, PWA routes, user-facing screens, optional GPT Bridge, CI and Pages deployment workflows.
- **Validation achieved in isolated Big Mac checkout:** frozen Bun install; TypeScript; ESLint; 271/271 Vitest tests including 16 new Phase 1 tests; Vite/PWA production build; diff whitespace checks. Headless fake-indexeddb and source tests are not live Safari migrations.
- **Release boundary:** GitHub branch may be committed/pushed for review. Do **not** merge, push to main, create release, or deploy. Browser database version upgrades are durable: old client code is not a valid downgrade path. Production rollout requires a distinct explicit approval, real Safari test, full v3 export, and a proved recovery strategy.
- **Implementation limits:** no new UI; no market analytics; no modeled net profit; no platform account sync; v2 field data remains excluded from GPT Bridge. Legacy reporting remains authoritative to prevent double counting.
- **Outstanding evidence:** live iPhone/Safari migration and storage checks, old-browser-after-upgrade backward compatibility, deployed user journey and production database restore not tested.

## 13. Compact Revision Log

### Revision 2 — 2026-09-09

- **Artifact/source identity:** `main@a4f5a981421b423959ee0a638a8a07faf9d71795`.
- **State deltas:** Added dedicated GitHub Pages workflow; first Actions run started automatically. No application code or existing CI changed.
- **New evidence:** Clean runner checkout/setup/frozen install and typecheck succeeded; remaining build/deploy steps are still executing at this snapshot.
- **Validation not performed:** Live Pages URL and physical iPhone installation remain unverified.

### Revision 1 — 2026-09-09

- **Artifact/source identity:** `main@fe5ba57b95b82e2fe23e33a6b69ddbf57645e4c1`.
- **State deltas:** Initialized operational state for the GitHub Pages/Greyson iPhone test deployment task.
- **New evidence:** Confirmed canonical repo identity, current build/PWA configuration, existing read-only CI, and connector limitation around Pages settings.
- **Validation not performed:** No live GitHub Pages deployment or physical iPhone installation had yet been observed.

### Revision 3 — 2026-10-01

- **Artifact/source identity:** `feature/gpt-bridge-zero-cost` with optional GPT Bridge Worker/PWA/plugin (see `DASH_LEDGER_GPT_PLUGIN_ZERO_COST_PLAN_operational_state.md` rev 2).
- **State deltas:** Optional Cloudflare free-tier bridge deployed; IndexedDB remains canonical. No change to required paid infra. ChatGPT Developer-mode install still manual.
- **New evidence:** Live Worker health/CORS/auth smoke; local 255-test suite; Worker check; packaged plugin zip under `dist-plugin/` (gitignored).
- **Validation not performed:** ChatGPT UI OAuth/tool session; post-merge GitHub Pages confirmation for the new default bridge URL.


### Revision 4 — 2026-11-10 (Phase 1 feature branch only)

- **Task and authority:** approved v2 Field Intelligence Phase 1, with nine additive tables, schema validators, strong backup compatibility and tests; no merge/deploy.
- **Source baseline:** `main@02da50acea83837c6ccec0c5f46fd9d2a0326f2b`; feature branch `feat/v2-field-intelligence-phase1-20261110`.
- **Implemented (in isolated checkout; GitHub branch synchronization verified separately):** `src/domain/fieldIntelligence.ts`, `src/db/fieldRepositories.ts`, Dexie schema 2, field-table-including JSON backup v3, strict validation, v2 restore compatibility, legacy import v3 refusal, destructive-operation safety accounting, legacy shift/expense dependent link delete/Undo.
- **Validation:** isolated Bun 1.3.12 frozen dependency install, typecheck PASS, lint PASS, 271/271 tests PASS, build PASS. No real-device test or live user data was modified.
- **Protected invariants:** stable IndexedDB name; local-only authoritative records; legacy shifts and tax exports unchanged; full receipt image path and previous canonical v2 backup restore retained; `main` unchanged by this revision.
- **Known release blocker:** old client schema will not safely open an upgraded Dexie database. A code-only rollback is not a real database rollback; obtain separate release approval and prove restore strategy before deployment.
