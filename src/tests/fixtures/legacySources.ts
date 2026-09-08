/**
 * Fixtures for every Dash Ledger source dialect.
 *
 * The `legacyAOriginalBackup` body is a real record captured from the original
 * single-file app: a completed dash with `appEarnings: 84.5` and `cashTips: 12`,
 * i.e. $96.50 gross. That exact record is what an early `dash_ledger_cc` build
 * displayed as $0.00, because it read `appEarningsCents` while the dollars sat
 * untouched in the row. It is kept verbatim so the regression stays reproducible.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 1x1 transparent PNG. Small enough to keep fixtures readable. */
export const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII=';

/** The dash at the centre of the $96.50 -> $0.00 corruption. */
export const LEGACY_A_MONEY_SHIFT = {
  id: 'a1ad864c-fbce-4734-bd87-88bf85eb352e',
  status: 'completed',
  vehicleId: '25042c0e-e7f1-4eb7-b480-3b4921a6701b',
  date: '2026-09-08',
  startTime: '14:25',
  endTime: '16:00',
  startOdometer: 1000,
  endOdometer: 1150,
  businessMiles: 150,
  appEarnings: 84.5,
  cashTips: 12,
  grossIncome: 96.5,
  purpose: 'DoorDash delivery work',
  notes: '',
  odometerGap: false,
  createdAt: '2026-09-08T18:25:18.577Z',
  updatedAt: '2026-09-08T18:25:31.573Z',
  implausibleNote: null,
};

/** Same event, but the whole $96.50 is app earnings rather than earnings + tips. */
export const LEGACY_A_GROSS_AS_APP_EARNINGS_SHIFT = {
  ...LEGACY_A_MONEY_SHIFT,
  id: 'legacy-a-all-app-earnings',
  appEarnings: 96.5,
  cashTips: 0,
  grossIncome: 96.5,
};

const A_VEHICLE = {
  id: '25042c0e-e7f1-4eb7-b480-3b4921a6701b',
  label: 'My car',
  createdAt: '2026-09-08T18:24:21.408Z',
  updatedAt: '2026-09-08T18:24:21.409Z',
};

/** A backup exactly as the original single-file app writes it. */
export function legacyAOriginalBackup(over: Record<string, any> = {}): Record<string, any> {
  return {
    format: 'dash-ledger-backup',
    schemaVersion: 1,
    appVersion: '1.0.0',
    generatedAt: '2026-09-08T18:25:45.934Z',
    counts: { vehicles: 1, shifts: 2, expenses: 1, receipts: 1, weeklyClosures: 1, receiptImages: 1 },
    settings: {
      theme: 'system',
      overdueDays: 14,
      defaultVehicleId: A_VEHICLE.id,
      defaultPurpose: 'DoorDash delivery work',
      implausibleMiles: 400,
      mileageRates: [
        { id: 'rate-2026-h1', start: '2026-01-01', end: '2026-06-30', rate: 0.725, locked: true, note: '2026 first half' },
        { id: 'rate-2026-h2', start: '2026-07-01', end: '2026-12-31', rate: 0.76, locked: true, note: '2026 second half' },
      ],
      merchantMemory: { shell: { category: 'Fuel', count: 3 } },
      statementTotals: { '2026': 12345.67 },
      annualOdometer: { '2026': { start: 900, end: 21000 } },
    },
    vehicles: [A_VEHICLE],
    shifts: [LEGACY_A_MONEY_SHIFT, LEGACY_A_GROSS_AS_APP_EARNINGS_SHIFT],
    expenses: [
      {
        id: 'ex1',
        date: '2026-09-08',
        amount: 40.25,
        merchant: 'Shell',
        category: 'Fuel',
        taxClass: 'VEHICLE_ACTUAL',
        shiftId: LEGACY_A_MONEY_SHIFT.id,
        receiptId: 'rc1',
        notes: '',
        createdAt: '2026-09-08T12:00:00.000Z',
        updatedAt: '2026-09-08T12:00:00.000Z',
      },
    ],
    weeklyClosures: [
      { weekKey: '2026-09-07', reviewedAt: '2026-09-15T00:00:00.000Z', notes: 'looks right' },
    ],
    receipts: [
      {
        id: 'rc1',
        expenseId: 'ex1',
        capturedAt: '2026-09-08T12:00:00.000Z',
        date: '2026-09-08',
        originalFilename: 'shell.jpg',
        mime: 'image/png',
        status: 'Classified',
        category: 'Fuel',
        merchant: 'Shell',
        amount: 40.25,
        notes: '',
        processError: null,
        imageBase64: TINY_PNG_DATA_URL,
        imageMime: 'image/png',
        imageBytes: 68,
        createdAt: '2026-09-08T12:00:00.000Z',
        updatedAt: '2026-09-08T12:00:00.000Z',
      },
    ],
    ...over,
  };
}

/** A backup as an early `dash_ledger_cc` build writes it: same marker, cents body. */
export function ccV1Backup(over: Record<string, any> = {}): Record<string, any> {
  return {
    format: 'dash-ledger-backup',
    schemaVersion: 1,
    appVersion: '1.0.0',
    generatedAt: '2026-09-08T19:00:00.000Z',
    settings: {
      theme: 'dark',
      backupOverdueDays: 21,
      defaultVehicleId: 'veh-cc',
      defaultPurpose: 'DoorDash delivery work',
      implausibleMiles: 400,
      annualOdometers: [{ year: 2026, vehicleId: null, startOdometer: 900, endOdometer: 21000 }],
      statementTotals: [{ year: 2026, appEarningsCents: 1234567, note: '1099' }],
    },
    meta: {
      schemaVersion: 1,
      appVersion: '1.0.0',
      lastRecordChangeAt: '2026-09-08T19:00:00.000Z',
      lastBackupGeneratedAt: '2026-09-08T19:00:00.000Z',
      lastArchiveConfirmedAt: '2026-09-07T19:00:00.000Z',
      restoredAt: null,
    },
    vehicles: [
      { id: 'veh-cc', label: 'Corolla', archived: false, createdAt: 'x', updatedAt: 'x' },
    ],
    shifts: [
      {
        id: 'cc-shift-1',
        status: 'completed',
        date: '2026-09-08',
        weekKey: '2026-09-07',
        vehicleId: 'veh-cc',
        vehicleLabel: 'Corolla',
        startTime: '10:00',
        endTime: '15:00',
        startOdometer: 2000,
        endOdometer: 2120,
        appEarningsCents: 8450,
        cashTipsCents: 1200,
        purpose: 'DoorDash delivery work',
        notes: '',
        createdAt: 'x',
        updatedAt: 'x',
      },
    ],
    expenses: [
      {
        id: 'cc-exp-1',
        date: '2026-09-08',
        amountCents: 4025,
        merchant: 'Shell',
        category: 'Fuel',
        taxClass: 'VEHICLE_ACTUAL',
        notes: '',
        shiftId: 'cc-shift-1',
        receiptId: null,
        createdAt: 'x',
        updatedAt: 'x',
      },
    ],
    weeklyClosures: [
      { weekKey: '2026-09-07', reviewedAt: '2026-09-15T00:00:00.000Z', reopenedAt: null, note: '' },
    ],
    receipts: [],
    mileageRates: [
      {
        id: 'seed-2026-07-01',
        startDate: '2026-07-01',
        endDate: '2026-12-31',
        ratePerMile: 0.76,
        label: 'IRS standard business rate 2026',
        source: 'Seeded reference data',
        seeded: true,
      },
    ],
    merchantMemory: [
      {
        merchantKey: 'shell',
        displayName: 'Shell',
        counts: { Fuel: 3 },
        lastCategory: 'Fuel',
        lastTaxClass: 'VEHICLE_ACTUAL',
        updatedAt: 'x',
      },
    ],
    ...over,
  };
}

/** A backup as the Grok build writes it: `dashes`, `weekReviews`, snake-case classes. */
export function grokBackup(over: Record<string, any> = {}): Record<string, any> {
  return {
    format: 'dash-ledger-grok-backup',
    schemaVersion: 1,
    appVersion: '1.0.0',
    generatedAt: '2026-09-08T20:00:00.000Z',
    settings: {
      theme: 'system',
      overdueDays: 14,
      defaultVehicleId: 'veh-grok',
      defaultPurpose: 'DoorDash delivery work',
      implausibleMiles: 400,
      mileageRates: [
        { id: 'irs-2026-h2', start: '2026-07-01', end: '2026-12-31', rate: 0.76, locked: true, note: '2026 second half' },
      ],
      merchantMemory: { shell: { category: 'Fuel', count: 2 } },
      statementTotals: { '2026': 5000.5 },
      annualOdometer: { '2026': { start: 100, end: 9000 } },
      lastBackupAt: '2026-09-08T20:00:00.000Z',
      lastBackupConfirmedAt: '2026-09-06T20:00:00.000Z',
      lastMutationAt: '2026-09-08T19:59:00.000Z',
    },
    vehicles: [
      {
        id: 'veh-grok',
        name: 'Prius',
        notes: 'blue',
        createdAt: 'x',
        updatedAt: 'x',
        archivedAt: null,
      },
    ],
    dashes: [
      {
        id: 'grok-dash-1',
        status: 'completed',
        vehicleId: 'veh-grok',
        date: '2026-09-08',
        startTime: '09:00',
        endTime: '13:30',
        startOdometer: 500,
        endOdometer: 640,
        businessMiles: 140,
        appEarnings: 96.5,
        cashTips: 0,
        grossIncome: 96.5,
        purpose: 'DoorDash delivery work',
        notes: '',
        odometerGap: false,
        implausibleNote: null,
        createdAt: 'x',
        updatedAt: 'x',
      },
    ],
    expenses: [
      {
        id: 'grok-exp-1',
        date: '2026-09-08',
        amount: 12.75,
        merchant: 'Toll Road',
        category: 'Tolls',
        taxClass: 'mileage_addon',
        notes: '',
        receiptId: null,
        dashId: 'grok-dash-1',
        createdAt: 'x',
        updatedAt: 'x',
      },
    ],
    weekReviews: [
      { weekKey: '2026-09-07', status: 'reviewed', reviewedAt: '2026-09-15T00:00:00.000Z', notes: 'ok' },
      { weekKey: '2026-08-31', status: 'open', reviewedAt: null, notes: '' },
    ],
    receipts: [
      {
        id: 'grok-rc-1',
        date: '2026-09-08',
        capturedAt: '2026-09-08T13:00:00.000Z',
        merchant: 'Toll Road',
        amount: 12.75,
        category: 'Tolls',
        taxClass: 'mileage_addon',
        notes: '',
        status: 'classified',
        expenseId: 'grok-exp-1',
        mime: 'image/png',
        byteLength: 68,
        width: 800,
        height: 1200,
        imageBase64: TINY_PNG_DATA_URL,
        createdAt: 'x',
        updatedAt: 'x',
      },
    ],
    ...over,
  };
}
