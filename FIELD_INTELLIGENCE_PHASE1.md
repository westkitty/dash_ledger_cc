# Dash Ledger Field Intelligence — Phase 1

Status: **branch-only implementation, not deployed**.
Baseline: `main@02da50acea83837c6ccec0c5f46fd9d2a0326f2b`.
Branch: `feat/v2-field-intelligence-phase1-20261110`.

## Purpose and bounded scope

Make future multi-platform/manual field observations representable and recoverable without changing the existing DoorDash ledger's observed earnings, tax binder, CSV exports, PWA screens, offline model, or opt-in GPT Bridge data contract. No dashboard, offer calculator, automatic GPS, third-party app data import, server sync, or new UI is in Phase 1.

### Authority and accounting

- Existing `Shift` and `Expense` rows remain unchanged and continue to drive the existing weekly/yearly/tax/CSV views.
- `PlatformTotal` is the prospective financial total within a future v2 work session, not an additional payment to add to legacy shift income. `CompletedJob.finalPayoutCents` is detail to reconcile against that total, not a second earning.
- `LegacyShiftLink.reportingAuthority` defaults by contract to an explicit value, not an implicit switch. Phase 1 creates links but **never switches the existing reports to session income**; `'session'` must have a reconciliation timestamp. The phase 3 analytics implementation must make authority selection explicit and prevent double counting.
- Offline local IndexedDB remains the source of truth. V2 observations are not exposed in the GPT Bridge mirror or any cloud service at this phase. The bridge's current old-shift calculations are unchanged; new-record parity to bridge is **not implemented**.
- Business/operating cost, tax-deductibility, and delivery-app active time are distinct domains. No inferred deductible mileage or guessed missing money.

## Storage contract

The IndexedDB **name stays `dash-ledger-canonical-v2`**. Dexie's internal schema now advances from version 1 to version 2 with an additive migration, preserving all original tables and stored records. Nine new tables are empty when an old database is upgraded:

| Table | Purpose / constraints |
|---|---|
| `workSessions` | Home-to-home work period with localDate, IANA zone, vehicle, odometer, market, tags; only one open work session |
| `platformTotals` | One authoritative platform total per work-session/platform; unique composite index, integer cents |
| `onlineIntervals` | Actual online time intervals, one per platform; concurrent app time is not added together |
| `offerEvents` | Offer observed, decision, quoted amount/mileage, optional job ID |
| `completedJobs` | Final job/batch payout, start/end times, store label, items/units/customers |
| `travelLegs` | Actual or estimated per-category miles, evidence source and timing |
| `marketVisits` | Market/context time ranges with tags and freeform notes |
| `legacyShiftLinks` | Unique shift-to-work-session link and explicit reporting authority |
| `sessionExpenseLinks` | Unique link to an existing expense; never duplicates the expense amount |

The validators in `src/domain/fieldIntelligence.ts` reject malformed IDs, negative/fractional money, invalid dates/time zones, reversed odometers and time intervals, orphaned references, duplicate relationships, cross-session offer/job mismatches, and multi-open sessions in complete backups. The repository insertion boundary `src/db/fieldRepositories.ts` validates individual records and active references inside a single transaction. Missing numerical measurements are `null`, not zero. Date-only workdays do not implicitly shift at midnight.

**Deletion/Undo:** Existing shift and expense deletion also removes their dependent v2 link rows, preserving the independent session itself. Undo restores these links only if both sides are still present and no newer competing link exists. Existing receipt/expense/shift restoration semantics remain unchanged.

## Backup contract (critical)

The database schema, database name, and external backup formats are **separately versioned**:

| Format | What happens |
|---|---|
| `dash-ledger-backup-v3` | New full backup: includes original ledger, receipts/images, and all nine v2 field tables |
| `dash-ledger-ledger-only-v3` | New ledger-only backup: same records, but intentionally omits receipt image bytes |
| `dash-ledger-backup-v2` | Earlier canonical full backup remains restorable; new tables become empty because v2 did not contain them |
| `dash-ledger-ledger-only-v2` | Earlier canonical ledger-only backup remains restorable; new tables become empty |
| ambiguous original v1/Grok | Still use the established Recovery importer and dollar/cents dialect detection |

New v3 backups require **all nine** new arrays even if empty. They are validated before any destructive restore. Restore replaces original and v2 tables in **one IndexedDB transaction** after the established safety-backup gate and before reporting success. Malformed backups are refused without writes. Restoring an earlier v2 backup intentionally removes v2 field records; export and retain a **v3 full safety backup** first.

Recovery -> Import refuses v3 backups instead of silently stripping new records; use Vault -> Backups -> Restore. The destructive earlier-format importer clears dependent v2 tables only after the existing export-acknowledgement safety gate. Counting authoritative records includes all nine new tables; a new-record-only ledger is **never** treated as empty.

### Rollback caveat: do not deploy prematurely

An additive IndexedDB schema upgrade is durable per browser origin. **Redeploying old v1-schema app code afterward is not a reliable rollback**: its Dexie definition may reject the newer on-device database version. The safe release gate for a future deployment must include real-browser upgrade, full v3 export/import and a tested forward-fix/downgrade strategy. Until that release gate passes, Phase 1 remains in a feature branch and does not touch users' browser data.

The exported backup is the data recovery path; it is not proof that an old app build can directly open an upgraded IndexedDB database. Do not clear, delete or rename the user database as a rollback.

## Validation contract

- `npm exec --yes --package bun@1.3.12 -- bun install --frozen-lockfile`
- `npm exec --yes --package bun@1.3.12 -- bun run typecheck`
- `npm exec --yes --package bun@1.3.12 -- bun run lint`
- `npm exec --yes --package bun@1.3.12 -- bun run test`
- `npm exec --yes --package bun@1.3.12 -- bun run build`
- New tests: `src/tests/fieldIntelligence.test.ts` (legacy schema upgrade, 9-table persistence, crosslinks/Undo, validation, v2/v3 restore, full/ledger-only, safety gate, simulated rollback).
- Original tests must continue passing, particularly receipt survival, legacy imported money units, tax binder, offline ledger, shift flow and Undo.
- Verify the HEAD ref and changed-file scope after writing the feature branch; verify `main` remains the original commit.
- Test a fresh checkout from the feature branch, not only the development tree.

## Out of scope and release guard

Not included: production deployment, main branch merge, live iPhone validation, UI capture, platform API integration, online-interval union calculations, store learning, modeled profit, GPS, source research freshness, new GPT Bridge synchronization, tax advice. These require separate phases and approvals.

Never treat a green build or headless IndexedDB tests as proof of safe live-device migration. Production release requires an explicit owner decision.
