# Dash Ledger Release Gate

Independent final-release / integration-gate verification of the completed
`finish-dash-ledger` branch. This document is the durable release decision
packet. **It does not authorize a merge and `main` was not modified.**

## Verdict

**PASS** — the technical evidence supports integrating `finish-dash-ledger` into
`main` by an ordinary merge. This is a *technical* verdict only; human
authorization to move `main` has **not** been granted.

## Candidate

- Branch: `finish-dash-ledger`
- SHA: **`c65a032a4fdca03979705c23497586d59d4975eb`**
- Final commit: `fix: close final release gate defects`

## Main baseline

- `origin/main`: **`9353b54f06d4ae0791104e923c4625a05aa455a9`** — unchanged, confirmed after all gate work.

## Protected ancestry (independently confirmed)

```
9353b54  main baseline (origin/main, origin/HEAD)
  └─ 10d3d01  Phase 0 (origin/phase0-canonical-db-isolation-and-legacy-import)
       └─ db2e71b  Phase 2 (origin/phase2-desk-field-workflow)
            └─ 58bcadb 81c9143 b41b666 198bbb3 05d4887 a43112d 3cffb3e  Phases 3–9
                 └─ c65a032  release-gate fix  ← CANDIDATE
```

Linear history, no merge commits. `merge-base(origin/main, finish-dash-ledger)`
= `9353b54` (the baseline). `origin/main` is a strict ancestor of the candidate.

## What was independently re-verified (not taken from the prior report)

- Full test suite run fresh: **252 / 252** across 28 files (the prior report
  said 249 — see *Release defects*, the +3 is this gate's regression tests).
- Full suite re-run under `TZ=Pacific/Kiritimati` (UTC+14) and
  `TZ=Pacific/Midway` (UTC-11): 252 / 252 each.
- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`: all clean.
- Production build output inspected: `dist/index.html`, `manifest.webmanifest`,
  `sw.js` + workbox, static JS/CSS + icons. No server-function output, no
  `.vercel/`, no backend.
- Runtime user journeys A–H exercised against the **production build** at
  390×844, plus no-scroll sweeps at 375/430/1280.
- **Genuine offline test**: preview server fully stopped, page reloaded — SW
  served the shell, data read, a local expense written and persisted.
- Every export artifact's **bytes** inspected (full/ledger-only JSON, 3 CSVs,
  Tax Binder HTML).
- 24 critical data-integrity invariants traced to real, passing tests.
- iOS/Safari source-level portability audit of 14 risk-prone API surfaces.
- Read-only local merge simulation: **zero conflicts**, aborted, `main` untouched.

## Full validation results

| Check | Result |
|---|---|
| `npx vitest run` | **252 passed / 252** (28 files) |
| `TZ=Pacific/Kiritimati npx vitest run` | 252 passed / 252 |
| `TZ=Pacific/Midway npx vitest run` | 252 passed / 252 |
| `npm run typecheck` (`tsc -b --noEmit`) | clean, exit 0 |
| `npm run lint` (`eslint . --max-warnings 0`) | clean, exit 0, zero warnings — none suppressed |
| `npm run build` (`tsc -b && vite build`) | static `dist/` + `sw.js` + manifest, 13 precache entries, exit 0 |
| `git diff --check` | clean |
| Production deps | **3** (`dexie`, `react`, `react-dom`) — `package.json` / `bun.lock` unchanged in the whole branch delta |
| Branch delta vs `origin/main` | 69 files, +8826 / −379. No binaries, no `dist/`, no `.env`, no `node_modules`, no lockfile change, no Grok server/platform files, no unrelated projects. `DashHome.tsx` deleted (replaced by `features/desk/DeskScreen.tsx`) — no conflicting retention. |
| External runtime network in build | **none** — no `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` in runtime source; the only external URLs in the bundle are Dexie/React **error-message strings** (`bit.ly/2kdckMn`, `tinyurl.com/y2uuvskb`, `reactjs.org/docs/error-decoder`), not calls. No remote fonts, no CDN, no analytics/telemetry. |

## Critical data-integrity results

All traced to a passing test and, where feasible, re-observed at runtime.

| # | Invariant | Proof |
|---|---|---|
| 1 | Only one active dash | `shiftFlow.test.ts` — concurrent `startShift` → 1 row; a second start returns the existing one (`created: false`) |
| 2 | Active dash survives reload | `shiftFlow.test.ts` (`loadSnapshot`) + runtime Journey B (reload with server up, then with server **down**) |
| 3 | Reversed odometer rejected at **every** completion path | `shiftFlow.test.ts` — `endShift`, `logCompletedShift`, `updateShift(→completed)` all `rejects.toThrow(/lower than the starting odometer/i)`; shared `assertNotReversed` guard in `repositories.ts`; never zeroed/swapped |
| 4 | Suspicious mileage preserved exactly | `shiftFlow.test.ts` (`endOdometer` stored as entered, status `suspicious`) + runtime Journey C (500 mi flagged, Save stays enabled) |
| 5 | Continuity gaps excluded from business miles | `mileage.test.ts` (`countableBusinessMiles(1150→1000) === 0`), `aggregation.test.ts` |
| 6 | Local dates stay local | `dates.test.ts` + `timezone.test.ts` (`mondayOf`/`yearOf`/`isoToLocalDate`/`todayLocalDate` identical under +14 / UTC / −11); full suite green under all three |
| 7 | App earnings are integer cents | `money.test.ts`, `backup.test.ts` (`appEarningsCents` is a `number`; no `appEarnings` float field) |
| 8 | Cash tips remain distinct | `aggregation.test.ts`, `csv.test.ts` (null tip → empty CSV cell, not `0`) |
| 9 | `$96.50 → 9650 cents` | `import.test.ts` (`THE $96.50 -> $0.00 REGRESSION`), `legacyMoney.test.ts` |
| 10 | Conflicting legacy money not guessed | `importHybrid.test.ts` (`money-conflict` issue raised for disagreeing `appEarnings`/`appEarningsCents`; not merged) |
| 11 | Missing money ≠ silent zero | `legacyMoney.test.ts` (`legacyDollarsToCents(undefined/null/NaN) → null`) |
| 12 | Canonical DB name `dash-ledger-canonical-v2` | `db.ts:40`, `legacyDb.test.ts` |
| 13 | Legacy DBs not upgraded/deleted | `legacyDb.test.ts` — source read back with raw IndexedDB, byte-for-byte identical after import |
| 14 | Receipt original survives optimisation/storage failure | `receiptSurvival.test.ts` (decode fail, resize fail, processed-put fail all keep the original bytes) |
| 15 | Failed restore preserves previous ledger | `restore.test.ts` (whole-payload validation, single transaction) |
| 16 | Restore safety acknowledgement required | `restoreSafety.test.ts` (19) + runtime Journey G (two-step gate visible) |
| 17 | v2 backup identity unambiguous | `backup.test.ts`; runtime — `format: "dash-ledger-backup-v2"`, `formatVersion: 2`, `producer`, `generatedAt` all present; ledger-only is `dash-ledger-ledger-only-v2` + `imagesOmitted: true` |
| 18 | Original/cc/Grok imports supported at their boundaries | `import.test.ts` (31), `importHybrid.test.ts` (14), `legacyDb.test.ts` (9), `legacyMoney.test.ts` (12) |
| 19 | Monday–Sunday weeks | `dates.test.ts` (`mondayOf('2026-01-05') === '2026-01-05'`, Sunday → prior Monday) |
| 20 | Mileage-rate boundary resolution | `mileageRates.test.ts` (`2026-06-30 → 0.725`, `2026-07-01 → 0.760`; user override beats seed) + in-app self-test |
| 21 | Unpriced mileage stays explicit | `aggregation.test.ts`, `weekReview.test.ts` (`no-rate` info item, never zeroed) |
| 22 | CSV formula-injection mitigation | `csv.test.ts` + runtime — `=SUM(A1:A9)` merchant exported as `'=SUM(A1:A9)`, not `,=SUM(...)`; real negatives stay numeric |
| 23 | Reversible deletion preserves independent evidence | `undoDelete.test.ts` (5) — deleting a shift/expense/receipt keeps the linked-but-independent counterpart; restore re-links only where the counterpart still exists; restored row's own link field stays truthful |
| 24 | Stale-week-review logic | `weekReview.test.ts` (`weekChangedSinceReview`) + runtime Journey E (edit a record in a reviewed week → "changed since" notice + "Mark reviewed again" → reopen) |

## Runtime journey results

Production build (`vite preview`), synthetic data only.

| Viewport | Journeys | Result |
|---|---|---|
| **390 × 844** (primary) | A fresh start · B active work + reload · C end work (reversed blocked / suspicious flagged / valid) · D expense create + undo delete · E week close → mutate → stale → reopen · F year month-table + reconciliation (no silent match) · G vault backup / archive-distinct / exports / recovery / restore gate / storage / diagnostics self-test (28 checks ✓) · H "Needs review" points at real records only | **all PASS**, zero console errors |
| 375 × 667 | no-scroll sweep of 8 screens | PASS |
| 430 × 932 | no-scroll sweep of 5 screens | PASS |
| 1280 × 900 | no-scroll sweep + content capped at 640px | PASS |
| 390 × 844 | 15 screens: horizontal-scroll + error-boundary check | PASS (none) |
| — | Sheet a11y: `aria-modal`, labelled, focus enters, body scroll lock + restore, Escape closes | PASS |

## Offline evidence

**VERIFIED (genuine).** The preview server was fully stopped mid-session — a
direct uncached `fetch` to the origin failed, proving the network was down.
With the server down:

- the page reloaded and the Desk rendered from the service-worker precache (not
  an error shell);
- seeded records were visible (data read from IndexedDB);
- route navigation worked (`/week`, `/vault?s=backup`);
- **a new expense was created and persisted** (IndexedDB count 1 → 2);
- return to the Desk with no crash; SW still controlling; no console errors.

**ENVIRONMENT-LIMITED:** camera capture offline (no camera hardware in the
harness) and behaviour on a physical iOS device.

## Export / download evidence

**GENERATED CONTENT VERIFIED** (bytes inspected directly):

| Artifact | Findings |
|---|---|
| Full JSON | `format: dash-ledger-backup-v2`, `formatVersion: 2`, `schemaVersion: 1`, `producer`, `generatedAt`; accurate `counts`; shift money is integer cents (`appEarningsCents: 9650`), **no `appEarnings` float field**; receipt image embedded as `data:image/png;base64,…`; parses; `validateBackup` → ok |
| Ledger-only JSON | `format: dash-ledger-ledger-only-v2`, `imagesOmitted: true`, receipt `image` field **absent**, validates ok |
| Shifts CSV | CRLF rows, header correct; `"Corolla, ""the blue one"""` (RFC-4180 quote+comma+escape); `Prïus ünïcodé` (unicode); `"line1\nline2, with comma"` (newline field quoted); money `96.50 / 12.00 / 108.50`; **null cash tip → empty cell, not `0`** |
| Expenses CSV | `'=SUM(A1:A9)` formula-injection neutralised; tax-class text; `19.99` cents |
| Mileage-rate CSV | 19 seeded effective-dated rows + header, `0.510 … 0.760` |
| Tax Binder HTML | standalone `<!doctype html>…</html>`, embedded `<style>`, **no external stylesheet, no `<script>`**; title + h1 + 9 sections; money formatted, no raw cents; user text escaped; embedded receipt data URL; disclaimer; renders in an isolated iframe (h1, 5 tables, embedded CSS background) |

**BROWSER DELIVERY: NOT VERIFIED (environment-limited).** The preview sandbox
blocks `<a download>` file saves and provides no `navigator.share`, so a real
saved file could not be produced. The `deliverFile` code path
(`navigator.share({files})` → `<a download>` fallback → object-URL revoke) is
straightforward and returns the correct result string, but a physical download
was not observed here.

## iOS / Safari portability review

Source-level audit; **no physical iOS/Safari device was available**.

| Surface | Handling | Verdict |
|---|---|---|
| IndexedDB / Dexie 4 | `indexedDBAvailable()` guard; `NoIndexedDb` + `DbError` fallback screens | OK |
| Blob storage | separate `receiptBlobs` table; original-byte fallback | OK |
| `navigator.storage.persist/persisted/estimate` | every call `typeof … === 'function'` guarded, non-fatal, honest "not supported" state | OK |
| Service worker | `'serviceWorker' in navigator` + `import.meta.env.PROD` gate | OK |
| PWA install | `apple-touch-icon`, `apple-mobile-web-app-*` meta, `display: standalone`, `scope: './'` | OK |
| `<input capture="environment">` | present **and** a plain file input fallback | OK |
| `<a download>` | Web Share (`navigator.share({files})`, iOS 15+) tried first, `<a download>` fallback | OK |
| Web Share | `canShareFiles()` triple-guarded, `AbortError` handled | OK |
| `BroadcastChannel` (iOS 15.4+) | `typeof … === 'function'` guarded; absence harmless (invariants in the tx) | OK |
| `crypto.randomUUID` (iOS 15.4+) | guarded with an RFC-4122-ish `Math.random` fallback | OK |
| `createImageBitmap` (iOS 15+) | `canProcess()` guard; on absence the original image is stored unmodified (first-class no-op) | OK |
| `:focus-visible` (iOS 15.4+) | skip link uses `:focus`; sheets manage focus manually | OK |
| Fixed/sticky nav + safe-area | `viewport-fit=cover`; `env(safe-area-inset-*)` with `0px` fallback on bottom nav, sheet body, toast wrap | OK |
| Mobile keyboard over controls | sheets are `max-height: 92vh` with an internally-scrolling body; primary button inside the scroll area, not fixed | OK by design |
| `scrollIntoView` | `typeof … === 'function'` guarded | OK |

**No concrete compatibility bug found.** Every optional API is feature-detected
with a first-class fallback. The classic iOS `100vh`/keyboard viewport quirk
affects the sheet backdrop like every web app; the internal scroll mitigates it;
it cannot be verified or fixed without a device.

**Remains physical-device-only:** real add-to-home-screen install, iOS storage
eviction under pressure, on-device Web Share, and Safari-specific IndexedDB
timing.

## Suspected risks disposition

| # | Prior risk | Disposition | Why |
|---|---|---|---|
| 1 | Transiently reversed **active** dash during edit | **KEEP AS-IS** | No *completed* reversed dash can be persisted — `assertNotReversed` guards `endShift`, `logCompletedShift`, and `updateShift`-to-completed; `ShiftForm` also UI-blocks it. `computeMileage` contributes 0 and it is flagged in review. Blocking an in-progress active edit would trap a user correcting one field at a time. No corruption is possible. |
| 2 | Elapsed-time display on a dash open > 24 h | **FIXED** (commit `c65a032`) | `shiftDuration` wrapped a >24 h span to a small number ("2h 48m" for a 26 h dash). Replaced with a new pure `elapsedSince(date, startTime, now)` that diffs the real local start against now, is day-boundary safe, and returns `{ known: false }` for a missing or future start. 3 regression tests. Runtime-confirmed: a dash open since yesterday 20:00 now shows "26h 49m". |
| 3 | Non-numeric `:year` route param | **KEEP AS-IS** | `Number('abc') → NaN` → the folder filter matches nothing → the "Nothing in this folder" empty state. No crash, no wrong data. Graceful degradation of a hand-typed malformed URL is acceptable. |

## Deferred optional ideas

None is required for the currently promised product; all remain **OPTIONAL FUTURE**.

| Idea | Status | Why not required now |
|---|---|---|
| Client-side receipt OCR | OPTIONAL FUTURE | The product promises camera/file capture + an Inbox + manual classification — a complete workflow. OCR is never claimed. A WASM engine would break the "3 deps / nothing leaves the device / works from `file://`" constraints. |
| Per-record edit history | OPTIONAL FUTURE | No change-log is promised. Editing recalculates derived values and the Phase-4 "changed since review" signal already covers the highest-value case (a reviewed week that moved). |
| `#/start?auto=1` one-tap shortcut | OPTIONAL FUTURE | The documented promise is "a stable hash link straight to Start Dash" — the existing `#/start` link (copied from Settings) fulfils it; with a vehicle it is 2 taps. A one-tap auto-start needs an idempotency proof against the single-active-dash rule. |
| Manual multi-platform earnings per dash | OPTIONAL FUTURE | The product is scoped as "a DoorDash work ledger" (app earnings + cash tips). Multi-platform is outside the stated scope and is a data-model + backup-schema + Tax Binder change. |

## Release defects found

| ID | Severity | Finding | Fix | Test |
|---|---|---|---|---|
| RG-1 | LOW | Active-dash "Elapsed" on the Desk used `shiftDuration`, which wraps a >24 h span (a dash open since yesterday 20:00 showed "2h 48m" instead of "26h 49m") | New pure `elapsedSince(date, startTime, now)` in `domain/duration.ts`, day-boundary safe, `{ known: false }` for missing/future start; wired into `ActiveDashCard` | `src/tests/duration.test.ts` — same-day, across-a-day-boundary, missing/clock-skew (3 new) |

(The prior 3-pass bug sweep's 4 fixes — BUG-001…004 — were re-confirmed present
in the branch: `pendingReview` single-pass, `no-rate` → `/vault?s=rates`,
`isoToLocalDate` for receipt bucketing, `formatCents` in the End-Dash toast.)

## Remaining confirmed defects

**None** in the inspected scope. Two low-severity "suspected risks" were
re-evaluated and deliberately kept as-is with the rationale above (no defect —
graceful, non-corrupting behaviour).

## Remaining environmental limits

- No physical iOS/Safari device — install, storage eviction, on-device Web
  Share, Safari IndexedDB timing are un-run.
- Browser file **download delivery** (the `<a download>` / Web Share save step)
  could not produce a real saved file in the sandbox — generated **content** is
  verified, physical save is not.
- Camera capture **while offline** not exercised (no camera hardware).

## Merge-readiness judgment

The technical evidence justifies integration:

1. **Lineage** — `merge-base(origin/main, finish-dash-ledger) = 9353b54` (the
   baseline); `origin/main` is a strict ancestor of the candidate; linear
   history, no merge commits.
2. **Capabilities** — every capability promised in `README.md` and
   `PROJECT_COMPLETION_REPORT.md` has a verified implementation path (Gate 2),
   and the field/expense/receipt/week/year/vault/PWA journeys were exercised end
   to end (Gate 6).
3. **Data integrity** — all 24 critical invariants trace to a passing test and,
   where feasible, were re-observed at runtime (Gate 3).
4. **Quality bars** — 252/252 tests (also under UTC±extreme), typecheck, lint,
   and a static build all pass; no warnings suppressed.
5. **No unresolved release-blocking bug** — the one LOW defect found this gate
   (RG-1) is fixed and tested; the two kept risks are non-corrupting.
6. **No unrelated destructive material** — 69-file delta is all product source,
   tests, docs, and CSS; no binaries, lockfile change, `dist/`, secrets, or Grok
   platform files; `DashHome.tsx` is deleted, not left conflicting.
7. **Reconstructable** — the candidate is pushed; `local HEAD == origin/finish-dash-ledger`.
8. **`main` clean** — `origin/main` is unmoved at `9353b54` and has **0**
   commits the candidate lacks; a read-only local merge simulation completed
   with **zero conflicts** and was aborted.

The one honest gap is physical-iOS verification, which is an environmental
limitation, not a code defect, and does not block a static local-first PWA whose
optional APIs are all feature-detected.

## Exact candidate SHA

`c65a032a4fdca03979705c23497586d59d4975eb`

`origin/main` is and remains `9353b54f06d4ae0791104e923c4625a05aa455a9`. **This
gate did not merge `main`, did not move any branch other than
`finish-dash-ledger`, and did not tag or deploy.**
