import type { Expense, Receipt, Shift, Vehicle } from '../domain/types';
import { mondayOf } from '../domain/dates';

let n = 0;
const id = (p: string) => `${p}-${++n}`;

export function makeVehicle(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: id('veh'),
    label: 'Test Car',
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

export function makeShift(over: Partial<Shift> = {}): Shift {
  const date = over.date ?? '2026-01-05';
  return {
    id: id('shift'),
    status: 'completed',
    date,
    weekKey: mondayOf(date),
    vehicleId: 'veh-1',
    vehicleLabel: 'Test Car',
    startTime: '10:00',
    endTime: '15:00',
    startOdometer: 1000,
    endOdometer: 1100,
    appEarningsCents: 5000,
    cashTipsCents: 500,
    purpose: 'DoorDash delivery work',
    notes: '',
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-05T15:00:00.000Z',
    ...over,
  };
}

export function makeExpense(over: Partial<Expense> = {}): Expense {
  return {
    id: id('exp'),
    date: '2026-01-05',
    amountCents: 4000,
    merchant: 'Shell',
    category: 'Fuel',
    taxClass: 'VEHICLE_ACTUAL',
    notes: '',
    shiftId: null,
    receiptId: null,
    createdAt: '2026-01-05T12:00:00.000Z',
    updatedAt: '2026-01-05T12:00:00.000Z',
    ...over,
  };
}

export function makeReceipt(over: Partial<Receipt> = {}): Receipt {
  return {
    id: id('rec'),
    capturedAt: '2026-01-05T12:00:00.000Z',
    date: '2026-01-05',
    merchant: 'Shell',
    amountCents: 4000,
    category: 'Fuel',
    taxClass: 'VEHICLE_ACTUAL',
    notes: '',
    status: 'Classified',
    expenseId: null,
    originalFilename: 'r.jpg',
    mimeType: 'image/jpeg',
    byteCount: 1234,
    imageProcessingError: null,
    createdAt: '2026-01-05T12:00:00.000Z',
    updatedAt: '2026-01-05T12:00:00.000Z',
    ...over,
  };
}
