# Dash Ledger Completion Report

## Final status

**PASS.** Phases 3–9 of the finishing run are complete, validated, committed and
pushed. The internal product is feature-complete against its README promises, the
synthesis blueprint, and the protected invariants; an evidence-backed comparative
pass and a three-pass exhaustive bug sweep are done.

## Final branch

`finish-dash-ledger` — branched from the protected Phase 2 checkpoint, never
merged to `main`, never force-pushed.

## Starting Phase 2 commit

`db2e71bd57cdbfc2be3860ec5fcdeb193a986332` (`feat: build mobile field desk workflow`)

## Phase checkpoints

| Phase | Purpose | Commit | Validation |
|---|---|---|---|
| 3 | Finish expense & receipt workflows — reversible deletion with link-aware undo; receipt quick-category chips; non-cascading deletes tested both directions | `58bcadbf5b92e95a81b08a82bc2519bed9166346` | 211 tests · typecheck · lint · build · runtime |
| 4 | Finish weekly review — phone-first reading order (happened → needs attention → complete review); collapsible detail; stale-review detection on a closed week | `81c9143b626628b5fbe9abfa90340ac0ac4bac03` | 220 tests · typecheck · lint · build · runtime 375/390/430 |
| 5 | Finish Year / Vault / exports — month-by-month drill-down; CSV formula-injection neutralisation; Tax Binder test coverage; v2 format markers corrected | `b41b66671644316b589ad0b6ad941cfc11f2f619` | 231 tests · typecheck · lint · build · Tax Binder rendered standalone |
| 6 | Harden offline / mobile — skip link; cross-tab BroadcastChannel reload; archived-default vehicle reassignment; `/start` no-vehicle redirect | `198bbb362a6ae2ae885b0d6200dfb1541de443b7` | 238 tests · typecheck · lint · build · production PWA (SW controlling, precache) |
| 7 | Complete the system — terminology coherence ("the Desk"); README rewritten for the finished product | `05d4887de78acb74e9c414b317ffacf5a85130aa` | 238 tests · typecheck · lint · build · full-journey runtime |
| 8 | Evidence-backed improvements — comparative recon vs 8 analogues; unified "Needs review" surface implemented | `a43112def0ad5b9e4a12e7c1c3167b398b2c4ee6` | 243 tests · typecheck · lint · build · runtime multi-week |
| 9 | Exhaustive bug sweep — 3 passes; 4 confirmed bugs found and fixed; final runtime matrix + data-integrity regression | *(this checkpoint)* | 249 tests · typecheck · lint · build · TZ ×3 · runtime 4 viewports |

## Product capabilities now complete

**Field workflow**
- The Desk as the home surface: Ready state, dominant Start Dash, current-week
  snapshot, thumb quick actions, recent dashes, "Needs review" surface, backup
  health — no onboarding wall.
- Start / End Dash as focus-trapped sheets over the Desk; 2-tap happy path;
  first-vehicle chaining; persistent "on the road" indicator (card + shell bar +
  nav dot) that survives reload.
- Historical entry (`/log`) and full editing with recomputation.
- Reversible deletion of dashes / expenses / receipts with a link-aware Undo.

**Money & mileage**
- Integer-cent money, one owning module; app earnings and cash tips distinct end
  to end.
- Business miles = end − start odometer; reversed rejected at every completion
  path in the repository; suspicious preserved and flagged; per-vehicle
  continuity with prefill; gaps never counted.

**Weeks & years**
- Mon–Sun weeks; typed deep-linked completeness list; explicit close / reopen
  that never freezes records; stale-review detection.
- Year summary + month-by-month drill-down; effective-dated mileage estimate
  (2011–2026 seed); unpriced-mile reporting; annual odometer & business-use
  planning; actual-expense comparison; statement / 1099 reconciliation (never
  auto-matched).

**Data ownership**
- Full JSON backup, ledger-only JSON, three CSVs (RFC-4180 + formula-injection
  neutralised), standalone printable Tax Binder HTML.
- Validated single-transaction restore behind a mandatory safety-backup step;
  archive confirmation distinct from file generation.
- Per-dialect legacy import (original app / earlier cc build / Grok), hybrid
  conflict reporting, read-only legacy databases.
- Diagnostics + self-test; honest storage-health + persistence request.

**Platform**
- Static Vite + React + Dexie PWA, 3 production dependencies, hash routing,
  `base: './'`. Offline after first load; `registerType:'prompt'` +
  `skipWaiting:false` update flow. No account, server, telemetry, or external
  network call in ordinary use.

## Protected data-integrity invariants

All verified green in the final regression bundle (`BUG_SWEEP_REPORT.md` §
"Final data-integrity regression"):

- one and only one active dash · reversed odometer rejected (never zeroed/swapped)
  · suspicious mileage preserved + flagged · continuity gaps excluded from
  business miles · local dates stable under +14 / UTC / −11 · integer-cent money
  · app earnings ≠ cash tips · **`$96.50 → 9650 cents`** · conflicting legacy
  money left unresolved · missing money ≠ zero · receipt original survives
  processing failure · legacy DB read-only and byte-identical after import ·
  canonical DB `dash-ledger-canonical-v2` · pre-restore safety gate required ·
  failed restore preserves the previous ledger · canonical v2 backup identity ·
  old backup import · Mon–Sun weeks · rate boundary resolution · unpriced
  mileage reported not zeroed · export round-trip · reversible delete never
  loses independent evidence.

## Runtime coverage

- **Viewports:** 375 × 667, 390 × 844, 430 × 932, 1280 × 900 — no horizontal
  scroll on any of 15 screens; desktop content capped at 640 px.
- **Journeys (production build, SW active):** fresh install → first vehicle via
  chaining → 2-tap start → reload keeps active → Expense quick action → Receipt
  quick action → End Dash (reversed blocked, valid accepted) → week updates →
  Needs-review card → week close/reopen → Year month table + reconciliation +
  Tax Binder → Backup panel (full / ledger-only / CSVs / two-step restore) →
  Recovery route reachable with zero vehicles.
- **Offline:** service worker controlling, precache populated (10 entries),
  `navigateFallback: index.html`; no external host in the network log.
- **Console:** no errors on a clean load.

## Full test result

**249 passed / 249** across **28 files** (`npx vitest run`). Also **249 / 249**
under `TZ=Pacific/Kiritimati` and `TZ=Pacific/Midway`.

New in this run: `undoDelete`, `weekReview`, `taxBinder`, `yearMonths`,
`vehicles`, `pendingReview`, `timezone`, `sheet.dom`, `desk.dom` (extended),
`shiftFlow` (extended), `csv` (extended).

## Build / typecheck / lint result

- `npm run typecheck` — clean (`tsc -b --noEmit`).
- `npm run lint` — clean (`eslint . --max-warnings 0`, zero warnings allowed).
- `npm run build` — static `dist/` with `index.html`, `sw.js`, `manifest.webmanifest`,
  13 precache entries. No server output.
- `git diff --check` — clean.
- No warnings suppressed to obtain green.

## Comparative recon summary

Full analysis in **`COMPARATIVE_RECON.md`**. Analogues examined: **Gridwise,
Everlance, Hurdlr, Stride, Driversnote, Solo, GigClaim** (privacy-focused direct
analogue), **LubeLogger** and the open-source local-first tracker landscape.

- **What they do better:** background GPS auto-mileage, receipt OCR, bank/card
  auto-import, estimated quarterly tax, multi-platform earnings aggregation,
  pay-discrepancy claims — all requiring a background-native runtime, credentials,
  or a backend. Classified **Avoid** for a static no-backend PWA.
- **What Dash Ledger does better:** true on-device privacy with no account or
  subscription; factual integrity (never invents/zeros/clamps/guesses);
  integer-cent money; per-dialect legacy recovery with a permanent `$96.50`
  regression; two-step safety-backup restore; receipt original-byte survival;
  standalone offline Tax Binder; a deterministic 249-test domain; runs from any
  static host or `file://` forever.
- **Obvious gain implemented:** a **unified "Needs review" surface** — the
  review-queue pattern every analogue centres on, built as pure snapshot
  aggregation across the whole ledger (`pendingReview`), rendered as one Desk
  card, zero new dependency, no integrity trade-off.
- **Ideas suggested, not implemented (need a human decision):** client-side
  receipt OCR (dependency-size cost), per-record edit history (write-volume
  cost), `#/start?auto=1` one-tap dash (idempotency proof), manual multi-platform
  earnings per dash (data-model change). Each has a bounded experiment and a
  pass/fail signal in `COMPARATIVE_RECON.md`.

## Obvious gains implemented

1. **Unified "Needs review" surface** (Phase 8) — `pendingReview()` +
   Desk card. Validated: `pendingReview.test.ts`, runtime multi-week, perf
   re-checked after BUG-001 (6 ms at 1500 shifts).
2. **CSV formula-injection neutralisation** (Phase 5) — `neutraliseCsvInjection`
   in `csvEscape`. Validated: `csv.test.ts`.
3. **Stale-review detection on a closed week** (Phase 4) —
   `weekChangedSinceReview()`. Validated: `weekReview.test.ts`, runtime.
4. **Reversible deletion with link-aware undo** (Phase 3) — repository
   `DeletedX` payloads + `restoreDeletedX`. Validated: `undoDelete.test.ts`.
5. **Year month-by-month drill-down** (Phase 5) — `summariseYearByMonth()`.
   Validated: `yearMonths.test.ts`, runtime.

## Potentially useful ideas not implemented

See `COMPARATIVE_RECON.md` → *Potentially useful ideas NOT implemented* and
*Experiment*. Summary: receipt OCR, per-record edit history, `#/start?auto=1`,
manual multi-platform earnings. All are **Experiment / Avoid** for this
architecture and are left for a human decision.

## Final bug sweep

- **Passes completed:** 3 (sweep → fix → validate, twice, then a final
  independent sweep that surfaced no new confirmed bug).
- **Confirmed bugs discovered:** 4.
- **Fixed:** 4 — BUG-001 `pendingReview` O(weeks×shifts) perf stall (420 ms →
  6 ms); BUG-002 `no-rate` issue linked to `/settings` instead of
  `/vault?s=rates`; BUG-003 receipt year bucketing used the UTC date of
  `capturedAt`; BUG-004 End-Dash toast formatted gross with a raw float.
- **Remaining confirmed bugs:** 0.
- **Suspected risks (assessed, left as-is):** 3 — `updateShift` allowing a
  transiently reversed *active* dash (intentional; no corruption possible);
  elapsed-time display on a dash left open > 24 h (cosmetic); non-numeric
  `:year` route param (falls to an empty state).
- **Final verdict:** **PASS (conservative)** — no unresolved confirmed bug in
  the inspected scope; the last independent sweep found nothing new. Not a proof
  of zero defects. Full detail in **`BUG_SWEEP_REPORT.md`**.

## Known environmental limitations

- **No physical iOS / Safari device testing.** All mobile and PWA claims are
  from a 375–430 px emulated viewport plus jsdom integration tests. Real
  home-screen install, iOS storage eviction behaviour, and Web Share on a device
  are unverified.
- **True airplane-mode offline** could not be toggled in this harness. Offline
  is verified indirectly: SW controlling, precache populated,
  `navigateFallback` configured, no external network requests.
- **Downloads** (`<a download>` / Web Share) are inert in the preview sandbox;
  export *delivery* is verified by inspection and returns the right result
  string, not by a real saved file.
- Dev-server `import('/src/...')` probes produced one harmless `404` in the
  console during testing — not an application asset.

## Remaining user decisions

Only genuine choices that need the human:

1. **Client-side receipt OCR** — worth a bounded WASM experiment (pass/fail:
   install size grows < 1 MB and a receipt decodes in < 3 s offline)? It is the
   single largest "faster capture" gain competitors offer.
2. **Per-record edit history** — is an append-only change log per shift/expense
   worth the backup-size and UI cost for a solo user, given the Phase 4
   "changed since review" signal already covers the main case?
3. **`#/start?auto=1` one-tap dash** for an Apple Shortcut — ship it if it can
   be proven idempotent against the single-active-dash rule under a double-fire?
4. **Manual multi-platform earnings per dash** (an `otherEarningsCents` field) —
   worth the data-model + backup-schema + Tax Binder changes for drivers who
   multi-app on one shift?
5. **Merging `finish-dash-ledger` into `main`** — out of scope for this
   autonomous run; the branch is pushed and ready for review.
