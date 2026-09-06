import { describe, it, expect } from 'vitest';
import { csvEscape, toCsv, shiftsToCsv, expensesToCsv } from '../services/csv';
import { makeShift, makeExpense } from './factories';

describe('CSV escaping', () => {
  it('doubles embedded quotes and wraps fields containing quotes', () => {
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
  });
  it('wraps fields containing commas', () => {
    expect(csvEscape('a,b,c')).toBe('"a,b,c"');
  });
  it('wraps fields containing CR or LF', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
  });
  it('leaves plain values and blanks alone', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('')).toBe('');
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });
  it('rows end with CRLF', () => {
    const out = toCsv(['A', 'B'], [['1', '2']]);
    expect(out).toBe('A,B\r\n1,2\r\n');
  });
});

describe('shifts CSV', () => {
  it('has the required columns, chronological order and human-readable currency', () => {
    const csv = shiftsToCsv([
      makeShift({ date: '2026-01-07', appEarningsCents: 4000, cashTipsCents: 0, startOdometer: 100, endOdometer: 150 }),
      makeShift({ date: '2026-01-05', appEarningsCents: 8000, cashTipsCents: 2500, startOdometer: 0, endOdometer: 100, notes: 'busy, "peak"' }),
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe(
      'Date,Vehicle,Start,End,Start Odo,End Odo,Business Miles,DoorDash Earnings,Cash Tips,Gross Income,Purpose,Notes',
    );
    expect(lines[1].startsWith('2026-01-05,')).toBe(true); // sorted
    expect(lines[1]).toContain('80.00');
    expect(lines[1]).toContain('105.00');
    expect(lines[1]).toContain('"busy, ""peak"""');
    expect(lines[2].startsWith('2026-01-07,')).toBe(true);
  });
});

describe('expenses CSV', () => {
  it('has the required columns and tax class text', () => {
    const csv = expensesToCsv([makeExpense({ date: '2026-01-05', amountCents: 4275, merchant: 'Shell', category: 'Fuel' })]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Date,Amount,Merchant,Category,Tax Treatment Class,Linked Shift,Linked Receipt,Notes');
    expect(lines[1]).toContain('42.75');
    expect(lines[1]).toContain('VEHICLE_ACTUAL');
  });
});
