/**
 * Phase 2 — repository-layer guarantees for the field Dash flow.
 *
 * These do not go through React. They prove the invariants that the Desk sheets
 * rely on but must never own: one active dash at a time, reversed-odometer
 * rejection at the write, suspicious mileage preserved exactly, and the active
 * dash surviving a fresh snapshot load.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '../db/db';
import {
  createVehicle,
  endShift,
  getActiveShift,
  loadSnapshot,
  startShift,
  type StartShiftInput,
} from '../db/repositories';
import { computeMileage } from '../domain/mileage';
import { todayLocalDate } from '../domain/dates';

async function clearAll(): Promise<void> {
  const db = getDB();
  if (!db.isOpen()) await db.open();
  await Promise.all([
    db.vehicles.clear(),
    db.shifts.clear(),
    db.expenses.clear(),
    db.receipts.clear(),
    db.receiptBlobs.clear(),
    db.weeklyClosures.clear(),
    db.mileageRates.clear(),
    db.merchantMemory.clear(),
    db.kv.clear(),
  ]);
}

function startInput(over: Partial<StartShiftInput> = {}): StartShiftInput {
  return {
    vehicleId: 'veh-1',
    vehicleLabel: 'Test Car',
    date: todayLocalDate(),
    startTime: '09:00',
    startOdometer: 1000,
    purpose: 'DoorDash delivery work',
    ...over,
  };
}

describe('start dash', () => {
  beforeEach(clearAll);

  it('creates exactly one active dash', async () => {
    const { shift, created } = await startShift(startInput());
    expect(created).toBe(true);
    expect(shift.status).toBe('active');
    const actives = await getDB().shifts.where('status').equals('active').toArray();
    expect(actives).toHaveLength(1);
  });

  it('a second start returns the existing active dash and writes no new row', async () => {
    const first = await startShift(startInput({ startOdometer: 1000 }));
    const second = await startShift(startInput({ startOdometer: 9999 }));
    expect(second.created).toBe(false);
    expect(second.shift.id).toBe(first.shift.id);
    expect(second.shift.startOdometer).toBe(1000);
    expect(await getDB().shifts.count()).toBe(1);
  });

  it('two concurrent starts still yield one active row', async () => {
    await Promise.all([startShift(startInput()), startShift(startInput())]);
    const actives = await getDB().shifts.where('status').equals('active').toArray();
    expect(actives).toHaveLength(1);
  });

  it('a fresh vehicle can be created and immediately used to start', async () => {
    const v = await createVehicle('Chained Car');
    const { shift, created } = await startShift(
      startInput({ vehicleId: v.id, vehicleLabel: v.label }),
    );
    expect(created).toBe(true);
    expect(shift.vehicleId).toBe(v.id);
    expect(shift.vehicleLabel).toBe('Chained Car');
    expect(await getDB().vehicles.count()).toBe(1);
  });
});

describe('active dash persistence', () => {
  beforeEach(clearAll);

  it('survives a fresh snapshot load with all fields intact', async () => {
    await startShift(startInput({ startOdometer: 4210, startTime: '08:15' }));
    const snap = await loadSnapshot();
    expect(snap.activeShift).toBeDefined();
    expect(snap.activeShift!.status).toBe('active');
    expect(snap.activeShift!.startOdometer).toBe(4210);
    expect(snap.activeShift!.startTime).toBe('08:15');
  });
});

describe('end dash', () => {
  beforeEach(clearAll);

  it('rejects a reversed odometer at the repository layer and leaves the dash active', async () => {
    const { shift } = await startShift(startInput({ startOdometer: 1000 }));
    await expect(
      endShift(shift.id, {
        endTime: '17:00',
        endOdometer: 900,
        appEarningsCents: 5000,
        cashTipsCents: 0,
        notes: '',
      }),
    ).rejects.toThrow(/lower than the starting odometer/i);

    const still = await getActiveShift();
    expect(still?.id).toBe(shift.id);
    expect(still?.status).toBe('active');
    expect(still?.endOdometer ?? null).toBeNull();
  });

  it('preserves a suspicious mileage value exactly and completes the dash', async () => {
    const { shift } = await startShift(startInput({ startOdometer: 0 }));
    const done = await endShift(shift.id, {
      endTime: '20:00',
      endOdometer: 900,
      appEarningsCents: 12000,
      cashTipsCents: 800,
      notes: '',
    });
    expect(done.status).toBe('completed');
    expect(done.endOdometer).toBe(900);
    const m = computeMileage(done.startOdometer, done.endOdometer, 400);
    expect(m.status).toBe('suspicious');
    expect(m.miles).toBe(900);
    // App earnings and cash tips stay distinct integer-cent values.
    expect(done.appEarningsCents).toBe(12000);
    expect(done.cashTipsCents).toBe(800);
  });

  it('clears the active dash and updates the week snapshot after a normal end', async () => {
    const { shift } = await startShift(startInput({ startOdometer: 1000 }));
    await endShift(shift.id, {
      endTime: '15:00',
      endOdometer: 1150,
      appEarningsCents: 9650,
      cashTipsCents: 0,
      notes: '',
    });
    const snap = await loadSnapshot();
    expect(snap.activeShift).toBeUndefined();
    const completed = snap.shifts.filter((s) => s.status === 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0].endOdometer).toBe(1150);
  });
});
