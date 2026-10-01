# Dash Ledger operating rules

## Contents

1. Objective
2. Baseline/control
3. Platform versus city switching
4. Whole-day accounting
5. Movement questions
6. Field-test posture

## 1. Objective

Optimize modeled operating contribution with explicit time and mileage denominators, not raw gross alone.

Use per-hour and per-mile views together when the necessary inputs exist.

## 2. Baseline/control

When comparing deliberate travel away from Niles, use Niles as the zero-deliberate-commute control where applicable. An away market must repay the added travel burden before it can be economically superior under the model.

This rule does not claim Niles has higher live demand.

## 3. Platform versus city switching

When the user is idle or underperforming, prefer testing another available platform before deliberately driving to another city unless evidence already clears the movement hurdle.

This reduces deadhead/reposition cost and preserves a cleaner field comparison.

## 4. Whole-day accounting

Do not hide travel required to create the earning opportunity.

Where data exists, count:

- outbound deliberate travel;
- delivery mileage;
- recovery mileage;
- repositioning;
- return travel;
- parking/tolls/direct costs.

Keep active, online, tracked shift, and door-to-door time labels separate.

## 5. Movement questions

Procedure for "Should I move?":

1. Call `get_sync_status` if the question depends on the current shift.
2. Retrieve the smallest current/history set that supports the comparison.
3. Identify what is recorded versus assumed.
4. Use `calculate_commute_hurdle` for deliberate move burden.
5. Compare the hurdle against matched personal evidence when available.
6. If current demand in the target market is unknown, say so.
7. Do not treat a hotspot or store-density proxy as proof that the hurdle will be repaid.

## 6. Field-test posture

When evidence is insufficient, recommend a bounded measurement rather than a folklore conclusion. Preserve comparable daypart, platform, time denominator, mileage denominator, and market context as much as practical.
