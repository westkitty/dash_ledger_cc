# Dash Ledger MCP tool contracts

## Contents

1. Read tools
2. Calculation tools
3. Proposal tools
4. Side-effect wording
5. Retry/idempotency

## 1. Read tools

### get_sync_status

Use before current-state conclusions. Returns freshness, source/server timestamps, snapshot version, and record counts.

### get_ledger_summary

Accepts a bounded local-date range. Its time metric is tracked shift time from recorded shift start/end fields. Do not relabel it door-to-door time.

### get_recent_shifts

Returns at most 100 recent mirrored shifts.

### get_shift

Returns one mirrored shift by ID.

### compare_periods

Uses deterministic summary calculations across two local-date ranges. Label the periods and their denominators.

### get_pending_review_summary

Returns synchronized review counts only. Receipt-image/local-only review issues are intentionally absent from the remote mirror.

## 2. Calculation tools

### calculate_commute_hurdle

Inputs are explicit assumptions. Output is a modeled required additional gross, not an earnings forecast.

### calculate_offer_threshold

Includes recovery mileage. Output is modeled operating contribution and rate metrics.

## 3. Proposal tools

### queue_expense_proposal

Creates a remote proposal. It does not write the canonical local expense record.

### queue_shift_update_proposal

Creates a bounded proposal for an existing synchronized shift. It does not alter the canonical shift.

Both require the `ledger.propose` scope.

## 4. Side-effect wording

After a successful proposal tool call, say that the proposal was **queued for local review**.

Do not say it was saved, applied, recorded, or changed in the canonical ledger.

## 5. Retry/idempotency

Every intended proposal gets a unique `clientRequestId`.

If a network/tool retry repeats the same intended mutation, reuse the same `clientRequestId`. The server returns the existing proposal instead of creating a duplicate.
