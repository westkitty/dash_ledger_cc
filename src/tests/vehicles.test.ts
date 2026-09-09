/**
 * Phase 6 — vehicle lifecycle.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '../db/db';
import {
  createVehicle,
  getSettings,
  listVehicles,
  logCompletedShift,
  updateVehicle,
} from '../db/repositories';
import { todayLocalDate } from '../domain/dates';

async function clearAll() {
  const db = getDB();
  if (!db.isOpen()) await db.open();
  await Promise.all([db.vehicles.clear(), db.shifts.clear(), db.kv.clear()]);
}

describe('vehicles', () => {
  beforeEach(clearAll);

  it('first vehicle becomes the default; a later one does not steal it', async () => {
    const a = await createVehicle('Corolla');
    const b = await createVehicle('Prius');
    expect((await getSettings()).defaultVehicleId).toBe(a.id);
    expect(b.archived).toBe(false);
  });

  it('archiving is reversible and never hard-deletes', async () => {
    const v = await createVehicle('Civic');
    await updateVehicle(v.id, { archived: true });
    expect((await getDB().vehicles.get(v.id))!.archived).toBe(true);
    await updateVehicle(v.id, { archived: false });
    expect((await getDB().vehicles.get(v.id))!.archived).toBe(false);
    expect(await listVehicles()).toHaveLength(1);
  });

  it('archiving the default vehicle reassigns the default to another active one', async () => {
    const a = await createVehicle('Corolla'); // default
    const b = await createVehicle('Prius');
    await updateVehicle(a.id, { archived: true });
    expect((await getSettings()).defaultVehicleId).toBe(b.id);
  });

  it('archiving the only vehicle clears the default rather than pointing at an archived car', async () => {
    const a = await createVehicle('Corolla');
    await updateVehicle(a.id, { archived: true });
    expect((await getSettings()).defaultVehicleId).toBeNull();
  });

  it('a historical shift keeps the vehicle label it had at the time', async () => {
    const v = await createVehicle('Old Name');
    await logCompletedShift({
      vehicleId: v.id,
      vehicleLabel: v.label,
      date: todayLocalDate(),
      startTime: '09:00',
      endTime: '15:00',
      startOdometer: 1000,
      endOdometer: 1100,
      appEarningsCents: 5000,
      cashTipsCents: 0,
      purpose: 'work',
      notes: '',
    });
    await updateVehicle(v.id, { label: 'New Name' });
    const shift = (await getDB().shifts.toArray())[0];
    expect(shift.vehicleLabel).toBe('Old Name');
    expect(shift.vehicleId).toBe(v.id);
  });
});
