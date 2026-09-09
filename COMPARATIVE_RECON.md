# Comparative Recon

External comparison of Dash Ledger against current gig-driver mileage / expense /
work-log products and one privacy-focused analogue, to find evidence-backed,
architecture-compatible improvements. Research date: **2026-09** (retrieval via
web search + first-party pages; see **Sources**).

Evidence is tagged: **[DF]** documented fact (first-party feature/docs page),
**[RE]** reported experience (reviews / user discussion), **[INF]** inference,
**[UNK]** unknown.

---

## Bottom line

Dash Ledger is already at or ahead of the field on the axes it chose to compete
on — **local-first privacy, factual integrity, deterministic tested domain
logic, data portability, and offline operation**. Every mainstream competitor
(Gridwise, Everlance, Hurdlr, Stride, Driversnote, Solo) is built around
capabilities Dash Ledger deliberately excludes: **background GPS auto-mileage,
bank/card linking, gig-platform account linking, cloud sync, and estimated-tax
engines.** Those are not gaps to close in a static no-backend PWA — they are a
different product category with a different privacy posture.

The one repeated pattern worth adopting is a **unified "needs review" surface**.
Competitors and the closest analogue (GigClaim) all centre a *review queue*: a
single place that lists every record needing a human decision. Dash Ledger has
all the raw signals (REVIEW-class expenses, the receipt Inbox, weekly
completeness issues, unpriced miles, reconciliation gaps) but they are scattered
per-week and per-screen. Aggregating them into one Desk-level surface is pure
snapshot aggregation, preserves every integrity rule, needs no dependency, and is
implemented in this phase.

---

## Dash Ledger strengths

| Strength | Detail |
|---|---|
| True local-first | No account, server, telemetry, cloud DB, or remote font/CDN. Runs from any ordinary static HTTP(S) host (not `file://` — see the post-merge `BUILD_REPRODUCIBILITY.md`). Only GigClaim is comparably private, and it is iOS-native only. **[DF]** |
| Factual integrity | Never invents money, never turns missing → `$0.00`, never clamps mileage, never auto-corrects a suspicious value, never guesses a conflicting legacy amount. Enforced in the domain + repository layers, 245+ tests. |
| Integer-cent money | One owning module; float money cannot enter storage. |
| Legacy recovery | Per-dialect import adapters (original app / earlier cc build / Grok), hybrid-record conflict reporting, `$96.50 → 9650 cents` permanent regression fixture. |
| Restore safety | Whole-payload validation, single-transaction replace, **mandatory pre-restore safety backup**, "generated a file" ≠ "archived it". |
| Receipt survival | Original bytes kept if optimisation fails; processed-put failure retries with the raw original. |
| Reversible deletion | Link-aware undo for dashes / expenses / receipts; deleting one record never destroys a linked-but-independent one. |
| Standalone Tax Binder | One self-contained HTML file with embedded CSS + receipt images; readable and printable with no app and no JS. |
| Deterministic domain | Dates, money, mileage, rates, aggregation, completeness are pure and unit-tested; components carry no financial formulas. |
| No paywall | Every capability is free; competitors gate reports/exports/trip-limits behind $8–10/month. **[DF]** |

## Dash Ledger weaknesses

| Weakness | Impact | Addressed? |
|---|---|---|
| Unresolved items scattered per-week / per-screen | A driver cannot see "everything that needs a decision" in one place | **Yes — this phase** (unified review surface) |
| Manual odometer entry only | More taps than an auto-GPS app; relies on the driver remembering | No — auto-GPS needs background-native; out of scope by design |
| No OCR receipt data extraction | Merchant / amount / date typed by hand | No — client-side OCR is a large dependency for marginal benefit; see *not implemented* |
| No estimated quarterly tax figure | Hurdlr's headline feature | No — deliberate ("not tax software") |
| No multi-platform earnings view | Gridwise aggregates Uber/DoorDash/etc. | No — needs platform credentials / backend |
| No edit history shown to the user | `updatedAt` is stored but not surfaced | Partial — "changed since review" was added in Phase 4; a full per-record history is *not implemented* |

---

## Analogue matrix

| Product | Category | Mileage | Expenses / receipts | Weekly / shift view | Year / tax export | Reconciliation | Data export | Offline | Account required | Price | Privacy posture |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Dash Ledger** | Local-first PWA work ledger | Manual odometer, per-vehicle continuity, flags never overwrite | Manual + camera capture, Inbox, 4 tax classes, quick chips, undo | Mon–Sun, completeness list, close/reopen, stale-review | Year summary + month drill-down + effective-dated rates + standalone Tax Binder | Statement/1099 delta, never auto-matched | Full JSON, ledger-only JSON, 3 CSVs (injection-hardened), Tax Binder HTML | Full (PWA, IndexedDB) | **No** | **Free** | On-device only, no telemetry |
| **Gridwise** | Gig-driver assistant | Auto GPS background | Manual expense + earnings | Per-hour / per-mile analytics, city benchmarking | Tax-ready mileage report | — | CSV / report | Partial | Yes | Free + $9.99/mo Premium **[DF]** | Cloud; account-linked earnings |
| **Everlance** | Mileage + expense tracker | Auto GPS background, work-hours auto-classify, long-session | Receipt upload + OCR, categories | Trip list review | IRS-compliant report, CSV/Excel | — | CSV / PDF / Excel | Partial | Yes | Free (30 trips/mo) + $8.99/mo **[DF]** | "Never sells data"; cloud stored **[DF]** |
| **Hurdlr** | Income/expense/tax tracker | Auto GPS background | Bank + card auto-import, real-time categorise | Real-time income view | **Auto quarterly tax estimate** | Bank-driven | CSV / reports | Partial | Yes | Free + $9.99/mo **[DF]** | Bank credentials; cloud |
| **Stride** | Free mileage + tax tracker | Manual start/stop or auto via sensors | Receipt photo + categories + manual income; bank link | Trip list review | Tax-filing report | — | Report | Partial | Yes | **Free** **[DF]** | Cloud; health-company owned |
| **Driversnote** | IRS-compliant mileage log | Auto + **odometer prompt before each trip** (gap-aware) | Minimal | Trip log | IRS-compliant log / report | — | PDF / Excel / CSV | Partial | Yes | Free tier + paid **[DF]** | Cloud |
| **Solo** | Gig pay + mileage | Auto GPS | Earnings focus | Pay analytics, guaranteed-pay claims | Mileage report | — | Report | Partial | Yes | Free + paid **[DF]** | Cloud; account-linked |
| **GigClaim** | **Private** gig mileage/expense/earnings | Manual GPS + review, work/commute/personal/**review-needed** classes | Manual, kept local | Review / log workflow | Estimate-for-planning + export | — | User-controlled export | Local-first (iOS) | **No** | Paid app **[DF]** | **On-device only, no credentials** — closest match to Dash Ledger |
| **LubeLogger** | Self-hosted vehicle maintenance + fuel mileage | Odometer-based fuel/mileage log | Maintenance + fuel records | — | Reports / CSV | — | CSV / API | Self-hosted | Self-hosted login | **Free / OSS** **[DF]** | Self-hosted; user owns the server |

---

## What others do better

1. **Zero-effort mileage capture.** Every mainstream app records drives in the
   background; the driver only reviews and classifies. Dash Ledger needs a
   deliberate Start/End and an odometer reading. **[DF]** *(Fundamental to the
   architecture choice — not a defect to fix here.)*
2. **Receipt OCR.** Everlance extracts merchant/amount/date from a receipt
   photo. Dash Ledger requires typing them. **[DF]**
3. **Automatic expense capture from bank/card.** Hurdlr and Stride pull
   transactions and pre-categorise. **[DF]**
4. **Estimated tax figure.** Hurdlr shows a running quarterly estimate. **[DF]**
5. **Multi-platform earnings in one view.** Gridwise merges earnings across gig
   apps. **[DF]**
6. **Guaranteed-pay / pay-discrepancy claims.** Solo files pay claims on the
   driver's behalf. **[DF]**

## What we do better

1. **Nothing leaves the device** unless the user exports a file — verified: no
   network requests during ordinary use, 3 production dependencies, no telemetry.
   Only GigClaim matches this, and it is iOS-only. **[DF]**
2. **No account, no subscription, no trip cap.** Competitors cap the free tier
   (Everlance 30 trips/mo) or gate reports behind $8–10/month. **[DF]**
3. **Contradictions are surfaced, never resolved silently** — conflicting legacy
   money, suspicious mileage, reversed odometer, continuity gaps, statement
   deltas. Competitors optimise for a clean-looking number.
4. **Recoverability** — two-step safety-backup restore, reversible deletes,
   original-byte receipt survival, standalone Tax Binder. Not emphasised anywhere
   in the competitor set. **[INF]**
5. **Runs anywhere and forever** — static files, any ordinary static HTTP(S)
   host, offline after first load, no server to keep alive (contrast
   LubeLogger's self-hosted server). *(Not `file://` — corrected post-merge; see
   `BUILD_REPRODUCIBILITY.md`.)* **[DF]**
6. **Auditable correctness** — 245+ deterministic tests over the money/date/
   mileage/rate/aggregation logic. **[DF]**

## Repeated patterns worth stealing

| Pattern | Seen in | Transfer to a static local-first PWA? |
|---|---|---|
| A single **review queue / inbox** of everything needing a decision | GigClaim (`review-needed` class), Everlance (trip review list), household-budget apps ("review inbox for imported transactions") | **Yes — pure aggregation over the local snapshot. Implemented this phase.** |
| **Per-hour & per-mile** earnings readout | Gridwise, ShiftTracker | Already present (Week: gross/hour, gross/business-mile). No change. |
| **Odometer prompt that expects a gap** between workdays | Driversnote | Already present (per-vehicle continuity + prefill + gap flag). No change — validates the design. |
| **Long-session / shift grouping** of drives | Everlance | Already the model (a dash = a shift). No change. |
| **IRS-ready year report / export** | All | Already present (Tax Binder + CSVs). No change. |
| Trip **classification into a small set of states** incl. "needs review" | GigClaim | Already present (REVIEW tax class, Inbox receipt status). Consolidated by the review surface. |

---

## Adopt

- **Unified "Needs review" surface.** A pure domain function aggregating every
  unresolved item across *all* time (not just the current week): an active dash,
  completed dashes with missing/reversed/suspicious odometer, REVIEW-class
  expenses, Inbox receipts, receipts with a stored image error, business miles
  with no configured rate, and a non-zero statement/1099 delta. Rendered as a
  compact, deep-linked list on the Desk with a total count. Reuses the existing
  `CompletenessIssue` type and deep-link routes.

## Adapt

- **"Review needed" as a first-class idea, not just a tax class.** Rather than
  add a new state, the review surface *reflects* the states already in the model
  (REVIEW class, `Inbox` receipt status, mileage flags). This keeps a single
  source of truth and avoids a second classification system.

## Experiment

- **Client-side receipt OCR** (merchant/amount/date pre-fill). Bounded question:
  can a WASM OCR build (e.g. tesseract-wasm) run acceptably on a mid-range phone
  without ballooning the bundle or the dependency graph, and stay fully offline?
  Stop condition: if it adds >1 MB to the install or needs a network model
  fetch, drop it — manual entry stays the reliable path.
- **Per-record edit history.** Bounded question: is an append-only change log
  per shift/expense worth the storage and UI cost for a solo user who rarely
  edits? Stop condition: if it doubles write volume or clutters the edit screen,
  keep only the existing "changed since review" signal.
- **Optional `#/start?auto=1`** deep link that starts a dash immediately with all
  prefills (for an Apple Shortcut). Stop condition: if it can ever create a
  second active dash under any timing, drop it — the single-active invariant wins.

## Avoid

| Idea | Why not |
|---|---|
| Background GPS auto-mileage | Requires a background-native runtime; a PWA cannot do it reliably or without a battery/privacy cost that contradicts the product. |
| Bank / card linking for expense import | Requires credentials + a backend aggregator; breaks "nothing leaves the device". |
| Gig-platform account linking / earnings scraping | Credentials + backend + ToS risk; breaks the privacy model. |
| Estimated quarterly tax engine | Explicitly out of scope — "organises records and produces estimates, it is not tax software". |
| Driver benchmarking / "where to drive" heatmaps | Needs crowd data from a server. |
| Cloud sync / multi-device | Needs a backend and a conflict model; the backup/restore + export path already moves data between devices deliberately. |
| Push notifications / reminders infrastructure | Needs a push service; a PWA reminder story is unreliable and adds a server dependency. |
| Subscription / paywall | Nothing to monetise; would only remove capability. |

## No-change findings

- **Per-hour / per-mile earnings** — already in the Week view.
- **Effective-dated mileage rates** — already seeded 2011–2026 with deterministic
  resolution and user override precedence.
- **Shift-based grouping** — a dash already *is* the session.
- **IRS-ready export** — Tax Binder + CSVs already cover it, and the standalone
  offline HTML is arguably better than a competitor PDF.
- **Odometer continuity / gap handling** — already implemented and, per
  Driversnote, is the correct model.
- **Cash tips kept separate from app earnings** — already a first-class
  distinction end to end; most competitors fold everything into one "earnings"
  number.

---

## Obvious gains implemented

### 1. Unified "Needs review" surface

**Evidence:** GigClaim's `review-needed` trip class and review workflow;
Everlance's trip-review list; the "review inbox for imported transactions"
pattern in self-hosted budgeting apps. Repeated across the analogue set as the
organising idea for "what still needs a human".

**Implementation:**
- `src/domain/completeness.ts` → `pendingReview(shifts, expenses, receipts,
  rates, implausibleMiles)`: pure, returns `CompletenessIssue[]` across **all**
  records, each typed and deep-linked. Built by factoring the existing per-item
  checks in `weekCompleteness` into a shared `collectRecordIssues` helper so the
  two never drift.
- `src/features/desk/DeskScreen.tsx` → a "Needs review" card above the backup
  card: a count, the first five items as deep links, and "+N more". Hidden
  entirely when there is nothing to review.
- Codes are curated: only records genuinely needing a decision (`active-dash`,
  `missing/reversed/suspicious` odometer, `expense-review`, `receipt-inbox`,
  `receipt-image-warning`, unpriced `no-rate` miles). Purely informational notes
  (continuity gaps, missing linked receipts, incomplete times) are left to the
  per-week completeness list so the Desk surface stays actionable. The
  statement/1099 delta stays on the Year screen with its own warning — it is a
  Vault-level review, not a per-record one, and pulling year aggregation onto
  the Desk was out of proportion for this pass.

**Validation:** `src/tests/pendingReview.test.ts` — aggregation across multiple
weeks, each issue type present, empty result for a clean ledger, and that a
suspicious value appears as a review item without being altered. Full suite +
typecheck + lint + build green. Runtime-checked on the Desk at 390 × 844 with
synthetic multi-week data.

---

## Potentially useful ideas NOT implemented

### Client-side receipt OCR
- **Idea:** run OCR on a captured receipt to pre-fill merchant / amount / date.
- **Potential benefit:** removes the slowest part of classifying a receipt.
- **Why not automatic:** a WASM OCR engine is a large dependency (often >2 MB)
  and either bloats the install or needs a network model fetch — both violate the
  "3 dependencies, nothing leaves the device, works offline from any static
  host" constraints. Accuracy on crumpled thermal receipts is also poor **[RE]**.
- **Architecture / privacy cost:** dependency-graph growth; possible model
  download; CPU/battery on capture.
- **Smallest future experiment:** vendor a single pinned WASM build behind a lazy
  dynamic import that only loads when the user taps "scan text"; measure bundle
  delta and decode time on a mid-range device.
- **Pass/fail signal:** pass if install size grows < 1 MB and a receipt decodes
  in < 3 s offline with no network; fail otherwise.

### Per-record edit history
- **Idea:** append-only change log per shift / expense.
- **Potential benefit:** answers "what did I change and when" for a nervous
  record-keeper; competitors don't offer it, so it could be a differentiator.
- **Why not automatic:** meaningful write-volume and schema growth for a solo
  user who edits rarely; the Phase 4 "changed since review" signal already covers
  the highest-value case (a reviewed week that moved).
- **Architecture / privacy cost:** a new table, migration, and retention policy;
  larger backups.
- **Smallest future experiment:** store the previous values of a shift on each
  `updateShift` in a capped ring (last 5) inside the existing row; render a
  collapsed "history" list on the edit screen.
- **Pass/fail signal:** pass if backup size grows < 10 % on a realistic dataset
  and users engage with the history; fail if it is dead weight.

### `#/start?auto=1` one-tap dash
- **Idea:** an Apple-Shortcut-friendly deep link that starts a dash immediately.
- **Potential benefit:** true one-tap start from the lock screen.
- **Why not automatic:** the single-active-dash invariant must hold even under a
  double-fire; needs careful idempotency proof and its own tests, and the sheet
  flow is already two taps.
- **Architecture / privacy cost:** none beyond test surface.
- **Smallest future experiment:** a route that calls `startShift` once on mount
  with all prefills, guarded by the existing transaction, then redirects to `/`.
- **Pass/fail signal:** pass if two rapid loads of the URL still yield exactly
  one active dash in a test; fail otherwise.

### Multi-platform earnings entry (manual)
- **Idea:** let a dash record earnings from more than one platform (e.g. a driver
  multi-apping DoorDash + Uber Eats on one shift).
- **Potential benefit:** matches how some drivers actually work.
- **Why not automatic:** it is a real data-model change (earnings become a list),
  touches money aggregation, CSV, backup schema and the Tax Binder, and needs its
  own migration — too broad for an evidence-backed "obvious gain" pass.
- **Smallest future experiment:** add an optional `otherEarningsCents` +
  `otherEarningsNote` pair to a shift, summed into gross alongside app earnings
  and cash tips, behind a setting.
- **Pass/fail signal:** pass if gross, per-hour, CSV and Tax Binder all reconcile
  with the new field in tests; fail if any path silently drops it.

---

## Sources

- Gridwise — *Best Mileage Tracker Apps for Gig Drivers (2026)* — https://gridwise.io/blog/best-mileage-tracker-app
- Gridwise — *Gridwise vs. Everlance vs. Stride (2026)* — https://gridwise.io/blog/gridwise-vs-everlance-vs-stride
- Gridwise — *Gridwise vs Solo (2026)* — https://gridwise.io/blog/gridwise-vs-solo
- Gridwise — *Features* — https://gridwise.io/features
- Everlance — *10 Best Gridwise Alternatives & Competitors (2026)* — https://www.everlance.com/alternatives/gridwise
- Everlance — *6 Best Solo Alternatives (2026)* — https://www.everlance.com/alternatives/solo
- Everlance — *How Does Everlance Work* — https://www.everlance.com/blog/how-does-everlance-work-an-in-depth-guide
- Everlance — *GDPR Compliance / data handling* — https://help.everlance.com/hc/en-us/articles/360004069012-GDPR-Compliance
- SparkReceipt — *Best Mileage Tracker Apps for Self-Employed in 2026* — https://sparkreceipt.com/blog/best-mileage-tracker-apps/
- Slashdot — *Compare Everlance vs. Hurdlr (2026)* — https://slashdot.org/software/comparison/Everlance-vs-Hurdlr/
- The Rideshare Guy — *11 Best Mileage Tracker Apps of 2026* — https://therideshareguy.com/day-5-what-are-the-best-apps-to-track-your-mileage/
- MileageWise — *Stride: Mileage & Tax Tracker* — https://www.mileagewise.com/dictionary/stride/
- Apple App Store — *Mileage Tracker by Driversnote* — https://apps.apple.com/us/app/mileage-tracker-by-driversnote/id924418916
- ShiftTracker — *Best Gig Worker Shift Tracking Apps with Tax Dashboards 2026* — https://shifttrackerapp.com/blog/best-shift-tracking-apps-for-gig-workers-in-2026
- GigClaim — *GigClaim vs Everlance — Private Mileage Tracker Comparison* — https://gigclaim.app/compare/gigclaim-vs-everlance/
- GitHub — *hargata/lubelog (LubeLogger)* — https://github.com/hargata/lubelog
- GitHub — *expense-tracker topic (open-source / local-first PWAs)* — https://github.com/topics/expense-tracker?o=desc&s=updated
