# Operational State: Dash Ledger

<!-- operational-state:metadata
{
  "schema_version": 1,
  "project_id": "dash-ledger-cc",
  "project_name": "Dash Ledger",
  "project_root": ".",
  "artifact_path": ".github/workflows/pages.yml",
  "state_revision": 2,
  "last_updated": "2026-09-09",
  "current_baseline": {
    "identity": "main@a4f5a981421b423959ee0a638a8a07faf9d71795",
    "state": "implemented-unverified",
    "last_verified": "2026-09-09"
  },
  "scope_boundaries": [
    "Canonical westkitty/dash_ledger_cc repository only",
    "GitHub Pages delivery configuration and directly affected deployment evidence"
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

- **Primary artifact:** `main@a4f5a981421b423959ee0a638a8a07faf9d71795`.
- **Baseline state:** Pages workflow implemented; first deployment workflow run is executing and has not yet established live delivery.
- **Source/build/install identity:** Bun 1.3.12; Node pinned by `.nvmrc`; `bun.lock` is authoritative.
- **Active default user route:** the Desk (`#/`).
- **Delivery state:** `.github/workflows/pages.yml` now builds and attempts GitHub Pages deployment from canonical `main`; live deployment remains unverified.
- **Last verified baseline:** 2026-09-09.

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

- **Allowed to change:** `OPERATIONAL_STATE.md` and `.github/workflows/pages.yml` only for this bounded deployment task.
- **Must remain unchanged:** application/domain/data code, `vite.config.ts`, `bun.lock`, `package.json`, existing `.github/workflows/ci.yml`, database identity, backup formats, imports, and user-facing workflows.
- **Potentially affected behavior:** static build delivery, PWA registration/scope, asset paths, live HTTPS origin, and update behavior.
- **Mandatory checks:** clean build through the workflow; Pages artifact contains expected `dist/` files; successful Pages deployment when repository Pages source is enabled; live smoke test after deployment.
- **Checks deliberately reused:** existing release-gate application regression evidence remains valid because no application source, build configuration, database, or PWA configuration was changed.
- **Repair class:** bounded deployment configuration.

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
