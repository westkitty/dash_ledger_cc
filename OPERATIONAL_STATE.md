# Operational State: Dash Ledger

<!-- operational-state:metadata
{
  "schema_version": 1,
  "project_id": "dash-ledger-cc",
  "project_name": "Dash Ledger",
  "project_root": ".",
  "artifact_path": ".",
  "state_revision": 4,
  "last_updated": "2026-09-09",
  "current_baseline": {
    "identity": "main@e0b4e24aff006250f002e04bc74f19274923288a",
    "state": "implemented-awaiting-live-pages-proof",
    "last_verified": "2026-09-09"
  },
  "scope_boundaries": [
    "Canonical westkitty/dash_ledger_cc repository only",
    "GitHub Pages delivery and canonical application behavior",
    "Five UI/UX presentations over one canonical local ledger"
  ],
  "linked_parent_state": null
}
-->

## 1. Project Identity and Scope

- **Purpose:** Local-first, mobile-first DoorDash work ledger with trustworthy mileage, earnings, expense, receipt, backup, recovery, weekly, and yearly records.
- **Project type:** Static Vite + React + TypeScript + Dexie PWA.
- **Canonical authority:** `main` in `westkitty/dash_ledger_cc`.
- **Target:** GitHub Pages for Greyson iPhone testing; modern mobile/desktop browsers remain supported.
- **Data authority:** browser IndexedDB on the current device and Pages origin. There is no cross-device cloud synchronization.

## 2. Current Baseline

- **Code baseline:** `main@e0b4e24aff006250f002e04bc74f19274923288a` from PR #3.
- **Default route:** `#/`.
- **Five-UI comparison entry:** `#/?demo=1`.
- **Alternate routes:** `#/ux-lab/1?demo=1` through `#/ux-lab/4?demo=1`.
- **Variants:** Current; Reach Desk; Resolve; Week as a story; Year at a glance.
- **Deployment:** `.github/workflows/pages.yml` publishes generated `dist/` from `main`.

## 3. Artifact Contract

Dash Ledger remains a static, local-first PWA. Deployment must not introduce accounts, a backend, telemetry, a remote database, runtime CDN dependency, committed `dist/`, or any deployment-time mutation of browser-held records.

The five UI modes are alternate presentations of **one canonical ledger**, not independent demos or fixture sandboxes. `LedgerProvider` remains mounted across Current and variants 1–4. Switching modes must preserve the same IndexedDB database, snapshot authority, repository semantics, and mutation history. A redesign may alter presentation and workflow, but not fork, reset, seed, replace, shadow, or simulate the user's records.

## 4. Active Invariants

- **INV-001 — Local data ownership:** authoritative records remain in browser IndexedDB.
- **INV-002 — No backend/telemetry:** ordinary use remains serverless after static asset delivery.
- **INV-003 — Reproducible build:** frozen lockfile and declared Bun/Node toolchain remain authoritative.
- **INV-004 — Portable static routing:** preserve `base: './'`, hash routing, relative PWA scope/start URL.
- **INV-005 — CI separation:** validation CI remains read-only; Pages gets only deployment permissions.
- **INV-006 — Deploy from canonical main:** only `main` publishes the Greyson Pages build by default.
- **INV-007 — User-data rollback boundary:** code rollback must never delete IndexedDB.
- **INV-008 — Shared ledger authority:** Current and `#/ux-lab/1..4` all run beneath the same `LedgerProvider` and the same IndexedDB origin. UI switching is presentation-only and must never substitute synthetic fixtures or local mock records for canonical ledger state.
- **INV-009 — Persistent cross-variant mutations:** a record mutation made through any variant must be visible after switching to every other variant that presents that record type.
- **INV-010 — Normal UI remains normal:** ordinary `#/` has no comparison switcher; `?demo=1` opts into comparison mode.

## 5. Verified Working Behavior

- **VER-001:** Pre-demo canonical release gate passed full tests, typecheck, lint, build, extreme-timezone runs, and runtime journeys.
- **VER-002:** PWA shell and IndexedDB data previously operated after preview-server shutdown.
- **VER-003:** PR #3 candidate `a299150bb54dc543de0effbe545501bf84908b43` passed typecheck, lint, full unit/integration tests, production build, build-output sanity check, Pacific/Midway tests, and Pacific/Kiritimati tests in CI run `34388773885`.
- **VER-004:** A regression test now asserts that canonical and alternate UI trees remain inside one `LedgerProvider` and that concepts do not reconnect to `../fixtures`.
- **VER-005:** PR #3 merged successfully to `main` as `e0b4e24aff006250f002e04bc74f19274923288a`.

## 6. Implemented but Unverified

- **UNV-001:** Live Pages delivery of the shared-ledger revision has not yet been confirmed from the deployed origin.
- **UNV-002:** Physical Greyson iPhone/Safari switching remains device-unverified.
- **UNV-003:** End-to-end persistence proof on the live origin remains to be exercised: create/edit in one UI, switch through Current/1/2/3/4, and confirm the same record/state persists.
- **UNV-004:** Safari Add to Home Screen, Web Share/download, storage eviction behavior, and Safari-specific IndexedDB timing remain device-unverified.

## 7. Pending Work

- Confirm the current `main` Pages workflow completes successfully.
- Smoke-test `#/?demo=1` on the live Pages origin.
- On one device/origin, create or edit a persistent ledger record, switch through all five UIs, and verify the relevant views show the same canonical state.
- Specifically verify variant 2 expense classification persists in Current and variant 3 weekly review/reopen persists in Current.
- Verify ordinary `#/` remains free of comparison chrome.
- Verify the comparison selector on Greyson's iPhone viewport.

## 8. Active Decisions and Prohibitions

- GitHub Pages is the zero-backend Greyson test path.
- The alternate designs are live comparison UIs over the canonical data model, not data migrations and not mock demos.
- Alternate UI actions must use the existing repository/model semantics or route into canonical persistent forms.
- Do not create per-variant databases, fixture-backed substitutes, session-only record copies, or data reset behavior.
- Do not add authentication, cloud sync, custom domain, native wrapper, or backend as part of this comparison milestone.
- Do not expose the switcher during ordinary use without `?demo=1`.

## 9. Revision Log

### Revision 4 — 2026-09-09

- **Artifact/source identity:** `main@e0b4e24aff006250f002e04bc74f19274923288a`.
- **Correction:** Revision 3's synthetic-isolation assumption was explicitly rejected by the user and is superseded.
- **State delta:** all five UIs now share one mounted `LedgerProvider` and canonical IndexedDB authority. Reach Desk reads live week/dash state and routes to persistent canonical actions; Resolve reads live unresolved records and persists expense classifications; Week as a story reads live weekly data and persists review/reopen; Year at a glance derives live annual/month data.
- **Regression protection:** `src/tests/uxSharedLedger.test.ts` prevents the alternate tree from moving outside the shared provider or reconnecting concepts to synthetic fixtures.
- **Validation:** PR #3 CI fully green before merge. Live Pages/device proof remains pending.

### Revision 3 — 2026-09-09 — superseded

The earlier synthetic, IndexedDB-isolated UX lab architecture was implemented but did not satisfy the intended comparison workflow. Its isolation invariants are no longer authoritative.
