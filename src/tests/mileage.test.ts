import { describe, it, expect } from 'vitest';
import { computeMileage, countableBusinessMiles, suggestStartOdometer, checkContinuity } from '../domain/mileage';
import { makeShift } from './factories';

describe('business mileage', () => {
  it('1000 -> 1150 = 150', () => {
    const r = computeMileage(1000, 1150);
    expect(r.status).toBe('ok');
    expect(r.miles).toBe(150);
  });

  it('reversed odometer is rejected, not zeroed or swapped', () => {
    const r = computeMileage(1150, 1000);
    expect(r.status).toBe('reversed');
    expect(r.miles).toBe(-150);
  });

  it('a 900-mile dash is preserved but flagged suspicious', () => {
    const r = computeMileage(0, 900, 400);
    expect(r.miles).toBe(900);
    expect(r.status).toBe('suspicious');
  });

  it('missing a reading yields missing, never a fabricated distance', () => {
    expect(computeMileage(1000, null).miles).toBeNull();
    expect(computeMileage(null, 1100).status).toBe('missing');
  });

  it('countable miles exclude reversed and suspicious stays counted', () => {
    expect(countableBusinessMiles(makeShift({ startOdometer: 1000, endOdometer: 1150 }))).toBe(150);
    expect(countableBusinessMiles(makeShift({ startOdometer: 1150, endOdometer: 1000 }))).toBe(0);
    expect(countableBusinessMiles(makeShift({ startOdometer: 0, endOdometer: 900 }), 400)).toBe(900);
  });
});

describe('odometer continuity', () => {
  const carA = 'veh-A';
  const carB = 'veh-B';
  const history = [
    makeShift({ vehicleId: carA, date: '2026-01-05', startOdometer: 49900, endOdometer: 50000, status: 'completed' }),
    makeShift({ vehicleId: carB, date: '2026-01-06', startOdometer: 10000, endOdometer: 10120, status: 'completed' }),
  ];

  it('suggests the vehicle-specific last ending odometer', () => {
    expect(suggestStartOdometer(history, carA, '2026-01-10')).toBe(50000);
    expect(suggestStartOdometer(history, carB, '2026-01-10')).toBe(10120);
  });

  it('never prefills one vehicle from another vehicle', () => {
    const onlyA = [history[0]];
    expect(suggestStartOdometer(onlyA, carB, '2026-01-10')).toBeNull();
  });

  it('a continuity gap is reported and is NOT counted as business mileage', () => {
    const cont = checkContinuity(history, carA, '2026-01-10', 50025);
    expect(cont.hasGap).toBe(true);
    expect(cont.gap).toBe(25);
    // The new shift's business mileage is still (its own end - its own start).
    const next = makeShift({ vehicleId: carA, startOdometer: 50025, endOdometer: 50075 });
    expect(countableBusinessMiles(next)).toBe(50);
  });

  it('no gap when the start matches the prior ending exactly', () => {
    const cont = checkContinuity(history, carA, '2026-01-10', 50000);
    expect(cont.hasGap).toBe(false);
    expect(cont.gap).toBe(0);
  });
});
