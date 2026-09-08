/**
 * Phase 3 — reversible deletion.
 *
 * Deleting a dash, expense or receipt returns an undo payload; restoring it
 * re-creates the record and re-attaches links only where the counterpart still
 * exists. Deleting one entity never destroys an independently meaningful record
 * it was merely linked to.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '../db/db';
import {
  createExpense,
  createReceipt,
  createVehicle,
  deleteExpense,
  deleteReceipt,
  deleteShift,
  getReceiptBlob,
  logCompletedShift,
  restoreDeletedExpense,
  restoreDeletedReceipt,
  restoreDeletedShift,
} from '../db/repositories';
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

async function makeShift() {
  const v = await createVehicle('Car');
  return logCompletedShift({
    vehicleId: v.id,
    vehicleLabel: v.label,
    date: todayLocalDate(),
    startTime: '09:00',
    endTime: '15:00',
    startOdometer: 1000,
    endOdometer: 1120,
    appEarningsCents: 8000,
    cashTipsCents: 500,
    purpose: 'work',
    notes: '',
  });
}

function expenseInput(over: Partial<Parameters<typeof createExpense>[0]> = {}) {
  return {
    date: todayLocalDate(),
    amountCents: 4275,
    merchant: 'Shell',
    category: 'Fuel',
    taxClass: 'VEHICLE_ACTUAL' as const,
    notes: '',
    shiftId: null,
    receiptId: null,
    ...over,
  };
}

async function makeReceiptRow() {
  return createReceipt({
    meta: {
      capturedAt: new Date().toISOString(),
      date: todayLocalDate(),
      merchant: 'Costco',
      amountCents: 5000,
      category: null,
      taxClass: null,
      notes: '',
      status: 'Inbox',
      expenseId: null,
      originalFilename: 'r.png',
      mimeType: 'image/png',
      byteCount: 3,
      imageProcessingError: null,
    },
    image: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
    thumbnail: null,
  });
}

describe('reversible shift deletion', () => {
  beforeEach(clearAll);

  it('restores the shift and re-links the expense whose shiftId was cleared', async () => {
    const shift = await makeShift();
    const exp = await createExpense(expenseInput({ shiftId: shift.id }));

    const deleted = await deleteShift(shift.id);
    expect(deleted).not.toBeNull();
    expect(deleted!.detachedExpenseIds).toEqual([exp.id]);
    // Linked expense survives the delete, only its back-reference is cleared.
    const after = await getDB().expenses.get(exp.id);
    expect(after).toBeDefined();
    expect(after!.shiftId).toBeNull();
    expect(await getDB().shifts.get(shift.id)).toBeUndefined();

    await restoreDeletedShift(deleted!);
    expect(await getDB().shifts.get(shift.id)).toBeDefined();
    expect((await getDB().expenses.get(exp.id))!.shiftId).toBe(shift.id);
  });

  it('deleting a shift twice is safe (second delete returns null)', async () => {
    const shift = await makeShift();
    expect(await deleteShift(shift.id)).not.toBeNull();
    expect(await deleteShift(shift.id)).toBeNull();
  });
});

describe('reversible expense deletion', () => {
  beforeEach(clearAll);

  it('keeps the linked receipt and re-links it on restore', async () => {
    const receipt = await makeReceiptRow();
    const exp = await createExpense(expenseInput({ receiptId: receipt.id }));

    const deleted = await deleteExpense(exp.id);
    expect(deleted!.detachedReceiptId).toBe(receipt.id);
    // Receipt is independent evidence — it must still be here.
    const r = await getDB().receipts.get(receipt.id);
    expect(r).toBeDefined();
    expect(r!.expenseId).toBeNull();

    await restoreDeletedExpense(deleted!);
    const back = await getDB().expenses.get(exp.id);
    expect(back).toBeDefined();
    expect(back!.amountCents).toBe(4275);
    expect((await getDB().receipts.get(receipt.id))!.expenseId).toBe(exp.id);
  });
});

describe('reversible receipt deletion', () => {
  beforeEach(clearAll);

  it('restores the receipt, its image bytes, and the expense link', async () => {
    const receipt = await makeReceiptRow();
    const exp = await createExpense(expenseInput({ receiptId: receipt.id }));

    const deleted = await deleteReceipt(receipt.id);
    expect(deleted!.blob).not.toBeNull();
    expect(deleted!.detachedExpenseId).toBe(exp.id);
    // Linked expense is independent — still present, link cleared.
    expect((await getDB().expenses.get(exp.id))!.receiptId).toBeNull();
    expect(await getReceiptBlob(receipt.id)).toBeUndefined();

    await restoreDeletedReceipt(deleted!);
    const row = await getReceiptBlob(receipt.id);
    expect(row).toBeDefined();
    expect(new Uint8Array(await row!.image.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect((await getDB().expenses.get(exp.id))!.receiptId).toBe(receipt.id);
  });

  it('does not re-link an expense that has since been linked to something else', async () => {
    const receiptA = await makeReceiptRow();
    const exp = await createExpense(expenseInput({ receiptId: receiptA.id }));
    const deleted = await deleteReceipt(receiptA.id);

    // Meanwhile the expense gets a different receipt.
    const receiptB = await makeReceiptRow();
    await getDB().expenses.update(exp.id, { receiptId: receiptB.id });

    await restoreDeletedReceipt(deleted!);
    // The expense keeps its newer link; the restored receipt comes back unlinked
    // rather than carrying a stale one-directional reference.
    expect((await getDB().expenses.get(exp.id))!.receiptId).toBe(receiptB.id);
    expect((await getDB().receipts.get(receiptA.id))!.expenseId).toBeNull();
  });
});
