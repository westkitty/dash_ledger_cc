# Dash Ledger formulas

## Contents

1. Money convention
2. Current shift summaries
3. Modeled offer contribution
4. Commute/reposition hurdle
5. Denominator warnings

## 1. Money convention

Stored money fields ending in `Cents` are integer cents. Never reinterpret them as dollar floats.

Display conversion is `cents / 100` only at the presentation boundary.

## 2. Current shift summaries

Current production shift gross:

`gross_cents = app_earnings_cents + cash_tips_cents`

when null stored components contribute zero to the gross arithmetic. Do not imply a missing source was observed as an actual zero; preserve the source-field distinction when it matters.

Current business miles are available only when both odometer readings are finite and ending odometer is not below starting odometer:

`business_miles = end_odometer - start_odometer`

Tracked shift minutes are available only when both same-day wall-clock fields are present and end is not before start:

`tracked_minutes = end_minutes - start_minutes`

Do not label tracked minutes as door-to-door time.

## 3. Modeled offer contribution

For offer modeling:

`total_miles = delivery_miles + recovery_miles`

`modeled_vehicle_cost_cents = round(total_miles * vehicle_cost_per_mile * 100)`

`direct_costs_cents = modeled_vehicle_cost_cents + tolls_cents + parking_cents + other_direct_costs_cents`

`operating_contribution_cents = gross_cents - direct_costs_cents`

If active minutes > 0:

`gross_per_active_hour_cents = round(gross_cents * 60 / active_minutes)`

`contribution_per_active_hour_cents = round(operating_contribution_cents * 60 / active_minutes)`

If total miles > 0:

`gross_per_mile_cents = round(gross_cents / total_miles)`

`contribution_per_mile_cents = round(operating_contribution_cents / total_miles)`

Use `calculate_offer_threshold` rather than reimplementing this arithmetic conversationally.

## 4. Commute/reposition hurdle

`deliberate_miles = outbound_miles + return_miles`

`deliberate_minutes = outbound_minutes + return_minutes`

`vehicle_cost = deliberate_miles * vehicle_cost_per_mile`

`time_cost = deliberate_minutes / 60 * value_of_time_per_hour`

`required_additional_gross = vehicle_cost + time_cost`

The result is a modeled hurdle based on explicit assumptions, not a prediction that another market will earn that premium.

## 5. Denominator warnings

Never compare unlike denominators without labeling them.

Examples:

- $250 / 8 active hours is not the same rate as $250 / 15 online hours.
- A shift's recorded start/end interval is not automatically door-to-door time.
- Delivery miles without recovery/reposition miles can overstate profitability.
