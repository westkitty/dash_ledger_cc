# Dash Ledger — UI/UX Redesign Study

**Branch:** `ui-ux-redesign-lab` (experimental; branched from `main@6a066e8ee396139f7edbf21cf8d09ceff5609f79`; nothing merged)
**Date:** 2026-09-09
**Method:** Runtime-first. The production build was driven in a real browser at iPhone viewports (primary 390×844; also 375×812, 430×932; desktop spot-check 1280×900) with realistic synthetic data seeded **through the real UI** (Start Dash → End Dash, Log completed dash, Expense form, Receipt capture/classification, Weekly close). 20 baseline screenshots were captured from the running app, followed by an adversarial audit, a bounded precedent check, four interactive redesign demos built in an isolated `src/ux-lab/` surface, and 22 demo screenshots captured from the running demos.

**Environment caveat (honest):** captures were made in headless Chromium on Linux. Font substitution occurs (the system serif-stack renders instead of San Francisco; some emoji glyphs in the app's quick actions render as tofu boxes in this environment but likely render on iOS). Layout, hierarchy, flow, and interaction findings are structural and valid; exact typeface rendering on device will differ cosmetically.

**Primary artifacts:**

| Thing | Where |
|---|---|
| Baseline screenshots (current app, real captures) | `artifacts/ui-ux-redesign/baseline/` |
| Concept screenshots (real captures of the running demos) | `artifacts/ui-ux-redesign/concept-1..4/` |
| Interactive demos | `#/ux-lab`, `#/ux-lab/1…4` in the built app (`src/ux-lab/`) |

---

# CURRENT UI/UX CRITIQUE

## Observed strengths (real, and worth protecting)

1. **The fast Start path is genuinely fast and honest.** Start Dash opens as a sheet over the Desk with sensible, *visible, editable* prefills (current time, last ending odometer suggestion). Two primary taps to an active dash with one vehicle. `baseline/start-dash-sheet.png`, `baseline/desk-on-the-road.png`.
2. **State survives reality.** The active dash persisted across a hard reload during testing; the ON THE ROAD card is unmistakable, and a small dot marks the Desk nav item elsewhere. `baseline/desk-on-the-road.png`.
3. **Data integrity is visible in the copy.** Missing values render as "not set"/"—", suspicious mileage is "preserved and flagged", continuity gaps are explained ("Those miles won't count as business mileage") rather than silently corrected. Start-sheet continuity notice; End-sheet reversed-reading danger notice.
4. **Destructive actions are reversible and deliberate.** Undo toasts for deletes; two-tap confirm ("Tap again to reopen") on week reopen; the discard-dash path is confirm-tap, not a swipe away from disaster.
5. **Focus and a11y mechanics are present:** skip link first in tab order, focus-trapped sheets with Escape + restore, `role="dialog"`, `aria-current` nav, tabular numerals everywhere, `prefers-reduced-motion` respected in sheet motion.
6. **Progressive disclosure exists where it counts most:** the Week's expense/time breakdown is collapsed by default; Tax Binder is a separate, deliberate artifact.
7. **Trust framing is unusually good for the category:** "Record-completeness check — not a tax-compliance score", "planning estimate", "generated a file doesn't prove it's stored safely". These sentences do real trust work.

## Observed weaknesses, prioritized

Severity scale: CRITICAL / HIGH / MEDIUM / LOW / OBSERVATION. Every finding below was observed in the running app at the cited capture.

### W1 · HIGH — Record-list rows render title and subtitle as one run-on string
- **Affected journeys:** Desk (recent dashes), Receipts (Inbox + Classified), Vault (section list), Week (shift list).
- **Evidence:** `baseline/desk-ready-full.png` — rows read "Wed Sep 9, 2026**2019**" (date merges with vehicle year); `baseline/vault-overview.png` — "Yearly report & Tax Binder**Mileage estimate, planning comparison…**"; `baseline/receipts-inbox.png` — "receipt-verizon.png**2026-09-09**".
- **Root cause:** `.row-link__title` and `.row-link__sub` (`src/styles/global.css:587-599`) are plain inline spans inside a flex `.row-link__main`; nothing stacks them. The "two-line row" seen in most of the app is an accident of narrow-width text wrapping, and it breaks the moment title+sub fit one line (which they do at 390pt for most rows).
- **Why it matters on a phone:** every scanning task — "what did I earn recently?", "which receipt is which?", "what's in the Vault?" — requires parsing concatenated glyphs. Dates fused to vehicle years ("2026**2019**") are actively misreadable. This is the single most visible defect in the product.

### W2 · HIGH — Primary actions sit in the least reachable zone; the active state scrolls away
- **Affected journeys:** Desk start/end dash, quick expense/receipt capture, any long-screen action.
- **Evidence:** `baseline/desk-ready-full.png` — Start Dash renders at the very top of the content column; quick Expense/Receipt sit mid-screen below the week grid; `baseline/desk-on-the-road.png` — End Dash is inside a card at the top of a long page. Nothing action-bearing is fixed except the tab bar itself. On a 390×844 viewport the dominant button occupies the top third — the "hard zone" for one-handed thumb use (see precedent check below). When scrolled down, no drive action exists on screen; the only persistent active-dash cue is a small dot on the Desk tab.
- **Why it matters:** this app's whole premise is capture-between-stops: parking lot, one hand, gloves off, 30 seconds. The most frequent actions cost a grip shift, a stretch, or a scroll-and-hunt. The one state that must never be lost (an active dash) is communicated least persistently.

### W3 · HIGH — Unresolved work is scattered, capped, and expensive to resolve
- **Affected journeys:** Desk review, Receipts Inbox, per-week "Needs attention", expense classification.
- **Evidence:** `baseline/desk-ready-full.png` — "Needs review (2)" renders *below* Recent dashes, capped at 5 items with "+N more — open each week from Week"; each item deep-links to a full editor screen (`baseline/expense-form.png` is a full-page form for one classification decision; `baseline/receipt-detail.png` likewise). The receipt Inbox (`baseline/receipts-inbox.png`) is a separate surface, disconnected from the REVIEW-class expense list and the per-week issue lists.
- **Why it matters:** the driver's honest bookkeeping loop is *capture now, decide later*. Every "later" decision currently costs: find the right surface → open a full-screen form → find the field → save → navigate back. With N unresolved items that's N round trips. Review debt becomes invisible (capped list, bottom placement), and the app's own COMPARATIVE_RECON.md already identified the unified-review-queue pattern as the one worth adopting — the Desk card is a read-only summary of it, not a workspace.

### W4 · MEDIUM — Facts and estimates are rendered identically
- **Affected journeys:** Week summary, Year report, Desk week snapshot.
- **Evidence:** `baseline/week-review-due.png` — "STANDARD MILEAGE ESTIMATE $60.04" is a tile identical in weight, color, and shape to "DOORDASH EARNINGS $351.85"; its only distinction is a small "planning estimate" sub-line. `baseline/vault-year.png` — the same for the yearly deduction figure. `baseline/week-disclosure.png` — the breakdown grid doubles down with twelve identically-styled tiles.
- **Why it matters:** this app handles records that may matter financially. The mental model — *these numbers happened* vs *these numbers are projected from a rate table* — is exactly the distinction the app's integrity posture is built on, yet the presentation flattens it. A driver glancing at the Week grid has no visual cue which numbers they could file with and which are planning aids.

### W5 · MEDIUM — Week opens as bookkeeping ceremony; its completion action is at the bottom
- **Affected journeys:** weekly review.
- **Evidence:** `baseline/week-review-due.png` — the screen opens with three large nav buttons (Prev / This week / Next ≈ 170px of vertical space), then a six-tile summary grid; "Needs attention" and the "Mark week reviewed" action (`baseline/week.png`, bottom) require scrolling. `baseline/week-disclosure.png` shows the 12-tile disclosure.
- **Why it matters:** the weekly close is the app's core ritual — the thing that turns records into a reviewed ledger. It currently reads as an accounting form to fill top-to-bottom, and the one action that *completes* the week is the least reachable element on the page. "What happened this week" (which days, how much) is never answered directly; you infer it from aggregates.

### W6 · MEDIUM — Year buries its two headline numbers; trend is a table
- **Affected journeys:** yearly review, tax preparation, reconciliation.
- **Evidence:** `baseline/vault-year.png` — Year opens as a flat grid of 8+ equal-weight tiles (shifts, DoorDash earnings, cash tips, gross, miles, estimate, non-vehicle business, vehicle actual…); month-by-month and reconciliation are rows further down (full-page capture `baseline/vault-year-full.png`). The surface itself is one tab behind a doubly-nested name ("Tax · Vault" tab → "Year" chip).
- **Why it matters:** at tax time exactly two numbers lead: gross income and the standard-mileage deduction. Both are present but visually co-equal with six other tiles, and there is no shape-of-the-year visualization — trend comprehension requires reading a 12-row table. The app's accumulated long-term value (the reason to keep a ledger at all) is the least legible thing in it.

### W7 · MEDIUM — Stacked toasts occlude content and action zones
- **Affected journeys:** any save flow (receipts, expenses, dashes), especially capture-then-continue sequences.
- **Evidence:** `baseline/receipts-inbox.png` — two stacked "Receipt saved" toasts cover the Folders card; `baseline/receipt-detail.png` — one toast covers the Amount field; `baseline/expense-form.png` — two toasts cover the category picker and part of the primary button; `baseline/week.png` — toast overlaps the shift list.
- **Why it matters:** toasts appear at the exact bottom edge the thumb is working in, stack up during capture bursts (the app's most likely usage pattern), and can sit over the next control the user is about to tap. They also linger long enough to interfere (multiple simultaneous visible).

### W8 · LOW — Receipt Inbox rows are identified by filename, not content
- **Evidence:** `baseline/receipts-inbox.png` — "receipt-verizon.png", "receipt-shell.png" as row titles.
- **Why it matters:** triage means opening items one by one; the thumbnail (which does show the merchant) is ~40px and visually subordinate to the filename.

### W9 · LOW — Decorative glyphs render as tofu in the quick actions
- **Evidence:** `baseline/desk-first-run.png` — "⬚ Expense / ⬚ Receipt"; `baseline/receipt-capture.png` — "⬚ Take photo". The characters are full-width forms (＼uFF0B / camera emoji) whose rendering is font-dependent; in this Linux capture environment they render as boxes (on iOS they would likely render, but they carry no meaning either way).
- **Why it matters:** minor; but a broken-looking glyph on the two most-used shortcuts reads as unfinished, and the plus sign duplicates the button's own semantics.

### W10 · LOW — Twin field flows use different commit verbs
- **Evidence:** `baseline/start-dash-sheet.png` — primary button "Start dash"; `baseline/end-dash-filled.png` — primary button "Save dash".
- **Why it matters:** Start/End are the same mental gesture (commit this dash). The inconsistency is a small confidence hiccup at the exact moment the app asks to be trusted with a record.

### OBSERVATION set (not defects; context for the redesigns)

- **O1.** The Desk week snapshot reads `$0.00 / 0` while on the road (`baseline/desk-on-the-road.png`) — honest, but reads as "nothing counts yet" mid-shift.
- **O2.** Week nav consumes ~170px in three buttons that could be one compact control (`baseline/week-review-due.png`).
- **O3.** Accessibility mechanics are strong; the weak spot is touch-target size of inline links inside wrapped issue sentences (Needs review card) — sub-44px text links.
- **O4.** The Vault aggregates eight concerns (Year, Backup, Recovery, Storage, Vehicles, Rates, Settings, Diagnostics) behind generic chips; the naming "Tax / Vault" requires learning. Not redesigned in this study (scope), but noted for future IA work.

## Top friction patterns (derived from the above, not imported)

1. **Action-to-reach inversion** — the most frequent actions live farthest from the thumb (W2, W5, W6 completion actions).
2. **Weak record grammar** — the list row, the app's most repeated component, doesn't actually render as a record (W1, W8).
3. **Review work is scattered and full-form-per-decision** (W3) — the capture/review separation the architecture already models is not reflected in the UI.
4. **Fact vs estimate undifferentiated** (W4) — visual language doesn't carry the data's own epistemology.
5. **Reporting leads with accounting detail, not answers** (W5, W6).
6. **Bottom-edge occlusion by transient toasts** (W7) — worst possible placement for this app's ergonomics.

---

# EXTERNAL PRECEDENT CHECK (bounded)

Inputs: the repository's own `COMPARATIVE_RECON.md` (2026-09, evidence-tagged comparison vs Gridwise / Everlance / Hurdlr / Stride / Driversnote / Solo / GigClaim) plus a fresh bounded check of current guidance and comparator behavior. Three–five high-value sources were consulted; nothing was adopted that conflicts with Dash Ledger's protected architecture.

1. **Apple HIG / thumb-zone ergonomics.** Current guidance and practitioner research agree: primary actions belong in the bottom third ("natural/easy" thumb zone); top-third placement is the "hard zone" requiring grip change; 44pt is a floor, not a target. Sources: [HIG complete guide — thumb reach](https://www.bitcot.com/ios-human-interface-guidelines/), [Designing for one-handed use (thumb zones)](https://weareaffective.com/learning-centre/how-should-i-design-my-app-for-one-handed-use), [Mobile-first UX: designing for thumbs](https://dev.to/prateekshaweb/mobile-first-ux-designing-for-thumbs-not-just-screens-339m). → **Informs Concepts 1 and 3** (persistent bottom drive dock, sticky weekly close).
2. **Everlance / MileIQ one-swipe classification.** The single most-praised mechanic in mileage apps is deciding about a record *in the list where it appears* (one swipe/tap to classify business vs personal), rather than opening an editor. Sources: [Timeero: mileage tracker comparisons](https://timeero.com/post/driversnote-alternatives), [Everlance review (College Investor)](https://thecollegeinvestor.com/18468/everlance-review/), [G2: Everlance reviews](https://www.g2.com/products/everlance/reviews). → **Informs Concept 2** (inline resolution controls in the review queue), adapted: Dash Ledger's decisions are tax-class/link/verify actions, and everything stays a suggestion-level affordance with the full editor one tap away — no auto-classification, matching the app's "never auto-applied" rule (merchant memory precedent).
3. **Driversnote's odometer prompt.** COMPARATIVE_RECON already validated Dash Ledger's prefill+gap-flag design against Driversnote's per-trip odometer prompt; no change taken — it confirms the Start sheet's prefill is the right mechanism, needing only reachability (Concept 1), not redesign.
4. **Review-queue pattern.** COMPARATIVE_RECON's adopted "unified needs-review surface" (from GigClaim's review-needed class and import-inbox patterns in budgeting apps). → **Concept 2 extends the existing Desk card from a read-only summary into an actionable queue**; no new record states are invented (states stay REVIEW class / Inbox / mileage flags).

Deliberately **not** adopted: background GPS, OCR (flagged as an open experiment in COMPARATIVE_RECON), bank links, accounts, cloud anything, subscription features — all incompatible with the local-first contract.

---

# THE FOUR REDESIGNS

They are complementary pieces of one stronger Dash Ledger: **reach** (where actions live), **decide** (how review work gets done), **review** (how a week closes), **file** (how a year reads).

---

## Concept 1 — "Reach Desk" (thumb-first persistent action dock + fixed record grammar)

**1. NAME:** Reach Desk.

**2. OBSERVED PROBLEM:** W2 (primary actions in the hard thumb zone; active dash scroll-away), W1 (run-on list rows on the Desk), O1 (week numbers read as "nothing counts yet"), W9 (tofu glyphs on the two quick actions), W7 (toasts land on the action edge).

**3. DESIGN HYPOTHESIS:** Anchoring Start/End Dash + Expense/Receipt in a persistent bottom dock inside the natural thumb zone, surfacing the active dash in that dock at all scroll positions, and rendering list rows with a real two-line grammar will reduce time-to-primary-action and misreads without touching any data flow.

**4. WHAT CHANGES:**
- A fixed **drive dock** at the bottom of the Desk (above the tab bar, below content): READY state = [Start Dash | Expense | Receipt]; ON THE ROAD state = live elapsed line + dominant [End Dash]. The dock is the same component in both states — the state never leaves reach.
- Desk content reorders to a one-line **week fact strip** (gross · miles · dashes · inbox with a FACT badge) replacing the four-stat grid; Needs-review compact chip moved up; recent dashes keep a stacked title/sub row with the money split (app + cash) as a second value line.
- Rows use explicit title-over-sub stacking (the W1 fix demonstrated concept-wide).
- Toast placement moves above the dock (never over content edges).

**5. SCREENS / JOURNEYS AFFECTED:** Desk (all states), Start/End sheets (position only), globally: every list using the row grammar (Desk/Receipts/Vault/Week).

**6. EXPECTED USER BENEFIT:** Start-to-start time cut (no scroll/grip); active dash never lost; one-handed capture realistic while standing; faster scanning of recent work.

**7. RISKS / TRADEOFFS:** A fixed dock consumes ~76px of viewport (mitigated by the smaller fact strip); double-action surfaces (dock + sheets) must stay consistent; the active-dock must not be tappable-by-mistake while driving (large target is intentional but must confirm destructive intent elsewhere).

**8. PROTECTED BEHAVIOR:** Start/End remain sheets over the Desk; the single-active-dash invariant, prefills, continuity warnings, undo/confirm semantics, and all repository writes are untouched; the dock changes *where* buttons live, not *what* they do.

**9. HOW SUCCESS WOULD BE MEASURED:** time-to-primary-action (target: Start Dash actionable without scrolling from any scroll position); thumb-reach map (primary controls in bottom third); tap-error rate on the dock; misread rate on recent-dash rows; above-the-fold usefulness at 390×844.

**10. WHY THIS IS SIGNIFICANT:** It changes the ergonomics of the app's core loop on every single session — the difference between a desk app and a field app — and simultaneously repairs the most visible systemic defect (row grammar) that affects four surfaces.

**Demo route:** `#/ux-lab/1`
**Screenshots:** `artifacts/ui-ux-redesign/concept-1/concept-1-desk-ready.png` (vs baseline `baseline/desk-ready.png`), `concept-1-active-dock.png` (live state), `concept-1-start-sheet.png`, `concept-1-end-sheet-preview.png`, `concept-1-desk-after-save.png`, `concept-1-desk-375.png` (375×812 check).

---

## Concept 2 — "Resolve" (one queue; decisions in place)

**1. NAME:** Resolve.

**2. OBSERVED PROBLEM:** W3 (scattered, capped, read-only review; full-editor-per-decision), W8 (filename-identified receipts), plus the Desk cap "+N more — open each week…".

**3. DESIGN HYPOTHESIS:** Aggregating every unresolved item — receipt Inbox, REVIEW-class expenses, mileage flags, unpriced miles, missing times — into one queue with **inline, one-tap resolutions** will collapse the decision cost per item from a multi-screen round trip to one tap, and make review debt visible and finite (progress bar), without inventing any new record state.

**4. WHAT CHANGES:**
- A single **Resolve** surface (reachable from the Desk chip): every typed issue the domain already emits, oldest-first, each as a card with *what it is / why it needs you / age*.
- Each card carries **inline controls that perform the same edit the full editor performs** (classify receipt from quick categories; set tax treatment; confirm-or-correct a flagged odometer with the correction field inline; apply-or-decline a rate for unpriced miles; set-or-decline times). "Open full editor →" stays on every card.
- A progress header ("2 of 5 resolved") makes the debt finite; resolved items collapse into a session list. Resolution never auto-anything: declining ("Leave unpriced", "Leave blank") is a first-class answer, matching the app's never-guess rule.

**5. SCREENS / JOURNEYS AFFECTED:** Desk (review chip → queue), Receipts Inbox (feed into queue; surface remains), Week "Needs attention" (items deep-link into the queue context), Expense/Receipt editors (remain the full-detail path).

**6. EXPECTED USER BENEFIT:** Review burden drops from Navigations×N to taps×N; the driver sees exactly how much undecided work exists; classification happens with the receipt photo's context instead of a bare form.

**7. RISKS / TRADEOFFS:** Inline decisions could feel rushed if quick options are wrong (mitigated: full editor one tap away; nothing is final-only); queue ordering policy needs a default (oldest-first chosen); risk of the queue becoming a dumping ground if issue emission isn't curated (reuse existing typed issues only).

**8. PROTECTED BEHAVIOR:** No new states or new truth — the queue is pure aggregation over the existing `CompletenessIssue`-shaped signals (the exact adaptation COMPARATIVE_RECON prescribed); resolutions call the same create/update repositories with the same validation; "decline" is explicit and never mutates data to a guessed value.

**9. HOW SUCCESS WOULD BE MEASURED:** taps + screens per resolution (target: ≤2 taps, 1 screen, no navigation for the common case); time-to-empty-queue; % of records leaving REVIEW class within 48h of capture; queue abandonment.

**10. WHY THIS IS SIGNIFICANT:** It converts the app's weakest journey (bookkeeping debt) into its smoothest, directly operationalizing the integrity posture ("decide, never guess") instead of just displaying it.

**Demo route:** `#/ux-lab/2`
**Screenshots:** `artifacts/ui-ux-redesign/concept-2/concept-2-queue.png`, `concept-2-receipt-resolved.png` (inline classification), `concept-2-odometer-correction.png` (confirm-or-correct in place), `concept-2-all-resolved.png` (completion state).

---

## Concept 3 — "Week as a story" (day-strip scan, fact/estimate split, sticky close)

**1. NAME:** Week as a story.

**2. OBSERVED PROBLEM:** W5 (week = ceremony; close buried), W4 (facts ≡ estimates), O2 (nav bulk), plus "what happened" never directly answered.

**3. DESIGN HYPOTHESIS:** Restructuring Week as *what happened* (7-day strip with per-day dashes/miles, tap-to-focus) → *what it earned* (one big FACT number + a visually separate ESTIMATE band) → *what needs you* (collapsed count, expand in place) → *close from anywhere* (sticky footer with an honest confirm step) will make weekly review feel like answering "how was the week" instead of auditing a form.

**4. WHAT CHANGES:**
- A 7-cell **day strip** replaces the three-button nav block (prev/next move to compact affordances); each cell shows dashes + miles; tap focuses that day's numbers inline.
- The six-tile grid becomes a **money band**: one headline gross (FACT badge, app+cash split beneath), a dashed-border **ESTIMATE band** for the standard-mileage deduction (rate shown), and a single net-cash line.
- Needs-attention collapses to one row ("1 to resolve, 1 for information") expanding in place — full detail lives in Resolve.
- A **sticky completion footer**: "Mark week reviewed" → inline confirm ("Confirm — numbers are complete") with the never-freezes explanation; reviewed state shows "Reopen". State semantics identical to production (in progress / review due / reviewed / reopenable / stale-detection wording preserved).

**5. SCREENS / JOURNEYS AFFECTED:** Week (all states); Desk week strip benefits from the same fact/estimate grammar; Year adopts the same badges (Concept 4).

**6. EXPECTED USER BENEFIT:** Week comprehension at a glance (which days, how much); the completion action always in thumb reach; review feels like a decision, not data entry; fact/estimate confusion eliminated at the moment of reading.

**7. RISKS / TRADEOFFS:** Day strip is new surface (must earn its keep — it doubles as the nav); the big-number band de-emphasizes the six secondary stats (they move into the existing disclosure, which already exists); sticky footers must not cover content (body padding handles it).

**8. PROTECTED BEHAVIOR:** All numbers come from the same aggregation functions (demo uses the same formulas on fixture data); review semantics unchanged — explicit, reopenable, staleness-detected, never automatic; estimates remain planning-only labels with the same rate table logic.

**9. HOW SUCCESS WOULD BE MEASURED:** scroll distance to complete a review (target: zero — close visible at all times); time-to-"what happened" answer; weekly close completion rate; comprehension spot-checks of fact vs estimate.

**10. WHY THIS IS SIGNIFICANT:** It reframes the app's central ritual from ceremony to story while keeping every number and rule identical — the difference between a ledger you maintain and a ledger you read.

**Demo route:** `#/ux-lab/3`
**Screenshots:** `artifacts/ui-ux-redesign/concept-3/concept-3-week-daystrip.png` (vs baseline `baseline/week-review-due.png`), `concept-3-estimate-attention.png` (FACT/ESTIMATE + attention expanded), `concept-3-sticky-close-confirm.png` (confirm step in thumb zone), `concept-3-reviewed.png`.

---

## Concept 4 — "Year at a glance" (trend-first year, estimate-labeled headline, guarded reconciliation)

**1. NAME:** Year at a glance.

**2. OBSERVED PROBLEM:** W6 (flat equal-weight tile grid; trend is a table; two filing numbers not foregrounded), W4 at yearly scale, reconciliation discoverability.

**3. DESIGN HYPOTHESIS:** Leading with exactly two headline cells — gross (FACT) and standard-mileage deduction (ESTIMATE, dashed treatment) — plus a 12-month tap-explored bar chart will let a driver answer "how much did I make and what might it deduct?" at the fold, with drill-down one tap deep.

**4. WHAT CHANGES:**
- **Hero pair:** two cells, visually asymmetric by design (estimate gets dashed border + ESTIMATE badge), each with its own honest sub-line (dashes count / business miles).
- **Month-by-month chart:** dependency-free CSS bars with a metric switch (Gross / Deduction / Miles); tap a bar for that month's four numbers (gross·fact, deduction·estimate, miles, expenses) inline.
- **Standard vs actual** kept as an explicit comparison sentence (never merged).
- Months-with-activity as an expandable list (rate shown per month, reflecting the 2026 H1/H2 rate split); **reconciliation** collapsed and guarded ("nothing entered yet… never auto-matches").

**5. SCREENS / JOURNEYS AFFECTED:** Vault → Year; the same FACT/ESTIMATE grammar propagates from Concept 3; Tax Binder export remains the deep artifact.

**6. EXPECTED USER BENEFIT:** The year's shape in one glance; the two numbers that matter are the two biggest things; trend exploration without table reading; reconciliation stays discovered-but-not-dangerous.

**7. RISKS / TRADEOFFS:** Charts can imply precision the data lacks (mitigated: estimate labeling follows the chart via the metric switch; bars are direction, not audit); monthly rates that change mid-year make "deduction per month" an approximation (each month's rate is shown in drill-down); a chart adds vertical cost to a surface some users only visit at tax time.

**8. PROTECTED BEHAVIOR:** Same effective-dated rate resolution (2026 H1 0.725 / H2 0.760 shown), unpriced miles stay reported and unpriced, actual-vs-standard never merged, reconciliation remains a manual, explicit, non-auto-matching act.

**9. HOW SUCCESS WOULD BE MEASURED:** time-to-the-two-numbers at tax time; drill depth to month detail (target: 1 tap); mislabeling errors (fact read as estimate or vice versa) in comprehension checks; reconciliation feature discovery.

**10. WHY THIS IS SIGNIFICANT:** It makes the app's accumulated, long-horizon value legible — the entire reason to keep a local ledger for years — without weakening a single integrity rule.

**Demo route:** `#/ux-lab/4`
**Screenshots:** `artifacts/ui-ux-redesign/concept-4/concept-4-year-hero.png` (vs baseline `baseline/vault-year.png`), `concept-4-chart-deduction.png`, `concept-4-month-detail.png` (tap-explored month), `concept-4-drill-recon.png` (drill-down + guarded reconciliation).

---

# UX LAB IMPLEMENTATION & ISOLATION

- **Location:** `src/ux-lab/` — `UxLabApp.tsx` (standalone tree), `UxLabIndex.tsx`, `LabFrame.tsx`, `lab.css` (all styles namespaced `.uxlab`), `fixtures.ts` (synthetic data), `concepts/Concept1ReachDesk.tsx … Concept4YearGlance.tsx`.
- **Entry switch:** `src/main.tsx` renders `UxLabApp` *instead of* `<LedgerProvider><App/></LedgerProvider>` whenever the hash starts with `#/ux-lab`. `src/app/App.tsx` and the canonical route table are byte-identical to `main` (verified with `git restore` / `git diff`).
- **Isolation is structural, not conventional:** because the lab mounts outside `LedgerProvider`, no lab session constructs the store. This was *found empirically and fixed*: an earlier wiring placed lab routes inside the canonical `<App>`, and instrumenting `indexedDB.open` proved the production shell opened (and first-run-seeded) the canonical DB even on lab routes. After the restructure, the same instrumentation shows **zero** `indexedDB.open` calls during heavy lab use, and a probe of `dash-ledger-canonical-v2` in a disposable profile finds no Dexie stores. (`scripts` used for this proof live outside the repo; see VALIDATION.)
- **Lab hygiene:** banner on every surface ("UX LAB · CONCEPT n OF 4 · SYNTHETIC DATA"), per-page note that nothing reads/writes the ledger, an "Exit lab →" link back to the real Desk, and demo-only state toggles clearly labeled. No new dependencies; no router changes; no store/db/service imports in `src/ux-lab/`.

---

# VALIDATION

All commands via the declared toolchain (`bun install --frozen-lockfile`, Bun 1.4.2, Node 22 per `.nvmrc`):

| Check | Result |
|---|---|
| `bun run typecheck` | PASS (strict; `tsc -b --noEmit` clean) |
| `bun run lint` | PASS (`--max-warnings 0`) |
| `bun run test` | PASS — 252/252 (28 files), unchanged from baseline |
| `bun run build` | PASS (PWA precache 13 entries) |
| `git diff --check` | PASS (no whitespace errors) |
| Normal Desk / Start Dash / End Dash | PASS — driven end-to-end on the final build incl. vehicle-chaining, active-dash persistence across reload, End Dash save |
| Week / Year / Vault / Settings / Diagnostics deep links | PASS — render and respond on the final build |
| Lab isolation vs canonical IndexedDB | PASS — instrumented proof (zero opens from lab; no Dexie stores created); see above |
| Lab → app / app → lab transitions | PASS |
| Horizontal overflow | NONE — 0 overflow findings at 375×812, 390×844, 430×932 across `/`, `/week`, `/receipts`, `/vault`, all five lab routes |
| Safe areas | Dock/footer use `env(safe-area-inset-bottom)` offsets; reduced-motion honored (pulse/transition disabled) |

**Screenshot provenance:** every image in `artifacts/ui-ux-redesign/` is a real Playwright capture of the running production build (baseline: data seeded through the real UI; concepts: the interactive demos mid-use). No mockups or composites. Browser-environment caveat noted in the header.

---

# FINAL RECOMMENDATION

**Verdicts:**

| Concept | Verdict | Reasoning in one line |
|---|---|---|
| 1 · Reach Desk | **ADOPT** | Highest-frequency journey, lowest implementation cost, zero domain risk, demonstrates its value in the demo immediately. |
| 2 · Resolve | **ADAPT** | The mechanic is right and proven in-demo; adopt the queue with the *full editors as the resolution engine first*, then graduate the safest inline actions (receipt classification, tax-treatment chips) into it. |
| 3 · Week as a story | **ADAPT** | Fact/estimate grammar + sticky close are clearly right; the day strip deserves a field trial before it displaces week nav. |
| 4 · Year at a glance | **EXPERIMENT** | The hero pair and badges should be adopted almost immediately; the chart is promising but needs validation that tax-time users want trend exploration vs. table precision. |

**Ranking (highest → lowest value):** 1 Reach Desk → 2 Resolve → 3 Week as a story → 4 Year at a glance.

**Winner: Concept 1 — Reach Desk.**

Why: it is the only proposal that improves *every session* (the Desk is the app's front door and its action surface), it directly repairs the two highest-severity observed defects (action reach W2 and record grammar W1), it is the cheapest to build (layout/structure plus one docked component; no data, domain, or route changes), it carries essentially zero regression risk against the integrity contract (all writes flow through the untouched existing sheets/repositories), and the demo showed the exact field scenario working: standing in a parking lot, one hand, active dash live in the dock, End Dash always in reach. Concepts 2 and 3 deliver deeper *journey* value but require more product decisions; Concept 1 is pure ergonomics and grammar with immediate payoff — the strongest first production redesign.

---

# NEXT DECISION (for the human reviewer)

Review the four demos at `#/ux-lab/1…4` on an iPhone-width screen and confirm **Concept 1 (Reach Desk)** as the first candidate to graduate from the lab into a real implementation behind a flag — or redirect the order if field intuition says the Resolve queue (Concept 2) matters more for how the app is actually used week to week.
