/**
 * Phase 5 — Tax Binder output.
 *
 * The binder is a standalone HTML document the user keeps at tax time. It must
 * stay understandable without the app, escape user text, embed receipt images,
 * and never fabricate a figure it does not have.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB } from '../db/db';
import { createReceipt } from '../db/repositories';
import { buildTaxBinderHtml } from '../services/taxBinder';
import { DEFAULT_SETTINGS } from '../domain/types';
import { seededMileageRates } from '../domain/mileageRates';
import { makeShift, makeExpense } from './factories';

async function clearAll() {
  const db = getDB();
  if (!db.isOpen()) await db.open();
  await Promise.all([db.receipts.clear(), db.receiptBlobs.clear()]);
}

const baseInput = () => ({
  year: 2026,
  shifts: [
    makeShift({ date: '2026-03-04', appEarningsCents: 9650, cashTipsCents: 1000, startOdometer: 1000, endOdometer: 1150 }),
    makeShift({ date: '2026-07-02', appEarningsCents: 12000, cashTipsCents: 0, startOdometer: 1150, endOdometer: 1400 }),
  ],
  expenses: [makeExpense({ date: '2026-03-05', merchant: '<script>alert(1)</script>', amountCents: 4200 })],
  receipts: [],
  weeklyClosures: [],
  mileageRates: seededMileageRates(),
  settings: { ...DEFAULT_SETTINGS },
});

describe('Tax Binder', () => {
  beforeEach(clearAll);

  it('produces a self-contained HTML document for the year', async () => {
    const html = await buildTaxBinderHtml(baseInput());
    expect(html).toMatch(/<html/i);
    expect(html).toMatch(/<\/html>/i);
    expect(html).toContain('<style');
    expect(html).toContain('2026');
    expect(html).toMatch(/Mar\D+4\D+2026/); // shift date, human-formatted
    expect(html).toContain('$96.50'); // formatted money, not raw cents
    expect(html).not.toContain('>9650<');
  });

  it('escapes user-entered text so it cannot inject markup', async () => {
    const html = await buildTaxBinderHtml(baseInput());
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('embeds a receipt image as a data URL', async () => {
    const receipt = await createReceipt({
      meta: {
        capturedAt: '2026-03-05T12:00:00.000Z',
        date: '2026-03-05',
        merchant: 'Shell',
        amountCents: 4200,
        category: 'Fuel',
        taxClass: 'VEHICLE_ACTUAL',
        notes: '',
        status: 'Classified',
        expenseId: null,
        originalFilename: 'r.png',
        mimeType: 'image/png',
        byteCount: 4,
        imageProcessingError: null,
      },
      image: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
      thumbnail: null,
    });
    const html = await buildTaxBinderHtml({ ...baseInput(), receipts: [await getDB().receipts.get(receipt.id) as never] });
    expect(html).toMatch(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
  });

  it('does not fabricate a business-use percentage without annual odometer data', async () => {
    const html = await buildTaxBinderHtml(baseInput());
    // No annual odometer entered -> percentage must not be asserted as a number.
    expect(html).not.toMatch(/business[- ]use[^<]*\d+\.\d%/i);
  });

  it('builds without throwing for a year with no records', async () => {
    const html = await buildTaxBinderHtml({ ...baseInput(), shifts: [], expenses: [], receipts: [] });
    expect(html).toMatch(/<html/i);
    expect(html).toContain('2026');
  });
});
