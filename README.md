# Dash Ledger

A local-first, mobile-first work ledger for DoorDash delivery work. It exists to
make recording a shift extremely fast while keeping a trustworthy long-term
record of shifts, mileage, earnings, cash tips, working time, expenses, receipts,
and the weekly / yearly rollups that come from them.

Everything is stored in the browser's IndexedDB on the device. There is no
account, no server, no cloud database, no telemetry, and no external API. The app
works offline after the first load and installs as a PWA.

---

## Key capabilities

- **Fast shift entry** — Start Dash / End Dash with sensible prefills (today,
  default vehicle, current time, last odometer). The active dash is written
  immediately and survives reload / browser restart. Only one dash can be active
  at a time.
- **Historical entry & editing** — Log a completed dash that was never started in
  the app; edit any shift and every derived value recalculates.
- **Mileage** — business miles = ending − starting odometer. Reversed readings
  are rejected (never zeroed or swapped); a dash over the suspicious threshold
  (default 400 mi) is preserved and flagged. Per-vehicle odometer continuity with
  a prefill suggestion; continuity gaps are noted but never counted as business
  mileage.
- **Money** — DoorDash/app earnings and *additional* cash tips (not already in
  the app total) are separate. Stored as integer cents; one module owns parsing,
  formatting and arithmetic.
- **Expenses** — four tax-treatment classes (`VEHICLE_ACTUAL`, `MILEAGE_ADDON`,
  `NON_VEHICLE_BUSINESS`, `REVIEW`); unknown categories default to `REVIEW`.
  Vehicle actual-expense records are never folded into the standard-mileage
  estimate; parking and tolls stay separately visible.
- **Merchant memory** — after the same merchant is classified the same way twice,
  a suggestion appears. It is always a suggestion, always overridable, never
  auto-applied.
- **Receipts** — camera / file capture, an Inbox for un-classified photos,
  classification, virtual Year / Category folders, best-effort image
  optimisation that *always* preserves the original on failure. Images live in a
  separate IndexedDB table so list views only load thumbnails.
- **Weeks** — Monday–Sunday, keyed by the Monday date. Weekly summary, explicit
  weekly close (in progress / review due / reviewed, reopenable), and a
  record-completeness review (not a tax-compliance score).
- **Years** — yearly summary, effective-dated standard-mileage estimate
  (2011–2026 seeded, including the 2026-06-30 → 0.725 / 2026-07-01 → 0.760
  split), unpriced-mile reporting, annual odometer & business-use %,
  actual-expense planning comparison, and statement / 1099 reconciliation.
- **Exports** — full JSON backup (receipt images embedded as data URLs),
  ledger-only JSON (metadata, no image bytes), shifts CSV, expenses CSV, mileage
  rates CSV, and a standalone printable **Tax Binder** HTML file per year.
- **Backups** — validated, transaction-safe restore behind a required
  pre-restore safety-backup step. Backup-health status (Safe / Due / Overdue)
  that distinguishes "generated a file" from "confirmed an external archive".
- **Recovery / legacy import** — records from the original single-file Dash
  Ledger, from earlier builds of this app, and from the Grok build can be
  imported. Dollar amounts are converted to integer cents exactly once, at the
  import boundary. A record carrying two contradictory amounts is reported as a
  conflict and left unset rather than guessed at; a missing amount stays missing
  and never becomes `$0.00`. Legacy databases on the device are only ever read —
  never upgraded, cleared or deleted.
- **Diagnostics** — environment info, a bounded in-session log, and a built-in
  self-test that runs on pure functions plus an isolated temporary IndexedDB.

Dash Ledger organizes records and provides estimates. **It is not tax advice and
does not determine whether a particular expense is deductible.**

---

## Architecture

Plain static SPA: **Vite + React + TypeScript + Dexie (IndexedDB)**, tests with
**Vitest**, PWA via **vite-plugin-pwa** (Workbox `generateSW`). Hash-based
routing so deep links work on any static host with no server rewrites. No
backend, no state-management library, no runtime CDN dependencies, no remote
fonts.

Layer boundaries are deliberate:

| Layer | Location | Responsibility |
|---|---|---|
| Domain | `src/domain/` | Pure calculations: dates, money, duration, mileage, mileage rates, expense classes, aggregation, completeness, merchant memory, backup health. No React, no IndexedDB. |
| DB | `src/db/` | Dexie schema + versioning (`db.ts`) and the repository layer (`repositories.ts`). The only place that touches IndexedDB. Enforces invariants like single-active-dash inside transactions. |
| Services | `src/services/` | CSV, backup, restore, Tax Binder, receipt image processing, storage health, file sharing, diagnostics log, self-test. |
| Import | `src/services/import/` | The legacy compatibility boundary: detection, normalisation, conflict reporting, read-only legacy-database access. Everything the app knows about earlier data representations lives here and terminates here. |
| State | `src/state/store.tsx` | One React context that loads a full snapshot and reloads after mutations; toast + theme plumbing. |
| Features | `src/features/*` | Screen components per area (dash, week, expenses, receipts, vault, settings, diagnostics, onboarding). |
| App shell | `src/app/` | Router, route table, error boundaries, bottom nav, update banner. |
| Components | `src/components/` | Shared UI + form primitives. |

React components never contain authoritative financial formulas; IndexedDB
access never leaks into presentation components.

### Project structure

```
src/
  app/            router, App, ErrorBoundary, BottomNav, ToastHost, UpdateBanner
  components/     ui.tsx, forms.tsx, ReceiptImage.tsx, BackupHealthCard.tsx
  domain/        types, dates, money, duration, mileage, mileageRates,
                 expenses, merchantMemory, aggregation, completeness, backupHealth
  db/             db.ts (Dexie schema v1), repositories.ts
  services/      csv, backup, backupFormats, restore, safetyGate, taxBinder,
                 receiptImages, storageHealth, share, diagnosticsLog, selfTest
    import/      detect, normalize, legacyMoney, legacyDb, apply (legacy boundary)
  state/          store.tsx
  features/       dash/ week/ expenses/ receipts/ vault/ settings/ diagnostics/ onboarding/
  styles/        tokens.css, global.css
  tests/          Vitest suites + factories
scripts/         gen-icons.mjs (dependency-free PNG icon generator)
public/icons/    generated PWA icons + favicon
```

### Storage identity and backup formats

The canonical database is **`dash-ledger-canonical-v2`**.

It is deliberately not `dash-ledger`, which was used by *both* the original
single-file app and the first build of this one. Those two wrote incompatible
record bodies under that one name — dollars (`appEarnings: 96.5`) versus integer
cents (`appEarningsCents: 9650`) — so opening it here would let Dexie adopt rows
whose fields mean something different, and a real `$96.50` dash would render as
`$0.00`. `src/tests/import.test.ts` keeps that exact record as a permanent
regression fixture.

Earlier databases (`dash-ledger`, `dash-ledger-grok`) are treated as read-only
**recovery sources**: Vault → Recovery can find, summarise and import them, and
never upgrades, clears or deletes them.

Backups follow the same rule. The canonical formats are
`dash-ledger-backup-v2` / `dash-ledger-ledger-only-v2`, each carrying an explicit
`formatVersion` and `producer`. The ambiguous v1 marker `dash-ledger-backup` is
read (through the import adapters) but never written again.

| Source | Marker | How it is read |
|---|---|---|
| This build | `dash-ledger-backup-v2` | restored directly |
| Original app | `dash-ledger-backup` (dollar body) | Vault → Recovery import |
| Earlier cc build | `dash-ledger-backup` (cents body) | Vault → Recovery import |
| Grok build | `dash-ledger-grok-backup` | Vault → Recovery import |
| Hybrid A→B database | mixed bodies | per-record resolution; contradictions reported, never guessed |

---

## Getting started

Requires Node 18+ (developed on Node 22/26). `bun` or `npm` both work.

```bash
bun install          # or: npm install
bun run dev           # Vite dev server
```

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run typecheck` | `tsc -b` project references, no emit |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run test` | Vitest run (unit + IndexedDB integration via `fake-indexeddb`) |
| `npm run build` | `tsc -b && vite build` → static output in `dist/` |
| `npm run preview` | Serve the production build locally |
| `node scripts/gen-icons.mjs` | Regenerate PWA icons |

---

## Deployment / static hosting

`npm run build` produces `dist/` as ordinary static files. Host it anywhere that
serves static content.

- **Base path** is `./` (relative), so it works from a sub-path such as
  `https://user.github.io/dash_ledger_cc/`.
- **Routing** is hash-based (`#/week`, `#/start`, …), so no SPA rewrite rule is
  needed. The service worker also registers a navigation fallback to
  `index.html`.
- **GitHub Pages:** publish the contents of `dist/` (e.g. via an action or the
  `docs/` folder pattern). No server configuration required.

---

## PWA / offline behaviour

- `manifest.webmanifest` with 192 / 512 / maskable-512 icons, `standalone`
  display, `start_url` / `scope` of `./`.
- Workbox `generateSW` precaches **only** the app shell and versioned static
  assets (JS/CSS/HTML/icons/manifest). User data is never touched by the service
  worker — IndexedDB remains the single live database.
- Update flow is `registerType: 'prompt'`: a new version shows an unobtrusive
  "Update available" banner and only reloads on a deliberate tap, so in-progress
  form input is not lost.
- After the first load, these work offline: open the app, view records, start /
  end / edit a dash, weekly & yearly views, add expenses, capture receipts from
  the local camera/file picker, view stored receipts, and create local exports.

Some embedded browser previews disallow service-worker registration; use a real
browser over `http(s)` to exercise install / offline.

---

## Local data model

Schema version **1** (Dexie `version(1)`). Migrations get their own
`version(n).upgrade()` block in `src/db/db.ts`; migration behaviour is never
designed around deleting the database, and failures surface in diagnostics.

Tables: `vehicles`, `shifts`, `expenses`, `receipts`, `receiptBlobs`,
`weeklyClosures`, `mileageRates`, `merchantMemory`, `kv` (single-row `settings`
and `meta`).

- **IDs** are `crypto.randomUUID()` (with a strong fallback).
- **Work dates** are local-date strings `YYYY-MM-DD` — never a UTC instant. Event
  timestamps (`createdAt`, `capturedAt`, …) are ISO strings.
- **Money** is integer cents everywhere.
- **Receipt images** live in `receiptBlobs` keyed by receipt id: full/archival
  `Blob` + optional thumbnail `Blob`. Normal receipt queries never load image
  bytes.

### Receipt storage & image processing

On capture the image is decoded with `createImageBitmap`. If the longest edge is
over ~2000 px an archival JPEG (~q0.82) is produced; a ~360 px thumbnail (~q0.70)
is always attempted. **If decoding or resizing fails, the original Blob is kept,
the receipt is still created, and a human-readable processing error is recorded.**
A failed/empty processed output is never committed.

### Mileage-rate data model

`mileageRates` holds effective-dated periods: `startDate`, `endDate` (or `null`
for open-ended), `ratePerMile` (dollars per mile), `label`, `source`, `seeded`.
Resolution for a shift date: consider periods whose range contains the date,
prefer the latest effective start date, and a user override (`seeded: false`)
wins over a seed with the same start date. No rate → those miles are reported as
`unpricedMiles` and left unpriced. The seeded table covers 2011–2026; add future
or custom periods in Tax / Vault → Rates. **Rates are never fetched online.**

### Backup, restore & exports

- **Full backup** (`format: "dash-ledger-backup"`) — every collection plus
  settings/meta; receipt images embedded as base64 data URLs. Self-sufficient.
- **Ledger-only** (`format: "dash-ledger-ledger-only"`, `imagesOmitted: true`) —
  all metadata, no image bytes. An export, not an image-restorable backup.
- **Restore** validates the whole payload first (root shape, known format,
  schema not newer than supported, arrays where expected, valid/unique IDs,
  valid local dates, sane cross-links, structurally valid image payloads, at most
  one active dash). It then replaces every authoritative table inside **one Dexie
  transaction** — a failure rolls back and leaves the previous database intact.
- **CSV** is UTF-8, CRLF row endings, RFC-4180 quoting (fields with `"` `,` CR or
  LF are quoted, embedded quotes doubled).
- **Tax Binder** is a standalone HTML file with embedded CSS and embedded receipt
  images; readable and printable with no JavaScript and no dependency on the app.

### Backup-health status

Tracks the last record change, the last generated backup, and the last
*confirmed external archive* (a separate explicit action — generating a file does
not prove it is stored safely).

- **Safe** — no records yet, or nothing changed since the confirmed archive.
- **Due** — records exist and no archive was ever confirmed, or there are newer
  records but the overdue threshold (default 14 days) has not elapsed.
- **Overdue** — records changed after the last archive and more than the
  threshold has elapsed.

---

## Privacy model

- No account, login, server, cloud storage, sync, telemetry, analytics, external
  API, or remote fonts.
- All financial data and receipt images stay on the device unless *you* export a
  file. Exports are created locally and delivered via the Web Share API (when
  available) or a plain download.
- The service worker caches the app shell only; it never transmits or
  synchronises user records.

---

## Recovery & diagnostics

- React error boundaries at the root and per route. A runtime error never wipes
  the database, and "clear all data" is never the suggested first step — retry,
  run the self-test, and export while data is still accessible.
- **Diagnostics** (Tax / Vault → Diagnostics): app / schema version, IndexedDB
  availability, secure-context / origin, file-sharing capability, reduced-motion
  preference, persistent-storage state, storage usage & quota, a bounded
  in-session event log, and a **Run self-test** that exercises pure functions and
  an isolated throwaway IndexedDB without touching the real ledger.
- **Storage health** (Tax / Vault → Storage): persistent-storage status,
  estimated usage / quota, `navigator.storage.persist()` request, and the backup
  timeline.

---

## Limitations

- Not tax software. It organises records and produces estimates only.
- Seeded mileage rates are reference data through 2026; add later years yourself.
- Image optimisation depends on `createImageBitmap` / canvas; where unavailable
  the original image is stored unmodified.
- Web Share with files is used when the browser supports it; otherwise exports
  fall back to a normal download.
- The Apple Shortcuts "open Start-Dash on DoorDash launch" idea is an optional
  user-configured automation. Dash Ledger does not integrate with or talk to the
  DoorDash app.

---

## License

MIT. See `LICENSE`.
