# Dash Ledger evidence rules

## Contents

1. Evidence classes
2. Allowed upgrades
3. Market claims
4. Freshness
5. Unknowns

## 1. Evidence classes

Use these classes when a claim affects an operating conclusion:

- **Recorded fact**: directly present in the synchronized ledger.
- **Deterministic calculation**: computed from explicit inputs using a declared formula.
- **User-provided assumption**: value supplied for modeling, such as vehicle cost per mile.
- **External/research proxy**: contextual evidence that does not directly measure the user's realized earnings.
- **Anecdote**: reported experience without controlled measurement.
- **Unknown / field-test required**: not established by the available evidence.

## 2. Allowed upgrades

Never promote anecdote, proxy, inference, or missing information into a recorded local earnings fact.

A calculation is only as strong as its inputs. If an input is assumed, call the result modeled.

## 3. Market claims

The following do not by themselves prove a market pays the user more:

- more restaurants;
- larger population;
- hotspot coloring;
- platform availability;
- broad regional pay claims;
- one unusually good or bad shift;
- another driver's anecdote.

Use matched personal field data where possible and preserve the commute/reposition burden.

## 4. Freshness

A synchronized mirror is evidence only through its `sourceGeneratedAt` timestamp.

For present-state questions, call `get_sync_status`. If the mirror is stale, data recorded after the sync is unknown.

## 5. Unknowns

Name material unknowns explicitly. Good examples:

- current live demand;
- unsynchronized orders;
- unavailable recovery mileage;
- missing online/active time denominator;
- whether a static market proxy transfers to the current daypart.

Do not smooth unknowns into a clean-looking conclusion.
