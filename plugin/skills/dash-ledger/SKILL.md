---
name: dash-ledger
description: Use the connected Dash Ledger MCP tools to inspect the user's synchronized delivery-work ledger, summarize or compare shifts, check current mirror freshness, calculate delivery or commute economics, surface records needing review, and queue expense or shift-update proposals for local approval. Trigger for requests about the user's Dash Ledger data, current or historical delivery earnings/mileage, whether synchronized evidence supports moving markets, offer economics, or adding/correcting ledger records through ChatGPT. Do not trigger for generic gig-work advice, unrelated tax questions, or market claims that do not use the user's ledger.
---

# Dash Ledger

Use Dash Ledger as an evidence-preserving operating interface over the user's synchronized mirror. The browser ledger remains canonical; the MCP server is a disposable read mirror plus proposal inbox.

## Core workflow

1. Determine whether the request depends on current ledger state.
2. For current/today/active-shift/move-now questions, call `get_sync_status` first.
3. If the mirror is stale or unknown, say so before presenting any current-state conclusion. Never fill unsynchronized gaps from assumption.
4. Retrieve only the bounded data needed for the question.
5. Prefer deterministic MCP calculations over mental arithmetic when a matching tool exists.
6. Separate recorded data, calculated results, user-supplied assumptions, research rules, and unknown live demand.
7. For mutations, queue a proposal only. Never say the canonical ledger was changed until the user reports or the local app confirms acceptance.

## Freshness rules

Treat `get_sync_status` as mandatory before answering:

- "How am I doing today?"
- "How much have I made so far?"
- "What is my current hourly rate?"
- "Should I move?"
- "Compare this active shift with..."
- any question that implies the mirror represents the user's present work state.

Use the server's `fresh`, `aging`, `stale`, or `unknown` status as returned. Do not silently redefine thresholds.

If stale:

- identify the timestamp/age;
- answer historical or deterministic portions that remain valid;
- state that post-sync activity is unknown;
- do not describe the result as the user's live total.

## Time and mileage discipline

The current production ledger stores shift start/end times and odometer readings. Do not rename tracked shift time as door-to-door time unless a later schema explicitly provides door-to-door fields.

Keep these concepts distinct whenever available:

- active work time;
- app-online/dash time;
- tracked shift time;
- door-to-door time;
- delivery miles;
- recovery miles;
- deliberate repositioning/commute miles.

Never repair a missing or reversed odometer by assuming zero, swapping values, or clamping the result.

Read `references/formulas.md` when doing contribution, per-hour, per-mile, offer, or commute-hurdle reasoning.

## Market-movement discipline

For questions about leaving Niles or repositioning:

- treat Niles as the zero-deliberate-commute control when that comparison applies;
- price both outbound and return burden;
- include recovery mileage when evaluating offers;
- prefer switching platforms before switching cities unless the user's evidence clears the movement hurdle;
- do not treat store count, hotspot coloring, platform coverage, anecdote, or a larger city as proof of higher realized earnings;
- do not invent current demand.

Read `references/operating-rules.md` for the full procedure.

## Evidence discipline

Classify important claims as one of:

- recorded ledger fact;
- deterministic calculation;
- user-provided assumption;
- external/research proxy;
- anecdote;
- unknown / field-test required.

Do not upgrade a weaker evidence class into a stronger one.

Read `references/evidence-rules.md` when comparing markets, interpreting research, or deciding whether evidence supports an operating conclusion.

## Tool use

Use the smallest tool set that answers the request.

- `get_sync_status`: freshness/version/counts.
- `get_ledger_summary`: bounded local-date totals; returned time is tracked shift time.
- `get_recent_shifts`: recent records, maximum 100.
- `get_shift`: one synchronized shift by ID.
- `compare_periods`: deterministic bounded-period comparison.
- `get_pending_review_summary`: counts of synchronized review conditions.
- `calculate_commute_hurdle`: explicit travel/time assumptions -> required additional gross.
- `calculate_offer_threshold`: gross, active minutes, delivery/recovery miles, direct costs -> modeled contribution metrics.
- `queue_expense_proposal`: proposal only; requires local approval.
- `queue_shift_update_proposal`: proposal only; requires local approval.

Read `references/tool-contracts.md` before using proposal tools or when a tool's semantics affect wording.

## Mutation language

After `queue_expense_proposal` or `queue_shift_update_proposal`, use language such as:

- "Queued for Dash Ledger review."
- "I proposed the change; it is not in the canonical ledger until you accept it in Dash Ledger."

Never say:

- "Saved."
- "I changed your ledger."
- "Done."

unless subsequent evidence proves local acceptance occurred.

Use a unique `clientRequestId` for each intended proposal. Reuse the same ID only when retrying the same intended mutation.

## Privacy boundary

Assume the bridge intentionally excludes receipt images, receipt metadata, merchant names from synchronized expense history, and freeform notes unless a later verified contract says otherwise.

Do not infer missing private fields or ask the MCP server for data outside its declared tools.

## Failure behavior

If the bridge is unavailable:

- say the GPT mirror cannot be reached;
- do not imply the local ledger is damaged;
- continue with deterministic calculations from values the user directly provides when useful;
- do not invent unsynchronized ledger state.

## Output style

Lead with the operational answer, then the numbers that justify it. Keep evidence qualifiers close to the claim they constrain. When a decision depends on an unknown live variable, name the unknown rather than burying it.
